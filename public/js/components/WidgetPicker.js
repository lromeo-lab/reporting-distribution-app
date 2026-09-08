import React, { useCallback, useEffect, useState } from 'react';
import htm from 'htm';
import { useI18n } from '../utils/i18n.js';
import { fetchDashboards, fetchProxyConfig } from '../utils/api.js';

const html = htm.bind(React.createElement);

/**
 * WidgetPicker — two-step flow:
 *  1. Dashboard list
 *  2. Full dashboard in iframe — user downloads widget as PNG,
 *     then drags the file directly onto the editor (not the picker).
 */
export function WidgetPicker({ onClose }) {
  const { t } = useI18n();
  const [step, setStep] = useState('dashboards');
  const [dashboards, setDashboards] = useState([]);
  const [selectedDashboard, setSelectedDashboard] = useState(null);
  const [embedUrl, setEmbedUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchDashboards()
      .then(data => { if (!cancelled) { setDashboards(data.dashboards || []); setLoading(false); } })
      .catch(err => { if (!cancelled) { setError(err.message); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  const handleSelectDashboard = useCallback(async (dashboard) => {
    setSelectedDashboard(dashboard);
    setStep('capture');
    try {
      const config = await fetchProxyConfig();
      const url = config.host + '/embed/dashboardsv3/' + dashboard.id + '?o=' + (config.workspaceId || '');
      setEmbedUrl(url);
    } catch (err) {
      setError('Failed to build embed URL: ' + err.message);
    }
  }, []);

  const handleBack = useCallback(() => {
    setStep('dashboards');
    setSelectedDashboard(null);
    setEmbedUrl('');
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
                    <div className="picker-item-icon">${'\u{1F4CB}'}</div>
                    <div className="picker-item-info">
                      <strong>${d.name}</strong>
                      <span>${d.path || ''}</span>
                    </div>
                    <div className="picker-item-arrow">${'\u203A'}</div>
                  </button>
                `)}
              </div>
            ` : null}
          </div>
        ` : html`
          <div className="picker-header">
            <button type="button" className="picker-back" onClick=${handleBack}>${'\u2190'} Dashboards</button>
            <h3>${selectedDashboard?.name}</h3>
            <p>${'\u{1F4CB}'} Download widget as PNG, then drag it onto your report</p>
          </div>
          <div className="picker-capture-layout">
            <div className="picker-embed-frame">
              ${embedUrl
                ? html`<iframe src=${embedUrl} title=${selectedDashboard?.name || 'Dashboard'}
                    frameBorder="0" allow="fullscreen" />`
                : html`<div className="picker-loading">Loading dashboard...</div>`}
            </div>
          </div>
        `}

        <div className="modal-actions">
          <button type="button" onClick=${onClose}>${step === 'capture' ? 'Done' : t('cancel')}</button>
        </div>
      </div>
    </div>
  `;
}
