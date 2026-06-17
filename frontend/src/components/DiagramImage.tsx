import { useState, useEffect, useRef, useCallback } from 'react'
import { DrawIoEmbed, type DrawIoEmbedRef } from 'react-drawio'
import { DRAWIO_CONFIG } from '../utils/drawio-config'

interface DiagramImageProps {
  xml: string
  onEdit?: (xml: string) => void
}

export default function DiagramImage({ xml, onEdit }: DiagramImageProps) {
  const drawioRef = useRef<DrawIoEmbedRef>(null)
  const [loadError, setLoadError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [retryKey, setRetryKey] = useState(0)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reset + start timeout when xml or retryKey changes
  useEffect(() => {
    setIsLoading(true)
    setLoadError(false)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)

    // Fallback timeout — if iframe doesn't fire onLoad within configured time
    timeoutRef.current = setTimeout(() => {
      setIsLoading(false)
      setLoadError(true)
    }, DRAWIO_CONFIG.timeoutMs)

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [xml, retryKey])

  // 当 iframe 加载完成时调用（React 原生事件，跨域安全）
  const handleIframeLoad = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setIsLoading(false)
    setLoadError(false)
  }, [])

  const handleRetry = useCallback(() => {
    setRetryKey(k => k + 1)
  }, [])

  // Fallback when draw.io fails to load
  if (loadError) {
    return (
      <div style={{
        margin: '0.75rem 0',
        padding: '1rem',
        backgroundColor: '#FFFBEB',
        borderRadius: 'var(--radius-md)',
        border: '1px solid #FDE68A',
        textAlign: 'center',
        color: '#92400E',
        fontSize: '0.875rem',
      }}>
        <p style={{ margin: 0, marginBottom: '0.5rem' }}>
          ⚠️ 图表加载超时，请检查网络连接后重试。
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button onClick={handleRetry} className="btn btn-secondary" style={{ fontSize: '0.8125rem' }}>
            🔄 重新加载
          </button>
          {onEdit && (
            <button onClick={() => onEdit(xml)} className="btn btn-secondary" style={{ fontSize: '0.8125rem' }}>
              ✏️ 在编辑器中打开
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      style={{ margin: '0.75rem 0', position: 'relative' }}
      onMouseEnter={e => {
        const btn = e.currentTarget.querySelector('.diagram-edit-btn') as HTMLElement
        if (btn) btn.style.opacity = '1'
      }}
      onMouseLeave={e => {
        const btn = e.currentTarget.querySelector('.diagram-edit-btn') as HTMLElement
        if (btn) btn.style.opacity = '0'
      }}
    >
      {isLoading && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'rgba(255,255,255,0.8)',
          borderRadius: 'var(--radius-md)',
          zIndex: 1,
          pointerEvents: 'none',
        }}>
          <span style={{ color: 'var(--gray-400)', fontSize: '0.875rem' }}>
            ⏳ 正在加载图表...
          </span>
        </div>
      )}
      <DrawIoEmbed
        key={retryKey}
        ref={drawioRef}
        xml={xml}
        baseUrl={DRAWIO_CONFIG.baseUrl}
        onLoad={handleIframeLoad}
        urlParameters={{
          lightbox: true,
          spin: false,
          nav: false,
          layers: false,
        }}
      />
      {onEdit && (
        <button
          className="diagram-edit-btn"
          onClick={() => onEdit(xml)}
          title="在编辑器中打开"
          style={{
            position: 'absolute',
            top: '0.5rem',
            right: '0.5rem',
            opacity: 0,
            transition: 'opacity 0.15s',
            padding: '0.25rem 0.5rem',
            fontSize: '0.7rem',
            border: '1px solid var(--gray-200)',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'white',
            color: 'var(--gray-600)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            fontWeight: 500,
            boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'var(--primary)'
            e.currentTarget.style.color = 'var(--primary)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'var(--gray-200)'
            e.currentTarget.style.color = 'var(--gray-600)'
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          编辑
        </button>
      )}
    </div>
  )
}
