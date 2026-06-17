import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import 'katex/dist/katex.min.css'

// 转换 LaTeX 定界符：\( → $, \[ → $$
function preprocessMath(text: string): string {
  if (!text) return text
  return text.replace(/\\\(/g, '$').replace(/\\\)/g, '$').replace(/\\\[/g, '$$').replace(/\\\]/g, '$$')
}

// 清理 Markdown 源码：去除前导空白和解包裹 fences
function cleanMarkdown(text: string): string {
  if (!text) return text
  // 去除每行前导空白
  let cleaned = text.replace(/^[ \t]+/gm, '')
  // 解包裹 ```markdown 或 ``` 代码 fence
  cleaned = cleaned.replace(/^```(?:markdown)?\s*\n?([\s\S]*?)```\s*$/m, '$1')
  return cleaned.trim()
}

export default function MarkdownRenderer({ content: rawContent, inline }: { content: string; inline?: boolean }) {
  // 安全转换非字符串内容
  const content = typeof rawContent === 'string' ? rawContent : (rawContent ? String(rawContent) : '')
  if (!content) return null
  const processed = preprocessMath(cleanMarkdown(content))
  if (inline) {
    return <span style={{ lineHeight: 1.7 }}>{processed}</span>
  }
  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath, remarkGfm]}
      rehypePlugins={[rehypeKatex]}
      components={{
        p: ({ children }) => <span style={{ display: 'block', marginBottom: '4px', lineHeight: 1.7 }}>{children}</span>,
        ul: ({ children }) => <div style={{ margin: '4px 0', paddingLeft: '20px' }}>{children}</div>,
        ol: ({ children }) => <div style={{ margin: '4px 0', paddingLeft: '20px' }}>{children}</div>,
        li: ({ children }) => <div style={{ marginBottom: '2px', lineHeight: 1.7 }}>• {children}</div>,
        code: ({ children, className }) => {
          const codeStr = String(children).replace(/\n$/, '')
          const [copied, setCopied] = useState(false)
          if (className) {
            // 块级代码 → 添加复制按钮
            return (
              <div style={{ position: 'relative', margin: '8px 0' }}>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(codeStr).then(() => {
                      setCopied(true)
                      setTimeout(() => setCopied(false), 2000)
                    })
                  }}
                  style={{
                    position: 'absolute', top: 6, right: 6,
                    padding: '2px 10px', borderRadius: 4, border: 'none',
                    fontSize: 11, cursor: 'pointer',
                    background: copied ? '#10B981' : 'rgba(255,255,255,0.15)',
                    color: copied ? '#fff' : 'rgba(255,255,255,0.8)',
                    transition: 'all 0.2s', zIndex: 1,
                  }}
                >
                  {copied ? '已复制' : '复制'}
                </button>
                <code style={{
                  display: 'block', background: 'var(--app-text-heading)',
                  color: 'var(--app-border)', padding: '28px 14px 10px',
                  borderRadius: 8, fontSize: '13px', overflowX: 'auto',
                  lineHeight: 1.5, position: 'relative',
                }}>
                  {children}
                </code>
              </div>
            )
          }
          // 行内代码
          return <code style={{ background: 'var(--app-bg-page)', padding: '1px 4px', borderRadius: 4, fontSize: '13px' }}>{children}</code>
        },
        strong: ({ children }) => <strong style={{ fontWeight: 600 }}>{children}</strong>,
      }}
    >
      {processed}
    </ReactMarkdown>
  )
}
