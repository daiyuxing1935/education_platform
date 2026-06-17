import { useEffect, useRef, useCallback, useState } from 'react'
import { Transformer } from 'markmap-lib'
import { Markmap } from 'markmap-view'
import type { IMarkmapOptions } from 'markmap-common'

interface MindmapRendererProps {
  content: string
  height?: string | number
  className?: string
}

const defaultOptions: Partial<IMarkmapOptions> = {
  maxWidth: 300,
  pan: true,
  duration: 300,
  spacingHorizontal: 16,
  spacingVertical: 8,
  paddingX: 16,
  nodeMinHeight: 8,
  autoFit: true,
  fitRatio: 0.8,
}

export default function MindmapRenderer({ content, height = 400, className }: MindmapRendererProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const markmapRef = useRef<Markmap | null>(null)
  const [fitKey, setFitKey] = useState(0) // trigger fit on content change

  // Initialize markmap instance
  useEffect(() => {
    if (!svgRef.current) return
    if (!markmapRef.current) {
      markmapRef.current = Markmap.create(svgRef.current, defaultOptions)
    }
    return () => {
      if (markmapRef.current) {
        markmapRef.current.destroy()
        markmapRef.current = null
      }
    }
  }, [])

  // Update data when content changes
  useEffect(() => {
    if (!markmapRef.current || !content?.trim()) return
    try {
      const transformer = new Transformer()
      const { root } = transformer.transform(content)
      markmapRef.current.setData(root)
      setFitKey(k => k + 1)
    } catch (e) {
      console.warn('Mindmap render error:', e)
    }
  }, [content])

  // Fit to container after data update
  useEffect(() => {
    if (!fitKey || !markmapRef.current) return
    const timer = setTimeout(() => {
      markmapRef.current?.fit()
    }, 100)
    return () => clearTimeout(timer)
  }, [fitKey])

  const handleZoomIn = useCallback(() => {
    markmapRef.current?.rescale(1.3)
  }, [])

  const handleZoomOut = useCallback(() => {
    markmapRef.current?.rescale(0.75)
  }, [])

  const handleFit = useCallback(() => {
    markmapRef.current?.fit()
  }, [])

  const containerStyle: React.CSSProperties = {
    width: '100%',
    height: typeof height === 'number' ? height : height,
    overflow: 'hidden',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }

  return (
    <div style={containerStyle} className={className}>
      <svg ref={svgRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      {!content?.trim() && (
        <div style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          color: 'var(--app-text-placeholder)',
          fontSize: '14px',
          pointerEvents: 'none',
        }}>
          暂无内容
        </div>
      )}
      <div style={{
        position: 'absolute',
        bottom: 12, right: 12,
        display: 'flex', gap: 2,
        opacity: 0.4,
        transition: 'opacity 0.2s',
      }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '0.4')}
      >
        <button onClick={handleZoomIn} title="放大" style={zoomBtnStyle}>＋</button>
        <button onClick={handleZoomOut} title="缩小" style={zoomBtnStyle}>−</button>
        <button onClick={handleFit} title="适应窗口" style={zoomBtnStyle}>⟲</button>
      </div>
    </div>
  )
}

const zoomBtnStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  border: '1px solid #e5e7eb',
  borderRadius: 5,
  background: '#fff',
  cursor: 'pointer',
  fontSize: 14,
  lineHeight: '1',
  color: '#555',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}
