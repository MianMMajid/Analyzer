import type { PropsWithChildren } from 'react'

// Section provides consistent page rhythm for feature-owned dashboard content.
type SectionProps = PropsWithChildren<{
  id: string
  title: string
  description: string
}>

export function Section({ children, description, id, title }: SectionProps) {
  return (
    <section className="content-section" id={id}>
      <div className="section-heading">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {children}
    </section>
  )
}
