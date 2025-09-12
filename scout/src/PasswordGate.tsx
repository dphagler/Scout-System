import React from 'react'
import { appConfig } from './appConfig'

const PASSWORD_TIMEOUT_MS = 3 * 60 * 60 * 1000 // 3 hours

export default function PasswordGate({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = React.useState(false)
  const [pw, setPw] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const last = Number(localStorage.getItem('scout:authTime') || '0')
    if (appConfig.APP_PASSWORD === '' || (last && Date.now() - last < PASSWORD_TIMEOUT_MS)) {
      setAuthed(true)
    }
  }, [])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (pw === appConfig.APP_PASSWORD) {
      localStorage.setItem('scout:authTime', String(Date.now()))
      setAuthed(true)
      setError(null)
    } else {
      setError('Incorrect password')
    }
  }

  if (authed) return <>{children}</>

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <form
        onSubmit={submit}
        style={{ background: 'white', padding: '1rem', borderRadius: '4px' }}
      >
        <p>Please enter the password:</p>
        <input
          type="password"
          value={pw}
          onChange={e => setPw(e.target.value)}
          style={{ marginBottom: '0.5rem', width: '100%' }}
        />
        {error && <div style={{ color: 'red', marginBottom: '0.5rem' }}>{error}</div>}
        <button type="submit">Enter</button>
      </form>
    </div>
  )
}

