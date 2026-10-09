# Supabase sign-up / login sync setup

This app stores accounts in **Supabase Auth** (central, cross-device) and the
demographic fields (`username`, `gender`, `age`, `occupation`) in
**`public.user_profiles`**. Accounts are *never* written to `localStorage` in
production — a browser-local account could not be used on another device.

Findings verified against project `fmclnzknczkahlmcazfw.supabase.co`:

| Check | Result |
|---|---|
| `public.user_profiles` | did **not** exist (inserts failed) |
| `public.User` | exists (`password`,`gender`,`age`,`occupation`), RLS blocks anon INSERT, anon SELECT allowed → plain-text passwords readable, unused by the app |
| Sign-up e-mail `<username>@neenoi.com` | rejected: `email_address_invalid` (`neenoi.com` is NXDOMAIN) |
| `mailer_autoconfirm` | `false` → "Confirm email" is ON (no session until confirmed) |
| Vercel build | needs `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` at build time |

## 1. Environment variables (Vercel + local)

Set these for **Production and Preview** in Vercel → Project → Settings →
Environment Variables (they are `VITE_*`, so they are baked in at build time):

```
VITE_SUPABASE_URL=https://fmclnzknczkahlmcazfw.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_lkEii_hj0Lq6DQkfFSttbg_F1U2JV8O
VITE_AUTH_EMAIL_DOMAIN=neenoi.com
```

Locally the same values live in `.env.development` / `.env.production`
(git-ignored). A **production build without** these variables now shows a clear
Thai error instead of silently creating browser-local accounts.

## 2. Create the profile table (SQL Editor)

Run `supabase/migrations/0001_create_user_profiles.sql` once in
Supabase → SQL Editor → New query → Run.

Without it, sign-up still creates the account in Supabase Auth (demographics in
`auth.users.user_metadata`), but the UI shows a Thai warning that the profile
row could not be saved (RLS/table missing) — visible instead of silent.

## 3. Make sign-up reachable (choose ONE)

Because `mailer_autoconfirm = false`, Supabase e-mails a confirmation link, but
`<username>@neenoi.com` can never receive mail, so nobody can confirm.

* **Option A (fastest):** Supabase → Authentication → Providers → Email →
  disable **Confirm email**. Sign-up then returns a session immediately and
  cross-device login works right away.
* **Option B (keep confirmation):** set `VITE_AUTH_EMAIL_DOMAIN` to a real
  domain **you own** with mail delivery (e.g. your company/school domain), so
  users receive the confirmation link.

## 4. Clean up the legacy `public.User` table (recommended)

Its `password` column stores plain-text passwords and is readable with the
public anon key. The app does not use this table:

```sql
alter table public."User" rename to "User_legacy_do_not_use";
-- or, safer: drop the readable password column
-- alter table public."User" drop column password;
```

## 5. Verify

1. `npm run build && npm test` — build and tests pass.
2. Open the app → สมัครสมาชิก → account appears in Supabase → Authentication →
   Users, with `user_metadata = {username, gender, age, occupation}`.
3. Sign out, open the same URL in a second browser/incognito → sign in with the
   same username/password (cross-device).
4. Check `public.user_profiles` has the demographic row.
