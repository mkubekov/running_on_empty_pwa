/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_VAPID_PUBLIC_KEY?: string
  /** Пусто = тот же origin. Нужен, только если воркер живёт на другом домене. */
  readonly VITE_API_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
