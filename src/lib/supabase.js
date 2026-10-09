import { createClient } from '@supabase/supabase-js';

// Read Supabase credentials safely from Vite import.meta.env or process.env
const supabaseUrl =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_URL) ||
  (typeof process !== 'undefined' && process.env && process.env.VITE_SUPABASE_URL) ||
  '';

const supabaseAnonKey =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) ||
  (typeof process !== 'undefined' && process.env && process.env.VITE_SUPABASE_ANON_KEY) ||
  '';

/**
 * Check if valid Supabase configuration is present.
 */
export const isSupabaseConfigured = () => {
  return Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl.startsWith('https://') &&
    supabaseUrl !== 'https://your-project.supabase.co'
  );
};

// Singleton Supabase Client instance (with fallback handling)
export const supabase = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : null;

/**
 * Domain used to derive the Supabase Auth e-mail address from the username.
 * Supabase Auth requires a valid e-mail, so the username is stored as
 * `<username>@<VITE_AUTH_EMAIL_DOMAIN>`. Configure a domain you control
 * (see SUPABASE_SETUP.md) — `neenoi.com` is the project default.
 */
export const AUTH_EMAIL_DOMAIN = (
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_AUTH_EMAIL_DOMAIN) ||
  (typeof process !== 'undefined' && process.env && process.env.VITE_AUTH_EMAIL_DOMAIN) ||
  'neenoi.com'
).trim().replace(/^@/, '').toLowerCase();

/** somchai -> somchai@<AUTH_EMAIL_DOMAIN> (Supabase Auth login identifier). */
export const buildAuthEmail = (username) =>
  `${String(username || '').trim().toLowerCase()}@${AUTH_EMAIL_DOMAIN}`;

/**
 * True for a production build (`vite build` / Vercel). Under a production build
 * a missing Supabase configuration must be reported instead of silently
 * falling back to browser-local accounts that never sync between devices.
 */
export const isProductionBuild = () => Boolean(import.meta.env && import.meta.env.PROD);

/**
 * Helper to check online network status gracefully
 */
export const isOnline = () => {
  return typeof window !== 'undefined' ? navigator.onLine : true;
};
