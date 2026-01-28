/**
 * Simple JSON file-based storage for leads, projects, and notes
 * Uses browser localStorage for persistence
 */

const STORAGE_KEYS = {
  LEADS: 'leadGenerator_leads',
  PROJECTS: 'leadGenerator_projects',
  NOTES: 'leadGenerator_notes',
  SETTINGS: 'leadGenerator_settings'
}

export function getLeads() {
  if (typeof window === 'undefined') return []
  try {
    const data = localStorage.getItem(STORAGE_KEYS.LEADS)
    return data ? JSON.parse(data) : []
  } catch (error) {
    console.error('Error reading leads:', error)
    return []
  }
}

export function saveLeads(leads) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEYS.LEADS, JSON.stringify(leads))
  } catch (error) {
    console.error('Error saving leads:', error)
  }
}

export function getProjects() {
  if (typeof window === 'undefined') return []
  try {
    const data = localStorage.getItem(STORAGE_KEYS.PROJECTS)
    return data ? JSON.parse(data) : []
  } catch (error) {
    console.error('Error reading projects:', error)
    return []
  }
}

export function saveProjects(projects) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects))
  } catch (error) {
    console.error('Error saving projects:', error)
  }
}

export function getNotes() {
  if (typeof window === 'undefined') return {}
  try {
    const data = localStorage.getItem(STORAGE_KEYS.NOTES)
    return data ? JSON.parse(data) : {}
  } catch (error) {
    console.error('Error reading notes:', error)
    return {}
  }
}

export function saveNotes(notes) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(notes))
  } catch (error) {
    console.error('Error saving notes:', error)
  }
}

export function addNote(leadId, note) {
  const notes = getNotes()
  if (!notes[leadId]) {
    notes[leadId] = []
  }
  notes[leadId].push({
    text: note,
    date: new Date().toISOString()
  })
  saveNotes(notes)
}

export function getNotesForLead(leadId) {
  const notes = getNotes()
  return notes[leadId] || []
}

export function updateLeadStatus(leadId, status) {
  const leads = getLeads()
  const leadIndex = leads.findIndex(l => l.id === leadId)
  if (leadIndex !== -1) {
    leads[leadIndex].status = status
    leads[leadIndex].lastUpdated = new Date().toISOString()
    if (status === 'contacted' || status === 'replied') {
      leads[leadIndex].lastContactDate = new Date().toISOString()
    }
    saveLeads(leads)
  }
}

export function calculateLeadScore(lead) {
  let score = 0
  
  // Rating boost (higher rating = better lead)
  if (lead.rating) {
    score += lead.rating * 10 // 0-50 points
  }
  
  // Review count boost (more reviews = more established)
  if (lead.userRatingsTotal) {
    score += Math.min(lead.userRatingsTotal / 10, 20) // Up to 20 points
  }
  
  // No website = good lead opportunity (+30)
  if (!lead.hasWebsite) {
    score += 30
  }
  
  // Has phone = easier to contact (+10)
  if (lead.phone) {
    score += 10
  }
  
  // Has address = local business (+5)
  if (lead.address) {
    score += 5
  }
  
  return Math.round(score)
}
