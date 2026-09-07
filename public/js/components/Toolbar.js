import React, { useCallback, useRef, useState } from 'react';
import htm from 'htm';
import { useI18n } from '../utils/i18n.js';

const html = htm.bind(React.createElement);

function Btn({ label, title, active, disabled, onClick }) {
  return html`
    <button
      type="button"
      className=${`tb-btn ${active ? 'active' : ''}`}
      title=${title || label}
      disabled=${disabled}
      onClick=${onClick}
    >${label}</button>
  `;
}

function Sep() {
  return html`<div className="tb-sep" />`;
}

export function Toolbar({ editor, onOpenWidgetModal }) {
  const { t } = useI18n();
  const [headingOpen, setHeadingOpen] = useState(false);
  const headingRef = useRef(null);
  const d = !editor;

  const currentHeading = editor?.isActive('heading', { level: 1 }) ? 'H1'
    : editor?.isActive('heading', { level: 2 }) ? 'H2'
    : editor?.isActive('heading', { level: 3 }) ? 'H3'
    : 'Text';

  const setHeading = useCallback(level => {
    if (!editor) return;
    if (level === 0) {
      editor.chain().focus().setParagraph().run();
    } else {
      editor.chain().focus().toggleHeading({ level }).run();
    }
    setHeadingOpen(false);
  }, [editor]);

  return html`
    <div className="toolbar">
      <div className="tb-group">
        <div className="tb-dropdown" ref=${headingRef}>
          <button
            type="button"
            className="tb-btn tb-heading-btn"
            disabled=${d}
            onClick=${() => setHeadingOpen(o => !o)}
          >${currentHeading} ${'▾'}</button>
          ${headingOpen ? html`
            <div className="tb-dropdown-menu">
              <button type="button" onClick=${() => setHeading(0)} className=${currentHeading === 'Text' ? 'active' : ''}>Normal text</button>
              <button type="button" onClick=${() => setHeading(1)} className=${currentHeading === 'H1' ? 'active' : ''}><strong style=${{ fontSize: '1.3em' }}>Heading 1</strong></button>
              <button type="button" onClick=${() => setHeading(2)} className=${currentHeading === 'H2' ? 'active' : ''}><strong style=${{ fontSize: '1.1em' }}>Heading 2</strong></button>
              <button type="button" onClick=${() => setHeading(3)} className=${currentHeading === 'H3' ? 'active' : ''}><strong>Heading 3</strong></button>
            </div>
          ` : null}
        </div>
      </div>

      <${Sep} />

      <div className="tb-group">
        <${Btn} label="B" title="Bold" active=${editor?.isActive('bold')} disabled=${d}
          onClick=${() => editor.chain().focus().toggleBold().run()} />
        <${Btn} label="I" title="Italic" active=${editor?.isActive('italic')} disabled=${d}
          onClick=${() => editor.chain().focus().toggleItalic().run()} />
        <${Btn} label="S" title="Strikethrough" active=${editor?.isActive('strike')} disabled=${d}
          onClick=${() => editor.chain().focus().toggleStrike().run()} />
        <${Btn} label="${'</>'}" title="Inline code" active=${editor?.isActive('code')} disabled=${d}
          onClick=${() => editor.chain().focus().toggleCode().run()} />
      </div>

      <${Sep} />

      <div className="tb-group">
        <${Btn} label="${'\u2022'}" title="Bullet list" active=${editor?.isActive('bulletList')} disabled=${d}
          onClick=${() => editor.chain().focus().toggleBulletList().run()} />
        <${Btn} label="1." title="Ordered list" active=${editor?.isActive('orderedList')} disabled=${d}
          onClick=${() => editor.chain().focus().toggleOrderedList().run()} />
      </div>

      <${Sep} />

      <div className="tb-group">
        <${Btn} label="${'\u275D'}" title="Blockquote" active=${editor?.isActive('blockquote')} disabled=${d}
          onClick=${() => editor.chain().focus().toggleBlockquote().run()} />
        <${Btn} label="${'\u2014'}" title="Horizontal rule" disabled=${d}
          onClick=${() => editor.chain().focus().setHorizontalRule().run()} />
        <${Btn} label="${'{ }'}" title="Code block" active=${editor?.isActive('codeBlock')} disabled=${d}
          onClick=${() => editor.chain().focus().toggleCodeBlock().run()} />
      </div>

      <${Sep} />

      <div className="tb-group">
        <${Btn} label="${'\u21A9'}" title="Undo" disabled=${d || !editor?.can().undo()}
          onClick=${() => editor.chain().focus().undo().run()} />
        <${Btn} label="${'\u21AA'}" title="Redo" disabled=${d || !editor?.can().redo()}
          onClick=${() => editor.chain().focus().redo().run()} />
      </div>

      <${Sep} />

      <div className="tb-group">
        <button
          type="button"
          className="tb-btn tb-widget-btn"
          disabled=${d}
          onClick=${onOpenWidgetModal}
          title=${t('insertWidget')}
        >${'+'} Widget</button>
      </div>
    </div>
  `;
}
