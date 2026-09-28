# Deployment handoff (payments unavailable)

## Build and hosting

- Use Node **24** (validated on 24.14.1) and npm (validated on 11.11.0).
- Install with `npm ci`, including dev dependencies during validation/build.
- Run `npm run check`: all frontend tests, database tests, TypeScript and the production build.
- Publish only the **build/** directory to a static HTTPS host. The app uses hash navigation and assumes it is hosted at `/`. Configure a custom public URL only if deploying below a subpath.
- Set `REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_ANON_KEY` in the hosting provider's **build environment**. Use a publishable/anon key. These values are included in the JavaScript bundle; never supply a service-role key or private provider secret.
- Changing environment variables requires a new build. Verify that the deployed site does not show the sample-preview notice.
- For a local production smoke check: `python3 -m http.server 3000 --bind 0.0.0.0 --directory build`, then open `http://localhost:3000`. This command is for local inspection; production should use the hosting provider's HTTPS/static serving.

## Supabase setup

1. Back up the existing database and rehearse on a staging project first.
2. New project: execute `supabase/schema.sql`, then `supabase/migrations/20260927_arena_integrity.sql`. Existing project with the base schema: execute only the migration. The base schema is not a repeatable migration; the hardening migration is transactional and repeatable.
3. Deploy the migration before the new frontend. It creates the catalog/room separation, restricted grants and application RPCs. **Do not launch with only the base schema**, which lacks the hardening.
4. Enable Supabase email/password authentication and email confirmation. Configure **8-digit email OTPs**, an expiry, and SMTP delivery. Put `{{ .Token }}` in the **Confirm signup** template. For local Supabase, the option is `auth.email.otp_length = 8`; configure the corresponding hosted Auth setting for a hosted project.
5. Set Auth Site URL to the production HTTPS origin. Allow exact staging/production redirect URLs used by the app. If Google login is offered, enable its provider, configure its credentials in Supabase, and configure the Supabase callback URL in Google. Firebase-only login is a fallback without arena persistence; it is not the deployment configuration for this schema.
6. Add trusted **Supabase Auth user UUIDs** to `public.admin_users` using the SQL editor. Email environment variables do not grant admin access.
7. For team logo uploads, create a public `team-logos` bucket limited to PNG/JPEG/WebP and 2 MB. Its authenticated INSERT policy must require `bucket_id = 'team-logos'` and `(storage.foldername(name))[1] = auth.uid()::text`. Public logos are intentionally public; do not use this bucket for private documents. Image URLs also work without uploads.
8. Optionally enable Realtime for accessible tables. Catalog/room data also refreshes every minute. Confirm that room credentials appear only for eligible registered players or admins.

### Verify permissions in staging

Use a real normal account and the publishable/anon key, never the SQL editor's privileged role, to test attempted writes. Direct wallet updates and ledger/registration inserts must fail. An admin browser session must also use the restricted server RPCs for money changes.

The following SQL-editor inspection is read-only:

```sql
select
  has_table_privilege('authenticated', 'public.users', 'UPDATE') as unrestricted_profile_update,
  has_column_privilege('authenticated', 'public.users', 'wallet_balance', 'UPDATE') as wallet_update,
  has_table_privilege('authenticated', 'public.wallet_transactions', 'INSERT') as ledger_insert,
  has_table_privilege('authenticated', 'public.tournament_registrations', 'INSERT') as direct_registration,
  has_table_privilege('anon', 'public.tournament_rooms', 'SELECT') as public_rooms;
-- Every value above must be false.
```

Legitimate joins and admin result settlement can change balances **inside server transactions**. Users cannot choose an arbitrary new balance, entry fee or ledger amount.

## Staging acceptance checklist

- Sign up; receive an eight-digit code; paste a code starting with zero; reject wrong/expired codes; resend after cooldown; verify; refresh and retain the authenticated session.
- Sign in/out and exercise Google redirect if enabled. Ensure another account never sees the previous account's profile, wallet history or room details.
- Edit profile fields and avatar, save, refresh, and verify persistence.
- Create a free tournament as an admin; verify a normal account cannot create it; confirm guests see the listing and search/filter work.
- Join once, retry, and confirm only one registration/charge. Check full/closed tournaments. Verify team ownership when registering with a team.
- Publish results, verify the leaderboard, and reject a second settlement for the same tournament.
- Click add cash, continue to payment, and withdraw. All must report unavailable without changing funds or creating transactions. **No Razorpay integration is included.**
- Check mobile pages, console/network errors, profile save errors, and expired-session behavior on the deployed HTTPS origin.

## Before production launch

- Complete the hosted checklist above. Local tests use mocked auth/API responses and embedded PostgreSQL; they do not prove SMTP, OAuth, PostgREST, Storage or Realtime integration.
- Reconcile historical balances and transactions created by the old demo payment flow. New wallets start at zero. Do not silently treat old demo credits as real funds.
- With payments unavailable, launch with **free entries and no cash payouts** until there is an agreed operational way to handle balances. Deposits/withdrawals remain unavailable. Payment implementation is outside this change.
- Review/remediate the existing legacy `react-scripts` dependency advisories (last audit: 28 vulnerable nodes: 14 high, 5 moderate, 9 low). Compatible `npm audit fix` made no changes; forcing its proposed `react-scripts@0.0.0` replacement would break the toolchain. This remains a separate release decision/work item.
- Enable CodeRabbit review for this task or obtain another review of the auth/security/database changes before merge; the previous task setting disabled its automated review.
- Verify the host builds the intended commit with the correct environment, configure HTTPS, and retain a database backup and previous build. If rollout fails, pause access and restore a compatible build; **do not restore insecure wallet grants** as a workaround.
