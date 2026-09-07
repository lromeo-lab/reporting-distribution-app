import React from 'react';
import htm from 'htm';
import { useI18n } from '../utils/i18n.js';

const html = htm.bind(React.createElement);

export function Sidebar({ documents, activeDocId, onSelectDoc, onNewDoc, onDeleteDoc, collapsed, onToggleCollapse }) {
  const { t } = useI18n();

  if (collapsed) return null;

  return html`
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">Reports</span>
        <button className="sidebar-new-btn" onClick=${onNewDoc} title="New report">+</button>
      </div>
      <div className="sidebar-list">
        ${documents.map(doc => html`
          <button
            key=${doc.id}
            type="button"
            className=${`sidebar-doc ${doc.id === activeDocId ? 'active' : ''}`}
            onClick=${() => onSelectDoc(doc.id)}
          >
            <div className="sidebar-doc-icon">${'\u{1F4C4}'}</div>
            <div className="sidebar-doc-info">
              <span className="sidebar-doc-title">${doc.title || doc.id}</span>
              <span className="sidebar-doc-time">${formatRelativeTime(doc.updatedAt)}</span>
            </div>
            ${doc.id !== activeDocId ? html`
              <button
                className="sidebar-doc-delete"
                onClick=${e => { e.stopPropagation(); onDeleteDoc(doc.id); }}
                title="Delete"
              >${'\u2715'}</button>
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

function formatRelativeTime(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  const days = Math.floor(hrs / 24);
  if (days < 7) return days + 'd ago';
  return new Date(iso).toLocaleDateString();
}
