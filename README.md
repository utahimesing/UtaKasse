# UtaKasse

UtaKasse is an offline-first bookkeeping and checkout web app built with React + Vite.
Data is stored in the browser (IndexedDB via Dexie), and supports Google Drive backup/restore.

## Quick Start

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment variables

Create a `.env` file in project root and set:

```bash
VITE_GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
```

You can copy from `.env.example`.

### 3) Start dev server

```bash
npm run dev
```

### 4) Build for production

```bash
npm run build
```

## Security Rules (Important)

- Never commit `.env`, secrets, OAuth credentials JSON, private keys, or certificates.
- Never include real customer data in repository, screenshots, or demo exports.
- Treat exposed credentials as compromised: rotate/revoke immediately.
- Keep dependencies patched and run `npm audit` before release.

## Pre-Publish Checklist

- `npm run build` passes
- `npm audit` shows no high/critical vulnerabilities
- No secret files in working tree (e.g. `.env`, `*.pem`, `*.key`, credential JSON)
- Google OAuth uses `VITE_GOOGLE_CLIENT_ID` only (no `client_secret` in frontend code)

## Minimal Smoke Test Checklist

Run this flow after each significant change:

1. Add product
2. Checkout
3. Export report
4. Backup to Google Drive
5. Restore from backup and verify records

## Demo Data and Privacy

- Use anonymized/fake data for demos.
- Do not use real phone numbers, transaction notes, or user identifiers in shared backup files.
- If sharing backup JSON externally, review and sanitize first.

## Versioning

- Recommended tag format: `vMAJOR.MINOR.PATCH`
- First release tag for this project: `v1.0.0`

## License

MIT License. See `LICENSE`.
