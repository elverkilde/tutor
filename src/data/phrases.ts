/**
 * Every word the app ever speaks lives here. This catalog drives TTS today
 * and doubles as the recording script if we switch to pre-recorded clips
 * (record full phrases per number — Danish prosody splices badly).
 */

const DA_NUMBERS = [
  'nul',
  'en',
  'to',
  'tre',
  'fire',
  'fem',
  'seks',
  'syv',
  'otte',
  'ni',
  'ti',
  'elleve',
  'tolv',
  'tretten',
  'fjorten',
  'femten',
  'seksten',
  'sytten',
  'atten',
  'nitten',
  'tyve',
] as const

export function daNumber(n: number): string {
  return DA_NUMBERS[n] ?? String(n)
}

const blokke = (n: number) => (n === 1 ? 'en blok' : `${daNumber(n)} blokke`)

export const phrases = {
  greeting: () => 'Hej! Skal vi spille og bygge?',
  letsGo: () => 'Så er vi i gang!',
  tapMore: () => 'Tryk på bunken med flest blokke',
  tapMoreDigits: () => 'Tryk på det største tal',
  dragToChest: (n = 0) => `Træk ${blokke(n)} hen til kisten`,
  dragToChestSign: () => 'Læg lige så mange blokke i kisten, som tallet viser',
  numeralMatch: () => 'Hvor mange blokke er der? Tryk på tallet',
  // "blokke" deliberately avoided: a ten-rod is one draggable thing, and he
  // takes spoken words literally — this phrasing never implies 17 drags.
  tensChest: (n = 0) => `Læg ${daNumber(n)} i kisten`,
  numeralCount: () => 'Tæl blokkene, og tryk så på tallet',
  buildTower: (n = 0) => `Byg et tårn med ${blokke(n)}`,
  lineGoto: (n = 0) => `Hop hen til tallet ${daNumber(n)}`,
  lineAfter: (n = 0) => `Tryk på tallet, der kommer lige efter ${daNumber(n)}`,
  lineBefore: (n = 0) => `Tryk på tallet, der kommer lige før ${daNumber(n)}`,
  patternNext: () => 'Hvilken blok kommer nu? Fortsæt mønsteret',
  combineCount: () => 'Hvor mange blokke er der i alt? Tryk på tallet',
  gatherSum: () => 'Saml alle blokkene i kisten. Hvor mange er der i alt?',
  // "gange" (times), not "hop": "hop tre hop" reads as a rule he can't parse.
  lineAdd: (n = 0, n2 = 0) =>
    `Du står på ${daNumber(n)}. Hop ${n2 === 1 ? 'en gang' : `${daNumber(n2)} gange`} frem`,
  lineSub: (n = 0, n2 = 0) =>
    `Du står på ${daNumber(n)}. Hop ${n2 === 1 ? 'en gang' : `${daNumber(n2)} gange`} tilbage`,
  takeAway: (n = 0, n2 = 0) =>
    `Der er ${blokke(n)}. ${daNumber(n2)} hopper væk. Hvor mange er der tilbage?`,
  plusEquation: (n = 0, n2 = 0) => `Hvor meget er ${daNumber(n)} plus ${daNumber(n2)}?`,
  minusEquation: (n = 0, n2 = 0) => `Hvor meget er ${daNumber(n)} minus ${daNumber(n2)}?`,
  missingPlus: (n = 0, n2 = 0) => `${daNumber(n)} plus hvad giver ${daNumber(n2)}?`,
  worldBigger: () => 'Din verden er vokset! Der er mere plads at bygge på',
  praise1: () => 'Flot!',
  praise2: () => 'Super!',
  praise3: () => 'Rigtigt!',
  praise4: () => 'Godt klaret!',
  tryAgain: () => 'Prøv igen',
  number: (n = 0) => daNumber(n),
  watchMe: () => 'Se her',
  earnedBlock: () => 'Du fik en blok!',
  newBlockType: () => 'En ny slags blok!',
  buildTime: () => 'Byggetid! Sæt dine blokke på pladen',
  // Careful: he follows spoken words as literal rules — "we're done for
  // today" made a second session impossible. Praise only, never closure.
  sessionDone: () => 'Sikke flot arbejde!',
} as const

export type PhraseKey = keyof typeof phrases

export interface PhraseRef {
  key: PhraseKey
  n?: number
  n2?: number
}

export function phraseText(ref: PhraseRef): string {
  return phrases[ref.key](ref.n ?? 0, ref.n2 ?? 0)
}

const PRAISE: PhraseKey[] = ['praise1', 'praise2', 'praise3', 'praise4']

export function praiseKey(i: number): PhraseKey {
  return PRAISE[i % PRAISE.length]
}
