import { useEffect, useRef, useState } from 'react'
import useCamera from '../hooks/useCamera'
import { plural } from '../lib/format'
import { CloseIcon, FlipIcon, ImagesIcon } from './Icons'

const HINTS = {
  photo: ['Take photos all around the room', 'Overlap each photo with the last one. Keep doors, windows and beams fully in view.'],
  video: ['Move slowly along the site', 'Tap the button to start. Film every wall once, keeping doors and windows fully in view.'],
}

// The first format this browser can record: mp4 on Safari (and recent Chrome), webm elsewhere. Both upload as they are.
function recordingFormat() {
  if (typeof MediaRecorder === 'undefined') return null
  const types = ['video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
  return types.find((type) => MediaRecorder.isTypeSupported?.(type)) ?? ''
}

const stamp = () => new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')
const clock = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
const sameFile = (a, b) => a.name === b.name && a.size === b.size

/**
 * The camera. Photo mode takes pictures, Video mode records a walkthrough, and the gallery button adds photos or
 * videos from the device. Finish hands everything over for processing on the server.
 */
export default function Scanner({ onFinish, onCancel }) {
  const fileRef = useRef(null)
  const recorderRef = useRef(null)
  const shotsRef = useRef(0) // numbers the photos, so two taken in the same second keep different names
  const [mode, setMode] = useState('photo')
  const [facing, setFacing] = useState('environment')
  const [files, setFiles] = useState([])
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [notice, setNotice] = useState('')

  const { videoRef, status, error, retry } = useCamera(facing)

  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(() => setNotice(''), 2600)
    return () => clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    if (!recording) return undefined
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(timer)
  }, [recording])

  // A recording still running when the camera closes is stopped (and dropped).
  useEffect(() => () => recorderRef.current?.state === 'recording' && recorderRef.current.stop(), [])

  const add = (list, message) => {
    setFiles((current) => [...current, ...list.filter((f) => !current.some((c) => sameFile(c, f)))])
    setNotice(message)
  }

  const takePhoto = () => {
    const video = videoRef.current
    if (!video?.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    canvas.toBlob(
      (blob) => {
        if (!blob) return
        shotsRef.current += 1
        add([new File([blob], `photo-${stamp()}-${shotsRef.current}.jpg`, { type: 'image/jpeg' })], 'Photo taken')
      },
      'image/jpeg',
      0.92,
    )
  }

  const startRecording = () => {
    const stream = videoRef.current?.srcObject
    const type = recordingFormat()
    if (!stream || type === null) {
      setNotice('This browser cannot record video here. Record with your camera app, then add it with the gallery button.')
      return
    }
    const chunks = []
    const recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined)
    recorder.ondataavailable = (event) => event.data.size > 0 && chunks.push(event.data)
    recorder.onstop = () => {
      const mime = recorder.mimeType || type || 'video/webm'
      const blob = new Blob(chunks, { type: mime })
      if (blob.size === 0) return
      add([new File([blob], `video-${stamp()}.${mime.includes('mp4') ? 'mp4' : 'webm'}`, { type: mime })], 'Video saved')
    }
    recorder.start(1000)
    recorderRef.current = recorder
    setSeconds(0)
    setRecording(true)
  }

  const stopRecording = () => {
    recorderRef.current?.stop()
    recorderRef.current = null
    setRecording(false)
  }

  const shutter = () => {
    if (status !== 'ready') return
    if (mode === 'photo') takePhoto()
    else if (recording) stopRecording()
    else startRecording()
  }

  const pickFiles = (event) => {
    const picked = [...(event.target.files ?? [])]
    event.target.value = '' // picking the same file again still fires
    if (picked.length) add(picked, `Added ${plural(picked.length, 'file')}`)
  }

  const finish = () => {
    if (files.length === 0) {
      setNotice(mode === 'photo' ? 'Take a photo first, or add one with the gallery button.' : 'Record a video first, or add one with the gallery button.')
      return
    }
    onFinish(files)
  }

  const cancel = () => {
    if (files.length === 0 || window.confirm(`Discard ${plural(files.length, 'capture')}?`)) onCancel()
  }

  const [hintTitle, hintText] = HINTS[mode]

  return (
    <div className="scanner">
      <div className="stage">
        <video ref={videoRef} playsInline muted autoPlay />
      </div>

      <div className="scanner-top">
        <button type="button" className="cam-btn cam-btn-plain" onClick={cancel} aria-label="Cancel scan">
          <CloseIcon />
        </button>

        <div className="segmented" role="tablist" aria-label="Capture mode">
          {[
            ['photo', 'Photo'],
            ['video', 'Video'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={mode === key}
              className="segment"
              onClick={() => setMode(key)}
              disabled={recording}
            >
              {label}
            </button>
          ))}
        </div>

        <button type="button" className="finish-pill" onClick={finish} disabled={recording}>
          Finish
          <span className="finish-count bump" key={files.length}>
            {files.length}
          </span>
        </button>
      </div>

      {!recording && (
        <div className="hint-card">
          <strong>{hintTitle}</strong>
          <span>{hintText}</span>
        </div>
      )}

      <div className="viewfinder" aria-hidden="true">
        <i /> <i /> <i /> <i />
      </div>

      {status === 'starting' && <p className="banner">Starting the camera…</p>}

      {status === 'error' && (
        <div className="stage-msg" role="alert">
          <p>{error}</p>
          <div className="row-actions">
            <button type="button" className="btn btn-light" onClick={retry}>
              Try again
            </button>
            <button type="button" className="btn btn-ghost" onClick={onCancel}>
              Back
            </button>
          </div>
        </div>
      )}

      <div className="scanner-bottom">
        {notice && (
          <p className="snap-toast" role="status">
            {notice}
          </p>
        )}
        {recording && !notice && <p className="snap-toast snap-live">Recording {clock(seconds)}</p>}

        <div className="controls">
          <button
            type="button"
            className="cam-btn cam-btn-square"
            onClick={() => fileRef.current?.click()}
            disabled={recording}
            aria-label="Add photos or videos from the device"
          >
            <ImagesIcon />
          </button>

          <button
            type="button"
            className={`shutter${mode === 'video' ? ' shutter-rec' : ''}${recording ? ' shutter-on' : ''}`}
            onClick={shutter}
            disabled={status !== 'ready'}
            aria-label={mode === 'photo' ? 'Take photo' : recording ? 'Stop recording' : 'Start recording'}
          >
            <span />
          </button>

          <button
            type="button"
            className="cam-btn cam-btn-round"
            onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))}
            disabled={recording}
            aria-label="Switch camera"
          >
            <FlipIcon />
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*,video/*" multiple hidden onChange={pickFiles} />
      </div>

      <p className="sr-only" aria-live="polite">
        {plural(files.length, 'capture')}
      </p>
    </div>
  )
}
