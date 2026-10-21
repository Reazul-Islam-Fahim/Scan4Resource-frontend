import { useCallback, useEffect, useState } from 'react'
import { formatChf, formatQty, formatTonnes } from '../lib/format'
import { buildReportPdf } from '../lib/pdf'
import { METHOD_NOTE } from '../lib/impact'
import { ChevronRight, DocIcon, DownloadIcon, ImagesIcon, InfoIcon, LeafIcon, ShopIcon } from './Icons'
import MaterialImage from './MaterialImage'
import PageHeader from './PageHeader'
import PdfPreview from './PdfPreview'

export default function Report({ report, items, job, title, startedAt, save, onRetrySave, onBack, onNext }) {
  const [exporting, setExporting] = useState(false)
  const [pdf, setPdf] = useState(null)
  const [notice, setNotice] = useState('')
  const [showSaved, setShowSaved] = useState(true)

  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(() => setNotice(''), 3500)
    return () => clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    if (save.status !== 'saved') return undefined
    setShowSaved(true)
    const timer = setTimeout(() => setShowSaved(false), 3000)
    return () => clearTimeout(timer)
  }, [save.status])

  const preview = async () => {
    setExporting(true)
    try {
      setPdf(await buildReportPdf(report, { title, startedAt, items }))
    } catch {
      setNotice('The PDF could not be created. Try again.')
    } finally {
      setExporting(false)
    }
  }
  const closePreview = useCallback(() => setPdf(null), [])

  return (
    <section className="flow">
      <PageHeader
        title="Reuse Report"
        onBack={onBack}
        action={
          <button type="button" className="icon-btn icon-btn-plain" onClick={preview} disabled={exporting} aria-label="Preview the PDF">
            <DocIcon />
          </button>
        }
      />

      {report.isSample && (
        <p className="sample-note" role="status">
          <InfoIcon />
          <span>Nothing was detected in this scan, so this report shows sample data.</span>
        </p>
      )}

      <div className="reuse-banner">
        <span className="reuse-icon">
          <LeafIcon />
        </span>
        <span>
          <strong>Potential for reuse</strong>
          These materials can be given a second life.
        </span>
      </div>

      <dl className="stats">
        <div>
          <dt>Items detected</dt>
          <dd>{report.detections}</dd>
        </div>
        <div>
          <dt>CO₂ savings (est.)</dt>
          <dd>{formatTonnes(report.co2Kg)}</dd>
        </div>
        <div>
          <dt>Resale value (est.)</dt>
          <dd>~ {formatChf(report.resale)}</dd>
        </div>
      </dl>
      <p className="note stats-note">{METHOD_NOTE}</p>

      <h2 className="section-title">Identified materials</h2>
      <ul className="material-list">
        {report.rows.map((r) => (
          <li key={r.key} className="material-row">
            <MaterialImage kind={r.label} src={r.image} className="material-thumb" />
            <span className="material-text">
              <strong>{r.name}</strong>
              {r.material && <span>{r.material}</span>}
            </span>
            <span className="material-qty">{formatQty(r.quantity, r.unit)}</span>
            <span className="material-price">{formatChf(r.value)}</span>
          </li>
        ))}
      </ul>

      <h2 className="section-title section-gap">Downloads</h2>
      <ul className="download-list">
        <li>
          <button type="button" className="download-row" onClick={preview} disabled={exporting}>
            <span className="download-icon">
              <DocIcon />
            </span>
            <span className="download-text">
              <strong>Report</strong>
              <span>{exporting ? 'Creating the PDF…' : 'Preview and download the PDF'}</span>
            </span>
            <DownloadIcon />
          </button>
        </li>
        <FileDownload
          href={job?.masks}
          icon={<ImagesIcon />}
          name="Mask images"
          detail={job?.maskFrames?.length ? `ZIP with ${job.maskFrames.length} frames, objects outlined` : 'ZIP of frames with the objects outlined'}
          missing={job?.status === 'done' ? 'No objects were outlined in this scan' : 'Available after a scan is processed on the server'}
        />
      </ul>

      <div className="cta-bar">
        <div className="cta-inner">
          {(notice || save.status === 'error' || (save.status === 'saved' && showSaved)) && (
            <p className={`toast${save.status === 'error' && !notice ? ' toast-error' : ''}`} role="status">
              {notice ||
                (save.status === 'error' ? (
                  <>
                    This scan was not saved. {save.error}{' '}
                    <button type="button" className="text-btn" onClick={onRetrySave}>
                      Try again
                    </button>
                  </>
                ) : (
                  'Saved to Scans'
                ))}
            </p>
          )}
          <button type="button" className="btn btn-primary btn-block btn-arrow" onClick={onNext}>
            <ShopIcon />
            <span>Find buyers / next steps</span>
            <ChevronRight />
          </button>
        </div>
      </div>

      {pdf && <PdfPreview pdf={pdf} onClose={closePreview} />}
    </section>
  )
}

/** A file the server made for the scan. The server sends it as an attachment, so following the link downloads it. */
function FileDownload({ href, icon, name, detail, missing }) {
  const body = (
    <>
      <span className="download-icon">{icon}</span>
      <span className="download-text">
        <strong>{name}</strong>
        <span>{href ? detail : missing}</span>
      </span>
      {href && <DownloadIcon />}
    </>
  )
  return (
    <li>
      {href ? (
        <a className="download-row" href={href} download>
          {body}
        </a>
      ) : (
        <div className="download-row" aria-disabled="true">
          {body}
        </div>
      )}
    </li>
  )
}
