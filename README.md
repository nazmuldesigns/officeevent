# NRB World Event - Registration & Verification Portal

Official event registration, barcode verification, and attendee check-in system for **NRB World Event**. 
Built with a mobile-first scanner, Code 128 true vector barcodes, instant zero-latency Web Audio, dark navy blue glassmorphic UI, and Google Sheets as a free real-time cloud database.

---

## 🚀 Quick Start (Localhost Development)

To run and test the application on your computer:

```bash
# 1. Install dependencies
npm install

# 2. Start local development server
npm run dev
```

Open your browser and navigate to:
👉 **`http://localhost:8080`**

---

## 🌟 Key Features

1. **Mobile-First Code 128 Scanner & Manual ID**:
   - High-speed rear camera scanning with animated laser reticle.
   - Zero-lag manual ID input and instant validation.
   - Built-in demo simulation buttons for instant testing without camera.

2. **Real-time Verification & Instant Audio**:
   - 🟢 **Entry Verified (Green)**: Checks in attendee, writes timestamp + gate to Google Sheet.
   - 🟠 **Already Entered (Amber)**: Prevents duplicate entry while preserving original entry timestamp.
   - 🔴 **Not Registered (Red)**: Alerts unknown attendee with one-click **New Entry Walk-up** registration.
   - Synthesizes crystal-clear Web Audio cues (harmonic success chimes, alert warnings) with zero media latency.

3. **True Vector Barcode Generator**:
   - Single vector Code 128 SVG download for individual badge printing.
   - Bulk generation with one-click **ZIP bundle download** for thousands of attendees.
   - One-tap button to load all registered attendee IDs directly from your database.

4. **Live Event Analytics & Dashboard**:
   - Total registered count, real-time checked-in count, remaining attendees, and walk-up entries.
   - Visual hall turnout capacity bar with live percentage.
   - Multi-gate station assignment (Gate 1, 2, 3, VIP) with operator staff tracking.

5. **Deep Navy Blue Aesthetic**:
   - Tailored Dark Navy Blue theme (`#070D1E`, `#0F1C3F`, `#182852`) with glowing neon accents.
   - Light mode toggle for bright outdoor environments.

---

## 📊 Google Sheets Cloud Database (100% Free)

No paid backend or subscription needed. Connect your event to Google Sheets:

### 1. Create your Google Sheet
1. Open Google Sheets and create a new spreadsheet.
2. Name the tab **`Registrations`**.
3. Set the first row (Header row) exactly as follows:
   ```text
   ID | Name | Country | Registration Status | Entry Status | Entry Time | Entry Gate | Checked By
   ```
   *(A sample template is available inside `public/setup/sheet-template.csv` or downloadable via the Setup tab).*

### 2. Deploy the Apps Script
1. Inside your spreadsheet, click **Extensions → Apps Script**.
2. Replace `Code.gs` with the content of [`apps-script/Code.gs`](apps-script/Code.gs).
3. Click **Deploy → New deployment**.
4. Select **Web app**:
   - **Execute as**: `Me`
   - **Who has access**: `Anyone`
5. Click **Deploy** and copy the **Web app URL** (`https://script.google.com/macros/s/.../exec`).

### 3. Connect in App
1. In NRB World Event app, open the **Setup** tab.
2. Paste your Google Apps Script URL.
3. Tap **Test Connection & Sync Live Sheet**.

---

## 🌐 Deploy to Google Firebase Hosting (Free Tier)

You can host this entire web app on Google Firebase Hosting for free:

### Step 1: Install Firebase CLI & Login
```bash
npm install -g firebase-tools
firebase login
```

### Step 2: Initialize / Link Firebase Project
```bash
firebase init hosting
```
- Select **Use an existing project** (or create a new one on [Firebase Console](https://console.firebase.google.com)).
- Set public directory to: **`.output/public`** (or `dist` if building standard static SPA).
- Configure as single-page app (rewrite all urls to `/index.html`): **Yes (`Y`)**.
- Set up automatic builds with GitHub: **Optional (`N` or `Y`)**.

### Step 3: Build & Deploy
```bash
# Build the production bundle
npm run build

# Deploy to Firebase Hosting
firebase deploy --only hosting
```
Your website will be live with a free SSL certificate on `https://<your-project-id>.web.app`.

---

## 🐙 Push Code to GitHub

To store your project code securely on GitHub:

```bash
# 1. Initialize Git repository
git init

# 2. Stage all files (respects .gitignore)
git add .

# 3. Create your initial commit
git commit -m "feat: NRB World Event Portal with Dark Navy UI, Code 128 scanner, audio cues, and Firebase config"

# 4. Link your remote GitHub repository
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo-name>.git

# 5. Push code to GitHub
git push -u origin main
```

---

## 🛠 Project Structure

- `logo/` & `public/logo.png` — NRB World Event official branding logo.
- `src/components/checkin/` — Scanner view, result overlay, and walk-up registration form.
- `src/components/layout/` — Responsive header, navy branding, sound/theme toggles, and bottom navigation.
- `src/lib/audio/` — Low-latency browser Web Audio synthesizer (`sounds.ts`).
- `src/lib/barcode/` — Pure vector Code 128 barcode encoder & SVG generator.
- `src/lib/api/` — Google Apps Script client and local demo mock store.
- `src/routes/` — Check-in (`/`), Barcode Generator (`/generator`), Live Dashboard (`/dashboard`), and Cloud Setup (`/setup`).
- `apps-script/Code.gs` — Google Apps Script backend code with thread-safe LockService.
- `firebase.json` & `.firebaserc` — Google Firebase Hosting deployment rules.

---

## 📄 License
Created for **NRB World Event**. Free to use and customize for event management.
