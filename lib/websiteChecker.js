/**
 * Check if a business has a website
 * This function attempts to find a website for a business by:
 * 1. Searching for the business name + location
 * 2. Checking if a website URL exists in search results
 * 
 * In production, you might want to use:
 * - Google Places API (which includes website field)
 * - Yelp API (which includes website field)
 * - Web scraping with proper rate limiting
 */

/**
 * Try to find a website for a business by searching common patterns
 * This is a fallback when Google Places API doesn't provide a website
 * Note: This makes HTTP requests which may be slow, but helps find websites
 * that Google Places API doesn't have in their database
 */
async function searchForWebsite(businessName, location) {
  try {
    // Clean the business name for domain checking
    let cleanName = businessName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '') // Remove special characters
      .replace(/\s+/g, '') // Remove spaces
      .replace(/^(the|a|an)\s+/i, '') // Remove articles
    
    // Skip if name is too short or generic
    if (cleanName.length < 3) {
      return { hasWebsite: false, website: null }
    }
    
    // Common domain patterns to check (prioritize .com)
    const possibleDomains = [
      `${cleanName}.com`,
      `www.${cleanName}.com`,
    ]
    
    // Try to verify if any of these domains exist
    // We'll do a simple HEAD request to check if the site exists
    for (const domain of possibleDomains) {
      try {
        const url = `https://${domain}`
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 2000) // 2 second timeout
        
        const response = await fetch(url, {
          method: 'HEAD',
          signal: controller.signal,
          redirect: 'follow',
          // Add headers to avoid some blocking
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; LeadGenerator/1.0)'
          }
        })
        
        clearTimeout(timeoutId)
        
        // If we get a 2xx or 3xx response, the site likely exists
        if (response.ok || (response.status >= 300 && response.status < 400)) {
          console.log(`Found website for ${businessName}: ${url}`)
          return { hasWebsite: true, website: url }
        }
      } catch (error) {
        // Domain doesn't exist, isn't accessible, or request timed out
        // Try next domain
        continue
      }
    }
    
    return { hasWebsite: false, website: null }
  } catch (error) {
    console.error('Error searching for website:', error)
    return { hasWebsite: false, website: null }
  }
}

export async function checkBusinessWebsite(businessName, location, existingWebsite = null) {
  try {
    // If website is already provided (e.g., from Google Places API), use it
    if (existingWebsite) {
      // Google Places API provides the website URL directly, so we trust it
      return {
        hasWebsite: true,
        website: existingWebsite
      }
    }
    
    // If no website provided, try to find one using common domain patterns
    // This helps catch businesses that have websites but Google Places API doesn't have them
    return await searchForWebsite(businessName, location)
  } catch (error) {
    console.error('Error checking website:', error)
    // If we can't check, assume no website (conservative approach)
    return { hasWebsite: false, website: null }
  }
}

/**
 * Search for businesses in a location
 * In production, integrate with:
 * - Google Places API (recommended - includes website field)
 * - Yelp Fusion API
 * - Foursquare API
 * - Or web scraping (with proper rate limiting and respect for robots.txt)
 */
/**
 * Fetch all results from Google Places API using pagination
 */
async function fetchAllPlaces(searchQuery, apiKey, maxPages = 2) {
  let allResults = []
  let nextPageToken = null
  let pageCount = 0
  
  do {
    let url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(searchQuery)}&key=${apiKey}`
    
    if (nextPageToken) {
      // Wait a bit before requesting next page (Google requires this)
      await new Promise(resolve => setTimeout(resolve, 2000))
      url += `&pagetoken=${nextPageToken}`
    }
    
    const response = await fetch(url)
    
    if (!response.ok) {
      throw new Error('Google Places API request failed')
    }
    
    const data = await response.json()
    
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      // Don't throw on first page if we have results, but log the error
      if (pageCount === 0) {
        let errorMessage = `Google Places API error: ${data.status}`
        
        if (data.status === 'REQUEST_DENIED') {
          errorMessage += '. This usually means:\n' +
            '1. Places API is not enabled in Google Cloud Console\n' +
            '2. Billing is not enabled for your Google Cloud project\n' +
            '3. API key restrictions are blocking the request\n' +
            '4. The API key is invalid\n\n' +
            'Please check: https://console.cloud.google.com/apis/library/places-backend.googleapis.com'
        } else if (data.status === 'INVALID_REQUEST') {
          errorMessage += '. The request was invalid. Check your query parameters.'
        } else if (data.status === 'OVER_QUERY_LIMIT') {
          errorMessage += '. You have exceeded your API quota. Check your billing.'
        } else if (data.status === 'UNKNOWN_ERROR') {
          errorMessage += '. An unknown error occurred. Please try again.'
        }
        
        throw new Error(errorMessage)
      }
      break
    }
    
    if (data.results && data.results.length > 0) {
      allResults = allResults.concat(data.results)
    }
    
    nextPageToken = data.next_page_token || null
    pageCount++
    
  } while (nextPageToken && pageCount < maxPages)
  
  return allResults
}

export async function searchBusinesses(query, location) {
  try {
    // OPTION 1: Google Places API (Recommended)
    if (process.env.GOOGLE_PLACES_API_KEY) {
      let allPlaces = []
      
      if (query && query.trim()) {
        // Specific business type or name search - single search only
        const trimmedQuery = query.trim()
        const searchQuery = `${trimmedQuery} in ${location}`
        allPlaces = await fetchAllPlaces(searchQuery, process.env.GOOGLE_PLACES_API_KEY, 1)
      } else {
        // Location-only search - use single most effective search term
        // "businesses" is the most comprehensive term
        const searchQuery = `businesses in ${location}`
        allPlaces = await fetchAllPlaces(searchQuery, process.env.GOOGLE_PLACES_API_KEY, 2)
      }
      
      if (allPlaces.length === 0) {
        return []
      }
      
      // Remove duplicates by place_id (in case pagination returned duplicates)
      const uniquePlaces = Array.from(
        new Map(allPlaces.map(place => [place.place_id, place])).values()
      )
      
      console.log(`Found ${uniquePlaces.length} unique businesses`)
      
      // For each place, get detailed information including website
      // Use data from text search (rating, types) and only request additional fields from details
      const placesWithDetails = await Promise.all(
        uniquePlaces.map(async (place) => {
          try {
            // Format business types from text search response (already available)
            const businessTypes = (place.types || [])
              .filter(type => !['establishment', 'point_of_interest', 'place'].includes(type))
              .map(type => type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()))
              .slice(0, 3)
            
            // Get all needed fields in a single API call to minimize requests
            // Request website, phone, hours, and url all at once
            const detailsResponse = await fetch(
              `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=website,formatted_phone_number,opening_hours,url&key=${process.env.GOOGLE_PLACES_API_KEY}`
            )
            const detailsData = await detailsResponse.json()
            
            // Use data from text search response (already have rating, types, name, address)
            const result = detailsData.status === 'OK' ? detailsData.result : {}
            const website = result.website || null
            const phone = result.formatted_phone_number || null
            const googleMapsUrl = result.url || null
            
            // Format opening hours
            let openingHoursStatus = null
            if (result.opening_hours?.open_now !== undefined) {
              openingHoursStatus = result.opening_hours.open_now ? 'Open now' : 'Closed now'
            }
            
            if (!website) {
              console.log(`No website in Google Places API for: ${place.name}`)
            }
            
            return {
              name: place.name,
              address: place.formatted_address || '',
              phone: phone,
              website: website,
              rating: place.rating || null, // From text search
              userRatingsTotal: place.user_ratings_total || null, // From text search
              businessStatus: null,
              types: businessTypes, // From text search
              openingHoursStatus: openingHoursStatus,
              priceLevel: null,
              googleMapsUrl: googleMapsUrl,
              placeId: place.place_id
            }
          } catch (error) {
            // If individual place details fail, use basic info from search
            console.error(`Error fetching details for ${place.name}:`, error)
            const businessTypes = (place.types || [])
              .filter(type => !['establishment', 'point_of_interest', 'place'].includes(type))
              .map(type => type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()))
              .slice(0, 3)
            
            return {
              name: place.name,
              address: place.formatted_address || '',
              phone: null,
              website: null,
              rating: place.rating || null,
              userRatingsTotal: place.user_ratings_total || null,
              businessStatus: null,
              types: businessTypes,
              openingHoursStatus: null,
              priceLevel: null,
              googleMapsUrl: null,
              placeId: place.place_id
            }
          }
        })
      )
      
      return placesWithDetails
    }
    
    // OPTION 2: Yelp Fusion API
    // Uncomment and configure this if you prefer Yelp
    /*
    if (process.env.YELP_API_KEY) {
      const response = await fetch(
        `https://api.yelp.com/v3/businesses/search?term=${encodeURIComponent(query)}&location=${encodeURIComponent(location)}&limit=20`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.YELP_API_KEY}`
          }
        }
      )
      
      if (!response.ok) {
        throw new Error('Yelp API request failed')
      }
      
      const data = await response.json()
      
      return data.businesses.map(business => ({
        name: business.name,
        address: business.location.display_address.join(', '),
        phone: business.display_phone || null,
        website: business.url || null, // Yelp URL, not business website
        yelpId: business.id
      }))
    }
    */
    
    // Fallback: Mock data for demonstration (only if no API key is configured)
    const mockBusinesses = [
      {
        name: `${query.charAt(0).toUpperCase() + query.slice(1)} Shop 1`,
        address: `123 Main Street, ${location}`,
        phone: `(555) ${Math.floor(Math.random() * 9000) + 1000}-${Math.floor(Math.random() * 9000) + 1000}`,
      },
      {
        name: `${query.charAt(0).toUpperCase() + query.slice(1)} Shop 2`,
        address: `456 Oak Avenue, ${location}`,
        phone: `(555) ${Math.floor(Math.random() * 9000) + 1000}-${Math.floor(Math.random() * 9000) + 1000}`,
      },
      {
        name: `${query.charAt(0).toUpperCase() + query.slice(1)} Shop 3`,
        address: `789 Pine Road, ${location}`,
        phone: `(555) ${Math.floor(Math.random() * 9000) + 1000}-${Math.floor(Math.random() * 9000) + 1000}`,
      },
      {
        name: `${query.charAt(0).toUpperCase() + query.slice(1)} Shop 4`,
        address: `321 Elm Street, ${location}`,
        phone: `(555) ${Math.floor(Math.random() * 9000) + 1000}-${Math.floor(Math.random() * 9000) + 1000}`,
      },
      {
        name: `${query.charAt(0).toUpperCase() + query.slice(1)} Shop 5`,
        address: `654 Maple Drive, ${location}`,
        phone: `(555) ${Math.floor(Math.random() * 9000) + 1000}-${Math.floor(Math.random() * 9000) + 1000}`,
      },
    ]
    
    return mockBusinesses
  } catch (error) {
    console.error('Error searching businesses:', error)
    throw error
  }
}
