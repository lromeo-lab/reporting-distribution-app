/**
 * PDF Export — AI/BI Report Studio
 *
 * Uses Paged.js (W3C CSS Paged Media polyfill) for real pagination.
 * No rasterization — text stays vector, page breaks respect content.
 *
 * Flow:
 *  1. Clone the ProseMirror DOM → replace widgets → clean HTML string
 *  2. Fetch Paged.js polyfill from CDN (cached after first load)
 *  3. Build a print document: HTML + @page CSS + inline Paged.js
 *  4. Inject into a hidden iframe via document.write()
 *  5. Paged.js paginates the content respecting break rules
 *  6. Call iframe.contentWindow.print() → browser "Save as PDF"
 *  7. Clean up iframe
 */

const PAGED_JS_URL = 'https://unpkg.com/pagedjs/dist/paged.polyfill.js';
let _pagedJsCode = null;

async function fetchPagedJs() {
  if (_pagedJsCode) return _pagedJsCode;
  const r = await fetch(PAGED_JS_URL);
  if (!r.ok) throw new Error('Failed to load Paged.js from CDN');
  _pagedJsCode = await r.text();
  return _pagedJsCode;
}

/* ── Print stylesheet ── */
const PRINT_CSS = `
@page {
  size: A4;
  margin: 20mm 18mm 25mm 18mm;
}

body {
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  color: #1e293b; line-height: 1.75; font-size: 11pt;
  margin: 0; padding: 0;
}

/* ── Typography ── */
h1 { font-size: 22pt; font-weight: 700; margin: 0 0 10pt; letter-spacing: -0.02em; }
h2 { font-size: 16pt; font-weight: 700; margin: 20pt 0 8pt; letter-spacing: -0.01em; }
h3 { font-size: 13pt; font-weight: 700; margin: 16pt 0 6pt; }
h4 { font-size: 11pt; font-weight: 700; margin: 14pt 0 6pt; }
p  { margin: 0 0 8pt; }
ul, ol { margin: 0 0 8pt; padding-left: 20pt; }
li { margin-bottom: 3pt; }
a { color: #0f766e; text-decoration: underline; }

/* ── Blocks ── */
blockquote {
  margin: 12pt 0; padding: 10pt 16pt;
  border-left: 3pt solid #f59e0b; background: #fefce8;
  border-radius: 0 6pt 6pt 0;
}
pre {
  background: #1e293b; color: #e2e8f0;
  padding: 12pt 16pt; border-radius: 6pt;
  font-family: 'Fira Code', monospace; font-size: 9pt;
  overflow-x: auto; white-space: pre-wrap;
}
code {
  background: #f1f5f9; padding: 1pt 4pt; border-radius: 3pt;
  font-family: 'Fira Code', monospace; font-size: 0.9em; color: #be123c;
}
pre code { background: none; padding: 0; color: inherit; }
hr {
  border: none; height: 1pt; margin: 16pt 0;
  background: linear-gradient(90deg, #f59e0b, #0f766e);
}

/* ── Page break rules — the reason we use Paged.js ── */
h1, h2, h3, h4       { break-after: avoid; }
p, li                 { orphans: 3; widows: 3; }
blockquote, pre,
table, figure         { break-inside: avoid; }
.widget-placeholder   { break-inside: avoid; }

/* ── Widget placeholder ── */
.widget-placeholder {
  border: 1.5pt dashed #cbd5e1; border-radius: 8pt;
  padding: 20pt 16pt; text-align: center;
  background: #f8fafc; margin: 12pt 0;
}
.wp-title { font-size: 11pt; font-weight: 700; color: #334155; margin-bottom: 4pt; }
.wp-desc  { font-size: 9pt; color: #64748b; }

/* ── Document header ── */
.doc-header {
  display: flex; justify-content: space-between;
  font-size: 8pt; color: #94a3b8;
  padding-bottom: 6pt; border-bottom: 0.5pt solid #e2e8f0;
  margin-bottom: 14pt;
}
`;

/**
 * Try to capture a widget screenshot from the server.
 * Returns a base64 data URL on success, null on failure.
 */
async function captureWidget(embedUrl) {
  try {
    const resp = await fetch('/api/proxy/widget-screenshot?url=' + encodeURIComponent(embedUrl));
    if (!resp.ok) {
      console.warn('[export] Screenshot HTTP', resp.status);
      return null;
    }
    const blob = await resp.blob();
    return await new Promise(resolve => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result);
      r.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn('[export] Screenshot error:', err.message);
    return null;
  }
}

/**
 * Extract clean HTML from editor DOM.
 * For each widget: try server screenshot, fallback to text placeholder.
 */
async function extractPrintHtml(canvasEl, onProgress) {
  const pm = canvasEl.querySelector('.ProseMirror');
  if (!pm) throw new Error('ProseMirror content not found');

  const clone = pm.cloneNode(true);
  const wraps = clone.querySelectorAll('.widget-wrap');
  const origWraps = canvasEl.querySelectorAll('.widget-wrap');

  for (let i = 0; i < wraps.length; i++) {
    const wrap = wraps[i];
    const title = wrap.querySelector('.widget-toolbar-title')?.textContent || 'Dashboard Widget';
    const iframe = origWraps[i]?.querySelector('iframe');
    const embedUrl = iframe?.src || '';
    let el;

    if (embedUrl) {
      onProgress?.('Capturing ' + (i+1) + '/' + wraps.length + ': ' + title);
      const dataUrl = await captureWidget(embedUrl);
      if (dataUrl) {
        el = document.createElement('div');
        el.className = 'widget-screenshot';
        const img = document.createElement('img');
        img.src = dataUrl;
        img.alt = title;
        el.appendChild(img);
        const cap = document.createElement('div');
        cap.className = 'ws-caption';
        cap.textContent = title;
        el.appendChild(cap);
      }
    }

    if (!el) {
      el = document.createElement('div');
      el.className = 'widget-placeholder';
      el.innerHTML = '<div class="wp-title">Dashboard Widget: ' + title + '</div>'
        + '<div class="wp-desc">Interactive widget — view online</div>';
    }
    wrap.replaceWith(el);
  }

  clone.querySelectorAll('.widget-toolbar, .widget-resize-bar, .ProseMirror-trailingBreak').forEach(e => e.remove());
  clone.removeAttribute('contenteditable');
  clone.removeAttribute('role');
  clone.classList.remove('ProseMirror');
  return clone.innerHTML;
}

/**
 * Export the editor content as a paginated PDF.
 *
 * @param {HTMLElement} canvasEl   – the .editor-canvas element
 * @param {string}      title     – document title (filename + header)
 * @param {function}    onProgress – optional status callback
 */
export async function exportToPDF(canvasEl, title, onProgress) {
  if (!canvasEl) throw new Error('No editor canvas');
  const report = msg => onProgress?.(msg);

  report('Loading print engine\u2026');
  const pagedJs = await fetchPagedJs();

  report('Preparing document\u2026');
  const html = await extractPrintHtml(canvasEl, report);
  const date = new Date().toLocaleDateString();
  const safeTitle = title || 'Report';

  const printDoc = '<!DOCTYPE html>\n<html>\n<head>\n<meta charset="utf-8">\n'
    + '<title>' + safeTitle + '</title>\n'
    + '<style>' + PRINT_CSS + '</style>\n'
    + '<script>\nwindow.PagedConfig = {\n  auto: true,\n'
    + '  after: function() { document.body.dataset.ready = "1"; }\n};\n<\/script>\n'
    + '<script>' + pagedJs + '<\/script>\n'
    + '</head>\n<body>\n'
    + '<div class="doc-header"><span>AI/BI Report Studio</span><span>' + date + '</span></div>\n'
    + html + '\n</body>\n</html>';

  // Render in hidden iframe
  report('Paginating\u2026');
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:210mm;height:297mm;border:none';
  document.body.appendChild(iframe);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { cleanup(); reject(new Error('Export timed out')); }, 20000);

    function cleanup() {
      clearTimeout(timeout);
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      report('');
    }

    const doc = iframe.contentDocument;
    doc.open();
    doc.write(printDoc);
    doc.close();

    // Poll until Paged.js signals completion
    const poll = setInterval(() => {
      try {
        if (doc.body?.dataset?.ready === '1') {
          clearInterval(poll);
          report('');
          iframe.contentWindow.print();
          // Allow print dialog to open, then clean up
          setTimeout(() => { cleanup(); resolve(); }, 1000);
        }
      } catch (_) { /* iframe access error — ignore */ }
    }, 150);
  });
}

// Stubs
export async function exportToDOCX() { throw new Error('Coming soon'); }
export async function exportToPPTX() { throw new Error('Coming soon'); }
