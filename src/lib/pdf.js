import { METHOD_NOTE, itemImpact } from './impact'
import { conditionLabel, formatChf, formatDate, formatQty, formatTonnes } from './format'
import { materialText } from './items'

const GREEN = [1, 128, 88]
const MINT = [228, 243, 236]
const INK = [16, 48, 42]
const GREY = [96, 112, 108]

const PHOTO_MM = 18

const isPhoto = (src) => typeof src === 'string' && /^data:image\/(jpe?g|png);/.test(src)

// The id the server gave the object ("door-2"), which the mask images show too; otherwise a number in its group.
const objectId = (item, name, index) =>
  /^[a-z][a-z _]*-\d+$/i.test(item.id ?? '') ? item.id : `${name.toLowerCase()}-${index + 1}`

const formatSize3 = (item) => {
  const parts = [item.widthCm, item.heightCm, item.depthCm].map((v) => (Number.isFinite(v) ? Math.round(v) : null))
  if (parts.every((v) => v === null)) return '-'
  const dims = (parts[2] === null ? parts.slice(0, 2) : parts).map((v) => v ?? '?').join(' × ')
  return `${item.partial ? '~ ' : ''}${dims} cm`
}

// The object's photo, as large as fits in the cell, centred, keeping its shape.
function drawPhoto(doc, src, cell) {
  try {
    const { width, height } = doc.getImageProperties(src)
    const box = Math.min(PHOTO_MM, cell.width - 2, cell.height - 2)
    const scale = box / Math.max(width, height)
    const w = width * scale
    const h = height * scale
    doc.addImage(src, cell.x + (cell.width - w) / 2, cell.y + (cell.height - h) / 2, w, h)
  } catch {
    // A photo that cannot be read is left out; the row still names the object.
  }
}

const slug = (text) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)

/**
 * Lay the reuse report out as an A4 PDF. Returns the file as a blob with the name to save it under.
 * Loaded on demand so the app itself stays small.
 */
export async function buildReportPdf(report, { title, startedAt, items = [] }) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const page = { w: 210, h: 297, m: 16 }
  const inner = page.w - page.m * 2

  // Header
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(...GREEN)
  doc.text('scan4reuse', page.m, 18)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...GREY)
  doc.text(formatDate(startedAt) || formatDate(new Date().toISOString()), page.w - page.m, 18, { align: 'right' })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(24)
  doc.setTextColor(...INK)
  doc.text('Reuse Report', page.m, 32)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...GREY)
  doc.text(title, page.m, 39)

  let y = 46
  if (report.isSample) {
    doc.setFillColor(255, 244, 214)
    doc.roundedRect(page.m, y, inner, 10, 2, 2, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(120, 82, 0)
    doc.text('SAMPLE DATA. Nothing was detected in this scan, so these figures are examples.', page.m + 4, y + 6.3)
    y += 15
  }

  // Potential for reuse
  doc.setFillColor(...MINT)
  doc.roundedRect(page.m, y, inner, 16, 3, 3, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...GREEN)
  doc.text('Potential for reuse', page.m + 6, y + 7)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...GREY)
  doc.text('These materials can be given a second life.', page.m + 6, y + 12.5)
  y += 22

  // Three figures
  const stats = [
    [String(report.detections), 'Items detected'],
    [formatTonnes(report.co2Kg), 'CO2 savings (est.)'],
    [`~ ${formatChf(report.resale)}`, 'Resale value (est.)'],
  ]
  const colW = inner / 3
  stats.forEach(([value, label], i) => {
    const x = page.m + colW * i + colW / 2
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(17)
    doc.setTextColor(...GREEN)
    doc.text(value, x, y + 6, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...GREY)
    doc.text(label, x, y + 12, { align: 'center' })
  })
  y += 20

  // Identified materials
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...INK)
  doc.text('Identified materials', page.m, y)

  autoTable(doc, {
    startY: y + 3,
    margin: { left: page.m, right: page.m },
    head: [['Material', 'Details', 'Quantity', 'Est. value']],
    body: report.rows.map((row) => [
      row.name,
      [row.material, conditionLabel(row.condition).toLowerCase()].filter(Boolean).join(', '),
      formatQty(row.quantity, row.unit),
      formatChf(row.value),
    ]),
    foot: [['Total', '', '', formatChf(report.resale)]],
    theme: 'plain',
    styles: { font: 'helvetica', fontSize: 10, textColor: INK, cellPadding: { top: 3, bottom: 3, left: 2, right: 2 } },
    headStyles: { fillColor: GREEN, textColor: 255, fontStyle: 'bold' },
    footStyles: { fontStyle: 'bold', textColor: GREEN },
    columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right', fontStyle: 'bold', textColor: GREEN } },
    didParseCell: (data) => {
      if (data.section === 'head' && (data.column.index === 2 || data.column.index === 3)) data.cell.styles.halign = 'right'
      if (data.section === 'foot' && (data.column.index === 3)) data.cell.styles.halign = 'right'
    },
    didDrawCell: (data) => {
      if (data.section === 'body') {
        doc.setDrawColor(226, 233, 230)
        doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height)
      }
    },
  })

  // Object details: one table per kind of object, one row per object with its photo, so each one can be found
  // on site and in the mask images (which label objects with the same id). Only for real scans.
  if (!report.isSample) {
    let after = doc.lastAutoTable.finalY + 12
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(...INK)
    if (after > page.h - 50) {
      doc.addPage()
      after = 20
    }
    doc.text('Object details', page.m, after)
    after += 4

    for (const row of report.rows) {
      const list = items.filter((item) => item.label === row.label)
      if (list.length === 0) continue
      const withPhotos = list.some((item) => isPhoto(item.image))
      const rowH = withPhotos ? PHOTO_MM + 4 : 0

      autoTable(doc, {
        startY: after + 3,
        margin: { left: page.m, right: page.m, bottom: 26 }, // room for the method note on the last page
        head: [
          [{ content: `${row.name} (${list.length})`, colSpan: 7, styles: { fillColor: MINT, textColor: GREEN, fontSize: 11 } }],
          ['Photo', 'ID', 'Size (W × H × D)', 'Material', 'Condition', 'Qty', 'Est. value'],
        ],
        body: list.map((item, index) => [
          isPhoto(item.image) ? '' : '-',
          objectId(item, row.name, index),
          formatSize3(item),
          materialText(item),
          conditionLabel(item.condition).replace(' condition', '') || '-',
          formatQty(Number.isFinite(item.quantity) ? item.quantity : 1, item.unit || row.unit),
          formatChf(itemImpact(item).resale),
        ]),
        theme: 'plain',
        rowPageBreak: 'avoid',
        showHead: 'everyPage',
        styles: { font: 'helvetica', fontSize: 9.5, textColor: INK, valign: 'middle', cellPadding: { top: 2, bottom: 2, left: 2, right: 2 } },
        headStyles: { fillColor: GREEN, textColor: 255, fontStyle: 'bold' },
        bodyStyles: { minCellHeight: rowH },
        // The same widths in every table, so the columns line up down the page.
        columnStyles: {
          0: { cellWidth: 24 },
          1: { cellWidth: 30, fontStyle: 'bold' },
          2: { cellWidth: 38 },
          3: { cellWidth: 24 },
          4: { cellWidth: 22 },
          5: { cellWidth: 14, halign: 'right' },
          6: { cellWidth: inner - 152, halign: 'right', textColor: GREEN, fontStyle: 'bold' },
        },
        didParseCell: (data) => {
          if (data.section === 'head' && data.row.index === 1 && data.column.index >= 5) data.cell.styles.halign = 'right'
        },
        didDrawCell: (data) => {
          if (data.section !== 'body') return
          doc.setDrawColor(226, 233, 230)
          doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height)
          const image = list[data.row.index]?.image
          if (data.column.index === 0 && isPhoto(image)) drawPhoto(doc, image, data.cell)
        },
      })
      after = doc.lastAutoTable.finalY + 6
    }
  }

  // Note, page numbers, watermark
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p += 1) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...GREY)
    if (p === pages) {
      doc.text(
        METHOD_NOTE,
        page.m,
        page.h - 18,
        { maxWidth: inner },
      )
    }
    doc.text(`Page ${p} of ${pages}`, page.w - page.m, page.h - 10, { align: 'right' })
    if (report.isSample) {
      doc.saveGraphicsState()
      doc.setGState(new doc.GState({ opacity: 0.1 }))
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(64)
      doc.setTextColor(...GREEN)
      doc.text('SAMPLE DATA', page.w / 2, page.h / 2 + 20, { align: 'center', angle: 35 })
      doc.restoreGraphicsState()
    }
  }

  const stamp = new Date(startedAt || Date.now()).toISOString().slice(0, 10)
  const name = `scan4reuse-report-${slug(title) || 'scan'}-${stamp}.pdf`.replace(/-+/g, '-')
  return { blob: doc.output('blob'), name }
}

/** Save a blob as a file in the browser's downloads. */
export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}

/**
 * Hand the PDF to the phone's share sheet where that works, otherwise download it.
 * Returns 'shared', 'downloaded' or 'cancelled'.
 */
export async function sharePdf({ blob, name }) {
  const file = new File([blob], name, { type: 'application/pdf' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Reuse Report' })
      return 'shared'
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled'
      // Sharing failed for another reason: fall through to a download.
    }
  }
  downloadBlob(blob, name)
  return 'downloaded'
}
