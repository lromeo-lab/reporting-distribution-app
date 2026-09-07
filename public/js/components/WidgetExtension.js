import React, { useCallback, useRef, useState } from 'react';
import htm from 'htm';
import { Node, mergeAttributes } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';

const html = htm.bind(React.createElement);

export const DASHBOARD_WIDGETS = [
  {
    key: 'map-ingresos',
    title: 'Mapa Geográfico de Ingresos',
    caption: 'Fuente: UC Metric View mv_bakehouse_sales | Coordenadas geoespaciales de franquicias activas',
    height: 420,
    src: 'https://fevm-classic-stable-rue1fz.cloud.databricks.com/embed/dashboardsv3/01f155b74e82153fa9eabc5f08f2d7bf?o=7474653353535007&fullscreenWidget=23c99318~map_ingresos',
  },
  {
    key: 'area-tendencia',
    title: 'Tendencia Temporal de Ingresos',
    caption: 'Métrica: Ingreso diario vs. promedio rodante 30 días | Período: Mayo 2024',
    height: 420,
    src: 'https://fevm-classic-stable-rue1fz.cloud.databricks.com/embed/dashboardsv3/01f155b74e82153fa9eabc5f08f2d7bf?o=7474653353535007&fullscreenWidget=23c99318~area_tendencia',
  },
  {
    key: 'bar-store-size',
    title: 'Rendimiento por Formato de Tienda',
    caption: 'Dimensión: store_size x continent | Métrica: ingreso total agregado',
    height: 420,
    src: 'https://fevm-classic-stable-rue1fz.cloud.databricks.com/embed/dashboardsv3/01f155b74e82153fa9eabc5f08f2d7bf?o=7474653353535007&fullscreenWidget=23c99318~bar_store_size',
  },
  {
    key: 'full-dashboard',
    title: 'Panel Analítico Integrado',
    caption: 'Vista completa del dashboard ejecutivo de Bakehouse.',
    height: 640,
    src: 'https://fevm-classic-stable-rue1fz.cloud.databricks.com/embed/dashboardsv3/01f155b74e82153fa9eabc5f08f2d7bf?o=7474653353535007&fullscreenWidget=23c99318',
  },
];

export function createWidgetBlock(widget) {
  return {
    type: 'databricksWidget',
    attrs: {
      src: widget.src,
      title: widget.title,
      caption: widget.caption || '',
      height: Number(widget.height || 420),
    },
  };
}

export function createSeedDocument(t) {
  const txt = key => t ? t(key) : key;
  return {
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 1 },
        content: [{ type: 'text', text: txt('seedTitle') }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: txt('seedIntro') }],
      },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: txt('seedCh1Title') }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: txt('seedCh1Body') }],
      },
      createWidgetBlock(DASHBOARD_WIDGETS[0]),
      { type: 'horizontalRule' },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: txt('seedCh2Title') }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: txt('seedCh2Body') }],
      },
      {
        type: 'blockquote',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: txt('seedCh2Quote') }],
          },
        ],
      },
      createWidgetBlock(DASHBOARD_WIDGETS[1]),
      { type: 'horizontalRule' },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: txt('seedCh3Title') }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: txt('seedCh3Body') }],
      },
      createWidgetBlock(DASHBOARD_WIDGETS[2]),
      {
        type: 'paragraph',
        content: [{ type: 'text', text: txt('seedOutro') }],
      },
    ],
  };
}

function WidgetNodeView(props) {
  const { node, updateAttributes, deleteNode } = props;
  const { src, title, caption, height } = node.attrs;
  const [resizing, setResizing] = useState(false);
  const startYRef = useRef(0);
  const startHRef = useRef(0);

  function onEdit() {
    const nextSrc = window.prompt('Widget embed URL', src || '');
    if (!nextSrc) return;
    const nextTitle = window.prompt('Title (leave empty for none)', title || '');
    const nextHeight = window.prompt('Height in px', String(height || 420));
    updateAttributes({
      src: nextSrc,
      title: nextTitle || '',
      height: Number(nextHeight || 420),
    });
  }

  const onResizeStart = useCallback(e => {
    e.preventDefault();
    e.stopPropagation();
    startYRef.current = e.clientY;
    startHRef.current = Number(height) || 420;
    setResizing(true);

    const onMove = me => {
      const delta = me.clientY - startYRef.current;
      const next = Math.max(180, Math.min(1200, startHRef.current + delta));
      updateAttributes({ height: Math.round(next) });
    };
    const onUp = () => {
      setResizing(false);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [height, updateAttributes]);

  return html`
    <${NodeViewWrapper} className="widget-wrap" data-resizing=${resizing || undefined}>
      <div className="widget-container" contentEditable=${false}>
        <div className="widget-toolbar">
          ${title ? html`<span className="widget-toolbar-title">${title}</span>` : null}
          <div className="widget-toolbar-actions">
            <a href=${src} target="_blank" rel="noreferrer" title="Open in new tab">\u2197</a>
            <button type="button" onClick=${onEdit} title="Edit">\u270E</button>
            <button type="button" onClick=${deleteNode} title="Remove">\u2715</button>
          </div>
        </div>
        <iframe
          src=${src}
          title=${title || 'Widget'}
          style=${{ height: (Number(height) || 420) + 'px' }}
          frameBorder="0"
          allow="fullscreen"
        ></iframe>
        <div
          className="widget-resize-bar"
          onMouseDown=${onResizeStart}
          title="Drag to resize"
        ><span>\u22EF</span></div>
      </div>
    <//>
  `;
}

export const DatabricksWidget = Node.create({
  name: 'databricksWidget',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: '' },
      title: { default: '' },
      caption: { default: '' },
      height: { default: 420 },
    };
  },

  parseHTML() {
    return [{ tag: 'databricks-widget' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['databricks-widget', mergeAttributes(HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(WidgetNodeView);
  },

  addCommands() {
    return {
      insertDatabricksWidget:
        attributes =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: attributes,
          }),
    };
  },
});
