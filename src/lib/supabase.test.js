/** Configuration helpers used by the auth flow. */
import { describe, it, expect } from 'vitest';
import { AUTH_EMAIL_DOMAIN, buildAuthEmail, isProductionBuild, isSupabaseConfigured } from './supabase';

describe('supabase config helpers', () => {
  it('buildAuthEmail derives the Supabase Auth e-mail from the username', () => {
    expect(buildAuthEmail('  Somchai ')).toBe('somchai@neenoi.com');
    expect(buildAuthEmail('A@B.c')).toBe('a@b.c@' + AUTH_EMAIL_DOMAIN); // raw usernames are normalised to lowercase
  });

  it('AUTH_EMAIL_DOMAIN is a clean bare domain (no scheme, no @)', () => {
    expect(AUTH_EMAIL_DOMAIN).toBe(AUTH_EMAIL_DOMAIN.toLowerCase());
    expect(AUTH_EMAIL_DOMAIN).not.toMatch(/^@|\/\//);
  });

  it('isProductionBuild() is false under vitest, isSupabaseConfigured() false without env', () => {
    expect(isProductionBuild()).toBe(false);
    expect(isSupabaseConfigured()).toBe(false); // no VITE_* env loaded in tests
  });
});
