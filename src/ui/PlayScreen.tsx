import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import skillsJson from '../data/skills.json'
import { praiseKey } from '../data/phrases'
import { pickEarnedBlock, type BlockType } from '../data/blocks'
import { mulberry32 } from '../engine/rng'
import { selectNext } from '../engine/selector'
import { uid } from '../engine/uid'
import { applyProbeResult, nextProbe, seedMastery } from '../engine/placement'
import type { Mode, ScaffoldLevel, Skill, TrialPick } from '../engine/types'
import { audio, profile, recordTrial, updateProfile } from '../state/store'
import { sfx } from '../audio/sfx'
import { templates } from '../templates/registry'
import type { TrialSpec } from '../templates/types'
import { Block } from './Block'
import { TrialFrame } from './TrialFrame'

const skills = skillsJson as Skill[]

interface ActiveItem {
  pick: TrialPick
  spec: TrialSpec
  mode: Mode
}

/**
 * Runs one session: select item -> present -> handle response with the
 * errorless ladder (clean -> scaffolded retry -> demonstration) -> reward ->
 * next. Templates render the trial; every sequencing decision lives here.
 */
export function PlayScreen({ onDone }: { onDone: () => void }) {
  const settings = profile.value!.settings
  const sessionId = useMemo(() => uid(), [])
  const rng = useMemo(() => mulberry32(Date.now() >>> 0), [])

  const [round, setRound] = useState(0)
  const [item, setItem] = useState<ActiveItem | null>(null)
  const [attempt, setAttempt] = useState<ScaffoldLevel>(0)
  /** First time this profile meets a mechanic: play one demonstration round first. */
  const [intro, setIntro] = useState(false)
  const [overlay, setOverlay] = useState<BlockType | null>(null)
  const recentRef = useRef<{ templateId: string; skillId: string }[]>([])
  const presentedAt = useRef(0)
  const correctCount = useRef(0)
  const alive = useRef(true)
  useEffect(() => () => void (alive.current = false), [])

  useEffect(() => {
    const p = profile.value!
    // During placement, probes decide the items; afterwards the mastery
    // selector takes over. The child sees no difference.
    let mode: Mode = 'practice'
    let pick: TrialPick | null = null
    if (p.placement && !p.placement.done) {
      pick = nextProbe(p.placement, skills)
      if (pick) mode = 'placement'
    }
    pick ??= selectNext(skills, p.mastery, settings, recentRef.current, rng)
    if (!pick) {
      onDone()
      return
    }
    recentRef.current.push({ templateId: pick.templateId, skillId: pick.skillId })
    const seed = rng.int(1, 2 ** 30)
    const spec = templates[pick.templateId].generateTrial(pick.skillId, pick.params, seed)
    setItem({ pick, spec, mode })
    setAttempt(0)
    const unseen = !(p.seenTemplates ?? []).includes(pick.templateId)
    setIntro(unseen)
    presentedAt.current = performance.now()
    // An intro demo narrates itself; the prompt gets spoken on the real trial.
    if (!unseen) void audio.speak(spec.promptPhrase)
  }, [round])

  const logTrial = (outcome: 'correct' | 'incorrect' | 'demonstrated', level: ScaffoldLevel) => {
    if (!item) return
    recordTrial({
      id: uid(),
      sessionId,
      ts: new Date().toISOString(),
      mode: item.mode,
      skillId: item.pick.skillId,
      templateId: item.pick.templateId,
      params: item.pick.params,
      scaffoldLevel: level,
      outcome,
      responseMs: Math.round(performance.now() - presentedAt.current),
    })
  }

  const advance = () => {
    if (!alive.current) return
    if (round + 1 >= settings.trialsPerSession) {
      void audio.speak({ key: 'buildTime' })
      onDone()
    } else {
      setRound((r) => r + 1)
    }
  }

  /** The probe verdict is the first, unscaffolded attempt only. */
  const updatePlacement = (pass: boolean) => {
    updateProfile((p) => {
      if (!p.placement || p.placement.done) return p
      const next = applyProbeResult(p.placement, skills, pass)
      if (next.done) {
        return {
          ...p,
          mastery: seedMastery(p.mastery, next, new Date().toISOString()),
          placement: null,
        }
      }
      return { ...p, placement: next }
    })
  }

  const handleResponse = ({ correct }: { correct: boolean }) => {
    logTrial(correct ? 'correct' : 'incorrect', attempt)
    if (item?.mode === 'placement' && attempt === 0) updatePlacement(correct)
    if (correct) {
      correctCount.current++
      const masteredCount = Object.values(profile.value!.mastery).filter(
        (m) => m.masteredAt,
      ).length
      const block = pickEarnedBlock(correctCount.current, masteredCount, rng)
      updateProfile((p) => ({
        ...p,
        inventory: { ...p.inventory, [block.id]: (p.inventory[block.id] ?? 0) + 1 },
      }))
      if (block.rare) sfx.reward()
      else sfx.correct()
      setOverlay(block)
      void audio.speak({ key: praiseKey(correctCount.current) })
      setTimeout(() => {
        if (!alive.current) return
        setOverlay(null)
        advance()
      }, 1600)
    } else if (attempt === 0) {
      // First miss: same numbers, easier form, gentle voice.
      sfx.tryAgain()
      setAttempt(1)
      presentedAt.current = performance.now()
      void audio
        .speak({ key: 'tryAgain' })
        .then(() => (alive.current && item ? audio.speak(item.spec.promptPhrase) : undefined))
    } else {
      // Second miss: show, don't scold. The template plays the demonstration.
      setAttempt(2)
    }
  }

  const handleDemoFinished = () => {
    if (intro && item) {
      // The intro was instruction, not assessment: nothing is logged. Mark
      // the mechanic as met and present the real trial with fresh numbers.
      updateProfile((p) => ({
        ...p,
        seenTemplates: [...(p.seenTemplates ?? []), item.pick.templateId],
      }))
      const seed = rng.int(1, 2 ** 30)
      const spec = templates[item.pick.templateId].generateTrial(
        item.pick.skillId,
        item.pick.params,
        seed,
      )
      setItem({ ...item, spec })
      setIntro(false)
      setAttempt(0)
      presentedAt.current = performance.now()
      void audio.speak(spec.promptPhrase)
      return
    }
    logTrial('demonstrated', 2)
    advance()
  }

  if (!item) return null

  const template = templates[item.pick.templateId]
  const level: ScaffoldLevel = intro ? 2 : attempt
  const displaySpec = template.applyScaffold(item.spec, level)
  const TemplateView = template.View

  return (
    <div style={{ height: '100%', position: 'relative' }}>
      <TrialFrame
        onReplayAudio={() => void audio.speak(item.spec.promptPhrase)}
        totalRounds={settings.trialsPerSession}
        doneRounds={round}
      >
        <TemplateView
          key={`${round}-${attempt}-${intro ? 'intro' : 'real'}`}
          spec={displaySpec}
          scaffoldLevel={level}
          stimulation={settings.stimulation}
          speak={(ref) => audio.speak(ref)}
          onResponse={handleResponse}
          onDemoFinished={handleDemoFinished}
        />
      </TrialFrame>

      {/* Earned-block celebration: a block pops in, then floats to the inventory */}
      {overlay && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(251,249,244,0.75)',
            zIndex: 20,
          }}
        >
          <div style={{ animation: 'pop-in var(--anim-slow) ease-out', textAlign: 'center' }}>
            <Block type={overlay.id} size={110} />
            <div style={{ fontSize: '2rem', marginTop: '10px' }}>{overlay.rare ? '✨' : '+1'}</div>
          </div>
        </div>
      )}
    </div>
  )
}
