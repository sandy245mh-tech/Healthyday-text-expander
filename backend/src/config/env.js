require('dotenv').config();

let supabaseUrl = process.env.SUPABASE_URL ? process.env.SUPABASE_URL.trim() : '';
if (supabaseUrl && !supabaseUrl.startsWith('http://') && !supabaseUrl.startsWith('https://')) {
  supabaseUrl = `https://${supabaseUrl}.supabase.co`;
}

module.exports = {
  PORT: process.env.PORT || 3001,
  NODE_ENV: process.env.NODE_ENV || 'development',
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  SUPABASE_URL: supabaseUrl,
  SUPABASE_KEY: process.env.SUPABASE_KEY ? process.env.SUPABASE_KEY.trim() : '',
};
