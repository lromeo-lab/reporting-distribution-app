import React from 'react';
import htm from 'htm';
import { useI18n } from '../utils/i18n.js';

const html = htm.bind(React.createElement);

function ToolbarButton({ label, onClick, isActive = false, disabled = false }) {
  return html`
    <button
      type="button"
      className=${`toolbar-button ${isActive ? 'is-active' : ''}`}
      onClick=${onClick}
      disabled=${disabled}
    >
      ${label}
    </button>
  `;
}

export function Toolbar({ editor, onOpenWidgetModal }) {
  const { t } = useI18n();
  const disabled = !editor;

  return html`
    <div className="toolbar">
      <div className="toolbar-group">
        <${ToolbarButton}
          label=${t('heading')}
          disabled=${disabled}
          isActive=${editor?.isActive('heading', { level: 1 })}
          onClick=${() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        />
        <${ToolbarButton}
          label=${t('section')}
          disabled=${disabled}
          isActive=${editor?.isActive('heading', { level: 2 })}
          onClick=${() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        />
        <${ToolbarButton}
          label=${t('subsection')}
          disabled=${disabled}
          isActive=${editor?.isActive('heading', { level: 3 })}
          onClick=${() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        />
      </div>

      <div className="toolbar-group">
        <${ToolbarButton}
          label=${t('bold')}
          disabled=${disabled}
          isActive=${editor?.isActive('bold')}
          onClick=${() => editor.chain().focus().toggleBold().run()}
        />
        <${ToolbarButton}
          label=${t('list')}
          disabled=${disabled}
          isActive=${editor?.isActive('bulletList')}
          onClick=${() => editor.chain().focus().toggleBulletList().run()}
        />
        <${ToolbarButton}
          label=${t('quote')}
          disabled=${disabled}
          isActive=${editor?.isActive('blockquote')}
          onClick=${() => editor.chain().focus().toggleBlockquote().run()}
        />
        <${ToolbarButton}
          label=${t('divider')}
          disabled=${disabled}
          onClick=${() => editor.chain().focus().setHorizontalRule().run()}
        />
      </div>

      <div className="toolbar-group">
        <${ToolbarButton}
          label=${t('insertWidget')}
          disabled=${disabled}
          onClick=${onOpenWidgetModal}
        />
      </div>
    </div>
  `;
}
