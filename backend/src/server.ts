import { buildServer } from './app.js'
import { backendEnvironment } from './config/env.js'
import { closeSharedDatabasePool } from './db/client.js'

const server = await buildServer(backendEnvironment)
let isShuttingDown = false

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (isShuttingDown) {
    return
  }

  isShuttingDown = true
  server.log.info({ signal }, 'shutdown signal received')

  try {
    await server.close()
    await closeSharedDatabasePool()
    process.exit(0)
  } catch (error) {
    server.log.error({ error, signal }, 'graceful shutdown failed')
    process.exit(1)
  }
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void shutdown(signal)
  })
}

// Railway provides PORT, and 0.0.0.0 is required for container networking.
await server.listen({
  host: '0.0.0.0',
  port: backendEnvironment.port,
})
