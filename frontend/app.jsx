import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import * as XLSX from 'xlsx'

import './app.css'

const API = import.meta.env.VITE_API || 'http://localhost:8000'
const AREA_OPTIONS = ['Area 1', 'Area 2', 'Area 3', 'Area 4', 'Area 5', 'Area 6/8', 'Area 7', 'Area 9', 'Area 10']

function useAuthedFetch() {
  return async (path, opts = {}) => {
    const res = await fetch(API + path, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(opts.headers || {})
      },
      ...opts
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(text || res.statusText)
    }
    if (res.status === 204) return null
    return res.json()
  }
}

function Login({ onLoggedIn }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [area, setArea] = useState(AREA_OPTIONS[0])
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const body = new URLSearchParams({ username: email, password })
      const res = await fetch(API + '/auth/login', {
        method: 'POST',
        body,
        credentials: 'include'
      })
      if (!res.ok) throw new Error('Login failed')
      onLoggedIn()
    } catch (err) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  const register = async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `${API}/auth/register?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}&area=${encodeURIComponent(area)}`,
        { method: 'POST', credentials: 'include' }
      )
      if (!res.ok) throw new Error('Register failed')
      alert('Registered. Now log in.')
    } catch (err) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='login-card'>
      <h2>Welcome Back</h2>
      <p className='helper-text'>Sign in to manage teams, officials, and schedules.</p>
      <form onSubmit={submit} className='form-grid'>
        <input
          placeholder='Email'
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          placeholder='Password'
          type='password'
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div className='form-row' style={{ justifyContent: 'space-between' }}>
          <label style={{ flex: 1 }}>
            Area
            <select value={area} onChange={(e) => setArea(e.target.value)}>
              {AREA_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <button className='button button-primary' type='submit' disabled={loading}>
            {loading ? 'Working…' : 'Login'}
          </button>
          <button
            className='button button-secondary'
            type='button'
            onClick={register}
            disabled={loading}
          >
            Register admin
          </button>
        </div>
      </form>
    </div>
  )
}

const DASHBOARD_TABS = ['Assigner', 'Officials', 'Teams', 'Events']

function App() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [teams, setTeams] = useState([])
  const [officials, setOfficials] = useState([])
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('Assigner')
  const fetcher = useAuthedFetch()

  const sortTeams = (items) => [...items].sort((a, b) => a.name.localeCompare(b.name))
  const sortOfficials = (items) =>
    [...items].sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name))
  const sortEvents = (items) =>
    [...items].sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))

  const loadAll = async () => {
    setLoading(true)
    try {
      const [teamsRes, officialsRes, eventsRes] = await Promise.all([
        fetcher('/teams'),
        fetcher('/officials'),
        fetcher('/events')
      ])
      setTeams(sortTeams(teamsRes))
      setOfficials(sortOfficials(officialsRes))
      setEvents(sortEvents(eventsRes))
    } catch (err) {
      console.error(err)
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (loggedIn) {
      loadAll()
    }
  }, [loggedIn])

  const logout = async () => {
    await fetcher('/auth/logout', { method: 'POST' })
    setLoggedIn(false)
    setTeams([])
    setOfficials([])
    setEvents([])
    setActiveTab('Assigner')
  }

  const handleTeamCreated = (team) => {
    setTeams((prev) => sortTeams([...prev, team]))
  }

  const handleTeamUpdated = (team) => {
    setTeams((prev) => sortTeams(prev.map((item) => (item.id === team.id ? team : item))))
  }

  const handleTeamDeleted = (teamId) => {
    setTeams((prev) => prev.filter((item) => item.id !== teamId))
  }

  const handleOfficialCreated = (official) => {
    setOfficials((prev) => sortOfficials([...prev, official]))
  }

  const handleOfficialUpdated = (official) => {
    setOfficials((prev) =>
      sortOfficials(prev.map((item) => (item.id === official.id ? official : item)))
    )
  }

  const handleOfficialDeleted = (officialId) => {
    setOfficials((prev) => prev.filter((item) => item.id !== officialId))
  }

  const handleEventCreated = (event) => {
    setEvents((prev) => sortEvents([...prev, event]))
  }

  const handleEventUpdated = (event) => {
    setEvents((prev) => sortEvents(prev.map((item) => (item.id === event.id ? event : item))))
  }

  const handleEventDeleted = (eventId) => {
    setEvents((prev) => prev.filter((item) => item.id !== eventId))
  }

  const teamLookup = useMemo(
    () => Object.fromEntries(teams.map((team) => [team.id, team.name])),
    [teams]
  )

  const officialLookup = useMemo(
    () => Object.fromEntries(officials.map((official) => [official.id, official.name])),
    [officials]
  )

  const renderTeamCard = () => (
    <div className='card'>
      <h2>Teams</h2>
      <TeamForm onCreated={handleTeamCreated} fetcher={fetcher} />
      <SectionList items={teams} emptyMessage='No teams yet.'>
        {(team) => (
          <TeamItem
            key={team.id}
            team={team}
            fetcher={fetcher}
            onUpdated={handleTeamUpdated}
            onDeleted={() => handleTeamDeleted(team.id)}
          />
        )}
      </SectionList>
    </div>
  )

  const renderOfficialCard = () => (
    <div className='card'>
      <h2>Officials</h2>
      <OfficialForm onCreated={handleOfficialCreated} fetcher={fetcher} />
      <SectionList items={officials} emptyMessage='Add officials to get started.'>
        {(official) => (
          <OfficialItem
            key={official.id}
            official={official}
            fetcher={fetcher}
            onUpdated={handleOfficialUpdated}
            onDeleted={() => handleOfficialDeleted(official.id)}
          />
        )}
      </SectionList>
    </div>
  )

  const renderScheduleCard = () => (
    <div className='card'>
      <h2>Schedule Event</h2>
      <EventForm teams={teams} fetcher={fetcher} onCreated={handleEventCreated} />
      <div className='inline-actions'>
        <button
          className='button button-primary'
          onClick={async () => {
            const res = await fetcher('/assign/run', { method: 'POST' })
            alert(
              res.results
                .map((item) => `Event ${item.event_id}: ${item.assigned_official_ids.join(', ') || 'none'} (${item.reason})`)
                .join('\n') || 'No events'
            )
            loadAll()
          }}
          disabled={events.length === 0}
        >
          Run assignments
        </button>
      </div>
    </div>
  )

  const renderEventsCard = () => (
    <div className='card'>
      <h2>Events</h2>
      <SectionList items={events} emptyMessage='No events scheduled yet.'>
        {(event) => (
          <EventItem
            key={event.id}
            event={event}
            teams={teams}
            officials={officials}
            fetcher={fetcher}
            onUpdated={handleEventUpdated}
            onDeleted={() => handleEventDeleted(event.id)}
          />
        )}
      </SectionList>
    </div>
  )

  if (!loggedIn) {
    return <Login onLoggedIn={() => setLoggedIn(true)} />
  }

  return (
    <div className='app-shell'>
      <header className='top-bar'>
        <h1>Wrestling Official Assignments</h1>
        <div className='inline-actions'>
          <button className='button button-secondary' onClick={loadAll} disabled={loading}>
            Refresh
          </button>
          <button className='button button-ghost' onClick={logout}>
            Logout
          </button>
        </div>
      </header>

      <nav className='tab-nav'>
        {DASHBOARD_TABS.map((tab) => (
          <button
            key={tab}
            type='button'
            className={`tab-button${activeTab === tab ? ' active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>

      {activeTab === 'Assigner' && (
        <div className='layout'>
          <div className='card-grid'>
            {renderTeamCard()}
            {renderOfficialCard()}
            {renderScheduleCard()}
          </div>
          <SchedulePanel
            events={events}
            teams={teams}
            officials={officials}
            fetcher={fetcher}
            onEventDeleted={handleEventDeleted}
            teamLookup={teamLookup}
            officialLookup={officialLookup}
          />
        </div>
      )}

      {activeTab === 'Teams' && (
        <div className='card-grid'>{renderTeamCard()}</div>
      )}

      {activeTab === 'Officials' && (
        <div className='card-grid'>{renderOfficialCard()}</div>
      )}

      {activeTab === 'Events' && (
        <div className='card-grid'>{renderEventsCard()}</div>
      )}
    </div>
  )
}

function DeleteButton({ onDelete }) {
  return (
    <button
      className='delete-button'
      onClick={async () => {
        if (window.confirm('Delete?')) {
          await onDelete()
        }
      }}
    >
      Delete
    </button>
  )
}

function SchedulePanel({
  events,
  teams,
  officials,
  fetcher,
  onEventDeleted,
  teamLookup: teamLookupOverride,
  officialLookup: officialLookupOverride,
}) {
  const teamLookup = useMemo(
    () => teamLookupOverride ?? Object.fromEntries(teams.map((team) => [team.id, team.name])),
    [teamLookupOverride, teams]
  )
  const officialLookup = useMemo(
    () =>
      officialLookupOverride ?? Object.fromEntries(officials.map((official) => [official.id, official.name])),
    [officialLookupOverride, officials]
  )

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at)),
    [events]
  )

  const exportSchedule = () => {
    if (!sortedEvents.length) return
    const rows = sortedEvents.map((event) => {
      const start = new Date(event.starts_at)
      const end = new Date(event.ends_at)
      const teamNames = event.team_ids
        .map((id) => teamLookup[id] || `Team ${id}`)
        .join(' vs ')
      return {
        Event: event.name,
        'Event Type': event.event_type,
        'Start Time': start.toLocaleString(),
        'End Time': end.toLocaleString(),
        Teams: teamNames || 'N/A',
        Officials: event.officials
          .map((id) => officialLookup[id] || `#${id}`)
          .join(', '),
      }
    })

    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Schedule')
    XLSX.writeFile(workbook, 'wrestling_schedule.xlsx')
  }

  return (
    <aside className='card schedule-panel'>
      <div className='schedule-actions'>
        <div>
          <h2 style={{ margin: 0 }}>Scheduled Events</h2>
          <p className='helper-text'>Upcoming assignments and official coverage.</p>
        </div>
        <button
          className='button button-secondary'
          onClick={exportSchedule}
          disabled={sortedEvents.length === 0}
        >
          Export Excel
        </button>
      </div>

      {sortedEvents.length === 0 ? (
        <div className='empty-state'>No events scheduled yet.</div>
      ) : (
        <div className='schedule-panel'>
          {sortedEvents.map((event) => {
            const start = new Date(event.starts_at)
            const end = new Date(event.ends_at)
            const officialNames = event.officials
              .map((id) => officialLookup[id] || `#${id}`)
              .join(', ')
            const teamNames = event.team_ids
              .map((id) => teamLookup[id] || `Team ${id}`)
              .join(' vs ')
            return (
              <div key={event.id} className='schedule-item'>
                <div className='schedule-item-title'>{event.name}</div>
                <div className='schedule-meta'>
                  {event.event_type}
                  {event.tier_value ? ` • Tier ${event.tier_value}` : ''}
                </div>
                <div className='schedule-meta'>
                  {start.toLocaleDateString()} {start.toLocaleTimeString()} – {end.toLocaleTimeString()}
                </div>
                {teamNames ? (
                  <div>{teamNames}</div>
                ) : (
                  event.event_type === 'Tournament' && <div className='helper-text'>No teams listed</div>
                )}
                <div className='helper-text'>Officials: {officialNames || 'Unassigned'}</div>
                <DeleteButton
                  onDelete={async () => {
                    await fetcher(`/events/${event.id}`, { method: 'DELETE' })
                    onEventDeleted?.(event.id)
                  }}
                />
              </div>
            )
          })}
        </div>
      )}
    </aside>
  )
}

function TeamItem({ team, fetcher, onUpdated, onDeleted }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(team.name)
  const [tier, setTier] = useState(team.tier)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setName(team.name)
    setTier(team.tier)
  }, [team])

  const save = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const updated = await fetcher(`/teams/${team.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: name.trim(), tier: Number(tier) })
      })
      onUpdated(updated)
      setEditing(false)
    } catch (err) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (editing) {
    return (
      <li className='list-item'>
        <form onSubmit={save} className='form-row' style={{ flex: 1 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
          <select value={tier} onChange={(e) => setTier(Number(e.target.value))}>
            {[1, 2, 3, 4].map((value) => (
              <option key={value} value={value}>
                Tier {value}
              </option>
            ))}
          </select>
          <div className='inline-actions'>
            <button className='button button-primary' type='submit' disabled={loading}>
              Save
            </button>
            <button className='button button-ghost' type='button' onClick={() => setEditing(false)} disabled={loading}>
              Cancel
            </button>
          </div>
        </form>
      </li>
    )
  }

  return (
    <li className='list-item'>
      <div>
        <strong>{team.name}</strong>
        <span className='badge' style={{ marginLeft: 8 }}>Tier {team.tier}</span>
      </div>
      <div className='inline-actions'>
        <button className='button button-secondary' onClick={() => setEditing(true)}>
          Edit
        </button>
        <DeleteButton onDelete={async () => {
          await fetcher(`/teams/${team.id}`, { method: 'DELETE' })
          onDeleted?.()
        }} />
      </div>
    </li>
  )
}

function OfficialItem({ official, fetcher, onUpdated, onDeleted }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(official.name)
  const [tier, setTier] = useState(official.tier)
  const [dates, setDates] = useState(official.unavailable_dates.join(', '))
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setName(official.name)
    setTier(official.tier)
    setDates(official.unavailable_dates.join(', '))
  }, [official])

  const save = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const payload = {
        name: name.trim(),
        tier: Number(tier),
        unavailable_dates: dates
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean)
      }
      const updated = await fetcher(`/officials/${official.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      })
      onUpdated(updated)
      setEditing(false)
    } catch (err) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (editing) {
    return (
      <li className='list-item'>
        <form onSubmit={save} className='form-row' style={{ flex: 1 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
          <select value={tier} onChange={(e) => setTier(Number(e.target.value))}>
            {[1, 2, 3, 4].map((value) => (
              <option key={value} value={value}>
                Tier {value}
              </option>
            ))}
          </select>
          <input
            value={dates}
            onChange={(e) => setDates(e.target.value)}
            placeholder='YYYY-MM-DD, ...'
          />
          <div className='inline-actions'>
            <button className='button button-primary' type='submit' disabled={loading}>
              Save
            </button>
            <button className='button button-ghost' type='button' onClick={() => setEditing(false)} disabled={loading}>
              Cancel
            </button>
          </div>
        </form>
      </li>
    )
  }

  return (
    <li className='list-item'>
      <div>
        <strong>{official.name}</strong>
        <span className='badge' style={{ marginLeft: 8 }}>Tier {official.tier}</span>
        {official.unavailable_dates.length > 0 && (
          <span className='helper-text'> — Unavailable: {official.unavailable_dates.join(', ')}</span>
        )}
      </div>
      <div className='inline-actions'>
        <button className='button button-secondary' onClick={() => setEditing(true)}>
          Edit
        </button>
        <DeleteButton onDelete={async () => {
          await fetcher(`/officials/${official.id}`, { method: 'DELETE' })
          onDeleted?.()
        }} />
      </div>
    </li>
  )
}

function TeamForm({ onCreated, fetcher }) {
  const [name, setName] = useState('')
  const [tier, setTier] = useState(1)
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const created = await fetcher('/teams', {
        method: 'POST',
        body: JSON.stringify({ name, tier: Number(tier) })
      })
      onCreated(created)
      setName('')
      setTier(1)
    } catch (err) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className='form-row'>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder='Team name' required />
      <select value={tier} onChange={(e) => setTier(e.target.value)}>
        {[1, 2, 3, 4].map((value) => (
          <option key={value} value={value}>
            Tier {value}
          </option>
        ))}
      </select>
      <button className='button button-primary' type='submit' disabled={loading}>
        Add
      </button>
    </form>
  )
}

function OfficialForm({ onCreated, fetcher }) {
  const [name, setName] = useState('')
  const [tier, setTier] = useState(1)
  const [dates, setDates] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const created = await fetcher('/officials', {
        method: 'POST',
        body: JSON.stringify({
          name,
          tier: Number(tier),
          unavailable_dates: dates
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean)
        })
      })
      onCreated(created)
      setName('')
      setTier(1)
      setDates('')
    } catch (err) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className='form-row'>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder='Official name' required />
      <select value={tier} onChange={(e) => setTier(e.target.value)}>
        {[1, 2, 3, 4].map((value) => (
          <option key={value} value={value}>
            Tier {value}
          </option>
        ))}
      </select>
      <input
        value={dates}
        onChange={(e) => setDates(e.target.value)}
        placeholder='Unavailable dates (YYYY-MM-DD,...)'
      />
      <button className='button button-primary' type='submit' disabled={loading}>
        Add
      </button>
    </form>
  )
}

const EVENT_TYPE_TEAM_COUNT = {
  Tournament: 0,
  Dual: 2,
  Tri: 3,
  Quad: 4
}

const TIER_OPTIONS = ['1.0', '1.5', '2.0', '2.5', '3.0', '3.5', '4.0']

function EventForm({ teams, onCreated, fetcher }) {
  const createEvent = async (payload) => {
    const created = await fetcher('/events', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
    onCreated(created)
    return created
  }

  return (
    <EventEditor
      teams={teams}
      submitLabel='Schedule event'
      onSubmit={createEvent}
    />
  )
}

function EventItem({ event, teams, officials, fetcher, onUpdated, onDeleted }) {
  const [editing, setEditing] = useState(false)

  const teamLookup = useMemo(
    () => Object.fromEntries(teams.map((team) => [team.id, team.name])),
    [teams]
  )
  const officialLookup = useMemo(
    () => Object.fromEntries(officials.map((official) => [official.id, official.name])),
    [officials]
  )

  const teamNames = event.team_ids
    .map((id) => teamLookup[id] || `Team ${id}`)
    .join(' vs ')
  const officialNames = event.officials
    .map((id) => officialLookup[id] || `#${id}`)
    .join(', ')
  const start = new Date(event.starts_at)
  const end = new Date(event.ends_at)

  if (editing) {
    return (
      <li className='list-item'>
        <EventEditor
          teams={teams}
          initialEvent={event}
          submitLabel='Save changes'
          onSubmit={async (payload) => {
            const updated = await fetcher(`/events/${event.id}`, {
              method: 'PUT',
              body: JSON.stringify(payload)
            })
            onUpdated(updated)
            return updated
          }}
          onCancel={() => setEditing(false)}
        />
      </li>
    )
  }

  return (
    <li className='list-item'>
      <div>
        <strong>{event.name}</strong>
        <div className='helper-text'>
          {event.event_type}
          {event.tier_value ? ` • Tier ${event.tier_value}` : ''}
        </div>
        <div className='helper-text'>
          {start.toLocaleDateString()} {start.toLocaleTimeString()} – {end.toLocaleTimeString()}
        </div>
        {teamNames ? <div className='helper-text'>{teamNames}</div> : <div className='helper-text'>No teams listed</div>}
        <div className='helper-text'>Officials: {officialNames || 'Unassigned'}</div>
      </div>
      <div className='inline-actions'>
        <button className='button button-secondary' onClick={() => setEditing(true)}>
          Edit
        </button>
        <DeleteButton
          onDelete={async () => {
            await fetcher(`/events/${event.id}`, { method: 'DELETE' })
            onDeleted?.()
          }}
        />
      </div>
    </li>
  )
}

function EventEditor({ teams, initialEvent, submitLabel, onSubmit, onCancel }) {
  const isEditMode = Boolean(initialEvent)
  const [name, setName] = useState('')
  const [eventType, setEventType] = useState('Dual')
  const [teamIds, setTeamIds] = useState([])
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [needed, setNeeded] = useState('1')
  const [tierOverride, setTierOverride] = useState('')
  const [loading, setLoading] = useState(false)

  const resetToDefaults = () => {
    setName('')
    setEventType('Dual')
    setTeamIds([])
    setStart('')
    setEnd('')
    setNeeded('1')
    setTierOverride('')
  }

  useEffect(() => {
    if (initialEvent) {
      setName(initialEvent.name)
      setEventType(initialEvent.event_type)
      setTeamIds(initialEvent.team_ids.map((id) => String(id)))
      setStart(toDatetimeLocal(initialEvent.starts_at))
      setEnd(toDatetimeLocal(initialEvent.ends_at))
      setNeeded(String(initialEvent.officials_needed ?? 1))
      setTierOverride(
        initialEvent.event_type === 'Tournament' && initialEvent.tier_value != null
          ? String(initialEvent.tier_value)
          : ''
      )
    } else {
      resetToDefaults()
    }
  }, [initialEvent])

  useEffect(() => {
    const required = EVENT_TYPE_TEAM_COUNT[eventType]
    setTeamIds((prev) => {
      const next = prev.slice(0, required)
      while (next.length < required) {
        next.push('')
      }
      return next
    })
  }, [eventType])

  useEffect(() => {
    if (eventType !== 'Tournament') {
      setTierOverride('')
    }
  }, [eventType])

  const requiredTeams = EVENT_TYPE_TEAM_COUNT[eventType]
  const insufficientTeams = requiredTeams > 0 && teams.length < requiredTeams

  const handleTeamChange = (index, value) => {
    setTeamIds((prev) => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!name.trim()) {
      alert('Event name is required')
      return
    }

    if (insufficientTeams) {
      alert(`Add at least ${requiredTeams} teams to schedule a ${eventType}`)
      return
    }

    if (requiredTeams > 0) {
      if (teamIds.some((id) => !id)) {
        alert('Select all required teams')
        return
      }
      const unique = new Set(teamIds)
      if (unique.size !== teamIds.length) {
        alert('Each team can only be selected once per event')
        return
      }
    }

    if (!start || !end) {
      alert('Provide start and end times')
      return
    }

    const overrideValue = tierOverride ? Number(tierOverride) : null
    if (eventType === 'Tournament' && overrideValue === null) {
      alert('Pick a tier override for tournaments')
      return
    }

    if (!needed || Number(needed) < 1) {
      alert('Officials needed must be at least 1')
      return
    }

    const payload = {
      name,
      event_type: eventType,
      team_ids: teamIds.filter(Boolean).map((id) => Number(id)),
      starts_at: new Date(start).toISOString(),
      ends_at: new Date(end).toISOString(),
      officials_needed: Number(needed),
      tier_override: overrideValue,
    }

    setLoading(true)
    try {
      await onSubmit(payload)
      if (isEditMode) {
        onCancel?.()
      } else {
        resetToDefaults()
      }
    } catch (err) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className='form-grid'>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder='Event name' required />

      <div className='form-row'>
        <label style={{ flex: 1 }}>
          Event type
          <select value={eventType} onChange={(e) => setEventType(e.target.value)}>
            {Object.keys(EVENT_TYPE_TEAM_COUNT).map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label style={{ flex: 1 }}>
          Tier override
          <select value={tierOverride} onChange={(e) => setTierOverride(e.target.value)}>
            <option value=''>Auto</option>
            {TIER_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </div>

      {eventType === 'Tournament' && (
        <span className='helper-text'>Select a tier override for tournaments; Auto is not allowed.</span>
      )}

      {insufficientTeams && (
        <span className='error-text'>
          Only {teams.length} team(s) available. Add more before scheduling a {eventType}.
        </span>
      )}

      {requiredTeams > 0 && (
        <div className='form-grid'>
          {teamIds.map((value, index) => (
            <select
              key={index}
              value={value}
              onChange={(e) => handleTeamChange(index, e.target.value)}
              required
            >
              <option value='' disabled>
                Team {index + 1}
              </option>
              {teams.map((team) => (
                <option
                  key={team.id}
                  value={team.id}
                  disabled={teamIds.some((id, idx) => id === String(team.id) && idx !== index)}
                >
                  {team.name}
                </option>
              ))}
            </select>
          ))}
        </div>
      )}

      <div className='form-row'>
        <input type='datetime-local' value={start} onChange={(e) => setStart(e.target.value)} required />
        <input type='datetime-local' value={end} onChange={(e) => setEnd(e.target.value)} required />
        <label style={{ maxWidth: 140 }}>
          <span className='helper-text'>Official(s) Required</span>
          <input
            type='number'
            min={1}
            value={needed}
            onChange={(e) => setNeeded(e.target.value)}
          />
        </label>
      </div>

      <div className='inline-actions'>
        <button className='button button-primary' type='submit' disabled={loading || (requiredTeams > 0 && insufficientTeams)}>
          {submitLabel}
        </button>
        {isEditMode && (
          <button className='button button-ghost' type='button' onClick={onCancel} disabled={loading}>
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}

function toDatetimeLocal(isoString) {
  if (!isoString) return ''
  const date = new Date(isoString)
  const tzOffset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - tzOffset * 60000)
  return local.toISOString().slice(0, 16)
}

function SectionList({ items, emptyMessage, children }) {
  if (items.length === 0) {
    return <div className='empty-state'>{emptyMessage}</div>
  }

  return <ul className='section-list'>{items.map(children)}</ul>
}

createRoot(document.getElementById('root')).render(<App />)
