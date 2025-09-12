import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import PasswordGate from './PasswordGate'
import './styles.css'
import { registerSW } from './sw-register'

registerSW()

const root = createRoot(document.getElementById('root')!)
root.render(
  <React.StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <PasswordGate>
        <App />
      </PasswordGate>
    </BrowserRouter>
  </React.StrictMode>
)
