import React, { useCallback, useEffect, useRef, useState } from 'react';
import htm from 'htm';

const html = htm.bind(React.createElement);

const HEADING_OPTIONS = [
  { level: 1, label: 'Title',       cls: 'dd-title' },
  { level: 2, label: 'Subtitle',    cls: 'dd-subtitle' },
  { level: 3, label: 'Heading 1',   cls: 'dd-h1' },
  { level: 4, label: 'Heading 2',   cls: 'dd-h2' },
  { level: 0, label: 'Normal text', cls: 'dd-normal' },
];

/* SVG icons — only path/line/circle (no <text>, htm can't render it) */
const I_UNDO = html`<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M4 7h8a3.5 3.5 0 0 1 0 7H9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/><path d="M7 4L4 7l3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>`;
const I_REDO = html`<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M14 7H6a3.5 3.5 0 0 0 0 7h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/><path d="M11 4l3 3-3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>`;
const I_QUOTE = html`<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M4 4v10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/><path d="M8 6h7M8 9h5M8 12h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>`;
const I_UL = html`<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="4" cy="5" r="1.4" fill="currentColor"/><line x1="8" y1="5" x2="15" y2="5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="4" cy="9" r="1.4" fill="currentColor"/><line x1="8" y1="9" x2="15" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="4" cy="13" r="1.4" fill="currentColor"/><line x1="8" y1="13" x2="15" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>`;
const I_OL = html`<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><line x1="2.5" y1="5" x2="5" y2="5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><line x1="8" y1="5" x2="15" y2="5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="2.5" y1="9" x2="5" y2="9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><line x1="8" y1="9" x2="15" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="2.5" y1="13" x2="5" y2="13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><line x1="8" y1="13" x2="15" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>`;
const I_LINK = html`<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M7.5 10.5l3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M6 12l-1.2 1.2a2.1 2.1 0 0 1-3-3L4.5 7.5a2.1 2.1 0 0 1 3 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M12 6l1.2-1.2a2.1 2.1 0 0 0-3-3L7.5 4.5a2.1 2.1 0 0 0 0 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>`;
const I_HR = html`<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><line x1="3" y1="9" x2="15" y2="9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>`;
const I_CODEBLOCK = html`<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M5.5 4L2 9l3.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M12.5 4L16 9l-3.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><line x1="7" y1="9" x2="11" y2="9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>`;
const I_PLUS = html`<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><line x1="7" y1="2" x2="7" y2="12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><line x1="2" y1="7" x2="12" y2="7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>`;
const I_CHEV = html`<svg width="8" height="5" viewBox="0 0 8 5"><path d="M1 1l3 3 3-3" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round"/></svg>`;

const I_PDF  = html`<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 1h5l4 4v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.3"/><path d="M9 1v4h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>`;
const I_DOC  = html`<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 1h5l4 4v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.3"/><path d="M6 8h4M6 10.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>`;
const I_PPTX = html`<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><line x1="5" y1="14" x2="11" y2="14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><line x1="8" y1="12" x2="8" y2="14" stroke="currentColor" strokeWidth="1.3"/></svg>`;

export function Toolbar({ editor, onOpenWidgetModal, onExportPDF, onExportPPTX }) {
  const [headingOpen, setHeadingOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const ddRef = useRef(null);
  const exRef = useRef(null);
  const off = !editor;

  // Close heading dropdown on outside click
  useEffect(() => {
    if (!headingOpen) return;
    const fn = e => { if (ddRef.current && !ddRef.current.contains(e.target)) setHeadingOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [headingOpen]);

  // Close export dropdown on outside click
  useEffect(() => {
    if (!exportOpen) return;
    const fn = e => { if (exRef.current && !exRef.current.contains(e.target)) setExportOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [exportOpen]);

  const currentLevel = editor?.isActive('heading', { level: 1 }) ? 1
    : editor?.isActive('heading', { level: 2 }) ? 2
    : editor?.isActive('heading', { level: 3 }) ? 3
    : editor?.isActive('heading', { level: 4 }) ? 4 : 0;
  const currentLabel = HEADING_OPTIONS.find(o => o.level === currentLevel)?.label || 'Normal text';

  const setHeading = useCallback(level => {
    if (!editor) return;
    if (level === 0) editor.chain().focus().setParagraph().run();
    else editor.chain().focus().toggleHeading({ level }).run();
    setHeadingOpen(false);
  }, [editor]);

  const insertLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes('link').href || '';
    const url = window.prompt('URL', prev);
    if (url === null) return;
    if (url === '') { editor.chain().focus().unsetLink().run(); return; }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  const tb = (cls, active, disabled, title, onClick, children) => html`
    <button type="button" className=${`tb ${cls} ${active ? 'on' : ''}`}
      disabled=${disabled} title=${title} onClick=${onClick}>${children}</button>`;

  return html`
    <div className="toolbar-row">
      <div className="toolbar-left">
        ${tb('tb-icon', false, off || !editor?.can().undo(), 'Undo', () => editor.chain().focus().undo().run(), I_UNDO)}
        ${tb('tb-icon', false, off || !editor?.can().redo(), 'Redo', () => editor.chain().focus().redo().run(), I_REDO)}

        <div className="tb-div" />

        <div className="tb-dd" ref=${ddRef}>
          <button type="button" className="tb-dd-trigger" disabled=${off}
            onClick=${() => setHeadingOpen(v => !v)}>
            ${currentLabel} ${I_CHEV}
          </button>
          ${headingOpen && html`
            <div className="tb-dd-menu">
              ${HEADING_OPTIONS.map(o => html`
                <button key=${o.level} type="button"
                  className=${`tb-dd-item ${o.level === currentLevel ? 'active' : ''}`}
                  onClick=${() => setHeading(o.level)}>
                  ${o.level === currentLevel
                    ? html`<span className="tb-dd-check">${'\u2713'}</span>`
                    : html`<span className="tb-dd-check" />`}
                  <span className=${o.cls}>${o.label}</span>
                </button>
              `)}
            </div>
          `}
        </div>

        <div className="tb-div" />

        ${tb('tb-fmt tb-b', editor?.isActive('bold'), off, 'Bold (Ctrl+B)', () => editor.chain().focus().toggleBold().run(), 'B')}
        ${tb('tb-fmt tb-u', editor?.isActive('underline'), off, 'Underline (Ctrl+U)', () => editor.chain().focus().toggleUnderline().run(), 'U')}
        ${tb('tb-fmt tb-i', editor?.isActive('italic'), off, 'Italic (Ctrl+I)', () => editor.chain().focus().toggleItalic().run(), 'I')}
        ${tb('tb-fmt tb-code', editor?.isActive('code'), off, 'Inline code', () => editor.chain().focus().toggleCode().run(), html`<span>${'<>'}</span>`)}
        ${tb('tb-fmt tb-s', editor?.isActive('strike'), off, 'Strikethrough', () => editor.chain().focus().toggleStrike().run(), 'S')}

        <div className="tb-div" />

        ${tb('tb-icon', editor?.isActive('blockquote'), off, 'Quote', () => editor.chain().focus().toggleBlockquote().run(), I_QUOTE)}

        <div className="tb-div" />

        ${tb('tb-icon', editor?.isActive('bulletList'), off, 'Bullet list', () => editor.chain().focus().toggleBulletList().run(), I_UL)}
        ${tb('tb-icon', editor?.isActive('orderedList'), off, 'Numbered list', () => editor.chain().focus().toggleOrderedList().run(), I_OL)}

        <div className="tb-div" />

        ${tb('tb-icon', editor?.isActive('link'), off, 'Insert link', insertLink, I_LINK)}
        ${tb('tb-icon', false, off, 'Divider', () => editor.chain().focus().setHorizontalRule().run(), I_HR)}
        ${tb('tb-icon', editor?.isActive('codeBlock'), off, 'Code block', () => editor.chain().focus().toggleCodeBlock().run(), I_CODEBLOCK)}

        <div className="tb-div" />

        <button type="button" className="tb tb-widget" disabled=${off} onClick=${onOpenWidgetModal}>
          ${I_PLUS} Widget
        </button>
      </div>

      <div className="toolbar-right">
        <div className="tb-dd" ref=${exRef}>
          <button type="button" className="tb-action" onClick=${() => setExportOpen(v => !v)}>
            Export ${I_CHEV}
          </button>
          ${exportOpen && html`
            <div className="tb-dd-menu tb-dd-menu-right">
              <button type="button" className="tb-export-item"
                onClick=${() => { setExportOpen(false); onExportPDF && onExportPDF(); }}>
                ${I_PDF}
                <div className="tb-export-info">
                  <span className="tb-export-label">PDF Document</span>
                  <span className="tb-export-desc">A4 format, print-ready</span>
                </div>
              </button>
              <button type="button" className="tb-export-item disabled" disabled>
                ${I_DOC}
                <div className="tb-export-info">
                  <span className="tb-export-label">Word Document</span>
                  <span className="tb-export-desc">Coming soon</span>
                </div>
              </button>
              <button type="button" className="tb-export-item"
                onClick=${() => { setExportOpen(false); onExportPPTX && onExportPPTX(); }}>
                ${I_PPTX}
                <div className="tb-export-info">
                  <span className="tb-export-label">PowerPoint</span>
                  <span className="tb-export-desc">Widescreen slides (.pptx)</span>
                </div>
              </button>
            </div>
          `}
        </div>
        <button type="button" className="tb-action tb-share" onClick=${() => {}}>Share</button>
      </div>
    </div>
  `;
}
