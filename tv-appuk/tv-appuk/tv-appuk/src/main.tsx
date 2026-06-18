import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './App'
import { platform } from './platform/index'
import { initTizen } from './platform/tizenInit'
import { setupFetchInterceptor } from './api/apiUtils'

setupFetchInterceptor()

if (platform === 'tizen') {
  initTizen()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
