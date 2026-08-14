import { useState } from 'preact/hooks'
import skillsJson from '../data/skills.json'
import type { Domain, Skill } from '../engine/types'
import {
  createProfile,
  deleteProfile,
  importBundle,
  profile,
  registry,
  renameActiveProfile,
  resetActiveProfile,
  switchProfile,
  updateProfile,
} from '../state/store'
import { copyToClipboard, sendToComputer } from '../storage/exportImport'

const skills = skillsJson as Skill[]
const presentDomains = [...new Set(skills.map((s) => s.domain))]

/**
 * Profile management: the child's profile stays untouchable while the adult
 * tests on a separate profile. Importing an export bundle restores a profile
 * (same id) or adds it as a new one (e.g. previewing the child's state from
 * another device).
 */
function ProfilesSection() {
  const reg = registry.value!
  const [newName, setNewName] = useState('')
  const [renaming, setRenaming] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [importStatus, setImportStatus] = useState('')

  const onImportFile = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    void file.text().then(async (text) => {
      const r = await importBundle(text)
      setImportStatus(r.ok ? `✓ ${r.detail}` : `Failed: ${r.detail}`)
    })
  }

  const onImportPaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      const r = await importBundle(text)
      setImportStatus(r.ok ? `✓ ${r.detail}` : `Failed: ${r.detail}`)
    } catch {
      setImportStatus('Clipboard not readable — use the file picker instead')
    }
  }

  const remove = async (id: string) => {
    if (confirmDelete !== id) {
      setConfirmDelete(id)
      setTimeout(() => setConfirmDelete(null), 4000)
      return
    }
    await deleteProfile(id)
    setConfirmDelete(null)
  }

  return (
    <div>
      <h3 style={{ marginBottom: '10px' }}>Profiles</h3>
      {reg.profiles.map((m) => {
        const active = m.id === reg.activeId
        return (
          <div
            key={m.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: 'var(--card)',
              borderRadius: '10px',
              padding: '8px 12px',
              marginBottom: '6px',
              boxShadow: active ? '0 0 0 3px var(--focus)' : undefined,
            }}
          >
            <span style={{ flex: 1, fontWeight: active ? 700 : 400 }}>
              {m.name}
              {active && <span style={{ color: 'var(--focus)' }}> · active</span>}
            </span>
            {!active && (
              <>
                <button
                  onClick={() => void switchProfile(m.id)}
                  style={{ padding: '6px 14px', borderRadius: '8px', background: 'var(--focus)', color: 'white', fontWeight: 600 }}
                >
                  Use
                </button>
                <button
                  onClick={() => void remove(m.id)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '8px',
                    fontWeight: 600,
                    background: confirmDelete === m.id ? '#c0564e' : 'transparent',
                    color: confirmDelete === m.id ? 'white' : '#c0564e',
                  }}
                >
                  {confirmDelete === m.id ? 'Really delete?' : 'Delete'}
                </button>
              </>
            )}
          </div>
        )
      })}

      <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
        <input
          value={newName}
          onInput={(e) => setNewName((e.target as HTMLInputElement).value)}
          placeholder="New profile name"
          style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(46,58,63,0.25)', fontSize: '1rem' }}
        />
        <button
          onClick={() => {
            if (!newName.trim()) return
            void createProfile(newName.trim())
            setNewName('')
          }}
          style={{ padding: '8px 16px', borderRadius: '8px', background: 'var(--card)', boxShadow: 'var(--shadow)', fontWeight: 600 }}
        >
          Add & switch
        </button>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
        <input
          value={renaming}
          onInput={(e) => setRenaming((e.target as HTMLInputElement).value)}
          placeholder="Rename active profile"
          style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(46,58,63,0.25)', fontSize: '1rem' }}
        />
        <button
          onClick={() => {
            if (!renaming.trim()) return
            void renameActiveProfile(renaming.trim())
            setRenaming('')
          }}
          style={{ padding: '8px 16px', borderRadius: '8px', background: 'var(--card)', boxShadow: 'var(--shadow)', fontWeight: 600 }}
        >
          Rename
        </button>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <label
          style={{ padding: '8px 16px', borderRadius: '8px', background: 'var(--card)', boxShadow: 'var(--shadow)', fontWeight: 600, cursor: 'pointer' }}
        >
          Import file…
          <input type="file" accept=".json,application/json" onChange={onImportFile} style={{ display: 'none' }} />
        </label>
        <button
          onClick={() => void onImportPaste()}
          style={{ padding: '8px 16px', borderRadius: '8px', background: 'var(--card)', boxShadow: 'var(--shadow)', fontWeight: 600 }}
        >
          Import from clipboard
        </button>
        <span style={{ fontSize: '0.85rem', color: 'var(--ink-soft)' }}>{importStatus}</span>
      </div>
      <div style={{ fontSize: '0.8rem', color: 'var(--ink-soft)', marginTop: '6px' }}>
        Importing an export bundle restores that profile (same identity) or adds it as a new one —
        e.g. to preview the child's exact state on another device without touching his data.
      </div>
    </div>
  )
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: string
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '10px 18px',
        borderRadius: '12px',
        fontWeight: 600,
        background: active ? 'var(--focus)' : 'var(--card)',
        color: active ? 'white' : 'var(--ink)',
        boxShadow: 'var(--shadow)',
      }}
    >
      {children}
    </button>
  )
}

export function Settings({ onProfileReset }: { onProfileReset: () => void }) {
  const p = profile.value!
  const [confirmReset, setConfirmReset] = useState(false)
  const [exportStatus, setExportStatus] = useState('')

  const doSend = async () => {
    setExportStatus('Sending…')
    const r = await sendToComputer()
    setExportStatus(r.ok ? `Saved on computer: exports/${r.detail}` : `Failed: ${r.detail}`)
  }
  const doCopy = async () => {
    const ok = await copyToClipboard()
    setExportStatus(ok ? 'JSON copied to clipboard' : 'Clipboard not available')
  }

  const toggleDomain = (d: Domain) => {
    updateProfile((prof) => {
      const on = prof.settings.domainsEnabled.includes(d)
      const next = on
        ? prof.settings.domainsEnabled.filter((x) => x !== d)
        : [...prof.settings.domainsEnabled, d]
      // Never allow zero domains — the session loop would have nothing to serve.
      if (next.length === 0) return prof
      return { ...prof, settings: { ...prof.settings, domainsEnabled: next } }
    })
  }

  const reset = async () => {
    if (!confirmReset) {
      setConfirmReset(true)
      setTimeout(() => setConfirmReset(false), 4000)
      return
    }
    await resetActiveProfile()
    onProfileReset()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <ProfilesSection />

      <div>
        <h3 style={{ marginBottom: '10px' }}>Rounds per session</h3>
        <div style={{ display: 'flex', gap: '10px' }}>
          {[5, 10, 15].map((n) => (
            <Chip
              key={n}
              active={p.settings.trialsPerSession === n}
              onClick={() =>
                updateProfile((prof) => ({
                  ...prof,
                  settings: { ...prof.settings, trialsPerSession: n },
                }))
              }
            >
              {String(n)}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <h3 style={{ marginBottom: '10px' }}>Active skill areas</h3>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {presentDomains.map((d) => (
            <Chip
              key={d}
              active={p.settings.domainsEnabled.includes(d)}
              onClick={() => toggleDomain(d)}
            >
              {d}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <h3 style={{ marginBottom: '10px' }}>Stimulation</h3>
        <div style={{ display: 'flex', gap: '10px' }}>
          <Chip
            active={p.settings.stimulation === 'normal'}
            onClick={() =>
              updateProfile((prof) => ({
                ...prof,
                settings: { ...prof.settings, stimulation: 'normal' },
              }))
            }
          >
            normal
          </Chip>
          <Chip
            active={p.settings.stimulation === 'calm'}
            onClick={() =>
              updateProfile((prof) => ({
                ...prof,
                settings: { ...prof.settings, stimulation: 'calm' },
              }))
            }
          >
            calm
          </Chip>
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--ink-soft)', marginTop: '6px' }}>
          Calm slows and shrinks all animations.
        </div>
      </div>

      <div>
        <h3 style={{ marginBottom: '10px' }}>Data export</h3>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => void doSend()}
            style={{
              padding: '12px 20px',
              borderRadius: '12px',
              fontWeight: 600,
              background: 'var(--card)',
              boxShadow: 'var(--shadow)',
            }}
          >
            Send to computer
          </button>
          <button
            onClick={() => void doCopy()}
            style={{
              padding: '12px 20px',
              borderRadius: '12px',
              fontWeight: 600,
              background: 'var(--card)',
              boxShadow: 'var(--shadow)',
            }}
          >
            Copy JSON
          </button>
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--ink-soft)', marginTop: '6px', minHeight: '1.2em' }}>
          {exportStatus ||
            '"Send to computer" works while playing from the dev server on the laptop; it drops profile + full trial log into the project\'s exports/ folder.'}
        </div>
      </div>

      <div>
        <h3 style={{ marginBottom: '10px' }}>Danger zone</h3>
        <button
          onClick={() => void reset()}
          style={{
            padding: '12px 20px',
            borderRadius: '12px',
            fontWeight: 700,
            background: confirmReset ? '#c0564e' : 'var(--card)',
            color: confirmReset ? 'white' : '#c0564e',
            boxShadow: 'var(--shadow)',
          }}
        >
          {confirmReset ? 'Tap again to erase EVERYTHING' : 'Reset profile & all data'}
        </button>
        <div style={{ fontSize: '0.8rem', color: 'var(--ink-soft)', marginTop: '6px' }}>
          Erases mastery, trial history, blocks, and the build world on this device, and starts a
          fresh placement. Use before handing the game to the child for the first time if you have
          been testing on this device.
        </div>
      </div>
    </div>
  )
}
