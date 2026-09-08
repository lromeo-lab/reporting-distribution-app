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
import { exportToPDF } from './utils/export.js';

const html = htm.bind(React.createElement);

const BLANK_DOC = { type: 'doc', content: [{ type: 'paragraph' }] };

// ── New Document Modal ──
function NewDocModal({ onClose, onCreate }) {
  const [name, setName] = useState('');
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  const handleCreate = () => {
    const id = name.trim().replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').toLowerCase();
    if (!id) return;
    onCreate(id);
  };
  return html`
    <div className="modal-backdrop" onClick=${onClose}>
      <div className="modal-card modal-sm" onClick=${e => e.stopPropagation()}>
        <h3>New report</h3>
        <p>Give your report a name. You can change it later by editing the first heading.</p>
        <input ref=${inputRef} type="text" className="modal-input"
          placeholder="e.g. Q3 Revenue Analysis"
          value=${name} onInput=${e => setName(e.target.value)}
          onKeyDown=${e => e.key === 'Enter' && handleCreate()} />
        <div className="modal-actions">
          <button type="button" onClick=${onClose}>Cancel</button>
          <button type="button" className="confirm" onClick=${handleCreate}
            disabled=${!name.trim()}>Create</button>
        </div>
      </div>
    </div>
  `;
}

// ── Delete Confirmation Modal ──
function DeleteModal({ docId, onClose, onConfirm }) {
  return html`
    <div className="modal-backdrop" onClick=${onClose}>
      <div className="modal-card modal-sm" onClick=${e => e.stopPropagation()}>
        <h3>Delete report</h3>
        <p>Are you sure you want to delete <strong>${docId}</strong>? This cannot be undone.</p>
        <div className="modal-actions">
          <button type="button" onClick=${onClose}>Cancel</button>
          <button type="button" className="confirm danger" onClick=${() => onConfirm(docId)}>Delete</button>
        </div>
      </div>
    </div>
  `;
}

// ── Manual Widget Modal ──
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

// ── Main App ──
function App() {
  const [editor, setEditor] = useState(null);
  const [documentContent, setDocumentContent] = useState(null);
  const [activeDocId, setActiveDocId] = useState('default');
  const [documents, setDocuments] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [status, setStatus] = useState('loading');
  const [savedAt, setSavedAt] = useState(null);
  const [error, setError] = useState('');
  const [modalMode, setModalMode] = useState(null); // null|'picker'|'manual'|'newdoc'|'delete'
  const [deleteTarget, setDeleteTarget] = useState(null);
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

  // ── Persistence ──
  const persist = useCallback(async () => {
    if (!latestContentRef.current) return;
    setStatus('saving'); setError('');
    try {
      const saved = await saveDocument(activeDocId, latestContentRef.current);
      dirtyRef.current = false;
      setSavedAt(saved.updatedAt);
      setStatus('saved');
      refreshDocList();
    } catch (e) {
      console.error(e); setStatus('error'); setError(t('backendError'));
    }
  }, [activeDocId]);

  const refreshDocList = useCallback(async () => {
    try {
      const data = await listDocuments();
      setDocuments(data.documents || []);
    } catch (_) {}
  }, []);

  // ── Bootstrap ──
  useEffect(() => {
    async function boot() {
      hasLoadedRef.current = false;
      setDocumentContent(null); setEditor(null);
      setStatus('loading'); setError('');
      try {
        const stored = await loadDocument(activeDocId);
        // Only use seed for the 'default' doc if it doesn't exist yet
        const content = stored?.content || (activeDocId === 'default' ? createSeedDocument(t) : BLANK_DOC);
        latestContentRef.current = content;
        setDocumentContent(content);
        setSavedAt(stored?.updatedAt || null);
        setStatus(stored ? 'saved' : 'dirty');
        if (!stored) {
          dirtyRef.current = true;
          try { await saveDocument(activeDocId, content); } catch (_) {}
        }
      } catch (_) {
        const fallback = activeDocId === 'default' ? createSeedDocument(t) : BLANK_DOC;
        latestContentRef.current = fallback;
        setDocumentContent(fallback);
        setStatus('dirty'); dirtyRef.current = true;
      }
      hasLoadedRef.current = true;
      editorKeyRef.current += 1;
    }
    boot();
    refreshDocList();
  }, [activeDocId]);

  useEffect(() => {
    const id = setInterval(() => {
      if (hasLoadedRef.current && dirtyRef.current) persist();
    }, 3000);
    return () => clearInterval(id);
  }, [persist]);



  // ── Callbacks ──
  const handleContentChange = useCallback(next => {
    latestContentRef.current = next;
    if (hasLoadedRef.current) { dirtyRef.current = true; setStatus('dirty'); }
  }, []);

  const handleSelectDoc = useCallback(id => {
    if (id === activeDocId) return;
    if (dirtyRef.current && latestContentRef.current) {
      saveDocument(activeDocId, latestContentRef.current).catch(() => {});
    }
    setActiveDocId(id);
  }, [activeDocId]);

  const handleNewDoc = useCallback(async id => {
    setModalMode(null);
    try {
      await saveDocument(id, BLANK_DOC);
      await refreshDocList();
      setActiveDocId(id);
    } catch (e) { setError(e.message); }
  }, [refreshDocList]);

  const handleRequestDelete = useCallback(id => {
    setDeleteTarget(id);
    setModalMode('delete');
  }, []);

  const handleConfirmDelete = useCallback(async id => {
    setModalMode(null); setDeleteTarget(null);
    try {
      await deleteDocument(id);
      await refreshDocList();
      if (id === activeDocId) setActiveDocId('default');
    } catch (e) { setError(e.message); }
  }, [activeDocId, refreshDocList]);


  const [exportMsg, setExportMsg] = useState('');
  const handleExportPDF = useCallback(async () => {
    const canvas = document.querySelector('.editor-canvas');
    if (!canvas) { setError('Cannot find editor canvas for export'); return; }
    const firstH = canvas.querySelector('h1, h2, h3');
    const docTitle = firstH?.textContent || activeDocId || 'report';
    setStatus('saving');
    setExportMsg('Starting export...');
    try {
      await exportToPDF(canvas, docTitle, msg => setExportMsg(msg));
      setStatus('saved');
      setExportMsg('');
    } catch (e) {
      console.error('PDF export error:', e);
      setError('PDF export failed: ' + e.message);
      setStatus('error');
      setExportMsg('');
    }
  }, [activeDocId]);

  // ── Widget insertion ──
  const insertWidget = useCallback(widget => {
    if (!editor) return;
    editor.chain().focus().insertDatabricksWidget({
      title: widget.title || '', src: widget.src,
      caption: widget.caption || '', height: Number(widget.height || 380),
    }).run();
  }, [editor]);

  const handlePickerSelect = useCallback(widget => {
    insertWidget(widget); setModalMode(null);
  }, [insertWidget]);

  const handleSubmitWidget = useCallback(() => {
    if (!widgetForm.src.includes('/embed/dashboardsv3/')) { setError(t('invalidUrl')); return; }
    insertWidget(widgetForm); setModalMode(null);
    setWidgetForm({ title: '', src: '', caption: '', height: '380' }); setError('');
  }, [insertWidget, widgetForm]);

  // ── Render ──
  return html`
    <div className="app-shell">
      <${Sidebar}
        documents=${documents} activeDocId=${activeDocId}
        onSelectDoc=${handleSelectDoc}
        onNewDoc=${() => setModalMode('newdoc')}
        onDeleteDoc=${handleRequestDelete}
        collapsed=${!sidebarOpen}
        onToggleCollapse=${() => setSidebarOpen(o => !o)}
      />
      <div className="content-column">
        <header className="unified-bar">
          <div className="bar-center">
            <${Toolbar} editor=${editor} onOpenWidgetModal=${() => setModalMode('picker')} onExportPDF=${handleExportPDF} />
          </div>
          <div className="bar-right">
            <select className="lang-select" value=${locale} onChange=${e => setLocale(e.target.value)}>
              ${locales.map(l => html`<option key=${l} value=${l}>${l.toUpperCase()}</option>`)}
            </select>
            <span className=${statusClass}>${statusLabel}</span>
            <button className="bar-save" onClick=${persist}>${t('save')}</button>
          </div>
        </header>
        <section className="canvas-area">
          ${error ? html`<div className="error-banner">${error}</div>` : null}
          ${exportMsg ? html`<div className="export-progress">${exportMsg}</div>` : null}
          ${documentContent
            ? html`<${DocumentEditor} key=${editorKeyRef.current}
                initialContent=${documentContent} onEditorReady=${setEditor}
                onContentChange=${handleContentChange} placeholderText=${t('editorPlaceholder')} />`
            : html`<div className="canvas-loading">Loading...</div>`}
        </section>
      </div>

      ${modalMode === 'newdoc' ? html`<${NewDocModal}
        onClose=${() => setModalMode(null)} onCreate=${handleNewDoc} />` : null}
      ${modalMode === 'delete' && deleteTarget ? html`<${DeleteModal}
        docId=${deleteTarget} onClose=${() => setModalMode(null)}
        onConfirm=${handleConfirmDelete} />` : null}
      ${modalMode === 'picker' ? html`<${WidgetPicker}
        onSelect=${handlePickerSelect} onClose=${() => setModalMode(null)}
        onSwitchManual=${() => setModalMode('manual')} />` : null}
      ${modalMode === 'manual' ? html`<${ManualWidgetModal}
        formState=${widgetForm}
        onChange=${(f, v) => setWidgetForm(c => ({ ...c, [f]: v }))}
        onClose=${() => { setModalMode(null); setWidgetForm({ title: '', src: '', caption: '', height: '380' }); }}
        onSubmit=${handleSubmitWidget}
        onSwitchBrowse=${() => setModalMode('picker')} />` : null}
    </div>
  `;
}

function Root() {
  return html`<${I18nProvider}><${App} /><//>`;
}

const root = createRoot(document.getElementById('root'));
root.render(html`<${Root} />`);
