import React, { useCallback, useEffect, useState } from 'react';
import htm from 'htm';
import { useI18n } from '../utils/i18n.js';
import { fetchDashboards, fetchDashboardWidgets } from '../utils/api.js';

const html = htm.bind(React.createElement);

const TYPE_ICONS = {
  counter: 'ℹ️',
  bar: '📊',
  line: '📈',
  area: '🌊',
  pie: '🥧',
  scatter: '⚫',
  table: '🗒',
  pivot: '🔀',
  heatmap: '🟥',
  histogram: '📊',
  combo: '📉',
  unknown: '🔳',
};

export function WidgetPicker({ onSelect, onClose, onSwitchManual }) {
  const { t } = useI18n();
  const [step, setStep] = useState('dashboards');
  const [dashboards, setDashboards] = useState([]);
  const [selectedDashboard, setSelectedDashboard] = useState(null);
  const [widgetTree, setWidgetTree] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    fetchDashboards()
      .then(data => {
        if (!cancelled) {
          setDashboards(data.dashboards || []);
          setLoading(false);
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  const handleSelectDashboard = useCallback(dashboard => {
    setSelectedDashboard(dashboard);
    setStep('widgets');
    setLoading(true);
    setError('');
    fetchDashboardWidgets(dashboard.id)
      .then(data => {
        setWidgetTree(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const handleSelectWidget = useCallback(widget => {
    onSelect({
      src: widget.embedUrl,
      title: widget.title,
      caption: `${selectedDashboard.name} / ${widget.widgetType}`,
      height: widget.widgetType === 'counter' ? 280 : 420,
    });
  }, [onSelect, selectedDashboard]);

  const handleBack = useCallback(() => {
    setStep('dashboards');
    setSelectedDashboard(null);
    setWidgetTree(null);
  }, []);

  return html`
    <div className="modal-backdrop" onClick=${onClose}>
      <div className="modal-card picker-modal" onClick=${e => e.stopPropagation()}>
        ${step === 'dashboards' ? html`
          <div className="picker-header">
            <h3>${t('browseDashboards')}</h3>
            <p>${t('selectDashboard')}</p>
          </div>
          <div className="picker-body">
            ${loading ? html`<div className="picker-loading">${t('loadingDashboards')}</div>` : null}
            ${error ? html`<div className="error-banner">${t('apiError')}</div>` : null}
            ${!loading && !error && dashboards.length === 0 ? html`<div className="picker-empty">${t('noDashboards')}</div>` : null}
            ${!loading && dashboards.length > 0 ? html`
              <div className="picker-list">
                ${dashboards.map(d => html`
                  <button
                    key=${d.id}
                    type="button"
                    className="picker-item"
                    onClick=${() => handleSelectDashboard(d)}
                  >
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
            <button type="button" className="picker-back" onClick=${handleBack}>← ${t('backToDashboards')}</button>
            <h3>${selectedDashboard?.name}</h3>
            <p>${t('selectWidget')}</p>
          </div>
          <div className="picker-body">
            ${loading ? html`<div className="picker-loading">${t('loadingWidgets')}</div>` : null}
            ${error ? html`<div className="error-banner">${error}</div>` : null}
            ${!loading && widgetTree ? html`
              ${widgetTree.pages.map(page => html`
                <div key=${page.name} className="picker-page-group">
                  <div className="picker-page-label">${t('page')}: ${page.displayName}</div>
                  <div className="picker-grid">
                    ${page.widgets.map(w => html`
                      <button
                        key=${w.name}
                        type="button"
                        className="picker-widget-card"
                        onClick=${() => handleSelectWidget(w)}
                      >
                        <div className="picker-widget-icon">${TYPE_ICONS[w.widgetType] || TYPE_ICONS.unknown}</div>
                        <div className="picker-widget-info">
                          <strong>${w.title}</strong>
                          <span>${w.widgetType}</span>
                        </div>
                      </button>
                    `)}
                  </div>
                </div>
              `)}
              ${widgetTree.pages.every(p => p.widgets.length === 0) ? html`<div className="picker-empty">${t('noWidgets')}</div>` : null}
            ` : null}
          </div>
        `}
        <div className="modal-actions">
          <button type="button" onClick=${onSwitchManual}>${t('orPasteManually')}</button>
          <button type="button" onClick=${onClose}>${t('cancel')}</button>
        </div>
      </div>
    </div>
  `;
}
