import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import htm from 'htm';
import { Toolbar } from './components/Toolbar.js';
import { DocumentEditor } from './components/DocumentEditor.js';
import { DASHBOARD_WIDGETS, createSeedDocument } from './components/WidgetExtension.js';
import { loadDocument, saveDocument } from './utils/api.js';

const html = htm.bind(React.createElement);
const DOCUMENT_ID = 'default';

function getStatusMeta(status, savedAt) {
  if (status === 'saving') {
    return { label: 'Guardando…', className: 'status-pill saving' };
  }

  if (status === 'error') {
    return { label: 'Error al guardar', className: 'status-pill' };
  }

  if (status === 'dirty') {
    return { label: 'Cambios sin guardar', className: 'status-pill' };
  }

  if (savedAt) {
    const time = new Date(savedAt).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    return { label: `Guardado ${time}`, className: 'status-pill saved' };
  }

  return { label: 'Listo', className: 'status-pill saved' };
}

function WidgetModal({ formState, onChange, onClose, onSubmit }) {
  return html`
    <div className="modal-backdrop" onClick=${onClose}>
      <div className="modal-card" onClick=${event => event.stopPropagation()}>
        <h3>Insertar widget de dashboard</h3>
        <p>
          Pega exactamente una URL de embed Databricks como las que ya usa la app:
          <code>/embed/dashboardsv3/...&fullscreenWidget=...</code>
        </p>

        <div className="form-grid">
          <label>
            Título
            <input
              type="text"
              value=${formState.title}
              onInput=${event => onChange('title', event.target.value)}
              placeholder="Ej. Tendencia Temporal de Ingresos"
            />
          </label>

          <label>
            URL del widget
            <textarea
              value=${formState.src}
              onInput=${event => onChange('src', event.target.value)}
              placeholder="https://.../embed/dashboardsv3/...&fullscreenWidget=..."
            ></textarea>
          </label>

          <label>
            Caption
            <textarea
              value=${formState.caption}
              onInput=${event => onChange('caption', event.target.value)}
              placeholder="Texto contextual opcional debajo del widget"
            ></textarea>
          </label>

          <label>
            Altura en px
            <input
              type="number"
              min="280"
              max="1200"
              value=${formState.height}
              onInput=${event => onChange('height', event.target.value)}
            />
          </label>
        </div>

        <div className="form-hint">
          Usa la biblioteca lateral para insertar rápidamente los widgets ya definidos en el reporte actual.
        </div>

        <div className="modal-actions">
          <button type="button" onClick=${onClose}>Cancelar</button>
          <button type="button" className="confirm" onClick=${onSubmit}>Insertar widget</button>
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [widgetForm, setWidgetForm] = useState({
    title: '',
    src: '',
    caption: '',
    height: '420',
  });
  const latestContentRef = useRef(null);
  const hasLoadedRef = useRef(false);
  const dirtyRef = useRef(false);

  const statusMeta = useMemo(() => getStatusMeta(status, savedAt), [status, savedAt]);

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
      setError('No se pudo guardar el documento en el backend Node.');
    }
  }, []);

  useEffect(() => {
    async function bootstrap() {
      try {
        const stored = await loadDocument(DOCUMENT_ID);
        const nextContent = stored?.content || createSeedDocument();
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
        const fallback = createSeedDocument();
        latestContentRef.current = fallback;
        setDocumentContent(fallback);
        setStatus('dirty');
        setError('Se cargó una versión local inicial porque el documento remoto aún no existe.');
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
      setError('La URL debe ser un embed de dashboard Databricks.');
      return;
    }

    insertWidget(widgetForm);
    setIsModalOpen(false);
    resetWidgetForm();
    setError('');
  }, [insertWidget, resetWidgetForm, widgetForm]);

  const handleResetDocument = useCallback(() => {
    const nextContent = createSeedDocument();
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
          <div className="brand-mark">B</div>
          <div className="brand-copy">
            <h1>Bakehouse Report Studio</h1>
            <p>Editor narrativo con widgets embebidos de Databricks dashboards</p>
          </div>
        </div>

        <div className="topbar-actions">
          <span className=${statusMeta.className}>${statusMeta.label}</span>
          <button className="secondary-button" type="button" onClick=${handleResetDocument}>Restaurar demo</button>
          <button className="primary-button" type="button" onClick=${persist}>Guardar ahora</button>
        </div>
      </header>

      <main className="workspace">
        <aside className="sidebar">
          <section className="sidebar-panel">
            <h2>Biblioteca de widgets</h2>
            <p>
              Inserta visualizaciones usando exactamente el mismo patrón de embed que tenía la aplicación original.
            </p>
            <div className="library-list">
              ${DASHBOARD_WIDGETS.map(
                widget => html`
                  <div className="library-card" key=${widget.key}>
                    <h4>${widget.title}</h4>
                    <p>${widget.caption}</p>
                    <button type="button" onClick=${() => handleInsertFromLibrary(widget)}>Añadir al documento</button>
                  </div>
                `,
              )}
            </div>
          </section>

          <section className="sidebar-panel">
            <h3>Modo de trabajo</h3>
            <p>
              Escribe libremente en el documento central y coloca el cursor donde quieras insertar un widget.
              Si necesitas otro embed, usa el botón “Insertar widget” y pega la URL del iframe de Databricks.
            </p>
            <div className="empty-state">
              El documento se guarda automáticamente cada 3 segundos cuando detecta cambios.
            </div>
          </section>
        </aside>

        <section className="editor-panel">
          <${Toolbar} editor=${editor} onOpenWidgetModal=${() => setIsModalOpen(true)} />
          ${error ? html`<div className="error-banner">${error}</div>` : null}
          ${documentContent
            ? html`
                <${DocumentEditor}
                  initialContent=${documentContent}
                  onEditorReady=${setEditor}
                  onContentChange=${handleContentChange}
                />
              `
            : html`<div className="editor-body"><div className="editor-canvas"><p>Cargando documento…</p></div></div>`}
        </section>
      </main>

      ${isModalOpen
        ? html`
            <${WidgetModal}
              formState=${widgetForm}
              onChange=${handleWidgetFormChange}
              onClose=${() => {
                setIsModalOpen(false);
                resetWidgetForm();
              }}
              onSubmit=${handleSubmitWidget}
            />
          `
        : null}
    </div>
  `;
}

const root = createRoot(document.getElementById('root'));
root.render(html`<${App} />`);
