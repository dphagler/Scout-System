import { resolveGameByEventKey, GameConfig } from './games'

export function getGameForEvent(eventKey: string): GameConfig {
  return resolveGameByEventKey(eventKey)
}
