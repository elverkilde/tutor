import type { PhraseRef } from '../data/phrases'

export interface AudioService {
  /** Must be called from inside a user gesture (iOS requirement). */
  unlock(): Promise<void>
  /** Speaks a phrase; resolves when speech ends. Cancels any prior speech. */
  speak(ref: PhraseRef): Promise<void>
  ready(): boolean
}
