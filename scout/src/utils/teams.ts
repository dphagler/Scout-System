// Build a teams meta dict from a variety of server cache shapes.
export function buildTeamsMetaFromAny(raw: any): Record<string, { team_number: number, nickname: string|null, name: string|null }> {
  const dict: Record<string, { team_number: number, nickname: string|null, name: string|null }> = {}
  if (!raw) return dict

  if (raw.meta && typeof raw.meta === 'object' && Object.keys(raw.meta).length) {
    for (const [k, v] of Object.entries<any>(raw.meta)) {
      const num = Number(k)
      if (!Number.isFinite(num) || num <= 0) continue
      dict[String(num)] = { team_number: num, nickname: v?.nickname ?? null, name: v?.name ?? null }
    }
    return dict
  }

  if (Array.isArray(raw.teams)) {
    for (const n of raw.teams) {
      const num = Number(n)
      if (!Number.isFinite(num) || num <= 0) continue
      dict[String(num)] = { team_number: num, nickname: null, name: null }
    }
    return dict
  }

  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const keys = Object.keys(raw)
    if (keys.length && keys.every(k => /^\d+$/.test(k))) {
      for (const k of keys) {
        const row: any = (raw as any)[k] || {}
        const num = Number(k)
        dict[String(num)] = { team_number: num, nickname: row?.nickname ?? null, name: row?.name ?? null }
      }
      return dict
    }
  }

  if (Array.isArray(raw)) {
    for (const r of raw) {
      const num = Number(r?.team_number ?? r?.teamNumber)
      if (!Number.isFinite(num) || num <= 0) continue
      dict[String(num)] = { team_number: num, nickname: r?.nickname ?? null, name: r?.name ?? null }
    }
    return dict
  }

  return dict
}

