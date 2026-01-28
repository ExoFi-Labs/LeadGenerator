'use client'

import { useState, useEffect } from 'react'
import './page.css'
import { 
  getLeads, 
  saveLeads, 
  getProjects, 
  saveProjects, 
  addNote, 
  getNotesForLead,
  updateLeadStatus,
  calculateLeadScore
} from '@/lib/storage'

export default function Home() {
  const [query, setQuery] = useState('')
  const [location, setLocation] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState([])
  const [error, setError] = useState('')
  const [showWithWebsites, setShowWithWebsites] = useState(false)
  const [savedBusinesses, setSavedBusinesses] = useState([])
  const [selectedBusinesses, setSelectedBusinesses] = useState(new Set())
  const [activeTab, setActiveTab] = useState('search') // 'search', 'leads', 'projects'
  const [leadFilter, setLeadFilter] = useState('all') // 'all', 'new', 'contacted', 'replied', 'won', 'lost'
  const [leadSearch, setLeadSearch] = useState('')
  const [selectedProject, setSelectedProject] = useState(null)
  const [projects, setProjects] = useState([])
  const [editingNote, setEditingNote] = useState({ leadId: null, text: '' })
  const [viewingLead, setViewingLead] = useState(null)
  const [sortBy, setSortBy] = useState('relevance') // 'relevance', 'rating', 'reviews', 'name'
  const [hideChains, setHideChains] = useState(false)
  const [creatingProject, setCreatingProject] = useState(false)
  const [editingProject, setEditingProject] = useState(null)
  const [deletingProject, setDeletingProject] = useState(null)
  const [newProjectName, setNewProjectName] = useState('')
  const [editingProjectName, setEditingProjectName] = useState('')

  const chainKeywords = [
    'mcdonald',
    'kfc',
    'subway',
    'starbucks',
    'domino',
    'burger king',
    '7-eleven',
    '7 eleven',
    'pizza hut',
    'hungry jacks',
    'shell',
    'bp ',
    'caltex'
  ]

  const isChain = (name = '') => {
    const lower = name.toLowerCase()
    return chainKeywords.some((kw) => lower.includes(kw))
  }

  // Load saved data on mount
  useEffect(() => {
    const saved = getLeads()
    const savedProjects = getProjects()
    setSavedBusinesses(saved)
    setProjects(savedProjects)
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!location.trim()) {
      setError('Please enter a location')
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
      // Clear query after successful search if it was empty (location-only search)
      if (!query.trim()) {
        setQuery('')
      }
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

  const selectAllBusinesses = () => {
    const businessesWithoutWebsites = results.filter(b => !b.hasWebsite)
    const allIndices = businessesWithoutWebsites.map(business => {
      return results.findIndex(r => 
        r.placeId === business.placeId && r.name === business.name
      )
    }).filter(idx => idx !== -1)
    
    setSelectedBusinesses(new Set(allIndices))
  }

  const deselectAll = () => {
    setSelectedBusinesses(new Set())
  }

  const addSelectedToSaved = () => {
    const businessesToAdd = Array.from(selectedBusinesses)
      .map(idx => {
        const business = results[idx]
        if (!business || business.hasWebsite) return null
        
        // Add metadata for lead management
        return {
          ...business,
          id: business.placeId || `${business.name}_${business.address}_${Date.now()}`,
          status: 'new',
          score: calculateLeadScore(business),
          addedDate: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
          projectId: selectedProject?.id || null
        }
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
    saveLeads(uniqueSaved)
    setSelectedBusinesses(new Set())
  }

  const handleStatusChange = (leadId, newStatus) => {
    updateLeadStatus(leadId, newStatus)
    const updated = savedBusinesses.map(lead => 
      lead.id === leadId 
        ? { ...lead, status: newStatus, lastUpdated: new Date().toISOString() }
        : lead
    )
    setSavedBusinesses(updated)
    saveLeads(updated)
  }

  const handleAddNote = (leadId) => {
    if (!editingNote.text.trim()) return
    addNote(leadId, editingNote.text)
    setEditingNote({ leadId: null, text: '' })
    // Refresh the lead view if open
    if (viewingLead?.id === leadId) {
      setViewingLead({
        ...viewingLead,
        notes: getNotesForLead(leadId)
      })
    }
  }

  const createProject = () => {
    if (!newProjectName.trim()) return
    
    const newProject = {
      id: `project_${Date.now()}`,
      name: newProjectName.trim(),
      query: query,
      location: location,
      createdAt: new Date().toISOString(),
      leadIds: []
    }
    const updated = [...projects, newProject]
    setProjects(updated)
    saveProjects(updated)
    setSelectedProject(newProject)
    setNewProjectName('')
    setCreatingProject(false)
  }

  const handleSearchAgain = async (project) => {
    setQuery(project.query || '')
    setLocation(project.location || '')
    setSelectedProject(project)
    setActiveTab('search')
    
    // Wait for state to update, then trigger search
    await new Promise(resolve => setTimeout(resolve, 100))
    
    if (!project.location) return
    
    setLoading(true)
    setError('')
    setResults([])

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: project.query || '', location: project.location }),
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

  const handleRenameProject = (projectId) => {
    const project = projects.find(p => p.id === projectId)
    if (!project) return
    
    if (!editingProjectName.trim() || editingProjectName.trim() === project.name) {
      setEditingProject(null)
      setEditingProjectName('')
      return
    }

    const updated = projects.map(p =>
      p.id === projectId ? { ...p, name: editingProjectName.trim() } : p
    )
    setProjects(updated)
    saveProjects(updated)

    if (selectedProject?.id === projectId) {
      setSelectedProject({ ...project, name: editingProjectName.trim() })
    }
    
    setEditingProject(null)
    setEditingProjectName('')
  }

  const startEditingProject = (project) => {
    setEditingProject(project.id)
    setEditingProjectName(project.name)
  }

  const cancelEditingProject = () => {
    setEditingProject(null)
    setEditingProjectName('')
  }

  const handleDeleteProject = (projectId) => {
    const project = projects.find(p => p.id === projectId)
    if (!project) return

    // Remove project from list
    const updatedProjects = projects.filter(p => p.id !== projectId)
    setProjects(updatedProjects)
    saveProjects(updatedProjects)

    // Detach project from leads (keep the leads)
    const updatedLeads = savedBusinesses.map(lead =>
      lead.projectId === projectId ? { ...lead, projectId: null } : lead
    )
    setSavedBusinesses(updatedLeads)
    saveLeads(updatedLeads)

    if (selectedProject?.id === projectId) {
      setSelectedProject(null)
    }
    
    setDeletingProject(null)
  }

  const confirmDeleteProject = (projectId) => {
    setDeletingProject(projectId)
  }

  const cancelDeleteProject = () => {
    setDeletingProject(null)
  }

  const filteredLeads = savedBusinesses.filter(lead => {
    // Project filter: if a project is selected, only show its leads
    if (selectedProject && lead.projectId !== selectedProject.id) {
      return false
    }

    // Status filter
    const status = lead.status || 'new'
    if (leadFilter !== 'all' && status !== leadFilter) {
      return false
    }
    
    // Search filter
    if (leadSearch.trim()) {
      const searchLower = leadSearch.toLowerCase()
      return (
        lead.name?.toLowerCase().includes(searchLower) ||
        lead.address?.toLowerCase().includes(searchLower) ||
        lead.phone?.toLowerCase().includes(searchLower) ||
        lead.types?.some(t => t.toLowerCase().includes(searchLower))
      )
    }
    
    return true
  })

  const removeFromSaved = (leadId) => {
    const updated = savedBusinesses.filter(lead => lead.id !== leadId)
    setSavedBusinesses(updated)
    saveLeads(updated)
  }

  const exportToCSV = () => {
    const leadsToExport = leadFilter === 'all' ? savedBusinesses : filteredLeads
    if (leadsToExport.length === 0) return
    
    const headers = ['Name', 'Address', 'Phone', 'Rating', 'Reviews', 'Types', 'Status', 'Score', 'Notes', 'Last Contact', 'Google Maps']
    const rows = leadsToExport.map(b => {
      const notes = getNotesForLead(b.id)
      const lastNote = notes.length > 0 ? notes[notes.length - 1].text : ''
      return [
        b.name || '',
        b.address || '',
        b.phone || '',
        b.rating || '',
        b.userRatingsTotal || '',
        b.types?.join(', ') || '',
        b.status || 'new',
        b.score || calculateLeadScore(b),
        lastNote,
        b.lastContactDate || '',
        b.googleMapsUrl || ''
      ]
    })
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    const projectName = selectedProject ? selectedProject.name.replace(/[^a-z0-9]/gi, '_') : 'all'
    link.setAttribute('download', `leads_${projectName}_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const exportToEmail = () => {
    const leadsToExport = leadFilter === 'all' ? savedBusinesses : filteredLeads
    if (leadsToExport.length === 0) return
    
    const emailBody = leadsToExport.map((b, i) => {
      const notes = getNotesForLead(b.id)
      const notesText = notes.length > 0 ? `\n   Notes: ${notes.map(n => n.text).join('; ')}` : ''
      return `${i + 1}. ${b.name} (${b.status || 'new'})
   Address: ${b.address || 'N/A'}
   Phone: ${b.phone || 'N/A'}
   Rating: ${b.rating ? `${b.rating}/5 (${b.userRatingsTotal || 0} reviews)` : 'N/A'}
   Score: ${b.score || calculateLeadScore(b)}${notesText}
   ${b.googleMapsUrl ? `Maps: ${b.googleMapsUrl}` : ''}
`
    }).join('\n')
    
    const subject = encodeURIComponent(`Lead Generator - ${leadsToExport.length} Leads`)
    const body = encodeURIComponent(`Found ${leadsToExport.length} businesses without websites:\n\n${emailBody}`)
    
    window.location.href = `mailto:?subject=${subject}&body=${body}`
  }

  return (
    <div className="container">
      <div className="header">
        <h1>Local Lead Finder</h1>
        <p>Discover and manage local businesses that still need a website – score, track, and export your best prospects</p>
      </div>

      <div className="tabs">
        <button 
          className={activeTab === 'search' ? 'tab-active' : ''}
          onClick={() => setActiveTab('search')}
        >
          Search
        </button>
        <button 
          className={activeTab === 'leads' ? 'tab-active' : ''}
          onClick={() => setActiveTab('leads')}
        >
          Leads ({savedBusinesses.length})
        </button>
        <button 
          className={activeTab === 'projects' ? 'tab-active' : ''}
          onClick={() => setActiveTab('projects')}
        >
          Projects ({projects.length})
        </button>
      </div>

      {activeTab === 'projects' && (
        <div className="results-section">
          <div className="results-header">
            <h2>Projects</h2>
            <div className="lead-actions">
              <div className="projects-help">
                <h3>What are Projects?</h3>
                <p>
                  Projects help you organize your lead generation by campaign, niche, or region. 
                  Create a project, select it before searching, and all leads you add will be tagged to that project. 
                  You can filter leads by project in the Leads tab, making it easy to manage multiple campaigns simultaneously.
                </p>
                <p>
                  <strong>How to use:</strong> Create a project → Select it from the dropdown on the Search tab → 
                  Run your searches → Add leads to your list. All leads will be automatically tagged to the selected project.
                </p>
              </div>
              {!creatingProject ? (
                <button onClick={() => setCreatingProject(true)} className="create-project-button">
                  + New Project
                </button>
              ) : (
                <div className="project-form">
                  <input
                    type="text"
                    placeholder="Project name..."
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        createProject()
                      } else if (e.key === 'Escape') {
                        setCreatingProject(false)
                        setNewProjectName('')
                      }
                    }}
                    className="project-name-input"
                    autoFocus
                  />
                  <div className="project-form-actions">
                    <button onClick={createProject} className="project-save-button">
                      Create
                    </button>
                    <button onClick={() => {
                      setCreatingProject(false)
                      setNewProjectName('')
                    }} className="project-cancel-button">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="projects-list">
            {projects.map(project => (
              <div 
                key={project.id} 
                className={`project-card ${selectedProject?.id === project.id ? 'selected' : ''}`}
                onClick={() => !editingProject && !deletingProject && setSelectedProject(project)}
              >
                {editingProject === project.id ? (
                  <div className="project-edit-form">
                    <input
                      type="text"
                      value={editingProjectName}
                      onChange={(e) => setEditingProjectName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleRenameProject(project.id)
                        } else if (e.key === 'Escape') {
                          cancelEditingProject()
                        }
                      }}
                      className="project-name-input"
                      autoFocus
                    />
                    <div className="project-form-actions">
                      <button onClick={() => handleRenameProject(project.id)} className="project-save-button">
                        Save
                      </button>
                      <button onClick={cancelEditingProject} className="project-cancel-button">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : deletingProject === project.id ? (
                  <div className="project-delete-confirm">
                    <p>Delete &quot;{project.name}&quot;? This will remove the project tag from leads, but keep the leads themselves.</p>
                    <div className="project-form-actions">
                      <button onClick={() => handleDeleteProject(project.id)} className="project-delete-button">
                        Delete
                      </button>
                      <button onClick={cancelDeleteProject} className="project-cancel-button">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="project-name">{project.name}</div>
                    <div className="project-details">
                      {project.query && <span>Query: {project.query}</span>}
                      {project.location && <span>Location: {project.location}</span>}
                      <span>
                        {savedBusinesses.filter(lead => lead.projectId === project.id).length} leads
                      </span>
                    </div>
                    <div className="project-actions">
                      {(project.query || project.location) && (
                        <button
                          type="button"
                          className="project-action-button project-search-button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleSearchAgain(project)
                          }}
                        >
                          Search Again
                        </button>
                      )}
                      <button
                        type="button"
                        className="project-action-button"
                        onClick={(e) => {
                          e.stopPropagation()
                          startEditingProject(project)
                        }}
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        className="project-action-button project-delete-action-button"
                        onClick={(e) => {
                          e.stopPropagation()
                          confirmDeleteProject(project.id)
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
            {projects.length === 0 && !creatingProject && (
              <div className="no-results">
                <h3>No projects yet</h3>
                <p>Create a project to organize leads by campaign, region, or niche.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'leads' && (
        <div className="results-section">
          <div className="results-header">
            <h2>Saved Leads ({filteredLeads.length})</h2>
            <div className="lead-actions">
              <input
                type="text"
                placeholder="Search leads..."
                value={leadSearch}
                onChange={(e) => setLeadSearch(e.target.value)}
                className="lead-search-input"
              />
              <select 
                value={leadFilter} 
                onChange={(e) => setLeadFilter(e.target.value)}
                className="lead-filter-select"
              >
                <option value="all">All Status</option>
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="replied">Replied</option>
                <option value="won">Won</option>
                <option value="lost">Lost</option>
              </select>
              <div className="export-actions">
                <button onClick={exportToCSV} className="export-button">
                  Export CSV
                </button>
                <button onClick={exportToEmail} className="export-button">
                  Export Email
                </button>
              </div>
            </div>
          </div>

          <div className="business-list">
            {filteredLeads
              .sort((a, b) => (b.score || 0) - (a.score || 0))
              .map((lead) => (
              <div key={lead.id} className="business-card lead-card">
                <div className="lead-header">
                  <div className="business-header">
                    <div className="business-name">{lead.name}</div>
                    <div className="lead-score">Score: {lead.score || calculateLeadScore(lead)}</div>
                  </div>
                  <select 
                    value={lead.status || 'new'} 
                    onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                    className="status-select"
                  >
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="replied">Replied</option>
                    <option value="won">Won</option>
                    <option value="lost">Lost</option>
                  </select>
                </div>
                
                {lead.types && lead.types.length > 0 && (
                  <div className="business-types">
                    {lead.types.map((type, i) => (
                      <span key={i} className="business-type-tag">{type}</span>
                    ))}
                  </div>
                )}
                
                <div className="business-info">
                  {lead.address && (
                    <div className="business-address">📍 {lead.address}</div>
                  )}
                  {lead.phone && (
                    <div className="business-phone">📞 {lead.phone}</div>
                  )}
                  {lead.rating && (
                    <div className="business-rating">
                      <span className="rating-stars">⭐</span>
                      <span className="rating-value">{lead.rating.toFixed(1)}</span>
                      {lead.userRatingsTotal && (
                        <span className="rating-count">({lead.userRatingsTotal})</span>
                      )}
                    </div>
                  )}
                </div>

                <div className="lead-notes-section">
                  <div className="notes-header">
                    <strong>Notes:</strong>
                    <button 
                      onClick={() => setEditingNote({ leadId: lead.id, text: '' })}
                      className="add-note-button"
                    >
                      + Add Note
                    </button>
                  </div>
                  {editingNote.leadId === lead.id && (
                    <div className="note-editor">
                      <textarea
                        value={editingNote.text}
                        onChange={(e) => setEditingNote({ ...editingNote, text: e.target.value })}
                        placeholder="Add a note..."
                        rows="2"
                        className="note-textarea"
                      />
                      <div className="note-actions">
                        <button onClick={() => handleAddNote(lead.id)} className="save-note-button">
                          Save
                        </button>
                        <button onClick={() => setEditingNote({ leadId: null, text: '' })} className="cancel-note-button">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="notes-list">
                    {getNotesForLead(lead.id).map((note, i) => (
                      <div key={i} className="note-item">
                        <div className="note-date">{new Date(note.date).toLocaleDateString()}</div>
                        <div className="note-text">{note.text}</div>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="business-footer">
                  <div className="no-website-badge">No Website Found</div>
                  <div className="business-links">
                    {lead.googleMapsUrl && (
                      <a 
                        href={lead.googleMapsUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="google-maps-link"
                      >
                        Google Maps →
                      </a>
                    )}
                    <a 
                      href={`https://www.google.com/search?q=${encodeURIComponent(`${lead.name} ${location}`)}`}
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="google-search-link"
                    >
                      Google Search →
                    </a>
                    <button 
                      onClick={() => removeFromSaved(lead.id)}
                      className="remove-button"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {filteredLeads.length === 0 && (
              <div className="no-results">
                <h3>No leads found</h3>
                <p>{leadSearch || leadFilter !== 'all' ? 'Try adjusting your filters' : 'Start by searching for businesses and adding them to your leads'}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'search' && (
        <>

      <div className="search-section">
        <div className="search-help">
          <h3>How this works</h3>
          <p>
            Enter a business type (or leave it blank) and a location. We search for local businesses,
            detect who doesn&apos;t have a website, and let you select the best opportunities to send into your Leads tab.
          </p>
          <p>
            Use sorting and filters below to prioritise which businesses you want to contact first.
          </p>
        </div>
        {projects.length > 0 && (
          <div className="project-selector">
            <label htmlFor="project-select">Project (Optional):</label>
            <select
              id="project-select"
              value={selectedProject?.id || ''}
              onChange={(e) => {
                const project = projects.find(p => p.id === e.target.value)
                setSelectedProject(project || null)
              }}
              className="project-select"
            >
              <option value="">No Project</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </div>
        )}
        <form onSubmit={handleSubmit} className="search-form">
          <div className="form-group">
            <label htmlFor="query">Business Type (Optional)</label>
            <input
              id="query"
              type="text"
              placeholder="e.g., restaurants, plumbers, lawyers (leave blank for all businesses)"
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

        // Base result set depending on whether we show businesses that already have websites
        let baseResults = showWithWebsites ? results : businessesWithoutWebsites

        // Optionally hide obvious chains/franchises
        if (hideChains) {
          baseResults = baseResults.filter((b) => !isChain(b.name || ''))
        }

        // Apply sorting locally (no extra API calls)
        const displayedResults = [...baseResults]
        if (sortBy === 'rating') {
          displayedResults.sort((a, b) => (b.rating || 0) - (a.rating || 0))
        } else if (sortBy === 'reviews') {
          displayedResults.sort((a, b) => (b.userRatingsTotal || 0) - (a.userRatingsTotal || 0))
        } else if (sortBy === 'name') {
          displayedResults.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        }
        
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
                <div className="results-controls">
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
                  <div className="search-filters">
                    <label className="sort-label">
                      Sort:
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="sort-select"
                      >
                        <option value="relevance">Relevance</option>
                        <option value="rating">Rating</option>
                        <option value="reviews">Reviews</option>
                        <option value="name">Name</option>
                      </select>
                    </label>
                    <label className="hide-chains-toggle">
                      <input
                        type="checkbox"
                        checked={hideChains}
                        onChange={(e) => setHideChains(e.target.checked)}
                      />
                      <span>Hide known chains</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {businessesWithoutWebsites.length > 0 && (
              <div className="selection-actions">
                <div className="select-buttons">
                  <button
                    onClick={selectAllBusinesses}
                    className="select-all-button"
                  >
                    Select All ({businessesWithoutWebsites.length})
                  </button>
                  {selectedBusinesses.size > 0 && (
                    <button
                      onClick={deselectAll}
                      className="deselect-all-button"
                    >
                      Deselect All
                    </button>
                  )}
                </div>
                <button
                  onClick={addSelectedToSaved}
                  disabled={selectedBusinesses.size === 0}
                  className="add-to-saved-button"
                >
                  Add Selected ({selectedBusinesses.size}) to Leads List
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
        </>
      )}

      <footer className="footer">
        Created by ExoFi Technology 2026
      </footer>
    </div>
  )
}
