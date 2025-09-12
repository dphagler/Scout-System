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
    <div className="modal-backdrop">
      <form className="modal" onSubmit={submit}>
        <div className="field">
          <label htmlFor="pw">Please enter the password:</label>
          <input
            id="pw"
            type="password"
            value={pw}
            onChange={e => setPw(e.target.value)}
            autoFocus
          />
        </div>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="submit" className="btn primary">
            Enter
          </button>
        </div>
      </form>
    </div>
  )
}

