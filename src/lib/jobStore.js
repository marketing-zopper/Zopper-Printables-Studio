// Persists finished jobs (name, QA report, and the actual PDF bytes) in
// IndexedDB so job history survives a page refresh. Nothing about a job
// still in progress (reading/confirm-size/processing) is persisted — that
// lifecycle is expected to live only for the current tab, same as before.
import { withStore, STORE_JOBS } from './db'

export async function saveFinishedJob(record) {
  try {
    await withStore(STORE_JOBS, 'readwrite', (store) => store.put(record))
  } catch (err) {
    console.warn('Could not save job to local history:', err)
  }
}

export async function deleteFinishedJob(id) {
  try {
    await withStore(STORE_JOBS, 'readwrite', (store) => store.delete(id))
  } catch (err) {
    console.warn('Could not remove job from local history:', err)
  }
}

export async function loadFinishedJobs() {
  try {
    return await withStore(STORE_JOBS, 'readonly', (store) => {
      return new Promise((resolve, reject) => {
        const req = store.getAll()
        req.onsuccess = () => resolve(req.result || [])
        req.onerror = () => reject(req.error)
      })
    })
  } catch (err) {
    console.warn('Could not load job history:', err)
    return []
  }
}
