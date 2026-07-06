import type {
  ContributorAlias,
  ContributorIdentityInput,
  ContributorNormalizerOptions,
  NormalizedCoAuthor,
  NormalizedContributorIdentity,
} from './contributors.types.js'

const botLoginPatterns = [/bot$/u, /\[bot\]$/u, /^dependabot/u, /^renovate/u, /^github-actions/u]
const githubNoreplyEmailPattern = /^(?:(?<id>\d+)\+)?(?<login>[^@]+)@users\.noreply\.github\.com$/u
const coAuthorTrailerPattern = /^Co-authored-by:\s*(?<name>.+?)\s*<(?<email>[^>]+)>$/iu

type AliasIndex = ReadonlyMap<string, readonly string[]>

type AliasIndexes = {
  readonly byLogin: AliasIndex
  readonly byEmail: AliasIndex
  readonly byName: AliasIndex
  readonly displayNames: ReadonlyMap<string, string>
}

type ContributorSignals = {
  readonly normalizedLogin: string | undefined
  readonly normalizedEmail: string | undefined
  readonly normalizedName: string | undefined
  readonly inferredLogin: string | undefined
}

export function normalizeContributorIdentity(
  input: ContributorIdentityInput,
  options: ContributorNormalizerOptions = {},
): NormalizedContributorIdentity {
  const normalizedLogin = normalizeLogin(input.login)
  const normalizedEmail = normalizeEmail(input.email)
  const normalizedName = normalizeName(input.name)
  const inferredLogin = inferLoginFromEmail(normalizedEmail)
  const coAuthors = parseCoAuthorTrailers(input.coAuthorTrailers ?? [])
  const signals = { normalizedLogin, normalizedEmail, normalizedName, inferredLogin } satisfies ContributorSignals
  const matchedBy = collectMatchedSignals(signals)

  if (isBotIdentity(signals)) {
    return compactIdentity({
      id: `bot:${normalizedLogin ?? inferredLogin ?? normalizedEmail ?? normalizedName ?? 'unknown'}`,
      displayName: input.name?.trim() || normalizedLogin || inferredLogin || 'Bot',
      confidence: 'excluded',
      isBot: true,
      exclusionReason: 'bot',
      matchedBy,
      normalizedLogin,
      normalizedEmail,
      normalizedName,
      inferredLogin,
      coAuthors,
    })
  }

  const indexes = buildAliasIndexes(options)
  const candidateIds = findCandidateContributorIds(indexes, signals)

  if (candidateIds.length > 1) {
    return compactIdentity({
      id: `ambiguous:${normalizedLogin ?? normalizedEmail ?? normalizedName ?? 'unknown'}`,
      displayName: input.name?.trim() || normalizedLogin || inferredLogin || normalizedEmail || 'Unknown contributor',
      confidence: 'ambiguous',
      isBot: false,
      exclusionReason: 'ambiguous_identity',
      matchedBy,
      normalizedLogin,
      normalizedEmail,
      normalizedName,
      inferredLogin,
      coAuthors,
    })
  }

  const canonicalId = candidateIds[0]
  if (canonicalId !== undefined) {
    return compactIdentity({
      id: canonicalId,
      displayName:
        indexes.displayNames.get(canonicalId) ?? input.name?.trim() ?? normalizedLogin ?? inferredLogin ?? canonicalId,
      confidence: resolveAliasConfidence(indexes, canonicalId, signals),
      isBot: false,
      matchedBy,
      normalizedLogin,
      normalizedEmail,
      normalizedName,
      inferredLogin,
      coAuthors,
    })
  }

  if (normalizedLogin !== undefined || inferredLogin !== undefined) {
    const login = normalizedLogin ?? inferredLogin ?? 'unknown'

    return compactIdentity({
      id: `login:${login}`,
      displayName: input.name?.trim() || login,
      confidence: normalizedLogin !== undefined ? 'high' : 'medium',
      isBot: false,
      matchedBy,
      normalizedLogin,
      normalizedEmail,
      normalizedName,
      inferredLogin,
      coAuthors,
    })
  }

  if (normalizedEmail !== undefined) {
    return compactIdentity({
      id: `email:${normalizedEmail}`,
      displayName: input.name?.trim() || normalizedEmail,
      confidence: 'medium',
      isBot: false,
      matchedBy,
      normalizedEmail,
      normalizedName,
      coAuthors,
    })
  }

  if (normalizedName !== undefined) {
    return compactIdentity({
      id: `name:${normalizedName.replaceAll(' ', '-')}`,
      displayName: input.name?.trim() ?? normalizedName,
      confidence: 'low',
      isBot: false,
      matchedBy,
      normalizedName,
      coAuthors,
    })
  }

  return {
    id: 'invalid:unknown',
    displayName: 'Unknown contributor',
    confidence: 'excluded',
    isBot: false,
    exclusionReason: 'invalid_identity',
    matchedBy: [],
    coAuthors,
  }
}

export function parseCoAuthorTrailers(trailers: readonly string[]): readonly NormalizedCoAuthor[] {
  return trailers.flatMap((trailer) => {
    const match = coAuthorTrailerPattern.exec(trailer.trim())
    const name = match?.groups?.['name']?.trim()
    const email = match?.groups?.['email']?.trim()
    const normalizedEmail = normalizeEmail(email)

    if (name === undefined || email === undefined || normalizedEmail === undefined) {
      return []
    }

    return [
      compactCoAuthor({
        name,
        email,
        normalizedEmail,
        ...compactOptional('inferredLogin', inferLoginFromEmail(normalizedEmail)),
      }),
    ]
  })
}

export function normalizeLogin(login: string | null | undefined): string | undefined {
  const value = login?.trim().toLowerCase()
  return value === undefined || value.length === 0 ? undefined : value
}

export function normalizeEmail(email: string | null | undefined): string | undefined {
  const value = email?.trim().toLowerCase()
  return value === undefined || value.length === 0 ? undefined : value
}

export function normalizeName(name: string | null | undefined): string | undefined {
  const value = name
    ?.normalize('NFKD')
    .replaceAll(/\p{Diacritic}/gu, '')
    .trim()
    .replaceAll(/\s+/gu, ' ')
    .toLowerCase()

  return value === undefined || value.length === 0 ? undefined : value
}

function inferLoginFromEmail(email: string | undefined): string | undefined {
  if (email === undefined) {
    return undefined
  }

  const match = githubNoreplyEmailPattern.exec(email)
  return normalizeLogin(match?.groups?.['login'])
}

function buildAliasIndexes(options: ContributorNormalizerOptions): AliasIndexes {
  const aliases = [
    ...(options.aliases ?? []),
    ...(options.knownContributors ?? []).flatMap((contributor) =>
      contributor.aliases.map((alias) => ({
        ...alias,
        canonicalId: contributor.id,
      })),
    ),
  ]
  const displayNames = new Map(
    (options.knownContributors ?? []).map((contributor) => [contributor.id, contributor.displayName]),
  )

  return {
    byLogin: buildAliasIndex(aliases, 'login', normalizeLogin),
    byEmail: buildAliasIndex(aliases, 'email', normalizeEmail),
    byName: buildAliasIndex(aliases, 'name', normalizeName),
    displayNames,
  }
}

function buildAliasIndex(
  aliases: readonly ContributorAlias[],
  field: 'login' | 'email' | 'name',
  normalize: (value: string | null | undefined) => string | undefined,
): AliasIndex {
  const index = new Map<string, string[]>()

  for (const alias of aliases) {
    const normalizedValue = normalize(alias[field])
    if (normalizedValue === undefined) {
      continue
    }

    const existing = index.get(normalizedValue) ?? []
    index.set(normalizedValue, [...existing, alias.canonicalId])
  }

  return index
}

function findCandidateContributorIds(indexes: AliasIndexes, identity: ContributorSignals): readonly string[] {
  const candidates = new Set<string>()
  const signals = [
    [indexes.byLogin, identity.normalizedLogin],
    [indexes.byLogin, identity.inferredLogin],
    [indexes.byEmail, identity.normalizedEmail],
    [indexes.byName, identity.normalizedName],
  ] as const

  for (const [index, value] of signals) {
    for (const candidate of index.get(value ?? '') ?? []) {
      candidates.add(candidate)
    }
  }

  return [...candidates].sort()
}

function resolveAliasConfidence(
  indexes: AliasIndexes,
  canonicalId: string,
  identity: ContributorSignals,
): 'exact' | 'high' | 'medium' {
  if (
    hasCandidate(indexes.byLogin, identity.normalizedLogin, canonicalId) ||
    hasCandidate(indexes.byEmail, identity.normalizedEmail, canonicalId)
  ) {
    return 'exact'
  }

  if (hasCandidate(indexes.byLogin, identity.inferredLogin, canonicalId)) {
    return 'high'
  }

  return 'medium'
}

function hasCandidate(index: AliasIndex, value: string | undefined, canonicalId: string): boolean {
  return (index.get(value ?? '') ?? []).includes(canonicalId)
}

function collectMatchedSignals(identity: ContributorSignals): readonly string[] {
  return [
    identity.normalizedLogin === undefined ? undefined : 'login',
    identity.normalizedEmail === undefined ? undefined : 'email',
    identity.normalizedName === undefined ? undefined : 'name',
    identity.inferredLogin === undefined ? undefined : 'github_noreply_login',
  ].filter((value): value is string => value !== undefined)
}

function isBotIdentity(identity: ContributorSignals): boolean {
  const values = [
    identity.normalizedLogin,
    identity.normalizedEmail,
    identity.normalizedName,
    identity.inferredLogin,
  ].filter((value): value is string => value !== undefined)

  return values.some((value) => botLoginPatterns.some((pattern) => pattern.test(value)))
}

function compactIdentity(identity: {
  readonly id: string
  readonly displayName: string
  readonly confidence: NormalizedContributorIdentity['confidence']
  readonly isBot: boolean
  readonly matchedBy: readonly string[]
  readonly normalizedName?: string | undefined
  readonly normalizedLogin?: string | undefined
  readonly normalizedEmail?: string | undefined
  readonly inferredLogin?: string | undefined
  readonly exclusionReason?: NormalizedContributorIdentity['exclusionReason'] | undefined
  readonly coAuthors: readonly NormalizedCoAuthor[]
}): NormalizedContributorIdentity {
  return {
    id: identity.id,
    displayName: identity.displayName,
    confidence: identity.confidence,
    isBot: identity.isBot,
    matchedBy: identity.matchedBy,
    ...(identity.normalizedName === undefined ? {} : { normalizedName: identity.normalizedName }),
    ...(identity.normalizedLogin === undefined ? {} : { normalizedLogin: identity.normalizedLogin }),
    ...(identity.normalizedEmail === undefined ? {} : { normalizedEmail: identity.normalizedEmail }),
    ...(identity.inferredLogin === undefined ? {} : { inferredLogin: identity.inferredLogin }),
    ...(identity.exclusionReason === undefined ? {} : { exclusionReason: identity.exclusionReason }),
    coAuthors: identity.coAuthors,
  }
}

function compactCoAuthor(coAuthor: {
  readonly name: string
  readonly email: string
  readonly normalizedEmail: string
  readonly inferredLogin?: string | undefined
}): NormalizedCoAuthor {
  return {
    name: coAuthor.name,
    email: coAuthor.email,
    normalizedEmail: coAuthor.normalizedEmail,
    ...(coAuthor.inferredLogin === undefined ? {} : { inferredLogin: coAuthor.inferredLogin }),
  }
}

function compactOptional<Key extends string, Value>(
  key: Key,
  value: Value | undefined,
): Record<Key, Value> | Record<string, never> {
  return value === undefined ? {} : ({ [key]: value } as Record<Key, Value>)
}
