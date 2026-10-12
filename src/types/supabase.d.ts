/// <reference types="vite/client" />

/**
 * TypeScript ambient declarations for Supabase client configuration.
 *
 * The app reads these from Vite's import.meta.env:
 *   - VITE_SUPABASE_URL
 *   - VITE_SUPABASE_ANON_KEY
 *
 * Vite only exposes env variables prefixed with VITE_ to the client bundle,
 * so Vite's generated vite/client.d.ts already declares them as strings.
 * This file makes that typing first-class for TypeScript projects that import
 * this file directly, and documents the values for future editors.
 */

interface SupabaseEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}

// Vite's import.meta.env is defined in vite/client.d.ts, but the reference is
// global to every module in the project, so this augmentation is additive only
// and does not overwrite the generated types.
declare module 'vite/client' {
  interface ImportMetaEnv extends SupabaseEnv {}
}
