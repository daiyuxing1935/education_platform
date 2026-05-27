import { useRef } from 'react'
import { DrawIoEmbed, type DrawIoEmbedRef } from 'react-drawio'

interface InlineDiagramPreviewProps {
  xml: string
  onEdit?: (xml: string) => void
}

function extractDiagramName(xml: string): string {
  const match = xml.match(/diagram\s+name="([^"]+)"/)
  return match ? match[1] : '流程图'
}

export default function InlineDiagramPreview({ xml, onEdit }: InlineDiagramPreviewProps) {
  const drawioRef = useRef<DrawIoEmbedRef>(null)
  const diagramName = extractDiagramName(xml)

  return (
    <div style={{
      marginTop: 'var(--space-3)',
      border: '1px solid var(--gray-200)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      position: 'relative',
      background: '#fff',
    }}>
      {/* Header bar with diagram name and edit button */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.375rem 0.75rem',
        backgroundColor: 'var(--gray-50)',
        borderBottom: '1px solid var(--gray-100)',
        fontSize: '0.75rem',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem',
          color: 'var(--gray-500)',
          fontWeight: 500,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {diagramName}
          </span>
        </div>
        <button
          onClick={() => onEdit?.(xml)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            padding: '0.2rem 0.5rem',
            fontSize: '0.7rem',
            border: '1px solid var(--gray-200)',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'white',
            color: 'var(--gray-600)',
            cursor: 'pointer',
            fontWeight: 500,
            flexShrink: 0,
            transition: 'border-color 0.15s, color 0.15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'var(--primary)'
            e.currentTarget.style.color = 'var(--primary)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'var(--gray-200)'
            e.currentTarget.style.color = 'var(--gray-600)'
          }}
          title="在编辑器中打开"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          编辑
        </button>
      </div>

      {/* Diagram viewer */}
      <div style={{ height: 300, width: '100%', position: 'relative' }}>
        <DrawIoEmbed
          ref={drawioRef}
          xml={xml}
          urlParameters={{
            ui: 'min',
            chrome: true,
            spin: true,
            nav: true,
            layers: true,
            noSaveBtn: true,
            noExitBtn: true,
            saveAndExit: false,
          }}
        />
      </div>
    </div>
  )
}
