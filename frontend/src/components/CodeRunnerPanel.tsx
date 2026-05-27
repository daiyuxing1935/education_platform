import { useState, useCallback } from 'react'
import CodeEditor from './CodeEditor'
import { autoCompleteCode, toMonacoLanguage, LANGUAGE_NAMES } from '../utils/codeRunner'

interface CodeRunnerPanelProps {
  code: string
  language: string
  onClose: () => void
}

type OutputItem = {
  type: 'stdout' | 'stderr' | 'system'
  text: string
  exitCode?: number
  executionTime?: number
}

function RunIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  )
}

function XCircleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="15" y1="9" x2="9" y2="15"/>
      <line x1="9" y1="9" x2="15" y2="15"/>
    </svg>
  )
}

export default function CodeRunnerPanel({ code: initialCode, language: initialLanguage, onClose }: CodeRunnerPanelProps) {
  const [currentCode, setCurrentCode] = useState(initialCode)
  const [currentLanguage, setCurrentLanguage] = useState(initialLanguage)
  const [output, setOutput] = useState<OutputItem[]>([])
  const [isRunning, setIsRunning] = useState(false)

  const handleRun = useCallback(async () => {
    setIsRunning(true)
    setOutput(prev => [...prev, { type: 'system', text: `$ ${currentLanguage} 代码运行中...` }])

    // Auto-complete boilerplate code
    const fullCode = autoCompleteCode(currentCode, currentLanguage)

    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch('/api/v1/code/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          language: currentLanguage,
          code: fullCode,
        }),
      })

      if (!response.ok) {
        const errText = await response.text().catch(() => '')
        let detail = '请求失败'
        try { const j = JSON.parse(errText); detail = j.detail || errText } catch { detail = errText }
        throw new Error(detail)
      }

      const result = await response.json()
      const newOutput: OutputItem[] = []

      if (result.stdout) {
        newOutput.push({ type: 'stdout', text: result.stdout })
      }
      if (result.stderr) {
        newOutput.push({ type: 'stderr', text: result.stderr })
      }

      const statusText = result.exit_code === 0
        ? `✓ 运行完成`
        : `✗ 退出代码: ${result.exit_code}`

      newOutput.push({
        type: 'system',
        text: `${statusText} (${result.execution_time}s)`,
        exitCode: result.exit_code,
        executionTime: result.execution_time,
      })

      setOutput(prev => {
        // Remove the "running..." message and add results
        const withoutRunning = prev.slice(0, -1)
        return [...withoutRunning, ...newOutput]
      })
    } catch (error: any) {
      setOutput(prev => {
        const withoutRunning = prev.slice(0, -1)
        return [...withoutRunning, { type: 'stderr', text: `运行失败: ${error.message}` }]
      })
    } finally {
      setIsRunning(false)
    }
  }, [currentCode, currentLanguage])

  const handleClear = useCallback(() => {
    setOutput([])
  }, [])

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#1e1e1e',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.375rem 0.625rem',
        borderBottom: '1px solid #333',
        flexShrink: 0,
        gap: '0.375rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flex: 1, minWidth: 0 }}>
          <span style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: '#ccc',
            fontFamily: 'var(--font-heading)',
            whiteSpace: 'nowrap',
          }}>
            代码运行器
          </span>
          <span style={{
            fontSize: '0.65rem',
            padding: '1px 6px',
            borderRadius: '3px',
            backgroundColor: '#2d2d2d',
            color: '#888',
          }}>
            {LANGUAGE_NAMES[currentLanguage] || currentLanguage}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          {/* Language selector */}
          <select
            value={currentLanguage}
            onChange={(e) => setCurrentLanguage(e.target.value)}
            style={{
              fontSize: '0.7rem',
              padding: '2px 6px',
              backgroundColor: '#2d2d2d',
              color: '#ccc',
              border: '1px solid #444',
              borderRadius: '3px',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            <option value="python">Python</option>
            <option value="javascript">JavaScript</option>
            <option value="java">Java</option>
            <option value="c">C</option>
            <option value="cpp">C++</option>
          </select>

          {/* Run button */}
          <button
            onClick={handleRun}
            disabled={isRunning}
            title="运行代码 (Ctrl+Enter)"
            style={{
              padding: '0.25rem 0.625rem',
              fontSize: '0.7rem',
              border: 'none',
              borderRadius: '3px',
              backgroundColor: isRunning ? '#1a5a2a' : '#2ea043',
              color: 'white',
              cursor: isRunning ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              fontWeight: 600,
              opacity: isRunning ? 0.7 : 1,
            }}
          >
            <RunIcon />
            {isRunning ? '运行中...' : '运行'}
          </button>

          {/* Clear output */}
          <button
            onClick={handleClear}
            disabled={output.length === 0}
            title="清空输出"
            style={{
              padding: '0.25rem 0.375rem',
              fontSize: '0.7rem',
              border: '1px solid #444',
              borderRadius: '3px',
              backgroundColor: '#2d2d2d',
              color: '#888',
              cursor: output.length === 0 ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              opacity: output.length === 0 ? 0.4 : 1,
            }}
          >
            <XCircleIcon />
            清空
          </button>

          {/* Close button */}
          <button
            onClick={onClose}
            title="关闭代码运行器"
            style={{
              padding: '0.25rem 0.375rem',
              fontSize: '0.7rem',
              border: '1px solid #444',
              borderRadius: '3px',
              backgroundColor: '#2d2d2d',
              color: '#888',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
            }}
          >
            <CloseIcon />
            关闭
          </button>
        </div>
      </div>

      {/* Code Editor */}
      <div style={{ flex: 1, minHeight: 0, borderBottom: '1px solid #333' }}>
        <CodeEditor
          code={currentCode}
          language={toMonacoLanguage(currentLanguage)}
          onChange={setCurrentCode}
        />
      </div>

      {/* Output */}
      <div style={{
        height: '35%',
        minHeight: '80px',
        maxHeight: '50%',
        overflowY: 'auto',
        backgroundColor: '#1a1a1a',
        padding: '0.5rem 0.75rem',
        fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
        fontSize: '0.75rem',
        lineHeight: 1.5,
      }}>
        {output.length === 0 ? (
          <div style={{ color: '#555', fontStyle: 'italic', userSelect: 'none' }}>
            {/* Hollow: prompt */}
            <span style={{ color: '#2ea043' }}>$</span>{' '}
            <span style={{ color: '#888' }}>点击"运行"按钮执行代码</span>
          </div>
        ) : (
          output.map((item, idx) => (
            <div key={idx} style={{
              marginBottom: '2px',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              color: item.type === 'stdout' ? '#d4d4d4'
                   : item.type === 'stderr' ? '#f48771'
                   : item.exitCode === 0 ? '#2ea043' : '#f48771',
            }}>
              {item.text}
            </div>
          ))
        )}
        {isRunning && (
          <div style={{ color: '#888', marginTop: '4px' }}>
            <span style={{ display: 'inline-block', animation: 'pulse 1.5s infinite' }}>●</span> 执行中...
          </div>
        )}
      </div>
    </div>
  )
}
