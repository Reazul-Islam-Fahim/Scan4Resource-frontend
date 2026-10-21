import { useCallback, useEffect, useState } from 'react'
import { formatChf, formatQty, formatTonnes } from '../lib/format'
import { buildReportPdf, downloadBlob, sharePdf } from '../lib/pdf'
import { METHOD_NOTE } from '../lib/impact'
import { ChevronRight, CubeIcon, DocIcon, DownloadIcon, EyeIcon, ImagesIcon, InfoIcon, LeafIcon, ShareIcon, ShopIcon } from './Icons'
import MaskPreview from './MaskPreview'
import MaterialImage from './MaterialImage'
import PageHeader from './PageHeader'
import ModelPreview from './ModelPreview'
import PdfPreview from './PdfPreview'

export default function Report({ report, items, job, title, startedAt, save, onRetrySave, onBack, onNext }) {
  const [exporting, setExporting] = useState(false)
  const [viewing, setViewing] = useState(null) // { kind: 'pdf', pdf } | { kind: 'model' } | { kind: 'masks' }
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

  // Build the PDF, then do something with it. The PDF is made from what the page shows now.
  const withPdf = async (use) => {
    setExporting(true)
    try {
      await use(await buildReportPdf(report, { title, startedAt, items }))
    } catch {
      setNotice('The PDF could not be created. Try again.')
    } finally {
      setExporting(false)
    }
  }
  const exportPdf = () =>
    withPdf(async (pdf) => {
      const result = await sharePdf(pdf)
      if (result === 'downloaded') setNotice('PDF downloaded')
      else if (result === 'shared') setNotice('PDF shared')
    })
  const closeViewer = useCallback(() => setViewing(null), [])

  const processed = job?.status === 'done'
  const notYet = 'Available after a scan is processed on the server'

  return (
    <section className="flow">
      <PageHeader
        title="Reuse Report"
        onBack={onBack}
        action={
          <button type="button" className="icon-btn icon-btn-plain" onClick={exportPdf} disabled={exporting} aria-label="Export the PDF">
            <ShareIcon />
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
        <FileRow
          icon={<DocIcon />}
          name="Report"
          detail={exporting ? 'Creating the PDF…' : 'PDF with the items, CO₂ and resale value'}
          busy={exporting}
          onPreview={() => withPdf((pdf) => setViewing({ kind: 'pdf', pdf }))}
          onDownload={() => withPdf((pdf) => downloadBlob(pdf.blob, pdf.name))}
        />
        <FileRow
          icon={<CubeIcon />}
          name="3D model"
          detail={job?.model ? 'GLB file for any 3D viewer or Blender' : notYet}
          onPreview={job?.model && (() => setViewing({ kind: 'model' }))}
          href={job?.model}
        />
        <FileRow
          icon={<ImagesIcon />}
          name="Mask images"
          detail={
            job?.masks
              ? `${job.maskFrames?.length || 'All'} frames with the objects outlined (ZIP)`
              : processed
                ? 'No objects were outlined in this scan'
                : notYet
          }
          onPreview={job?.masks && job.maskFrames?.length > 0 && (() => setViewing({ kind: 'masks' }))}
          href={job?.masks}
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

      {viewing?.kind === 'pdf' && <PdfPreview pdf={viewing.pdf} onClose={closeViewer} />}
      {viewing?.kind === 'model' && <ModelPreview src={job.model} onClose={closeViewer} />}
      {viewing?.kind === 'masks' && <MaskPreview frames={job.maskFrames} zip={job.masks} onClose={closeViewer} />}
    </section>
  )
}

/**
 * One file of the scan with Preview and Download. A file from the server comes as `href` (the server sends it as an
 * attachment, so following the link downloads it); the report is made here, so it comes as `onDownload`.
 * Without either, the file is not there yet and the buttons are off.
 */
function FileRow({ icon, name, detail, busy = false, onPreview, onDownload, href }) {
  const available = Boolean(href || onDownload)
  return (
    <li className={`download-row${available ? '' : ' download-off'}`}>
      <span className="download-icon">{icon}</span>
      <span className="download-text">
        <strong>{name}</strong>
        <span>{detail}</span>
      </span>
      <span className="download-actions">
        <button type="button" className="chip-btn" onClick={onPreview || undefined} disabled={!onPreview || busy}>
          <EyeIcon />
          Preview
        </button>
        {href ? (
          <a className="chip-btn" href={href} download>
            <DownloadIcon />
            Download
          </a>
        ) : (
          <button type="button" className="chip-btn" onClick={onDownload} disabled={!onDownload || busy}>
            <DownloadIcon />
            Download
          </button>
        )}
      </span>
    </li>
  )
}
