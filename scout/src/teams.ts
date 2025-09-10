import { Settings } from './settings'

export type TeamInfo = { team_number: number; nickname?: string; name?: string }
export type TeamList = TeamInfo[]

function apiBaseFromSyncUrl(syncUrl: string) {
  try {
    const u = new URL(syncUrl)
    const dir = u.pathname.replace(/\/[^/]*$/, '') // drop filename
    return `${u.origin}${dir}`
  } catch { return '' }
}

export function getCachedTeams(eventKey: string): TeamList | null {
  try {
    const raw = localStorage.getItem(`teams:${eventKey}`)
    return raw ? JSON.parse(raw) as TeamList : null
  } catch { return null }
}

export async function fetchEventTeams(settings: Settings): Promise<TeamList | null> {
  if (!settings.syncUrl || !settings.apiKey || !settings.eventKey) return null
  const base = apiBaseFromSyncUrl(settings.syncUrl)
  if (!base) return null
  const url = `${base}/event_teams.php?event=${encodeURIComponent(settings.eventKey)}&key=${encodeURIComponent(settings.apiKey)}`
  const res = await fetch(url, { method: 'GET' })
  if (!res.ok) throw new Error(`teams ${res.status}`)
  const data = await res.json()
  if (!data?.ok) throw new Error('teams not ok')
  const list = (data.teams as any[]).map(t => ({ team_number: Number(t.team_number), nickname: t.nickname, name: t.name }))
  localStorage.setItem(`teams:${settings.eventKey}`, JSON.stringify(list))
  return list
}
