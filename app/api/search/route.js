import { NextResponse } from 'next/server'
import { searchBusinesses, checkBusinessWebsite } from '@/lib/websiteChecker'

export async function POST(request) {
  try {
    const { query, location } = await request.json()

    if (!location) {
      return NextResponse.json(
        { error: 'Location is required' },
        { status: 400 }
      )
    }

    // Search for businesses in the location
    const businesses = await searchBusinesses(query, location)

    // Check each business for a website
    // Optimize: Skip fallback search for businesses that already have websites from Google
    console.log(`Checking websites for ${businesses.length} businesses...`)
    const businessesWithWebsiteStatus = await Promise.all(
      businesses.map(async (business, index) => {
        console.log(`[${index + 1}/${businesses.length}] Checking: ${business.name}`)
        
        // Trust Google Places API data - no fallback search needed
        // This saves API calls and improves speed
        const hasWebsite = !!business.website
        
        if (hasWebsite) {
          console.log(`  ✓ Has website: ${business.website}`)
        } else {
          console.log(`  ✗ No website found`)
        }
        
        return {
          ...business,
          hasWebsite: hasWebsite,
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
