import React, { useEffect, useMemo, useState } from 'react'
import { putMatch } from '../db'
import { SettingsContext } from '../settings'
import type { Settings } from '../settings'
import { getGameForEvent } from '../gameConfig'
import { getCachedSchedule, ScheduleMatch } from '../schedule'
import { useTeamsMeta } from '../hooks/useTeamsMeta'

type Alliance = 'red' | 'blue'
type StationId = 'red1'|'red2'|'red3'|'blue1'|'blue2'|'blue3'

function labelForTeam(n?: number, meta?: Record<string, any>) {
  if (!n) return ''
  const m = meta?.[String(n)]
  const name = m?.nickname || m?.name
  return name ? `${n} - ${name}` : String(n)
}

function CounterRow({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="row counter">
      <span className="muted label">{label}</span>
      <div className="qty">
        <button className="btn" onClick={() => onChange(Math.max(0, value - 1))} aria-label={`Decrement ${label}`}>-</button>
        <span className="qtyValue">{value}</span>
        <button className="btn" onClick={() => onChange(value + 1)} aria-label={`Increment ${label}`}>+</button>
      </div>
    </div>
  )
}

export default function MatchForm() {
  const { settings, setSettings } = React.useContext(SettingsContext)
  const game = getGameForEvent(settings.eventKey)

  // Schedule cache (fetched by top-level Sync)
  const [schedule, setSchedule] = useState<ScheduleMatch[] | null>(() => getCachedSchedule(settings.eventKey))
  useEffect(() => {
    setSchedule(getCachedSchedule(settings.eventKey))
    function onCache(e: any) {
      if (e?.detail?.kind === 'schedule' && e.detail.eventKey === settings.eventKey) {
        setSchedule(getCachedSchedule(settings.eventKey))
      }
    }
    window.addEventListener('scout:cache-updated', onCache as any)
    return () => window.removeEventListener('scout:cache-updated', onCache as any)
  }, [settings.eventKey])

  // Team meta
  const teamMeta = useTeamsMeta(settings.eventKey, settings.apiKey, settings.syncUrl)

  // Alliance/station
  const alliance = (settings.alliance as Alliance) || 'red'
  const stationNum = (settings.station as '1'|'2'|'3') || '1'
  const station = (alliance + stationNum) as StationId

  // Match number
  const [localMatch, setLocalMatch] = useState<number>(() => Math.max(1, Number(settings.matchNumber || 1)))
  useEffect(() => { setLocalMatch(Math.max(1, Number(settings.matchNumber || 1))) }, [settings.matchNumber])

  const matchKey = `${settings.eventKey}_qm${localMatch}`

  // Find schedule row
  const matchRow = useMemo(() => {
    if (!schedule) return undefined
    const exact = schedule.find(r => String(r.match_key) === matchKey)
    if (exact) return exact
    const n = Number(localMatch)
    return schedule.find(r => (r?.comp_level === 'qm') && Number(r?.match_number) === n)
  }, [schedule, matchKey, localMatch])

  // Team # at the selected station
  const teamNumber = useMemo(() => {
    if (!matchRow) return undefined
    const raw = (matchRow as any)[station]
    const num = typeof raw === 'number' ? raw : Number(raw)
    return Number.isFinite(num) && num > 0 ? num : undefined
  }, [matchRow, station])

  // Dynamic game metrics
  type MetricsState = Record<string, any>
  const initialMetrics = useMemo<MetricsState>(() => {
    const m: MetricsState = {}
    const sections: any[] = (game as any).sections || []
    for (const section of sections) {
      const fields: any[] = section?.fields || []
      for (const f of fields) {
        const key: string = String(f?.key ?? '')
        if (!key) continue
        const kind: string = String(f?.kind ?? '')
        if (kind === 'counter') m[key] = 0
        else if (kind === 'toggle') m[key] = false
        else if (kind === 'select') m[key] = (f?.options && f.options[0]?.value) ?? ''
        else if (kind === 'textarea') m[key] = ''
        if (m[key] === undefined) m[key] = ''
      }
    }
    if (m['notes'] === undefined) m['notes'] = ''
    return m
  }, [game])

  const [metrics, setMetrics] = useState<MetricsState>(initialMetrics)
  useEffect(() => { setMetrics(initialMetrics) }, [initialMetrics])

  function updateMetric(key: string, value: any) { setMetrics(prev => ({ ...prev, [key]: value })) }
  function resetForm() { setMetrics(initialMetrics) }

  // Discipline / status fields
  const [penalties, setPenalties] = useState(0)
  const [brokeDown, setBrokeDown] = useState(false)
  const [defensePlayed, setDefensePlayed] = useState(0)
  const [defenseResilience, setDefenseResilience] = useState(0)
  const [driverSkill, setDriverSkill] = useState(3)
  const [card, setCard] = useState<'none'|'yellow'|'red'>('none')

  const notesVal = String(metrics['notes'] ?? '')
  function setNotes(v: string) { updateMetric('notes', v) }
  function isNotesField(f: { key?: string; label?: string }) {
    const k = String(f.key || '').toLowerCase()
    const lbl = String(f.label || '').toLowerCase()
    if (k === 'notes' || k === 'note' || k === 'noted') return true
    if (/\bnotes?\b/.test(lbl)) return true
    return false
  }
  function resetDiscipline() {
    setPenalties(0); setBrokeDown(false); setDefensePlayed(0); setDefenseResilience(0); setDriverSkill(3); setCard('none')
  }

  return (
    <div className="container">
      <h2>{game.name} - Match Scouting</h2>

      <div className="card">
        <div className="grid">
          <div className="field">
            <label>Scout</label>
            <input
              value={settings.scoutName}
              onChange={e => setSettings((prev: Settings) => ({ ...prev, scoutName: e.target.value }))}
              placeholder="Your name"
            />
          </div>

          <div className="field">
            <label>Alliance & Station</label>
            <div className="segment-row">
              {(['red1','red2','red3','blue1','blue2','blue3'] as StationId[]).map((sid) => (
                <button
                  key={sid}
                  className={`btn segment ${((settings.alliance + settings.station) === sid) ? 'active' : ''}`}
                  onClick={() => {
                    const a = sid.startsWith('red') ? 'red' : 'blue'
                    const n = sid.endsWith('1') ? '1' : sid.endsWith('2') ? '2' : '3'
                    setSettings((prev: Settings) => ({ ...prev, alliance: a as Alliance, station: n }))
                  }}
                >
                  {sid.startsWith('red') ? 'Red' : 'Blue'} {sid.slice(-1)}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label>Match #</label>
            <div className="row nowrap">
              <button
                className="btn"
                onClick={() => {
                  const n = Math.max(1, localMatch - 1)
                  setLocalMatch(n)
                  setSettings((prev: Settings) => ({ ...prev, matchNumber: n }))
                }}
              >-</button>
              <input
                inputMode="numeric"
                value={localMatch}
                onChange={e => {
                  const n = Math.max(1, Number(e.target.value || 1))
                  setLocalMatch(n)
                  setSettings((prev: Settings) => ({ ...prev, matchNumber: n }))
                }}
                placeholder="1"
              />
              <button
                className="btn"
                onClick={() => {
                  const n = localMatch + 1
                  setLocalMatch(n)
                  setSettings((prev: Settings) => ({ ...prev, matchNumber: n }))
                }}
              >+</button>
            </div>
          </div>

          <div className="field">
            <label>Team (auto)</label>
            <input value={labelForTeam(teamNumber, teamMeta)} placeholder="-" readOnly />
          </div>
        </div>
      </div>

      {(game as any).sections?.map((section: any, si: number) => (
        <div className="card" key={si}>
          <h4>{section.title}</h4>
          {(section.fields || []).map((f: any) => {
            const key: string = String(f?.key ?? '')
            if (!key) return null
            if (isNotesField(f)) return null

            if (f.kind === 'counter') {
              return <CounterRow key={key} label={f.label} value={Number(metrics[key] || 0)} onChange={(n) => updateMetric(key, n)} />
            }
            if (f.kind === 'toggle') {
              const val = !!metrics[key]
              return (
                <div className="row" key={key}>
                  <label className="muted min-w-160">{f.label}</label>
                  <div className="qty">
                    <button className={`btn ${val ? 'primary' : ''}`} onClick={() => updateMetric(key, true)}>Yes</button>
                    <button className={`btn ${!val ? 'primary' : ''}`} onClick={() => updateMetric(key, false)}>No</button>
                  </div>
                </div>
              )
            }
            if (f.kind === 'select') {
              return (
                <div className="field" key={key}>
                  <label>{f.label}</label>
                  <select value={String(metrics[key] ?? '')} onChange={(e) => updateMetric(key, e.target.value)}>
                    {(f.options || []).map((opt: any) => (
                      <option key={String(opt.value)} value={String(opt.value)}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              )
            }
            if (f.kind === 'textarea') {
              return (
                <div className="field" key={key}>
                  <label>{f.label}</label>
                  <textarea rows={Number(f.rows || 3)} value={String(metrics[key] ?? '')} onChange={(e) => updateMetric(key, e.target.value)} />
                </div>
              )
            }
            return null
          })}
        </div>
      ))}

      <div className="card">
        <h4>Discipline &amp; Status</h4>
        <CounterRow label="Penalties" value={penalties} onChange={(n)=>setPenalties(Number.isFinite(n) ? n : 0)} />
        <div className="row">
          <label className="muted min-w-160">Broke Down</label>
          <div className="qty">
            <button className={`btn ${brokeDown ? 'primary' : ''}`} onClick={() => setBrokeDown(true)}>Yes</button>
            <button className={`btn ${!brokeDown ? 'primary' : ''}`} onClick={() => setBrokeDown(false)}>No</button>
          </div>
        </div>
        <div className="field">
          <label>Defense Played: <span className="muted">{defensePlayed}</span></label>
          <input type="range" min={0} max={5} step={1} value={defensePlayed} onChange={e => setDefensePlayed(parseInt(e.target.value, 10))} />
        </div>
        <div className="field">
          <label>Defense Resilience: <span className="muted">{defenseResilience}</span></label>
          <input type="range" min={0} max={5} step={1} value={defenseResilience} onChange={e => setDefenseResilience(parseInt(e.target.value, 10))} />
        </div>
        <div className="field">
          <label>Driver Skill: <span className="muted">{driverSkill}</span></label>
          <input type="range" min={1} max={5} step={1} value={driverSkill} onChange={e => setDriverSkill(parseInt(e.target.value, 10))} />
        </div>
        <div className="field">
          <label>Card</label>
          <select value={card} onChange={e => setCard(e.target.value as any)}>
            <option value="none">None</option>
            <option value="yellow">Yellow</option>
            <option value="red">Red</option>
          </select>
        </div>
      </div>

      <div className="card">
        <h4>Notes</h4>
        <div className="field">
          <label>General Notes</label>
          <textarea rows={3} value={String(metrics['notes'] ?? '')} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>

      <div className="row">
        <button
          className="btn"
          onClick={async () => {
            const _pen = Math.max(0, Number.isFinite(penalties) ? Math.floor(penalties) : 0)
            const _defPlayed = Math.max(0, Math.min(5, Number.isFinite(defensePlayed) ? Math.floor(defensePlayed) : 0))
            const _defRes = Math.max(0, Math.min(5, Number.isFinite(defenseResilience) ? Math.floor(defenseResilience) : 0))
            const _drv = Math.max(1, Math.min(5, Number.isFinite(driverSkill) ? Math.floor(driverSkill) : 3))

            const { notes, ...metricsForSave } = metrics

            await putMatch({
              eventKey: settings.eventKey,
              matchKey,
              teamNumber: teamNumber || 0,
              alliance,
              station,
              metrics: metricsForSave,
              penalties: _pen,
              brokeDown,
              defensePlayed: _defPlayed,
              defenseResilience: _defRes,
              driverSkill: _drv,
              card,
              comments: String(metrics['notes'] ?? '') || undefined,
              scoutName: settings.scoutName || 'unknown',
              deviceId: settings.deviceId,
              schemaVersion: Number((game as any).schema) || 1,
              createdAt: Date.now(),
              synced: false
            } as any)

            // reset UI
            setMetrics(initialMetrics)
            setPenalties(0); setBrokeDown(false); setDefensePlayed(0); setDefenseResilience(0); setDriverSkill(3); setCard('none')
            alert(teamNumber ? `Saved for Team ${labelForTeam(teamNumber, teamMeta)}` : 'Saved locally')
            window.dispatchEvent(
              new CustomEvent('scout:cache-updated', {
                detail: { kind: 'match-save', eventKey: settings.eventKey }
              })
            )
            const nextMatch = localMatch + 1
            setLocalMatch(nextMatch)
            setSettings((prev: Settings) => ({ ...prev, matchNumber: nextMatch }))
          }}
        >
          Save
        </button>
      </div>
    </div>
  )
}
