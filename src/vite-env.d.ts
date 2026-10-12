/// <reference types="vite/client" />

/**
 * TypeScript ambient declaration for Vite's import.meta.env.
 *
 * We keep the minimal surface we actually read:
 *   - import.meta.env.VITE_SUPABASE_URL
 *   - import.meta.env.VITE_SUPABASE_ANON_KEY
 *
 * Everything else stays as Vite declares it. Strict mode only complains about
 * properties that are missing, which would otherwise require a blanket
 * `import.meta.env as Record<string, unknown>` cast.
 */

interface ViteEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

// `import.meta.env` is a frozen object in Vite; `Readonly<Record<string, string>>`
// matches that while still letting the specific declared keys be read as strings.
declare const importMetaEnv: Readonly<ViteEnv & Record<string, string>>;

declare module 'vite/client' {
  interface ImportMetaEnv extends ViteEnv {}
}
