import React from 'react';
import htm from 'htm';

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
  const disabled = !editor;

  return html`
    <div className="toolbar">
      <div className="toolbar-group">
        <${ToolbarButton}
          label="Título"
          disabled=${disabled}
          isActive=${editor?.isActive('heading', { level: 1 })}
          onClick=${() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        />
        <${ToolbarButton}
          label="Sección"
          disabled=${disabled}
          isActive=${editor?.isActive('heading', { level: 2 })}
          onClick=${() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        />
        <${ToolbarButton}
          label="Subsección"
          disabled=${disabled}
          isActive=${editor?.isActive('heading', { level: 3 })}
          onClick=${() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        />
      </div>

      <div className="toolbar-group">
        <${ToolbarButton}
          label="Negrita"
          disabled=${disabled}
          isActive=${editor?.isActive('bold')}
          onClick=${() => editor.chain().focus().toggleBold().run()}
        />
        <${ToolbarButton}
          label="Lista"
          disabled=${disabled}
          isActive=${editor?.isActive('bulletList')}
          onClick=${() => editor.chain().focus().toggleBulletList().run()}
        />
        <${ToolbarButton}
          label="Cita"
          disabled=${disabled}
          isActive=${editor?.isActive('blockquote')}
          onClick=${() => editor.chain().focus().toggleBlockquote().run()}
        />
        <${ToolbarButton}
          label="Divisor"
          disabled=${disabled}
          onClick=${() => editor.chain().focus().setHorizontalRule().run()}
        />
      </div>

      <div className="toolbar-group">
        <${ToolbarButton}
          label="Insertar widget"
          disabled=${disabled}
          onClick=${onOpenWidgetModal}
        />
      </div>
    </div>
  `;
}
