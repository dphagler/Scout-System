export type FieldKind = 'counter' | 'toggle' | 'select' | 'textarea'

export type CounterField = {
  kind: 'counter'
  key: string
  label: string
  min?: number
  max?: number
}

export type ToggleField = {
  kind: 'toggle'
  key: string
  label: string
}

export type SelectField = {
  kind: 'select'
  key: string
  label: string
  options: { value: string; label: string }[]
}

export type TextAreaField = {
  kind: 'textarea'
  key: string
  label: string
  rows?: number
}

export type GameField = CounterField | ToggleField | SelectField | TextAreaField

export type GameSection = {
  title: string
  fields: GameField[]
}

export type GameConfig = {
  id: string               // human id e.g. 'reefscape-2025'
  name: string             // display e.g. 'Reefscape (2025)'
  schema: number           // bump when you change the config
  sections: GameSection[]  // UI layout
}
