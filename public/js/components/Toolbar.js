import React, { useCallback, useEffect, useRef, useState } from 'react';
import htm from 'htm';

const html = htm.bind(React.createElement);

const HEADING_OPTIONS = [
  { level: 0, label: 'Normal text', tag: 'p' },
  { level: 1, label: 'Title', tag: 'h1' },
  { level: 2, label: 'Heading', tag: 'h2' },
  { level: 3, label: 'Subheading', tag: 'h3' },
];

export function Toolbar({ editor, onOpenWidgetModal }) {
  const [headingOpen, setHeadingOpen] = useState(false);
  const dropdownRef = useRef(null);
  const d = !editor;

  // Close dropdown on click outside
  useEffect(() => {
    if (!headingOpen) return;
    const handler = e => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setHeadingOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [headingOpen]);

  const currentLabel = editor?.isActive('heading', { level: 1 }) ? 'Title'
    : editor?.isActive('heading', { level: 2 }) ? 'Heading'
    : editor?.isActive('heading', { level: 3 }) ? 'Subheading'
    : 'Normal text';

  const setHeading = useCallback(level => {
    if (!editor) return;
    if (level === 0) editor.chain().focus().setParagraph().run();
    else editor.chain().focus().toggleHeading({ level }).run();
    setHeadingOpen(false);
  }, [editor]);

  return html`
    <div className="toolbar">

      <!-- Heading dropdown -->
      <div className="tb-dropdown" ref=${dropdownRef}>
        <button type="button" className="tb-heading-trigger" disabled=${d}
          onClick=${() => setHeadingOpen(o => !o)}>
          <span>${currentLabel}</span>
          <svg width="10" height="6" viewBox="0 0 10 6"><path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>
        </button>
        ${headingOpen ? html`
          <div className="tb-dropdown-panel">
            ${HEADING_OPTIONS.map(opt => html`
              <button key=${opt.level} type="button"
                className=${`tb-dd-option ${currentLabel === opt.label ? 'active' : ''}`}
                onClick=${() => setHeading(opt.level)}>
                <span className=${`tb-dd-preview tb-dd-${opt.tag}`}>${opt.label}</span>
              </button>
            `)}
          </div>
        ` : null}
      </div>

      <div className="tb-divider" />

      <!-- Text formatting -->
      <div className="tb-group">
        <button type="button" className=${`tb-fmt tb-bold ${editor?.isActive('bold') ? 'on' : ''}`}
          disabled=${d} title="Bold (Ctrl+B)"
          onClick=${() => editor.chain().focus().toggleBold().run()}>B</button>
        <button type="button" className=${`tb-fmt tb-italic ${editor?.isActive('italic') ? 'on' : ''}`}
          disabled=${d} title="Italic (Ctrl+I)"
          onClick=${() => editor.chain().focus().toggleItalic().run()}>I</button>
        <button type="button" className=${`tb-fmt tb-strike ${editor?.isActive('strike') ? 'on' : ''}`}
          disabled=${d} title="Strikethrough"
          onClick=${() => editor.chain().focus().toggleStrike().run()}>S</button>
        <button type="button" className=${`tb-fmt tb-code-inline ${editor?.isActive('code') ? 'on' : ''}`}
          disabled=${d} title="Inline code"
          onClick=${() => editor.chain().focus().toggleCode().run()}>code</button>
      </div>

      <div className="tb-divider" />

      <!-- Lists -->
      <div className="tb-group">
        <button type="button" className=${`tb-icon ${editor?.isActive('bulletList') ? 'on' : ''}`}
          disabled=${d} title="Bullet list"
          onClick=${() => editor.chain().focus().toggleBulletList().run()}>
          <svg width="16" height="16" viewBox="0 0 16 16"><circle cx="3" cy="4" r="1.5" fill="currentColor"/><line x1="7" y1="4" x2="14" y2="4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="3" cy="8" r="1.5" fill="currentColor"/><line x1="7" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="3" cy="12" r="1.5" fill="currentColor"/><line x1="7" y1="12" x2="14" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </button>
        <button type="button" className=${`tb-icon ${editor?.isActive('orderedList') ? 'on' : ''}`}
          disabled=${d} title="Numbered list"
          onClick=${() => editor.chain().focus().toggleOrderedList().run()}>
          <svg width="16" height="16" viewBox="0 0 16 16"><text x="1" y="5.5" fontSize="5.5" fill="currentColor" fontFamily="system-ui" fontWeight="600">1</text><line x1="7" y1="4" x2="14" y2="4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><text x="1" y="9.5" fontSize="5.5" fill="currentColor" fontFamily="system-ui" fontWeight="600">2</text><line x1="7" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><text x="1" y="13.5" fontSize="5.5" fill="currentColor" fontFamily="system-ui" fontWeight="600">3</text><line x1="7" y1="12" x2="14" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </button>
      </div>

      <div className="tb-divider" />

      <!-- Block formatting -->
      <div className="tb-group">
        <button type="button" className=${`tb-icon ${editor?.isActive('blockquote') ? 'on' : ''}`}
          disabled=${d} title="Quote"
          onClick=${() => editor.chain().focus().toggleBlockquote().run()}>
          <svg width="16" height="16" viewBox="0 0 16 16"><path d="M3 4h2.5c.8 0 1.5.7 1.5 1.5v2c0 .8-.7 1.5-1.5 1.5H4L3 12" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/><path d="M9 4h2.5c.8 0 1.5.7 1.5 1.5v2c0 .8-.7 1.5-1.5 1.5H10L9 12" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <button type="button" className="tb-icon"
          disabled=${d} title="Divider"
          onClick=${() => editor.chain().focus().setHorizontalRule().run()}>
          <svg width="16" height="16" viewBox="0 0 16 16"><line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
        </button>
        <button type="button" className=${`tb-icon ${editor?.isActive('codeBlock') ? 'on' : ''}`}
          disabled=${d} title="Code block"
          onClick=${() => editor.chain().focus().toggleCodeBlock().run()}>
          <svg width="16" height="16" viewBox="0 0 16 16"><polyline points="5,3 1,8 5,13" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/><polyline points="11,3 15,8 11,13" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>

      <div className="tb-divider" />

      <!-- Undo / Redo -->
      <div className="tb-group">
        <button type="button" className="tb-icon"
          disabled=${d || !editor?.can().undo()} title="Undo (Ctrl+Z)"
          onClick=${() => editor.chain().focus().undo().run()}>
          <svg width="16" height="16" viewBox="0 0 16 16"><path d="M4 6h6a3 3 0 0 1 0 6H8" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/><polyline points="6,4 4,6 6,8" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <button type="button" className="tb-icon"
          disabled=${d || !editor?.can().redo()} title="Redo (Ctrl+Shift+Z)"
          onClick=${() => editor.chain().focus().redo().run()}>
          <svg width="16" height="16" viewBox="0 0 16 16"><path d="M12 6H6a3 3 0 0 0 0 6h2" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/><polyline points="10,4 12,6 10,8" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>

      <div className="tb-divider" />

      <!-- Insert widget -->
      <button type="button" className="tb-widget" disabled=${d}
        onClick=${onOpenWidgetModal}>
        <svg width="14" height="14" viewBox="0 0 14 14"><line x1="7" y1="2" x2="7" y2="12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><line x1="2" y1="7" x2="12" y2="7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
        Widget
      </button>
    </div>
  `;
}
