export type ContributorIdentityConfidence = 'exact' | 'high' | 'medium' | 'low' | 'ambiguous' | 'excluded'

export type ContributorExclusionReason = 'bot' | 'invalid_identity' | 'ambiguous_identity'

export type ContributorAlias = {
  readonly canonicalId: string
  readonly login?: string
  readonly email?: string
  readonly name?: string
}

export type KnownContributor = {
  readonly id: string
  readonly displayName: string
  readonly aliases: readonly ContributorAlias[]
}

export type ContributorIdentityInput = {
  readonly login?: string | null
  readonly email?: string | null
  readonly name?: string | null
  readonly coAuthorTrailers?: readonly string[]
}

export type NormalizedCoAuthor = {
  readonly name: string
  readonly email: string
  readonly normalizedEmail: string
  readonly inferredLogin?: string
}

export type NormalizedContributorIdentity = {
  readonly id: string
  readonly displayName: string
  readonly confidence: ContributorIdentityConfidence
  readonly isBot: boolean
  readonly matchedBy: readonly string[]
  readonly normalizedName?: string
  readonly normalizedLogin?: string
  readonly normalizedEmail?: string
  readonly inferredLogin?: string
  readonly exclusionReason?: ContributorExclusionReason
  readonly coAuthors: readonly NormalizedCoAuthor[]
}

export type ContributorNormalizerOptions = {
  readonly knownContributors?: readonly KnownContributor[]
  readonly aliases?: readonly ContributorAlias[]
}
