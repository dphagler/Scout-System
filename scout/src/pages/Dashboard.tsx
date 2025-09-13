import React from 'react'
import { SettingsContext, toApiBase } from '../settings'
import { getGameForEvent } from '../gameConfig'

type DashTeam = {
  team_number: number
  nickname?: string | null
  name?: string | null
  played: number
  avg: Record<string, number>
  sum: Record<string, number>
  flags_pct: Record<string, number>
  select_pct?: Record<string, Record<string, number>>
  endgame_pct: Record<string, number>
  card_pct: Record<string, number>
  penalties_avg?: number
  driver_skill_avg?: number
  defense_played_avg?: number
  defense_resilience_avg?: number
  broke_down_pct?: number
}

type DashSummary = {
  ok: boolean
  event: string
  stats: { teams: number; matches: number; metrics_keys: string[]; flags_keys: string[]; select_keys?: string[] }
  teams: DashTeam[]
  recent: Array<{
    match_key: string
    team_number: number
    alliance?: string
    position?: number
    created_at_ms?: number
  }>
}

export default function Dashboard() {
  const { settings } = React.useContext(SettingsContext)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [data, setData] = React.useState<DashSummary | null>(null)
  const [visibleMetrics, setVisibleMetrics] = React.useState<string[]>([])
  const [metricsInitialized, setMetricsInitialized] = React.useState(false)
  const [sortKey, setSortKey] = React.useState<string>('team_number')
  const [sortDir, setSortDir] = React.useState<'asc'|'desc'>('asc')
  const [teamOpen, setTeamOpen] = React.useState<number | null>(null)
  const [showColumnChooser, setShowColumnChooser] = React.useState(false)
  const colsKey = React.useMemo(() => `dash:cols:${settings.eventKey || 'global'}`, [settings.eventKey])

  const base = toApiBase(settings.syncUrl)

  async function load() {
    if (!settings.eventKey || !settings.apiKey) {
      setError('Set Event Key and API Key in Admin')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const url = `${base}/dash_summary.php?event=${encodeURIComponent(settings.eventKey)}&key=${encodeURIComponent(settings.apiKey)}`
      const r = await fetch(url, { headers: { 'X-API-KEY': settings.apiKey } })
      if (!r.ok) throw new Error(`${r.status}`)
      const j = (await r.json()) as DashSummary
      if (!j || (j as any).ok === false) throw new Error('Server error')
      setData(j)
    } catch (e: any) {
      setError(e?.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.eventKey, settings.apiKey, settings.syncUrl])

  const game = React.useMemo(() => getGameForEvent(settings.eventKey || ''), [settings.eventKey])

  type MetricDef = { key: string, label: string, percent: boolean, selectField?: string, selectOption?: string }

  const metricDefs: MetricDef[] = React.useMemo(() => {
    const defs: MetricDef[] = []
    // From game config
    game.sections.forEach(sec => {
      sec.fields.forEach(f => {
        if (f.kind === 'counter') defs.push({ key: f.key, label: f.label, percent: false })
        else if (f.kind === 'toggle') defs.push({ key: f.key, label: f.label, percent: true })
        else if (f.kind === 'select') {
          f.options.forEach(opt => {
            defs.push({ key: `${f.key}:${opt.value}`, label: `${f.label}: ${opt.label}`, percent: true, selectField: f.key, selectOption: opt.value })
          })
        }
      })
    })
    // Include any metrics reported by server but not in config
    ;(data?.stats?.metrics_keys || []).forEach(k => {
      if (!defs.find(d => d.key === k)) defs.push({ key: k, label: k, percent: false })
    })
    // Special built-in metrics
    defs.push(
      { key: 'penalties', label: 'Penalties', percent: false },
      { key: 'broke_down', label: 'Broke Down', percent: true },
      { key: 'defense_played', label: 'Defense Played', percent: false },
      { key: 'defense_resilience', label: 'Defense Resilience', percent: false },
      { key: 'driver_skill', label: 'Driver Skill', percent: false },
    )
    return defs
  }, [game, data?.stats?.metrics_keys])

  const metrics = React.useMemo(() => metricDefs.map(d => d.key), [metricDefs])
  const metricLabels = React.useMemo(() => {
    const m: Record<string, string> = {}
    metricDefs.forEach(d => { m[d.key] = d.label })
    return m
  }, [metricDefs])
  const percentMetrics = React.useMemo(() => new Set(metricDefs.filter(d => d.percent).map(d => d.key)), [metricDefs])
  const selectMetricMap = React.useMemo(() => {
    const m: Record<string, { field: string, option: string }> = {}
    metricDefs.forEach(d => { if (d.selectField) m[d.key] = { field: d.selectField, option: d.selectOption! } })
    return m
  }, [metricDefs])

  React.useEffect(() => {
    if (metrics.length && !metricsInitialized) {
      // Try to restore from localStorage (intersect with current metrics)
      let restored: string[] = []
      try {
        const raw = localStorage.getItem(colsKey)
        const parsed = raw ? JSON.parse(raw) : []
        if (Array.isArray(parsed)) restored = parsed.filter(k => metrics.includes(k))
      } catch {}
      setVisibleMetrics(restored.length ? restored : metrics)
      setMetricsInitialized(true)
    }
  }, [metrics, metricsInitialized, colsKey])

  // Persist changes
  React.useEffect(() => {
    if (!metricsInitialized) return
    try { localStorage.setItem(colsKey, JSON.stringify(visibleMetrics)) } catch {}
  }, [visibleMetrics, metricsInitialized, colsKey])

  function toggleMetric(k: string) {
    setVisibleMetrics(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k])
  }

  function setAllMetrics(on: boolean) {
    if (on) {
      setVisibleMetrics(metrics.slice())
    } else {
      setVisibleMetrics([])
    }
  }

  // Quick presets inferred from metric names
  function applyPreset(name: 'Driving'|'Auto'|'Teleop'|'Endgame') {
    const m = metrics
    let sel: string[] = []
    const has = (k: string, re: RegExp) => re.test(k.toLowerCase())
    if (name === 'Auto') sel = m.filter(k => has(k, /auto/))
    else if (name === 'Teleop') sel = m.filter(k => has(k, /tele|teleop|tp|driver/))
    else if (name === 'Endgame') sel = m
      .filter(k => has(k, /end|endgame|climb|hang|park|coop/))
      .filter(k => k !== 'endgame:none')
    else sel = ['defense_played', 'defense_resilience', 'driver_skill', 'penalties', 'broke_down']
      .filter(k => m.includes(k))
    setVisibleMetrics(sel)
  }

  function onSort(nextKey: string) {
    setSortKey(prev => {
      if (prev === nextKey) {
        setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
        return prev
      }
      setSortDir(nextKey.startsWith('metric:') || nextKey === 'played' ? 'desc' : 'asc')
      return nextKey
    })
  }

  const getMetricValue = React.useCallback((t: DashTeam, k: string) => {
    if (k === 'penalties') return t.penalties_avg ?? 0
    if (k === 'driver_skill') return t.driver_skill_avg ?? 0
    if (k === 'defense_played') return t.defense_played_avg ?? 0
    if (k === 'defense_resilience') return t.defense_resilience_avg ?? 0
    if (k === 'broke_down') return t.broke_down_pct ?? 0
    const sel = selectMetricMap[k]
    if (sel) return t.select_pct?.[sel.field]?.[sel.option] ?? 0
    const base = t.avg?.[k] ?? 0
    return percentMetrics.has(k) ? base * 100 : base
  }, [percentMetrics, selectMetricMap])

  const sortedTeams = React.useMemo(() => {
    const items = (data?.teams || []).slice()
    const dir = sortDir === 'asc' ? 1 : -1
    const key = sortKey
    items.sort((a,b) => {
      function num(v: any) { return typeof v === 'number' && isFinite(v) ? v : 0 }
      function cmpNum(x: number, y: number) { return (x === y ? 0 : (x < y ? -1 : 1)) * dir }
      function cmpStr(x?: string|null, y?: string|null) {
        const sx = (x||'').toLowerCase(), sy = (y||'').toLowerCase()
        if (sx === sy) return 0
        return (sx < sy ? -1 : 1) * dir
      }
      if (key === 'team_number') return cmpNum(num(a.team_number), num(b.team_number))
      if (key === 'nickname') return cmpStr(a.nickname||'', b.nickname||'')
      if (key === 'played') return cmpNum(num(a.played), num(b.played))
      if (key.startsWith('metric:')) {
        const k = key.slice(7)
        return cmpNum(num(getMetricValue(a, k)), num(getMetricValue(b, k)))
      }
      return 0
    })
    return items
  }, [data?.teams, sortKey, sortDir, getMetricValue])
  const exportHref = `${base}/dash_export_csv.php?event=${encodeURIComponent(settings.eventKey)}&key=${encodeURIComponent(settings.apiKey)}`

  return (
    <div className="container">
      <div className="card">
        <div className="row between">
          <h3 className="no-margin">Dashboard</h3>
          <div>
            <button className="btn" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
            <a className="btn ml-8" href={exportHref}>Export CSV</a>
          </div>
        </div>
        <p className="help mt-8">
          Event: <strong>{settings.eventKey || '-'}</strong> · Teams: {data?.stats?.teams ?? '-'} · Matches: {data?.stats?.matches ?? '-'}
        </p>
        {error && <div className="error" role="alert">Error: {error}</div>}

        {/* Column selector */}
        <div className="card">
          <div className="row between">
            <div className="help">Columns: choose which averages to display</div>
            <div className="row">
              <button className="btn" onClick={()=>setAllMetrics(true)}>All</button>
              <button className="btn" onClick={()=>setAllMetrics(false)}>None</button>
              <button className="btn" onClick={()=>applyPreset('Driving')}>Driving</button>
              <button className="btn" onClick={()=>applyPreset('Auto')}>Auto</button>
              <button className="btn" onClick={()=>applyPreset('Teleop')}>Teleop</button>
              <button className="btn" onClick={()=>applyPreset('Endgame')}>Endgame</button>
              <button className="btn" onClick={()=>setShowColumnChooser(s => !s)}>Custom</button>
            </div>
          </div>
          {showColumnChooser && (
            <div className="row gap-12 mt-8">
              {metrics.map(k => (
                <label key={`m_${k}`} className="row gap-6">
                  <input type="checkbox" checked={visibleMetrics.includes(k)} onChange={()=>toggleMetric(k)} />
                  <span>{metricLabels[k] || k}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Team table */}
        <div className="overflow-x-auto">
          <table className="table min-w-720">
            <thead>
              <tr>
                <th className="clickable" onClick={()=>onSort('team_number')}>Team {sortKey==='team_number' ? (sortDir==='asc'?'▲':'▼') : ''}</th>
                <th className="clickable" onClick={()=>onSort('nickname')}>Nick {sortKey==='nickname' ? (sortDir==='asc'?'▲':'▼') : ''}</th>
                <th className="clickable" onClick={()=>onSort('played')}>Played {sortKey==='played' ? (sortDir==='asc'?'▲':'▼') : ''}</th>
                {visibleMetrics.map(k => (
                  <th key={`h_${k}`} className="clickable" onClick={()=>onSort(`metric:${k}`)}>{metricLabels[k] || k} {sortKey===`metric:${k}` ? (sortDir==='asc'?'▲':'▼') : ''}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedTeams.map(t => (
                <tr key={t.team_number}>
                  <td><button className="btn small" onClick={()=>setTeamOpen(t.team_number)}>{t.team_number}</button></td>
                  <td><span className="clickable" onClick={()=>setTeamOpen(t.team_number)}>{t.nickname || ''}</span></td>
                  <td>{t.played}</td>
                  {visibleMetrics.map(k => {
                    const val = getMetricValue(t, k)
                    const display = percentMetrics.has(k) ? val.toFixed(1) : val
                    return <td key={`${t.team_number}_${k}`}>{display}</td>
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
      {teamOpen !== null && (
        <TeamModal teamNumber={teamOpen} onClose={()=>setTeamOpen(null)} />
      )}
    </div>
  )
}

function TeamModal({ teamNumber, onClose }: { teamNumber: number, onClose: () => void }) {
  const { settings } = React.useContext(SettingsContext)
  const base = toApiBase(settings.syncUrl)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [detail, setDetail] = React.useState<any>(null)
  const [photoOpen, setPhotoOpen] = React.useState<string | null>(null)

  React.useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const url = `${base}/team_detail.php?event=${encodeURIComponent(settings.eventKey)}&team=${encodeURIComponent(String(teamNumber))}&key=${encodeURIComponent(settings.apiKey)}`
        const r = await fetch(url, { headers: { 'X-API-KEY': settings.apiKey } })
        if (!r.ok) throw new Error(`${r.status}`)
        const j = await r.json()
        if (!alive) return
        if (!j?.ok) throw new Error('Server error')
        setDetail(j)
      } catch (e: any) {
        if (alive) setError(e?.message || String(e))
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [base, settings.apiKey, settings.eventKey, teamNumber])

  function parseJsonMaybe(v: any) {
    if (!v) return null
    if (typeof v === 'string') {
      try { return JSON.parse(v) } catch { return null }
    }
    return v
  }

  function formatStation(alliance?: string|null, position?: any) {
    const posStr = position !== undefined && position !== null ? String(position) : ''
    const match = posStr.match(/^(red|blue)(\d)$/i)
    if (match) {
      const color = match[1]
      const num = match[2]
      return `${color.charAt(0).toUpperCase()}${color.slice(1)} ${num}`
    }
    const alli = alliance ? String(alliance) : ''
    if (alli && posStr) return `${alli.charAt(0).toUpperCase()}${alli.slice(1)} ${posStr}`
    if (alli) return `${alli.charAt(0).toUpperCase()}${alli.slice(1)}`
    return posStr || '-'
  }

  function fmt(v?: number | string | null) {
    if (v === null || v === undefined) return '-'
    const num = typeof v === 'string' ? Number(v) : v
    return Number.isFinite(num) ? num.toFixed(2) : '-'
  }

  const pit = detail?.pit || null
  const dims = parseJsonMaybe(pit?.dims_json)
  const mechs = parseJsonMaybe(pit?.mechanisms_json)
  const photos: string[] = parseJsonMaybe(pit?.photos_json) || []

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <div className="header">
          <h3 className="no-margin">Team {teamNumber} {detail?.meta?.nickname ? `— ${detail.meta.nickname}` : ''}</h3>
          <button className="close" onClick={onClose}>Close</button>
        </div>
        {loading && <p className="help">Loading…</p>}
        {error && <div className="error" role="alert">Error: {error}</div>}
          {!loading && !error && (
          <div className="grid two mt-12">
            <div>
              <h4>Pit</h4>
              <p className="help">Drivetrain: {pit?.drivetrain || '-'} · Weight: {pit?.weight_lb ?? '-'} lb</p>
              {dims && <p className="help">Dims: {dims?.l || dims?.length || '-'} × {dims?.w || dims?.width || '-'} × {dims?.h || dims?.height || '-'}</p>}
              {mechs && (typeof mechs === 'object') && ('text' in mechs) && <p className="help">Mechanisms: {mechs.text}</p>}
              {pit?.notes && <p className="help">Notes: {pit.notes}</p>}
              {photos.length > 0 && (
                <div className="row mt-8">
                  {photos.map((u,i)=>(<img key={i} src={u} alt="pit" className="thumb" onClick={()=>setPhotoOpen(u)} />))}
                </div>
              )}
            </div>
            <div>
              <h4>Recent Matches</h4>
              <ul>
                {(detail?.recent || []).map((m:any, i:number) => (
                  <li key={i} className="help">
                    <a href={`https://www.statbotics.io/match/${m.match_key}`} target="_blank" rel="noopener noreferrer">{m.match_key}</a>
                    {` · ${formatStation(m.alliance, m.position)} · Endgame: ${m.endgame || '-'}`}
                  </li>
                ))}
              </ul>
              {detail?.endgame_pct && (
                <ul>
                  {Object.entries(detail.endgame_pct as Record<string, number>).map(([k, v]: [string, number]) => (
                    <li key={k} className="help">{`${k}: ${v.toFixed(1)}%`}</li>
                  ))}
                </ul>
              )}
              <p className="help">
                Played: {detail?.played ?? 0} · Penalties Avg: {fmt(detail?.penalties_avg)} · Driver Avg: {fmt(detail?.driver_skill_avg)} · Broke Down Avg: {fmt(detail?.broke_down_avg)} · Defense Resilience Avg: {fmt(detail?.defense_resilience_avg)} · Defense Played Avg: {fmt(detail?.defense_played_avg)}
              </p>
              {detail?.cards && detail.cards.length > 0 && (
                <p className="help">Cards: {detail.cards.join(', ')}</p>
              )}
              <p className="help"><a href={`https://www.statbotics.io/team/${teamNumber}`} target="_blank" rel="noopener noreferrer">View on Statbotics</a></p>
            </div>
          </div>
        )}
      </div>
      {photoOpen && (
        <div
          className="lightbox-backdrop"
          onClick={(e)=>{ e.stopPropagation(); setPhotoOpen(null) }}
        >
          <img className="lightbox-img" src={photoOpen} alt="pit" />
        </div>
      )}
    </div>
  )
}
