/**
 * Export utilities for AI/BI Report Studio
 * Converts editor content to PDF, DOCX, PPTX formats.
 */

// ── PDF Export (html2pdf.js) ───────────────────────────────────

/**
 * Export the editor content as a PDF document.
 *
 * Strategy:
 *  1. Clone the editor canvas DOM so the original is untouched
 *  2. In the clone, replace iframes (dashboard widgets) with styled placeholders
 *  3. Run html2pdf.js on the clone (A4, margins, page-break-aware)
 *  4. Trigger download
 *
 * @param {HTMLElement} canvasEl  – the .editor-canvas element
 * @param {string}      title    – document title for filename + header
 * @param {object}      opts     – optional overrides
 */
export async function exportToPDF(canvasEl, title, opts = {}) {
  if (!canvasEl) throw new Error('No editor canvas element provided');

  // html2pdf.js is a CJS module; esm.sh wraps it — the callable may be
  // at .default, .default.default, or at the module root depending on the wrapper.
  const mod = await import('html2pdf.js');
  const html2pdf = typeof mod.default === 'function' ? mod.default
    : typeof mod.default?.default === 'function' ? mod.default.default
    : mod;
  if (typeof html2pdf !== 'function') {
    throw new Error('html2pdf loaded but is not callable: ' + typeof html2pdf);
  }

  // 1. Deep-clone the canvas so we can mutate freely
  const clone = canvasEl.cloneNode(true);
  clone.style.width = '210mm';      // A4 width
  clone.style.padding = '0';
  clone.style.border = 'none';
  clone.style.boxShadow = 'none';
  clone.style.borderRadius = '0';
  clone.style.background = '#ffffff';

  // 2. Replace iframes with placeholders
  const iframes = clone.querySelectorAll('.widget-wrap');
  iframes.forEach(wrap => {
    const titleEl = wrap.querySelector('.widget-toolbar-title');
    const widgetTitle = titleEl?.textContent || 'Dashboard Widget';
    const iframe = wrap.querySelector('iframe');
    const src = iframe?.src || '';

    const placeholder = document.createElement('div');
    placeholder.style.cssText = `
      border: 2px dashed #cbd5e1;
      border-radius: 12px;
      padding: 32px 24px;
      text-align: center;
      background: #f8fafc;
      margin: 16px 0;
      page-break-inside: avoid;
    `;
    placeholder.innerHTML = `
      <div style="font-size: 14px; font-weight: 700; color: #334155; margin-bottom: 8px;">
        📊 ${widgetTitle}
      </div>
      <div style="font-size: 11px; color: #64748b;">
        Interactive dashboard widget — view online
      </div>
      ${src ? `<div style="font-size: 10px; color: #94a3b8; margin-top: 6px; word-break: break-all;">${src.split('?')[0]}</div>` : ''}
    `;
    wrap.replaceWith(placeholder);
  });

  // 3. Remove any hover toolbars, resize bars etc. from clone
  clone.querySelectorAll('.widget-toolbar, .widget-resize-bar').forEach(el => el.remove());

  // 4. Add a title header to the clone
  const header = document.createElement('div');
  header.style.cssText = `
    font-size: 10px; color: #94a3b8; margin-bottom: 16px;
    padding-bottom: 8px; border-bottom: 1px solid #e2e8f0;
    display: flex; justify-content: space-between;
  `;
  header.innerHTML = `
    <span>AI/BI Report Studio</span>
    <span>${new Date().toLocaleDateString()}</span>
  `;
  clone.insertBefore(header, clone.firstChild);

  // 5. Append clone off-screen for rendering
  clone.style.position = 'fixed';
  clone.style.left = '-9999px';
  clone.style.top = '0';
  document.body.appendChild(clone);

  // 6. Generate PDF
  const filename = (title || 'report').replace(/[^a-zA-Z0-9_\-\s]/g, '').replace(/\s+/g, '-').toLowerCase();

  try {
    await html2pdf()
      .set({
        margin:       [15, 15, 20, 15],  // top, left, bottom, right (mm)
        filename:     `${filename}.pdf`,
        image:        { type: 'jpeg', quality: 0.95 },
        html2canvas:  {
          scale: 2,
          useCORS: true,
          letterRendering: true,
          scrollY: 0,
          windowWidth: 794,  // A4 width in px at 96dpi
        },
        jsPDF:        {
          unit: 'mm',
          format: 'a4',
          orientation: 'portrait',
        },
        pagebreak:    {
          mode: ['avoid-all', 'css', 'legacy'],
          before: '.pdf-page-break-before',
          after:  '.pdf-page-break-after',
          avoid:  ['.widget-wrap', 'blockquote', 'pre', 'table', 'h1', 'h2', 'h3', 'h4'],
        },
      })
      .from(clone)
      .save();
  } finally {
    document.body.removeChild(clone);
  }
}


// ── Placeholder exports for future formats ─────────────────────

export async function exportToDOCX(canvasEl, title, opts = {}) {
  // TODO: Implement with `docx` library
  throw new Error('DOCX export coming soon');
}

export async function exportToPPTX(canvasEl, title, opts = {}) {
  // TODO: Implement with `pptxgenjs` library
  throw new Error('PPTX export coming soon');
}

export async function exportToEmail(canvasEl, title, opts = {}) {
  // TODO: Generate inline-styled HTML for email
  throw new Error('Email export coming soon');
}
