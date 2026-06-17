// naive UTC datetime string → Date (appends 'Z' if missing timezone)
export function parseUTC(s: string): Date {
  return new Date(s.endsWith('Z') || s.includes('+') ? s : s + 'Z')
}

// UTC datetime string → zh-CN locale string
export function formatDateTime(s: string, options?: Intl.DateTimeFormatOptions): string {
  return parseUTC(s).toLocaleString('zh-CN', options)
}

// two UTC timestamps → "X时Y分Z秒" human-readable duration
export function formatDuration(started: string, finished: string | null): string {
  if (!finished) return '进行中'
  const diff = Math.round((parseUTC(finished).getTime() - parseUTC(started).getTime()) / 1000)
  if (diff < 60) return `${diff}秒`
  if (diff < 3600) return `${Math.floor(diff / 60)}分${diff % 60}秒`
  return `${Math.floor(diff / 3600)}时${Math.floor((diff % 3600) / 60)}分`
}

// seconds number → "m:ss" format
export function formatSeconds(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
