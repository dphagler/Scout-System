import React from 'react'

export type Alliance = 'red' | 'blue'
export type Station = '1' | '2' | '3'

export type Settings = {
  scoutName: string
  alliance: Alliance
  station: Station
  matchNumber?: number
  eventKey: string
  syncUrl: string      // normalized to an /api base (no trailing /sync.php)
  apiKey: string
  deviceId: string
}

// ---------- hardening fallbacks (used only if envs are empty) ----------
const FALLBACKS = {
  EVENT_KEY: '2025gaalb',
  SYNC_URL:  'https://www.commodorerobotics.com/api', // we normalize anyway
  API_KEY:   '123456789abcdefg11'
}

// ---------- helpers ----------
function isBlank(v: any) {
  return v === undefined || v === null || String(v).trim() === ''
}

// Normalize to .../api (accepts root, /api, or /api/sync.php)
export function toApiBase(url: string): string {
  const clean = (url || '').trim().replace(/\/+$/,'')
  if (!clean) return '/api'
  if (/\/sync\.php$/i.test(clean)) return clean.replace(/\/sync\.php$/i, '')
  if (/\/api$/i.test(clean)) return clean
  return clean + '/api'
}

function ensureDeviceId(existing?: string): string {
  if (!isBlank(existing)) return existing as string
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  const id = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
  return `dev_${id}`
}

/**
 * Normalize settings by:
 * 1) using provided current values,
 * 2) back-filling from Vite envs (VITE_*),
 * 3) finally falling back to known defaults if envs are empty.
 * Also coerces syncUrl to an /api base (strips trailing /sync.php).
 */
export function normalizeSettings(current: Partial<Settings>): Settings {
  // Read envs (may be empty in some deployments)
  const envSync = (import.meta.env && (import.meta.env as any).VITE_SYNC_URL) || ''
  const envKey  = (import.meta.env && (import.meta.env as any).VITE_API_KEY)  || ''
  const envEvt  = (import.meta.env && (import.meta.env as any).VITE_EVENT_KEY) || ''

  // Pick values in priority: current → env → fallback
  const pickedEvent = !isBlank(current.eventKey) ? String(current.eventKey)
                    : (!isBlank(envEvt) ? String(envEvt) : FALLBACKS.EVENT_KEY)

  const pickedSyncRaw = !isBlank(current.syncUrl) ? String(current.syncUrl)
                       : (!isBlank(envSync) ? String(envSync) : FALLBACKS.SYNC_URL)

  const pickedApiKey = !isBlank(current.apiKey) ? String(current.apiKey)
                     : (!isBlank(envKey) ? String(envKey) : FALLBACKS.API_KEY)

  return {
    scoutName: String(current.scoutName ?? ''),
    alliance: (current.alliance || 'red') as Alliance,
    station: (current.station || '1') as Station,
    matchNumber: Number.isFinite(current.matchNumber as any) ? (current.matchNumber as number) : 1,
    eventKey: pickedEvent,
    syncUrl:  toApiBase(pickedSyncRaw),
    apiKey:   pickedApiKey,
    deviceId: ensureDeviceId(current.deviceId)
  }
}

// Defaults used to initialize the app (also passes through normalizeSettings)
export const defaultSettings: Settings = normalizeSettings({
  scoutName: '',
  alliance: 'red',
  station: '1',
  matchNumber: 1,
  eventKey: '',
  syncUrl: '',
  apiKey: '',
  deviceId: ''
})

// Public context
export const SettingsContext = React.createContext<{
  settings: Settings
  setSettings: (s: Settings) => void
}>({
  settings: defaultSettings,
  setSettings: () => {}
})
