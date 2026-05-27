import { forwardRef, useRef, useState, useImperativeHandle, useEffect } from 'react'
import { DrawIoEmbed, type DrawIoEmbedRef } from 'react-drawio'

export interface DrawioEditorHandle {
  loadDiagram: (xml: string) => void
  getCurrentXml: () => string | null
}

interface DrawioEditorProps {
  visible: boolean
  xml?: string | null
  onDiagramChange?: (xml: string) => void
  onClose?: () => void
}

function extractDiagramName(xml: string): string {
  const match = xml.match(/diagram\s+name="([^"]+)"/)
  return match ? match[1] : 'Diagram'
}

const DrawioEditor = forwardRef<DrawioEditorHandle, DrawioEditorProps>(
  ({ visible, xml, onDiagramChange, onClose }, ref) => {
    const drawioRef = useRef<DrawIoEmbedRef>(null)
    const [currentXml, setCurrentXml] = useState<string | null>(null)
    const [diagramName, setDiagramName] = useState('Diagram')
    const [editorReady, setEditorReady] = useState(false)
    const pendingXmlRef = useRef<string | null>(null)
    const pendingExportRef = useRef<string | null>(null)

    useImperativeHandle(ref, () => ({
      loadDiagram: (xml: string) => {
        setCurrentXml(xml)
        setDiagramName(extractDiagramName(xml))
        if (editorReady && drawioRef.current) {
          try {
            drawioRef.current.load({ xml })
          } catch (e) {
            console.error('[DrawioEditor] load failed:', e)
          }
        } else {
          // Queue XML for when editor is ready
          pendingXmlRef.current = xml
        }
      },
      getCurrentXml: () => currentXml,
    }))

    // Load diagram when xml prop changes (e.g. clicking edit on an inline diagram)
    useEffect(() => {
      if (xml) {
        setCurrentXml(xml)
        setDiagramName(extractDiagramName(xml))
        if (editorReady && drawioRef.current) {
          try {
            drawioRef.current.load({ xml })
          } catch (e) {
            console.error('[DrawioEditor] load xml prop failed:', e)
          }
        } else {
          pendingXmlRef.current = xml
        }
      }
    }, [xml])

    const handleExportEvent = (data: { event: string; data?: string; xml?: string }) => {
      if (data.xml) {
        setCurrentXml(data.xml)
        onDiagramChange?.(data.xml)
      }
      // Download exported image when triggered by button click
      if (data.data && pendingExportRef.current) {
        const format = pendingExportRef.current
        pendingExportRef.current = null
        const mimeType = format === 'svg' ? 'image/svg+xml' : 'image/png'
        const link = document.createElement('a')
        link.href = `data:${mimeType};base64,${data.data}`
        link.download = `${diagramName}.${format}`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }
    }

    const handleExportPng = () => {
      pendingExportRef.current = 'png'
      drawioRef.current?.exportDiagram({ format: 'png', scale: 2 })
    }

    const handleExportSvg = () => {
      pendingExportRef.current = 'svg'
      drawioRef.current?.exportDiagram({ format: 'svg' })
    }

    const handleLoad = () => {
      setEditorReady(true)
      // Load pending XML if exists
      if (pendingXmlRef.current && drawioRef.current) {
        try {
          drawioRef.current.load({ xml: pendingXmlRef.current })
        } catch (e) {
          console.error('[DrawioEditor] pending load failed:', e)
        }
        pendingXmlRef.current = null
      }
    }

    if (!visible) return null

    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'white' }}>
        {/* Header bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0.5rem 0.75rem',
          borderBottom: '1px solid var(--gray-100)',
          backgroundColor: 'var(--gray-50)',
          fontSize: '0.8125rem',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--primary)' }}>
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
            <span style={{ fontWeight: 600, fontFamily: 'var(--font-heading)', color: 'var(--gray-700)' }}>
              {diagramName}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <button
              onClick={handleExportPng}
              title="导出为 PNG"
              style={{
                padding: '0.25rem 0.5rem', fontSize: '0.7rem',
                border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-md)',
                background: 'white', cursor: 'pointer', color: 'var(--gray-500)',
                display: 'flex', alignItems: 'center', gap: '0.25rem',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              PNG
            </button>
            <button
              onClick={handleExportSvg}
              title="导出为 SVG"
              style={{
                padding: '0.25rem 0.5rem', fontSize: '0.7rem',
                border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-md)',
                background: 'white', cursor: 'pointer', color: 'var(--gray-500)',
                display: 'flex', alignItems: 'center', gap: '0.25rem',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              SVG
            </button>
            <button
              onClick={onClose}
              style={{
                padding: '0.25rem 0.5rem', fontSize: '0.75rem',
                border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-md)',
                background: 'white', cursor: 'pointer', color: 'var(--gray-500)',
                display: 'flex', alignItems: 'center', gap: '0.25rem',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
              Close
            </button>
          </div>
        </div>

        {/* Draw.io editor */}
        <div style={{ flex: 1, minHeight: 0 }}>
          <DrawIoEmbed
            ref={drawioRef}
            urlParameters={{
              ui: 'kennedy',
              spin: true,
              libraries: true,
              saveAndExit: false,
              noSaveBtn: true,
              noExitBtn: true,
            }}
            onExport={handleExportEvent}
            onLoad={handleLoad}
          />
        </div>
      </div>
    )
  }
)

DrawioEditor.displayName = 'DrawioEditor'

export default DrawioEditor
