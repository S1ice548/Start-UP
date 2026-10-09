/**
 * Supabase sign-up / login binding tests.
 *
 * Verifies, against a mocked Supabase client, that:
 *  - sign-up calls supabase.auth.signUp() with the VITE_* configured client,
 *    an e-mail derived from the username and all demographic fields
 *  - the profile row is written to `user_profiles` with the exact column names
 *    of the migration (and never a plain-text password)
 *  - every Supabase failure (duplicate, invalid e-mail, unconfirmed e-mail,
 *    connection error, RLS block, missing table) surfaces as a readable Thai
 *    message instead of failing silently or falling back to localStorage
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  configured: true,
  online: true,
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  from: vi.fn()
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: (...a) => mock.signUp(...a),
      signInWithPassword: (...a) => mock.signInWithPassword(...a)
    },
    from: (...a) => mock.from(...a)
  },
  isSupabaseConfigured: () => mock.configured,
  isOnline: () => mock.online,
  buildAuthEmail: (u) => `${String(u || '').trim().toLowerCase()}@neenoi.com`,
  AUTH_EMAIL_DOMAIN: 'neenoi.com',
  isProductionBuild: () => false
}));

import { signUpWithSupabase, loginWithSupabase, mapSupabaseAuthError } from './supabaseService';

const SIGNUP_ARGS = { username: 'Somchai', password: 'secret123', gender: 'ชาย', age: 30, occupation: 'ฟรีแลนซ์' };

const okAuthUser = { id: 'uuid-1', email: 'somchai@neenoi.com', identities: [{ provider: 'email' }], user_metadata: { username: 'Somchai', gender: 'ชาย', age: 30, occupation: 'ฟรีแลนซ์' } };

function chain({ upsertResult = { error: null }, selectResult = { data: null, error: null } } = {}) {
  return {
    upsert: vi.fn(async () => upsertResult),
    select: () => ({ eq: () => ({ maybeSingle: vi.fn(async () => selectResult) }) })
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mock.configured = true;
  mock.online = true;
  mock.signUp.mockResolvedValue({ data: { user: okAuthUser, session: { access_token: 'tok' } }, error: null });
  mock.signInWithPassword.mockResolvedValue({ data: { user: okAuthUser, session: { access_token: 'tok' } }, error: null });
  mock.from.mockReturnValue(chain());
});

describe('signUpWithSupabase (central account + schema-aligned profile row)', () => {
  it('calls supabase.auth.signUp with the derived e-mail and every demographic field', async () => {
    const res = await signUpWithSupabase(SIGNUP_ARGS);

    expect(mock.signUp).toHaveBeenCalledTimes(1);
    const arg = mock.signUp.mock.calls[0][0];
    expect(arg.email).toBe('somchai@neenoi.com');           // username -> e-mail binding
    expect(arg.password).toBe('secret123');
    expect(arg.options.data).toEqual({
      username: 'Somchai', gender: 'ชาย', age: 30, occupation: 'ฟรีแลนซ์'
    });

    expect(res.id).toBe('uuid-1');
    expect(res.email).toBe('somchai@neenoi.com');
    expect(res.sessionActive).toBe(true);
    expect(res.warnings).toEqual([]);
  });

  it('upserts into user_profiles with the exact migration columns (no password)', async () => {
    const chainMock = chain();
    mock.from.mockReturnValue(chainMock);

    await signUpWithSupabase(SIGNUP_ARGS);

    expect(mock.from).toHaveBeenCalledWith('user_profiles');
    expect(chainMock.upsert).toHaveBeenCalledTimes(1);
    const [payload, opts] = chainMock.upsert.mock.calls[0];
    expect(opts).toEqual({ onConflict: 'user_id' });
    expect(Object.keys(payload).sort()).toEqual(
      ['age', 'email', 'gender', 'name', 'occupation', 'role', 'updated_at', 'user_id', 'username'].sort()
    );
    expect(payload.user_id).toBe('uuid-1');
    expect(payload.username).toBe('Somchai');
    expect(payload.age).toBe(30);
    expect(payload).not.toHaveProperty('password');          // password lives in Supabase Auth only
  });

  it('throws a Thai error for an existing account (GoTrue hides it as empty identities)', async () => {
    mock.signUp.mockResolvedValue({ data: { user: { id: 'x', identities: [] }, session: null }, error: null });
    await expect(signUpWithSupabase(SIGNUP_ARGS)).rejects.toThrow('ชื่อผู้ใช้นี้ถูกใช้งานแล้วในระบบ Supabase Cloud');
  });

  it('maps Supabase e-mail validation errors to a Thai message naming the setting to fix', async () => {
    mock.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { code: 'email_address_invalid', message: 'Email address "somchai@neenoi.com" is invalid' }
    });
    await expect(signUpWithSupabase(SIGNUP_ARGS)).rejects.toThrow(/VITE_AUTH_EMAIL_DOMAIN/);
  });

  it('reports an RLS block on the profile row as a Thai warning instead of failing silently', async () => {
    mock.from.mockReturnValue(chain({
      upsertResult: { error: { code: '42501', message: 'new row violates row-level security policy for table "user_profiles"' } }
    }));

    const res = await signUpWithSupabase(SIGNUP_ARGS);       // account still created
    expect(res.id).toBe('uuid-1');
    expect(res.warnings).toHaveLength(1);
    expect(res.warnings[0]).toMatch(/Row Level Security/);
    expect(res.warnings[0]).toMatch(/supabase\/migrations/);
  });

  it('reports a missing user_profiles table as a readable Thai warning', async () => {
    mock.from.mockReturnValue(chain({
      upsertResult: { error: { code: 'PGRST205', message: "Could not find the table 'public.user_profiles' in the schema cache" } }
    }));
    const res = await signUpWithSupabase(SIGNUP_ARGS);
    expect(res.warnings[0]).toMatch(/ไม่พบตาราง "public\.user_profiles"/);
  });

  it('maps connection failures to a Thai message (no raw "Failed to fetch")', async () => {
    mock.signUp.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(signUpWithSupabase(SIGNUP_ARGS)).rejects.toThrow(/ไม่สามารถเชื่อมต่อ Supabase/);
  });

  it('flags a sign-up without a session (Confirm email enabled)', async () => {
    mock.signUp.mockResolvedValue({ data: { user: okAuthUser, session: null }, error: null });
    const res = await signUpWithSupabase(SIGNUP_ARGS);
    expect(res.sessionActive).toBe(false);
    expect(res.warnings.join(' ')).toMatch(/ยืนยันอีเมล/);
  });

  it('returns null when Supabase is not configured (local/dev mode)', async () => {
    mock.configured = false;
    await expect(signUpWithSupabase(SIGNUP_ARGS)).resolves.toBeNull();
  });
});

describe('loginWithSupabase (cross-device sign-in)', () => {
  it('signs in with the e-mail derived from the username', async () => {
    mock.from.mockReturnValue(chain({ selectResult: { data: { user_id: 'uuid-1', role: 'user' }, error: null } }));
    const res = await loginWithSupabase('Somchai', 'secret123');
    expect(mock.signInWithPassword).toHaveBeenCalledWith({ email: 'somchai@neenoi.com', password: 'secret123' });
    expect(res.id).toBe('uuid-1');
    expect(res.username).toBe('Somchai');
    expect(res.warnings).toEqual([]);
  });

  it('keeps a full profile from user_metadata when the table row is missing', async () => {
    mock.from.mockReturnValue(chain({
      upsertResult: { error: { code: '42501', message: 'new row violates row-level security policy for table "user_profiles"' } },
      selectResult: { data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.user_profiles'" } }
    }));
    const res = await loginWithSupabase('Somchai', 'secret123');
    expect(res.profile).toMatchObject({ gender: 'ชาย', age: 30, occupation: 'ฟรีแลนซ์' });
    expect(res.warnings.join(' ')).toMatch(/Row Level Security|ไม่พบตาราง/);
  });

  it('throws a Thai error for wrong credentials', async () => {
    mock.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { code: 'invalid_credentials', message: 'Invalid login credentials' }
    });
    await expect(loginWithSupabase('Somchai', 'wrong')).rejects.toThrow('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
  });

  it('throws a Thai error when the e-mail is not confirmed yet', async () => {
    mock.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { code: 'email_not_confirmed', message: 'Email not confirmed' }
    });
    await expect(loginWithSupabase('Somchai', 'secret123')).rejects.toThrow(/ยืนยันตัวตน/);
  });

  it('throws a Thai connection error when the network fails', async () => {
    mock.signInWithPassword.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(loginWithSupabase('Somchai', 'secret123')).rejects.toThrow(/ไม่สามารถเชื่อมต่อ Supabase/);
  });

  it('returns null when Supabase is not configured (local/dev mode)', async () => {
    mock.configured = false;
    await expect(loginWithSupabase('Somchai', 'secret123')).resolves.toBeNull();
  });
});

describe('mapSupabaseAuthError', () => {
  it('never returns an empty or raw English message for known failures', () => {
    expect(mapSupabaseAuthError(null)).toBeTruthy();
    expect(mapSupabaseAuthError({ message: 'Invalid login credentials' })).toBe('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
    expect(mapSupabaseAuthError({ code: '42501', message: 'RLS policy' })).toMatch(/Row Level Security/);
    expect(mapSupabaseAuthError({ code: 'PGRST205', message: "Could not find the table 'public.user_profiles'" })).toMatch(/ไม่พบตาราง/);
    expect(mapSupabaseAuthError({ message: 'over_email_send_rate_limit' })).toMatch(/rate limit/i);
  });
});
