import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Legacy TV detection logic that was previously stripped by Vite
;(function() {
  const lacksAspectRatio = typeof CSS !== 'undefined' && CSS.supports && !CSS.supports('aspect-ratio', '16/9');
  const match = navigator.userAgent.match(/(?:Chrome|CrMo|CriOS|wv)\/(\d+)/);
  const isOldChrome = match && parseInt(match[1], 10) < 94;
  (window as any).isLegacyTv = isOldChrome || lacksAspectRatio || !(window as any).CSS;
})();

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
