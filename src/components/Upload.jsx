import { useEffect, useRef, useState } from 'react'
import { describeError, isMock, uploadWalkthrough } from '../lib/api'
import { plural } from '../lib/format'
import CaptureCamera from './CaptureCamera'
import { CameraIcon, CheckIcon, ChevronRight, CloseIcon, FilmIcon, ImagesIcon, InfoIcon, UploadIcon, VideoIcon } from './Icons'
import PageHeader from './PageHeader'

// What the server does after the upload, in order. `stage` from the server names the step it is on.
const STEPS = [
  ['upload', 'Uploaded'],
  ['picking', 'Picking the sharpest frames'],
  ['building', 'Building the 3D model'],
  ['finding', 'Finding and measuring objects'],
]

function stepOf(job) {
  if (job.status === 'queued') return 1
  const stage = job.stage ?? ''
  if (stage.startsWith('finding')) return 3
  if (stage.startsWith('building') || stage.startsWith('saving')) return 2
  return 1
}

function megabytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`
}

function Picker({ scanId, onJob }) {
  const [files, setFiles] = useState([])
  const [progress, setProgress] = useState(null) // null, or 0..1 while uploading
  const [error, setError] = useState('')
  const [camera, setCamera] = useState(null) // null, or 'video' / 'photo' while the app's camera is open
  const abort = useRef(null)

  useEffect(() => () => abort.current?.abort(), [])

  const addFiles = (picked) => {
    setFiles((current) => [...current, ...picked.filter((f) => !current.some((c) => c.name === f.name && c.size === f.size))])
    setError('')
  }

  const add = (event) => {
    const picked = [...(event.target.files ?? [])]
    event.target.value = '' // picking the same file again still fires
    addFiles(picked)
  }

  const upload = async () => {
    abort.current = new AbortController()
    setProgress(0)
    setError('')
    try {
      const job = await uploadWalkthrough(files, { scanId, onProgress: setProgress, signal: abort.current.signal })
      onJob(job)
    } catch (err) {
      if (!abort.current?.signal.aborted) setError(describeError(err))
      setProgress(null)
    }
  }

  const total = files.reduce((sum, file) => sum + file.size, 0)
  const uploading = progress !== null

  if (camera) {
    return (
      <CaptureCamera
        initialMode={camera}
        onCancel={() => setCamera(null)}
        onDone={(captured) => {
          addFiles(captured)
          setCamera(null)
        }}
      />
    )
  }

  const tile = `upload-tile${uploading ? ' disabled' : ''}`

  return (
    <>
      <p className="lede upload-lede">
        Film a slow walk through the space, or take photos. The server builds a 3D model, then counts and measures what
        it finds. Videos and photos can be mixed.
      </p>

      <h2 className="upload-group">With the app's camera</h2>
      <div className="upload-pick">
        <button type="button" className={tile} onClick={() => setCamera('video')} disabled={uploading}>
          <VideoIcon />
          <strong>Record video</strong>
          <span>Walk through the room</span>
        </button>
        <button type="button" className={tile} onClick={() => setCamera('photo')} disabled={uploading}>
          <CameraIcon />
          <strong>Take photos</strong>
          <span>As many as you like</span>
        </button>
      </div>

      <h2 className="upload-group">From this device</h2>
      <div className="upload-pick">
        <label className={tile}>
          <FilmIcon />
          <strong>Upload videos</strong>
          <span>From your gallery or files</span>
          <input type="file" accept="video/*" multiple onChange={add} disabled={uploading} hidden />
        </label>
        <label className={tile}>
          <ImagesIcon />
          <strong>Upload photos</strong>
          <span>From your gallery or files</span>
          <input type="file" accept="image/*" multiple onChange={add} disabled={uploading} hidden />
        </label>
      </div>

      {files.length > 0 && (
        <ul className="upload-files">
          {files.map((file) => (
            <li key={`${file.name}-${file.size}`}>
              <span className="upload-file-name">{file.name}</span>
              <span className="note">{megabytes(file.size)}</span>
              {!uploading && (
                <button
                  type="button"
                  className="icon-btn icon-btn-plain"
                  onClick={() => setFiles((current) => current.filter((f) => f !== file))}
                  aria-label={`Remove ${file.name}`}
                >
                  <CloseIcon />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <ul className="upload-tips note">
        <li>Walk slowly and film every wall once. Keep doors and windows fully in the frame.</li>
        <li>About 30 seconds to 2 minutes of video is plenty for one room.</li>
      </ul>

      {error && <p className="error">{error}</p>}

      <div className="cta-bar">
        <div className="cta-inner">
          {uploading ? (
            <div className="upload-progress" role="status">
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
              <div className="upload-progress-row">
                <span>Uploading {Math.round(progress * 100)}% of {megabytes(total)}</span>
                <button type="button" className="text-btn danger" onClick={() => abort.current?.abort()}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="btn btn-primary btn-block btn-arrow" onClick={upload} disabled={files.length === 0}>
              <UploadIcon />
              <span>{files.length ? `Upload ${plural(files.length, 'file')} (${megabytes(total)})` : 'Pick a video or photos'}</span>
              <ChevronRight />
            </button>
          )}
        </div>
      </div>
    </>
  )
}

function Processing({ job }) {
  const current = stepOf(job)
  return (
    <>
      <ol className="job-steps">
        {STEPS.map(([key, label], index) => {
          const state = index < current ? 'done' : index === current ? 'active' : 'todo'
          return (
            <li key={key} className={`job-step ${state}`}>
              <span className="job-dot">{state === 'done' ? <CheckIcon /> : state === 'active' ? <span className="spinner" /> : null}</span>
              <span>
                {label}
                {state === 'active' && job.stage?.includes('(') && <span className="note"> {job.stage.slice(job.stage.indexOf('('))}</span>}
                {state === 'active' && job.status === 'queued' && <span className="note"> (waiting for the server)</span>}
              </span>
            </li>
          )
        })}
      </ol>
      <p className="note">Processing runs on the server and can take a few minutes. You can leave this page and come back.</p>
      {job.pollError && <p className="note warn">Can't reach the server right now, still trying. {job.pollError}</p>}
    </>
  )
}

function Done({ job, itemCount, onReview, onReset }) {
  return (
    <>
      <div className="reuse-banner">
        <CheckIcon />
        <span>
          {job.count > 0 ? (
            <>
              <strong>{plural(job.count, 'object')} found.</strong> Check the counts and sizes before the report.
            </>
          ) : (
            <strong>No objects were counted in this upload.</strong>
          )}
        </span>
      </div>

      {job.warning && (
        <p className="sample-note" role="status">
          <InfoIcon />
          <span>{job.warning}</span>
        </p>
      )}

      {job.maskFrames?.length > 0 && (
        <>
          <h2 className="section-title">What was found</h2>
          <div className="mask-strip">
            {job.maskFrames.map((src) => (
              <a key={src} href={src} target="_blank" rel="noreferrer">
                <img src={src} alt="A frame of the upload with the counted objects outlined" loading="lazy" />
              </a>
            ))}
          </div>
          <p className="note">Counted objects are tinted and labelled with their size; "~" means only partly seen.</p>
        </>
      )}

      <div className="cta-bar">
        <div className="cta-inner">
          {itemCount > 0 ? (
            <button type="button" className="btn btn-primary btn-block btn-arrow" onClick={onReview}>
              <CheckIcon />
              <span>Review {plural(itemCount, 'item')}</span>
              <ChevronRight />
            </button>
          ) : (
            <button type="button" className="btn btn-primary btn-block" onClick={onReset}>
              Upload something else
            </button>
          )}
        </div>
      </div>
    </>
  )
}

/** Upload a walkthrough, follow its processing on the server, then go on to review the items. */
export default function Upload({ scanId, job, itemCount, onJob, onReset, onBack, onReview }) {
  return (
    <section className="flow upload">
      <PageHeader title="Upload a walkthrough" onBack={onBack} />

      {!job && <Picker scanId={scanId} onJob={onJob} />}
      {job && (job.status === 'queued' || job.status === 'running') && <Processing job={job} />}
      {job?.status === 'failed' && (
        <>
          <p className="error">{job.error || 'Processing failed.'}</p>
          <div className="cta-bar">
            <div className="cta-inner">
              <button type="button" className="btn btn-primary btn-block" onClick={onReset}>
                Try another upload
              </button>
            </div>
          </div>
        </>
      )}
      {job?.status === 'done' && <Done job={job} itemCount={itemCount} onReview={onReview} onReset={onReset} />}

      {isMock && <p className="note upload-demo">Demo mode: the upload and the results are simulated.</p>}
    </section>
  )
}
