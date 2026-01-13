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

// Install KV patch as early as possible to prevent uncaught rejections
installKVPatch()

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary FallbackComponent={ErrorFallback}>
    <App />
    <Toaster />
   </ErrorBoundary>
)
