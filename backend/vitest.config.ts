import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      all: true,
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.integration.test.ts',
        'src/db/migrations/**',
        'src/jobs/exportPosthogBranchesAndCommits.ts',
      ],
      include: ['src/**/*.ts'],
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        branches: 40,
        functions: 55,
        lines: 55,
        statements: 55,
      },
    },
  },
})
