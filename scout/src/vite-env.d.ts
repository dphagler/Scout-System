/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_EVENT_KEY: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
