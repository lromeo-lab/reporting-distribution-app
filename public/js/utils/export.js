/**
 * Export utilities — AI/BI Report Studio
 * Clean PDF generation via jsPDF + html2canvas (both loaded from esm.sh).
 */

const A4 = { w: 210, h: 297 };          // mm
const MARGIN = { top: 15, left: 15, bottom: 20, right: 15 }; // mm
const CONTENT = {
  w: A4.w - MARGIN.left - MARGIN.right,  // 180mm
  h: A4.h - MARGIN.top - MARGIN.bottom,  // 262mm
};
const RENDER_W = 794;  // A4 width in px at 96dpi

/**
 * Export editor content as a multi-page A4 PDF.
 *
 * @param {HTMLElement} canvasEl – the .editor-canvas DOM element
 * @param {string}      title   – document title (used as filename)
 * @param {function}    onProgress – optional (msg) => void for UI feedback
 */
export async function exportToPDF(canvasEl, title, onProgress) {
  if (!canvasEl) throw new Error('No editor canvas element');
  const report = msg => onProgress?.(msg);

  report('Loading libraries…');
  const [{ default: jsPDF }, h2cMod] = await Promise.all([
    import('jspdf'), import('html2canvas'),
  ]);
  const html2canvas = h2cMod.default ?? h2cMod;

  // ── Clone & prepare ──
  report('Preparing document…');
  const clone = canvasEl.cloneNode(true);
  Object.assign(clone.style, {
    position: 'fixed', left: '-9999px', top: '0',
    width: RENDER_W + 'px', padding: '40px 48px',
    border: 'none', boxShadow: 'none', borderRadius: '0',
    background: '#fff',
  });

  // Inject page-break rules so html2canvas respects content boundaries
  const style = document.createElement('style');
  style.textContent = `
    h1, h2, h3, h4 { page-break-after: avoid; page-break-inside: avoid; }
    p, li { orphans: 3; widows: 3; }
    blockquote, pre, table { page-break-inside: avoid; }
    .widget-wrap, .widget-container { page-break-inside: avoid; }
    img { page-break-inside: avoid; }
  `;
  clone.appendChild(style);

  // Replace widget iframes → styled placeholders
  clone.querySelectorAll('.widget-wrap').forEach(wrap => {
    const t = wrap.querySelector('.widget-toolbar-title')?.textContent || 'Dashboard Widget';
    const ph = document.createElement('div');
    ph.style.cssText = 'border:2px dashed #cbd5e1;border-radius:12px;padding:28px 20px;text-align:center;background:#f8fafc;margin:16px 0;page-break-inside:avoid';
    ph.innerHTML = `<div style="font-size:14px;font-weight:700;color:#334155;margin-bottom:6px">\u{1F4CA} ${t}</div><div style="font-size:11px;color:#64748b">Interactive dashboard widget — view online</div>`;
    wrap.replaceWith(ph);
  });

  // Remove any overlay UI from clone
  clone.querySelectorAll('.widget-toolbar,.widget-resize-bar,.page-break-line').forEach(el => el.remove());

  // Branding header
  const hdr = document.createElement('div');
  hdr.style.cssText = 'font-size:10px;color:#94a3b8;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between';
  hdr.innerHTML = `<span>AI/BI Report Studio</span><span>${new Date().toLocaleDateString()}</span>`;
  clone.insertBefore(hdr, clone.firstChild);

  document.body.appendChild(clone);

  try {
    // ── Render to canvas ──
    report('Rendering…');
    const canvas = await html2canvas(clone, {
      scale: 2, useCORS: true, letterRendering: true,
      scrollY: 0, width: RENDER_W, windowWidth: RENDER_W,
    });

    // ── Build PDF: slice canvas into A4 pages ──
    report('Generating PDF…');
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const totalH = (canvas.height * CONTENT.w) / canvas.width; // total content height in mm
    let y = 0, page = 0;

    while (y < totalH) {
      if (page > 0) pdf.addPage();

      const srcY  = Math.round((y / totalH) * canvas.height);
      const srcH  = Math.min(Math.round((CONTENT.h / totalH) * canvas.height), canvas.height - srcY);
      const sliceH = (srcH / canvas.height) * totalH;

      const slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = srcH;
      slice.getContext('2d').drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);

      pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', MARGIN.left, MARGIN.top, CONTENT.w, sliceH);

      // Footer: page number
      pdf.setFontSize(8).setTextColor(148, 163, 184);
      pdf.text(`${page + 1}`, A4.w / 2, A4.h - 8, { align: 'center' });

      y += CONTENT.h;
      page++;
    }

    // ── Download ──
    const filename = (title || 'report').replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '-').toLowerCase();
    pdf.save(`${filename}.pdf`);
    report('');
  } finally {
    document.body.removeChild(clone);
  }
}

// Stubs for future formats
export async function exportToDOCX() { throw new Error('Coming soon'); }
export async function exportToPPTX() { throw new Error('Coming soon'); }
