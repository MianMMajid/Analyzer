import { createWriteStream, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn, spawnSync } from 'node:child_process'

type BranchRecord = {
  name: string
  headSha: string
  headCommittedAt: string
  isActiveInWindow: boolean
}

type CommitRecord = {
  hash: string
  parents: readonly string[]
  authorDate: string
  authorName: string
  authorEmail: string
  committerDate: string
  committerName: string
  committerEmail: string
  subject: string
  normalizedAuthorId: string
  authorIdentityConfidence: 'high' | 'medium' | 'low'
  coAuthors: readonly string[]
  categories: readonly CommitCategory[]
  isMainlineAccepted: boolean
  isBranchOnlyCandidate: boolean
  isMergeCommit: boolean
  isRevertCommit: boolean
  isBotAuthored: boolean
  isMechanicalOrGenerated: boolean
}

type CommitCategory =
  | 'mainline_accepted'
  | 'branch_only_candidate'
  | 'merge_commit'
  | 'revert_commit'
  | 'cherry_pick_candidate'
  | 'bot_or_generated'
  | 'unresolved_identity'

type ExportManifest = {
  repository: string
  since: string
  until: string
  branchCount: number
  activeBranchCount: number
  remoteBranchCountBefore: number
  remoteBranchCountAfter: number
  branchCountsStable: boolean
  expectedCommitCount: number
  exportedCommitCount: number
  mainlineCommitCount: number
  branchOnlyCommitCount: number
  mergeCommitCount: number
  revertCommitCount: number
  botCommitCount: number
  mechanicalOrGeneratedCommitCount: number
  unresolvedIdentityCommitCount: number
  uniqueCommitCount: number
  duplicateCommitCount: number
  branchesFile: string
  activeBranchesFile: string
  commitsFile: string
  manifestFile: string
  completedAt: string
  status: 'complete'
}

const repositoryUrl = 'https://github.com/PostHog/posthog.git'
const repositoryName = 'PostHog/posthog'
const mainBranch = process.env['POSTHOG_MAIN_BRANCH'] ?? 'master'
const since = process.env['EXPORT_SINCE'] ?? '2026-04-07T00:00:00Z'
const until = process.env['EXPORT_UNTIL'] ?? '2026-07-06T23:59:59Z'
const workspaceRoot = fileURLToPath(new URL('../../../', import.meta.url))
const gitDir = process.env['POSTHOG_BRANCH_GIT_DIR'] ?? join(workspaceRoot, '.data/posthog-branches.git')
const outputDirectory = process.env['POSTHOG_EXPORT_DIR'] ?? join(workspaceRoot, '.data/posthog-90d')
const branchesFile = join(outputDirectory, 'branches.ndjson')
const activeBranchesFile = join(outputDirectory, 'active-branches.ndjson')
const commitsFile = join(outputDirectory, 'commits.ndjson')
const manifestFile = join(outputDirectory, 'manifest.json')

const botPattern = /\[bot\]|bot@|dependabot|posthog-js-upgrader|scheduled-actions|mendral|tests-posthog/i
const mechanicalPattern =
  /chore\(deps\)|\bdeps\b|bump|snapshot|snapshots|format|lint|rename|regenerate|generated|lockfile|package-lock|pnpm-lock/i
const revertPattern = /^revert\b|this reverts commit/i
const cherryPickPattern = /cherry[ -]pick|backport/i
const noreplyLoginPattern = /^\d+\+([^@]+)@users\.noreply\.github\.com$/i

function runGit(args: readonly string[]): string {
  const result = spawnSync('git', args, {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 256,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`)
  }

  return result.stdout.trim()
}

function ensureBranchRepository(): void {
  mkdirSync(dirname(gitDir), { recursive: true })

  if (!existsSync(gitDir)) {
    runGit(['init', '--bare', gitDir])
    runGit(['--git-dir', gitDir, 'remote', 'add', 'origin', repositoryUrl])
  }

  fetchBranchRefs()
}

function fetchBranchRefs(): void {
  // Fetch every branch ref but no blobs. Branch/commit analysis does not need file contents.
  runGit(['--git-dir', gitDir, 'fetch', '--prune', '--filter=blob:none', 'origin', '+refs/heads/*:refs/heads/*'])
}

function countRemoteBranches(): number {
  return runGit(['ls-remote', '--heads', repositoryUrl]).split('\n').filter(Boolean).length
}

function parseBranch(line: string): BranchRecord {
  const [name, headSha, headCommittedAt] = line.split('\u001f')

  if (name === undefined || headSha === undefined || headCommittedAt === undefined) {
    throw new Error(`Malformed branch record: ${line}`)
  }

  return {
    name,
    headSha,
    headCommittedAt,
    isActiveInWindow:
      new Date(headCommittedAt).getTime() >= new Date(since).getTime() &&
      new Date(headCommittedAt).getTime() <= new Date(until).getTime(),
  }
}

function exportBranches(): { branchCount: number; activeBranchCount: number } {
  rmSync(branchesFile, { force: true })
  rmSync(activeBranchesFile, { force: true })

  const branchOutput = createWriteStream(branchesFile, { encoding: 'utf8' })
  const activeBranchOutput = createWriteStream(activeBranchesFile, { encoding: 'utf8' })
  const lines = runGit([
    '--git-dir',
    gitDir,
    'for-each-ref',
    '--format=%(refname:short)%1f%(objectname)%1f%(committerdate:iso-strict)',
    'refs/heads',
  ])
    .split('\n')
    .filter(Boolean)

  let activeBranchCount = 0

  for (const line of lines) {
    const record = parseBranch(line)
    const serialized = `${JSON.stringify(record)}\n`

    branchOutput.write(serialized)

    if (record.isActiveInWindow) {
      activeBranchOutput.write(serialized)
      activeBranchCount += 1
    }
  }

  branchOutput.end()
  activeBranchOutput.end()

  return {
    branchCount: lines.length,
    activeBranchCount,
  }
}

function normalizeIdentity(
  name: string,
  email: string,
): {
  normalizedAuthorId: string
  authorIdentityConfidence: CommitRecord['authorIdentityConfidence']
} {
  const normalizedEmail = email.toLowerCase()
  const noreplyMatch = normalizedEmail.match(noreplyLoginPattern)

  if (noreplyMatch?.[1] !== undefined) {
    return {
      normalizedAuthorId: `github:${noreplyMatch[1].toLowerCase()}`,
      authorIdentityConfidence: 'high',
    }
  }

  if (normalizedEmail.endsWith('@posthog.com')) {
    return {
      normalizedAuthorId: `email:${normalizedEmail}`,
      authorIdentityConfidence: 'high',
    }
  }

  if (normalizedEmail.includes('@')) {
    return {
      normalizedAuthorId: `email:${normalizedEmail}`,
      authorIdentityConfidence: 'medium',
    }
  }

  return {
    normalizedAuthorId: `name:${name.toLowerCase().trim().replaceAll(/\s+/g, '-')}`,
    authorIdentityConfidence: 'low',
  }
}

function buildCategories(input: {
  isMainlineAccepted: boolean
  isBranchOnlyCandidate: boolean
  isMergeCommit: boolean
  isRevertCommit: boolean
  isBotAuthored: boolean
  isMechanicalOrGenerated: boolean
  isCherryPickCandidate: boolean
  isUnresolvedIdentity: boolean
}): readonly CommitCategory[] {
  const categories: CommitCategory[] = []

  if (input.isMainlineAccepted) {
    categories.push('mainline_accepted')
  }

  if (input.isBranchOnlyCandidate) {
    categories.push('branch_only_candidate')
  }

  if (input.isMergeCommit) {
    categories.push('merge_commit')
  }

  if (input.isRevertCommit) {
    categories.push('revert_commit')
  }

  if (input.isCherryPickCandidate) {
    categories.push('cherry_pick_candidate')
  }

  if (input.isBotAuthored || input.isMechanicalOrGenerated) {
    categories.push('bot_or_generated')
  }

  if (input.isUnresolvedIdentity) {
    categories.push('unresolved_identity')
  }

  return categories
}

function parseCommitBlock(block: string, mainlineCommitHashes: ReadonlySet<string>): CommitRecord | null {
  const trimmed = block.trim()

  if (trimmed.length === 0) {
    return null
  }

  const [
    hash,
    parents,
    authorDate,
    authorName,
    authorEmail,
    committerDate,
    committerName,
    committerEmail,
    subject,
    coAuthors,
  ] = trimmed.split('\u001f')

  if (
    hash === undefined ||
    parents === undefined ||
    authorDate === undefined ||
    authorName === undefined ||
    authorEmail === undefined ||
    committerDate === undefined ||
    committerName === undefined ||
    committerEmail === undefined ||
    subject === undefined ||
    coAuthors === undefined
  ) {
    throw new Error(`Malformed commit record: ${trimmed}`)
  }

  const parentHashes = parents.length > 0 ? parents.split(' ') : []
  const identity = normalizeIdentity(authorName, authorEmail)
  const isMainlineAccepted = mainlineCommitHashes.has(hash)
  const isMergeCommit = parentHashes.length > 1
  const isRevertCommit = revertPattern.test(subject)
  const isBotAuthored = botPattern.test(`${authorName} <${authorEmail}>`)
  const isMechanicalOrGenerated = mechanicalPattern.test(subject)
  const isCherryPickCandidate = cherryPickPattern.test(subject)
  const isUnresolvedIdentity = identity.authorIdentityConfidence === 'low'
  const isBranchOnlyCandidate = !isMainlineAccepted

  return {
    hash,
    parents: parentHashes,
    authorDate,
    authorName,
    authorEmail,
    committerDate,
    committerName,
    committerEmail,
    subject,
    normalizedAuthorId: identity.normalizedAuthorId,
    authorIdentityConfidence: identity.authorIdentityConfidence,
    coAuthors: coAuthors.length > 0 ? coAuthors.split('\u001d').filter(Boolean) : [],
    categories: buildCategories({
      isMainlineAccepted,
      isBranchOnlyCandidate,
      isMergeCommit,
      isRevertCommit,
      isBotAuthored,
      isMechanicalOrGenerated,
      isCherryPickCandidate,
      isUnresolvedIdentity,
    }),
    isMainlineAccepted,
    isBranchOnlyCandidate,
    isMergeCommit,
    isRevertCommit,
    isBotAuthored,
    isMechanicalOrGenerated,
  }
}

function getCommitSet(args: readonly string[]): Set<string> {
  const output = runGit(args)

  if (output.length === 0) {
    return new Set()
  }

  return new Set(output.split('\n').filter(Boolean))
}

async function exportCommits(
  expectedCommitCount: number,
  mainlineCommitHashes: ReadonlySet<string>,
): Promise<{
  exportedCommitCount: number
  branchOnlyCommitCount: number
  botCommitCount: number
  duplicateCommitCount: number
  mechanicalOrGeneratedCommitCount: number
  mergeCommitCount: number
  revertCommitCount: number
  uniqueCommitCount: number
  unresolvedIdentityCommitCount: number
}> {
  rmSync(commitsFile, { force: true })

  const output = createWriteStream(commitsFile, { encoding: 'utf8' })
  const gitLog = spawn('git', [
    '--git-dir',
    gitDir,
    'log',
    '--all',
    `--since=${since}`,
    `--until=${until}`,
    '--date=iso-strict',
    '--pretty=format:%x1e%H%x1f%P%x1f%aI%x1f%an%x1f%ae%x1f%cI%x1f%cn%x1f%ce%x1f%s%x1f%(trailers:key=Co-authored-by,valueonly,separator=%x1d)',
  ])

  let buffer = ''
  let exportedCommitCount = 0
  let branchOnlyCommitCount = 0
  let botCommitCount = 0
  let mechanicalOrGeneratedCommitCount = 0
  let mergeCommitCount = 0
  let revertCommitCount = 0
  let unresolvedIdentityCommitCount = 0
  const stderrChunks: string[] = []
  const seenHashes = new Set<string>()

  gitLog.stdout.setEncoding('utf8')
  gitLog.stdout.on('data', (chunk: string) => {
    buffer += chunk
    const blocks = buffer.split('\u001e')
    buffer = blocks.pop() ?? ''

    for (const block of blocks) {
      const record = parseCommitBlock(block, mainlineCommitHashes)

      if (record !== null) {
        if (seenHashes.has(record.hash)) {
          continue
        }

        seenHashes.add(record.hash)
        output.write(`${JSON.stringify(record)}\n`)
        exportedCommitCount += 1
        branchOnlyCommitCount += record.isBranchOnlyCandidate ? 1 : 0
        botCommitCount += record.isBotAuthored ? 1 : 0
        mechanicalOrGeneratedCommitCount += record.isMechanicalOrGenerated ? 1 : 0
        mergeCommitCount += record.isMergeCommit ? 1 : 0
        revertCommitCount += record.isRevertCommit ? 1 : 0
        unresolvedIdentityCommitCount += record.authorIdentityConfidence === 'low' ? 1 : 0
      }
    }
  })

  gitLog.stderr.setEncoding('utf8')
  gitLog.stderr.on('data', (chunk: string) => {
    stderrChunks.push(chunk)
  })

  const exitCode = await new Promise<number | null>((resolve) => {
    gitLog.on('close', resolve)
  })

  const finalRecord = parseCommitBlock(buffer, mainlineCommitHashes)

  if (finalRecord !== null && !seenHashes.has(finalRecord.hash)) {
    seenHashes.add(finalRecord.hash)
    output.write(`${JSON.stringify(finalRecord)}\n`)
    exportedCommitCount += 1
    branchOnlyCommitCount += finalRecord.isBranchOnlyCandidate ? 1 : 0
    botCommitCount += finalRecord.isBotAuthored ? 1 : 0
    mechanicalOrGeneratedCommitCount += finalRecord.isMechanicalOrGenerated ? 1 : 0
    mergeCommitCount += finalRecord.isMergeCommit ? 1 : 0
    revertCommitCount += finalRecord.isRevertCommit ? 1 : 0
    unresolvedIdentityCommitCount += finalRecord.authorIdentityConfidence === 'low' ? 1 : 0
  }

  output.end()

  if (exitCode !== 0) {
    throw new Error(`git log export failed: ${stderrChunks.join('')}`)
  }

  if (exportedCommitCount !== expectedCommitCount) {
    throw new Error(`Export count mismatch: expected ${expectedCommitCount}, exported ${exportedCommitCount}`)
  }

  return {
    exportedCommitCount,
    branchOnlyCommitCount,
    botCommitCount,
    duplicateCommitCount: expectedCommitCount - seenHashes.size,
    mechanicalOrGeneratedCommitCount,
    mergeCommitCount,
    revertCommitCount,
    uniqueCommitCount: seenHashes.size,
    unresolvedIdentityCommitCount,
  }
}

mkdirSync(outputDirectory, { recursive: true })
ensureBranchRepository()

const remoteBranchCountBefore = countRemoteBranches()
fetchBranchRefs()

const expectedCommitCount = Number(
  runGit(['--git-dir', gitDir, 'rev-list', '--count', '--all', `--since=${since}`, `--until=${until}`]),
)
const mainlineCommitHashes = getCommitSet([
  '--git-dir',
  gitDir,
  'rev-list',
  mainBranch,
  `--since=${since}`,
  `--until=${until}`,
])
const { activeBranchCount, branchCount } = exportBranches()
const remoteBranchCountAfter = countRemoteBranches()
const branchCountsStable = branchCount === remoteBranchCountAfter
const commitExport = await exportCommits(expectedCommitCount, mainlineCommitHashes)

if (!branchCountsStable) {
  throw new Error(
    `Branch count mismatch after fetch: remote=${remoteBranchCountAfter}, exported=${branchCount}. Rerun export to avoid missing moving branches.`,
  )
}

const manifest = {
  repository: repositoryName,
  since,
  until,
  branchCount,
  activeBranchCount,
  remoteBranchCountBefore,
  remoteBranchCountAfter,
  branchCountsStable,
  expectedCommitCount,
  exportedCommitCount: commitExport.exportedCommitCount,
  mainlineCommitCount: mainlineCommitHashes.size,
  branchOnlyCommitCount: commitExport.branchOnlyCommitCount,
  mergeCommitCount: commitExport.mergeCommitCount,
  revertCommitCount: commitExport.revertCommitCount,
  botCommitCount: commitExport.botCommitCount,
  mechanicalOrGeneratedCommitCount: commitExport.mechanicalOrGeneratedCommitCount,
  unresolvedIdentityCommitCount: commitExport.unresolvedIdentityCommitCount,
  uniqueCommitCount: commitExport.uniqueCommitCount,
  duplicateCommitCount: commitExport.duplicateCommitCount,
  branchesFile,
  activeBranchesFile,
  commitsFile,
  manifestFile,
  completedAt: new Date().toISOString(),
  status: 'complete',
} satisfies ExportManifest

writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`)

console.log(JSON.stringify(manifest, null, 2))
