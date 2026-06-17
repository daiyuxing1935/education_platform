import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

interface Toast {
  id: string
  message: string
  type: ToastType
  duration: number
  createdAt: number
}

interface ToastState {
  toasts: Toast[]
  addToast: (message: string, type: ToastType, duration?: number) => void
  removeToast: (id: string) => void
  /** Shorthand: success notification */
  success: (message: string, duration?: number) => void
  /** Shorthand: error notification */
  error: (message: string, duration?: number) => void
  /** Shorthand: info notification */
  info: (message: string, duration?: number) => void
  /** Shorthand: warning notification */
  warning: (message: string, duration?: number) => void
}

let toastCounter = 0

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  addToast: (message, type, duration = 3000) => {
    const id = `toast-${++toastCounter}`
    const toast: Toast = { id, message, type, duration, createdAt: Date.now() }
    set((s) => ({ toasts: [...s.toasts, toast] }))
  },

  removeToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
  },

  success: (message, duration) => get().addToast(message, 'success', duration),
  error: (message, duration) => get().addToast(message, 'error', duration),
  info: (message, duration) => get().addToast(message, 'info', duration),
  warning: (message, duration) => get().addToast(message, 'warning', duration),
}))
