import { useEffect, useRef } from 'react'
import { ApiError, describeError, getJob } from '../lib/api'

const EVERY_MS = 3000

/**
 * While an uploaded walkthrough is being processed, ask the server for its state every few seconds.
 * Runs from App, so it keeps going on every page until the job is done or failed.
 */
export default function useJobPoll(job, onJob) {
  const latest = useRef(onJob)
  latest.current = onJob
  const id = job?.id
  const active = job && (job.status === 'queued' || job.status === 'running')

  useEffect(() => {
    if (!id || !active) return undefined
    let stopped = false
    let timer

    const tick = async () => {
      try {
        const next = await getJob(id)
        if (stopped) return
        latest.current({ ...next, pollError: '' })
      } catch (err) {
        if (stopped) return
        if (err instanceof ApiError && err.status === 404) {
          latest.current({ id, status: 'failed', error: 'The server no longer has this upload. Please upload it again.' })
          return
        }
        // A dropped connection is not a failed job: keep asking, and say so meanwhile.
        latest.current({ id, pollError: describeError(err) })
      }
      timer = setTimeout(tick, EVERY_MS)
    }

    timer = setTimeout(tick, 1000)
    return () => {
      stopped = true
      clearTimeout(timer)
    }
  }, [id, active])
}
