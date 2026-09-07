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

function Ico({ d, size }) {
  const s = size || 18;
  return html`<svg width=${s} height=${s} viewBox="0 0 ${s} ${s}" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d=${d} /></svg>`;
}

export function Toolbar({ editor, onOpenWidgetModal, onExport, onShare }) {
  const [headingOpen, setHeadingOpen] = useState(false);
  const ddRef = useRef(null);
  const d = !editor;

  useEffect(() => {
    if (!headingOpen) return;
    const fn = e => { if (ddRef.current && !ddRef.current.contains(e.target)) setHeadingOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [headingOpen]);

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

  const btn = (cls, active, disabled, title, onClick, children) => html`
    <button type="button" className=${`tb ${cls} ${active ? 'on' : ''}`}
      disabled=${disabled} title=${title} onClick=${onClick}>${children}</button>`;

  return html`
    <div className="toolbar-row">
      <div className="toolbar-left">
        <!-- Undo / Redo -->
        ${btn('tb-icon', false, d || !editor?.can().undo(), 'Undo', () => editor.chain().focus().undo().run(),
          html`<${Ico} d="M4 7h8a3.5 3.5 0 0 1 0 7H9" /><path d="M7 4L4 7l3 3" stroke="currentColor" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />`)}
        ${btn('tb-icon', false, d || !editor?.can().redo(), 'Redo', () => editor.chain().focus().redo().run(),
          html`<${Ico} d="M14 7H6a3.5 3.5 0 0 0 0 7h3" /><path d="M11 4l3 3-3 3" stroke="currentColor" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />`)}

        <div className="tb-div" />

        <!-- Heading dropdown -->
        <div className="tb-dd" ref=${ddRef}>
          <button type="button" className="tb-dd-trigger" disabled=${d}
            onClick=${() => setHeadingOpen(v => !v)}>
            ${currentLabel}
            <svg width="8" height="5" viewBox="0 0 8 5"><path d="M1 1l3 3 3-3" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" /></svg>
          </button>
          ${headingOpen ? html`
            <div className="tb-dd-menu">
              ${HEADING_OPTIONS.map(o => html`
                <button key=${o.level} type="button"
                  className=${`tb-dd-item ${o.level === currentLevel ? 'active' : ''}`}
                  onClick=${() => setHeading(o.level)}>
                  ${o.level === currentLevel ? html`<span className="tb-dd-check">\u2713</span>` : html`<span className="tb-dd-check" />`}
                  <span className=${o.cls}>${o.label}</span>
                </button>
              `)}
            </div>
          ` : null}
        </div>

        <div className="tb-div" />

        <!-- Text formatting: B U I <> S -->
        ${btn('tb-fmt tb-b', editor?.isActive('bold'), d, 'Bold', () => editor.chain().focus().toggleBold().run(), 'B')}
        ${btn('tb-fmt tb-u', editor?.isActive('underline'), d, 'Underline', () => editor.chain().focus().toggleUnderline().run(), 'U')}
        ${btn('tb-fmt tb-i', editor?.isActive('italic'), d, 'Italic', () => editor.chain().focus().toggleItalic().run(), 'I')}
        ${btn('tb-fmt tb-code', editor?.isActive('code'), d, 'Code', () => editor.chain().focus().toggleCode().run(), html`<span>${'<>'}</span>`)}
        ${btn('tb-fmt tb-s', editor?.isActive('strike'), d, 'Strikethrough', () => editor.chain().focus().toggleStrike().run(), 'S')}

        <div className="tb-div" />

        <!-- Blockquote -->
        ${btn('tb-icon', editor?.isActive('blockquote'), d, 'Quote', () => editor.chain().focus().toggleBlockquote().run(),
          html`<${Ico} d="M3 5h3v3H4.5L3 11 M10 5h3v3h-1.5L10 11" />`)}

        <div className="tb-div" />

        <!-- Lists -->
        ${btn('tb-icon', editor?.isActive('bulletList'), d, 'Bullet list', () => editor.chain().focus().toggleBulletList().run(),
          html`<${Ico} d="M7 5h8M7 9h8M7 13h8" /><circle cx="3.5" cy="5" r="1.2" fill="currentColor" stroke="none" /><circle cx="3.5" cy="9" r="1.2" fill="currentColor" stroke="none" /><circle cx="3.5" cy="13" r="1.2" fill="currentColor" stroke="none" />`)}
        ${btn('tb-icon', editor?.isActive('orderedList'), d, 'Numbered list', () => editor.chain().focus().toggleOrderedList().run(),
          html`<${Ico} d="M8 5h7M8 9h7M8 13h7" /><text x="2" y="6.5" fontSize="5.5" fill="currentColor" stroke="none" fontWeight="600" fontFamily="system-ui">1</text><text x="2" y="10.5" fontSize="5.5" fill="currentColor" stroke="none" fontWeight="600" fontFamily="system-ui">2</text><text x="2" y="14.5" fontSize="5.5" fill="currentColor" stroke="none" fontWeight="600" fontFamily="system-ui">3</text>`)}

        <div className="tb-div" />

        <!-- Link (placeholder) -->
        ${btn('tb-icon', false, d, 'Insert link (coming soon)', () => {}, html`<${Ico} d="M8 12H6a3 3 0 0 1 0-6h2M10 6h2a3 3 0 0 1 0 6h-2M6.5 9h5" />`)}
        <!-- Horizontal rule -->
        ${btn('tb-icon', false, d, 'Divider', () => editor.chain().focus().setHorizontalRule().run(),
          html`<${Ico} d="M3 9h12" />`)}
        <!-- Code block -->
        ${btn('tb-icon', editor?.isActive('codeBlock'), d, 'Code block', () => editor.chain().focus().toggleCodeBlock().run(),
          html`<${Ico} d="M6 4L2 9l4 5M12 4l4 5-4 5" />`)}

        <div className="tb-div" />

        <!-- Widget -->
        <button type="button" className="tb tb-widget" disabled=${d} onClick=${onOpenWidgetModal}>
          <svg width="14" height="14" viewBox="0 0 14 14"><line x1="7" y1="2" x2="7" y2="12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><line x1="2" y1="7" x2="12" y2="7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
          Widget
        </button>
      </div>

      <div className="toolbar-right">
        <button type="button" className="tb-action" onClick=${onExport || (() => {})}>
          Export
          <svg width="8" height="5" viewBox="0 0 8 5"><path d="M1 1l3 3 3-3" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" /></svg>
        </button>
        <button type="button" className="tb-action tb-share" onClick=${onShare || (() => {})}>Share</button>
      </div>
    </div>
  `;
}
