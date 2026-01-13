import React from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from "react-error-boundary";
import "@github/spark/spark"
import App from './App.tsx'
import { ErrorFallback } from './ErrorFallback.tsx'
import { Toaster } from './components/ui/sonner'
import { installKVPatch } from './lib/install-kv-patch'

import "./main.css"
import "./styles/theme.css"
import "./index.css"

// Install safe KV wrapper before rendering app
// This prevents uncaught promise rejections when /_spark/kv/* endpoints are missing
if (typeof window !== 'undefined') installKVPatch()

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary FallbackComponent={ErrorFallback}>
    <App />
  </ErrorBoundary>
)
