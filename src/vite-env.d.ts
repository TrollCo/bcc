/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base origin for the BCCC API; empty = same-origin. */
  readonly VITE_BCCC_API?: string;
}

/** Build-time list of announcer VO files (see voManifest() in vite.config.ts). */
declare module 'virtual:vo-manifest' {
  const files: string[];
  export default files;
}
