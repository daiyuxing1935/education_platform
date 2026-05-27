import { useRef } from 'react'
import { DrawIoEmbed, type DrawIoEmbedRef } from 'react-drawio'

interface DiagramImageProps {
  xml: string
  onEdit?: (xml: string) => void
}

export default function DiagramImage({ xml, onEdit }: DiagramImageProps) {
  const drawioRef = useRef<DrawIoEmbedRef>(null)

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
      <DrawIoEmbed
        ref={drawioRef}
        xml={xml}
        urlParameters={{
          lightbox: true,
          spin: true,
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
