// Demo mode: simulated processing and browser-local storage, so the UI can be
// tried without a backend. The camera itself is still real.

const STORE_KEY = 's4r.mock.scans'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function readStore() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || '[]')
  } catch {
    return []
  }
}

export async function mockSave(payload) {
  await sleep(500)
  const scans = readStore().filter((scan) => scan.id !== payload.id)
  scans.push({ ...payload, created_at: payload.finished_at })
  localStorage.setItem(STORE_KEY, JSON.stringify(scans))
  return { id: payload.id }
}

export async function mockDelete(id) {
  await sleep(200)
  localStorage.setItem(STORE_KEY, JSON.stringify(readStore().filter((scan) => scan.id !== id)))
  return null
}

export async function mockList() {
  await sleep(300)
  return readStore()
}

// ---- Uploaded walkthroughs: a simulated job that moves through the server's stages ----------

// The job id carries its start time, so a job survives a reload without any storage.
export async function mockUpload(files, { onProgress, signal } = {}) {
  for (let step = 1; step <= 10; step += 1) {
    if (signal?.aborted) throw new Error('aborted')
    await sleep(120)
    onProgress?.(step / 10)
  }
  return { id: `mock-job-${Date.now()}`, status: 'queued', stage: null, objects: [], files: {} }
}

const MOCK_FRAMES = 8
const MOCK_OBJECTS = [
  { id: 'door-1', label: 'door', width_cm: 88.4, height_cm: 203.1, depth_cm: 6.2, material: 'wood', confidence: 0.86 },
  { id: 'door-2', label: 'glass door', width_cm: 92.0, height_cm: 161.5, material: 'glass', confidence: 0.74, partial: true },
  { id: 'window-1', label: 'window', width_cm: 118.0, height_cm: 121.5, material: 'wood', confidence: 0.81 },
  { id: 'cabinet-1', label: 'cabinet', width_cm: 80.2, height_cm: 92.7, depth_cm: 45.0, material: 'wood', confidence: 0.69 },
  { id: 'chair-1', label: 'chair', width_cm: 46.0, height_cm: 84.0, depth_cm: 50.0, material: 'metal', confidence: 0.77 },
  { id: 'chair-2', label: 'chair', width_cm: 45.1, height_cm: 82.6, depth_cm: 51.3, material: 'metal', confidence: 0.72 },
]

export async function mockGetJob(id) {
  await sleep(200)
  const started = Number(String(id).replace('mock-job-', ''))
  if (!Number.isFinite(started)) {
    const err = new Error('Reconstruction not found.')
    err.status = 404
    throw err
  }
  const s = (Date.now() - started) / 1000
  const job = { id, status: 'running', stage: null, error: null, warning: null, objects: [], files: {} }
  if (s < 2) return { ...job, status: 'queued' }
  if (s < 4) return { ...job, stage: 'picking frames' }
  if (s < 8) return { ...job, stage: 'measuring' }
  if (s < 9) return { ...job, stage: 'saving files' }
  if (s < 9 + MOCK_FRAMES * 0.5) {
    return { ...job, stage: `finding objects (frame ${Math.floor((s - 9) / 0.5) + 1} of ${MOCK_FRAMES})` }
  }
  return { ...job, status: 'done', objects: MOCK_OBJECTS.map((item) => ({ ...item, quantity: 1, unit: 'pc' })) }
}
