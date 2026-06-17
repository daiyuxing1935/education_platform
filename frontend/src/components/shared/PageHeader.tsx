import React from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeftIcon } from '../Icons'

interface PageHeaderProps {
  backTo: string
  title?: string
  backLabel?: string
  subtitle?: React.ReactNode
  onBackClick?: () => void
}

export default function PageHeader({ backTo, title, backLabel = '返回', subtitle, onBackClick }: PageHeaderProps) {
  const navigate = useNavigate()

  const handleBack = () => {
    if (onBackClick) {
      onBackClick()
    } else {
      navigate(backTo)
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
      <span style={{ color: 'var(--app-brand)', cursor: 'pointer', fontSize: '13px' }} onClick={handleBack}>
        <ArrowLeftIcon size={13} /> {backLabel}
      </span>
      {title && <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--app-text-heading)', margin: 0 }}>{title}</h1>}
      {subtitle}
    </div>
  )
}
