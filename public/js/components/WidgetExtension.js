import React, { useCallback } from 'react';
import htm from 'htm';
import { Node, mergeAttributes } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';

const html = htm.bind(React.createElement);

/**
 * DatabricksWidget — a Tiptap block node that stores a static image.
 *
 * Attrs:
 *  - imageData: base64 data URL of the widget screenshot
 *  - title:     widget title / label
 *  - caption:   source info (dashboard name, etc.)
 *
 * Inserted via the WidgetPicker (drag-and-drop capture flow).
 * Export: PDF uses <img> directly, PPTX uses addImage().
 */

export function createWidgetBlock(widget) {
  return {
    type: 'databricksWidget',
    attrs: {
      imageData: widget.imageData || '',
      title: widget.title || '',
      caption: widget.caption || '',
    },
  };
}

function WidgetNodeView(props) {
  const { node, deleteNode } = props;
  const { imageData, title, caption } = node.attrs;

  const handleEdit = useCallback(() => {
    const next = window.prompt('Widget title', title || '');
    if (next !== null) props.updateAttributes({ title: next });
  }, [title, props]);

  return html`
    <${NodeViewWrapper} className="widget-figure" data-drag-handle>
      <div className="widget-image-container" contentEditable=${false}>
        ${imageData
          ? html`<img src=${imageData} alt=${title || 'Widget'} className="widget-img" />`
          : html`<div className="widget-empty">No image captured</div>`
        }
        <div className="widget-caption-bar">
          <span className="widget-caption-text">
            ${title || 'Untitled widget'}${caption ? ' — ' + caption : ''}
          </span>
          <div className="widget-caption-actions">
            <button type="button" onClick=${handleEdit} title="Edit title">${'\u270E'}</button>
            <button type="button" onClick=${deleteNode} title="Remove">${'\u2715'}</button>
          </div>
        </div>
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
      imageData: { default: '' },
      title:     { default: '' },
      caption:   { default: '' },
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
          commands.insertContent({ type: this.name, attrs: attributes }),
    };
  },
});
