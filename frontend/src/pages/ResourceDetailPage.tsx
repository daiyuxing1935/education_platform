import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { resourcesApi } from '../api/resources'
import type { ResourceDetail } from '../api/resources'
import MindmapRenderer from '../components/MindmapRenderer'
import VideoPlayer from '../components/VideoPlayer'
import { VideoIcon } from '../components/Icons'

/* ── Icons ── */
function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
    </svg>
  )
}
function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

export default function ResourceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [resource, setResource] = useState<ResourceDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState<'svg' | 'png' | null>(null)
  const [videoData, setVideoData] = useState<any>(null)

  const svgContainerRef = useRef<HTMLDivElement>(null)

  const loadResource = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const res = await resourcesApi.get(id)
      setResource(res.data)
      setEditContent(res.data.content)

      // 如果是视频类型，加载视频播放数据
      if (res.data.resource_type === 'video') {
        try {
          const playRes = await resourcesApi.videoPlay(id)
          setVideoData(playRes.data.html)
        } catch {
          console.warn('视频数据加载失败')
        }
      }
    } catch (e) {
      console.error('加载资源失败', e)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { loadResource() }, [loadResource])

  const handleSave = async () => {
    if (!resource || !id) return
    setSaving(true)
    try {
      const res = await resourcesApi.update(id, { content: editContent })
      setResource(res.data)
      setEditContent(res.data.content)
      setEditing(false)
    } catch (e: any) {
      alert(e.response?.data?.detail || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleExportSVG = () => {
    const container = svgContainerRef.current
    if (!container) return
    const svg = container.querySelector('svg')
    if (!svg) return

    setExporting('svg')
    try {
      const clone = svg.cloneNode(true) as SVGSVGElement
      const rect = svg.getBoundingClientRect()
      clone.setAttribute('width', String(Math.round(rect.width)))
      clone.setAttribute('height', String(Math.round(rect.height)))
      if (!clone.getAttribute('viewBox') && rect.width && rect.height) {
        clone.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`)
      }

      const serializer = new XMLSerializer()
      const svgStr = serializer.serializeToString(clone)
      const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${resource?.title || '思维导图'}.svg`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('SVG 导出失败', e)
    } finally {
      setExporting(null)
    }
  }

  const handleExportPNG = () => {
    const container = svgContainerRef.current
    if (!container) return
    const svg = container.querySelector('svg')
    if (!svg) return

    setExporting('png')
    try {
      const rect = svg.getBoundingClientRect()
      const width = Math.round(rect.width)
      const height = Math.round(rect.height)

      const clone = svg.cloneNode(true) as SVGSVGElement
      clone.setAttribute('width', String(width))
      clone.setAttribute('height', String(height))
      if (!clone.getAttribute('viewBox') && width && height) {
        clone.setAttribute('viewBox', `0 0 ${width} ${height}`)
      }

      const serializer = new XMLSerializer()
      let svgStr = serializer.serializeToString(clone)
      // Add XML declaration and ensure proper background
      svgStr = `<?xml version="1.0" encoding="UTF-8"?>${svgStr}`

      const canvas = document.createElement('canvas')
      canvas.width = width * 2
      canvas.height = height * 2
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // White background
      ctx.scale(2, 2)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, width, height)

      const img = new Image()
      const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(blob)

      img.onload = () => {
        ctx.drawImage(img, 0, 0, width, height)
        URL.revokeObjectURL(url)
        canvas.toBlob((pngBlob) => {
          if (!pngBlob) return
          const pngUrl = URL.createObjectURL(pngBlob)
          const a = document.createElement('a')
          a.href = pngUrl
          a.download = `${resource?.title || '思维导图'}.png`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(pngUrl)
          setExporting(null)
        }, 'image/png')
      }
      img.onerror = () => {
        console.error('PNG 导出失败：图片加载错误')
        setExporting(null)
      }
      img.src = url
    } catch (e) {
      console.error('PNG 导出失败', e)
      setExporting(null)
    }
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 60, color: 'var(--gray-400)' }}>加载中...</div>
  }

  if (!resource) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <p style={{ color: 'var(--gray-400)', marginBottom: 'var(--space-4)' }}>资源不存在</p>
        <Link to="/resources" className="btn btn-primary">返回资源列表</Link>
      </div>
    )
  }

  const sourceLabels: Record<string, string> = {
    chat_gap: 'AI对话自动生成',
    wrong_answer: '答题推荐',
    manual: '手动生成',
  }

  return (
    <div style={{ padding: 'var(--space-4) var(--space-8)' }}>
      {/* Navigation */}
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <Link to="/resources" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--gray-500)', fontSize: '0.875rem' }}>
          <BackIcon /> 返回资源列表
        </Link>
      </div>

      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-4)',
      }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-heading)', margin: 0 }}>
            {resource.title}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, fontSize: '0.8125rem', color: 'var(--gray-400)' }}>
            <span>{sourceLabels[resource.source || ''] || resource.source || '未知来源'}</span>
            <span>·</span>
            <span>{resource.created_at ? new Date(resource.created_at).toLocaleDateString('zh-CN') : ''}</span>
            <span>·</span>
            {(resource.knowledge_points || []).map(kp => (
              <span key={kp} style={{
                fontSize: '0.6875rem', padding: '1px 6px', borderRadius: 10,
                backgroundColor: 'oklch(0.55 0.2 250 / 0.1)', color: 'var(--primary)',
              }}>
                {kp}
              </span>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {resource.resource_type === 'video' ? (
            <span style={{ fontSize: '0.8125rem', padding: '4px 10px', borderRadius: 12, background: '#fef3c7', color: '#d97706' }}>
              <VideoIcon size={12} /> 视频资源
            </span>
          ) : !editing ? (
            <>
              <button className="btn btn-secondary" onClick={() => setEditing(true)} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <EditIcon /> 编辑
              </button>
              <button className="btn btn-secondary" onClick={handleExportSVG} disabled={exporting === 'svg'}>
                {exporting === 'svg' ? '导出中...' : '导出 SVG'}
              </button>
              <button className="btn btn-primary" onClick={handleExportPNG} disabled={exporting === 'png'}>
                {exporting === 'png' ? '导出中...' : '导出 PNG'}
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? '保存中...' : '保存'}
              </button>
              <button className="btn btn-secondary" onClick={() => { setEditing(false); setEditContent(resource.content) }} disabled={saving}>
                取消
              </button>
            </>
          )}
        </div>
      </div>

      {/* Video Type Content */}
      {resource.resource_type === 'video' ? (
        videoData ? (
          <VideoPlayer data={videoData} />
        ) : (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--gray-400)' }}>
            <p>视频数据加载中...</p>
          </div>
        )
      ) : editing ? (
        <div style={{ display: 'flex', gap: 'var(--space-4)', height: 'calc(100vh - 260px)', minHeight: 400 }}>
          <div style={{ flex: '0 0 45%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginBottom: 4 }}>编辑 Markdown 内容</div>
            <textarea
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              style={{
                flex: 1, width: '100%', padding: 12, border: '1px solid var(--gray-200)',
                borderRadius: 'var(--radius-md)', fontSize: '0.8125rem', fontFamily: 'monospace',
                outline: 'none', resize: 'none', lineHeight: 1.6,
              }}
            />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginBottom: 4 }}>预览</div>
            <div ref={svgContainerRef} style={{ flex: 1, border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              <MindmapRenderer content={editContent} height="100%" />
            </div>
          </div>
        </div>
      ) : (
        <div ref={svgContainerRef} style={{
          border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-lg)',
          overflow: 'hidden', height: 'calc(100vh - 260px)', minHeight: 400,
          background: '#fff',
        }}>
          <MindmapRenderer content={resource.content} height="100%" />
        </div>
      )}
    </div>
  )
}
