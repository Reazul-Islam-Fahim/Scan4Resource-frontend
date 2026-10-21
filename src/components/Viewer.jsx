import { useEffect } from 'react'
import { CloseIcon, DownloadIcon } from './Icons'

/** A full-screen preview: a title bar with Close, the content, and a Download button at the bottom. */
export default function Viewer({ title, onClose, download, children }) {
  useEffect(() => {
    const onKey = (event) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label={title}>
      <div className="viewer-bar">
        <button type="button" className="icon-btn icon-btn-plain" onClick={onClose} aria-label="Close preview">
          <CloseIcon />
        </button>
        <strong>{title}</strong>
        <span />
      </div>

      <div className="viewer-body">{children}</div>

      <div className="viewer-actions">
        {download.href ? (
          <a className="btn btn-primary btn-block" href={download.href} download>
            <DownloadIcon />
            <span>{download.label}</span>
          </a>
        ) : (
          <button type="button" className="btn btn-primary btn-block" onClick={download.onClick}>
            <DownloadIcon />
            <span>{download.label}</span>
          </button>
        )}
      </div>
    </div>
  )
}
