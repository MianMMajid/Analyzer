type AppEnvironment = {
  appName: string
  apiBaseUrl: string
  mode: ImportMetaEnv['MODE']
  isProduction: boolean
}

// Vite exposes only VITE_* values to the browser, keeping secrets server-side.
const defaultAppName = 'PostHog Impact Dashboard'

export const appEnvironment = {
  appName: import.meta.env['VITE_APP_NAME']?.trim() || defaultAppName,
  apiBaseUrl: import.meta.env['VITE_API_BASE_URL']?.trim() || 'http://localhost:4000',
  mode: import.meta.env.MODE,
  isProduction: import.meta.env.PROD,
} satisfies AppEnvironment
