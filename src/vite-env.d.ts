/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** where `?api` finds the backend (`/feed`, `/events`); `/api` (proxied to scripts/mock-api.mjs) when unset */
  readonly VITE_API_BASE?: string;
}
