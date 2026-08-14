import type { Profile, Trial } from '../engine/types'
import { loadActiveTrials, profile } from '../state/store'

export interface ExportBundle {
  formatVersion: 1
  exportedAt: string
  profile: Profile
  trials: Trial[]
}

export async function buildExportBundle(): Promise<ExportBundle | null> {
  if (!profile.value) return null
  return {
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    profile: profile.value,
    trials: await loadActiveTrials(),
  }
}

/** POST the bundle to the dev server's drop endpoint (LAN sessions only). */
export async function sendToComputer(): Promise<{ ok: boolean; detail: string }> {
  const bundle = await buildExportBundle()
  if (!bundle) return { ok: false, detail: 'no data' }
  try {
    const res = await fetch('/api/export', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(bundle),
    })
    if (!res.ok) return { ok: false, detail: `server said ${res.status}` }
    const json = (await res.json()) as { file?: string }
    return { ok: true, detail: json.file ?? 'saved' }
  } catch {
    return { ok: false, detail: 'not reachable (dev server only)' }
  }
}

/** Fallback path: JSON to the clipboard, paste it wherever it needs to go. */
export async function copyToClipboard(): Promise<boolean> {
  const bundle = await buildExportBundle()
  if (!bundle) return false
  try {
    await navigator.clipboard.writeText(JSON.stringify(bundle))
    return true
  } catch {
    return false
  }
}
