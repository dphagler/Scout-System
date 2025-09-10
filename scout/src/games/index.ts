import { GameConfig } from './types'
import { GAME_2025 } from './2025.reefscape'
import { GAME_2024 } from './2024.crescendo'

const GAMES_BY_YEAR: Record<number, GameConfig> = {
  2025: GAME_2025,
  2024: GAME_2024
}

// Fallback if year not mapped
const FALLBACK: GameConfig = GAME_2025

export function resolveGameByEventKey(eventKey: string): GameConfig {
  // event keys are like "2025gaalb" – first 4 chars = year
  const year = parseInt(String(eventKey || '').slice(0, 4), 10)
  if (Number.isFinite(year) && GAMES_BY_YEAR[year]) return GAMES_BY_YEAR[year]
  return FALLBACK
}

export type { GameConfig } from './types'
