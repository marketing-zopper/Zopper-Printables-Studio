// Single shared IndexedDB connection for the whole app. All object stores
// must be created here, in one onupgradeneeded — two separate
// indexedDB.open() calls against the same database name/version only run
// the FIRST one's upgrade logic, silently leaving the second store missing.
const DB_NAME = 'zopper-printables-studio'
// Bumped to 2 to add the color-profile store for browsers that already had
// a v1 database (jobs store only) from before this feature existed.
const DB_VERSION = 2

export const STORE_JOBS = 'finished-jobs'
export const STORE_PROFILE = 'color-profile'

let dbPromise = null

export function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) return reject(new Error('IndexedDB unavailable'))
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(STORE_JOBS)) {
          db.createObjectStore(STORE_JOBS, { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains(STORE_PROFILE)) {
          db.createObjectStore(STORE_PROFILE, { keyPath: 'id' })
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }
  return dbPromise
}

export async function withStore(storeName, mode, fn) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode)
    const store = tx.objectStore(storeName)
    const result = fn(store)
    tx.oncomplete = () => resolve(result)
    tx.onerror = () => reject(tx.error)
  })
}
