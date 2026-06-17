interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

export default function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null

  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '20px' }}>
      <button disabled={page <= 1} onClick={() => onPageChange(page - 1)}
        style={{ padding: '8px 16px', border: '1px solid #E5E7EB', borderRadius: 10, background: '#fff', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.5 : 1, fontSize: '13px' }}>
        上一页
      </button>
      <span style={{ display: 'flex', alignItems: 'center', fontSize: '13px', color: 'var(--app-text-secondary)', padding: '0 12px' }}>
        {page} / {totalPages}
      </span>
      <button disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}
        style={{ padding: '8px 16px', border: '1px solid #E5E7EB', borderRadius: 10, background: '#fff', cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? 0.5 : 1, fontSize: '13px' }}>
        下一页
      </button>
    </div>
  )
}
