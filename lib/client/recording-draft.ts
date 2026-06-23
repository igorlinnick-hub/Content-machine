// Client-side IndexedDB storage for in-progress recordings.
// Blob is saved immediately when recording stops, before the user decides
// to save or discard. Survives page refresh. Cleared after successful upload.

const DB_NAME = 'cm-teleprompter'
const DB_VERSION = 1
const STORE = 'drafts'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export interface RecordingDraft {
  id: string
  clinicId: string
  scriptId: string | null
  blob: Blob
  title: string
  durationSec: number
  savedAt: number
}

export async function saveDraft(draft: RecordingDraft): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(draft)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

export async function loadLatestDraft(clinicId: string): Promise<RecordingDraft | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => {
      db.close()
      const all = (req.result as RecordingDraft[])
        .filter((d) => d.clinicId === clinicId)
        .sort((a, b) => b.savedAt - a.savedAt)
      resolve(all[0] ?? null)
    }
    req.onerror = () => { db.close(); reject(req.error) }
  })
}

export async function clearDraft(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

export function draftAgeLabel(savedAt: number): string {
  const sec = Math.floor((Date.now() - savedAt) / 1000)
  if (sec < 60) return 'just now'
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`
  return `${Math.floor(sec / 86400)}d ago`
}
