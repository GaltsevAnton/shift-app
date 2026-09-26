import { lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'

registerSW({ immediate: true })

const isKiosk = window.location.pathname.startsWith('/kiosk');

// Каждая часть приложения — отдельный файл: киоск не загружает код менеджерского App, и наоборот.
// Каждый import() — в своей функции (так сборщик правильно подгружает стили нужной части).
const loadKiosk   = () => import('./pages/kiosk/KioskPage.jsx');
const loadApp     = () => import('./app/App.jsx');
// globals.css подключается ПОСЛЕ страницы — в том же порядке, что и раньше
// (раньше он импортировался последним), чтобы стили не поменялись.
const loadGlobals = () => import('./shared/styles/globals.css');

const Page = lazy(() =>
  (isKiosk ? loadKiosk() : loadApp()).then(mod => loadGlobals().then(() => mod))
);

createRoot(document.getElementById('root')).render(
  <Suspense fallback={null}>
    <Page />
  </Suspense>
)