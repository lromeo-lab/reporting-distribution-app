/**
 * Export utilities for AI/BI Report Studio
 * Uses jsPDF + html2canvas directly (no wrapper — reliable ESM imports).
 */

const A4_W_MM = 210;
const A4_H_MM = 297;
const MARGIN   = 15;  // mm
const CONTENT_W = A4_W_MM - MARGIN * 2;  // 180mm usable
const CONTENT_H = A4_H_MM - MARGIN * 2;  // 267mm usable

/**
 * Export the editor canvas as an A4 PDF.
 *
 * Flow:
 *  1. Clone the editor DOM (original untouched)
 *  2. Replace iframes with styled placeholders
 *  3. Render clone to canvas via html2canvas
 *  4. Slice the canvas into A4 pages
 *  5. Write each page into a jsPDF document
 *  6. Trigger download
 */
export async function exportToPDF(canvasEl, title, opts = {}) {
  if (!canvasEl) throw new Error('No editor canvas element provided');

  // Dynamic imports — these are proper ESM on esm.sh
  const [{ default: jsPDF }, html2canvasMod] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ]);
  const html2canvas = html2canvasMod.default || html2canvasMod;

  // 1. Clone & style for A4-width rendering
  const clone = canvasEl.cloneNode(true);
  const renderW = 794;  // A4 at 96 dpi
  Object.assign(clone.style, {
    position: 'fixed', left: '-9999px', top: '0',
    width: renderW + 'px',
    padding: '40px 48px',
    border: 'none', boxShadow: 'none', borderRadius: '0',
    background: '#ffffff',
  });

  // 2. Replace widget iframes with placeholders
  clone.querySelectorAll('.widget-wrap').forEach(wrap => {
    const titleEl = wrap.querySelector('.widget-toolbar-title');
    const widgetTitle = titleEl?.textContent || 'Dashboard Widget';
    const placeholder = document.createElement('div');
    Object.assign(placeholder.style, {
      border: '2px dashed #cbd5e1', borderRadius: '12px',
      padding: '28px 20px', textAlign: 'center',
      background: '#f8fafc', margin: '16px 0',
    });
    placeholder.innerHTML =
      '<div style="font-size:14px;font-weight:700;color:#334155;margin-bottom:6px">' +
      '\u{1F4CA} ' + widgetTitle + '</div>' +
      '<div style="font-size:11px;color:#64748b">Interactive dashboard widget \u2014 view online</div>';
    wrap.replaceWith(placeholder);
  });

  // Remove hover toolbars & resize bars from clone
  clone.querySelectorAll('.widget-toolbar, .widget-resize-bar').forEach(el => el.remove());

  // 3. Insert a header
  const hdr = document.createElement('div');
  Object.assign(hdr.style, {
    fontSize: '10px', color: '#94a3b8', marginBottom: '12px',
    paddingBottom: '8px', borderBottom: '1px solid #e2e8f0',
    display: 'flex', justifyContent: 'space-between',
  });
  hdr.innerHTML = '<span>AI/BI Report Studio</span><span>' + new Date().toLocaleDateString() + '</span>';
  clone.insertBefore(hdr, clone.firstChild);

  document.body.appendChild(clone);

  try {
    // 4. Render to canvas
    const canvas = await html2canvas(clone, {
      scale: 2,
      useCORS: true,
      letterRendering: true,
      scrollY: 0,
      width: renderW,
      windowWidth: renderW,
    });

    // 5. Slice into pages
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const imgW = CONTENT_W;
    const imgH = (canvas.height * CONTENT_W) / canvas.width;  // proportional total height in mm
    const pageH = CONTENT_H;
    let yOffset = 0;
    let page = 0;

    while (yOffset < imgH) {
      if (page > 0) pdf.addPage();

      // Crop the source canvas for this page slice
      const srcY = (yOffset / imgH) * canvas.height;
      const srcH = Math.min((pageH / imgH) * canvas.height, canvas.height - srcY);
      const sliceH = (srcH / canvas.height) * imgH;

      // Create a temp canvas for this slice
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = srcH;
      const ctx = sliceCanvas.getContext('2d');
      ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);

      const imgData = sliceCanvas.toDataURL('image/jpeg', 0.92);
      pdf.addImage(imgData, 'JPEG', MARGIN, MARGIN, imgW, sliceH);

      yOffset += pageH;
      page++;
    }

    // 6. Download
    const filename = (title || 'report')
      .replace(/[^a-zA-Z0-9_\-\s]/g, '')
      .replace(/\s+/g, '-')
      .toLowerCase();
    pdf.save(filename + '.pdf');

  } finally {
    document.body.removeChild(clone);
  }
}


// ── Placeholder exports for future formats ─────────────────────

export async function exportToDOCX(_el, _title, _opts) {
  throw new Error('DOCX export coming soon');
}

export async function exportToPPTX(_el, _title, _opts) {
  throw new Error('PPTX export coming soon');
}
