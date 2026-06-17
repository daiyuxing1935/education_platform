import { useState, useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'

/* ── Toolbar Icons ── */

function BoldIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z"/></svg> }
function ItalicIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z"/></svg> }
function Heading1Icon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M3 5v14h2v-6h4v6h2V5H9v5H5V5H3zm15 0h-2v10.5c-.45-.33-1-.5-1.5-.5-1.1 0-2 .9-2 2s.9 2 2 2c.83 0 1.55-.48 1.88-1.18.15.72.78 1.18 1.62 1.18 1.1 0 2-.9 2-2V5z"/></svg> }
function Heading2Icon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M3 5v14h2v-6h4v6h2V5H9v5H5V5H3zm15 0h-2v10.5c-.45-.33-1-.5-1.5-.5-1.1 0-2 .9-2 2s.9 2 2 2c.83 0 1.55-.48 1.88-1.18.15.72.78 1.18 1.62 1.18 1.1 0 2-.9 2-2V5z"/></svg> }
function ListIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/></svg> }
function OrderedListIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm1-9h1V4H2v1h1v3zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 10.9V10H2v1zm5-6v2h14V5H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z"/></svg> }
function CodeIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/></svg> }
function QuoteIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z"/></svg> }
function UndoIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg> }
function RedoIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/></svg> }
function MarkdownIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 5h18v14H3V5z"/><path d="M8 15V9l3 3 3-3v6"/></svg> }

interface Props {
  content: string    // Markdown content
  onChange: (markdown: string) => void
  placeholder?: string
}

export default function RichTextEditor({ content, onChange, placeholder }: Props) {
  const [isRichMode, setIsRichMode] = useState(true)

  /* Lazy convert markdown->html for TipTap */
  const htmlContent = (() => {
    try {
      // Use a simple markdown-to-HTML for the editor
      const md = content || ''
      let html = md
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/^# (.*$)/gm, '<h1>$1</h1>')
        .replace(/^## (.*$)/gm, '<h2>$1</h2>')
        .replace(/^### (.*$)/gm, '<h3>$1</h3>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/^- (.*$)/gm, '<li>$1</li>')
        .replace(/^\d\. (.*$)/gm, '<li>$1</li>')
        .replace(/\n{2,}/g, '</p><p>')
        .replace(/\n/g, '<br/>')
      if (!html.startsWith('<')) {
        html = '<p>' + html + '</p>'
      }
      // Wrap consecutive <li> in <ul>
      html = html.replace(/((?:<li>.*?<\/li>\s*)+)/g, '<ul>$1</ul>')
      return html
    } catch {
      return '<p></p>'
    }
  })()

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({ placeholder: placeholder || '在此输入内容...' }),
    ],
    content: htmlContent,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      // Convert HTML back to Markdown
      const markdown = htmlToMarkdown(html)
      onChange(markdown)
    },
    editorProps: {
      attributes: {
        class: 'rich-text-editor',
        style: 'outline: none; min-height: 200px; padding: var(--space-4); font-size: 0.9375rem; line-height: 1.7;',
      },
    },
  })

  const [turndownInstance, setTurndownInstance] = useState<any>(null)
  const [turndownLoaded, setTurndownLoaded] = useState(false)

  useEffect(() => {
    import('turndown').then(mod => {
      const Turndown = mod.default || mod
      const t = new Turndown()
      t.addRule('strikethrough', {
        filter: (node: any) => node && ['s', 'del', 'strike'].includes(node.nodeName?.toLowerCase()),
        replacement: (content: string) => `~~${content}~~`,
      })
      setTurndownInstance(t)
      setTurndownLoaded(true)
    }).catch(() => setTurndownLoaded(false))
  }, [])

  const htmlToMarkdown = (html: string): string => {
    if (turndownInstance && turndownLoaded) {
      try {
        return turndownInstance.turndown(html)
      } catch {}
    }
    // Fallback: basic conversion
    return html
      .replace(/<h1>(.*?)<\/h1>/gi, '# $1\n\n')
      .replace(/<h2>(.*?)<\/h2>/gi, '## $1\n\n')
      .replace(/<h3>(.*?)<\/h3>/gi, '### $1\n\n')
      .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
      .replace(/<em>(.*?)<\/em>/gi, '*$1*')
      .replace(/<code>(.*?)<\/code>/gi, '`$1`')
      .replace(/<li>(.*?)<\/li>/gi, '- $1\n')
      .replace(/<p>(.*?)<\/p>/gi, '$1\n\n')
      .replace(/<br\/?>/gi, '\n')
      .replace(/<\/?[^>]*>/g, '')
      .trim()
  }

  if (!editor) return null

  const ToolBtn = ({ onClick, active, title, children }: { onClick: () => void; active?: boolean; title?: string; children: React.ReactNode }) => (
    <button type="button" onClick={onClick} title={title}
      style={{
        padding: '4px 6px', border: '1px solid transparent',
        borderRadius: 'var(--radius-sm)', background: active ? 'oklch(0.55 0.25 250 / 0.1)' : 'transparent',
        color: active ? 'var(--primary)' : 'var(--gray-500)', cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all var(--transition-fast)',
      }}>
      {children}
    </button>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar + mode toggle */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 2, padding: 'var(--space-2) var(--space-3)',
        borderBottom: '1px solid var(--gray-100)', flexWrap: 'wrap', flexShrink: 0,
      }}>
        <ToolBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="加粗"><BoldIcon /></ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="斜体"><ItalicIcon /></ToolBtn>
        <span style={{ width: 1, height: 18, backgroundColor: 'var(--gray-200)', margin: '0 4px' }} />
        <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="标题1"><Heading1Icon /></ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="标题2"><Heading2Icon /></ToolBtn>
        <span style={{ width: 1, height: 18, backgroundColor: 'var(--gray-200)', margin: '0 4px' }} />
        <ToolBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="无序列表"><ListIcon /></ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="有序列表"><OrderedListIcon /></ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} title="行内代码"><CodeIcon /></ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="引用"><QuoteIcon /></ToolBtn>
        <span style={{ width: 1, height: 18, backgroundColor: 'var(--gray-200)', margin: '0 4px' }} />
        <ToolBtn onClick={() => editor.chain().focus().undo().run()} title="撤销"><UndoIcon /></ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().redo().run()} title="重做"><RedoIcon /></ToolBtn>
        <div style={{ flex: 1 }} />
        <button type="button" onClick={() => setIsRichMode(!isRichMode)}
          style={{
            padding: '4px 8px', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-sm)',
            background: isRichMode ? 'transparent' : 'oklch(0.55 0.25 250 / 0.1)',
            color: isRichMode ? 'var(--gray-500)' : 'var(--primary)',
            cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 4,
          }}>
          <MarkdownIcon />
          {isRichMode ? 'Markdown' : '可视化'}
        </button>
      </div>

      {/* Editor */}
      {isRichMode ? (
        <EditorContent editor={editor} style={{ flex: 1, overflow: 'auto' }} />
      ) : (
        <textarea
          value={content}
          onChange={e => onChange(e.target.value)}
          style={{
            flex: 1, border: 'none', outline: 'none', resize: 'none',
            padding: 'var(--space-4)', fontSize: '0.875rem', lineHeight: 1.7,
            fontFamily: 'ui-monospace, monospace', color: 'var(--gray-800)',
          }}
        />
      )}
    </div>
  )
}
