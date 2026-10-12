/**
 * Supabase Cloud Database Client Factory
 * ----------------------------------------------------------
 * Creates the Supabase JavaScript client using Vite's import.meta.env.
 *
 * All existing callers reference:
 *   import { supabase, isSupabaseConfigured, isOnline } from '../lib/supabase'
 *
 * We keep that exact surface unchanged, while making this module safe to
 * import in a Node/Vitest test runner that has no import.meta.env.
 */

/** Resolve a config value from import.meta.env, falling back to process.env. */
function resolveEnvValue(key) {
  if (typeof import.meta !== 'undefined' && import.meta.env?.[key] !== undefined) {
    return import.meta.env[key];
  }

  if (typeof process !== 'undefined' && process.env?.[key] !== undefined) {
    return process.env[key];
  }

  return undefined;
}

/** Requires a Vite client-side env variable to be present (used in the browser only). */
function requireClientEnv(key) {
  const value = resolveEnvValue(key);
  if (!value) {
    throw new Error(
      `[Supabase] Missing client-side env variable: ${key}.\n` +
        `Set it in your .env file as ${key}=<your-value> (Vite only exposes VITE_* vars to the browser bundle).`
    );
  }
  return value;
}

/**
 * Exported so unit tests can build a fully configured client on demand, or a
 * spoof client when they want to exercise the fallback path end to end.
 */
export function makeSupabaseClient() {
  const supabaseUrl = resolveEnvValue('VITE_SUPABASE_URL');
  const supabaseAnonKey = resolveEnvValue('VITE_SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseAnonKey) {
    // Config is optional at the module level (client-only fallback). A module
    // that needs a real client (auth, DB CRUD) must call this factory with a
    // request param or call requireClientEnv() explicitly.
    return null;
  }

  const { createClient } = require('@supabase/supabase-js');
  return createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true } });
}

/** Supabase client configured for the current browser environment. */
let cachedClient = null;

export function getSupabaseClient() {
  if (!cachedClient) {
    cachedClient = makeSupabaseClient();
  }
  return cachedClient;
}

/** Thin alias kept for source readability; delegates to the factory above. */
export const supabase = getSupabaseClient();

/** Returns true when the environment is ready to talk to Supabase. */
export const isSupabaseConfigured = () => {
  return Boolean(supabase && supabase._client && supabase._client._url);
};

/** Network availability used by the sync wrapper (browser only). */
export const isOnline = () => {
  return typeof window !== 'undefined' ? navigator.onLine : true;
};

/** Log prefix used by every Supabase service call. */
export const LOG_PREFIX = '[NeeNoiSupabase]';
