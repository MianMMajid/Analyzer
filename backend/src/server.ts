import { buildServer } from './app.js'
import { backendEnvironment } from './config/env.js'

const server = await buildServer(backendEnvironment)

// Railway provides PORT, and 0.0.0.0 is required for container networking.
await server.listen({
  host: '0.0.0.0',
  port: backendEnvironment.port,
})
