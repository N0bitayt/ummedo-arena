# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can’t go back!**

If you aren’t satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you’re on your own.

You don’t have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn’t feel obligated to use this feature. However we understand that this tool wouldn’t be useful if you couldn’t customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

## Arena configuration and deployment

Copy `.env.example` to `.env.local` and set the Supabase URL and **publishable/anon** key. Never put a service-role key or payment secret in a `REACT_APP_*` variable. Restart the app after changing environment variables.

1. For a new database, run `supabase/schema.sql`, then `supabase/migrations/20260927_arena_integrity.sql` in the SQL editor. For an existing installation, run only the migration. Back up the database first. The migration is transactional and can be rerun. Deploy the migration and frontend together: the frontend requires the new RPC functions and public catalog view.
2. Use **Supabase Auth** for arena accounts. When configured, it is authoritative for email/password and Google OAuth; the schema uses Supabase UUIDs. Firebase remains available only for authentication when Supabase is absent, with persistence and registration unavailable.
3. Enable email confirmation and set **Email OTP length to 8** in Supabase Auth. Include `{{ .Token }}` in the **Confirm signup** email template. The default OTP length is six, so leaving the default will prevent this app's eight-digit verification from succeeding. For local Supabase configuration the option is `[auth.email] otp_length = 8`. Configure SMTP and the permitted Site URL/redirect URLs. See [Supabase OTP configuration](https://supabase.com/docs/guides/cli/config#auth.email.otp_length) and [email templates](https://supabase.com/docs/guides/auth/auth-email-templates).
4. Enable Google in Supabase Auth and allow the app origin as an OAuth redirect. The browser never accepts an OAuth access token as an ID token or invents a user identity.
5. Add trusted Supabase user UUIDs to `public.admin_users` using the SQL editor. The browser reads this allowlist; environment email lists no longer grant admin access.
6. For team logo uploads, create a public `team-logos` storage bucket, restrict files to PNG/JPEG/WebP and 2 MB, and allow authenticated inserts only under the current user's UUID folder. The UI reports storage failures and also supports an image URL.
7. Enable realtime on the accessible tables if desired. Public tournaments are read through `tournament_catalog`; the app polls every minute as a fallback and to release room details at the scheduled time. Room passwords are in a private table and only available through `my_rooms()` to admins or registered players within the access window.

### Payments and existing balances

This repository has **no Razorpay order endpoint, signature verification, captured-payment webhook, or payout backend**. Deposits and withdrawals therefore show an unavailable message without changing funds. The previous “simulate success” flow could credit the database without payment and has been removed. Do not re-enable payments until a trusted backend verifies Razorpay capture and settles each payment exactly once. Provider secrets belong on that backend.

New wallets start at zero. The migration preserves existing balances and transactions; reconcile any historical demo balances/unverified deposits before enabling paid operation. Entry fees and winner payouts are now server transactions. Repeated joins cannot charge twice; repeated winner declarations are rejected. Account deletion is blocked while there is a balance or an unfinished registration.

### Verification

```sh
npm ci
CI=true npm test -- --watchAll=false --runInBand
npm run test:db
npx tsc --noEmit
CI=true npm run build
```

`test:db` uses embedded PostgreSQL (PGlite) with synthetic Auth roles/users to run the schema, migration twice, RLS checks and transaction regressions. It does not verify hosted Supabase's PostgREST, SMTP, OAuth, Storage or Realtime services. The pgcrypto extension declaration is omitted in that harness; `gen_random_uuid()` is available in the embedded PostgreSQL core.

For the release sequence, hosting settings, Supabase setup and staging acceptance checks, see [Deployment handoff](docs/DEPLOYMENT.md). Run `CI=true npm run check` for the complete local release gate.
