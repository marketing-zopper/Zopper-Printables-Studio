# Zopper Printables Studio

A dashboard that turns a PDF into a press-ready file: sharp vector artwork
(the original page is embedded as-is, not rasterized), 3mm bleed (edge-pixel
extrusion, raster-only in the trimmed-off margin), trim + registration
marks, a 22-patch colour bar, dashed fold marks, a caption stamp, correct
TrimBox/BleedBox/MediaBox/ArtBox, an output intent, an ink-coverage (TAC)
check, and QR verification — built to the spec in
`references/print-pipeline-notes.md`. The PDF itself is read, transformed,
and re-assembled entirely client-side with `pdf.js`, `pdf-lib`, and `jsQR`.

Sign-in is required (Supabase Auth, restricted to `@zopper.com` addresses),
and finished jobs — name, QA report, and the PDF itself — are saved to a
shared Supabase project, so job history is the same for everyone on the
team and survives across devices, not just this browser.

## Sharp by default (vector, not rasterized)

Earlier builds rendered every page to a raster image before reassembling it —
correct-looking on screen, but it pixelated on zoom since text and shapes
lost their vector precision. That's fixed: **the original PDF page is now
embedded directly as a vector object** (via `pdf-lib`'s `embedPage`/`drawPage`,
a real PDF Form XObject reference) inside the TrimBox, so text and vector
art stay infinitely sharp — verified by confirming the source PDF's own text
is still extractable from the output. Only the newly-synthesised bleed
margin (which has no "real" content and gets trimmed off in production)
is raster — four thin edge-extruded strips, not a full-page image.

Toggle **Flatten & convert** per job (off by default) to go back to the old
full-rasterize-and-convert pipeline for cases where you specifically need
CMYK baked into pixels rather than declared via the output intent.

## Run it

```bash
cp .env.example .env.local   # Supabase URL + anon key, plus the server-only values (see below)
npm install
npm run dev       # http://localhost:5173
```

```bash
npm run build     # production build in dist/
npm run preview   # serve the production build locally
```

### Supabase setup (one-time, per project)

1. Create a Supabase project, then copy its **Project URL** and **anon/public
   key** (Settings → API) into `.env.local` as `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY`. The browser only ever gets the anon key; the
   `service_role` key is used by the server-side `/api` functions only (see
   *Sign-in and access control*) and must never be given a `VITE_` name.
2. Paste `supabase/schema.sql` into the Supabase SQL Editor and run it once.
   It's idempotent (safe to re-run). It sets up:
   - `profiles` and `jobs` tables with Row Level Security — anyone signed in
     can read all jobs (shared team history), but only the creator of a job
     can delete it.
   - A database trigger that rejects any signup whose email doesn't end in
     `@zopper.com`, enforced server-side so it can't be bypassed by calling
     the Supabase API directly.
   - A trigger that auto-creates a `profiles` row for every new user.
   - The `job-pdfs` Storage bucket (private) and its access policies.
   - Realtime enabled on `jobs`, so everyone's list updates live.
3. Apply `supabase/migrations/20261116_rbac_lockdown.sql` (after the app
   version that uses `/api` is deployed — see below). Rollback:
   `20261116_rbac_lockdown_rollback.sql`.

## Sign-in and access control

Employees sign in with **Google** (Supabase Auth, Google provider). Who may use
the tool, and as what, is decided centrally by the Zopper Marketing Studio
Master App — this app only *reads* that decision.

- **Roles** come from the Master App's Upstash Redis record for the employee
  (`zms:employees` → `<email>` → `active`, `permissions["printables-studio"]`,
  `roles["printables-studio"]`). Missing, inactive or unrecognised = no access.
  If Redis can't be reached, access is denied (fail closed). Redis is only ever
  sent `HGET`; the client refuses any other command.
- **Global Super Admin** is the verified Google account `marketingext@zopper.com`
  (a constant in `api/_lib/access.js`, not assignable in Redis).
- **Viewer** — see and download everyone's finished jobs. **Editor** — also
  create jobs and delete their own. **Admin / Super Admin** — also delete anyone's.
- **Enforcement is server-side.** Every job read, upload, download and delete
  goes through `/api` (Vercel functions), which verifies the Supabase session,
  looks up the employee and checks the role on *every* request. After the
  lockdown migration, the browser has no direct access to the `jobs` table or
  the `job-pdfs` bucket at all, so the public anon key can't bypass it.

Environment variables (see `.env.example`). Server-only values go in Vercel →
Settings → Environment Variables, never in the repo:

| Variable | Where | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | browser | Supabase client |
| `VITE_ENABLE_PASSWORD_LOGIN` | browser | `false` removes the legacy email+password link |
| `SUPABASE_SERVICE_ROLE_KEY` | server | `/api` data access |
| `SUPABASE_URL` | server | optional; defaults to `VITE_SUPABASE_URL` |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | server | read-only employee lookup |

Google OAuth client ID/secret live in Supabase (Authentication → Providers →
Google), not in this repo. The Google Cloud client needs the Supabase callback
`https://<project-ref>.supabase.co/auth/v1/callback` as an authorised redirect URI.
`npm run dev` also serves `/api` locally, using `.env.local`.

Existing email+password accounts are kept as a rollback path. Signing in with
Google using the same `@zopper.com` email links to the existing account (same
user id), so job ownership is unchanged. New password sign-ups are blocked.

## Certified colour conversion

**Coated FOGRA39L** ships built in (`public/profiles/Coated_Fogra39L_VIGC_300.icc`).
No setup required.

- Ink (TAC) coverage is always computed through a real ICC transform via
  [Little CMS](https://github.com/mm2/Little-CMS) (compiled to WebAssembly
  via [`lcms-wasm`](https://github.com/mattdesl/lcms-wasm)) — the same
  colour engine behind Photoshop and most prepress software — not a formula,
  regardless of whether you flatten to raster.
- The profile itself is embedded in the output PDF's OutputIntent
  (`DestOutputProfile`), so a print shop's preflight tool can verify it
  directly instead of taking a name on trust.
- By default (sharp vector mode), the artwork's own pixels are **not**
  altered — the ICC profile is declared for the print shop's RIP to honour,
  which is standard PDF/X practice and keeps the vector content untouched.
- Check **Flatten & convert** on a job to rasterize it and bake the ICC
  conversion directly into pixels — trades vector sharpness for pre-converted
  colour, only needed for specific press workflows or PDF/X requirements.
- Go to **Settings → Colour profile** to upload a different CMYK output
  profile (e.g. your print shop's own) — it overrides the built-in default
  for every job, stored only in this browser's IndexedDB, never uploaded
  anywhere.

### FOGRA39L licensing

The bundled profile (`Coated_Fogra39L_VIGC_300.icc`, ~8.6MB, fetched lazily —
not part of the JS bundle) is redistributed unmodified. Per
[Fogra's own terms](https://fogra.org/en/downloads/work-tools/characterisation-data):
*"Free use and redistribution of the Fogra characterisation data is
permitted, including redistribution as part of commercial and non-commercial
software, provided that the data are distributed unmodified and Fogra is
identified as the source."* This specific build is credited to VIGC /
X-Rite, Inc. via the [ICC profile registry entry](https://registry.color.org/profile-registry/Coated_Fogra39L_VIGC_300),
which states it *"may be used, embedded, exchanged, and shared without
restriction"* (not to be altered or sold). Source file:
https://registry.color.org/profile-registry/profiles/Coated_Fogra39L_VIGC_300.icc

## Other notes

- If a page's physical size looks unusually large (a common symptom of a
  Figma pixel-as-point export), the app asks you to confirm or correct the
  trim size before processing rather than guessing.
