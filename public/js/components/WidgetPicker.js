import React, { useCallback, useEffect, useState, useRef } from 'react';
import htm from 'htm';
import { useI18n } from '../utils/i18n.js';
import { fetchDashboards, fetchProxyConfig } from '../utils/api.js';

const html = htm.bind(React.createElement);

/**
 * WidgetPicker — two-step flow:
 *  1. Dashboard list (browse available dashboards)
 *  2. Full dashboard embed (live iframe) + drop zone for PNG capture
 *
 * The user navigates the dashboard in the iframe, downloads a widget as PNG
 * using the built-in Databricks ⋯ → Download as PNG, then drags the file
 * from Chrome's download bar onto the drop zone. The image is read as base64
 * and passed to onSelect for insertion into the editor.
 */
export function WidgetPicker({ onSelect, onClose }) {
  const { t } = useI18n();
  const [step, setStep] = useState('dashboards');
  const [dashboards, setDashboards] = useState([]);
  const [selectedDashboard, setSelectedDashboard] = useState(null);
  const [embedUrl, setEmbedUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [capturedName, setCapturedName] = useState('');
  const dropRef = useRef(null);

  // Load dashboard list
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchDashboards()
      .then(data => { if (!cancelled) { setDashboards(data.dashboards || []); setLoading(false); } })
      .catch(err => { if (!cancelled) { setError(err.message); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  // Build embed URL when dashboard is selected
  const handleSelectDashboard = useCallback(async (dashboard) => {
    setSelectedDashboard(dashboard);
    setStep('capture');
    setCapturedImage(null);
    setCapturedName('');
    try {
      const config = await fetchProxyConfig();
      const url = config.host + '/embed/dashboardsv3/' + dashboard.id + '?o=' + (config.workspaceId || '');
      setEmbedUrl(url);
    } catch (err) {
      setError('Failed to build embed URL: ' + err.message);
    }
  }, []);

  // ── File reading helper ──
  const readImageFile = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCapturedImage(reader.result);
      setCapturedName(file.name.replace(/\.[^.]+$/, ''));
    };
    reader.readAsDataURL(file);
  }, []);

  // ── Drop zone handlers ──
  const onDragOver = useCallback(e => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }, []);
  const onDragLeave = useCallback(e => { e.preventDefault(); e.stopPropagation(); setDragOver(false); }, []);
  const onDrop = useCallback(e => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    readImageFile(file);
  }, [readImageFile]);

  // ── Paste handler (Ctrl+V) ──
  useEffect(() => {
    if (step !== 'capture') return;
    const handler = e => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          readImageFile(item.getAsFile());
          return;
        }
      }
    };
    window.addEventListener('paste', handler);
    return () => window.removeEventListener('paste', handler);
  }, [step, readImageFile]);

  // ── Insert captured image ──
  const handleInsert = useCallback(() => {
    if (!capturedImage) return;
    onSelect({
      imageData: capturedImage,
      title: capturedName || selectedDashboard?.name || 'Widget',
      caption: selectedDashboard?.name || '',
    });
  }, [capturedImage, capturedName, selectedDashboard, onSelect]);

  const handleBack = useCallback(() => {
    setStep('dashboards');
    setSelectedDashboard(null);
    setEmbedUrl('');
    setCapturedImage(null);
    setCapturedName('');
  }, []);

  return html`
    <div className="modal-backdrop" onClick=${onClose}>
      <div className=${`modal-card picker-modal ${step === 'capture' ? 'picker-wide' : ''}`}
           onClick=${e => e.stopPropagation()}>

        ${step === 'dashboards' ? html`
          <div className="picker-header">
            <h3>${t('browseDashboards')}</h3>
            <p>${t('selectDashboard')}</p>
          </div>
          <div className="picker-body">
            ${loading ? html`<div className="picker-loading">${t('loadingDashboards')}</div>` : null}
            ${error ? html`<div className="error-banner">${error}</div>` : null}
            ${!loading && !error && dashboards.length === 0
              ? html`<div className="picker-empty">${t('noDashboards')}</div>` : null}
            ${!loading && dashboards.length > 0 ? html`
              <div className="picker-list">
                ${dashboards.map(d => html`
                  <button key=${d.id} type="button" className="picker-item"
                    onClick=${() => handleSelectDashboard(d)}>
                    <div className="picker-item-icon">📋</div>
                    <div className="picker-item-info">
                      <strong>${d.name}</strong>
                      <span>${d.path || ''}</span>
                    </div>
                    <div className="picker-item-arrow">›</div>
                  </button>
                `)}
              </div>
            ` : null}
          </div>
        ` : html`
          <div className="picker-header">
            <button type="button" className="picker-back" onClick=${handleBack}>← Dashboards</button>
            <h3>${selectedDashboard?.name}</h3>
            <p>Use the widget menu (⋯) → Download as PNG, then drag the file below</p>
          </div>
          <div className="picker-capture-layout">
            <div className="picker-embed-frame">
              ${embedUrl
                ? html`<iframe src=${embedUrl} title=${selectedDashboard?.name || 'Dashboard'}
                    frameBorder="0" allow="fullscreen" />`
                : html`<div className="picker-loading">Loading dashboard...</div>`}
            </div>
            <div className=${`picker-drop-zone ${dragOver ? 'drag-over' : ''} ${capturedImage ? 'has-image' : ''}`}
                 ref=${dropRef}
                 onDragOver=${onDragOver} onDragLeave=${onDragLeave} onDrop=${onDrop}>
              ${capturedImage ? html`
                <img src=${capturedImage} alt=${capturedName} className="picker-preview-img" />
                <div className="picker-preview-name">${capturedName || 'Captured widget'}</div>
                <button type="button" className="picker-clear" onClick=${() => setCapturedImage(null)}>✕ Clear</button>
              ` : html`
                <div className="picker-drop-icon">📎</div>
                <div className="picker-drop-text">Drop PNG here or paste (Ctrl+V)</div>
              `}
            </div>
          </div>
        `}

        <div className="modal-actions">
          ${step === 'capture' && capturedImage ? html`
            <button type="button" className="btn-primary" onClick=${handleInsert}>
              Insert into report
            </button>
          ` : null}
          <button type="button" onClick=${onClose}>${t('cancel')}</button>
        </div>
      </div>
    </div>
  `;
}
