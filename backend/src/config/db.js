require('dotenv').config(); // must run before reading process.env
const { createClient } = require('@supabase/supabase-js');

const { SUPABASE_URL, SUPABASE_KEY } = require('./env');

const isConfigured = SUPABASE_URL && SUPABASE_KEY
  && SUPABASE_URL.startsWith('https://');

if (!isConfigured) {
  console.warn('⚠️  SUPABASE_URL / SUPABASE_KEY not set in .env — paste your Supabase Project URL & anon key, then restart.');
}

// Use a lazy proxy so the server starts even without credentials.
// Any actual DB call will throw a clear error if credentials are missing.
const supabase = isConfigured
  ? createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : new Proxy({}, {
      get: () => () => {
        throw new Error('Supabase is not configured. Add SUPABASE_URL and SUPABASE_KEY to backend/.env');
      },
    });

if (isConfigured) {
  console.log(`🔗 Supabase connected → ${SUPABASE_URL.slice(0, 35)}…`);
}

module.exports = supabase;
