'use client'

import { useState } from 'react'
import './page.css'

export default function Home() {
  const [query, setQuery] = useState('')
  const [location, setLocation] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState([])
  const [error, setError] = useState('')
  const [showWithWebsites, setShowWithWebsites] = useState(false)
  const [savedBusinesses, setSavedBusinesses] = useState([])
  const [selectedBusinesses, setSelectedBusinesses] = useState(new Set())

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!query.trim() || !location.trim()) {
      setError('Please fill in both business type and location')
      return
    }

    setLoading(true)
    setError('')
    setResults([])

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, location }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to search for businesses')
      }

      setResults(data.businesses || [])
      setSelectedBusinesses(new Set())
    } catch (err) {
      setError(err.message || 'An error occurred while searching')
    } finally {
      setLoading(false)
    }
  }

  const toggleBusinessSelection = (index) => {
    const newSelected = new Set(selectedBusinesses)
    if (newSelected.has(index)) {
      newSelected.delete(index)
    } else {
      newSelected.add(index)
    }
    setSelectedBusinesses(newSelected)
  }

  const addSelectedToSaved = () => {
    const businessesToAdd = Array.from(selectedBusinesses)
      .map(idx => {
        const business = results[idx]
        return business && !business.hasWebsite ? business : null
      })
      .filter(b => b !== null)
    
    const newSaved = [...savedBusinesses, ...businessesToAdd]
    // Remove duplicates based on placeId or name+address combination
    const uniqueSaved = Array.from(
      new Map(newSaved.map(item => [
        item.placeId || `${item.name}_${item.address}`,
        item
      ])).values()
    )
    setSavedBusinesses(uniqueSaved)
    setSelectedBusinesses(new Set())
  }

  const removeFromSaved = (index) => {
    setSavedBusinesses(savedBusinesses.filter((_, i) => i !== index))
  }

  const exportToCSV = () => {
    if (savedBusinesses.length === 0) return
    
    const headers = ['Name', 'Address', 'Phone', 'Rating', 'Reviews', 'Types', 'Status', 'Google Maps']
    const rows = savedBusinesses.map(b => [
      b.name || '',
      b.address || '',
      b.phone || '',
      b.rating || '',
      b.userRatingsTotal || '',
      b.types?.join(', ') || '',
      b.openingHoursStatus || '',
      b.googleMapsUrl || ''
    ])
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `leads_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const exportToEmail = () => {
    if (savedBusinesses.length === 0) return
    
    const emailBody = savedBusinesses.map((b, i) => {
      return `${i + 1}. ${b.name}
   Address: ${b.address || 'N/A'}
   Phone: ${b.phone || 'N/A'}
   Rating: ${b.rating ? `${b.rating}/5 (${b.userRatingsTotal || 0} reviews)` : 'N/A'}
   ${b.googleMapsUrl ? `Maps: ${b.googleMapsUrl}` : ''}
`
    }).join('\n')
    
    const subject = encodeURIComponent(`Lead Generator - ${savedBusinesses.length} Leads`)
    const body = encodeURIComponent(`Found ${savedBusinesses.length} businesses without websites:\n\n${emailBody}`)
    
    window.location.href = `mailto:?subject=${subject}&body=${body}`
  }

  return (
    <div className="container">
      <div className="header">
        <h1>Lead Generator</h1>
        <p>Find local businesses without websites</p>
      </div>

      <div className="search-section">
        <form onSubmit={handleSubmit} className="search-form">
          <div className="form-group">
            <label htmlFor="query">Business Type</label>
            <input
              id="query"
              type="text"
              placeholder="e.g., restaurants, plumbers, lawyers"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="location">Location</label>
            <input
              id="location"
              type="text"
              placeholder="e.g., New York, NY or 10001"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className="search-button"
            disabled={loading}
          >
            {loading ? 'Searching...' : 'Find Leads'}
          </button>

          {error && (
            <div className="error">
              {error.split('\n').map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          )}
        </form>
      </div>

      {loading && (
        <div className="loading">
          Searching for businesses and checking websites...
        </div>
      )}

      {!loading && results.length > 0 && (() => {
        const businessesWithoutWebsites = results.filter(b => !b.hasWebsite)
        const businessesWithWebsites = results.filter(b => b.hasWebsite)
        const displayedResults = showWithWebsites ? results : businessesWithoutWebsites
        
        return (
          <div className="results-section">
            <div className="results-header">
              <h2>Search Results</h2>
              <div className="results-stats">
                <div className="results-count">
                  {businessesWithoutWebsites.length} without website
                  {businessesWithWebsites.length > 0 && (
                    <span className="with-website-count"> • {businessesWithWebsites.length} with website</span>
                  )}
                </div>
                {businessesWithWebsites.length > 0 && (
                  <label className="toggle-show-websites">
                    <input
                      type="checkbox"
                      checked={showWithWebsites}
                      onChange={(e) => setShowWithWebsites(e.target.checked)}
                    />
                    <span>Show businesses with websites</span>
                  </label>
                )}
              </div>
            </div>

            {businessesWithoutWebsites.length > 0 && (
              <div className="selection-actions">
                <button
                  onClick={addSelectedToSaved}
                  disabled={selectedBusinesses.size === 0}
                  className="add-to-saved-button"
                >
                  Add Selected ({selectedBusinesses.size}) to Saved List
                </button>
              </div>
            )}

            <div className="business-list">
              {displayedResults.map((business, displayIndex) => {
                // Find the actual index in the full results array
                const actualIndex = results.findIndex(r => 
                  r.placeId === business.placeId && r.name === business.name
                )
                const isSelected = actualIndex !== -1 && selectedBusinesses.has(actualIndex)
                const isSelectable = !business.hasWebsite
                
                return (
                  <div 
                    key={actualIndex !== -1 ? actualIndex : displayIndex} 
                    className={`business-card ${business.hasWebsite ? 'has-website' : ''} ${isSelected ? 'selected' : ''}`}
                  >
                    {isSelectable && (
                      <div className="business-select">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => actualIndex !== -1 && toggleBusinessSelection(actualIndex)}
                          id={`business-${actualIndex !== -1 ? actualIndex : displayIndex}`}
                        />
                        <label htmlFor={`business-${actualIndex !== -1 ? actualIndex : displayIndex}`}>Select</label>
                      </div>
                    )}
                    <div className="business-header">
                      <div className="business-name">{business.name}</div>
                    {business.rating && (
                      <div className="business-rating">
                        <span className="rating-stars">⭐</span>
                        <span className="rating-value">{business.rating.toFixed(1)}</span>
                        {business.userRatingsTotal && (
                          <span className="rating-count">({business.userRatingsTotal})</span>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {business.types && business.types.length > 0 && (
                    <div className="business-types">
                      {business.types.map((type, i) => (
                        <span key={i} className="business-type-tag">{type}</span>
                      ))}
                    </div>
                  )}
                  
                  <div className="business-info">
                    {business.address && (
                      <div className="business-address">📍 {business.address}</div>
                    )}
                    {business.phone && (
                      <div className="business-phone">📞 {business.phone}</div>
                    )}
                    {business.openingHoursStatus && (
                      <div className="business-hours">
                        <span className={business.openingHoursStatus === 'Open now' ? 'status-open' : 'status-closed'}>
                          {business.openingHoursStatus === 'Open now' ? '🟢' : '🔴'} {business.openingHoursStatus}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="business-footer">
                    {business.hasWebsite ? (
                      <>
                        <div className="has-website-badge">Has Website</div>
                        <div className="business-links">
                          {business.website && (
                            <a 
                              href={business.website} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="website-link"
                            >
                              Visit Website →
                            </a>
                          )}
                          <a 
                            href={`https://www.google.com/search?q=${encodeURIComponent(`${business.name} ${location}`)}`}
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="google-search-link"
                          >
                            Google Search →
                          </a>
                          {business.googleMapsUrl && (
                            <a 
                              href={business.googleMapsUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="google-maps-link"
                            >
                              Google Maps →
                            </a>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="no-website-badge">No Website Found</div>
                        <div className="business-links">
                          <a 
                            href={`https://www.google.com/search?q=${encodeURIComponent(`${business.name} ${location}`)}`}
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="google-search-link"
                          >
                            Google Search →
                          </a>
                          {business.googleMapsUrl && (
                            <a 
                              href={business.googleMapsUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="google-maps-link"
                            >
                              Google Maps →
                            </a>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {!loading && results.length === 0 && !error && query && location && (
        <div className="results-section">
          <div className="no-results">
            <h3>No businesses found</h3>
            <p>Try adjusting your search terms or location</p>
          </div>
        </div>
      )}

      {savedBusinesses.length > 0 && (
        <div className="results-section saved-section">
          <div className="results-header">
            <h2>Saved Leads ({savedBusinesses.length})</h2>
            <div className="export-actions">
              <button onClick={exportToCSV} className="export-button">
                Export to CSV
              </button>
              <button onClick={exportToEmail} className="export-button">
                Export to Email
              </button>
            </div>
          </div>

          <div className="business-list">
            {savedBusinesses.map((business, index) => (
              <div key={index} className="business-card">
                <div className="business-header">
                  <div className="business-name">{business.name}</div>
                  <button
                    onClick={() => removeFromSaved(index)}
                    className="remove-button"
                  >
                    Remove
                  </button>
                </div>
                
                {business.types && business.types.length > 0 && (
                  <div className="business-types">
                    {business.types.map((type, i) => (
                      <span key={i} className="business-type-tag">{type}</span>
                    ))}
                  </div>
                )}
                
                <div className="business-info">
                  {business.address && (
                    <div className="business-address">📍 {business.address}</div>
                  )}
                  {business.phone && (
                    <div className="business-phone">📞 {business.phone}</div>
                  )}
                  {business.rating && (
                    <div className="business-rating">
                      <span className="rating-stars">⭐</span>
                      <span className="rating-value">{business.rating.toFixed(1)}</span>
                      {business.userRatingsTotal && (
                        <span className="rating-count">({business.userRatingsTotal})</span>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="business-footer">
                  <div className="no-website-badge">No Website Found</div>
                  <div className="business-links">
                    {business.googleMapsUrl && (
                      <a 
                        href={business.googleMapsUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="google-maps-link"
                      >
                        Google Maps →
                      </a>
                    )}
                    <a 
                      href={`https://www.google.com/search?q=${encodeURIComponent(`${business.name} ${location}`)}`}
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="google-search-link"
                    >
                      Google Search →
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
