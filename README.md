# ⚡ Cloud Text Expander

A modern, cloud-synchronized Chrome Extension (Manifest V3) and Express/Supabase backend that allows users to save and expand reusable text snippets (**Cans**).

---

## 🌟 Key Features

- **Real-Time Keystroke Expansion**: Type shortcuts (e.g., `refund1`, `greet`) followed by `Space` or `Enter` in any `<input>`, `<textarea>`, or `contenteditable` field to expand them instantly.
- **Two Scopes of Cans**:
  - **Personal Cans**: Private snippets owned and managed by the individual user.
  - **Organization Cans**: Company-wide snippets managed, drafted, and published by Admins for all Agents to use.
- **Role Separation**:
  - **Agent**: Manage personal cans, search & use organization cans, receive update notifications.
  - **Admin**: Manage personal cans, create/draft/publish/update/delete organization cans.
- **Instant Cloud Sync**: Uses Supabase (PostgreSQL) for scalable cloud persistence and synchronization.
- **Real-time Notifications**: Alert team members whenever an organization can is published or updated.

---

## 🏗️ Project Structure

```text
Text-expander/
├── backend/                       # Node.js + Express API
│   ├── src/
│   │   ├── app.js                 # Express app & route mounting
│   │   ├── cans/                  # Personal cans controller & routes
│   │   ├── organization/          # Org cans controller & routes (Admin-only actions)
│   │   ├── notifications/         # Notifications controller & routes
│   │   ├── middleware/            # Auth & global error handling
│   │   └── config/                # Environment & Supabase client setup
│   ├── .env                       # Backend environment variables
│   ├── supabase_schema.sql        # Database tables, triggers, and RLS policies
│   └── package.json
│
├── extension/                     # Chrome Extension (Manifest V3)
│   ├── manifest.json              # Extension manifest configuration
│   ├── popup/                     # Main extension UI (HTML, CSS, JS)
│   ├── content/                   # Content script for in-page text expansion
│   ├── background/                # Background service worker
│   ├── api/                       # Client HTTP wrapper with custom auth headers
│   └── assets/                    # Icons and images
│
├── History.md                     # Development changelog
└── README.md                      # Setup & running instructions
```

---

## 📋 Prerequisites

Before running the project, make sure you have:

1. **Node.js** (version 18 or newer) — [Download Node.js](https://nodejs.org/)
2. **Google Chrome** (or Chromium-based browser like Brave, Edge, Opera)
3. A free **Supabase Account** — [Supabase Signup](https://supabase.com/)

---

## 🚀 Getting Started

Follow these 3 steps to run the complete project:

### Step 1: Set Up the Supabase Database

1. Log into your [Supabase Dashboard](https://supabase.com/dashboard) and create a new project (or use an existing one).
2. Open the **SQL Editor** from the left navigation bar in your Supabase project.
3. Open the file [`backend/supabase_schema.sql`](file:///d:/Text-expander/backend/supabase_schema.sql) in this repository, copy its entire contents, paste it into the Supabase SQL editor, and click **Run**.
   - This creates the `cans` and `notifications` tables, updated-at triggers, performance indexes, and configures Row-Level Security (RLS) policies.
4. Go to **Project Settings** → **API** in Supabase and copy:
   - **Project URL** (e.g., `https://xyzcompany.supabase.co`)
   - **API Key** (Use either the `service_role` secret key for backend, or the `anon` / `publishable` public key).

---

### Step 2: Configure & Start the Backend

1. Open your terminal and navigate to the `backend` directory:
   ```bash
   cd d:\Text-expander\backend
   ```

2. Install backend dependencies (if not already installed):
   ```bash
   npm install
   ```

3. Configure your environment variables in [`backend/.env`](file:///d:/Text-expander/backend/.env):
   ```env
   PORT=3001
   NODE_ENV=development
   
   # Paste your Supabase Project URL and API Key
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_KEY=your-supabase-key-here
   
   CORS_ORIGIN=*
   ```
   > **Note:** The backend automatically handles either full URLs (`https://...supabase.co`) or raw project reference IDs (e.g. `exdqevqvassejkgxdsch`).

4. Start the server:
   - **For Development** (with auto-reload on file changes):
     ```bash
     npm run dev
     ```
   - **Standard Start**:
     ```bash
     npm start
     ```

5. Verify that the server is running:
   - Open your browser or run:
     ```bash
     curl http://localhost:3001/health
     ```
   - You should receive:
     ```json
     {"success":true,"message":"Cloud Text Expander API is running","data":{"status":"ok",...}}
     ```

---

### Step 3: Install the Chrome Extension

1. Open **Google Chrome** and type the following into the URL address bar:
   ```text
   chrome://extensions/
   ```
2. In the top-right corner, toggle **Developer mode** to **ON**.
3. Click the **Load unpacked** button in the top-left corner.
4. In the folder picker dialog, select the `extension` directory:
   ```text
   d:\Text-expander\extension
   ```
5. The **Cloud Text Expander** extension is now installed!
6. Click the puzzle icon 🧩 in Chrome's toolbar and **pin** 📌 "Cloud Text Expander" for easy access.

---

## 💡 How to Use

### 1. Setting Up Your Identity
1. Click the **Cloud Text Expander** icon in your browser toolbar.
2. Enter your **Name** (e.g., `Alice` or `Bob`).
3. Select your **Role**:
   - Select **Agent** for standard agent usage.
   - Select **Admin** to access organization can drafting and publishing.
4. Click **Sign In**.

### 2. Creating & Managing Cans
- **Personal Can**: Click **+ New** under the **MY CANS** section.
  - Enter a **Title** (e.g., `Hello Greeting`).
  - Enter a **Shortcut** (e.g., `hello1` — lowercase, no spaces).
  - Enter the expanded **Content**.
  - Click **Save**.
- **Organization Can (Admin Only)**:
  - When logged in as **Admin**, click **+ New** under the **ORGANIZATION** section.
  - Fill in the details and save. It will initially be created with `(Draft)` status.
  - Click the rocket button (🚀) on the card to **Publish** it to all team members.

### 3. Expanding Text on Any Webpage
1. Navigate to any website (e.g., Gmail, Google Docs, Notion, Slack, Twitter, or any web input form).
   > *Note: If you had tabs open prior to loading the extension, refresh those tabs once so the content script is active.*
2. Click into any `<textarea>`, `<input type="text">`, or `contenteditable` container.
3. Type your shortcut (e.g., `hello1`) followed by pressing either **Space** or **Enter**.
4. The shortcut text is automatically deleted and replaced with your expanded snippet!

### 4. Search & Quick Copy
- Type in the top search bar to filter cans across both Personal and Organization lists by Title, Shortcut, or Content.
- Click any can card to copy its content directly to your clipboard.

### 5. Notifications
- When an Admin publishes or updates an organization can, a notification badge appears on the bell icon (🔔).
- Click the bell icon to view changes and mark notifications as read.

---

## 🛠️ Troubleshooting & FAQ

### 1. "new row violates row-level security policy for table 'cans'"
If you encounter this when creating a can, Row-Level Security is blocking insertions from the public API key. Run this SQL snippet in **Supabase Dashboard → SQL Editor**:
```sql
ALTER TABLE cans DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
```
Alternatively, copy the `service_role` secret key from **Supabase Dashboard → Project Settings → API** and set it as `SUPABASE_KEY` in `backend/.env`.

### 2. "Shortcut does not expand on webpage"
- **Refresh the webpage**: Content scripts only inject into tabs opened or refreshed after the extension was loaded.
- **Check shortcut casing**: Shortcuts are case-insensitive and stripped of whitespace (e.g., typing `hello1 ` expands shortcut `hello1`).
- **Trigger key**: Be sure to press `Space` or `Enter` immediately after typing the shortcut.

### 3. "Port 3001 already in use"
Change `PORT=3002` in `backend/.env` and update `const API_BASE = 'http://localhost:3002'` in `extension/api/apiClient.js`.

---

## 📄 License
ISC
