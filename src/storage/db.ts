import { del, get, set, update } from 'idb-keyval'
import type { Profile, Trial } from '../engine/types'

export interface ProfileMeta {
  id: string
  name: string
}

export interface Registry {
  activeId: string
  profiles: ProfileMeta[]
}

const REGISTRY_KEY = 'tutor:registry:v1'
// Single-profile era keys — kept as a safety copy after migration.
const LEGACY_PROFILE_KEY = 'tutor:profile:v1'
const LEGACY_TRIALS_KEY = 'tutor:trials:v1'

const profileKey = (id: string) => `tutor:profile:v1:${id}`
const trialsKey = (id: string) => `tutor:trials:v1:${id}`

export async function loadRegistry(): Promise<Registry | undefined> {
  return get<Registry>(REGISTRY_KEY)
}

export async function saveRegistry(registry: Registry): Promise<void> {
  await set(REGISTRY_KEY, registry)
}

/**
 * One-time move of single-profile-era data into the profile registry.
 * The legacy keys are deliberately NOT deleted — they stay behind as an
 * extra safety copy of the child's data.
 */
export async function migrateLegacyIfNeeded(): Promise<void> {
  if (await get<Registry>(REGISTRY_KEY)) return
  const legacy = await get<Profile>(LEGACY_PROFILE_KEY)
  if (!legacy) return
  const trials = (await get<Trial[]>(LEGACY_TRIALS_KEY)) ?? []
  await set(profileKey(legacy.id), legacy)
  await set(trialsKey(legacy.id), trials)
  await saveRegistry({ activeId: legacy.id, profiles: [{ id: legacy.id, name: legacy.name }] })
}

export async function loadProfileById(id: string): Promise<Profile | undefined> {
  return get<Profile>(profileKey(id))
}

export async function saveProfileById(profile: Profile): Promise<void> {
  await set(profileKey(profile.id), profile)
}

export async function loadTrialsById(id: string): Promise<Trial[]> {
  return (await get<Trial[]>(trialsKey(id))) ?? []
}

export async function appendTrialById(id: string, trial: Trial): Promise<void> {
  await update<Trial[]>(trialsKey(id), (trials) => [...(trials ?? []), trial])
}

export async function saveTrialsById(id: string, trials: Trial[]): Promise<void> {
  await set(trialsKey(id), trials)
}

export async function deleteProfileData(id: string): Promise<void> {
  await del(profileKey(id))
  await del(trialsKey(id))
}
