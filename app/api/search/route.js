import { NextResponse } from 'next/server'
import { searchBusinesses, checkBusinessWebsite } from '@/lib/websiteChecker'

export async function POST(request) {
  try {
    const { query, location } = await request.json()

    if (!query || !location) {
      return NextResponse.json(
        { error: 'Query and location are required' },
        { status: 400 }
      )
    }

    // Search for businesses in the location
    const businesses = await searchBusinesses(query, location)

    // Check each business for a website
    // If businesses already have website info (from API), verify it; otherwise search for one
    console.log(`Checking websites for ${businesses.length} businesses...`)
    const businessesWithWebsiteStatus = await Promise.all(
      businesses.map(async (business, index) => {
        console.log(`[${index + 1}/${businesses.length}] Checking: ${business.name}`)
        const websiteCheck = await checkBusinessWebsite(
          business.name, 
          location, 
          business.website || null
        )
        
        if (websiteCheck.hasWebsite) {
          console.log(`  ✓ Has website: ${websiteCheck.website || business.website}`)
        } else {
          console.log(`  ✗ No website found`)
        }
        
        return {
          ...business,
          hasWebsite: websiteCheck.hasWebsite,
        }
      })
    )

    // Return all businesses with website status
    // Frontend will filter/hide businesses with websites
    const allBusinesses = businessesWithWebsiteStatus.map(({ hasWebsite, website, ...rest }) => ({
      ...rest,
      hasWebsite,
      website: website || null // Include website URL if found
    }))

    return NextResponse.json({ businesses: allBusinesses })
  } catch (error) {
    console.error('Search error:', error)
    
    // Provide more detailed error messages
    let errorMessage = error.message || 'Failed to search for businesses'
    
    // If it's a Google Places API error, pass through the detailed message
    if (error.message && error.message.includes('Google Places API error')) {
      return NextResponse.json(
        { error: errorMessage },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
