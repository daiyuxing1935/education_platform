import api from './auth'

export interface CloudFileInfo {
  id: string
  file_name: string
  file_type: string
  mime_type: string | null
  file_size: number
  is_folder: boolean
  parent_id: string | null
  created_at: string
  updated_at: string
}

export interface CloudFileDetail extends CloudFileInfo {
  base64: string
  content_text: string | null
}

export interface CloudFileListResponse {
  files: CloudFileInfo[]
  parent_id: string | null
  folder_path: { id: string; name: string }[] | null
}

export interface PreviewTextResponse {
  text: string
  slides: string[][] | null
  content_text: string | null
}

export interface SlideImageData {
  base64: string
  crop_x?: number
  crop_y?: number
  crop_w?: number
  crop_h?: number
  brightness?: number
  contrast?: number
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export const cloudDriveApi = {
  /** 列出文件（支持文件夹和类型过滤） */
  listFiles: async (parentId?: string, fileType?: string) => {
    const params: Record<string, string> = {}
    if (parentId) params.parent_id = parentId
    if (fileType) params.file_type = fileType
    return api.get<CloudFileListResponse>('/cloud-drive/files', { params })
  },

  /** 新建文件夹 */
  createFolder: async (folderName: string, parentId?: string) => {
    return api.post<CloudFileInfo>('/cloud-drive/folder', {
      folder_name: folderName,
      parent_id: parentId || null,
    })
  },

  /** 上传文件（支持指定父文件夹） */
  uploadFile: async (file: File, parentId?: string) => {
    const formData = new FormData()
    formData.append('file', file)
    if (parentId) formData.append('parent_id', parentId)
    return api.post<CloudFileInfo>('/cloud-drive/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  /** 新建空白文档 */
  createFile: async (fileName: string, fileType: string, parentId?: string) => {
    return api.post<CloudFileInfo>('/cloud-drive/create', {
      file_name: fileName,
      file_type: fileType,
      parent_id: parentId || null,
    })
  },

  /** 从 Markdown 创建 Word 文档 */
  createWordFromMarkdown: async (fileName: string, markdown: string, parentId?: string) => {
    return api.post<CloudFileInfo>('/cloud-drive/create-from-markdown', {
      file_name: fileName,
      markdown,
      parent_id: parentId || null,
    })
  },

  /** 更新文档内容 */
  updateFile: async (fileId: string, data: { content_text?: string; file_name?: string }) => {
    return api.put<CloudFileInfo>(`/cloud-drive/files/${fileId}`, data)
  },

  /** 从图片生成 PDF */
  createPdfFromImages: async (fileName: string, images: SlideImageData[], parentId?: string) => {
    return api.post<CloudFileInfo>('/cloud-drive/create-pdf-from-images', {
      file_name: fileName,
      images,
      parent_id: parentId || null,
    })
  },

  /** 获取文件详情 */
  getFileDetail: async (fileId: string) => {
    return api.get<CloudFileDetail>(`/cloud-drive/files/${fileId}`)
  },

  /** 获取预览文本 */
  getPreviewText: async (fileId: string) => {
    return api.get<PreviewTextResponse>(`/cloud-drive/files/${fileId}/preview-text`)
  },

  /** 下载文件 */
  downloadFile: async (fileId: string, fileName: string) => {
    const token = localStorage.getItem('access_token')
    const response = await fetch(`/api/v1/cloud-drive/files/${fileId}/download`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) throw new Error('下载失败')
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
  },

  /** 删除文件 */
  deleteFile: async (fileId: string) => {
    return api.delete(`/cloud-drive/files/${fileId}`)
  },

  /** 获取文件类型 accept 映射 */
  getAcceptMap: async () => {
    return api.get<Record<string, string>>('/cloud-drive/accept-map')
  },

  formatFileSize,
}
