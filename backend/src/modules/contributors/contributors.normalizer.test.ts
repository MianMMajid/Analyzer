import { describe, expect, it } from 'vitest'
import { normalizeContributorIdentity, parseCoAuthorTrailers } from './contributors.normalizer.js'
import type { KnownContributor } from './contributors.types.js'

const knownContributors: readonly KnownContributor[] = [
  {
    id: 'engineer:raul',
    displayName: 'Raúl Negrón-Otero',
    aliases: [
      { canonicalId: 'engineer:raul', login: 'RaulNOG' },
      { canonicalId: 'engineer:raul', email: 'raul@example.com' },
      { canonicalId: 'engineer:raul', name: 'Raul Negron Otero' },
    ],
  },
  {
    id: 'engineer:sam',
    displayName: 'Sam Pennington',
    aliases: [{ canonicalId: 'engineer:sam', login: 'sam' }],
  },
]

describe('normalizeContributorIdentity', () => {
  it('excludes bot accounts from engineer attribution', () => {
    const identity = normalizeContributorIdentity({ login: 'dependabot[bot]', name: 'dependabot[bot]' })

    expect(identity.isBot).toBe(true)
    expect(identity.confidence).toBe('excluded')
    expect(identity.exclusionReason).toBe('bot')
  })

  it('infers GitHub login from noreply email addresses', () => {
    const identity = normalizeContributorIdentity({ email: '12345+SomeUser@users.noreply.github.com' })

    expect(identity.id).toBe('login:someuser')
    expect(identity.inferredLogin).toBe('someuser')
    expect(identity.confidence).toBe('medium')
  })

  it('parses co-author trailers without losing the inferred login', () => {
    const coAuthors = parseCoAuthorTrailers(['Co-authored-by: Jane Example <987+jane@users.noreply.github.com>'])

    expect(coAuthors).toEqual([
      {
        name: 'Jane Example',
        email: '987+jane@users.noreply.github.com',
        normalizedEmail: '987+jane@users.noreply.github.com',
        inferredLogin: 'jane',
      },
    ])
  })

  it('matches aliases by email and login to a canonical contributor', () => {
    const identity = normalizeContributorIdentity({ login: 'RAULNOG', email: 'raul@example.com' }, { knownContributors })

    expect(identity.id).toBe('engineer:raul')
    expect(identity.displayName).toBe('Raúl Negrón-Otero')
    expect(identity.confidence).toBe('exact')
  })

  it('normalizes diacritics and case for name-only matching', () => {
    const identity = normalizeContributorIdentity({ name: 'RAÚL   NEGRÓN OTERO' }, { knownContributors })

    expect(identity.id).toBe('engineer:raul')
    expect(identity.normalizedName).toBe('raul negron otero')
    expect(identity.confidence).toBe('medium')
  })

  it('marks conflicting aliases as ambiguous rather than selecting the wrong engineer', () => {
    const identity = normalizeContributorIdentity(
      { login: 'sam', email: 'raul@example.com' },
      {
        knownContributors,
      },
    )

    expect(identity.confidence).toBe('ambiguous')
    expect(identity.exclusionReason).toBe('ambiguous_identity')
  })
})
