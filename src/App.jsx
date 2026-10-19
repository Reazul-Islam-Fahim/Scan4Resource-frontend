import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { describeError, saveScan } from './lib/api'
import useJobPoll from './hooks/useJobPoll'
import { defaultScanName } from './lib/format'
import { buildReport } from './lib/items'
import { clearSession, loadSession, mergeDetections, newSession, sessionFromScan, storeSession } from './lib/session'
import DetectedItems from './components/DetectedItems'
import Home from './components/Home'
import MapScreen from './components/MapScreen'
import Market from './components/Market'
import { Profile, Reports } from './components/Placeholder'
import Report from './components/Report'
import Scanner from './components/Scanner'
import Scans from './components/Scans'
import Shell from './components/Shell'
import Upload from './components/Upload'

// Home -> camera (or upload) -> detected items -> reuse report -> marketplace (and the map).

// What the session keeps of an upload job: its state and links, not the items (those are merged in).
const jobSummary = (job, previous = {}) => ({
  id: job.id,
  status: job.status ?? previous.status,
  stage: 'stage' in job ? job.stage : (previous.stage ?? null),
  error: job.error ?? previous.error ?? '',
  warning: job.warning ?? previous.warning ?? '',
  maskFrames: job.maskFrames ?? previous.maskFrames ?? [],
  model: job.model ?? previous.model ?? null,
  count: job.items ? job.items.length : (previous.count ?? 0),
  pollError: job.pollError ?? '',
})

export default function App() {
  const navigate = useNavigate()
  const [session, setSession] = useState(() => loadSession() ?? newSession())
  const [save, setSave] = useState({ status: 'idle', error: '' })
  // What the camera captured, on its way to the server. Files cannot go into sessionStorage, so a reload drops them.
  const [pendingFiles, setPendingFiles] = useState([])

  // With nothing detected the pages show sample data instead (and it is never saved).
  const report = useMemo(() => buildReport(session.items), [session.items])
  const title = session.site.trim() || defaultScanName(new Date(session.startedAt))

  // Keep an in-progress scan across accidental reloads.
  useEffect(() => {
    if (session.items.length > 0 || session.job) storeSession(session)
    else clearSession()
  }, [session])

  const startNew = useCallback(
    (path) => {
      const busy = session.job && (session.job.status === 'queued' || session.job.status === 'running')
      const unsaved = (session.items.length > 0 && !session.savedAt) || busy
      if (unsaved && !window.confirm('Start a new scan? The current scan has not been saved.')) return
      setSession(newSession())
      setSave({ status: 'idle', error: '' })
      setPendingFiles([])
      navigate(path)
    },
    [session.items.length, session.savedAt, session.job, navigate],
  )
  const startScan = useCallback(() => startNew('/scan'), [startNew])

  const discard = () => {
    setSession(newSession())
    setSave({ status: 'idle', error: '' })
    navigate('/')
  }

  // The server's answers about an uploaded walkthrough. Once it is done, its objects join the items.
  const onJob = useCallback((job) => {
    setSession((current) => {
      if (!current.job ? job.status !== 'queued' && job.status !== 'running' : current.job.id !== job.id) return current
      const next = jobSummary(job, current.job ?? {})
      if (job.status === 'done' && current.job?.status !== 'done') {
        const items = mergeDetections(current.items, job.items ?? [], current.ignored)
        return { ...current, items, savedAt: null, job: next }
      }
      return { ...current, job: next }
    })
  }, [])
  useJobPoll(session.job, onJob)


  const updateItem = (id, patch) =>
    setSession((current) => ({
      ...current,
      savedAt: null,
      items: current.items.map((item) => (item.id === id ? { ...item, ...patch, edited: true } : item)),
    }))

  const removeItem = (id) =>
    setSession((current) => ({
      ...current,
      savedAt: null,
      items: current.items.filter((item) => item.id !== id),
      ignored: [...current.ignored, id],
    }))

  // The scan is saved when the report is generated; a failure is shown there and never blocks the report.
  const saveNow = useCallback(async (snapshot) => {
    if (snapshot.items.length === 0) return
    setSave({ status: 'saving', error: '' })
    try {
      await saveScan({
        id: snapshot.id,
        site: snapshot.site.trim() || defaultScanName(new Date(snapshot.startedAt)),
        startedAt: snapshot.startedAt,
        finishedAt: new Date().toISOString(),
        items: snapshot.items,
      })
      setSession((current) => (current.id === snapshot.id ? { ...current, savedAt: new Date().toISOString() } : current))
      setSave({ status: 'saved', error: '' })
    } catch (err) {
      setSave({ status: 'error', error: describeError(err) })
    }
  }, [])

  const generateReport = () => {
    saveNow(session)
    navigate('/report')
  }

  const openScan = (scan) => {
    setSession(sessionFromScan(scan))
    setSave({ status: 'idle', error: '' })
    navigate('/report')
  }

  return (
    <Routes>
      <Route
        path="/scan"
        element={
          <Scanner
            onFinish={(files) => {
              setPendingFiles(files)
              navigate('/upload')
            }}
            onCancel={discard}
          />
        }
      />
      <Route element={<Shell onScan={startScan} />}>
        <Route index element={<Home onStart={startScan} onSettings={() => navigate('/profile')} />} />
        <Route
          path="upload"
          element={
            <Upload
              scanId={session.id}
              files={pendingFiles}
              job={session.job}
              itemCount={session.items.length}
              onJob={onJob}
              onRescan={startScan}
              onBack={() => navigate('/')}
              onReview={() => navigate('/items')}
            />
          }
        />
        <Route
          path="items"
          element={
            <DetectedItems
              report={report}
              items={session.items}
              onBack={() => navigate(session.job ? '/upload' : '/scan')}
              onNext={generateReport}
              onUpdate={updateItem}
              onRemove={removeItem}
            />
          }
        />
        <Route
          path="report"
          element={
            <Report
              report={report}
              items={session.items}
              title={title}
              startedAt={session.startedAt}
              save={save}
              onRetrySave={() => saveNow(session)}
              onBack={() => navigate('/items')}
              onNext={() => navigate('/market')}
            />
          }
        />
        <Route path="market" element={<Market report={report} />} />
        <Route path="map" element={<MapScreen />} />
        <Route path="scans" element={<Scans onScan={startScan} onOpen={openScan} />} />
        <Route path="reports" element={<Reports onGoToScans={() => navigate('/scans')} />} />
        <Route path="profile" element={<Profile />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
