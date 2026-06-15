import { createRoot } from 'react-dom/client'
import App from './app/App.jsx'
import KioskPage from './pages/kiosk/KioskPage.jsx'
import "./shared/styles/globals.css";
import { registerSW } from 'virtual:pwa-register'

registerSW({ immediate: true })

const isKiosk = window.location.pathname.startsWith('/kiosk');

createRoot(document.getElementById('root')).render(
  isKiosk ? <KioskPage /> : <App />
)