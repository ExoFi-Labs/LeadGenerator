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
export async function searchBusinesses(query, location) {
  try {
    // OPTION 1: Google Places API (Recommended)
    if (process.env.GOOGLE_PLACES_API_KEY) {
      const searchQuery = `${query} in ${location}`
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(searchQuery)}&key=${process.env.GOOGLE_PLACES_API_KEY}`
      )
      
      if (!response.ok) {
        throw new Error('Google Places API request failed')
      }
      
      const data = await response.json()
      
      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
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
      
      if (data.status === 'ZERO_RESULTS' || !data.results || data.results.length === 0) {
        return []
      }
      
      // For each place, get detailed information including website
      // Use data from text search (rating, types) and only request additional fields from details
      // Limit to 20 results to avoid too many API calls
      const placesWithDetails = await Promise.all(
        data.results.slice(0, 20).map(async (place) => {
          try {
            // Format business types from text search response (already available)
            const businessTypes = (place.types || [])
              .filter(type => !['establishment', 'point_of_interest', 'place'].includes(type))
              .map(type => type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()))
              .slice(0, 3)
            
            // Only request website field first - we'll get other details only if needed
            // This reduces API calls significantly
            const detailsResponse = await fetch(
              `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=website&key=${process.env.GOOGLE_PLACES_API_KEY}`
            )
            const detailsData = await detailsResponse.json()
            
            // Use data from text search response (already have rating, types, name, address)
            const result = detailsData.status === 'OK' ? detailsData.result : {}
            const website = result.website || null
            
            // Only get additional details if business doesn't have a website
            // This saves API calls for businesses we'll filter out anyway
            let phone = null
            let openingHoursStatus = null
            let googleMapsUrl = null
            
            if (!website) {
              // Only fetch full details if no website (these are the leads we want)
              try {
                const fullDetailsResponse = await fetch(
                  `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=formatted_phone_number,opening_hours,url&key=${process.env.GOOGLE_PLACES_API_KEY}`
                )
                const fullDetailsData = await fullDetailsResponse.json()
                if (fullDetailsData.status === 'OK') {
                  phone = fullDetailsData.result.formatted_phone_number || null
                  googleMapsUrl = fullDetailsData.result.url || null
                  if (fullDetailsData.result.opening_hours?.open_now !== undefined) {
                    openingHoursStatus = fullDetailsData.result.opening_hours.open_now ? 'Open now' : 'Closed now'
                  }
                }
              } catch (error) {
                // If full details fail, continue with basic info
                console.error(`Error fetching full details for ${place.name}:`, error)
              }
            } else {
              // For businesses with websites, we can skip the fallback search entirely
              // Just get the Google Maps URL (cheap, single field request)
              try {
                const urlResponse = await fetch(
                  `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=url&key=${process.env.GOOGLE_PLACES_API_KEY}`
                )
                const urlData = await urlResponse.json()
                if (urlData.status === 'OK') {
                  googleMapsUrl = urlData.result.url || null
                }
              } catch (error) {
                // Ignore URL fetch errors
              }
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
