import { signal } from '@preact/signals'
import skillsJson from '../data/skills.json'
import type { Profile, Skill, Trial } from '../engine/types'
import { newProfile } from '../engine/types'
import { uid } from '../engine/uid'
import { applyTrial } from '../engine/mastery'
import { initPlacement } from '../engine/placement'
import {
  appendTrialById,
  deleteProfileData,
  loadProfileById,
  loadRegistry,
  loadTrialsById,
  migrateLegacyIfNeeded,
  saveProfileById,
  saveRegistry,
  saveTrialsById,
  type Registry,
} from '../storage/db'
import { createTts } from '../audio/tts'

export const profile = signal<Profile | null>(null)
export const registry = signal<Registry | null>(null)
export const audio = createTts()

function freshProfile(name: string): Profile {
  const p = newProfile(uid(), name, new Date().toISOString())
  // New profiles start in placement mode: the first sessions are the
  // (invisible) assessment.
  return { ...p, placement: initPlacement(skillsJson as Skill[]) }
}

async function activate(id: string): Promise<boolean> {
  const p = await loadProfileById(id)
  if (!p) return false
  profile.value = p
  return true
}

export async function initStore(): Promise<void> {
  await migrateLegacyIfNeeded()
  let reg = await loadRegistry()
  if (!reg || reg.profiles.length === 0) {
    const p = freshProfile('Spiller')
    await saveProfileById(p)
    reg = { activeId: p.id, profiles: [{ id: p.id, name: p.name }] }
    await saveRegistry(reg)
  }
  registry.value = reg
  if (await activate(reg.activeId)) return
  // Self-heal: the active entry points at missing data — try the others.
  for (const meta of reg.profiles) {
    if (await activate(meta.id)) {
      registry.value = { ...reg, activeId: meta.id }
      await saveRegistry(registry.value)
      return
    }
  }
  const p = freshProfile('Spiller')
  await saveProfileById(p)
  registry.value = { activeId: p.id, profiles: [{ id: p.id, name: p.name }] }
  await saveRegistry(registry.value)
  profile.value = p
}

/** All profile mutations flow through here so persistence can't be forgotten. */
export function updateProfile(fn: (p: Profile) => Profile): void {
  if (!profile.value) return
  const next = fn(profile.value)
  profile.value = next
  void saveProfileById(next)
}

/** Log a trial: append to the durable log and fold into mastery. */
export function recordTrial(trial: Trial): void {
  if (!profile.value) return
  void appendTrialById(profile.value.id, trial)
  updateProfile((p) => ({ ...p, mastery: applyTrial(p.mastery, trial) }))
}

export async function loadActiveTrials(): Promise<Trial[]> {
  if (!profile.value) return []
  return loadTrialsById(profile.value.id)
}

export async function switchProfile(id: string): Promise<void> {
  const reg = registry.value
  if (!reg || id === reg.activeId) return
  if (!(await activate(id))) return
  registry.value = { ...reg, activeId: id }
  await saveRegistry(registry.value)
}

export async function createProfile(name: string): Promise<void> {
  const reg = registry.value
  if (!reg) return
  const p = freshProfile(name)
  await saveProfileById(p)
  registry.value = {
    activeId: p.id,
    profiles: [...reg.profiles, { id: p.id, name: p.name }],
  }
  await saveRegistry(registry.value)
  profile.value = p
}

export async function renameActiveProfile(name: string): Promise<void> {
  const reg = registry.value
  if (!reg || !profile.value || !name.trim()) return
  updateProfile((p) => ({ ...p, name: name.trim() }))
  registry.value = {
    ...reg,
    profiles: reg.profiles.map((m) => (m.id === reg.activeId ? { ...m, name: name.trim() } : m)),
  }
  await saveRegistry(registry.value)
}

/** Delete a NON-active profile and all its data. */
export async function deleteProfile(id: string): Promise<void> {
  const reg = registry.value
  if (!reg || id === reg.activeId) return
  await deleteProfileData(id)
  registry.value = { ...reg, profiles: reg.profiles.filter((m) => m.id !== id) }
  await saveRegistry(registry.value)
}

/** Restart the ACTIVE profile: fresh placement, empty history — same identity. */
export async function resetActiveProfile(): Promise<void> {
  const current = profile.value
  if (!current) return
  const fresh = { ...freshProfile(current.name), id: current.id, createdAt: current.createdAt }
  await saveTrialsById(current.id, [])
  profile.value = fresh
  await saveProfileById(fresh)
}

/**
 * Import an export bundle. Same profile id -> restore/overwrite it; unknown
 * id -> added as a new profile. Switches to the imported profile.
 */
export async function importBundle(text: string): Promise<{ ok: boolean; detail: string }> {
  const reg = registry.value
  if (!reg) return { ok: false, detail: 'store not ready' }
  let bundle: { formatVersion?: number; profile?: Profile; trials?: Trial[] }
  try {
    bundle = JSON.parse(text)
  } catch {
    return { ok: false, detail: 'not valid JSON' }
  }
  const p = bundle.profile
  if (bundle.formatVersion !== 1 || !p || typeof p.id !== 'string' || !Array.isArray(bundle.trials)) {
    return { ok: false, detail: 'not a recognized export bundle' }
  }
  const exists = reg.profiles.some((m) => m.id === p.id)
  await saveProfileById(p)
  await saveTrialsById(p.id, bundle.trials)
  registry.value = {
    activeId: p.id,
    profiles: exists
      ? reg.profiles.map((m) => (m.id === p.id ? { ...m, name: p.name } : m))
      : [...reg.profiles, { id: p.id, name: p.name }],
  }
  await saveRegistry(registry.value)
  profile.value = p
  return {
    ok: true,
    detail: exists ? `restored "${p.name}"` : `imported "${p.name}" (${bundle.trials.length} trials)`,
  }
}
