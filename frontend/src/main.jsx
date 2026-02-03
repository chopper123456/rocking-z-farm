import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './index.css'
import { OfflineProvider } from './contexts/OfflineContext'

registerSW({ immediate: true })

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <OfflineProvider>
      <App />
    </OfflineProvider>
  </React.StrictMode>,
)
