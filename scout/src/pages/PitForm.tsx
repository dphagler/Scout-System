import React, { useEffect, useMemo, useState } from 'react'
import { putPit } from '../db'
import { SettingsContext, toApiBase } from '../settings'
import { getGameForEvent } from '../gameConfig'
import { useTeamsMeta } from '../hooks/useTeamsMeta'

// Tiny thumbnail from Blob
function Thumb({ blob, alt }: { blob: Blob; alt: string }) {
  const [url, setUrl] = useState<string>('')
  useEffect(() => {
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return <img className="thumb" src={url} alt={alt} />
}

export default function PitForm() {
  const { settings } = React.useContext(SettingsContext)
  const game = getGameForEvent(settings.eventKey)
  const schemaVersion = Number((game as any)?.schema) || 1
  const base = toApiBase(settings.syncUrl)
  const exportHref = `${base}/pit_export_csv.php?event=${encodeURIComponent(settings.eventKey)}&key=${encodeURIComponent(settings.apiKey)}`

  // Local form state
  const [teamNumber, setTeamNumber] = useState<number | ''>('')
  const [drivetrain, setDrivetrain] = useState<'swerve' | 'tank' | 'mecanum' | 'west_coast' | 'other'>('swerve')
  const [weightLb, setWeightLb] = useState<number | ''>('')
  const [dims, setDims] = useState<{ h: number; w: number; l: number }>({ h: 0, w: 0, l: 0 })
  const [autos, setAutos] = useState<string>('')
  const [mechanisms, setMechanisms] = useState<string>('')
  const [notes, setNotes] = useState<string>('')
  const [photoBlobs, setPhotoBlobs] = useState<{ name: string; blob: Blob }[]>([])

  // Team meta cache (shared hook)
  const teamsDict = useTeamsMeta(settings.eventKey, settings.apiKey, settings.syncUrl)

  const teamOptions = useMemo(() => {
    const arr = Object.values(teamsDict || {}) as any[]
    return arr
      .filter(t => t && (t.team_number || t.teamNumber))
      .map(t => {
        const num = Number(t.team_number ?? t.teamNumber)
        const label = t.nickname || t.name || ''
        return { num, label }
      })
      .sort((a, b) => a.num - b.num)
  }, [teamsDict])

  function labelForTeam(num?: number | '') {
    if (!num) return ''
    const m = teamsDict?.[String(num)]
    const name = m?.nickname || m?.name
    return name ? `${num} - ${name}` : String(num)
  }

  async function onPickPhotos(files: FileList | null) {
    if (!files || !files.length) return
    const max = Math.max(0, 3 - photoBlobs.length)
    if (max <= 0) return
    const picked = Array.from(files).slice(0, max)
    const items = picked.map(f => ({ name: f.name, blob: f }))
    setPhotoBlobs(prev => [...prev, ...items])
  }

  function removePhoto(i: number) {
    setPhotoBlobs(prev => prev.filter((_, idx) => idx !== i))
  }

  return (
    <div className="container">
      <div className="row between">
        <h2>{game.name} - Pit Scouting</h2>
        <a className="btn" href={exportHref}>Export CSV</a>
      </div>

      {/* Team + basics */}
      <div className="card">
        <div className="grid two">
          <div className="field">
            <label>Team</label>
            <select value={String(teamNumber || '')} onChange={e => setTeamNumber(e.target.value ? Number(e.target.value) : '')}>
              <option value="">Select a team</option>
              {teamOptions.map(opt => (
                <option key={opt.num} value={String(opt.num)}>
                  {opt.num}{opt.label ? ` - ${opt.label}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Drivetrain</label>
            <select value={drivetrain} onChange={e => setDrivetrain(e.target.value as any)}>
              <option value="swerve">Swerve</option>
              <option value="tank">Tank</option>
              <option value="mecanum">Mecanum</option>
              <option value="west_coast">West Coast</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        <div className="grid three">
          <div className="field">
            <label>Weight (lb)</label>
            <input
              inputMode="numeric"
              value={weightLb === '' ? '' : String(weightLb)}
              onChange={e => setWeightLb(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="e.g., 120"
            />
          </div>

          <div className="field">
            <label>Dimensions (H-W-L in)</label>
            <div className="row nowrap">
              <input className="max-w-80" inputMode="numeric" placeholder="H" value={dims.h || ''} onChange={e => setDims({ ...dims, h: Number(e.target.value || 0) })} />
              <input className="max-w-80" inputMode="numeric" placeholder="W" value={dims.w || ''} onChange={e => setDims({ ...dims, w: Number(e.target.value || 0) })} />
              <input className="max-w-80" inputMode="numeric" placeholder="L" value={dims.l || ''} onChange={e => setDims({ ...dims, l: Number(e.target.value || 0) })} />
            </div>
          </div>
        </div>

        <div className="field">
          <label>Autos (describe)</label>
          <textarea rows={2} value={autos} onChange={e => setAutos(e.target.value)} />
        </div>

        <div className="field">
          <label>Mechanisms (free text)</label>
          <textarea
            rows={2}
            placeholder="e.g., Coral intake, Algae removal wheel, Camera + AprilTags..."
            value={mechanisms}
            onChange={e => setMechanisms(e.target.value)}
          />
        </div>

        <div className="field">
          <label>Notes</label>
          <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
      </div>

      {/* Photos (stored locally; uploaded on Sync) */}
      <div className="card">
        <h4>Photos (max 3, uploaded on Sync)</h4>
        <div className="row">
          <input type="file" accept="image/*" capture="environment" multiple onChange={e => onPickPhotos(e.target.files)} />
          {photoBlobs.length > 0
            ? <div className="help">{photoBlobs.length} photo{photoBlobs.length > 1 ? 's' : ''} queued</div>
            : <div className="help">You can add up to 3 photos. They'll upload when you Sync.</div>
          }
        </div>

        {photoBlobs.length > 0 && (
          <div className="row">
            {photoBlobs.map((p, i) => (
              <div key={i} className="row gap-8">
                <Thumb blob={p.blob} alt={`photo ${i+1}`} />
                <button className="btn" onClick={() => removePhoto(i)}>Remove</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Save */}
      <div className="row">
        <button
          className="btn primary"
          onClick={async () => {
            if (!teamNumber) { alert('Please select a team.'); return }
            const rec: any = {
              eventKey: settings.eventKey,
              teamNumber: Number(teamNumber),
              drivetrain,
              weightLb: weightLb === '' ? undefined : Number(weightLb),
              dims,
              autos,
              mechanisms,
              notes,
              photos: [],
              photoBlobs: photoBlobs.slice(0, 3),
              scoutName: settings.scoutName || 'unknown',
              deviceId: settings.deviceId,
              createdAt: Date.now(),
              schemaVersion,
              synced: false,
            }
            await putPit(rec as any)
            // Reset form
            setTeamNumber('')
            setDrivetrain('swerve')
            setWeightLb('')
            setDims({ h: 0, w: 0, l: 0 })
            setAutos('')
            setMechanisms('')
            setNotes('')
            setPhotoBlobs([])
            alert(`Saved for Team ${labelForTeam(rec.teamNumber)}`)
          }}
        >
          Save
        </button>
      </div>
    </div>
  )
}
