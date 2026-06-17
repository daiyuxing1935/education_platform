import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { cloudDriveApi, type CloudFileInfo } from '../api/cloudDrive'
import FilePreviewModal from '../components/FilePreviewModal'
import MarkdownRenderer from '../components/MarkdownRenderer'
import RichTextEditor from '../components/RichTextEditor'

/* ── SVG Icons ── */

function ArrowLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
    </svg>
  )
}
function UploadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
  )
}
function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
  )
}
function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
  )
}
function FolderIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
  )
}
function ImageIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
  )
}
/* ── File type config ── */

const FILE_TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  folder: { label: '', color: 'var(--app-blue)', bg: '#eff6ff' },
  pdf: { label: 'PDF', color: 'var(--app-danger-dark)', bg: 'var(--app-bg-danger)' },
  docx: { label: 'Word', color: 'var(--app-blue)', bg: '#eff6ff' },
  doc: { label: 'Word', color: 'var(--app-blue)', bg: '#eff6ff' },
  pptx: { label: 'PPT', color: '#ea580c', bg: '#fff7ed' },
  ppt: { label: 'PPT', color: '#ea580c', bg: '#fff7ed' },
  image: { label: '图片', color: '#7c3aed', bg: '#f5f3ff' },
  txt: { label: '文本', color: 'var(--app-text-secondary)', bg: 'var(--app-bg-card-alt)' },
  md: { label: 'MD', color: 'var(--app-text-secondary)', bg: 'var(--app-bg-card-alt)' },
}

const TYPE_ACCEPT_MAP: Record<string, string> = {
  '': '*',
  docx: '.docx',
  pptx: '.pptx',
  pdf: '.pdf',
  image: '.png,.jpg,.jpeg,.gif,.bmp',
  txt: '.txt,.md',
}

const FILTER_TABS = [
  { key: '', label: '全部' },
  { key: 'folder', label: '文件夹' },
  { key: 'docx', label: 'Word' },
  { key: 'pptx', label: 'PPT' },
  { key: 'pdf', label: 'PDF' },
  { key: 'image', label: '图片' },
  { key: 'txt', label: '文本' },
]

/* ── Main Component ── */

export default function CloudDrivePage() {
  const navigate = useNavigate()
  const [files, setFiles] = useState<CloudFileInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState('')
  const [message, setMessage] = useState({ text: '', type: '' })

  // Folder navigation
  const [currentParentId, setCurrentParentId] = useState<string | null>(null)
  const [folderPath, setFolderPath] = useState<{ id: string; name: string }[]>([])

  // Upload
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const uploadAcceptRef = useRef('*')

  // New menu dropdown
  const [showNewMenu, setShowNewMenu] = useState(false)

  // Create folder
  const [showFolderModal, setShowFolderModal] = useState(false)
  const [folderName, setFolderName] = useState('')

  // Word editor
  const [showWordEditor, setShowWordEditor] = useState(false)
  const [wordFileName, setWordFileName] = useState('')
  const [wordContent, setWordContent] = useState('')
  const [wordSaving, setWordSaving] = useState(false)
  const [editingWordId, setEditingWordId] = useState<string | null>(null)

  // PDF image editor
  const [showPdfEditor, setShowPdfEditor] = useState(false)
  const [pdfFileName, setPdfFileName] = useState('')
  const [pdfImages, setPdfImages] = useState<{ base64: string; name: string; brightness: number; contrast: number; cropBox: { x: number; y: number; w: number; h: number } | null }[]>([])
  const [pdfSaving, setPdfSaving] = useState(false)

  // Preview
  const [previewFileId, setPreviewFileId] = useState<string | null>(null)

  // Thumbnails cache
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({})
  const [pptTexts, setPptTexts] = useState<Record<string, string[]>>({})

  const loadFiles = useCallback(async () => {
    setLoading(true)
    try {
      const resp = await cloudDriveApi.listFiles(currentParentId || undefined, filterType === 'folder' ? undefined : filterType || undefined)
      const data = resp.data
      setFiles(data.files || [])
      setFolderPath(data.folder_path || [])
    } catch (err: any) {
      setMessage({ text: err.response?.data?.detail || '加载失败', type: 'error' })
    } finally { setLoading(false) }
  }, [currentParentId, filterType])

  useEffect(() => { loadFiles() }, [loadFiles])

  // Load thumbnails for image and PPT files
  useEffect(() => {
    const imageFiles = files.filter(f => f.file_type === 'image' && !thumbnails[f.id])
    const pptFiles = files.filter(f => (f.file_type === 'pptx' || f.file_type === 'ppt') && !pptTexts[f.id])
    if (imageFiles.length === 0 && pptFiles.length === 0) return

    const token = localStorage.getItem('access_token')

    imageFiles.forEach(f => {
      const url = `/api/v1/cloud-drive/files/${f.id}/thumbnail?width=300`
      // Check if already cached
      if (!thumbnails[f.id]) {
        fetch(url, { headers: { Authorization: `Bearer ${token}` } })
          .then(resp => {
            if (resp.ok) return resp.blob()
            throw new Error('not found')
          })
          .then(blob => {
            const objectUrl = URL.createObjectURL(blob)
            setThumbnails(prev => ({ ...prev, [f.id]: objectUrl }))
          })
          .catch(() => {})
      }
    })

    pptFiles.forEach(f => {
      cloudDriveApi.getPreviewText(f.id).then(resp => {
        const slides = resp.data?.slides
        if (slides && slides.length > 0 && slides[0]) {
          setPptTexts(prev => ({ ...prev, [f.id]: slides[0] }))
        }
      }).catch(() => {})
    })
  }, [files])

  const showMsg = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type })
    setTimeout(() => setMessage({ text: '', type: '' }), 3000)
  }

  // ── Upload ──
  const handleUploadClick = () => {
    const accept = TYPE_ACCEPT_MAP[filterType] || '*'
    uploadAcceptRef.current = accept
    if (fileInputRef.current) {
      fileInputRef.current.accept = accept
      fileInputRef.current.click()
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const resp = await cloudDriveApi.uploadFile(file, currentParentId || undefined)
      setFiles(prev => [resp.data, ...prev])
      showMsg(`"${resp.data.file_name}" 上传成功`, 'success')
    } catch (err: any) {
      showMsg(err.response?.data?.detail || '上传失败', 'error')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // ── Folder ──
  const handleCreateFolder = async () => {
    if (!folderName.trim()) { showMsg('请输入文件夹名称', 'error'); return }
    try {
      const resp = await cloudDriveApi.createFolder(folderName.trim(), currentParentId || undefined)
      setFiles(prev => [resp.data, ...prev])
      setShowFolderModal(false)
      setFolderName('')
      showMsg(`文件夹 "${resp.data.file_name}" 已创建`, 'success')
    } catch (err: any) {
      showMsg(err.response?.data?.detail || '创建失败', 'error')
    }
  }

  const handleFolderClick = (folder: CloudFileInfo) => {
    setCurrentParentId(folder.id)
    setFilterType('')
  }

  const handleBreadcrumbClick = (index: number) => {
    if (index === -1) {
      setCurrentParentId(null)
      setFolderPath([])
    } else {
      setCurrentParentId(folderPath[index].id)
      setFolderPath(folderPath.slice(0, index + 1))
    }
  }

  // ── Delete ──
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`确定要删除 "${name}" 吗？${files.find(f => f.id === id)?.is_folder ? '文件夹内的所有文件也会被删除。' : ''}`)) return
    try {
      await cloudDriveApi.deleteFile(id)
      setFiles(prev => prev.filter(f => f.id !== id))
      showMsg(`"${name}" 已删除`, 'success')
    } catch (err: any) {
      showMsg(err.response?.data?.detail || '删除失败', 'error')
    }
  }

  // ── Word Editor ──
  const openWordEditor = (existing?: CloudFileInfo) => {
    if (existing) {
      cloudDriveApi.getFileDetail(existing.id).then(resp => {
        setWordFileName(existing.file_name.replace('.docx', ''))
        setWordContent(resp.data.content_text || '')
        setEditingWordId(existing.id)
        setShowWordEditor(true)
      }).catch(() => {
        setWordFileName(existing.file_name.replace('.docx', ''))
        setWordContent('')
        setEditingWordId(existing.id)
        setShowWordEditor(true)
      })
    } else {
      setWordFileName('')
      setWordContent('# 新建文档\n\n')
      setEditingWordId(null)
      setShowWordEditor(true)
    }
    setShowNewMenu(false)
  }

  const handleSaveWord = async () => {
    if (!wordFileName.trim()) { showMsg('请输入文件名', 'error'); return }
    setWordSaving(true)
    try {
      if (editingWordId) {
        await cloudDriveApi.updateFile(editingWordId, {
          content_text: wordContent,
          file_name: wordFileName.trim() + '.docx',
        })
        showMsg('文档已保存', 'success')
      } else {
        await cloudDriveApi.createWordFromMarkdown(
          wordFileName.trim(), wordContent, currentParentId || undefined,
        )
        showMsg('文档已创建', 'success')
      }
      setShowWordEditor(false)
      loadFiles()
    } catch (err: any) {
      showMsg(err.response?.data?.detail || '保存失败', 'error')
    } finally { setWordSaving(false) }
  }

  // ── PDF Image Editor ──
  const handleAddImageToPdf = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1]
      setPdfImages(prev => [...prev, {
        base64, name: file.name,
        brightness: 1.0, contrast: 1.0, cropBox: null,
      }])
    }
    reader.readAsDataURL(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSavePdf = async () => {
    if (!pdfFileName.trim()) { showMsg('请输入文件名', 'error'); return }
    if (pdfImages.length === 0) { showMsg('请至少添加一张图片', 'error'); return }
    setPdfSaving(true)
    try {
      const images = pdfImages.map(img => ({
        base64: img.base64,
        brightness: img.brightness,
        contrast: img.contrast,
        ...(img.cropBox ? { crop_x: img.cropBox.x, crop_y: img.cropBox.y, crop_w: img.cropBox.w, crop_h: img.cropBox.h } : {}),
      }))
      await cloudDriveApi.createPdfFromImages(pdfFileName.trim(), images, currentParentId || undefined)
      setShowPdfEditor(false)
      setPdfImages([])
      setPdfFileName('')
      showMsg('PDF 已生成', 'success')
      loadFiles()
    } catch (err: any) {
      showMsg(err.response?.data?.detail || '生成失败', 'error')
    } finally { setPdfSaving(false) }
  }

  // ── Preview ──
  const handlePreview = (file: CloudFileInfo) => {
    if (file.is_folder) { handleFolderClick(file); return }
    setPreviewFileId(file.id)
  }

  const getFileIcon = (ft: string) => FILE_TYPE_CONFIG[ft] || { label: '文件', color: 'var(--app-text-secondary)', bg: 'var(--app-bg-card-alt)' }

  return (
    <div className="fade-in" style={{ padding: 'var(--space-6)', maxWidth: 1000, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <button onClick={() => currentParentId ? setCurrentParentId(null) : navigate('/profile')}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', padding: 'var(--space-2) var(--space-3)', fontSize: '0.8125rem' }}>
            <ArrowLeftIcon /> {currentParentId ? '上级' : '返回'}
          </button>
          <h1 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-heading)', margin: 0 }}>云盘</h1>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
          <input ref={fileInputRef} type="file" onChange={handleUpload} style={{ display: 'none' }} />
          <button onClick={handleUploadClick} disabled={uploading}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', padding: 'var(--space-2) var(--space-3)', fontSize: '0.8125rem' }}>
            <UploadIcon /> {uploading ? '上传中...' : '上传'}
          </button>

          {/* New menu */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowNewMenu(!showNewMenu)}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', padding: 'var(--space-2) var(--space-3)', fontSize: '0.8125rem', backgroundColor: 'var(--success)' }}>
              <PlusIcon /> 新建
            </button>
            {showNewMenu && (
              <div className="fade-in" style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 100,
                backgroundColor: 'white', borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-xl)', border: '1px solid var(--gray-100)',
                minWidth: 200, overflow: 'hidden',
              }}>
                {[
                  { key: 'folder', label: '新建文件夹', icon: <FolderIcon />, action: () => { setShowFolderModal(true); setShowNewMenu(false) } },
                  { key: 'word', label: '新建 Word 文档', icon: <span style={{ fontWeight: 700, color: 'var(--app-blue)' }}>W</span>, action: () => openWordEditor() },
                  { key: 'pdf', label: '新建 PDF（图片编辑）', icon: <ImageIcon />, action: () => { setShowPdfEditor(true); setShowNewMenu(false) } },
                ].map(item => (
                  <button key={item.key} onClick={item.action}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                      width: '100%', padding: 'var(--space-3) var(--space-4)',
                      border: 'none', background: 'none', cursor: 'pointer',
                      fontSize: '0.8125rem', color: 'var(--gray-700)', textAlign: 'left',
                      borderBottom: '1px solid var(--gray-50)',
                      transition: 'background-color var(--transition-fast)',
                    }}>
                    <span style={{ width: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{item.icon}</span>
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Breadcrumb */}
      {folderPath.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', marginBottom: 'var(--space-3)', fontSize: '0.8125rem', flexWrap: 'wrap' }}>
          <button onClick={() => handleBreadcrumbClick(-1)} className="btn btn-secondary"
            style={{ padding: '2px 8px', fontSize: '0.75rem', border: 'none', background: 'none', color: 'var(--gray-500)', cursor: 'pointer' }}>
            根目录
          </button>
          {folderPath.map((f, i) => (
            <span key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ color: 'var(--gray-300)' }}>/</span>
              <button onClick={() => handleBreadcrumbClick(i)}
                className="btn btn-secondary"
                style={{ padding: '2px 8px', fontSize: '0.75rem', border: 'none', background: 'none', color: i === folderPath.length - 1 ? 'var(--gray-800)' : 'var(--gray-500)', cursor: 'pointer', fontWeight: i === folderPath.length - 1 ? 600 : 400 }}>
                {f.name}
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Message */}
      {message.text && (
        <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: 'var(--space-3)' }}>
          {message.text}
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)', flexWrap: 'wrap' }}>
        {FILTER_TABS.map(tab => (
          <button key={tab.key}
            onClick={() => { setFilterType(tab.key); setCurrentParentId(null) }}
            className="btn"
            style={{
              padding: '0.25rem 0.75rem', fontSize: '0.75rem',
              backgroundColor: filterType === tab.key ? 'var(--primary)' : 'var(--gray-50)',
              color: filterType === tab.key ? 'white' : 'var(--gray-600)',
              borderColor: filterType === tab.key ? 'var(--primary)' : 'var(--gray-200)',
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* File grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-12)', color: 'var(--gray-400)' }}>加载中...</div>
      ) : files.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-10)' }}>
          <div style={{ color: 'var(--gray-300)', marginBottom: 'var(--space-3)' }}><FolderIcon /></div>
          <h3 style={{ fontSize: '0.9375rem', color: 'var(--gray-500)', marginBottom: 'var(--space-2)' }}>此文件夹为空</h3>
          <p style={{ fontSize: '0.8125rem', color: 'var(--gray-400)', marginBottom: 'var(--space-4)' }}>
            点击"上传"从电脑选择文件，或"新建"创建内容
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'center' }}>
            <button onClick={handleUploadClick} className="btn btn-primary" style={{ fontSize: '0.8125rem' }}><UploadIcon /> 上传文件</button>
            <button onClick={() => setShowNewMenu(true)} className="btn btn-primary" style={{ fontSize: '0.8125rem', backgroundColor: 'var(--success)' }}><PlusIcon /> 新建</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 'var(--space-3)' }}>
          {files.map(file => {
            const icon = getFileIcon(file.file_type)
            const dateStr = file.created_at ? new Date(file.created_at).toLocaleDateString('zh-CN') : ''
            return (
              <div key={file.id} onClick={() => handlePreview(file)}
                className="card"
                style={{
                  cursor: 'pointer', padding: 'var(--space-3)',
                  display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', position: 'relative',
                  transition: 'box-shadow var(--transition-fast)',
                  border: file.is_folder ? '1.5px solid oklch(0.55 0.25 250 / 0.15)' : undefined,
                }}>
                <div style={{
                  width: '100%', paddingTop: '55%', position: 'relative',
                  backgroundColor: icon.bg, borderRadius: 'var(--radius-md)', overflow: 'hidden',
                }}>
                  <div style={{
                    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {file.is_folder ? (
                      <FolderIcon />
                    ) : file.file_type === 'image' && thumbnails[file.id] ? (
                      <img src={thumbnails[file.id]} alt={file.file_name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (file.file_type === 'pptx' || file.file_type === 'ppt') && pptTexts[file.id] ? (
                      <div style={{
                        width: '100%', height: '100%', padding: 'var(--space-2)',
                        display: 'flex', flexDirection: 'column', justifyContent: 'center',
                        fontSize: '0.625rem', lineHeight: 1.4, color: '#ea580c',
                        overflow: 'hidden', textAlign: 'left',
                      }}>
                        <div style={{ fontWeight: 600, fontSize: '0.6875rem', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {pptTexts[file.id].slice(0, 3).join(' · ')}
                        </div>
                        {pptTexts[file.id].slice(0, 3).map((t, i) => (
                          <div key={i} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', opacity: 0.8 }}>• {t}</div>
                        ))}
                      </div>
                    ) : (
                      <span style={{ fontWeight: 700, opacity: 0.25, fontSize: '2rem', color: icon.color }}>{icon.label}</span>
                    )}
                  </div>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--gray-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {file.file_name}
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--gray-400)', marginTop: 2 }}>
                    {file.is_folder ? '文件夹' : `${dateStr} · ${cloudDriveApi.formatFileSize(file.file_size)}`}
                  </div>
                </div>
                {!file.is_folder && (
                  <button onClick={e => { e.stopPropagation(); handleDelete(file.id, file.file_name) }}
                    title="删除"
                    style={{
                      position: 'absolute', top: 6, right: 6, padding: '2px 6px', border: 'none',
                      borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.8)',
                      cursor: 'pointer', color: 'var(--gray-400)', opacity: 0,
                      transition: 'opacity var(--transition-fast)',
                    }}
                    className="del-btn">
                    <TrashIcon />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Delete btn hover */}
      <style>{`.card:hover .del-btn { opacity: 0.6; } .card:hover .del-btn:hover { opacity: 1; }`}</style>

      {/* ── New Folder Modal ── */}
      {showFolderModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'oklch(0 0 0 / 0.4)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)' }}>
          <div className="fade-in" style={{ backgroundColor: 'white', borderRadius: 'var(--radius-xl)', padding: 'var(--space-6)', width: '90%', maxWidth: 400, boxShadow: 'var(--shadow-xl)' }}>
            <h2 style={{ fontSize: '1.125rem', fontFamily: 'var(--font-heading)', marginBottom: 'var(--space-4)' }}>新建文件夹</h2>
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label>文件夹名称</label>
              <input type="text" className="input" value={folderName} onChange={e => setFolderName(e.target.value)} placeholder="例如：学习资料" autoFocus />
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowFolderModal(false)} className="btn btn-secondary">取消</button>
              <button onClick={handleCreateFolder} className="btn btn-primary"><FolderIcon /> 创建</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Word Editor Modal ── */}
      {showWordEditor && (
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'oklch(0 0 0 / 0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)', backdropFilter: 'blur(4px)' }}>
          <div className="fade-in" style={{
            width: '95%', maxWidth: 800, height: '85vh', backgroundColor: 'white', borderRadius: 'var(--radius-xl)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: 'var(--shadow-xl)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--gray-100)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <span style={{ fontWeight: 700, color: 'var(--app-blue)', fontSize: '1.125rem' }}>W</span>
                <h2 style={{ fontSize: '1rem', fontFamily: 'var(--font-heading)', margin: 0 }}>Word 文档编辑器</h2>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <button onClick={handleSaveWord} disabled={wordSaving} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                  {wordSaving ? '保存中...' : '保存'}
                </button>
                <button onClick={() => { setShowWordEditor(false) }} className="btn btn-secondary">关闭</button>
              </div>
            </div>
            <div style={{ padding: 'var(--space-3) var(--space-5)', borderBottom: '1px solid var(--gray-100)', display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
              <label style={{ fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>文件名:</label>
              <input type="text" className="input" value={wordFileName}
                onChange={e => setWordFileName(e.target.value)}
                placeholder="文档名称"
                style={{ flex: 1, maxWidth: 300, padding: '0.375rem 0.625rem', fontSize: '0.8125rem' }} />
              <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>.docx</span>
              {editingWordId && <span style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>（编辑中）</span>}
            </div>
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              {/* Rich Text Editor / Markdown Editor */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--gray-100)', overflow: 'hidden' }}>
                <RichTextEditor content={wordContent} onChange={setWordContent} placeholder="在此输入文档内容..." />
              </div>
              {/* Preview */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: 'var(--space-2) var(--space-4)', fontSize: '0.75rem', color: 'var(--gray-400)', borderBottom: '1px solid var(--gray-100)', backgroundColor: 'var(--gray-50)' }}>
                  预览
                </div>
                <div style={{ flex: 1, overflow: 'auto', padding: 'var(--space-4)' }}>
                  <MarkdownRenderer content={wordContent} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── PDF Image Editor Modal ── */}
      {showPdfEditor && (
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'oklch(0 0 0 / 0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)', backdropFilter: 'blur(4px)' }}>
          <div className="fade-in" style={{
            width: '95%', maxWidth: 700, maxHeight: '85vh', backgroundColor: 'white', borderRadius: 'var(--radius-xl)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: 'var(--shadow-xl)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--gray-100)' }}>
              <h2 style={{ fontSize: '1rem', fontFamily: 'var(--font-heading)', margin: 0 }}>PDF 图片编辑器</h2>
              <button onClick={() => setShowPdfEditor(false)} className="btn btn-secondary">关闭</button>
            </div>
            <div style={{ padding: 'var(--space-3) var(--space-5)', borderBottom: '1px solid var(--gray-100)', display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>文件名:</label>
              <input type="text" className="input" value={pdfFileName} onChange={e => setPdfFileName(e.target.value)}
                placeholder="PDF 名称" style={{ flex: 1, minWidth: 120, padding: '0.375rem 0.625rem', fontSize: '0.8125rem' }} />
              <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>.pdf</span>
              <input type="file" accept="image/*" onChange={handleAddImageToPdf} style={{ display: 'none' }} id="pdf-img-upload" />
              <label htmlFor="pdf-img-upload" className="btn btn-primary" style={{ fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                <ImageIcon /> 添加图片
              </label>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: 'var(--space-4)', minHeight: 200 }}>
              {pdfImages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--gray-400)', fontSize: '0.875rem' }}>
                  点击"添加图片"按钮来选择图片，可调整亮度、对比度，然后生成 PDF
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  {pdfImages.map((img, i) => (
                    <div key={i} style={{ border: '1px solid var(--gray-100)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', display: 'flex', gap: 'var(--space-3)' }}>
                      <img src={`data:image/jpeg;base64,${img.base64}`} alt={img.name}
                        style={{ width: 100, height: 70, objectFit: 'cover', borderRadius: 'var(--radius-sm)', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{img.name}</div>
                        <div style={{ display: 'flex', gap: 'var(--space-4)', marginTop: 'var(--space-2)', flexWrap: 'wrap' }}>
                          <label style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                            亮度:
                            <input type="range" min="0" max="2" step="0.1" value={img.brightness}
                              onChange={e => { const v = [...pdfImages]; v[i] = { ...v[i], brightness: parseFloat(e.target.value) }; setPdfImages(v) }}
                              style={{ width: 80 }} />
                          </label>
                          <label style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                            对比度:
                            <input type="range" min="0" max="2" step="0.1" value={img.contrast}
                              onChange={e => { const v = [...pdfImages]; v[i] = { ...v[i], contrast: parseFloat(e.target.value) }; setPdfImages(v) }}
                              style={{ width: 80 }} />
                          </label>
                        </div>
                      </div>
                      <button onClick={() => setPdfImages(prev => prev.filter((_, idx) => idx !== i))}
                        className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem', color: 'var(--danger)', alignSelf: 'flex-start' }}>
                        <TrashIcon />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {pdfImages.length > 0 && (
              <div style={{ padding: 'var(--space-3) var(--space-5)', borderTop: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
                <button onClick={() => { setPdfImages([]); setPdfFileName('') }} className="btn btn-secondary" style={{ fontSize: '0.8125rem' }}>清空</button>
                <button onClick={handleSavePdf} disabled={pdfSaving} className="btn btn-primary" style={{ fontSize: '0.8125rem' }}>
                  {pdfSaving ? '生成中...' : `生成 PDF（${pdfImages.length} 页）`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Preview ── */}
      {previewFileId && (() => {
        const file = files.find(f => f.id === previewFileId)
        return file ? (
          <FilePreviewModal
            fileId={previewFileId}
            fileName={file.file_name}
            fileType={file.file_type}
            onClose={() => setPreviewFileId(null)}
            onEditWord={(fid) => {
              setPreviewFileId(null)
              const target = files.find(f => f.id === fid)
              if (target) openWordEditor(target)
            }}
          />
        ) : null
      })()}
    </div>
  )
}
