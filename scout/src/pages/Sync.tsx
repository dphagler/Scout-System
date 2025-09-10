import React, { useEffect, useMemo, useState } from 'react'
import { SettingsContext } from '../settings'
import { getAll, markSynced } from '../db'
import { fetchSchedule } from '../schedule'
import { refreshTeamsCache as refreshTeamsCacheUtil, refreshScheduleCache as refreshScheduleCacheUtil, syncUnsynced } from '../sync'

// base derivation handled in shared helpers

// team refresh moved to shared helper

export default function SyncPage() {
  const { settings } = React.useContext(SettingsContext)
  const [pitCount, setPitCount] = useState(0)
  const [matchCount, setMatchCount] = useState(0)
  const [busy, setBusy] = useState(false)
  const [log, setLog] = useState<string[]>([])

  const addLog = (line: string) => setLog(prev => [line, ...prev].slice(0, 200))

  async function loadCounts() {
    const [pit, mat] = await Promise.all([ getAll('pit'), getAll('match') ])
    setPitCount(pit.filter((r:any)=>!r.synced).length)
    setMatchCount(mat.filter((r:any)=>!r.synced).length)
  }

  useEffect(() => { loadCounts().catch(()=>{}) }, [])

  async function doSync() {
    try {
      setBusy(true)
      const [pitUnsynced, matchUnsynced] = await Promise.all([
        getAll('pit').then(list => list.filter((r:any)=>!r.synced)),
        getAll('match').then(list => list.filter((r:any)=>!r.synced)),
      ])

      const res = await syncUnsynced({ eventKey: settings.eventKey, apiKey: settings.apiKey, syncUrl: settings.syncUrl })
      addLog(`Synced ${res.pitCount} pit, ${res.matchCount} match. Photos: ${res.photosUploaded} uploaded${res.photosFailed ? `, ${res.photosFailed} failed` : ''}.`)
      await loadCounts()
    } catch (e:any) {
      addLog(`Sync failed: ${e?.message || e}`)
      alert(`Sync failed: ${e?.message || e}`)
    } finally {
      setBusy(false)
    }
  }

  async function doRefreshTeams() {
    try {
      await refreshTeamsCacheUtil(settings.eventKey, settings.apiKey, settings.syncUrl)
      addLog(`Teams refreshed.`)
      // ✅ Tell listeners that teams meta changed
      window.dispatchEvent(new CustomEvent('scout:cache-updated', { detail: { kind: 'teams', eventKey: settings.eventKey } }))
    } catch (e:any) {
      addLog(`Refresh teams failed: ${e?.message || e}`)
    }
  }

  async function doRefreshSchedule() {
    try {
      await refreshScheduleCacheUtil(settings.eventKey, settings.apiKey, settings.syncUrl)
      addLog('Schedule refreshed.')
      // ✅ Tell listeners that schedule changed
      window.dispatchEvent(new CustomEvent('scout:cache-updated', { detail: { kind: 'schedule', eventKey: settings.eventKey } }))
    } catch (e:any) {
      addLog(`Refresh schedule failed: ${e?.message || e}`)
    }
  }

  const canSync = useMemo(() => !!settings.eventKey && !!settings.apiKey && !!settings.syncUrl, [settings])

  return (
    <div className="container">
      <h2>Sync</h2>

      <div className="card">
        <div className="grid two">
          <div className="field">
            <label>Unsynced Pit</label>
            <input value={pitCount} readOnly />
          </div>
          <div className="field">
            <label>Unsynced Match</label>
            <input value={matchCount} readOnly />
          </div>
        </div>
      </div>

      <div className="row">
        <button className="btn primary" disabled={!canSync || busy} onClick={doSync}>Sync Now</button>
        <button className="btn" disabled={!canSync || busy} onClick={doRefreshTeams}>Refresh Teams</button>
        <button className="btn" disabled={!canSync || busy} onClick={doRefreshSchedule}>Refresh Schedule</button>
      </div>

      <div className="card">
        <h4>Log</h4>
        <div className="muted" style={{ whiteSpace: 'pre-wrap' }}>
          {log.length ? log.join('\n') : '—'}
        </div>
      </div>
    </div>
  )
}
