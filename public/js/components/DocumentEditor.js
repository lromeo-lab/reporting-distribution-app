import React, { useEffect } from 'react';
import htm from 'htm';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import { DatabricksWidget } from './WidgetExtension.js';

const html = htm.bind(React.createElement);

export function DocumentEditor({ initialContent, onEditorReady, onContentChange, placeholderText }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4],
        },
      }),
      Underline,
      Link.configure({ openOnClick: false, HTMLAttributes: { target: '_blank' } }),
      Placeholder.configure({
        placeholder: placeholderText || 'Start writing your report...',
      }),
      DatabricksWidget,
    ],
    content: initialContent,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        spellcheck: 'true',
      },
      handleDrop(view, event) {
        const file = event.dataTransfer?.files?.[0];
        if (!file || !file.type.startsWith('image/')) return false;
        event.preventDefault();
        const reader = new FileReader();
        reader.onload = () => {
          const pos = view.posAtCoords({ left: event.clientX, top: event.clientY });
          const node = view.state.schema.nodes.databricksWidget.create({
            imageData: reader.result,
            title: file.name.replace(/\.[^.]+$/, ''),
            caption: '',
          });
          const tr = view.state.tr.insert(pos?.pos ?? view.state.selection.head, node);
          view.dispatch(tr);
        };
        reader.readAsDataURL(file);
        return true;
      },
      handlePaste(view, event) {
        const items = event.clipboardData?.items;
        if (!items) return false;
        for (const item of items) {
          if (item.type.startsWith('image/')) {
            event.preventDefault();
            const file = item.getAsFile();
            const reader = new FileReader();
            reader.onload = () => {
              const node = view.state.schema.nodes.databricksWidget.create({
                imageData: reader.result,
                title: 'Pasted widget',
                caption: '',
              });
              const tr = view.state.tr.replaceSelectionWith(node);
              view.dispatch(tr);
            };
            reader.readAsDataURL(file);
            return true;
          }
        }
        return false;
      },
    },
    onUpdate: ({ editor: activeEditor }) => {
      onContentChange(activeEditor.getJSON());
    },
  });

  useEffect(() => {
    if (editor) {
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);

  useEffect(() => {
    if (!editor || !initialContent) {
      return;
    }

    const current = JSON.stringify(editor.getJSON());
    const incoming = JSON.stringify(initialContent);
    if (current !== incoming) {
      editor.commands.setContent(initialContent);
    }
  }, [editor, initialContent]);

  return html`
    <div className="editor-body">
      <div className="editor-canvas">
        ${editor ? html`<${EditorContent} editor=${editor} />` : html`<p>Cargando editor…</p>`}
      </div>
    </div>
  `;
}
