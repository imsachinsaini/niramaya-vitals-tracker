# Niramaya

A vital log book developed by Sachin Saini.

Niramaya is a small installable web app for recording vitals by patient: BP, SpO2, pulse, temperature in Fahrenheit, notes, date, and time. Reading times are saved to Google Sheets with an IST offset for readability. It keeps a local backup in the browser, can sync to one shared Google Sheet through Google Apps Script, shows the full synced record history without a row limit, and keeps trend graphs collapsed until needed.

## Files

- `index.html`, `styles.css`, `app.js`: the web app
- `manifest.webmanifest`, `service-worker.js`, icons: home-screen install/offline assets
- `google-apps-script/Code.gs`: Google Sheet sync endpoint

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

For GitHub Pages:

1. Create a public GitHub repository, for example `niramaya`.
2. Upload all files in this folder to the repository root.
3. In GitHub, open `Settings > Pages`.
4. Select `Deploy from a branch`.
5. Choose branch `main` and folder `/root`.
6. Save. GitHub will provide a URL like `https://yourname.github.io/niramaya/`.

## Storage Model

- Without sync settings, readings stay only in the current browser.
- With Google Sheet sync, readings are saved locally and merged with the shared sheet.
- The app link can be opened anywhere, but each new device needs the Apps Script URL and access code once.

## Medical Note

This app only records data and shows simple visual warnings. It does not diagnose or replace your doctor's instructions.
