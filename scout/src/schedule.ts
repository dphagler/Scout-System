// scout/src/schedule.ts
// Loads/reads the official match schedule and provides helpers to look up teams.
// This version guarantees getQualTeam returns number | undefined (never null).

export type StationId = 'red1'|'red2'|'red3'|'blue1'|'blue2'|'blue3'

export type ScheduleMatch = {
  match_key: string
  event_key: string
  comp_level: 'qm' | 'qf' | 'sf' | 'f'
  set_number: number
  match_number: number
  time_utc?: string | null
  red1?: number | null
  red2?: number | null
  red3?: number | null
  blue1?: number | null
  blue2?: number | null
  blue3?: number | null
  field?: string | null
}

type FetchArgs = {
  eventKey: string
  syncUrl: string // can be either ".../api" or ".../api/sync.php"
  apiKey: string
}

const SCHED_CACHE_KEY = (eventKey: string) => `schedule:${eventKey}`

import { toApiBase } from './settings'

/** Return cached schedule (if present) */
export function getCachedSchedule(eventKey: string): ScheduleMatch[] | null {
  try {
    const raw = localStorage.getItem(SCHED_CACHE_KEY(eventKey))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed as ScheduleMatch[] : null
  } catch {
    return null
  }
}

/** Persist schedule to cache */
function setCachedSchedule(eventKey: string, sched: ScheduleMatch[]) {
  try { localStorage.setItem(SCHED_CACHE_KEY(eventKey), JSON.stringify(sched)) } catch {}
}

/** Fetch schedule from server and cache; returns array (possibly empty). */
export async function fetchSchedule({ eventKey, syncUrl, apiKey }: FetchArgs): Promise<ScheduleMatch[]> {
  const base = toApiBase(syncUrl)
  const url = `${base}/schedule.php?event=${encodeURIComponent(eventKey)}&key=${encodeURIComponent(apiKey)}`
  const res = await fetch(url, { headers: { 'X-API-KEY': apiKey } })
  const text = await res.text()
  let data: any
  try { data = JSON.parse(text) } catch { throw new Error(`Invalid JSON from schedule.php: ${text.slice(0,140)}`) }
  if (!data.ok) throw new Error(String(data.error || 'schedule not ok'))

  const sched: ScheduleMatch[] = Array.isArray(data.matches) ? data.matches : []
  setCachedSchedule(eventKey, sched)
  return sched
}

/**
 * Look up the team number for a given qual match and station.
 * Returns number | undefined (never null).
 */
export function getQualTeam(
  schedule: ScheduleMatch[] | null | undefined,
  qualMatchNumber: number,
  station: StationId
): number | undefined {
  if (!schedule || !Array.isArray(schedule)) return undefined
  // Find the first qual match with this match_number (comp_level === 'qm')
  const m = schedule.find(r => (r?.comp_level === 'qm') && Number(r?.match_number) === Number(qualMatchNumber))
  if (!m) return undefined

  // Pull the station field (may be null/undefined)
  const val = (m as any)[station]
  const n = typeof val === 'number' ? val : Number(val)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

/** Optional helper: compose a canonical match key */
export function makeQualMatchKey(eventKey: string, matchNumber: number): string {
  const n = Math.max(1, Math.floor(Number(matchNumber) || 1))
  return `${eventKey}_qm${n}`
}
