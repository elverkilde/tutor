/**
 * Tiny WebAudio chimes — no samples, works offline, volume kept gentle.
 * The "try again" sound is deliberately neutral (a soft low boop), never
 * a sad or harsh buzzer.
 */
let ctx: AudioContext | null = null

function ensureCtx(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null
  ctx ??= new AudioContext()
  return ctx
}

export async function unlockSfx(): Promise<void> {
  const c = ensureCtx()
  if (c && c.state === 'suspended') await c.resume()
}

function tone(freq: number, startInMs: number, durMs: number, gainPeak = 0.12): void {
  const c = ensureCtx()
  if (!c) return
  const t0 = c.currentTime + startInMs / 1000
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0, t0)
  gain.gain.linearRampToValueAtTime(gainPeak, t0 + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durMs / 1000)
  osc.connect(gain).connect(c.destination)
  osc.start(t0)
  osc.stop(t0 + durMs / 1000 + 0.05)
}

export const sfx = {
  correct() {
    tone(523.25, 0, 250) // C5
    tone(659.25, 120, 350) // E5
  },
  reward() {
    tone(523.25, 0, 200)
    tone(659.25, 100, 200)
    tone(783.99, 200, 200)
    tone(1046.5, 300, 450)
  },
  tryAgain() {
    tone(330, 0, 300, 0.08)
  },
  place() {
    tone(880, 0, 120, 0.06)
  },
}
