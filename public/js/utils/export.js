/**
 * Export utilities for AI/BI Report Studio
 * PDF: jsPDF + html2canvas.  Widget screenshots via server-side Puppeteer.
 */

const A4_W_MM = 210;
const A4_H_MM = 297;
const MARGIN   = 15;
const MARGIN_B = 20;
const CONTENT_W = A4_W_MM - MARGIN * 2;
const CONTENT_H = A4_H_MM - MARGIN - MARGIN_B;

/**
 * Capture a widget screenshot via the server Puppeteer endpoint.
 * Returns a base64 data URL or null on failure.
 */
async function captureWidgetScreenshot(embedUrl) {
  try {
    const resp = await fetch('/api/proxy/widget-screenshot?url=' + encodeURIComponent(embedUrl));
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return await new Promise(resolve => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn('[export] Screenshot failed for', embedUrl, err);
    return null;
  }
}

/**
 * Build a placeholder element for widgets that couldn't be screenshotted.
 */
function buildPlaceholder(widgetTitle) {
  const el = document.createElement('div');
  Object.assign(el.style, {
    border: '2px dashed #cbd5e1', borderRadius: '12px',
    padding: '28px 20px', textAlign: 'center',
    background: '#f8fafc', margin: '16px 0',
  });
  el.innerHTML =
    '<div style="font-size:14px;font-weight:700;color:#334155;margin-bottom:6px">' +
    '\u{1F4CA} ' + widgetTitle + '</div>' +
    '<div style="font-size:11px;color:#64748b">Interactive dashboard widget</div>';
  return el;
}

/**
 * Export the editor canvas as an A4 PDF.
 *
 * 1. Clone editor DOM
 * 2. For each widget, try server-side Puppeteer screenshot → <img>;
 *    fallback to placeholder
 * 3. html2canvas → slice into A4 pages → jsPDF → download
 */
export async function exportToPDF(canvasEl, title, onProgress) {
  if (!canvasEl) throw new Error('No editor canvas element provided');

  const report = (msg) => onProgress && onProgress(msg);

  // Dynamic imports
  report('Loading export libraries...');
  const [{ default: jsPDF }, html2canvasMod] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ]);
  const html2canvas = html2canvasMod.default || html2canvasMod;

  // 1. Clone
  report('Preparing document...');
  const clone = canvasEl.cloneNode(true);
  const renderW = 794;
  Object.assign(clone.style, {
    position: 'fixed', left: '-9999px', top: '0',
    width: renderW + 'px',
    padding: '40px 48px',
    border: 'none', boxShadow: 'none', borderRadius: '0',
    background: '#ffffff',
  });

  // 2. Capture widget screenshots
  const wraps = clone.querySelectorAll('.widget-wrap');
  if (wraps.length > 0) {
    report(`Capturing ${wraps.length} widget(s)...`);
    // Get embed URLs from the ORIGINAL (clone iframes may have lost src)
    const origWraps = canvasEl.querySelectorAll('.widget-wrap');
    for (let i = 0; i < wraps.length; i++) {
      const origIframe = origWraps[i]?.querySelector('iframe');
      const cloneWrap = wraps[i];
      const titleEl = cloneWrap.querySelector('.widget-toolbar-title');
      const widgetTitle = titleEl?.textContent || 'Dashboard Widget';
      const embedUrl = origIframe?.src || '';

      report(`Screenshot ${i + 1}/${wraps.length}: ${widgetTitle}`);

      let replacement;
      if (embedUrl) {
        const dataUrl = await captureWidgetScreenshot(embedUrl);
        if (dataUrl) {
          replacement = document.createElement('div');
          Object.assign(replacement.style, {
            margin: '16px 0',
            borderRadius: '12px',
            overflow: 'hidden',
            border: '1px solid #e2e8f0',
          });
          const img = document.createElement('img');
          img.src = dataUrl;
          Object.assign(img.style, {
            width: '100%', height: 'auto', display: 'block',
          });
          replacement.appendChild(img);
        }
      }
      if (!replacement) {
        replacement = buildPlaceholder(widgetTitle);
      }
      cloneWrap.replaceWith(replacement);
    }
  }

  // Clean up hover toolbars
  clone.querySelectorAll('.widget-toolbar, .widget-resize-bar').forEach(el => el.remove());

  // Add header
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
    // 3. Render to canvas
    report('Rendering pages...');
    const canvas = await html2canvas(clone, {
      scale: 2,
      useCORS: true,
      letterRendering: true,
      scrollY: 0,
      width: renderW,
      windowWidth: renderW,
    });

    // 4. Slice into A4 pages
    report('Generating PDF...');
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const imgW = CONTENT_W;
    const imgH = (canvas.height * CONTENT_W) / canvas.width;
    const pageH = CONTENT_H;
    let yOffset = 0;
    let page = 0;

    while (yOffset < imgH) {
      if (page > 0) pdf.addPage();
      const srcY = (yOffset / imgH) * canvas.height;
      const srcH = Math.min((pageH / imgH) * canvas.height, canvas.height - srcY);
      const sliceH = (srcH / canvas.height) * imgH;

      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = Math.round(srcH);
      const ctx = sliceCanvas.getContext('2d');
      ctx.drawImage(canvas, 0, Math.round(srcY), canvas.width, Math.round(srcH), 0, 0, canvas.width, Math.round(srcH));

      const imgData = sliceCanvas.toDataURL('image/jpeg', 0.92);
      pdf.addImage(imgData, 'JPEG', MARGIN, MARGIN, imgW, sliceH);

      // Page number footer
      pdf.setFontSize(8);
      pdf.setTextColor(148, 163, 184);
      pdf.text(`Page ${page + 1}`, A4_W_MM / 2, A4_H_MM - 8, { align: 'center' });

      yOffset += pageH;
      page++;
    }

    // 5. Download
    const filename = (title || 'report')
      .replace(/[^a-zA-Z0-9_\-\s]/g, '')
      .replace(/\s+/g, '-')
      .toLowerCase();
    pdf.save(filename + '.pdf');
    report('Done!');

  } finally {
    document.body.removeChild(clone);
  }
}

// ── Placeholder exports ──
export async function exportToDOCX() { throw new Error('DOCX export coming soon'); }
export async function exportToPPTX() { throw new Error('PPTX export coming soon'); }
