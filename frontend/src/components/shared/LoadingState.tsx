interface LoadingStateProps {
  message?: string
}

export default function LoadingState({ message = '加载中...' }: LoadingStateProps) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--app-text-muted)', fontSize: '14px' }}>{message}</div>
  )
}
