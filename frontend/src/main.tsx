import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Configure Monaco Editor to load from local files (no CDN)
import { loader } from '@monaco-editor/react'
loader.config({ paths: { vs: '/monaco-editor/min/vs' } })

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
