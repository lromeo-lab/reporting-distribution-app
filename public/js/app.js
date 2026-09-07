import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import htm from 'htm';
import { Toolbar } from './components/Toolbar.js';
import { Sidebar } from './components/Sidebar.js';
import { DocumentEditor } from './components/DocumentEditor.js';
import { WidgetPicker } from './components/WidgetPicker.js';
import { createSeedDocument } from './components/WidgetExtension.js';
import { loadDocument, saveDocument, listDocuments, deleteDocument } from './utils/api.js';
import { I18nProvider, useI18n } from './utils/i18n.js';

const html = htm.bind(React.createElement);

function ManualWidgetModal({ formState, onChange, onClose, onSubmit, onSwitchBrowse }) {
  const { t } = useI18n();
  return html`
    <div className="modal-backdrop" onClick=${onClose}>
      <div className="modal-card" onClick=${e => e.stopPropagation()}>
        <h3>${t('insertManual')}</h3>
        <p>${t('formHint')}</p>
        <div className="form-grid">
          <label>${t('widgetTitle')}
            <input type="text" value=${formState.title}
              onInput=${e => onChange('title', e.target.value)} placeholder="e.g. Revenue Trend" />
          </label>
          <label>${t('widgetEmbedUrl')}
            <textarea value=${formState.src}
              onInput=${e => onChange('src', e.target.value)}
              placeholder="https://.../embed/dashboardsv3/...&fullscreenWidget=..."></textarea>
          </label>
          <label>${t('heightPx')}
            <input type="number" min="180" max="1200" value=${formState.height}
              onInput=${e => onChange('height', e.target.value)} />
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
  const [activeDocId, setActiveDocId] = useState('default');
  const [documents, setDocuments] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [status, setStatus] = useState('loading');
  const [savedAt, setSavedAt] = useState(null);
  const [error, setError] = useState('');
  const [modalMode, setModalMode] = useState(null);
  const [widgetForm, setWidgetForm] = useState({ title: '', src: '', caption: '', height: '380' });
  const latestContentRef = useRef(null);
  const hasLoadedRef = useRef(false);
  const dirtyRef = useRef(false);
  const editorKeyRef = useRef(0);

  const { t, locale, setLocale, locales } = useI18n();

  const statusLabel = useMemo(() => {
    if (status === 'saving') return t('saving');
    if (status === 'error') return t('saveError');
    if (status === 'dirty') return t('unsaved');
    if (savedAt) {
      const time = new Date(savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return t('savedAt', { time });
    }
    return t('ready');
  }, [status, savedAt, t]);

  const statusClass = status === 'saving' ? 'status saving'
    : (status === 'saved' || savedAt) ? 'status saved' : 'status';

  // ---- Persistence ----
  const persist = useCallback(async () => {
    if (!latestContentRef.current) return;
    setStatus('saving');
    setError('');
    try {
      const saved = await saveDocument(activeDocId, latestContentRef.current);
      dirtyRef.current = false;
      setSavedAt(saved.updatedAt);
      setStatus('saved');
      refreshDocList();
    } catch (e) {
      console.error(e);
      setStatus('error');
      setError(t('backendError'));
    }
  }, [activeDocId]);

  // ---- Document list ----
  const refreshDocList = useCallback(async () => {
    try {
      const data = await listDocuments();
      setDocuments(data.documents || []);
    } catch (_) { /* ignore */ }
  }, []);

  // ---- Bootstrap ----
  useEffect(() => {
    async function boot() {
      hasLoadedRef.current = false;
      setDocumentContent(null);
      setEditor(null);
      setStatus('loading');
      setError('');
      try {
        const stored = await loadDocument(activeDocId);
        const content = stored?.content || createSeedDocument(t);
        latestContentRef.current = content;
        setDocumentContent(content);
        setSavedAt(stored?.updatedAt || null);
        setStatus(stored ? 'saved' : 'dirty');
        if (!stored) {
          dirtyRef.current = true;
          // Auto-save new seed document
          try { await saveDocument(activeDocId, content); } catch (_) {}
        }
      } catch (_) {
        const fallback = createSeedDocument(t);
        latestContentRef.current = fallback;
        setDocumentContent(fallback);
        setStatus('dirty');
        dirtyRef.current = true;
      }
      hasLoadedRef.current = true;
      editorKeyRef.current += 1;
    }
    boot();
    refreshDocList();
  }, [activeDocId]);

  // Auto-save timer
  useEffect(() => {
    const id = setInterval(() => {
      if (hasLoadedRef.current && dirtyRef.current) persist();
    }, 3000);
    return () => clearInterval(id);
  }, [persist]);

  // ---- Callbacks ----
  const handleContentChange = useCallback(next => {
    latestContentRef.current = next;
    if (hasLoadedRef.current) {
      dirtyRef.current = true;
      setStatus('dirty');
    }
  }, []);

  const handleSelectDoc = useCallback(id => {
    if (id === activeDocId) return;
    if (dirtyRef.current && latestContentRef.current) {
      saveDocument(activeDocId, latestContentRef.current).catch(() => {});
    }
    setActiveDocId(id);
  }, [activeDocId]);

  const handleNewDoc = useCallback(async () => {
    const name = window.prompt('Report name (no spaces, e.g. q3-analysis)');
    if (!name) return;
    const id = name.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
    if (!id) return;
    try {
      const seed = createSeedDocument(t);
      await saveDocument(id, seed);
      await refreshDocList();
      setActiveDocId(id);
    } catch (e) {
      setError(e.message);
    }
  }, [t, refreshDocList]);

  const handleDeleteDoc = useCallback(async id => {
    if (!window.confirm(`Delete report "${id}"?`)) return;
    try {
      await deleteDocument(id);
      await refreshDocList();
      if (id === activeDocId) setActiveDocId('default');
    } catch (e) {
      setError(e.message);
    }
  }, [activeDocId, refreshDocList]);

  // ---- Widget insertion ----
  const insertWidget = useCallback(widget => {
    if (!editor) return;
    editor.chain().focus().insertDatabricksWidget({
      title: widget.title || '',
      src: widget.src,
      caption: widget.caption || '',
      height: Number(widget.height || 380),
    }).run();
  }, [editor]);

  const handlePickerSelect = useCallback(widget => {
    insertWidget(widget);
    setModalMode(null);
  }, [insertWidget]);

  const handleSubmitWidget = useCallback(() => {
    if (!widgetForm.src.includes('/embed/dashboardsv3/')) {
      setError(t('invalidUrl'));
      return;
    }
    insertWidget(widgetForm);
    setModalMode(null);
    setWidgetForm({ title: '', src: '', caption: '', height: '380' });
    setError('');
  }, [insertWidget, widgetForm]);

  const handleResetDocument = useCallback(() => {
    const next = createSeedDocument(t);
    latestContentRef.current = next;
    setDocumentContent(next);
    editorKeyRef.current += 1;
    dirtyRef.current = true;
    setStatus('dirty');
    setError('');
  }, [t]);

  // ---- Render ----
  return html`
    <div className=${`app-shell ${sidebarOpen ? '' : 'sidebar-collapsed'}`}>
      <!-- Unified Top Bar -->
      <header className="unified-bar">
        <div className="bar-left">
          <button className="bar-toggle" onClick=${() => setSidebarOpen(o => !o)} title="Toggle sidebar">
            ${sidebarOpen ? '\u2630' : '\u2630'}
          </button>
          <span className="bar-brand">AI/BI Report Studio</span>
        </div>

        <div className="bar-center">
          <${Toolbar} editor=${editor} onOpenWidgetModal=${() => setModalMode('picker')} />
        </div>

        <div className="bar-right">
          <select className="lang-select" value=${locale} onChange=${e => setLocale(e.target.value)}>
            ${locales.map(l => html`<option key=${l} value=${l}>${l.toUpperCase()}</option>`)}
          </select>
          <span className=${statusClass}>${statusLabel}</span>
          <button className="bar-save" onClick=${persist}>${t('save')}</button>
        </div>
      </header>

      <!-- Main area: sidebar + canvas -->
      <div className="main-area">
        <${Sidebar}
          documents=${documents}
          activeDocId=${activeDocId}
          onSelectDoc=${handleSelectDoc}
          onNewDoc=${handleNewDoc}
          onDeleteDoc=${handleDeleteDoc}
          collapsed=${!sidebarOpen}
          onToggleCollapse=${() => setSidebarOpen(o => !o)}
        />
        <section className="canvas-area">
          ${error ? html`<div className="error-banner">${error}</div>` : null}
          ${documentContent
            ? html`<${DocumentEditor}
                key=${editorKeyRef.current}
                initialContent=${documentContent}
                onEditorReady=${setEditor}
                onContentChange=${handleContentChange}
                placeholderText=${t('editorPlaceholder')}
              />`
            : html`<div className="canvas-loading">Loading...</div>`}
        </section>
      </div>

      <!-- Modals -->
      ${modalMode === 'picker' ? html`
        <${WidgetPicker}
          onSelect=${handlePickerSelect}
          onClose=${() => setModalMode(null)}
          onSwitchManual=${() => setModalMode('manual')}
        />` : null}
      ${modalMode === 'manual' ? html`
        <${ManualWidgetModal}
          formState=${widgetForm}
          onChange=${(f, v) => setWidgetForm(cur => ({ ...cur, [f]: v }))}
          onClose=${() => { setModalMode(null); setWidgetForm({ title: '', src: '', caption: '', height: '380' }); }}
          onSubmit=${handleSubmitWidget}
          onSwitchBrowse=${() => setModalMode('picker')}
        />` : null}
    </div>
  `;
}

function Root() {
  return html`<${I18nProvider}><${App} /><//>`;
}

const root = createRoot(document.getElementById('root'));
root.render(html`<${Root} />`);
