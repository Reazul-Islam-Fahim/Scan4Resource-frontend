import { useEffect, useRef, useState } from 'react'
import useCamera from '../hooks/useCamera'
import { plural } from '../lib/format'
import { CloseIcon, FlipIcon } from './Icons'

// The first format this browser can record: mp4 on Safari, webm on Chrome and Firefox. Both upload as they are.
function recordingFormat() {
  if (typeof MediaRecorder === 'undefined') return null
  const formats = [
    ['video/mp4', 'mp4'],
    ['video/webm;codecs=vp9', 'webm'],
    ['video/webm;codecs=vp8', 'webm'],
    ['video/webm', 'webm'],
  ]
  const hit = formats.find(([type]) => MediaRecorder.isTypeSupported?.(type))
  return hit ? { type: hit[0], ext: hit[1] } : { type: '', ext: 'webm' }
}

const stamp = () => new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')
const clock = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

const HINTS = {
  photo: ['Take photos all around the room', 'Overlap each photo with the last one, and keep doors and windows fully in view.'],
  video: ['Walk slowly through the room', 'Film every wall once. Keep doors and windows fully in view.'],
}

/** The app's own camera for the upload: take photos or record a video, then hand the files back. */
export default function CaptureCamera({ initialMode = 'video', onDone, onCancel }) {
  const [mode, setMode] = useState(initialMode)
  const [facing, setFacing] = useState('environment')
  const [taken, setTaken] = useState([]) // [{ file, url }]
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [notice, setNotice] = useState('')
  const recorderRef = useRef(null)
  const takenRef = useRef(taken)
  takenRef.current = taken

  const { videoRef, status, error, retry } = useCamera(facing)

  // Thumbnails are object URLs: free them when the camera closes.
  useEffect(() => () => takenRef.current.forEach((shot) => shot.url && URL.revokeObjectURL(shot.url)), [])

  useEffect(() => {
    if (!recording) return undefined
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(timer)
  }, [recording])

  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(() => setNotice(''), 2600)
    return () => clearTimeout(timer)
  }, [notice])

  // Stop a recording if the camera is closed mid-way.
  useEffect(() => () => recorderRef.current?.state === 'recording' && recorderRef.current.stop(), [])

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
        const file = new File([blob], `photo-${stamp()}-${takenRef.current.length + 1}.jpg`, { type: 'image/jpeg' })
        setTaken((list) => [...list, { file, url: URL.createObjectURL(blob) }])
        setNotice(`Photo ${takenRef.current.length + 1} taken`)
      },
      'image/jpeg',
      0.92,
    )
  }

  const startRecording = () => {
    const stream = videoRef.current?.srcObject
    const format = recordingFormat()
    if (!stream || !format) {
      setNotice('This browser cannot record video here. Use "Upload videos" with your camera app instead.')
      return
    }
    const chunks = []
    const recorder = new MediaRecorder(stream, format.type ? { mimeType: format.type } : undefined)
    recorder.ondataavailable = (event) => event.data.size > 0 && chunks.push(event.data)
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: recorder.mimeType || format.type || 'video/webm' })
      if (blob.size === 0) return
      const ext = (recorder.mimeType || format.type).includes('mp4') ? 'mp4' : format.ext
      const file = new File([blob], `video-${stamp()}.${ext}`, { type: blob.type })
      setTaken((list) => [...list, { file, url: null }])
      setNotice('Video saved')
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

  const cancel = () => {
    if (taken.length === 0 || window.confirm(`Discard ${plural(taken.length, 'capture')}?`)) onCancel()
  }

  const lastPhoto = [...taken].reverse().find((shot) => shot.url)
  const [hintTitle, hintText] = HINTS[mode]

  return (
    <div className="scanner capture">
      <div className="stage">
        <video ref={videoRef} playsInline muted autoPlay />
      </div>

      <div className="scanner-top">
        <button type="button" className="cam-btn cam-btn-plain" onClick={cancel} aria-label="Close the camera">
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

        <button type="button" className="finish-pill" onClick={() => onDone(taken.map((shot) => shot.file))} disabled={recording}>
          Done
          <span className="finish-count bump" key={taken.length}>
            {taken.length}
          </span>
        </button>
      </div>

      {!recording && (
        <div className="hint-card">
          <strong>{hintTitle}</strong>
          <span>{hintText}</span>
        </div>
      )}

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
          <span className="cam-btn cam-btn-square capture-last" aria-hidden={!lastPhoto}>
            {lastPhoto && <img src={lastPhoto.url} alt="" />}
          </span>

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
      </div>
    </div>
  )
}
