import React, { useEffect } from 'react';
import htm from 'htm';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { DatabricksWidget } from './WidgetExtension.js';

const html = htm.bind(React.createElement);

export function DocumentEditor({ initialContent, onEditorReady, onContentChange }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Placeholder.configure({
        placeholder: 'Comienza a escribir tu reporte. Inserta widgets del dashboard desde la barra o la biblioteca lateral.',
      }),
      DatabricksWidget,
    ],
    content: initialContent,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        spellcheck: 'true',
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
