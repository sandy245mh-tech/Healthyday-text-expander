# Free Deployment Guide for Text‑Expander

> **Goal**: Deploy the entire **Text‑Expander** project (backend, database, and Chrome‑extension frontend) using **only free services**.

---

## 📚 Overview
| Component | Technology | Free Hosting Options |
|-----------|------------|----------------------|
| **Database** | Supabase (PostgreSQL) | **Supabase Free Tier** |
| **Backend API** | Node.js / Express (located in `backend/`) | **Render.com Web Service (Free)** – also works on Railway or Fly.io |
| **Frontend** | Chrome Extension (MV3) – `extension/` | **GitHub Releases** for zip distribution (free) – optional web‑dashboard on GitHub Pages / Netlify |

The guide walks you through each step, from creating a Supabase project to publishing the extension, all without spending a cent.

---

## 1️⃣ Set Up the Supabase Database (Free)
1. **Create a Supabase account** – go to https://app.supabase.com and sign up (free tier includes 500 MB storage, 500 MB bandwidth).
2. **Create a new project**
   - Choose a project name (e.g., `text‑expander-db`).
   - Select the default region closest to your users.
   - Click **Create new project**.
3. **Apply the schema**
   - In the Supabase dashboard, navigate to **SQL editor** → **New query**.
   - Open the file `supabase_schema.sql` from the repo (located at the project root) and copy its contents into the editor.
   - Click **Run** to create tables/relationships.
4. **Grab your credentials**
   - **API URL** → Settings → `API` → **Project URL** (e.g., `https://xyzcompany.supabase.co`).
   - **Anon/public key** → Settings → `API` → **public API key**.
   - (Optional) Create a **service‑role key** if your backend needs unrestricted access; store it securely.
5. **Add the keys to your backend** (see Step 2).

---

## 2️⃣ Deploy the Backend API for Free
### 2.1 Using Render (recommended – already has `render.yaml`)
1. **Push the code to GitHub** (if not already):
   ```bash
   cd d:\Text‑expander
   git init && git add . && git commit -m "initial commit"
   git remote add origin https://github.com/<YOUR_USERNAME>/text-expander.git
   git push -u origin master
   ```
2. **Create a Render account** – https://render.com (free tier provides 750 hrs/month).
3. **New Web Service** → Connect your GitHub repo → select the `master` (or `main`) branch.
4. **Render detects `render.yaml`** in the `backend/` folder and automatically fills:
   - **Build Command**: `npm install`
   - **Start Command**: `node src/app.js`
5. **Set Environment Variables** (Render > **Environment** > **Add Env Var**):
   - `PORT` – leave blank (Render provides it automatically).
   - `SUPABASE_URL` – the URL from Step 1.
   - `SUPABASE_KEY` – the anon key (or service‑role key) from Step 1.
   - `NODE_ENV` – `production`
6. Click **Create Web Service**. Render will build and launch the API. You’ll receive a URL like `https://text‑expander‑api.onrender.com`.

### 2.2 Keep‑alive (Render free tier sleeps after 15 min of inactivity)
Render’s free tier puts the service to sleep. To keep it awake **without paying**:
- Sign up at https://uptimerobot.com (free tier up to 50 monitors).
- Create an **HTTP(s) monitor** targeting `https://your‑api.onrender.com/health` (or any lightweight endpoint).
- Set the **monitor interval** to **5 minutes**.
- Optionally, add a Cron‑job.org ping if you prefer Cron‑based pings.

> The ping costs virtually nothing and guarantees the service stays awake during active usage.

---

## 3️⃣ Configure the Chrome Extension (Frontend)
### 3.1 Update the API Base URL
The extension reads the API base from Chrome storage (`chrome.storage.local`). For a quick production switch:
1. Open the extension’s **Options page** (`extension/options/options.html`).
2. Locate the **Server URL** field (element id `setting-server-url`).
3. Replace `http://localhost:3001` with the Render URL from Step 2 (e.g., `https://text‑expander‑api.onrender.com`).
4. Click **Save** – the extension now talks to the live backend.

> **Tip**: If you want the URL baked into the code (so users don’t need to edit settings), change the constant `DEFAULT_API_BASE` in:
- `extension/api/apiClient.js`
- `extension/background/service-worker.js`
   ```js
   const DEFAULT_API_BASE = "https://text‑expander‑api.onrender.com";
   ```
   Re‑build the extension zip (see below).

### 3.2 Package the Extension (Free distribution)
1. **Build the zip** (run from project root):
   ```bash
   cd d:\Text‑expander\extension
   zip -r ../TextExpander‑v1.0.0.zip *
   ```
   (On Windows you can use PowerShell `Compress-Archive . -DestinationPath ..\TextExpander‑v1.0.0.zip`.)
2. **Create a GitHub Release**
   - Go to your GitHub repo → **Releases** → **Draft a new release**.
   - Tag it (e.g., `v1.0.0`) and upload the `TextExpander‑v1.0.0.zip` asset.
3. **Distribute**
   - **Developer‑mode install**: Users can download the zip, unzip, then go to `chrome://extensions`, enable *Developer mode*, click **Load unpacked**, and select the folder.
   - **Chrome Web Store** (optional): Requires a one‑time $5 developer registration, but the extension itself can still be free for users.

### 3.3 Optional: Host the Options Dashboard as a Web App
If you want a stand‑alone web UI (e.g., for users without Chrome), you can host the `extension/options/` folder:
- **GitHub Pages** – push the folder to a `gh-pages` branch.
- **Netlify** – drag‑and‑drop the folder in the Netlify UI (free tier).
- **Vercel** – import the folder as a static site (free tier).
The hosted page will still call the same backend API URL, so make sure the URL is correct.

---

## ✅ Checklist
- [ ] **Supabase** – project created, schema applied, keys saved.
- [ ] **Render** – repo linked, service deployed, env vars set, health endpoint reachable.
- [ ] **UptimeRobot** – monitor configured for `/health`.
- [ ] **Extension** – API base URL updated (options page or code).
- [ ] **Extension zip** – built and uploaded to GitHub Releases.
- [ ] **(Optional) Dashboard** – hosted on GitHub Pages / Netlify / Vercel.

---

## 📌 Common Gotchas & Tips
- **CORS** – Render automatically adds `Access‑Control‑Allow‑Origin: *`. If you switch to another host, ensure CORS headers allow requests from `chrome-extension://*`.
- **Environment Variables** – never commit your Supabase service‑role key to the repo. Keep it only in Render’s env settings.
- **Sleeping Backend** – the first request after a sleep may take a few seconds; inform users via a loading spinner.
- **Extension Updates** – bump the version in `manifest.json` and upload a new zip to GitHub Releases for users to manually update.
- **Debugging** – open Chrome’s Extension console (`chrome://extensions → Inspect views`) to see API errors.

---

## 🎉 You’re Live!
Your Text‑Expander app is now publicly accessible:
- **API** – `https://text‑expander‑api.onrender.com`
- **Chrome Extension** – installed via the zip you uploaded.
- **Database** – managed securely on Supabase.
Enjoy a fully‑free, scalable deployment.

---

*Created by Antigravity – your AI coding companion.*
