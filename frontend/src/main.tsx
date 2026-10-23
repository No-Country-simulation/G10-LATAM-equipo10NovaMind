import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import App from './App.tsx'
import { VisorCreditos } from './creditos/visor.tsx'

const esCreditos =
  typeof window !== 'undefined' &&
  (window.location.search.includes('creditos') ||
    window.location.hash.includes('creditos') ||
    window.location.pathname.startsWith('/creditos'));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {esCreditos ? <VisorCreditos /> : <App />}
  </StrictMode>,
)

