/**
 * Supabase Cloud Storage & Realtime Synchronization Service
 * 
 * Manages user authentication, bound records (debts, refinance settings, cashflow data),
 * and live subscriptions for instant multi-device synchronization.
 */

import { supabase, isSupabaseConfigured, isOnline, buildAuthEmail } from '../lib/supabase';

const USER_DATA_CACHE_KEY = (userId) => `nee_noi_user_v1_${userId}`;
const REFINANCE_CACHE_KEY = (userId) => `nee_noi_refinance_form_v3_${userId}`;
const CASHFLOW_CACHE_KEY = (userId) => `nee_noi_cashflow_${userId}`;

/* ==========================================
 * 1. USER AUTHENTICATION & PROFILES
 * ========================================== */

/**
 * Table that stores demographic profile rows.
 * Schema: supabase/migrations/0001_create_user_profiles.sql
 * Columns: user_id, username, name, email, gender, age, occupation, role,
 *          created_at, updated_at.
 * NOTE: `password` is deliberately NOT a column here — Supabase Auth owns the
 * password (auth.users.encrypted_password). Writing it to a Postgres table
 * would leak credentials to anyone holding the public anon key.
 */
const PROFILE_TABLE = 'user_profiles';

/**
 * Map a Supabase (GoTrue / PostgREST) error to a clear, readable Thai message
 * so failures are surfaced on the UI instead of failing silently.
 */
export function mapSupabaseAuthError(error, fallback = 'เกิดข้อผิดพลาดกับ Supabase กรุณาลองใหม่อีกครั้ง') {
  if (!error) return fallback;

  const code = String(error.code || error.error_code || '').trim();
  const msg = String(error.message || error.msg || error.details || '').trim();
  const text = `${code} ${msg}`;

  if (/already registered|user_already_exists|email_exists|username_exists|duplicate key/i.test(text)) {
    return 'ชื่อผู้ใช้นี้ถูกใช้งานแล้วในระบบ Supabase Cloud';
  }
  if (code === 'email_address_invalid' || /email address .* is invalid|invalid email/i.test(text)) {
    return `อีเมลของผู้ใช้ไม่ผ่านการตรวจสอบของ Supabase ("${msg}") — ตรวจสอบค่า VITE_AUTH_EMAIL_DOMAIN ให้เป็นโดเมนจริงที่ควบคุมได้ (ดู SUPABASE_SETUP.md)`;
  }
  if (/email not confirmed|email_not_confirmed/i.test(text)) {
    return 'อีเมลนี้ยังไม่ได้ยืนยันตัวตน — กรุณาเปิดลิงก์ยืนยันจากอีเมลก่อนเข้าสู่ระบบ หรือปิด "Confirm email" ใน Supabase Auth settings';
  }
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(text)) {
    return 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
  }
  if (/over_email_send_rate_limit|rate limit|too many requests/i.test(text)) {
    return 'Supabase จำกัดการส่งอีเมล (rate limit) — กรุณารอประมาณ 1 นาทีแล้วลองใหม่อีกครั้ง';
  }
  if (/weak_password|password should be|password.*at least/i.test(text)) {
    return 'รหัสผ่านไม่ปลอดภัยหรือสั้นเกินไป (ต้องมีอย่างน้อย 6 ตัวอักษร)';
  }
  if (code === '42501' || /row-level security/i.test(text)) {
    return 'Supabase ปฏิเสธการบันทึกข้อมูลเพราะ Row Level Security (RLS) — รันไฟล์ SQL ใน supabase/migrations บน Supabase SQL Editor';
  }
  if (code === 'PGRST205' || /Could not find the table/i.test(text)) {
    const table = (msg.match(/'([^']+)'/) || [])[1] || PROFILE_TABLE;
    return `ไม่พบตาราง "${table}" ใน Supabase — รันไฟล์ SQL ใน supabase/migrations ก่อนใช้งาน`;
  }
  if (/failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(text)) {
    return 'ไม่สามารถเชื่อมต่อ Supabase ได้ — ตรวจสอบอินเทอร์เน็ต และค่า VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY';
  }

  return `Supabase: ${msg || fallback}`;
}

/** Throw a new Error carrying the Thai-mapped message (and log the raw error). */
function throwSupabaseError(error, fallback) {
  const message = mapSupabaseAuthError(error, fallback);
  if (error && !(error instanceof Error) ) {
    console.warn('[supabase] error:', error.code || error.error_code || '', error.message || error.msg || '');
  } else if (error) {
    console.warn('[supabase] error:', error.message);
  }
  throw new Error(message);
}

/**
 * Sign up a new user in Supabase Auth (central account) and save the
 * demographic profile row to the `user_profiles` table.
 *
 * Returns null ONLY when Supabase is not configured (local/dev mode).
 * Any Supabase error is thrown as a readable Thai message.
 *
 * @returns {Promise<{ id, username, email, name, role, profile, loginTime,
 *                     warnings: string[], sessionActive: boolean }|null>}
 */
export async function signUpWithSupabase({ username, password, gender, age, occupation }) {
  if (!isSupabaseConfigured() || !supabase) return null; // local/dev mode
  if (!isOnline()) {
    throw new Error('ไม่มีการเชื่อมต่ออินเทอร์เน็ต — ไม่สามารถสมัครสมาชิกออนไลน์ได้');
  }

  // Supabase Auth requires a valid e-mail -> derive it from the username.
  const email = buildAuthEmail(username);

  // 1) Create the central account (auth.users) — the single source of truth
  //    shared by every device. Demographics travel in user_metadata so they are
  //    readable cross-device even before the profile row exists.
  let authData;
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username, gender, age: Number(age), occupation }
      }
    });
    if (error) throwSupabaseError(error, 'ไม่สามารถสร้างบัญชีผู้ใช้ใน Supabase ได้');
    authData = data;
  } catch (err) {
    // Re-throw already-mapped Thai errors, map everything else (network/SDK).
    if (err instanceof Error && /[^\x00-\x7F]/.test(err.message)) throw err;
    throwSupabaseError(err, 'ไม่สามารถเชื่อมต่อ Supabase เพื่อสมัครสมาชิกได้');
  }

  const authUser = authData && authData.user;
  if (!authUser) {
    throw new Error('ไม่สามารถสร้างบัญชีผู้ใช้ใน Supabase ได้ กรุณาลองใหม่อีกครั้ง');
  }

  // GoTrue hides an existing account by returning a user with no identities.
  const identities = Array.isArray(authUser.identities) ? authUser.identities : [];
  if (identities.length === 0) {
    throw new Error('ชื่อผู้ใช้นี้ถูกใช้งานแล้วในระบบ Supabase Cloud');
  }

  const warnings = [];

  // 2) Schema-aligned demographic row (exact column names of user_profiles).
  const profileRecord = {
    user_id: authUser.id,
    username,
    name: username,
    email,
    gender,
    age: Number(age),
    occupation,
    role: 'user',
    updated_at: new Date().toISOString()
  };

  try {
    const { error: profileError } = await supabase
      .from(PROFILE_TABLE)
      .upsert(profileRecord, { onConflict: 'user_id' });
    if (profileError) throwSupabaseError(profileError, 'ไม่สามารถบันทึกข้อมูลโปรไฟล์ได้');
  } catch (err) {
    // Do NOT fail silently: report it so the UI can show a readable Thai warning
    // (the account itself is already safely stored in Supabase Auth).
    const message = err instanceof Error ? err.message : mapSupabaseAuthError(err);
    console.warn('[supabase] user_profiles upsert failed:', message);
    warnings.push(message);
  }

  // 3) Email confirmation is enabled on some projects: signup then returns no
  //    session, and the user must confirm before signing in.
  const sessionActive = Boolean(authData.session);
  if (!sessionActive) {
    warnings.push('บัญชีถูกสร้างใน Supabase แล้ว แต่ต้องยืนยันอีเมลก่อนเข้าสู่ระบบ (Confirm email เปิดอยู่ใน Supabase Auth settings)');
  }

  return {
    id: authUser.id,
    username,
    email,
    name: username,
    role: 'user',
    profile: profileRecord,
    loginTime: new Date().toISOString(),
    warnings,
    sessionActive
  };
}

/**
 * Sign in an existing user with Supabase Auth (works from any device).
 *
 * Returns null ONLY when Supabase is not configured (local/dev mode).
 * Wrong credentials, unconfirmed e-mail, rate limits and connection problems
 * are thrown as readable Thai messages.
 */
export async function loginWithSupabase(username, password) {
  if (!isSupabaseConfigured() || !supabase) return null; // local/dev mode
  if (!isOnline()) {
    throw new Error('ไม่มีการเชื่อมต่ออินเทอร์เน็ต — ไม่สามารถเข้าสู่ระบบออนไลน์ได้');
  }

  const clean = String(username || '').trim();
  const email = clean.includes('@') ? clean : buildAuthEmail(clean);

  let result;
  try {
    result = await supabase.auth.signInWithPassword({ email, password });
  } catch (err) {
    if (err instanceof Error && /[^\x00-\x7F]/.test(err.message)) throw err;
    throwSupabaseError(err, 'ไม่สามารถเชื่อมต่อ Supabase เพื่อเข้าสู่ระบบได้');
  }
  if (result.error) {
    throwSupabaseError(result.error, 'ไม่สามารถเข้าสู่ระบบได้');
  }

  const authUser = result.data && result.data.user;
  if (!authUser) {
    throw new Error('ไม่สามารถเข้าสู่ระบบได้ กรุณาลองใหม่อีกครั้ง');
  }

  const warnings = [];
  const metadata = authUser.user_metadata || {};

  // Profile row (best effort; healed after login because the user is now
  // authenticated, which is what the RLS policies require).
  let profile = null;
  let profileMissing = false;
  try {
    const { data: profData, error } = await supabase
      .from(PROFILE_TABLE)
      .select('*')
      .eq('user_id', authUser.id)
      .maybeSingle();
    if (error) throwSupabaseError(error, 'ไม่สามารถโหลดข้อมูลโปรไฟล์ได้');
    profile = profData || null;
    profileMissing = !profData;
  } catch (err) {
    const message = err instanceof Error ? err.message : mapSupabaseAuthError(err);
    console.warn('[supabase] user_profiles read failed:', message);
    warnings.push(message);
    profileMissing = true;
  }

  if (profileMissing && metadata.username) {
    // Heal: write the demographics now that the request carries a session.
    try {
      const healRecord = {
        user_id: authUser.id,
        username: metadata.username,
        name: metadata.username,
        email: authUser.email,
        gender: metadata.gender,
        age: Number(metadata.age),
        occupation: metadata.occupation,
        role: metadata.role || 'user',
        updated_at: new Date().toISOString()
      };
      const { error } = await supabase
        .from(PROFILE_TABLE)
        .upsert(healRecord, { onConflict: 'user_id' });
      if (error) throwSupabaseError(error, 'ไม่สามารถบันทึกข้อมูลโปรไฟล์ได้');
      profile = healRecord;
      // Clear the earlier read warning: the row now exists.
      warnings.length = 0;
    } catch (err) {
      const message = err instanceof Error ? err.message : mapSupabaseAuthError(err);
      console.warn('[supabase] user_profiles heal failed:', message);
      warnings.push(message);
    }
  }

  // Demographics survive cross-device via user_metadata even without the table.
  const metadataProfile = metadata.username
    ? {
        user_id: authUser.id,
        username: metadata.username,
        name: metadata.username,
        email: authUser.email,
        gender: metadata.gender,
        age: metadata.age,
        occupation: metadata.occupation,
        role: metadata.role || 'user'
      }
    : null;

  return {
    id: authUser.id,
    username: metadata.username || clean,
    email: authUser.email,
    name: metadata.username || clean,
    role: (profile && profile.role) || metadata.role || 'user',
    profile: profile || metadataProfile,
    loginTime: new Date().toISOString(),
    warnings,
    sessionActive: true
  };
}

/**
 * Log out from Supabase Auth session
 */
export async function logoutSupabase() {
  if (isSupabaseConfigured() && isOnline()) {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('Supabase signout notice:', e);
    }
  }
}

/* ==========================================
 * 2. USER DEBTS & PLAN STORAGE (BOUND TO USER_ID)
 * ========================================== */

/**
 * Fetch user's debt planner data from Supabase Cloud DB.
 */
export async function fetchUserDebtsFromCloud(userId) {
  if (!userId || !isSupabaseConfigured() || !isOnline()) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('user_debts')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.warn('Error fetching user_debts from Supabase:', error.message);
      return null;
    }

    if (data) {
      const payload = {
        debts: Array.isArray(data.debts) ? data.debts : [],
        extraBudget: Number(data.extra_budget ?? 5000),
        paymentLogs: Array.isArray(data.payment_logs) ? data.payment_logs : [],
        savedPlans: Array.isArray(data.saved_plans) ? data.saved_plans : [],
        strategy: data.strategy || null,
      };

      // Cache locally for offline availability
      try {
        localStorage.setItem(USER_DATA_CACHE_KEY(userId), JSON.stringify(payload));
      } catch (e) { /* quota */ }

      return payload;
    }
  } catch (err) {
    console.warn('Network issue fetching user_debts from Supabase:', err);
  }

  return null;
}

/**
 * Save / Upsert user's debt planner data to Supabase Cloud DB.
 */
export async function saveUserDebtsToCloud(userId, data) {
  if (!userId || userId === 'admin') return;

  const payload = {
    user_id: userId,
    debts: data.debts || [],
    extra_budget: Number(data.extraBudget ?? 0),
    payment_logs: data.paymentLogs || [],
    saved_plans: data.savedPlans || [],
    strategy: data.strategy || null,
    updated_at: new Date().toISOString(),
  };

  // Always update local cache first (instant local persistence)
  try {
    localStorage.setItem(USER_DATA_CACHE_KEY(userId), JSON.stringify({
      debts: payload.debts,
      extraBudget: payload.extra_budget,
      paymentLogs: payload.payment_logs,
      savedPlans: payload.saved_plans,
      strategy: payload.strategy,
    }));
  } catch (e) { /* ignore */ }

  if (!isSupabaseConfigured() || !isOnline()) return;

  try {
    const { error } = await supabase
      .from('user_debts')
      .upsert(payload, { onConflict: 'user_id' });

    if (error) {
      console.warn('Failed to upsert user_debts to Supabase:', error.message);
    }
  } catch (err) {
    console.warn('Network error saving user_debts to Supabase:', err);
  }
}

/**
 * Real-time listener for user_debts changes across devices/tabs.
 */
export function subscribeToUserDebts(userId, onUpdateCallback) {
  if (!userId || !isSupabaseConfigured() || !isOnline() || !supabase) {
    return () => {};
  }

  const channelName = `realtime-user-debts-${userId}`;
  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'user_debts',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        if (payload.new) {
          const updatedData = {
            debts: Array.isArray(payload.new.debts) ? payload.new.debts : [],
            extraBudget: Number(payload.new.extra_budget ?? 5000),
            paymentLogs: Array.isArray(payload.new.payment_logs) ? payload.new.payment_logs : [],
            savedPlans: Array.isArray(payload.new.saved_plans) ? payload.new.saved_plans : [],
            strategy: payload.new.strategy || null,
          };
          onUpdateCallback(updatedData);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/* ==========================================
 * 3. REFINANCE SETTINGS STORAGE (BOUND TO USER_ID)
 * ========================================== */

/**
 * Fetch refinance form settings for a specific user from Supabase.
 */
export async function fetchRefinanceSettingsFromCloud(userId) {
  if (!userId || !isSupabaseConfigured() || !isOnline()) return null;

  try {
    const { data, error } = await supabase
      .from('refinance_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) return null;
    if (data && data.form_data) {
      try {
        localStorage.setItem(REFINANCE_CACHE_KEY(userId), JSON.stringify(data.form_data));
      } catch (e) { /* ignore */ }
      return data.form_data;
    }
  } catch (err) {
    console.warn('Error fetching refinance settings:', err);
  }
  return null;
}

/**
 * Save refinance form settings for a specific user to Supabase.
 */
export async function saveRefinanceSettingsToCloud(userId, formData) {
  if (!userId) return;

  // Local cache
  try {
    localStorage.setItem(REFINANCE_CACHE_KEY(userId), JSON.stringify(formData));
  } catch (e) { /* ignore */ }

  if (!isSupabaseConfigured() || !isOnline()) return;

  try {
    await supabase.from('refinance_settings').upsert(
      {
        user_id: userId,
        form_data: formData,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );
  } catch (e) {
    console.warn('Error saving refinance settings to Supabase:', e);
  }
}

/**
 * Realtime listener for refinance settings across devices.
 */
export function subscribeToRefinanceSettings(userId, onUpdateCallback) {
  if (!userId || !isSupabaseConfigured() || !isOnline() || !supabase) {
    return () => {};
  }

  const channel = supabase
    .channel(`realtime-refinance-${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'refinance_settings',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        if (payload.new && payload.new.form_data) {
          onUpdateCallback(payload.new.form_data);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/* ==========================================
 * 4. CASHFLOW DATA STORAGE (BOUND TO USER_ID)
 * ========================================== */

/**
 * Fetch cashflow data (entries, starting balance, monthly budget) from Supabase.
 */
export async function fetchCashflowFromCloud(userId) {
  if (!userId || !isSupabaseConfigured() || !isOnline()) return null;

  try {
    const { data, error } = await supabase
      .from('cashflow_data')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) return null;
    if (data) {
      return {
        entries: Array.isArray(data.entries) ? data.entries : [],
        startingBalance: Number(data.starting_balance ?? 10000),
        monthlyBudget: data.monthly_budget || { income: 0, expense: 0, incomeDay: 1 },
      };
    }
  } catch (e) {
    console.warn('Error fetching cashflow data:', e);
  }
  return null;
}

/**
 * Save cashflow data for a user to Supabase.
 */
export async function saveCashflowToCloud(userId, { entries, startingBalance, monthlyBudget }) {
  if (!userId) return;

  if (!isSupabaseConfigured() || !isOnline()) return;

  try {
    await supabase.from('cashflow_data').upsert(
      {
        user_id: userId,
        entries: entries || [],
        starting_balance: Number(startingBalance ?? 10000),
        monthly_budget: monthlyBudget || {},
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );
  } catch (e) {
    console.warn('Error saving cashflow to Supabase:', e);
  }
}

/**
 * Realtime listener for cashflow data changes.
 */
export function subscribeToCashflow(userId, onUpdateCallback) {
  if (!userId || !isSupabaseConfigured() || !isOnline() || !supabase) {
    return () => {};
  }

  const channel = supabase
    .channel(`realtime-cashflow-${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'cashflow_data',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        if (payload.new) {
          onUpdateCallback({
            entries: Array.isArray(payload.new.entries) ? payload.new.entries : [],
            startingBalance: Number(payload.new.starting_balance ?? 10000),
            monthlyBudget: payload.new.monthly_budget || { income: 0, expense: 0, incomeDay: 1 },
          });
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/* ==========================================
 * 5. REFINANCE PROMOTIONS & MASTER DATA
 * ========================================== */

export async function fetchPromotionsFromCloud() {
  if (!isSupabaseConfigured() || !isOnline()) return null;

  try {
    const { data, error } = await supabase
      .from('refinance_promotions')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) return null;
    if (Array.isArray(data) && data.length > 0) {
      return data;
    }
  } catch (e) {
    console.warn('Error fetching promotions from Supabase:', e);
  }
  return null;
}

export async function savePromotionToCloud(promo) {
  if (!isSupabaseConfigured() || !isOnline()) return null;

  try {
    const { data, error } = await supabase
      .from('refinance_promotions')
      .upsert(promo, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      console.warn('Supabase promo save error:', error.message);
      return null;
    }
    return data;
  } catch (e) {
    console.warn('Cloud promo save error:', e);
    return null;
  }
}

export async function deletePromotionFromCloud(id) {
  if (!isSupabaseConfigured() || !isOnline()) return false;

  try {
    const { error } = await supabase
      .from('refinance_promotions')
      .delete()
      .eq('id', id);

    return !error;
  } catch (e) {
    return false;
  }
}
