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
/**
 * Export editor content as a PowerPoint presentation.
 *
 * Slide mapping:
 *  - First h1          → title slide (teal bg, white text)
 *  - h2                → section divider slide + new content slide
 *  - hr                → new slide
 *  - p, ul, ol, pre    → content on current slide (auto-overflows to next)
 *  - blockquote        → tinted content block
 *  - widget            → placeholder card
 *
 * @param {HTMLElement} canvasEl – the .editor-canvas element
 * @param {string}      title   – document title
 * @param {function}    onProgress
 */
export async function exportToPPTX(canvasEl, title, onProgress) {
  if (!canvasEl) throw new Error('No editor canvas');
  const report = msg => onProgress?.(msg);

  report('Loading PowerPoint engine\u2026');
  const PptxGenJS = (await import('pptxgenjs')).default;

  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';   // 13.33 x 7.5 in
  pptx.author = 'AI/BI Report Studio';
  pptx.title = title || 'Report';

  // ── Theme ──
  const T = {
    teal: '0F766E', tealDk: '0D5F58', amber: 'F59E0B',
    slate: '1E293B', gray: '64748B', light: 'F1F5F9', white: 'FFFFFF',
  };

  // ── Helpers ──
  const MARGIN = { left: 0.8, top: 1.2, right: 0.8 };
  const BODY_W = 13.33 - MARGIN.left - MARGIN.right;   // ~11.73
  const MAX_Y  = 6.6;  // max y before needing a new slide

  function addBrandFooter(slide) {
    slide.addText('AI/BI Report Studio', {
      x: 0.8, y: 7.0, w: 5, h: 0.35,
      fontSize: 8, color: T.gray, fontFace: 'Arial',
    });
    slide.addText(new Date().toLocaleDateString(), {
      x: 7.5, y: 7.0, w: 5, h: 0.35,
      fontSize: 8, color: T.gray, fontFace: 'Arial', align: 'right',
    });
  }

  function addHeaderBar(slide, sectionTitle) {
    slide.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: 13.33, h: 0.06, fill: { color: T.teal },
    });
    if (sectionTitle) {
      slide.addText(sectionTitle, {
        x: 0.8, y: 0.25, w: 10, h: 0.5,
        fontSize: 11, color: T.gray, fontFace: 'Arial', bold: true,
      });
    }
  }

  /** Extract inline text runs with formatting from an element */
  function extractRuns(el) {
    const runs = [];
    function walk(node, inherited) {
      if (node.nodeType === 3) {
        const text = node.textContent;
        if (text) runs.push({ text, options: { ...inherited } });
        return;
      }
      if (node.nodeType !== 1) return;
      const fmt = { ...inherited };
      const tag = node.tagName?.toLowerCase();
      if (tag === 'strong' || tag === 'b') fmt.bold = true;
      if (tag === 'em' || tag === 'i') fmt.italic = true;
      if (tag === 'u') fmt.underline = true;
      if (tag === 's') fmt.strike = true;
      if (tag === 'code') { fmt.fontFace = 'Courier New'; fmt.fontSize = 11; fmt.color = 'BE123C'; }
      if (tag === 'a') { fmt.color = T.teal; fmt.underline = true; fmt.hyperlink = { url: node.href || '' }; }
      for (const child of node.childNodes) walk(child, fmt);
    }
    walk(el, { fontSize: 13, fontFace: 'Arial', color: T.slate });
    return runs.length ? runs : [{ text: ' ', options: { fontSize: 13 } }];
  }

  // ── Parse editor DOM ──
  report('Building slides\u2026');
  const pm = canvasEl.querySelector('.ProseMirror');
  if (!pm) throw new Error('Editor content not found');

  const nodes = Array.from(pm.children);
  let currentSlide = null;
  let currentY = MARGIN.top;
  let currentSection = '';
  let isFirstH1 = true;

  function needSlide() {
    if (!currentSlide || currentY > MAX_Y) {
      currentSlide = pptx.addSlide();
      addHeaderBar(currentSlide, currentSection);
      addBrandFooter(currentSlide);
      currentY = MARGIN.top;
    }
    return currentSlide;
  }

  function addContentBlock(slide, runs, height, extraOpts) {
    slide.addText(runs, {
      x: MARGIN.left, y: currentY, w: BODY_W, h: height,
      valign: 'top', lineSpacingMultiple: 1.2,
      ...extraOpts,
    });
    currentY += height + 0.1;
  }

  for (const node of nodes) {
    const tag = node.tagName?.toLowerCase();
    if (!tag) continue;

    // ── Title slide (first h1) ──
    if (tag === 'h1' && isFirstH1) {
      isFirstH1 = false;
      const titleSlide = pptx.addSlide();
      titleSlide.addShape(pptx.ShapeType.rect, {
        x: 0, y: 0, w: 13.33, h: 7.5, fill: { color: T.teal },
      });
      titleSlide.addShape(pptx.ShapeType.rect, {
        x: 0, y: 6.9, w: 13.33, h: 0.6, fill: { color: T.tealDk },
      });
      titleSlide.addText(node.textContent, {
        x: 1.2, y: 2.0, w: 10.9, h: 2.0,
        fontSize: 36, fontFace: 'Arial', color: T.white, bold: true,
        lineSpacingMultiple: 1.1,
      });
      titleSlide.addText('AI/BI Report Studio  \u00b7  ' + new Date().toLocaleDateString(), {
        x: 1.2, y: 4.2, w: 10.9, h: 0.5,
        fontSize: 14, fontFace: 'Arial', color: 'A7F3D0',
      });
      currentSlide = null; // force new slide for content
      continue;
    }

    // ── Section divider (h2) ──
    if (tag === 'h2') {
      currentSection = node.textContent;
      const divSlide = pptx.addSlide();
      divSlide.addShape(pptx.ShapeType.rect, {
        x: 0, y: 0, w: 13.33, h: 7.5, fill: { color: T.light },
      });
      divSlide.addShape(pptx.ShapeType.rect, {
        x: 1.0, y: 3.05, w: 2.5, h: 0.06, fill: { color: T.amber },
      });
      divSlide.addText(node.textContent, {
        x: 1.0, y: 3.3, w: 11, h: 1.2,
        fontSize: 28, fontFace: 'Arial', color: T.slate, bold: true,
      });
      addBrandFooter(divSlide);
      currentSlide = null;
      continue;
    }

    // ── Heading 3/4 ──
    if (tag === 'h3' || tag === 'h4') {
      const slide = needSlide();
      const size = tag === 'h3' ? 18 : 15;
      addContentBlock(slide, [{ text: node.textContent, options: {
        fontSize: size, fontFace: 'Arial', color: T.slate, bold: true,
      }}], tag === 'h3' ? 0.55 : 0.45);
      continue;
    }

    // ── Horizontal rule → new slide ──
    if (tag === 'hr') {
      currentSlide = null;
      continue;
    }

    // ── Paragraph ──
    if (tag === 'p') {
      const slide = needSlide();
      const runs = extractRuns(node);
      addContentBlock(slide, runs, 0.45);
      continue;
    }

    // ── Lists (ul/ol) ──
    if (tag === 'ul' || tag === 'ol') {
      const slide = needSlide();
      const items = Array.from(node.querySelectorAll(':scope > li'));
      for (let i = 0; i < items.length; i++) {
        if (currentY > MAX_Y) { currentSlide = null; needSlide(); }
        const runs = extractRuns(items[i]);
        const prefix = tag === 'ul' ? '\u2022 ' : (i + 1) + '. ';
        runs.unshift({ text: prefix, options: { fontSize: 13, fontFace: 'Arial', color: T.slate } });
        addContentBlock(currentSlide, runs, 0.38);
      }
      continue;
    }

    // ── Blockquote ──
    if (tag === 'blockquote') {
      const slide = needSlide();
      const inner = node.querySelector('p') || node;
      const runs = extractRuns(inner);
      slide.addShape(pptx.ShapeType.rect, {
        x: MARGIN.left, y: currentY, w: BODY_W, h: 0.7,
        fill: { color: 'FEF9C3' }, rectRadius: 0.08,
      });
      slide.addShape(pptx.ShapeType.rect, {
        x: MARGIN.left, y: currentY, w: 0.06, h: 0.7,
        fill: { color: T.amber },
      });
      slide.addText(runs, {
        x: MARGIN.left + 0.25, y: currentY, w: BODY_W - 0.35, h: 0.7,
        valign: 'middle', lineSpacingMultiple: 1.15,
      });
      currentY += 0.8;
      continue;
    }

    // ── Code block ──
    if (tag === 'pre') {
      const slide = needSlide();
      const code = node.textContent;
      const lines = code.split('\n').length;
      const h = Math.max(0.6, Math.min(lines * 0.22, 3.0));
      slide.addShape(pptx.ShapeType.rect, {
        x: MARGIN.left, y: currentY, w: BODY_W, h: h,
        fill: { color: T.slate }, rectRadius: 0.1,
      });
      slide.addText(code, {
        x: MARGIN.left + 0.2, y: currentY + 0.1, w: BODY_W - 0.4, h: h - 0.2,
        fontSize: 9, fontFace: 'Courier New', color: 'E2E8F0', valign: 'top',
        lineSpacingMultiple: 1.3,
      });
      currentY += h + 0.15;
      continue;
    }

    // ── Widget ──
    if (node.classList?.contains('widget-wrap') || node.querySelector?.('.widget-wrap')) {
      const slide = needSlide();
      const wTitle = node.querySelector('.widget-toolbar-title')?.textContent || 'Dashboard Widget';
      const h = 2.5;
      slide.addShape(pptx.ShapeType.rect, {
        x: MARGIN.left, y: currentY, w: BODY_W, h: h,
        fill: { color: T.light }, line: { color: 'CBD5E1', width: 1, dashType: 'dash' },
        rectRadius: 0.12,
      });
      slide.addText('\u{1F4CA}', {
        x: MARGIN.left, y: currentY + 0.5, w: BODY_W, h: 0.6,
        fontSize: 28, align: 'center',
      });
      slide.addText(wTitle, {
        x: MARGIN.left + 0.5, y: currentY + 1.2, w: BODY_W - 1, h: 0.4,
        fontSize: 14, fontFace: 'Arial', color: T.slate, bold: true, align: 'center',
      });
      slide.addText('Interactive dashboard widget', {
        x: MARGIN.left + 0.5, y: currentY + 1.6, w: BODY_W - 1, h: 0.3,
        fontSize: 10, fontFace: 'Arial', color: T.gray, align: 'center',
      });
      currentY += h + 0.2;
      continue;
    }
  }

  // Ensure at least one content slide exists
  if (pptx.slides.length === 0) {
    const slide = pptx.addSlide();
    addHeaderBar(slide, '');
    addBrandFooter(slide);
    slide.addText('Empty document', {
      x: 2, y: 3, w: 9, h: 1, fontSize: 18, color: T.gray, align: 'center',
    });
  }

  report('Generating file\u2026');
  const filename = (title || 'report').replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '-').toLowerCase();
  await pptx.writeFile({ fileName: filename + '.pptx' });
  report('');
}
