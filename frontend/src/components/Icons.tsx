import React from 'react'

/* ── 通用 SVG Icon 组件（替换项目中的 emoji）
   ── 设计风格参考 AI-Animation PPT 模板：深色背景、紫色/绿色点缀色、发光效果 ── */

type IconProps = { size?: number; color?: string; className?: string; style?: React.CSSProperties }

function SvgWrap({ size = 18, color = 'currentColor', children, style, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, verticalAlign: 'middle', ...style }} {...rest}>
      {children}
    </svg>
  )
}

// ──────────── Navigation & UI ────────────
export const ArrowLeftIcon   = (p: IconProps) => <SvgWrap {...p}><polyline points="15 18 9 12 15 6"/></SvgWrap>
export const ArrowRightIcon  = (p: IconProps) => <SvgWrap {...p}><polyline points="9 18 15 12 9 6"/></SvgWrap>
export const ArrowUpIcon     = (p: IconProps) => <SvgWrap {...p}><polyline points="18 15 12 9 6 15"/></SvgWrap>
export const ArrowDownIcon   = (p: IconProps) => <SvgWrap {...p}><polyline points="6 9 12 15 18 9"/></SvgWrap>
export const ChevronUpIcon   = (p: IconProps) => <SvgWrap {...p}><polyline points="18 15 12 9 6 15"/></SvgWrap>
export const ChevronDownIcon = (p: IconProps) => <SvgWrap {...p}><polyline points="6 9 12 15 18 9"/></SvgWrap>
export const CloseIcon       = (p: IconProps) => <SvgWrap {...p}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></SvgWrap>
export const CheckIcon       = (p: IconProps) => <SvgWrap {...p}><polyline points="20 6 9 17 4 12"/></SvgWrap>
export const PlayIcon        = (p: IconProps) => <SvgWrap {...p}><polygon points="5 3 19 12 5 21 5 3" fill={p.color || 'currentColor'} stroke="none"/></SvgWrap>
export const PauseIcon       = (p: IconProps) => <SvgWrap {...p}><rect x="6" y="4" width="4" height="16" fill={p.color || 'currentColor'} stroke="none"/><rect x="14" y="4" width="4" height="16" fill={p.color || 'currentColor'} stroke="none"/></SvgWrap>

// ──────────── Content / Document ────────────
export const BookIcon        = (p: IconProps) => <SvgWrap {...p}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></SvgWrap>
export const BookOpenIcon    = (p: IconProps) => <SvgWrap {...p}><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></SvgWrap>
export const BookmarkIcon    = (p: IconProps) => <SvgWrap {...p}><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></SvgWrap>
export const FileTextIcon    = (p: IconProps) => <SvgWrap {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></SvgWrap>
export const FilePlusIcon    = (p: IconProps) => <SvgWrap {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></SvgWrap>
export const FolderIcon      = (p: IconProps) => <SvgWrap {...p}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></SvgWrap>
export const FileIcon        = (p: IconProps) => <SvgWrap {...p}><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></SvgWrap>
export const ImageIcon       = (p: IconProps) => <SvgWrap {...p}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></SvgWrap>
export const PlusIcon        = (p: IconProps) => <SvgWrap {...p}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></SvgWrap>
export const EditIcon        = (p: IconProps) => <SvgWrap {...p}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></SvgWrap>
export const TrashIcon       = (p: IconProps) => <SvgWrap {...p}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></SvgWrap>

// ──────────── Status / Feedback ────────────
export const CheckCircleIcon  = (p: IconProps) => <SvgWrap {...p}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></SvgWrap>
export const XCircleIcon      = (p: IconProps) => <SvgWrap {...p}><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></SvgWrap>
export const AlertCircleIcon  = (p: IconProps) => <SvgWrap {...p}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></SvgWrap>
export const AlertTriangleIcon= (p: IconProps) => <SvgWrap {...p}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></SvgWrap>
export const InfoIcon         = (p: IconProps) => <SvgWrap {...p}><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></SvgWrap>
export const StarIcon         = (p: IconProps) => <SvgWrap {...p}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill={p.color || 'currentColor'} stroke="none"/></SvgWrap>

// ──────────── Feature / Topic ────────────
export const BrainIcon       = (p: IconProps) => <SvgWrap {...p}><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.45-2.77A2.5 2.5 0 0 1 7 12.5a2.5 2.5 0 0 1-1.37-3.26A2.5 2.5 0 0 1 9.5 2z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.45-2.77A2.5 2.5 0 0 0 17 12.5a2.5 2.5 0 0 0 1.37-3.26A2.5 2.5 0 0 0 14.5 2z"/></SvgWrap>
export const TargetIcon      = (p: IconProps) => <SvgWrap {...p}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></SvgWrap>
export const LightbulbIcon   = (p: IconProps) => <SvgWrap {...p}><path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/></SvgWrap>
export const CompassIcon     = (p: IconProps) => <SvgWrap {...p}><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></SvgWrap>
export const ZapIcon         = (p: IconProps) => <SvgWrap {...p}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></SvgWrap>
export const TrendingUpIcon  = (p: IconProps) => <SvgWrap {...p}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></SvgWrap>
export const SparklesIcon    = (p: IconProps) => <SvgWrap {...p}><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"/><path d="M18.5 15.5l.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5L16 17.5l1.5-.5.5-1.5z"/><path d="M6 16l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2z"/></SvgWrap>
export const BarChartIcon    = (p: IconProps) => <SvgWrap {...p}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></SvgWrap>
export const PieChartIcon    = (p: IconProps) => <SvgWrap {...p}><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></SvgWrap>
export const LayersIcon      = (p: IconProps) => <SvgWrap {...p}><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></SvgWrap>
export const GridIcon        = (p: IconProps) => <SvgWrap {...p}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></SvgWrap>
export const CodeIcon        = (p: IconProps) => <SvgWrap {...p}><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></SvgWrap>

// ──────────── Communication ────────────
export const MessageCircleIcon = (p: IconProps) => <SvgWrap {...p}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></SvgWrap>
export const BotIcon         = (p: IconProps) => <SvgWrap {...p}><rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="9" cy="12" r="1.5" fill={p.color || 'currentColor'} stroke="none"/><circle cx="15" cy="12" r="1.5" fill={p.color || 'currentColor'} stroke="none"/><line x1="8" y1="17" x2="16" y2="17"/></SvgWrap>
export const EyeIcon         = (p: IconProps) => <SvgWrap {...p}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></SvgWrap>
export const SearchIcon      = (p: IconProps) => <SvgWrap {...p}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></SvgWrap>

// ──────────── Actions ────────────
export const RefreshIcon     = (p: IconProps) => <SvgWrap {...p}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></SvgWrap>
export const SettingsIcon    = (p: IconProps) => <SvgWrap {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></SvgWrap>
export const DownloadIcon    = (p: IconProps) => <SvgWrap {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></SvgWrap>
export const LinkIcon        = (p: IconProps) => <SvgWrap {...p}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></SvgWrap>
export const ExternalLinkIcon = (p: IconProps) => <SvgWrap {...p}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></SvgWrap>
export const ClockIcon       = (p: IconProps) => <SvgWrap {...p}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></SvgWrap>
export const AwardIcon       = (p: IconProps) => <SvgWrap {...p}><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></SvgWrap>
export const TrophyIcon      = (p: IconProps) => <SvgWrap {...p}><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/></SvgWrap>
export const RocketIcon      = (p: IconProps) => <SvgWrap {...p}><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></SvgWrap>
export const PaletteIcon     = (p: IconProps) => <SvgWrap {...p}><circle cx="13.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="10.5" r="2.5"/><circle cx="8.5" cy="7.5" r="2.5"/><circle cx="6.5" cy="12.5" r="2.5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-1 0-.83.67-1.5 1.5-1.5H16c3.31 0 6-2.69 6-6 0-5.5-4.5-10-10-10z"/></SvgWrap>
export const FlagIcon        = (p: IconProps) => <SvgWrap {...p}><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></SvgWrap>

// ──────────── Cloud / Data ────────────
export const CloudIcon       = (p: IconProps) => <SvgWrap {...p}><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></SvgWrap>
export const DatabaseIcon    = (p: IconProps) => <SvgWrap {...p}><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></SvgWrap>
export const GlobeIcon       = (p: IconProps) => <SvgWrap {...p}><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></SvgWrap>
export const WifiIcon        = (p: IconProps) => <SvgWrap {...p}><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><circle cx="12" cy="20" r="1" fill={p.color || 'currentColor'} stroke="none"/></SvgWrap>
export const LockIcon        = (p: IconProps) => <SvgWrap {...p}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></SvgWrap>
export const UnlockIcon      = (p: IconProps) => <SvgWrap {...p}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></SvgWrap>
export const BellIcon        = (p: IconProps) => <SvgWrap {...p}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></SvgWrap>
export const MailIcon        = (p: IconProps) => <SvgWrap {...p}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></SvgWrap>
export const VideoIcon       = (p: IconProps) => <SvgWrap {...p}><polygon points="23 7 16 12 23 17 23 7" fill={p.color || 'currentColor'} stroke="none"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></SvgWrap>
export const MusicIcon       = (p: IconProps) => <SvgWrap {...p}><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></SvgWrap>
export const UsersIcon       = (p: IconProps) => <SvgWrap {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></SvgWrap>
export const UserIcon        = (p: IconProps) => <SvgWrap {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></SvgWrap>
export const PuzzleIcon      = (p: IconProps) => <SvgWrap {...p}><path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 0 1-.837.276.98.98 0 0 1-.616-.313l-1.568-1.568a1.002 1.002 0 0 0-.878-.289 4.5 4.5 0 0 0-3.145 3.145 1.002 1.002 0 0 0 .289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 0 1-.837.276.98.98 0 0 1-.616-.313l-1.568-1.568a1.002 1.002 0 0 0-.878-.289 4.5 4.5 0 0 0-3.145 3.145 1.001 1.001 0 0 0 .289.878L6.17 21.17c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 0 1-.837.276.98.98 0 0 1-.616-.313l-1.568-1.568a1.002 1.002 0 0 0-.878-.289 4.5 4.5 0 0 0-3.145 3.145 1.001 1.001 0 0 0 .289.878L-1.83 27.83"/></SvgWrap>
export const DiamondIcon     = (p: IconProps) => <SvgWrap {...p}><path d="M12 2l9 9-9 9-9-9 9-9z" fill={p.color || 'currentColor'} stroke="none"/></SvgWrap>
export const HomeIcon        = (p: IconProps) => <SvgWrap {...p}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></SvgWrap>
export const ThumbUpIcon     = (p: IconProps) => <SvgWrap {...p}><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></SvgWrap>
export const ThumbDownIcon    = (p: IconProps) => <SvgWrap {...p}><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10zM17 2h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"/></SvgWrap>
