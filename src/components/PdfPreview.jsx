import { useEffect, useRef, useState } from 'react'
import { downloadBlob } from '../lib/pdf'
import { CloseIcon, DownloadIcon } from './Icons'

// PDF.js draws the pages itself, because phone browsers (Chrome on Android) do not show a PDF inside a page.
// The legacy build also runs on older phone browsers; both it and its worker load only when a preview opens.
async function loadPdfJs() {
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
  ])
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  return pdfjs
}

/** The report PDF, page by page, with a Download button. `pdf` is { blob, name } from buildReportPdf. */
export default function PdfPreview({ pdf, onClose }) {
  const pagesRef = useRef(null)
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    let cancelled = false
    let task = null
    const holder = pagesRef.current
    ;(async () => {
      try {
        const pdfjs = await loadPdfJs()
        task = pdfjs.getDocument({ data: new Uint8Array(await pdf.blob.arrayBuffer()) })
        const doc = await task.promise
        const width = holder.clientWidth
        const ratio = window.devicePixelRatio || 1
        for (let n = 1; n <= doc.numPages && !cancelled; n += 1) {
          const page = await doc.getPage(n)
          const viewport = page.getViewport({ scale: (width / page.getViewport({ scale: 1 }).width) * ratio })
          const canvas = document.createElement('canvas')
          canvas.width = viewport.width
          canvas.height = viewport.height
          canvas.className = 'pdf-page'
          canvas.setAttribute('aria-label', `Page ${n} of ${doc.numPages}`)
          await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
          if (!cancelled) holder.appendChild(canvas)
        }
        if (!cancelled) setStatus('ready')
      } catch {
        if (!cancelled) setStatus('error')
      }
    })()
    return () => {
      cancelled = true
      task?.destroy()
      holder.replaceChildren()
    }
  }, [pdf])

  useEffect(() => {
    const onKey = (event) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="pdf-preview" role="dialog" aria-modal="true" aria-label="Report preview">
      <div className="pdf-bar">
        <button type="button" className="icon-btn icon-btn-plain" onClick={onClose} aria-label="Close preview">
          <CloseIcon />
        </button>
        <strong>Report preview</strong>
        <span />
      </div>

      <div className="pdf-pages">
        {status === 'loading' && <p className="note pdf-msg">Loading the preview…</p>}
        {status === 'error' && <p className="note pdf-msg">The preview could not be shown here. You can still download the PDF.</p>}
        <div ref={pagesRef} className="pdf-page-list" />
      </div>

      <div className="pdf-actions">
        <button type="button" className="btn btn-primary btn-block" onClick={() => downloadBlob(pdf.blob, pdf.name)}>
          <DownloadIcon />
          <span>Download PDF</span>
        </button>
      </div>
    </div>
  )
}
