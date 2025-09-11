import { GameConfig } from './types'

// Reefscape (2025): per-level coral in Auto & Teleop + algae + mobility + coop + notes.
// Endgame (climb) remains defined here so MatchForm won't duplicate it.
export const GAME_2025: GameConfig = {
  id: 'reefscape-2025',
  name: 'Reefscape (2025)',
  schema: 2,
  sections: [
    {
      title: 'Autonomous',
      fields: [
        { kind: 'counter', key: 'auto_coral_L1', label: 'Coral L1 (Auto)', min: 0 },
        { kind: 'counter', key: 'auto_coral_L2', label: 'Coral L2 (Auto)', min: 0 },
        { kind: 'counter', key: 'auto_coral_L3', label: 'Coral L3 (Auto)', min: 0 },
        { kind: 'counter', key: 'auto_coral_L4', label: 'Coral L4 (Auto)', min: 0 },
        { kind: 'counter', key: 'auto_algae_scored', label: 'Algae Scored (Auto)', min: 0 },
        { kind: 'toggle',  key: 'auto_mobility',     label: 'Mobility Achieved' }
      ]
    },
    {
      title: 'Teleop',
      fields: [
        { kind: 'counter', key: 'teleop_coral_L1', label: 'Coral L1', min: 0 },
        { kind: 'counter', key: 'teleop_coral_L2', label: 'Coral L2', min: 0 },
        { kind: 'counter', key: 'teleop_coral_L3', label: 'Coral L3', min: 0 },
        { kind: 'counter', key: 'teleop_coral_L4', label: 'Coral L4', min: 0 },
        { kind: 'counter', key: 'teleop_algae_scored', label: 'Algae Scored', min: 0 },
        { kind: 'counter', key: 'teleop_dropped',      label: 'Game Pieces Dropped', min: 0 }
      ]
    },
    {
      title: 'Endgame',
      fields: [
        {
          kind: 'select',
          key: 'endgame_climb',
          label: 'Endgame',
          options: [
            { value: 'none',   label: 'None' },
            { value: 'low',    label: 'Shallow' },
            { value: 'mid',    label: 'Deep' }
          ]
        },
        { kind: 'toggle', key: 'coop', label: 'Coopertition Achieved' }
      ]
    }
  ]
}
