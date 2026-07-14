import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { inject } from '@vercel/analytics'
import 'katex/dist/katex.min.css'
import './index.css'
import App from './App.tsx'

// Vercel Web Analytics (page views, visitors, referrers). No-op in dev; in
// production it needs Analytics enabled on the Vercel project dashboard.
inject()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
