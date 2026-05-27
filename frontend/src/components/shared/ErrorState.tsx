interface ErrorStateProps {
  message: string
  onRetry?: () => void
}

export default function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 0' }}>
      <div style={{ color: 'var(--app-danger)', fontSize: '14px', marginBottom: onRetry ? '12px' : 0 }}>{message}</div>
      {onRetry && (
        <button onClick={onRetry}
          style={{ padding: '8px 20px', background: 'var(--app-brand)', color: '#fff', border: 'none', borderRadius: 10, fontSize: '13px', cursor: 'pointer' }}>
          重试
        </button>
      )}
    </div>
  )
}
