/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base origin for the BCCC API; empty = same-origin. */
  readonly VITE_BCCC_API?: string;
}
