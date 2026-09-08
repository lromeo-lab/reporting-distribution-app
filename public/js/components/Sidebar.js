import React, { useState, useCallback, useRef, useEffect } from 'react';
import htm from 'htm';

const html = htm.bind(React.createElement);

const I_COLLAPSE = html`<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>`;
const I_EXPAND  = html`<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><line x1="3" y1="5" x2="15" y2="5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/><line x1="3" y1="9" x2="15" y2="9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/><line x1="3" y1="13" x2="15" y2="13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>`;

function EditableTitle({ docId, title, onRename }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title || docId);
  const inputRef = useRef(null);

  useEffect(() => { setValue(title || docId); }, [title, docId]);
  useEffect(() => { if (editing && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); } }, [editing]);

  const commit = useCallback(() => {
    setEditing(false);
    const trimmed = value.trim();
    if (trimmed && trimmed !== (title || docId)) {
      onRename(docId, trimmed);
    }
  }, [value, title, docId, onRename]);

  if (editing) {
    return html`<input ref=${inputRef} className="sidebar-doc-rename"
      value=${value} onChange=${e => setValue(e.target.value)}
      onBlur=${commit}
      onKeyDown=${e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
    />`;
  }
  return html`<span className="sidebar-doc-title" onDblClick=${() => setEditing(true)}>${title || docId}</span>`;
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
  return d.toLocaleDateString();
}

export function Sidebar({ documents, activeDocId, onSelectDoc, onNewDoc, onDeleteDoc, onRenameDoc, collapsed, onToggleCollapse }) {
  if (collapsed) return html`
    <aside className="sidebar sidebar-thin">
      <button className="sidebar-expand" onClick=${onToggleCollapse} title="Open sidebar">${I_EXPAND}</button>
    </aside>
  `;

  return html`
    <aside className="sidebar">
      <div className="sidebar-brand-row">
        <span className="sidebar-brand">AI/BI Report Studio</span>
        <button className="sidebar-collapse" onClick=${onToggleCollapse} title="Close sidebar">${I_COLLAPSE}</button>
      </div>
      <div className="sidebar-header">
        <span className="sidebar-title">Reports</span>
        <button className="sidebar-new-btn" onClick=${onNewDoc} title="New report">+</button>
      </div>
      <div className="sidebar-list">
        ${documents.map(doc => html`
          <button key=${doc.id} type="button"
            className=${`sidebar-doc ${doc.id === activeDocId ? 'active' : ''}`}
            onClick=${() => onSelectDoc(doc.id)}>
            <div className="sidebar-doc-icon">${'\u{1F4C4}'}</div>
            <div className="sidebar-doc-info">
              <${EditableTitle} docId=${doc.id} title=${doc.title} onRename=${onRenameDoc} />
              <span className="sidebar-doc-time">${formatTime(doc.updatedAt)}</span>
            </div>
            ${doc.id !== activeDocId ? html`
              <button className="sidebar-doc-delete"
                onClick=${e => { e.stopPropagation(); onDeleteDoc(doc.id); }}
                title="Delete">${'\u2715'}</button>
            ` : null}
          </button>
        `)}
        ${documents.length === 0 ? html`
          <div className="sidebar-empty">No reports yet. Click + to create one.</div>
        ` : null}
      </div>
    </aside>
  `;
}
