import { useState, useEffect, useRef } from 'react'
import { cloudDriveApi, type CloudFileDetail } from '../api/cloudDrive'
import MarkdownRenderer from './MarkdownRenderer'

interface Props {
  fileId: string
  fileName: string
  fileType: string
  onClose: () => void
  onEditWord?: (fileId: string, fileName: string) => void
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

function FileIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
    </svg>
  )
}

const FILE_ICONS: Record<string, { color: string; bg: string; label: string }> = {
  pdf: { color: 'var(--app-danger-dark)', bg: 'var(--app-bg-danger)', label: 'PDF' },
  docx: { color: 'var(--app-blue)', bg: '#eff6ff', label: 'Word' },
  doc: { color: 'var(--app-blue)', bg: '#eff6ff', label: 'Word' },
  pptx: { color: '#ea580c', bg: '#fff7ed', label: 'PPT' },
  ppt: { color: '#ea580c', bg: '#fff7ed', label: 'PPT' },
  image: { color: '#7c3aed', bg: '#f5f3ff', label: '图片' },
  txt: { color: 'var(--app-text-secondary)', bg: 'var(--app-bg-card-alt)', label: '文本' },
  md: { color: 'var(--app-text-secondary)', bg: 'var(--app-bg-card-alt)', label: 'Markdown' },
}

export default function FilePreviewModal({ fileId, fileName, fileType, onClose, onEditWord }: Props) {
  const [detail, setDetail] = useState<CloudFileDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [docxHtml, setDocxHtml] = useState('')
  const [previewText, setPreviewText] = useState('')
  const [previewSlides, setPreviewSlides] = useState<string[][] | null>(null)
  const [currentSlide, setCurrentSlide] = useState(0)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const iconInfo = FILE_ICONS[fileType] || { color: 'var(--app-text-secondary)', bg: 'var(--app-bg-card-alt)', label: '文件' }

  useEffect(() => {
    loadFile()
  }, [fileId])

  const loadFile = async () => {
    setLoading(true)
    setError('')
    try {
      const resp = await cloudDriveApi.getFileDetail(fileId)
      setDetail(resp.data)

      // 对不同类型做专门处理
      if (fileType === 'pdf') {
        // PDF 用 iframe 内嵌浏览器原生 PDF 查看器
        // 已通过 base64 获取到数据
      } else if (fileType === 'docx') {
        // DOCX 用 mammoth 转为 HTML
        try {
          const mammoth = await import('mammoth')
          const binaryStr = atob(resp.data.base64)
          const bytes = new Uint8Array(binaryStr.length)
          for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)
          const result = await mammoth.convertToHtml({ arrayBuffer: bytes.buffer })
          setDocxHtml(result.value)
        } catch {
          // 回退到文本预览
          loadPreviewText()
        }
      } else if (fileType === 'pptx' || fileType === 'ppt') {
        loadPreviewText()
      } else if (fileType === 'txt' || fileType === 'md') {
        const text = decodeBase64Text(resp.data.base64)
        setPreviewText(text)
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  const loadPreviewText = async () => {
    try {
      const resp = await fetch(`/api/v1/cloud-drive/files/${fileId}/preview-text`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
      })
      if (resp.ok) {
        const data = await resp.json()
        if (data.slides) {
          setPreviewSlides(data.slides)
        }
        if (data.text) {
          setPreviewText(data.text)
        }
      }
    } catch { /* ignore */ }
  }

  const decodeBase64Text = (base64: string): string => {
    try {
      return decodeURIComponent(Array.from(atob(base64), c =>
        '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
      ).join(''))
    } catch {
      return atob(base64)
    }
  }

  const getBlobUrl = () => {
    if (!detail) return ''
    const binaryStr = atob(detail.base64)
    const bytes = new Uint8Array(binaryStr.length)
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)
    const blob = new Blob([bytes], { type: detail.mime_type || 'application/octet-stream' })
    return URL.createObjectURL(blob)
  }

  const handleDownload = () => {
    cloudDriveApi.downloadFile(fileId, fileName)
  }

  const isImage = fileType === 'image'
  const isPdf = fileType === 'pdf'
  const isDocx = fileType === 'docx' || fileType === 'doc'
  const isPptx = fileType === 'pptx' || fileType === 'ppt'
  const isText = fileType === 'txt' || fileType === 'md'

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'oklch(0 0 0 / 0.6)', zIndex: 3000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'var(--space-4)', backdropFilter: 'blur(4px)',
      }}
    >
      <div
        className="fade-in"
        style={{
          width: '95%', maxWidth: '1000px', height: '90vh',
          backgroundColor: 'white', borderRadius: 'var(--radius-xl)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden', boxShadow: 'var(--shadow-xl)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: 'var(--space-4) var(--space-6)',
          borderBottom: '1px solid var(--gray-100)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minWidth: 0 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 32, borderRadius: 'var(--radius-md)',
              backgroundColor: iconInfo.bg, color: iconInfo.color,
              fontSize: '0.6875rem', fontWeight: 700, flexShrink: 0,
            }}>
              {iconInfo.label}
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontWeight: 600, fontSize: '0.9375rem',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                fontFamily: 'var(--font-heading)',
              }}>
                {fileName}
              </div>
              {detail && (
                <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginTop: 2 }}>
                  {cloudDriveApi.formatFileSize(detail.file_size)}
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
            {(fileType === 'docx' || fileType === 'doc') && onEditWord && (
              <button onClick={() => onEditWord(fileId, fileName)} title="编辑"
                style={{
                  padding: '8px 12px', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-md)',
                  background: 'white', cursor: 'pointer', color: 'var(--app-blue)',
                  display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8125rem',
                }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                编辑
              </button>
            )}
            <button onClick={handleDownload} title="下载"
              style={{
                padding: '8px', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-md)',
                background: 'white', cursor: 'pointer', color: 'var(--gray-500)',
                display: 'flex', alignItems: 'center',
              }}>
              <DownloadIcon />
            </button>
            <button onClick={onClose} title="关闭"
              style={{
                padding: '8px', border: 'none', borderRadius: 'var(--radius-md)',
                background: 'transparent', cursor: 'pointer', color: 'var(--gray-400)',
                display: 'flex', alignItems: 'center',
              }}>
              <CloseIcon />
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
          {loading ? (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: '100%', color: 'var(--gray-400)', fontSize: '0.875rem',
            }}>
              加载中...
            </div>
          ) : error ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              height: '100%', gap: 'var(--space-4)', padding: 'var(--space-8)', textAlign: 'center',
            }}>
              <FileIcon />
              <div style={{ color: 'var(--gray-500)', fontSize: '0.9375rem' }}>{error}</div>
              <button onClick={handleDownload} className="btn btn-primary">
                <DownloadIcon /> 下载文件
              </button>
            </div>
          ) : isImage ? (
            <div style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
              <img
                src={`data:${detail?.mime_type || 'image/png'};base64,${detail?.base64}`}
                alt={fileName}
                style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: 'var(--radius-md)' }}
              />
            </div>
          ) : isPdf ? (
            <iframe
              ref={iframeRef}
              src={getBlobUrl()}
              style={{ width: '100%', height: '100%', border: 'none' }}
              title={fileName}
            />
          ) : isDocx && docxHtml ? (
            <div
              className="markdown-content"
              style={{ padding: 'var(--space-8)', maxWidth: 800, margin: '0 auto', lineHeight: 1.8, fontSize: '0.9375rem' }}
              dangerouslySetInnerHTML={{ __html: docxHtml }}
            />
          ) : isPptx && previewSlides ? (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 'var(--space-8)', backgroundColor: 'var(--gray-50)',
              }}>
                <div style={{
                  width: '100%', maxWidth: 700, minHeight: 300,
                  backgroundColor: 'white', borderRadius: 'var(--radius-lg)',
                  padding: 'var(--space-8)', boxShadow: 'var(--shadow-lg)',
                  display: 'flex', flexDirection: 'column', justifyContent: 'center',
                }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginBottom: 'var(--space-3)', textAlign: 'center' }}>
                    幻灯片 {currentSlide + 1} / {previewSlides.length}
                  </div>
                  {(previewSlides[currentSlide] || []).length > 0 ? (
                    <ul style={{ fontSize: '1rem', lineHeight: 2, color: 'var(--gray-800)', paddingLeft: 'var(--space-5)', margin: 0 }}>
                      {previewSlides[currentSlide].map((t, i) => (
                        <li key={i}>{t}</li>
                      ))}
                    </ul>
                  ) : (
                    <div style={{ textAlign: 'center', color: 'var(--gray-400)' }}>此幻灯片无文字内容</div>
                  )}
                </div>
              </div>
              {previewSlides.length > 1 && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 'var(--space-3)', padding: 'var(--space-3)',
                  borderTop: '1px solid var(--gray-100)',
                }}>
                  <button
                    onClick={() => setCurrentSlide(s => Math.max(0, s - 1))}
                    disabled={currentSlide <= 0}
                    className="btn btn-secondary"
                    style={{ padding: '0.375rem 1rem', fontSize: '0.8125rem' }}
                  ><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ verticalAlign: 'middle', marginRight: 3 }}><polyline points="15 18 9 12 15 6"/></svg>上一页</button>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--gray-500)' }}>
                    {currentSlide + 1} / {previewSlides.length}
                  </span>
                  <button
                    onClick={() => setCurrentSlide(s => Math.min(previewSlides.length - 1, s + 1))}
                    disabled={currentSlide >= previewSlides.length - 1}
                    className="btn btn-secondary"
                    style={{ padding: '0.375rem 1rem', fontSize: '0.8125rem' }}
                  >下一页 <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ verticalAlign: 'middle', marginLeft: 3 }}><polyline points="9 18 15 12 9 6"/></svg></button>
                </div>
              )}
            </div>
          ) : isText ? (
            <div style={{ padding: 'var(--space-6)', maxWidth: 800, margin: '0 auto' }}>
              {fileType === 'md' ? (
                <MarkdownRenderer content={previewText} />
              ) : (
                <pre style={{
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  fontFamily: 'ui-monospace, monospace', fontSize: '0.8125rem',
                  lineHeight: 1.7, color: 'var(--gray-700)', margin: 0,
                }}>{previewText}</pre>
              )}
            </div>
          ) : (
            /* Fallback — 显示文本预览或下载按钮 */
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              height: '100%', gap: 'var(--space-4)', padding: 'var(--space-8)', textAlign: 'center',
            }}>
              <FileIcon />
              <div style={{ color: 'var(--gray-500)', fontSize: '0.9375rem' }}>
                此文件类型暂不支持在线预览
              </div>
              <button onClick={handleDownload} className="btn btn-primary">
                <DownloadIcon /> 下载文件
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
