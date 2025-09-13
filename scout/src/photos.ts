// scout/src/photos.ts
export async function fileToWebPBlob(file: File, maxSize = 1600, quality = 0.8): Promise<Blob> {
  try {
    if (typeof OffscreenCanvas !== 'undefined' && 'createImageBitmap' in window) {
      const img = await createImageBitmap(file)
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))
      const canvas = new OffscreenCanvas(w, h)
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, w, h)
      const blob = await canvas.convertToBlob({ type: 'image/webp', quality })
      img.close()
      if (blob) return blob
    }
  } catch {}

  // Fallback for browsers without OffscreenCanvas/createImageBitmap (e.g., iOS Safari)
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/webp', quality))
    }
    img.onerror = () => reject(new Error('image_load_failed'))
    img.src = URL.createObjectURL(file)
  })
  const res = await fetch(dataUrl)
  return await res.blob()
}

// Helper returns both the compressed blob and its size in bytes
export async function fileToWebPBlobWithSize(
  file: File,
  maxSize = 1600,
  quality = 0.8
): Promise<{ blob: Blob; size: number }> {
  const blob = await fileToWebPBlob(file, maxSize, quality)
  return { blob, size: blob.size }
}

function randHex(n = 4) {
  const bytes = new Uint8Array(n)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

export async function uploadPitPhoto(opts: {
  syncUrl: string
  apiKey: string
  eventKey: string
  teamNumber: number
  blob: Blob
  name?: string
}): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const { syncUrl, apiKey, eventKey, teamNumber, blob } = opts

  // Derive upload endpoint from sync url
  const base = new URL(syncUrl, location.origin)
  const parts = base.pathname.split('/')
  parts.pop()
  parts.push('upload_photo.php')
  base.pathname = parts.join('/')

  // Unique name
  const ts = Date.now()
  const suffix = randHex(4)
  const safeEvent = eventKey.replace(/[^a-z0-9_-]/gi, '').toLowerCase()
  const safeTeam = String(teamNumber)
  const filename = `${safeEvent}_${safeTeam}_${ts}_${suffix}.webp`

  const url = new URL(base.toString())
  url.searchParams.set('event', safeEvent)
  url.searchParams.set('team', safeTeam)
  url.searchParams.set('name', filename)
  url.searchParams.set('key', apiKey) // query fallback

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'image/webp',
      'X-API-KEY': apiKey
      // no X-Filename header → no CORS preflight complaint
    },
    body: blob
  })

  if (!res.ok) return { ok: false, error: 'HTTP ' + res.status }
  const json = await res.json().catch(() => null)
  if (!json || json.ok !== true || !json.url) return { ok: false, error: json?.error || 'upload_failed' }
  return { ok: true, url: json.url }
}
