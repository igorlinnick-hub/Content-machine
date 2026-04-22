# Google Drive setup

The app writes generated scripts into Google Docs in a clinic-specific Drive folder. That needs one Google Cloud service account with Drive + Docs API access. Repeat per environment (dev, prod).

## 1. Create the Google Cloud project

1. https://console.cloud.google.com → **New project** → name it (e.g. `content-machine-dev`).
2. Enable APIs → search and enable both:
   - **Google Drive API**
   - **Google Docs API**

## 2. Create the service account

1. IAM & Admin → **Service Accounts** → **Create service account**.
2. Name it (e.g. `content-machine-sa`). Skip the optional role grant (Drive access is scoped via folder sharing, not IAM).
3. On the new service account → **Keys** tab → **Add key** → **JSON**. Save the downloaded file.

## 3. Share the Drive folder with the service account

1. In Google Drive, create (or pick) the folder where generated Docs should land.
2. Right-click → **Share** → paste the service account email (`...@....iam.gserviceaccount.com`) → grant **Editor**.
3. Copy the folder id from the URL: `https://drive.google.com/drive/folders/<FOLDER_ID>`.

## 4. Fill `.env.local`

From the downloaded JSON key:

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=content-machine-sa@<project>.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_DRIVE_FOLDER_ID=<FOLDER_ID>
```

Notes:
- Keep the quotes. The private key has literal `\n` sequences; the code replaces them with real newlines at runtime.
- `GOOGLE_DRIVE_FOLDER_ID` is the default target. An API caller can override per-request with `folderId`.

## 5. Smoke test

After restarting the Next.js dev server:

```bash
curl -s -X POST http://localhost:3000/api/export/google \
  -H 'content-type: application/json' \
  -d '{"scriptId":"<some script uuid>"}' | jq
```

Expected: `{ "doc_id": "...", "doc_url": "https://docs.google.com/document/d/.../edit", "reused": false }`.

Follow-up calls for the same script return `reused: true` and the cached URL — the route is idempotent.
