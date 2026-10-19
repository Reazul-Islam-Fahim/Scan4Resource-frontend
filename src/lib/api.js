import { mockDelete, mockGetJob, mockList, mockSave, mockUpload } from './mock'
import { catalogFor, resolveLabel } from './materials'

const BASE = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '')

// Demo mode when no backend URL is configured, or when forced.
export const isMock = import.meta.env.VITE_USE_MOCK === 'true' || BASE === ''

export class ApiError extends Error {
  constructor(status, message, detail = '') {
    super(message)
    this.status = status
    this.detail = detail
  }
}

// FastAPI reports problems as { "detail": "..." }. Only plain-text details are worth showing.
function readDetail(text) {
  try {
    const body = JSON.parse(text)
    return typeof body?.detail === 'string' ? body.detail : ''
  } catch {
    return ''
  }
}

export function describeError(err) {
  if (err instanceof ApiError) {
    if (!err.status) return err.message
    return err.detail
      ? `The server answered with status ${err.status}: ${err.detail}`
      : `The server answered with status ${err.status}.`
  }
  return 'The connection failed. Check your internet connection and try again.'
}

async function request(path, options = {}, timeoutMs = 10000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(`${BASE}${path}`, { ...options, signal: controller.signal })
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new ApiError(response.status, text.slice(0, 200), readDetail(text))
    }
    if (response.status === 204) return null
    return await response.json()
  } catch (err) {
    if (err.name === 'AbortError') throw new ApiError(0, 'The server took too long to answer.')
    throw err
  } finally {
    clearTimeout(timer)
  }
}

const toNumber = (value) => (Number.isFinite(Number(value)) && value !== null ? Number(value) : null)

function normalizeBox(box) {
  if (!box) return null
  if (Array.isArray(box)) {
    const [x, y, w, h] = box
    return { x, y, w, h }
  }
  return { x: box.x, y: box.y, w: box.w ?? box.width, h: box.h ?? box.height }
}

// Accepts snake_case or camelCase from the backend and returns one shape.
// `fallbackLabel` is used for entries of the older `doors` list, which carry no label.
export function normalizeDetection(raw, fallbackLabel = 'unknown') {
  const id = raw.id ?? raw.track_id
  if (id === undefined || id === null) return null
  const label = resolveLabel(raw.label ?? raw.class ?? raw.name ?? fallbackLabel)
  const quantity = toNumber(raw.quantity ?? raw.count)
  return {
    id: String(id),
    label,
    box: normalizeBox(raw.box ?? raw.bbox),
    quantity: quantity && quantity > 0 ? quantity : 1,
    unit: raw.unit === 'm2' || raw.unit === 'm²' ? 'm2' : raw.unit || catalogFor(label).unit,
    widthCm: toNumber(raw.width_cm ?? raw.widthCm),
    heightCm: toNumber(raw.height_cm ?? raw.heightCm),
    depthCm: toNumber(raw.depth_cm ?? raw.depthCm),
    partial: !!raw.partial,
    material: raw.material ?? 'unknown',
    condition: raw.condition ?? null,
    confidence: toNumber(raw.confidence ?? raw.score),
    image: raw.image ?? null,
  }
}

// Merge the `objects` list and the older `doors` list of a response, one entry per id.
function readDetections(data) {
  const byId = new Map()
  for (const raw of data.objects ?? data.items ?? []) {
    const item = normalizeDetection(raw)
    if (item) byId.set(item.id, item)
  }
  for (const raw of data.doors ?? []) {
    const item = normalizeDetection(raw, 'doors')
    if (item && !byId.has(item.id)) byId.set(item.id, item)
  }
  return [...byId.values()]
}

/**
 * Save a finished scan.
 * `objects` carries every item with its label and quantity. `doors` repeats the doors in the
 * older shape, so a backend that only knows doors keeps working.
 */
export async function saveScan({ id, site, startedAt, finishedAt, items }) {
  const objects = items.map((item) => ({
    id: item.id,
    label: item.label,
    quantity: item.quantity,
    unit: item.unit,
    width_cm: item.widthCm,
    height_cm: item.heightCm,
    depth_cm: item.depthCm ?? null,
    partial: !!item.partial,
    material: item.material,
    condition: item.condition,
    confidence: item.confidence,
    image: item.image,
  }))
  const payload = {
    id,
    site,
    started_at: startedAt,
    finished_at: finishedAt,
    objects,
    doors: objects.filter((item) => item.label === 'doors'),
  }

  if (isMock) return mockSave(payload)

  return request(
    '/scans',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    20000,
  )
}

/** Delete a saved scan. */
export async function deleteScan(id) {
  if (isMock) return mockDelete(id)
  await request(`/scans/${encodeURIComponent(id)}`, { method: 'DELETE' })
  return null
}

/** Saved scans, newest first. */
export async function listScans() {
  const data = isMock ? await mockList() : await request('/scans')
  const scans = Array.isArray(data) ? data : (data.scans ?? [])

  return scans
    .map((scan) => ({
      id: String(scan.id),
      site: scan.site ?? scan.name ?? '',
      createdAt: scan.created_at ?? scan.finished_at ?? scan.started_at ?? null,
      items: readDetections({ objects: scan.objects ?? scan.items, doors: scan.doors }),
    }))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
}

// ---- Upload a walkthrough, processed on the server (3D model, objects, sizes) ----------------

/** File links in a job are paths on the API ("/reconstructions/..."); make them loadable. */
export const fileUrl = (path) => (!path || /^(https?:|data:|blob:)/.test(path) ? path : `${BASE}${path}`)

function normalizeJob(raw) {
  const files = raw.files ?? {}
  return {
    id: String(raw.id),
    status: raw.status ?? 'queued', // queued, running, done, failed
    stage: raw.stage ?? null,
    error: raw.error ?? '',
    warning: raw.warning ?? '',
    items: (raw.objects ?? []).map((item) => normalizeDetection(item)).filter(Boolean),
    maskFrames: (files.mask_frames ?? []).map(fileUrl),
    model: fileUrl(files.model ?? null),
    masks: fileUrl(files.masks ?? null),
  }
}

/**
 * Upload a video and/or photos. Resolves with the job as soon as the upload is in; the processing
 * runs on the server afterwards (poll `getJob`). XMLHttpRequest, not fetch, for upload progress.
 */
export function uploadWalkthrough(files, { scanId, onProgress, signal } = {}) {
  if (isMock) return mockUpload(files, { onProgress, signal }).then(normalizeJob)

  return new Promise((resolve, reject) => {
    const body = new FormData()
    for (const file of files) body.append('files', file, file.name)
    if (scanId) body.append('scan_id', scanId)

    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${BASE}/reconstructions`)
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total)
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(normalizeJob(JSON.parse(xhr.responseText)))
        } catch {
          reject(new ApiError(xhr.status, 'The server sent an answer the app could not read.'))
        }
      } else {
        const text = xhr.responseText || ''
        reject(new ApiError(xhr.status, text.slice(0, 200), readDetail(text)))
      }
    }
    xhr.onerror = () => reject(new TypeError('network'))
    xhr.onabort = () => reject(new ApiError(0, 'The upload was cancelled.'))
    signal?.addEventListener('abort', () => xhr.abort())
    xhr.send(body)
  })
}

/** The processing job: status, stage, and the counted objects once done. */
export async function getJob(id) {
  if (isMock) return normalizeJob(await mockGetJob(id))
  return normalizeJob(await request(`/reconstructions/${encodeURIComponent(id)}`, {}, 15000))
}
