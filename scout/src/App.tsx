import React from 'react'
import MatchForm from './pages/MatchForm'
import PitForm from './pages/PitForm'
import Dashboard from './pages/Dashboard'
import { SettingsContext, defaultSettings, normalizeSettings, toApiBase } from './settings'
import logoImg from './assets/Commodore_Horizontal_Logo.png'
import { getAll } from './db'
import type { PitRecord, MatchRecord } from './db'
import { refreshTeamsCache as refreshTeamsCacheUtil, refreshScheduleCache as refreshScheduleCacheUtil, syncUnsynced } from './sync'

type Tab = 'match' | 'pit' | 'dash' | 'admin'

export default function App() {
  const [tab, setTab] = React.useState<Tab>('match')
  const [settings, setSettings] = React.useState<any>(defaultSettings)
  const [syncBusy, setSyncBusy] = React.useState(false)
  const [syncHint, setSyncHint] = React.useState<string>('')
  const showSyncModal = syncBusy || !!syncHint
  const [envDefaults, setEnvDefaults] = React.useState({
    eventKey: import.meta.env.VITE_EVENT_KEY || '',
    syncUrl: '',
    apiKey: import.meta.env.VITE_API_KEY || ''
  })

  // Load saved settings once — and force-merge env defaults into blanks
  React.useEffect(() => {
    (async () => {
      let defaults = { eventKey: import.meta.env.VITE_EVENT_KEY || '', syncUrl: '', apiKey: import.meta.env.VITE_API_KEY || '' }
      try {
        const res = await fetch('/api/client-config.php')
        if (res.ok) {
          const cfg = await res.json()
          defaults = { ...defaults, syncUrl: cfg.syncUrl || '' }
        }
      } catch {}

      setEnvDefaults(defaults)

      function fillBlanks(obj: any) {
        const out = { ...obj }
        if (!out.eventKey) out.eventKey = defaults.eventKey
        if (!out.syncUrl)  out.syncUrl  = defaults.syncUrl
        if (!out.apiKey)   out.apiKey   = defaults.apiKey
        return out
      }

      try {
        const saved = localStorage.getItem('scout:settings')
        const parsed = saved ? JSON.parse(saved) : {}
        const merged = normalizeSettings(fillBlanks(parsed))
        setSettings(merged)
      } catch {
        setSettings(normalizeSettings(fillBlanks({})))
      }
    })()
  }, [])

  // Persist settings on change (normalize again to be safe)
  React.useEffect(() => {
    try {
      const filled = {
        ...settings,
        eventKey: settings.eventKey || envDefaults.eventKey,
        syncUrl:  settings.syncUrl  || envDefaults.syncUrl,
        apiKey:   settings.apiKey   || envDefaults.apiKey
      }
      const norm = normalizeSettings(filled)
      localStorage.setItem('scout:settings', JSON.stringify(norm))
      if (JSON.stringify(norm) !== JSON.stringify(settings)) setSettings(norm)
    } catch {}
  }, [settings, envDefaults])

  // Hidden admin via ?admin=1
  React.useEffect(() => {
    const url = new URL(window.location.href)
    if (url.searchParams.get('admin') === '1') setTab('admin')
  }, [])

  const base = toApiBase(settings.syncUrl || '')

  function refreshTeamsCache() {
    return (async () => {
      await refreshTeamsCacheUtil(settings.eventKey, settings.apiKey, settings.syncUrl)
      window.dispatchEvent(new CustomEvent('scout:cache-updated', { detail: { kind: 'teams', eventKey: settings.eventKey } }))
    })()
  }

  async function refreshScheduleCache() {
    await refreshScheduleCacheUtil(settings.eventKey, settings.apiKey, settings.syncUrl)
    window.dispatchEvent(new CustomEvent('scout:cache-updated', { detail: { kind: 'schedule', eventKey: settings.eventKey } }))
  }

  // Unified sync flow used by the top bar button
  async function doUnifiedSync() {
    if (syncBusy) return
    setSyncBusy(true)
    setSyncHint('Refreshing teams...')
    const summary: string[] = []
    try {
      try { await refreshTeamsCache(); summary.push('Teams: refreshed') }
      catch (e: any) { summary.push(`Teams: failed (${e?.message || 'error'})`) }
      setSyncHint('Refreshing schedule...')
      try { await refreshScheduleCache(); summary.push('Schedule: refreshed') }
      catch (e: any) { summary.push(`Schedule: failed (${e?.message || 'error'})`) }
      setSyncHint('Syncing records...')
      const res = await syncUnsynced({ eventKey: settings.eventKey, apiKey: settings.apiKey, syncUrl: settings.syncUrl })
      summary.push(`Photos: ${res.photosUploaded} uploaded${res.photosFailed ? `, ${res.photosFailed} failed` : ''}`)
      summary.push(`Records: ${res.pitCount} pit, ${res.matchCount} match`)
      setSyncHint(summary.join(' | '))
      window.dispatchEvent(new CustomEvent('scout:cache-updated', { detail: { kind: 'sync', eventKey: settings.eventKey } }))
    } catch (e: any) {
      setSyncHint(`Sync failed: ${e?.message || e}`)
      alert(`Sync failed: ${e?.message || e}`)
    } finally {
      setSyncBusy(false)
      setTimeout(() => setSyncHint(''), 12000)
    }
  }

  // Pull event data from Admin (TBA import + refresh caches)
  async function adminPullEvent(force = false) {
    try {
      if (!settings.eventKey || !settings.apiKey || !settings.syncUrl) {
        alert('Set Event Key, API Base, and API Key first.')
        return
      }

      // Optional safety: warn if there are unsynced local records for a different event
      try {
        const [pitAll, matchAll] = await Promise.all([getAll<PitRecord>('pit'), getAll<MatchRecord>('match')])
        const otherEventUnsynced =
          pitAll.some(r => !r.synced && r.eventKey && r.eventKey !== settings.eventKey) ||
          matchAll.some(r => !r.synced && r.eventKey && r.eventKey !== settings.eventKey)
        if (otherEventUnsynced) {
          const ok = confirm('You have unsynced records for another event. Continue to pull the new event?')
          if (!ok) return
        }
      } catch {}

      // If not forcing, check if data already exists server-side
      setSyncHint('Checking current event data...')
      if (!force) {
        const [teamsRes, schedRes] = await Promise.all([
          fetch(`${base}/event_teams.php?event=${encodeURIComponent(settings.eventKey)}&key=${encodeURIComponent(settings.apiKey)}`, { headers: { 'X-API-KEY': settings.apiKey || '' } }),
          fetch(`${base}/schedule.php?event=${encodeURIComponent(settings.eventKey)}&key=${encodeURIComponent(settings.apiKey)}`,    { headers: { 'X-API-KEY': settings.apiKey || '' } })
        ])
        const teamsJson = await teamsRes.json().catch(()=>({}))
        const schedJson = await schedRes.json().catch(()=>({}))
        const teamCount = Array.isArray(teamsJson?.teams) ? teamsJson.teams.length : 0
        const matchCount = Array.isArray(schedJson?.matches) ? schedJson.matches.length : 0
        if (teamCount > 0 && matchCount > 0) {
          setSyncHint(`Event already present (${teamCount} teams, ${matchCount} matches). Use Force re-import if needed.`)
          await Promise.all([refreshTeamsCache(), refreshScheduleCache()])
          setTimeout(()=>setSyncHint(''), 9000)
          return
        }
      }

      // Try importer endpoints
      setSyncHint('Pulling event from TBA...')
      const importEndpoints = ['tba_import.php', 'import_event.php', 'setup_event.php']
      let imported: any = null
      for (const ep of importEndpoints) {
        try {
          const r = await fetch(
            `${base}/${ep}?event=${encodeURIComponent(settings.eventKey)}&key=${encodeURIComponent(settings.apiKey)}`,
            { headers: { 'X-API-KEY': settings.apiKey || '' } }
          )
          if (!r.ok) continue
          const j = await r.json().catch(()=>null)
          if (j && (j.ok === true || typeof j.teams === 'number' || typeof j.matches === 'number')) {
            imported = j
            break
          }
        } catch {}
      }
      if (!imported) throw new Error('Importer not found (tba_import/import_event/setup_event) or failed')

      // Refresh caches into localStorage for the new event
      setSyncHint('Refreshing local caches...')
      await Promise.all([refreshTeamsCache(), refreshScheduleCache()])

      const teamsImported = (imported.teams ?? (imported.stats?.teams)) ?? 'OK'
      const matchesImported = (imported.matches ?? (imported.stats?.matches)) ?? 'OK'
      setSyncHint(`Event pulled: teams=${teamsImported}, matches=${matchesImported}`)
      window.dispatchEvent(new CustomEvent('scout:cache-updated', { detail: { kind: 'event-import', eventKey: settings.eventKey } }))
      setTimeout(()=>setSyncHint(''), 12000)
    } catch (e: any) {
      setSyncHint(`Pull failed: ${e?.message || e}`)
      alert(`Pull failed: ${e?.message || e}`)
    }
  }

  return (
    <SettingsContext.Provider value={{ settings, setSettings }}>
      <div className="nav">
        <button className={`tab ${tab === 'match' ? 'active' : ''}`} onClick={() => setTab('match')}>Match</button>
        <button className={`tab ${tab === 'pit' ? 'active' : ''}`} onClick={() => setTab('pit')}>Pit</button>
        <button className={`tab ${tab === 'dash' ? 'active' : ''}`} onClick={() => setTab('dash')}>Dashboard</button>

        <div className="spacer" />

        <div className="statusline" style={{ marginRight: 8 }}>
          <span className="scout">Scout: {settings.scoutName || '-'}</span>
          <span className="event"> | Event: {settings.eventKey || '-'}</span>
        </div>
        <button className="btn" onClick={doUnifiedSync} disabled={syncBusy}>
          {syncBusy ? 'Syncing...' : 'Sync'}
        </button>
      </div>

      {tab === 'match' && <MatchForm />}
      {tab === 'pit' && <PitForm />}
      {tab === 'dash' && <Dashboard />}

      {/* Admin page (hidden from nav). Open with ?admin=1 */}
      {tab === 'admin' && (
        <div className="container">
          <div className="card">
            <h3>Admin</h3>
            <div className="grid">
              <div className="field">
                <label>Event Key</label>
                <input
                  value={settings.eventKey}
                  onChange={e => setSettings({ ...settings, eventKey: e.target.value })}
                  placeholder="e.g., 2025gaalb"
                />
              </div>
              <div className="field">
                <label>API Base</label>
                <input
                  value={settings.syncUrl}
                  onChange={e => setSettings({ ...settings, syncUrl: e.target.value })}
                  placeholder="https://www.commodorerobotics.com/api"
                />
              </div>
              <div className="field">
                <label>API Key</label>
                <input
                  type="password"
                  value={settings.apiKey}
                  onChange={e => setSettings({ ...settings, apiKey: e.target.value })}
                  placeholder="(secret)"
                />
              </div>
              <div className="row">
                <button className="btn" onClick={() => {
                  const norm = normalizeSettings(settings)
                  localStorage.setItem('scout:settings', JSON.stringify(norm))
                  alert('Saved admin settings')
                }}>Save</button>
                <button className="btn" onClick={() => adminPullEvent(false)}>Pull Event Data</button>
                <button className="btn" onClick={() => adminPullEvent(true)} title="Re-import even if event exists">
                  Force re-import
                </button>
                <button className="btn" onClick={() => {
                  const url = new URL(window.location.href)
                  url.searchParams.delete('admin')
                  window.location.href = url.toString()
                }}>Close Admin</button>
              </div>
            </div>

            <p className="help" style={{ marginTop: 8 }}>
              Admin is hidden from nav. Open with <code>?admin=1</code>. "Pull Event Data" will create teams & schedule on the server if missing, then refresh the app cache.
            </p>
          </div>
        </div>
      )}

      {showSyncModal && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="header">
              <h3>Sync Status</h3>
            </div>
            <p>{syncHint || 'Syncing...'}</p>
          </div>
        </div>
      )}

      <footer className="footer">
        <img src={logoImg} alt="Commodore Robotics" className="logo" />
      </footer>
    </SettingsContext.Provider>
  )
}

