import { phraseText, type PhraseRef } from '../data/phrases'
import type { AudioService } from './types'

/**
 * speechSynthesis wrapper for Danish. Voice loading is async in Chrome
 * (voiceschanged fires late), so we re-resolve the voice lazily on each
 * speak until one is found. Prefers on-device voices — they work offline.
 */
function findDanishVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis?.getVoices() ?? []
  const danish = voices.filter((v) => v.lang.toLowerCase().startsWith('da'))
  if (danish.length === 0) return null
  return danish.find((v) => v.localService) ?? danish[0]
}

export function createTts(): AudioService {
  let voice: SpeechSynthesisVoice | null = null
  let unlocked = false

  if ('speechSynthesis' in window) {
    voice = findDanishVoice()
    window.speechSynthesis.addEventListener('voiceschanged', () => {
      voice ??= findDanishVoice()
    })
  }

  function speakText(text: string): Promise<void> {
    return new Promise((resolve) => {
      if (!('speechSynthesis' in window)) return resolve()
      window.speechSynthesis.cancel() // never queue — stale prompts confuse
      voice ??= findDanishVoice()
      const u = new SpeechSynthesisUtterance(text)
      u.lang = 'da-DK'
      if (voice) u.voice = voice
      u.rate = 0.85 // a touch slower for comprehension
      let done = false
      const finish = () => {
        if (done) return
        done = true
        resolve()
      }
      u.addEventListener('end', finish)
      u.addEventListener('error', finish)
      // If the engine never starts (no Danish voice, muted platform, headless),
      // don't hold the game hostage — resolve and let play continue silently.
      setTimeout(() => {
        if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) finish()
      }, 1500)
      // Belt-and-braces: 'end' occasionally never fires after cancel()
      setTimeout(finish, 8000)
      window.speechSynthesis.speak(u)
    })
  }

  return {
    async unlock() {
      // Speaking a real greeting inside the tap both satisfies the iOS
      // gesture requirement and feels intentional to the child.
      await speakText(phraseText({ key: 'greeting' }))
      unlocked = true
    },
    speak(ref: PhraseRef) {
      return speakText(phraseText(ref))
    },
    ready() {
      return unlocked
    },
  }
}
