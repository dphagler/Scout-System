import React from 'react'
import { toApiBase } from '../settings'
import { buildTeamsMetaFromAny } from '../utils/teams'

export function useTeamsMeta(eventKey: string, apiKey?: string, syncUrl?: string) {
  const [meta, setMeta] = React.useState<Record<string, any>>({})

  const loadFromStorage = React.useCallback(() => {
    if (!eventKey) { setMeta({}); return }
    try {
      const metaStr = localStorage.getItem(`teamsMeta:${eventKey}`)
      if (metaStr) {
        const parsed = JSON.parse(metaStr)
        if (parsed && typeof parsed === 'object' && Object.keys(parsed).length) {
          setMeta(parsed)
          return
        }
      }
    } catch {}
    try {
      const rawStr = localStorage.getItem(`teams:${eventKey}`)
      if (rawStr) {
        const raw = JSON.parse(rawStr)
        const built = buildTeamsMetaFromAny(raw)
        if (Object.keys(built).length) {
          try { localStorage.setItem(`teamsMeta:${eventKey}`, JSON.stringify(built)) } catch {}
          setMeta(built)
          return
        }
      }
    } catch {}
    setMeta({})
  }, [eventKey])

  React.useEffect(() => { loadFromStorage() }, [loadFromStorage])

  // Optional fetch if empty and creds provided
  React.useEffect(() => {
    if (!eventKey || !apiKey || !syncUrl) return
    if (Object.keys(meta).length > 0) return
    if (!navigator.onLine) return
    ;(async () => {
      try {
        const base = toApiBase(syncUrl)
        const url = `${base}/event_teams.php?event=${encodeURIComponent(eventKey)}&key=${encodeURIComponent(apiKey)}`
        const res = await fetch(url, { headers: { 'X-API-KEY': apiKey } })
        if (!res.ok) return
        const json = await res.json()
        const built = buildTeamsMetaFromAny(json)
        try { localStorage.setItem(`teams:${eventKey}`, JSON.stringify(json)) } catch {}
        try { localStorage.setItem(`teamsMeta:${eventKey}`, JSON.stringify(built)) } catch {}
        setMeta(built)
      } catch {}
    })()
  }, [eventKey, apiKey, syncUrl, meta])

  React.useEffect(() => {
    function onCache(e: any) {
      if (e?.detail?.kind === 'teams' && e.detail.eventKey === eventKey) {
        loadFromStorage()
      }
    }
    window.addEventListener('scout:cache-updated', onCache as any)
    return () => window.removeEventListener('scout:cache-updated', onCache as any)
  }, [eventKey, loadFromStorage])

  return meta
}

