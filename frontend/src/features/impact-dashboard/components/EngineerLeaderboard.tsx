import type { ImpactEngineer } from '@/features/impact-dashboard/types.ts'

type EngineerLeaderboardProps = {
  engineers: readonly ImpactEngineer[]
  selectedEngineerId: string
  onSelectEngineer: (engineerId: string) => void
}

// The leaderboard is interactive but delegates detailed evidence to the panel.
export function EngineerLeaderboard({
  engineers,
  onSelectEngineer,
  selectedEngineerId,
}: EngineerLeaderboardProps) {
  return (
    <div className="leaderboard-list" aria-label="Top five engineers">
      {engineers.map((engineer) => (
        <button
          className="leaderboard-row glass-panel"
          data-selected={engineer.id === selectedEngineerId}
          key={engineer.id}
          onClick={() => onSelectEngineer(engineer.id)}
          type="button"
        >
          <span className="leaderboard-row__rank">#{engineer.rank}</span>
          <span className="leaderboard-row__identity">
            <strong>{engineer.name}</strong>
            <small>{engineer.primaryImpactArea}</small>
          </span>
          <span className="leaderboard-row__score">
            <b>{engineer.totalScore}</b>
            <small>impact</small>
          </span>
        </button>
      ))}
    </div>
  )
}
