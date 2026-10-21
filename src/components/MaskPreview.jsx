import Viewer from './Viewer'

/** Every frame of the scan with the counted objects outlined, one under the other. */
export default function MaskPreview({ frames, zip, onClose }) {
  return (
    <Viewer title="Mask images" onClose={onClose} download={{ label: 'Download mask images', href: zip }}>
      <p className="note viewer-hint">Counted objects are tinted and labelled with their size; "~" means only partly seen.</p>
      <div className="mask-list">
        {frames.map((src, i) => (
          <figure key={src}>
            <img src={src} alt={`Frame ${i + 1} with the counted objects outlined`} loading="lazy" />
            <figcaption>
              Frame {i + 1} of {frames.length}
            </figcaption>
          </figure>
        ))}
      </div>
    </Viewer>
  )
}
