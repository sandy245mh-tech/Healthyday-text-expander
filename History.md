# Project History

## Phase 1: Core Setup
- Created Extension structure (popup, options, background, content script)
- Built Backend API using Express and Prisma
- Implemented JWT-based authentication
- Implemented Cans, Organization, and Notifications modules
- Wired frontend Extension to communicate with Backend API
- Built Text Expansion engine to perform real-time keystroke tracking and DOM replacement in `content.js`

## Phase 2: Architecture Simplification
- **Storage Migration**: Removed Prisma and PostgreSQL in favor of Supabase.
- **Auth Removal**: Removed JWT authentication and passwords. Users now simply specify their Name and Role (Agent/Admin) to identify themselves. The extension sends these as `x-user-name` and `x-user-role` headers to the backend.

## Phase 3: Supabase Integration & Admin Organization UI
- **URL & Config Normalization**: Handled both raw Supabase project refs (`<id>`) and full URLs (`https://<id>.supabase.co`) in [env.js](file:///d:/Text-expander/backend/src/config/env.js).
- **Cleanup**: Removed obsolete [prisma.js](file:///d:/Text-expander/backend/src/config/prisma.js) and updated [errorHandler.js](file:///d:/Text-expander/backend/src/middleware/errorHandler.js) to catch PostgreSQL / Supabase errors (e.g. `23505`, `42501`).
- **RLS Policy Script**: Updated [supabase_schema.sql](file:///d:/Text-expander/backend/supabase_schema.sql) with clear instructions and SQL policies to resolve Row-Level Security permission issues.
- **Admin Org Can Flow**: Added `+ New` organization can creation button in [popup.html](file:///d:/Text-expander/extension/popup/popup.html) and hooked up admin event handlers in [popup.js](file:///d:/Text-expander/extension/popup/popup.js).
