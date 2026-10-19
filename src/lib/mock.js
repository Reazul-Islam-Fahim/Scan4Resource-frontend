// Demo mode: simulated detections and browser-local storage, so the UI can be
// tried without a backend. The camera itself is still real.

const CYCLE = 12 // frames per simulated item in video mode: a few empty frames, then the item in view
const STORE_KEY = 's4r.mock.scans'

// [label, quantity range, unit, material]
const KINDS = [
  ['bricks', [30, 120], 'pc', 'clay'],
  ['doors', [1, 1], 'pc', 'wood'],
  ['concrete_beams', [2, 8], 'pc', 'concrete'],
  ['window_frames', [1, 4], 'pc', 'wood'],
  ['wooden_beams', [4, 15], 'pc', 'wood'],
  ['floor_tiles', [6, 24], 'm2', 'ceramic'],
]
const DOOR_MATERIALS = ['wood', 'metal', 'glass', 'pvc', 'composite']

// Deterministic pseudo-random number in [0, 1) so each simulated item keeps its size.
const rand = (seed) => {
  const x = Math.sin(seed * 9301 + 49297) * 233280
  return x - Math.floor(x)
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function makeItem(id, kindIndex, seed, box) {
  const [label, [lo, hi], unit, material] = KINDS[kindIndex % KINDS.length]
  const isDoor = label === 'doors'
  return {
    id,
    label,
    box,
    quantity: isDoor ? 1 : Math.round(lo + rand(seed + 2) * (hi - lo)),
    unit,
    widthCm: isDoor ? 72 + Math.round(rand(seed + 1) * 36) + (Math.random() - 0.5) * 1.4 : null,
    heightCm: isDoor ? 198 + Math.round(rand(seed + 7) * 14) + (Math.random() - 0.5) * 1.4 : null,
    material: isDoor ? DOOR_MATERIALS[seed % DOOR_MATERIALS.length] : material,
    confidence: 0.72 + rand(seed + 5) * 0.25,
    image: null,
  }
}

export async function mockDetect(frameIndex, mode = 'video') {
  await sleep(mode === 'photo' ? 500 : 220)

  if (mode === 'photo') {
    const count = 1 + Math.floor(rand(frameIndex + 11) * 3)
    return Array.from({ length: count }, (_, i) =>
      makeItem(`mock-photo-${frameIndex}-${i}`, Math.floor(rand(frameIndex * 7 + i) * KINDS.length), frameIndex * 5 + i, {
        x: 0.08 + (i / count) * 0.84 + rand(frameIndex + i) * 0.03,
        y: 0.22 + rand(frameIndex + i + 3) * 0.12,
        w: 0.8 / count - 0.03,
        h: 0.42,
      }),
    )
  }

  const n = Math.floor(frameIndex / CYCLE)
  const phase = frameIndex % CYCLE
  if (phase < 3 || phase > 8) return []
  return [
    makeItem(`mock-${n}`, n, n, {
      x: 0.3 + rand(n + 3) * 0.1 + (phase - 3) * 0.004,
      y: 0.18,
      w: 0.34,
      h: 0.6,
    }),
  ]
}

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
  if (s < 8) return { ...job, stage: 'building 3D model' }
  if (s < 9) return { ...job, stage: 'saving files' }
  if (s < 9 + MOCK_FRAMES * 0.5) {
    return { ...job, stage: `finding objects (frame ${Math.floor((s - 9) / 0.5) + 1} of ${MOCK_FRAMES})` }
  }
  return { ...job, status: 'done', objects: MOCK_OBJECTS.map((item) => ({ ...item, quantity: 1, unit: 'pc' })) }
}
