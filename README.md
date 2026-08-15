# Niramaya

A vital log book developed by Sachin Saini.

Niramaya is a small installable web app for recording vitals by patient: BP, SpO2, pulse, temperature in Fahrenheit, notes, date, and time. Reading times are saved to Google Sheets with an IST offset for readability. It keeps a local backup in the browser, can sync to one shared Google Sheet through Google Apps Script, shows the full synced record history without a row limit, and keeps trend graphs collapsed until needed.

## Files

- `index.html`, `styles.css`, `app.js`: the web app
- `manifest.webmanifest`, `service-worker.js`, icons: home-screen install/offline assets
- `google-apps-script/Code.gs`: Google Sheet sync endpoint
- `api/sync.js`: Vercel serverless sync proxy for reliable phone sync

## Google Sheet Setup

1. Create a new Google Sheet named `Niramaya Vitals`.
2. In the sheet, go to `Extensions > Apps Script`.
3. Paste the contents of `google-apps-script/Code.gs`.
4. In Apps Script, open `Project Settings > Script properties`.
5. Add property `NIRAMAYA_ACCESS_CODE` with a private code only you know.
6. Click `Deploy > New deployment`.
7. Choose type `Web app`.
8. Set `Execute as` to `Me`.
9. Set `Who has access` to `Anyone with the link`.
10. Copy the Web App URL.
11. Open the Web App URL directly in a browser. It should show `Niramaya sync endpoint is running.`
12. Open Niramaya, paste the Web App URL ending in `/exec` and the access code in `Sync`, then use `Test URL`.
13. Save sync settings.

If you change `Code.gs` later, create a new Apps Script deployment version. Editing the script alone does not update the live `/exec` URL.

## Hosting

This is a static app, so it can be hosted free on GitHub Pages, Cloudflare Pages, Vercel, Netlify, or OpenAI Sites.

## Vercel Setup

Vercel is recommended for iPhone sync because the app can use `/api/sync` instead of calling Google Apps Script directly from the phone browser.

1. Push or upload this folder to GitHub.
2. In Vercel, import the GitHub repository.
3. In the Vercel project, open `Settings > Environment Variables`.
4. Add `NIRAMAYA_SCRIPT_URL` with your Apps Script `/exec` URL.
5. Add `NIRAMAYA_ACCESS_CODE` with the same access code set in Apps Script script properties.
6. Redeploy the Vercel project.
7. Open `https://your-vercel-app.vercel.app/api/sync?action=ping`.

Expected response:

```json
{"ok":true,"message":"Niramaya Vercel sync endpoint is running."}
```

For GitHub Pages:

1. Create a public GitHub repository, for example `niramaya`.
2. Upload all files in this folder to the repository root.
3. In GitHub, open `Settings > Pages`.
4. Select `Deploy from a branch`.
5. Choose branch `main` and folder `/root`.
6. Save. GitHub will provide a URL like `https://yourname.github.io/niramaya/`.

## Storage Model

- Without sync settings, readings stay only in the current browser.
- On Vercel, sync uses server-side environment variables and each device does not need the Apps Script URL.
- Outside Vercel, manual Google Sheet sync can still be configured inside Sync settings.

## Medical Note

This app only records data and shows simple visual warnings. It does not diagnose or replace your doctor's instructions.
