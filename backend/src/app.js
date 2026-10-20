const express = require('express');
const cors = require('cors');
const { PORT, CORS_ORIGIN, NODE_ENV } = require('./config/env');
const { errorHandler } = require('./middleware/errorHandler');
const healthRouter = require('./routes/health');

const app = express();

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({
  origin: CORS_ORIGIN,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-name', 'x-user-role'],
  credentials: true,
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Routes ──────────────────────────────────────────────────────────────────
app.use('/', healthRouter);

// Routes configured per phase
// app.use('/auth',         require('./auth/auth.routes')); // Removed in Supabase migration
app.use('/cans',         require('./cans/cans.routes'));
app.use('/organization', require('./organization/org.routes'));
app.use('/notifications',require('./notifications/notifications.routes'));

// ── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ── Global Error Handler ─────────────────────────────────────────────────────
app.use(errorHandler);

// ── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ Cloud Text Expander API running on http://localhost:${PORT}`);
  console.log(`   Environment: ${NODE_ENV}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
