import { useRef } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'

interface CodeEditorProps {
  code: string
  language?: string
  onChange?: (value: string) => void
  readOnly?: boolean
  height?: string | number
}

const COMMON_LANGUAGES = [
  { id: 'python', label: 'Python' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'java', label: 'Java' },
  { id: 'c', label: 'C' },
  { id: 'cpp', label: 'C++' },
  { id: 'go', label: 'Go' },
  { id: 'rust', label: 'Rust' },
  { id: 'html', label: 'HTML' },
  { id: 'css', label: 'CSS' },
  { id: 'bash', label: 'Bash' },
  { id: 'sql', label: 'SQL' },
]

const EDITOR_OPTIONS: editor.IStandaloneEditorConstructionOptions = {
  minimap: { enabled: true },
  fontSize: 13,
  fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace",
  lineNumbers: 'on',
  renderLineHighlight: 'line',
  scrollBeyondLastLine: false,
  automaticLayout: true,
  tabSize: 2,
  wordWrap: 'on',
  smoothScrolling: true,
  cursorBlinking: 'smooth',
  cursorSmoothCaretAnimation: 'on',
  bracketPairColorization: { enabled: true },
  autoIndent: 'full',
  formatOnPaste: true,
  suggestOnTriggerCharacters: true,
  quickSuggestions: true,
  folding: true,
  foldingHighlight: true,
  lineDecorationsWidth: 8,
  padding: { top: 8, bottom: 8 },
}

export default function CodeEditor({ code, language, onChange, readOnly = false, height = '100%' }: CodeEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)

  const handleEditorDidMount: OnMount = (editor) => {
    editorRef.current = editor
    editor.focus()
  }

  return (
    <Editor
      height={height}
      language={language || 'plaintext'}
      value={code}
      onChange={(val) => onChange?.(val || '')}
      onMount={handleEditorDidMount}
      theme="vs-dark"
      options={{
        ...EDITOR_OPTIONS,
        readOnly,
        domReadOnly: readOnly,
      }}
      loading={
        <div style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--gray-400)',
          fontSize: '0.875rem',
          backgroundColor: '#1e1e1e',
        }}>
          加载编辑器中...
        </div>
      }
    />
  )
}

export { COMMON_LANGUAGES }
