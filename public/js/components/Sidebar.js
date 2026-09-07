import React from 'react';
import htm from 'htm';

const html = htm.bind(React.createElement);

export function Sidebar({ documents, activeDocId, onSelectDoc, onNewDoc, onDeleteDoc, collapsed }) {
  if (collapsed) return null;

  return html`
    <aside className="sidebar">
      <div className="sidebar-brand">AI/BI Report Studio</div>
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
              <span className="sidebar-doc-title">${doc.title || doc.id}</span>
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
          <div className="sidebar-empty">No reports yet.<br/>Click + to create one.</div>
        ` : null}
      </div>
    </aside>
  `;
}

function formatTime(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  const d = Math.floor(h / 24);
  if (d < 7) return d + 'd ago';
  return new Date(iso).toLocaleDateString();
}
