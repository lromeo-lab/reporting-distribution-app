import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import htm from 'htm';
import { Toolbar } from './components/Toolbar.js';
import { DocumentEditor } from './components/DocumentEditor.js';
import { WidgetPicker } from './components/WidgetPicker.js';
import { DASHBOARD_WIDGETS, createSeedDocument } from './components/WidgetExtension.js';
import { loadDocument, saveDocument } from './utils/api.js';
import { I18nProvider, useI18n } from './utils/i18n.js';

const html = htm.bind(React.createElement);
const DOCUMENT_ID = 'default';

function getStatusMeta(status, savedAt, t) {
  if (status === 'saving') {
    return { label: t('saving'), className: 'status-pill saving' };
  }

  if (status === 'error') {
    return { label: t('saveError'), className: 'status-pill' };
  }

  if (status === 'dirty') {
    return { label: t('unsaved'), className: 'status-pill' };
  }

  if (savedAt) {
    const time = new Date(savedAt).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    return { label: t('savedAt', { time }), className: 'status-pill saved' };
  }

  return { label: t('ready'), className: 'status-pill saved' };
}

function ManualWidgetModal({ formState, onChange, onClose, onSubmit, onSwitchBrowse }) {
  const { t } = useI18n();
  return html`
    <div className="modal-backdrop" onClick=${onClose}>
      <div className="modal-card" onClick=${event => event.stopPropagation()}>
        <h3>${t('insertManual')}</h3>
        <p>${t('formHint')}</p>

        <div className="form-grid">
          <label>
            ${t('widgetTitle')}
            <input
              type="text"
              value=${formState.title}
              onInput=${event => onChange('title', event.target.value)}
              placeholder="e.g. Revenue Trend"
            />
          </label>
          <label>
            ${t('widgetEmbedUrl')}
            <textarea
              value=${formState.src}
              onInput=${event => onChange('src', event.target.value)}
              placeholder="https://.../embed/dashboardsv3/...&fullscreenWidget=..."
            ></textarea>
          </label>
          <label>
            ${t('caption')}
            <textarea
              value=${formState.caption}
              onInput=${event => onChange('caption', event.target.value)}
            ></textarea>
          </label>
          <label>
            ${t('heightPx')}
            <input type="number" min="280" max="1200" value=${formState.height}
              onInput=${event => onChange('height', event.target.value)} />
          </label>
        </div>

        <div className="modal-actions">
          <button type="button" onClick=${onSwitchBrowse}>${t('browseDashboards')}</button>
          <button type="button" onClick=${onClose}>${t('cancel')}</button>
          <button type="button" className="confirm" onClick=${onSubmit}>${t('insert')}</button>
        </div>
      </div>
    </div>
  `;
}

function App() {
  const [editor, setEditor] = useState(null);
  const [documentContent, setDocumentContent] = useState(null);
  const [status, setStatus] = useState('loading');
  const [savedAt, setSavedAt] = useState(null);
  const [error, setError] = useState('');
  const [modalMode, setModalMode] = useState(null); // null | 'picker' | 'manual'
  const [widgetForm, setWidgetForm] = useState({
    title: '',
    src: '',
    caption: '',
    height: '420',
  });
  const latestContentRef = useRef(null);
  const hasLoadedRef = useRef(false);
  const dirtyRef = useRef(false);

  const { t, locale, setLocale, locales } = useI18n();
  const statusMeta = useMemo(() => getStatusMeta(status, savedAt, t), [status, savedAt, t]);

  const persist = useCallback(async () => {
    if (!latestContentRef.current) {
      return;
    }

    setStatus('saving');
    setError('');

    try {
      const saved = await saveDocument(DOCUMENT_ID, latestContentRef.current);
      dirtyRef.current = false;
      setSavedAt(saved.updatedAt);
      setStatus('saved');
    } catch (saveError) {
      console.error(saveError);
      setStatus('error');
      setError(t('backendError'));
    }
  }, []);

  useEffect(() => {
    async function bootstrap() {
      try {
        const stored = await loadDocument(DOCUMENT_ID);
        const nextContent = stored?.content || createSeedDocument(t);
        latestContentRef.current = nextContent;
        setDocumentContent(nextContent);
        setSavedAt(stored?.updatedAt || null);
        setStatus(stored ? 'saved' : 'dirty');

        if (!stored) {
          dirtyRef.current = true;
          await persist();
        }
      } catch (loadError) {
        console.error(loadError);
        const fallback = createSeedDocument(t);
        latestContentRef.current = fallback;
        setDocumentContent(fallback);
        setStatus('dirty');
        setError(t('loadFallback'));
      } finally {
        hasLoadedRef.current = true;
      }
    }

    bootstrap();
  }, [persist]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (!hasLoadedRef.current || !dirtyRef.current) {
        return;
      }
      persist();
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [persist]);

  const handleContentChange = useCallback(nextContent => {
    latestContentRef.current = nextContent;
    setDocumentContent(nextContent);

    if (hasLoadedRef.current) {
      dirtyRef.current = true;
      setStatus('dirty');
    }
  }, []);

  const handleWidgetFormChange = useCallback((field, value) => {
    setWidgetForm(current => ({ ...current, [field]: value }));
  }, []);

  const resetWidgetForm = useCallback(() => {
    setWidgetForm({
      title: '',
      src: '',
      caption: '',
      height: '420',
    });
  }, []);

  const insertWidget = useCallback(widget => {
    if (!editor) {
      return;
    }

    editor
      .chain()
      .focus()
      .insertDatabricksWidget({
        title: widget.title || 'Databricks widget',
        src: widget.src,
        caption: widget.caption || '',
        height: Number(widget.height || 420),
      })
      .run();
  }, [editor]);

  const handleInsertFromLibrary = useCallback(widget => {
    insertWidget(widget);
  }, [insertWidget]);

  const handleSubmitWidget = useCallback(() => {
    if (!widgetForm.src.includes('/embed/dashboardsv3/')) {
      setError(t('invalidUrl'));
      return;
    }

    insertWidget(widgetForm);
    setModalMode(null);
    resetWidgetForm();
    setError('');
  }, [insertWidget, resetWidgetForm, widgetForm]);

  const handlePickerSelect = useCallback(widget => {
    insertWidget(widget);
    setModalMode(null);
  }, [insertWidget]);

  const handleResetDocument = useCallback(() => {
    const nextContent = createSeedDocument(t);
    latestContentRef.current = nextContent;
    setDocumentContent(nextContent);
    dirtyRef.current = true;
    setStatus('dirty');
    setError('');
  }, []);

  return html`
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">AI</div>
          <div className="brand-copy">
            <h1>${t('appName')}</h1>
            <p>${t('appTagline')}</p>
          </div>
        </div>

        <div className="topbar-actions">
          <select className="lang-select" value=${locale} onChange=${e => setLocale(e.target.value)}>
            ${locales.map(l => html`<option key=${l} value=${l}>${l.toUpperCase()}</option>`)}
          </select>
          <span className=${statusMeta.className}>${statusMeta.label}</span>
          <button className="secondary-button" type="button" onClick=${handleResetDocument}>${t('restoreDemo')}</button>
          <button className="primary-button" type="button" onClick=${persist}>${t('save')}</button>
        </div>
      </header>

      <main className="workspace">
        <aside className="sidebar">
          <section className="sidebar-panel">
            <h2>${t('widgetLibrary')}</h2>
            <p>${t('widgetLibraryDesc')}</p>
            <div className="library-list">
              ${DASHBOARD_WIDGETS.map(
                widget => html`
                  <div className="library-card" key=${widget.key}>
                    <h4>${widget.title}</h4>
                    <p>${widget.caption}</p>
                    <button type="button" onClick=${() => handleInsertFromLibrary(widget)}>${t('addToDoc')}</button>
                  </div>
                `,
              )}
            </div>
          </section>

          <section className="sidebar-panel">
            <h3>${t('workflow')}</h3>
            <p>${t('workflowDesc')}</p>
            <div className="empty-state">${t('autosaveNote')}</div>
          </section>
        </aside>

        <section className="editor-panel">
          <${Toolbar} editor=${editor} onOpenWidgetModal=${() => setModalMode('picker')} />
          ${error ? html`<div className="error-banner">${error}</div>` : null}
          ${documentContent
            ? html`
                <${DocumentEditor}
                  initialContent=${documentContent}
                  onEditorReady=${setEditor}
                  onContentChange=${handleContentChange}
                  placeholderText=${t('editorPlaceholder')}
                />
              `
            : html`<div className="editor-body"><div className="editor-canvas"><p>Loading…</p></div></div>`}
        </section>
      </main>

      ${modalMode === 'picker'
        ? html`
            <${WidgetPicker}
              onSelect=${handlePickerSelect}
              onClose=${() => setModalMode(null)}
              onSwitchManual=${() => setModalMode('manual')}
            />
          `
        : null}
      ${modalMode === 'manual'
        ? html`
            <${ManualWidgetModal}
              formState=${widgetForm}
              onChange=${handleWidgetFormChange}
              onClose=${() => {
                setModalMode(null);
                resetWidgetForm();
              }}
              onSubmit=${handleSubmitWidget}
              onSwitchBrowse=${() => setModalMode('picker')}
            />
          `
        : null}
    </div>
  `;
}

function Root() {
  return html`<${I18nProvider}><${App} /><//>`;
}

const root = createRoot(document.getElementById('root'));
root.render(html`<${Root} />`);
