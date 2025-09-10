import { toApiBase } from './settings'
import { getAll, markSynced } from './db'
import type { PitRecord, MatchRecord } from './db'
import { fileToWebPBlob } from './photos'
import { buildTeamsMetaFromAny } from './utils/teams'

export async function refreshTeamsCache(eventKey: string, apiKey: string, syncUrl: string) {
  const base = toApiBase(syncUrl)
  const url = `${base}/event_teams.php?event=${encodeURIComponent(eventKey)}&key=${encodeURIComponent(apiKey)}`
  const res = await fetch(url, { headers: { 'X-API-KEY': apiKey } })
  if (!res.ok) throw new Error(`teams ${res.status}`)
  const json = await res.json()
  try { localStorage.setItem(`teams:${eventKey}`, JSON.stringify(json)) } catch {}
  try { localStorage.setItem(`teamsMeta:${eventKey}`, JSON.stringify(buildTeamsMetaFromAny(json))) } catch {}
}

export async function refreshScheduleCache(eventKey: string, apiKey: string, syncUrl: string) {
  const base = toApiBase(syncUrl)
  const url = `${base}/schedule.php?event=${encodeURIComponent(eventKey)}&key=${encodeURIComponent(apiKey)}`
  const res = await fetch(url, { headers: { 'X-API-KEY': apiKey } })
  if (!res.ok) throw new Error(`schedule ${res.status}`)
  const json = await res.json()
  try {
    const arr = Array.isArray(json?.matches) ? json.matches : []
    localStorage.setItem(`schedule:${eventKey}`, JSON.stringify(arr))
  } catch {}
}

export async function uploadPitPhotos(records: PitRecord[], settings: { eventKey: string; apiKey: string; syncUrl: string }): Promise<{ uploaded: number; failed: number }> {
  let uploaded = 0, failed = 0
  const base = toApiBase(settings.syncUrl)
  for (const rec of records) {
    ;(rec as any).photos = Array.isArray((rec as any).photos) ? (rec as any).photos : []
    while (rec.photoBlobs && rec.photoBlobs.length > 0) {
      const item = rec.photoBlobs[0]
      try {
        const webp: Blob = await fileToWebPBlob(item.blob as File, 1600, 0.86)
        const ext = '.webp'
        const stamp = Date.now()
        const rand = Math.random().toString(16).slice(2,10)
        const name = `${settings.eventKey}_${rec.teamNumber}_${stamp}_${rand}${ext}`
        const url = `${base}/upload_photo.php?event=${encodeURIComponent(settings.eventKey)}&team=${encodeURIComponent(String(rec.teamNumber))}&name=${encodeURIComponent(name)}&key=${encodeURIComponent(settings.apiKey)}`
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'image/webp', 'X-API-KEY': settings.apiKey || '' },
          body: webp
        })
        if (!resp.ok) throw new Error(`upload ${resp.status}`)
        const j = await resp.json()
        const photoUrl: string | undefined = j && j.url
        if (!photoUrl) throw new Error('no url in response')
        ;(rec as any).photos.push(photoUrl)
        rec.photoBlobs.shift()
        uploaded++
      } catch {
        failed++
        rec.photoBlobs.shift()
      }
    }
  }
  return { uploaded, failed }
}

export async function syncUnsynced(settings: { eventKey: string; apiKey: string; syncUrl: string }) {
  const headers = { 'Content-Type': 'application/json', 'X-API-KEY': settings.apiKey || '' }
  const base = toApiBase(settings.syncUrl || '')

  const pitAll = await getAll<PitRecord>('pit')
  const matchAll = await getAll<MatchRecord>('match')
  const pitPending = pitAll.filter(r => !r.synced)
  const matchPending = matchAll.filter(r => !r.synced)

  const photos = await uploadPitPhotos(pitPending, settings)

  const payload = {
    pit: pitPending.map(r => ({
      eventKey: r.eventKey,
      teamNumber: r.teamNumber,
      drivetrain: r.drivetrain,
      weightLb: (r as any).weightLb,
      dims: (r as any).dims,
      autos: r.autos,
      mechanisms: r.mechanisms,
      notes: r.notes,
      photos: (r as any).photos || [],
      scoutName: (r as any).scoutName,
      deviceId: (r as any).deviceId,
      createdAt: (r as any).createdAt,
      schemaVersion: (r as any).schemaVersion
    })),
    match: matchPending,
    apiKey: settings.apiKey
  }

  const res = await fetch(`${base}/sync.php`, { method: 'POST', headers, body: JSON.stringify(payload) })
  const data = await res.json()
  if (!res.ok || !data?.ok) throw new Error(data?.error || `HTTP ${res.status}`)

  const pitIds = pitPending.map(r => r.id).filter((x): x is number => typeof x === 'number')
  const matchIds = matchPending.map(r => r.id).filter((x): x is number => typeof x === 'number')
  await markSynced('pit', pitIds)
  await markSynced('match', matchIds)

  return {
    photosUploaded: photos.uploaded,
    photosFailed: photos.failed,
    pitCount: pitPending.length,
    matchCount: matchPending.length
  }
}

