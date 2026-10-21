import { useEffect, useRef, useState } from 'react'
import { describeError, isMock, uploadWalkthrough } from '../lib/api'
import { plural } from '../lib/format'
import { CheckIcon, ChevronRight, InfoIcon } from './Icons'
import PageHeader from './PageHeader'

// What the server does after the upload, in order. `stage` from the server names the step it is on.
const STEPS = [
  ['upload', 'Uploaded'],
  ['picking', 'Picking the sharpest frames'],
  ['building', 'Measuring the space'],
  ['finding', 'Finding and measuring objects'],
]

function stepOf(job) {
  if (job.status === 'queued') return 1
  const stage = job.stage ?? ''
  if (stage.startsWith('finding')) return 3
  if (stage.startsWith('measuring') || stage.startsWith('building') || stage.startsWith('saving')) return 2
  return 1
}

function megabytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`
}

/** Uploads what the camera captured as soon as the page opens; on failure, offers to try again. */
function Uploader({ files, scanId, onJob, onRescan }) {
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const started = useRef(false)

  const total = files.reduce((sum, file) => sum + file.size, 0)

  // Not cancelled when the page is left: the job still reaches the session and keeps being followed.
  const upload = async () => {
    setProgress(0)
    setError('')
    try {
      onJob(await uploadWalkthrough(files, { scanId, onProgress: setProgress }))
    } catch (err) {
      setError(describeError(err))
    }
  }

  useEffect(() => {
    if (started.current) return // StrictMode runs effects twice in development: upload once
    started.current = true
    upload()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <>
        <p className="error">The upload failed. {error}</p>
        <div className="cta-bar">
          <div className="cta-inner upload-actions">
            <button type="button" className="btn btn-primary btn-block" onClick={upload}>
              Try again
            </button>
            <button type="button" className="btn btn-secondary btn-block" onClick={onRescan}>
              Scan again
            </button>
          </div>
        </div>
      </>
    )
  }

  return (
    <div className="upload-progress job-steps" role="status">
      <strong>
        Uploading {plural(files.length, 'file')} ({megabytes(total)})
      </strong>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
      <span className="note">{Math.round(progress * 100)}%. Keep this page open until the upload is done.</span>
    </div>
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

function Done({ job, itemCount, onReview, onRescan }) {
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
            <button type="button" className="btn btn-primary btn-block" onClick={onRescan}>
              Scan again
            </button>
          )}
        </div>
      </div>
    </>
  )
}

/** Upload a walkthrough, follow its processing on the server, then go on to review the items. */
export default function Upload({ scanId, files, job, itemCount, onJob, onRescan, onBack, onReview }) {
  return (
    <section className="flow upload">
      <PageHeader title={job ? "Processing your scan" : "Uploading your scan"} onBack={onBack} />

      {!job && files?.length > 0 && <Uploader files={files} scanId={scanId} onJob={onJob} onRescan={onRescan} />}
      {!job && !files?.length && (
        <>
          <p className="lede upload-lede">Nothing to upload. Start a scan and take photos or record a video.</p>
          <button type="button" className="btn btn-primary btn-block" onClick={onRescan}>
            Start scanning
          </button>
        </>
      )}
      {job && (job.status === 'queued' || job.status === 'running') && <Processing job={job} />}
      {job?.status === 'failed' && (
        <>
          <p className="error">{job.error || 'Processing failed.'}</p>
          <div className="cta-bar">
            <div className="cta-inner">
              <button type="button" className="btn btn-primary btn-block" onClick={onRescan}>
                Scan again
              </button>
            </div>
          </div>
        </>
      )}
      {job?.status === 'done' && <Done job={job} itemCount={itemCount} onReview={onReview} onRescan={onRescan} />}

      {isMock && <p className="note upload-demo">Demo mode: the upload and the results are simulated.</p>}
    </section>
  )
}
