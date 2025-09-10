import { GameConfig } from './types'

// 2024 CRESCENDO – simplified essentials
export const GAME_2024: GameConfig = {
  id: 'crescendo-2024',
  name: 'CRESCENDO (2024)',
  schema: 2,
  sections: [
    {
      title: 'Autonomous',
      fields: [
        { kind: 'counter', key: 'auto_notes_speaker', label: 'Speaker (Auto)', min: 0 },
        { kind: 'counter', key: 'auto_notes_amp',     label: 'Amp (Auto)', min: 0 },
        { kind: 'toggle',  key: 'auto_leave',         label: 'Taxi / Mobility' }
      ]
    },
    {
      title: 'Teleop',
      fields: [
        { kind: 'counter', key: 'teleop_notes_speaker', label: 'Speaker', min: 0 },
        { kind: 'counter', key: 'teleop_notes_amp',     label: 'Amp', min: 0 },
        { kind: 'counter', key: 'teleop_missed',        label: 'Missed', min: 0 }
      ]
    },
    {
      title: 'Endgame',
      fields: [
        {
          kind: 'select',
          key: 'endgame_status',
          label: 'Endgame',
          options: [
            { value: 'none',  label: 'None' },
            { value: 'park',  label: 'Park' },
            { value: 'onstage', label: 'Onstage' },
            { value: 'harmonize', label: 'Harmonize' }
          ]
        },
        { kind: 'toggle', key: 'trap_scored', label: 'Trap Scored' }
      ]
    }
  ]
}
