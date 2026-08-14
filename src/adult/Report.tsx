import { useEffect, useState } from 'preact/hooks'
import skillsJson from '../data/skills.json'
import { deriveStatus } from '../engine/mastery'
import { effectiveMastery } from '../engine/placement'
import type { Domain, Skill, Trial } from '../engine/types'
import { loadActiveTrials, profile } from '../state/store'
import { sessionSeries } from './trendData'

const skills = skillsJson as Skill[]

/**
 * A print-ready status report in Danish — the audience is school staff and
 * PPR, not the tutor. Objective, first-attempt data only.
 */

const DOMAIN_DA: Record<Domain, string> = {
  subitizing: 'Antalsopfattelse (subitizing)',
  counting: 'Tælling',
  numeral: 'Talsymboler og mængder',
  magnitude: 'Størst og mindst',
  ordering: 'Rækkefølge og tallinje',
  addsub: 'Plus og minus',
  patterns: 'Mønstre',
}

function pct(clean: number, total: number): string {
  return total === 0 ? '–' : `${Math.round((clean / total) * 100)} %`
}

export function Report() {
  const p = profile.value!
  const [trials, setTrials] = useState<Trial[] | null>(null)
  useEffect(() => {
    void loadActiveTrials().then(setTrials)
  }, [p.id])

  if (trials === null) return <div>Loading…</div>

  const mastery = effectiveMastery(p.mastery, p.placement, new Date().toISOString())
  const points = sessionSeries(trials, skills)
  const firstTries = trials.filter((t) => t.scaffoldLevel === 0)
  const clean = firstTries.filter((t) => t.outcome === 'correct').length
  const cleanTimes = firstTries
    .filter((t) => t.outcome === 'correct' && t.responseMs > 0)
    .map((t) => t.responseMs)
    .sort((a, b) => a - b)
  const medianMs = cleanTimes.length ? cleanTimes[Math.floor(cleanTimes.length / 2)] : null

  const domains = [...new Set(skills.map((s) => s.domain))]
  const mastered = (d: Domain) =>
    skills.filter((s) => s.domain === d && deriveStatus(s, mastery) === 'mastered')
  const practicing = (d: Domain) =>
    skills.filter((s) => s.domain === d && deriveStatus(s, mastery) === 'practicing')

  const byDomainStats = domains.map((d) => {
    const dTrials = firstTries.filter(
      (t) => skills.find((s) => s.id === t.skillId)?.domain === d,
    )
    return {
      domain: d,
      total: dTrials.length,
      clean: dTrials.filter((t) => t.outcome === 'correct').length,
    }
  })

  const dateFmt = (ts: string) =>
    new Date(ts).toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div>
      <button
        class="no-print"
        onClick={() => window.print()}
        style={{
          padding: '10px 18px',
          borderRadius: '10px',
          fontWeight: 600,
          background: 'var(--focus)',
          color: 'white',
          boxShadow: 'var(--shadow)',
          marginBottom: '14px',
        }}
      >
        Udskriv / gem som PDF
      </button>

      <div
        style={{
          background: 'white',
          borderRadius: '12px',
          padding: '28px 32px',
          maxWidth: '820px',
          boxShadow: 'var(--shadow)',
          lineHeight: 1.5,
        }}
      >
        <h2 style={{ marginBottom: '2px' }}>Statusrapport — matematik</h2>
        <div style={{ color: 'var(--ink-soft)', marginBottom: '18px' }}>
          {p.name} · udarbejdet {dateFmt(new Date().toISOString())}
          {trials.length > 0 && (
            <>
              {' '}
              · periode {dateFmt(trials[0].ts)} – {dateFmt(trials[trials.length - 1].ts)}
            </>
          )}
          {' '}· {points.length} {points.length === 1 ? 'session' : 'sessioner'}, {firstTries.length}{' '}
          selvstændige opgaveforsøg
        </div>

        <h3 style={{ margin: '14px 0 6px' }}>Mestrede færdigheder</h3>
        {domains.map((d) => {
          const list = mastered(d)
          if (list.length === 0) return null
          return (
            <div key={d} style={{ marginBottom: '4px' }}>
              <strong>{DOMAIN_DA[d]}:</strong> {list.map((s) => s.titleDa).join('; ')}
            </div>
          )
        })}
        {domains.every((d) => mastered(d).length === 0) && (
          <div style={{ color: 'var(--ink-soft)' }}>Ingen endnu — forløbet er lige begyndt.</div>
        )}

        <h3 style={{ margin: '16px 0 6px' }}>Arbejdes med nu</h3>
        {domains.map((d) => {
          const list = practicing(d)
          if (list.length === 0) return null
          return (
            <div key={d} style={{ marginBottom: '4px' }}>
              <strong>{DOMAIN_DA[d]}:</strong> {list.map((s) => s.titleDa).join('; ')}
            </div>
          )
        })}

        <h3 style={{ margin: '16px 0 6px' }}>Nøgletal</h3>
        <table style={{ borderCollapse: 'collapse', width: '100%', maxWidth: '480px' }}>
          <tbody>
            <tr>
              <td style={{ padding: '3px 0' }}>Rigtige i første, selvstændige forsøg (alle områder)</td>
              <td style={{ fontWeight: 700, textAlign: 'right' }}>{pct(clean, firstTries.length)}</td>
            </tr>
            {byDomainStats
              .filter((s) => s.total > 0)
              .map((s) => (
                <tr key={s.domain}>
                  <td style={{ padding: '3px 0 3px 16px', color: 'var(--ink-soft)' }}>{DOMAIN_DA[s.domain]}</td>
                  <td style={{ textAlign: 'right', color: 'var(--ink-soft)' }}>{pct(s.clean, s.total)}</td>
                </tr>
              ))}
            {medianMs !== null && (
              <tr>
                <td style={{ padding: '3px 0' }}>Typisk svartid ved rigtige svar</td>
                <td style={{ fontWeight: 700, textAlign: 'right' }}>{(medianMs / 1000).toFixed(1)} s</td>
              </tr>
            )}
          </tbody>
        </table>

        <h3 style={{ margin: '16px 0 6px' }}>Metode</h3>
        <p style={{ fontSize: '0.92rem', color: 'var(--ink-soft)' }}>
          Data stammer fra spillet »Byg &amp; Tæl«, en adaptiv matematik-app hvor alle opgaver
          stilles med tale og billeder — ingen læsning kræves. Tallene bygger udelukkende på
          barnets første, selvstændige forsøg; forsøg med hjælp eller demonstration tælles ikke
          med. En færdighed regnes som mestret ved mindst 85&nbsp;% rigtige selvstændige svar
          over de seneste 8 forsøg, eller ved to sikre svar under den indledende, skjulte
          niveauafdækning. Appen vælger løbende opgaver ved barnets aktuelle udviklingszone
          (ca. 80&nbsp;% opnåelige, 20&nbsp;% repetition).
        </p>
      </div>
    </div>
  )
}
