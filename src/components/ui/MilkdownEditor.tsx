import { MilkdownProvider, Milkdown, useEditor } from '@milkdown/react'
import { Editor, rootCtx, defaultValueCtx } from '@milkdown/kit/core'
import { commonmark } from '@milkdown/kit/preset/commonmark'
import { history } from '@milkdown/kit/plugin/history'
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener'
import { clipboard } from '@milkdown/kit/plugin/clipboard'
import { indent } from '@milkdown/kit/plugin/indent'
import { trailing } from '@milkdown/kit/plugin/trailing'
import { formatToolbar, configureFormatToolbar } from '@/lib/milkdown-toolbar-plugin'
import { nord } from '@milkdown/theme-nord'
import '@milkdown/theme-nord/style.css'

interface MilkdownEditorProps {
  defaultValue: string
  onChange: (markdown: string) => void
}

function MilkdownInner({ defaultValue, onChange }: MilkdownEditorProps) {
  useEditor((root) => {
    return Editor.make()
      .config(nord)
      .config((ctx) => {
        ctx.set(rootCtx, root)
        ctx.set(defaultValueCtx, defaultValue)
        ctx.get(listenerCtx).markdownUpdated((_ctx, markdown) => {
          onChange(markdown)
        })
      })
      .config(configureFormatToolbar)
      .use(commonmark)
      .use(history)
      .use(listener)
      .use(clipboard)
      .use(indent)
      .use(trailing)
      .use(formatToolbar)
  }, [])

  return <Milkdown />
}

export function MilkdownEditor(props: MilkdownEditorProps) {
  return (
    <MilkdownProvider>
      <div className="milkdown-editor-root">
        <MilkdownInner {...props} />
      </div>

      {/* Strip Nord's container chrome so the editor is invisible — just text on the page */}
      <style>{`
        .milkdown-editor-root .milkdown {
          background: transparent;
          border: none;
          box-shadow: none;
          padding: 0;
          outline: none;
        }
        .milkdown-editor-root .editor,
        .milkdown-editor-root .ProseMirror {
          background: transparent;
          border: none;
          box-shadow: none;
          padding: 0;
          outline: none;
          min-height: 40vh;
          font-size: 15px;
          line-height: 1.7;
        }
        .milkdown-editor-root .ProseMirror h1 {
          font-family: var(--font-display, 'Manrope', sans-serif);
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--color-on-surface);
          margin-bottom: 0.75rem;
          margin-top: 1.5rem;
        }
        .milkdown-editor-root .ProseMirror h2 {
          font-family: var(--font-display, 'Manrope', sans-serif);
          font-size: 1.25rem;
          font-weight: 600;
          color: var(--color-on-surface);
          margin-bottom: 0.5rem;
          margin-top: 1.25rem;
        }
        .milkdown-editor-root .ProseMirror h3 {
          font-family: var(--font-display, 'Manrope', sans-serif);
          font-size: 1.1rem;
          font-weight: 600;
          color: var(--color-on-surface);
          margin-bottom: 0.5rem;
          margin-top: 1rem;
        }
        .milkdown-editor-root .ProseMirror p {
          color: var(--color-on-surface);
          margin-bottom: 0.75rem;
        }
        .milkdown-editor-root .ProseMirror a {
          color: var(--color-primary);
          text-decoration: none;
        }
        .milkdown-editor-root .ProseMirror a:hover {
          text-decoration: underline;
        }
        .milkdown-editor-root .ProseMirror code {
          background: var(--color-surface-container-high);
          border-radius: 4px;
          padding: 2px 6px;
          font-size: 0.8em;
        }
        .milkdown-editor-root .ProseMirror pre {
          background: var(--color-surface-container-high);
          border-radius: 12px;
          padding: 1rem;
          margin-bottom: 0.75rem;
          overflow-x: auto;
        }
        .milkdown-editor-root .ProseMirror blockquote {
          border-left: 2px solid var(--color-outline-variant);
          padding-left: 1rem;
          color: var(--color-on-surface-variant);
          margin-bottom: 0.75rem;
        }
        .milkdown-editor-root .ProseMirror ul {
          list-style: disc;
          padding-left: 1.5rem;
          margin-bottom: 0.75rem;
        }
        .milkdown-editor-root .ProseMirror ol {
          list-style: decimal;
          padding-left: 1.5rem;
          margin-bottom: 0.75rem;
        }
        .milkdown-editor-root .ProseMirror li {
          color: var(--color-on-surface);
          margin-bottom: 0.25rem;
        }
        .milkdown-editor-root .ProseMirror hr {
          border: none;
          border-top: 1px solid var(--color-outline-variant);
          margin: 1.5rem 0;
        }
        .milkdown-editor-root .ProseMirror p.is-editor-empty:first-child::before {
          content: 'Start writing...';
          color: var(--color-on-surface-variant);
          opacity: 0.4;
          float: left;
          pointer-events: none;
          height: 0;
        }
      `}</style>
    </MilkdownProvider>
  )
}
