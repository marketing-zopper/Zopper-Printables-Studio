// Persists the user-supplied ICC output profile in IndexedDB. We never
// bundle or redistribute a press profile ourselves (licensing for FOGRA/ECI
// profiles varies) — the studio only ever uses whatever profile your own
// organisation legitimately supplies, stored locally in this browser.
import { withStore, STORE_PROFILE } from './db'

const RECORD_ID = 'active'

export async function saveIccProfile({ fileName, name, colorSpace, bytes }) {
  await withStore(STORE_PROFILE, 'readwrite', (store) =>
    store.put({ id: RECORD_ID, fileName, name, colorSpace, bytes }),
  )
}

export async function clearIccProfile() {
  try {
    await withStore(STORE_PROFILE, 'readwrite', (store) => store.delete(RECORD_ID))
  } catch (err) {
    console.warn('Could not clear stored colour profile:', err)
  }
}

export async function loadIccProfile() {
  try {
    return await withStore(STORE_PROFILE, 'readonly', (store) => {
      return new Promise((resolve, reject) => {
        const req = store.get(RECORD_ID)
        req.onsuccess = () => resolve(req.result || null)
        req.onerror = () => reject(req.error)
      })
    })
  } catch (err) {
    console.warn('Could not load stored colour profile:', err)
    return null
  }
}
