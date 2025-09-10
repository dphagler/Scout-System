// scout/src/syncPhotos.ts
import { getAll, putPit, PitRecord } from './db'
import { uploadPitPhoto } from './photos'

export async function uploadPendingPitPhotos(settings: {
  eventKey: string
  syncUrl: string
  apiKey: string
}) {
  const all = await getAll<PitRecord>('pit')
  const pending = all.filter(
    r => !r.synced && Array.isArray((r as any).photoBlobs) && (r as any).photoBlobs.length > 0
  )

  let uploaded = 0
  for (const rec of pending) {
    const blobs = (rec as any).photoBlobs as { name: string; blob: Blob }[]
    const urls: string[] = Array.isArray(rec.photos) ? [...rec.photos] : []
    for (const item of blobs) {
      if (urls.length >= 3) break
      const up = await uploadPitPhoto({
        syncUrl: settings.syncUrl,
        apiKey: settings.apiKey,
        eventKey: rec.eventKey,
        teamNumber: rec.teamNumber,
        blob: item.blob,
        name: item.name
      })
      if (up.ok) {
        urls.push(up.url)
        uploaded++
      } else {
        // stop early; next sync can retry
        break
      }
    }
    // write back if we changed anything
    if (urls.length !== (rec.photos?.length || 0)) {
      rec.photos = urls.slice(0, 3)
      ;(rec as any).photoBlobs = []
      await putPit(rec)
    }
  }

  return { uploaded, totalRecords: pending.length }
}
