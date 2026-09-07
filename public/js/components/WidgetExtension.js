import React from 'react';
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

export function createSeedDocument() {
  return {
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 1 },
        content: [{ type: 'text', text: 'De la Masa al Margen de Ganancia' }],
      },
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'Este documento combina narrativa ejecutiva con widgets vivos del dashboard de Bakehouse. Puedes escribir texto libre, reorganizar bloques y añadir visualizaciones directamente en el flujo del reporte.',
          },
        ],
      },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'Capítulo I · Huella geográfica y distribución de ingresos' }],
      },
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'La operación de Bakehouse se extiende a través de múltiples continentes. La distribución espacial de las franquicias permite detectar focos de alto rendimiento y priorizar zonas de expansión estratégica con contexto visual inmediato.',
          },
        ],
      },
      createWidgetBlock(DASHBOARD_WIDGETS[0]),
      {
        type: 'horizontalRule',
      },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'Capítulo II · Dinámica temporal y velocidad del negocio' }],
      },
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'El análisis temporal revela el pulso operativo de la franquicia. La comparación entre granularidad diaria y promedios rodantes permite separar efectos estacionales de cambios estructurales en la demanda.',
          },
        ],
      },
      {
        type: 'blockquote',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'El indicador day-over-day funciona como una métrica de velocidad. Valores persistentemente superiores al 5% suelen indicar picos de demanda que requieren atención operativa inmediata.',
              },
            ],
          },
        ],
      },
      createWidgetBlock(DASHBOARD_WIDGETS[1]),
      {
        type: 'horizontalRule',
      },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'Capítulo III · Segmentación por formato' }],
      },
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'La diversidad de formatos de tienda responde a condiciones locales distintas. Integrar estos widgets dentro del texto permite documentar hipótesis, explicar decisiones y dejar el reporte listo para consumo ejecutivo.',
          },
        ],
      },
      createWidgetBlock(DASHBOARD_WIDGETS[2]),
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'Usa la barra superior o la biblioteca lateral para insertar más widgets del dashboard con exactamente el mismo patrón de embed que ya existe en la aplicación.',
          },
        ],
      },
    ],
  };
}

function WidgetNodeView(props) {
  const { node, updateAttributes, deleteNode } = props;
  const { src, title, caption, height } = node.attrs;

  function onEdit() {
    const nextSrc = window.prompt('Widget embed URL', src || '');
    if (!nextSrc) {
      return;
    }

    const nextTitle = window.prompt('Widget title', title || 'Databricks widget');
    const nextCaption = window.prompt('Widget caption', caption || '');
    const nextHeight = window.prompt('Widget height in pixels', String(height || 420));

    updateAttributes({
      src: nextSrc,
      title: nextTitle || 'Databricks widget',
      caption: nextCaption || '',
      height: Number(nextHeight || 420),
    });
  }

  return html`
    <${NodeViewWrapper} className="widget-node">
      <div className="widget-node-header" contentEditable=${false}>
        <div>
          <strong>${title || 'Databricks widget'}</strong>
          <span>Embed conservando el mismo formato del dashboard existente</span>
        </div>
        <div className="widget-node-actions">
          <a href=${src} target="_blank" rel="noreferrer">Abrir</a>
          <button type="button" onClick=${onEdit}>Editar</button>
          <button type="button" onClick=${deleteNode}>Quitar</button>
        </div>
      </div>
      <iframe
        src=${src}
        title=${title || 'Databricks widget'}
        style=${{ height: `${Number(height || 420)}px` }}
        frameBorder="0"
        allow="fullscreen"
      ></iframe>
      ${caption
        ? html`<div className="widget-node-caption" contentEditable=${false}>${caption}</div>`
        : null}
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
      title: { default: 'Databricks widget' },
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
