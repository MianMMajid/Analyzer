type StatusTone = 'accent' | 'good' | 'warn'

// StatusCard is the single compact metric primitive used across the dashboard.
type StatusCardProps = {
  title: string
  value: string
  description: string
  tone?: StatusTone
}

export function StatusCard({
  description,
  title,
  tone = 'accent',
  value,
}: StatusCardProps) {
  return (
    <article className="status-card glass-panel" data-tone={tone}>
      <p className="status-card__value">{value}</p>
      <h2>{title}</h2>
      <p>{description}</p>
    </article>
  )
}
