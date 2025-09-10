type StoreName = 'pit' | 'match'
const DB_NAME = 'scouting-db'
const DB_VERSION = 3 // don't bump unless you add/remove stores

export type PitRecord = {
  id?: number
  eventKey: string
  teamNumber: number
  drivetrain: 'swerve' | 'tank' | 'mecanum' | 'west_coast' | 'other'
  weightLb?: number
  dims?: {h:number,w:number,l:number}
  autos?: string
  mechanisms?: string
  notes?: string
  photos?: string[]
  photoBlobs?: { name: string, blob: Blob }[]
  scoutName: string
  deviceId: string
  schemaVersion?: number
  createdAt: number
  synced: boolean
}

export type MatchRecord = {
  id?: number
  eventKey: string
  matchKey: string
  teamNumber: number
  alliance: 'red' | 'blue'
  station: 'red1'|'red2'|'red3'|'blue1'|'blue2'|'blue3'
  metrics: any
  // extra top-level fields we sync to server schema
  penalties?: number
  brokeDown?: boolean
  defensePlayed?: number
  defendedBy?: number
  driverSkill?: number
  card?: 'none'|'yellow'|'red'
  comments?: string
  scoutName: string
  deviceId: string
  schemaVersion: number
  createdAt: number
  synced: boolean
}

let dbPromise: Promise<IDBDatabase> | null = null
let cachedDB: IDBDatabase | null = null

function makeOpen(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('pit')) db.createObjectStore('pit', { keyPath: 'id', autoIncrement: true })
      if (!db.objectStoreNames.contains('match')) db.createObjectStore('match', { keyPath: 'id', autoIncrement: true })
    }
    req.onsuccess = () => {
      const db = req.result
      // If any other tab bumps the version, this connection will receive onversionchange.
      db.onversionchange = () => {
        try { db.close() } catch {}
        if (cachedDB === db) cachedDB = null
        dbPromise = null
      }
      resolve(db)
    }
    req.onerror = () => reject(req.error)
    req.onblocked = () => {
      // Another open connection is blocking an upgrade. Best effort: reject to allow caller to retry later.
      reject(new Error('indexeddb_blocked'))
    }
  })
}

async function openDB(): Promise<IDBDatabase> {
  if (cachedDB) return cachedDB
  if (!('indexedDB' in window)) throw new Error('IndexedDB not supported')
  if (!dbPromise) dbPromise = makeOpen()
  cachedDB = await dbPromise
  return cachedDB!
}

// Run a transaction with **one automatic retry** if the connection was closing/invalid.
async function withStore<T>(
  store: StoreName,
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => void
): Promise<T | void> {
  const attempt = async (): Promise<T | void> => {
    const db = await openDB()
    return new Promise<T | void>((resolve, reject) => {
      let settled = false
      const tx = db.transaction(store, mode)
      const s = tx.objectStore(store)
      tx.oncomplete = () => { settled = true; resolve(undefined) }
      tx.onabort = () => {
        const err = tx.error
        if (!settled) reject(err || new Error('tx_aborted'))
      }
      tx.onerror = () => {
        const err = tx.error
        if (!settled) reject(err || new Error('tx_error'))
      }
      try {
        run(s)
      } catch (e) {
        reject(e)
      }
    })
  }

  try {
    return await attempt()
  } catch (e: any) {
    const msg = String(e && (e.message || e.name || e)) .toLowerCase()
    const isClosing =
      msg.includes('closing') ||
      msg.includes('invalidstate') ||
      msg.includes('transactioninactive') ||
      msg.includes('aborted') ||
      msg.includes('versionchange')
    if (isClosing) {
      // Drop cached connection and retry once with a fresh open.
      try {
        if (cachedDB) { try { cachedDB.close() } catch {} }
      } catch {}
      cachedDB = null
      dbPromise = null
      return attempt()
    }
    throw e
  }
}

export async function putPit(rec: PitRecord) {
  return withStore('pit', 'readwrite', s => { s.put(rec as any) })
}

export async function putMatch(rec: MatchRecord) {
  return withStore('match', 'readwrite', s => { s.put(rec as any) })
}

export async function getAll<T = any>(store: StoreName): Promise<T[]> {
  const db = await openDB()
  return new Promise<T[]>((resolve, reject) => {
    const req = db.transaction(store).objectStore(store).getAll()
    req.onsuccess = () => resolve(req.result as any)
    req.onerror = () => reject(req.error)
  })
}

export async function listUnsyncedCounts(): Promise<{pit:number, match:number}> {
  const [pit, match] = await Promise.all([
    getAll('pit') as Promise<PitRecord[]>,
    getAll('match') as Promise<MatchRecord[]>
  ])
  return {
    pit: pit.filter(r => !r.synced).length,
    match: match.filter(r => !r.synced).length
  }
}

export async function markSynced(store: StoreName, ids: number[]) {
  return withStore(store, 'readwrite', s => {
    ids.forEach(id => {
      const g = s.get(id)
      g.onsuccess = () => {
        const v = g.result as any
        if (v) { v.synced = true; s.put(v) }
      }
    })
  })
}
