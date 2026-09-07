import React from 'react';
import htm from 'htm';

const html = htm.bind(React.createElement);

const I_COLLAPSE = html`<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>`;
const I_EXPAND  = html`<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><line x1="3" y1="5" x2="15" y2="5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/><line x1="3" y1="9" x2="15" y2="9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/><line x1="3" y1="13" x2="15" y2="13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>`;

export function Sidebar({ documents, activeDocId, onSelectDoc, onNewDoc, onDeleteDoc, collapsed, onToggleCollapse }) {
  // Collapsed: show thin strip with expand button
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
