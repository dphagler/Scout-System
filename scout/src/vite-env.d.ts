/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_EVENT_KEY: string
  readonly VITE_SYNC_URL: string
  readonly VITE_API_KEY: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
