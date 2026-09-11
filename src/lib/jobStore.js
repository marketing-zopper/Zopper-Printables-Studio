// Persists finished jobs (name, QA report, and the actual PDF bytes) in
// IndexedDB so job history survives a page refresh. Nothing about a job
// still in progress (reading/confirm-size/processing) is persisted — that
// lifecycle is expected to live only for the current tab, same as before.
const DB_NAME = 'zopper-printables-studio'
const STORE_NAME = 'finished-jobs'
const DB_VERSION = 1

function openDb() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('IndexedDB unavailable'))
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function withStore(mode, fn) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode)
    const store = tx.objectStore(STORE_NAME)
    const result = fn(store)
    tx.oncomplete = () => resolve(result)
    tx.onerror = () => reject(tx.error)
  })
}

export async function saveFinishedJob(record) {
  try {
    await withStore('readwrite', (store) => store.put(record))
  } catch (err) {
    console.warn('Could not save job to local history:', err)
  }
}

export async function deleteFinishedJob(id) {
  try {
    await withStore('readwrite', (store) => store.delete(id))
  } catch (err) {
    console.warn('Could not remove job from local history:', err)
  }
}

export async function loadFinishedJobs() {
  try {
    const db = await openDb()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).getAll()
      req.onsuccess = () => resolve(req.result || [])
      req.onerror = () => reject(req.error)
    })
  } catch (err) {
    console.warn('Could not load job history:', err)
    return []
  }
}
