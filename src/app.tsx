import { useEffect, useState } from 'preact/hooks'
import skillsJson from './data/skills.json'
import { validateGraph } from './engine/graph'
import type { Skill } from './engine/types'
import { initStore, profile } from './state/store'
import { templates } from './templates/registry'
import { AdultScreen } from './adult/AdultScreen'
import { PlayScreen } from './ui/PlayScreen'
import { RewardWorldScreen } from './ui/RewardWorld'
import { StartScreen } from './ui/StartScreen'

type Screen = 'loading' | 'start' | 'play' | 'world' | 'adult'

export function App() {
  const [screen, setScreen] = useState<Screen>('loading')

  useEffect(() => {
    validateGraph(skillsJson as Skill[], Object.keys(templates))
    void initStore().then(() => setScreen('start'))
  }, [])

  if (screen === 'loading' || !profile.value) return null

  const calm = profile.value.settings.stimulation === 'calm'

  return (
    <div style={{ height: '100%', ...(calm ? { '--anim-scale': '0.3' } : {}) }}>
      {screen === 'start' && (
        <StartScreen
          onPlay={() => setScreen('play')}
          onWorld={() => setScreen('world')}
          onAdult={() => setScreen('adult')}
        />
      )}
      {screen === 'play' && <PlayScreen onDone={() => setScreen('world')} />}
      {screen === 'world' && <RewardWorldScreen onDone={() => setScreen('start')} />}
      {screen === 'adult' && <AdultScreen onClose={() => setScreen('start')} />}
    </div>
  )
}
