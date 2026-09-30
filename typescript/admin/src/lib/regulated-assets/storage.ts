export interface RegulatedAssetRecord {
  id: string
  denom: string
  registration: string
  createdAt: number
}

const STORAGE_KEY = 'bankd:regulated-assets:v2'

export function getRegulatedAssets(): RegulatedAssetRecord[] {
  if (typeof window === 'undefined') return []

  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((record): record is RegulatedAssetRecord =>
      typeof record?.id === 'string' && typeof record.denom === 'string' && typeof record.registration === 'string' && typeof record.createdAt === 'number'
    ) : []
  } catch {
    return []
  }
}

export function saveRegulatedAsset(record: RegulatedAssetRecord): void {
  if (typeof window === 'undefined') return

  const next = [
    record,
    ...getRegulatedAssets().filter((asset) => asset.id !== record.id),
  ]
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}
