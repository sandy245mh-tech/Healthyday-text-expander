# Cloud Text Expander — V1 Product Build Specification

## Purpose

Build a clean, production-ready Chrome Extension text expander from scratch.

The goal of V1 is to provide a simple text-expansion system with:

- Personal cans (private to the user)
- Organization cans (managed by Admin and shared with all users)
- Cloud synchronization
- Admin/Agent role separation
- Notifications when organization cans are published or updated
- A simple UI that is fast and easy to maintain

The application must prioritize **simplicity, reliability, maintainability, and easy deployment** over unnecessary features.

---

# 1. Product Concept

The product is a Chrome Extension that allows users to save reusable text snippets called **Cans**.

Example:

Shortcut:

`refund1`

Expanded text:

`Thank you for contacting us. I understand your concern regarding the refund...`

Users should be able to search, select, and use cans directly from the extension.

There are only two roles:

1. **Agent**
2. **Admin**

---

# 2. Core Roles

## Agent

An Agent can:

- Sign in
- Create personal cans
- Edit personal cans
- Delete personal cans
- Search personal cans
- Use personal cans
- View organization cans
- Search organization cans
- Use organization cans
- Receive notifications about newly published/updated organization cans
- Sync their data with the cloud

Agents cannot:

- Create organization cans
- Edit organization cans
- Delete organization cans
- Publish organization cans

---

## Admin

An Admin can do everything an Agent can do, plus:

### Personal cans

- Create personal cans
- Edit personal cans
- Delete personal cans
- Search/use personal cans

### Organization cans

- Create organization cans
- Edit organization cans
- Delete organization cans
- Save organization cans as drafts
- Publish organization cans
- Update published organization cans
- Search/use organization cans

The Admin UI must clearly separate:

- **My Cans**
- **Organization Cans**

---

# 3. Can Types

There are only two can scopes.

## Personal Can

Owned by the current user.

Example:

```text
Scope: PERSONAL
Owner: Agent 01
Shortcut: hello1
Text: Hello, thank you for contacting us...
```

Only the owner can modify it.

---

## Organization Can

Owned by the organization and managed by Admins.

Example:

```text
Scope: ORGANIZATION
Created by: Admin
Shortcut: refund1
Text: Your refund has been initiated...
Status: PUBLISHED
```

All users in the organization can view and use published organization cans.

---

# 4. Organization Can Lifecycle

Organization cans should have a simple lifecycle:

```text
DRAFT
   ↓
PUBLISHED
   ↓
UPDATED
   ↓
PUBLISHED
```

An Admin should be able to create/edit a draft without immediately exposing it to Agents.

Only when the Admin clicks:

**Publish**

should the can become available to users.

Example:

```text
Payment Follow-up

Status: Draft

[Save Draft]    [Publish]
```

After publishing:

```text
Payment Follow-up

Status: Published

[Edit]    [Delete]
```

When an already published can is edited:

```text
Published Can
      ↓
Admin edits
      ↓
Save/Publish
      ↓
Updated organization can
      ↓
Users sync
      ↓
Notification
```

---

# 5. Main User Experience

## Agent Extension UI

The extension should be extremely simple.

Suggested structure:

```text
┌─────────────────────────────────┐
│  Text Expander                  │
│                                 │
│  🔍 Search cans...              │
│                                 │
│  MY CANS                         │
│  ┌────────┐ ┌────────┐          │
│  │Hello   │ │Refund  │          │
│  │hello1  │ │refund1 │          │
│  └────────┘ └────────┘          │
│                                 │
│  ORGANIZATION                   │
│  ┌────────┐ ┌────────┐          │
│  │Welcome │ │Payment │          │
│  │welcome │ │payment │          │
│  └────────┘ └────────┘          │
│                                 │
│  🔔 Notifications               │
│  ⚙ Settings                    │
└─────────────────────────────────┘
```

Do NOT create a long vertical list of large cards.

Prefer a compact responsive grid.

Desktop extension layouts should show multiple cans side-by-side where possible.

---

# 6. Admin Dashboard

The Admin dashboard should have two primary sections.

```text
Dashboard

┌─────────────────────┬──────────────────────────┐
│ My Cans             │ Organization Cans        │
│                     │                          │
│ + New Can           │ + New Organization Can   │
│                     │                          │
│ [Can] [Can] [Can]   │ [Can] [Can] [Can]       │
│ [Can] [Can]         │ [Can] [Can]             │
└─────────────────────┴──────────────────────────┘
```

Do not create unnecessary navigation.

Recommended navigation:

```text
Dashboard
My Cans
Organization Cans
Notifications
Settings
```

---

# 7. Can Data Model

Design the database around a simple Can model.

Suggested fields:

```text
id
shortcut
title
content
scope
status
ownerId
createdBy
createdAt
updatedAt
publishedAt
organizationId
```

Where:

```text
scope:
PERSONAL
ORGANIZATION
```

And:

```text
status:
DRAFT
PUBLISHED
```

Do not add unnecessary fields unless the implementation genuinely requires them.

---

# 8. Authentication

Authentication must support:

- Login
- Logout
- Session/token handling
- Role identification
- Organization identification

Every authenticated user should have:

```text
userId
name
email
role
organizationId
```

Role values:

```text
AGENT
ADMIN
```

Backend authorization must enforce permissions.

Do not rely only on frontend UI hiding buttons.

---

# 9. Backend Architecture

Use a clean API-driven architecture.

Recommended flow:

```text
Chrome Extension
       │
       ▼
     API
       │
       ▼
 Backend
       │
       ▼
 Database
```

The Chrome Extension must not directly manage organization database records.

The backend should be the source of truth.

---

# 10. API Requirements

Create clean REST-style endpoints.

Example structure:

```text
POST   /auth/login
POST   /auth/logout
GET    /auth/me

GET    /cans
POST   /cans
GET    /cans/:id
PUT    /cans/:id
DELETE /cans/:id

GET    /organization/cans
POST   /organization/cans
PUT    /organization/cans/:id
DELETE /organization/cans/:id

POST   /organization/cans/:id/publish

GET    /notifications
POST   /notifications/:id/read
```

These are examples, not mandatory exact paths. Keep the final API consistent and RESTful.

---

# 11. Cloud Synchronization

Cloud synchronization is a core feature.

The database should be the source of truth.

For personal cans:

```text
User creates can
      ↓
API
      ↓
Database
      ↓
Extension receives updated data
```

For organization cans:

```text
Admin creates/updates can
      ↓
Publish
      ↓
Database
      ↓
Organization version changes
      ↓
Agents sync
      ↓
Updated cans available
```

The extension should be able to refresh/synchronize cans without requiring reinstall.

---

# 12. Sync Strategy

For V1, prefer a simple reliable synchronization strategy.

Do NOT introduce WebSockets or complicated real-time infrastructure unless required.

A practical V1 approach:

- Fetch data when extension opens
- Fetch/refresh after login
- Provide a manual refresh option
- Periodically check for organization updates if appropriate
- Store a local cached copy for fast access
- Update local cache when cloud data changes

Use a simple version/timestamp mechanism.

Example:

```text
organizationVersion = 15

Agent local version = 14

14 != 15
    ↓
Fetch organization cans
    ↓
Update local cache
    ↓
Show notification
    ↓
Local version = 15
```

This keeps synchronization easy to debug.

---

# 13. Notifications

Notifications are required for organization can changes.

Examples:

```text
🔔 New organization can added

"Payment Follow-up"
```

or:

```text
🔔 Organization can updated

"Refund Process"
```

Notification should contain:

- Type
- Message
- Related can ID
- Created time
- Read/unread state

Keep notifications simple.

---

# 14. Text Expansion Engine

This is the most important extension functionality.

A can contains:

```text
Shortcut
Content
```

Example:

```text
Shortcut:
hello1

Content:
Hello, thank you for contacting our support team.
How may I help you today?
```

When the user types:

```text
hello1
```

the extension should detect the shortcut and replace it with the saved content.

The implementation must work reliably in common text fields such as:

- `<input>`
- `<textarea>`
- `contenteditable`
- Common web-based support/chat applications where technically possible

Do not assume every website behaves identically.

Build the expansion engine modularly so website-specific compatibility fixes can be added later.

---

# 15. Shortcut Collision Rules

If the same shortcut exists in both personal and organization cans, define a deterministic rule.

Recommended V1 behavior:

```text
Personal can > Organization can
```

Example:

```text
Personal:
refund1 → Personal refund message

Organization:
refund1 → Standard company refund message
```

The user's personal can should be used.

However, the UI should make duplicate shortcuts easy to identify.

Do not silently create unpredictable behavior.

---

# 16. Search

Search must be fast.

Search should support:

- Can title
- Shortcut
- Content

Example:

```text
Search: refund

Results:

[Refund Request]
shortcut: refund1

[Refund Delay]
shortcut: refunddelay

[Refund Policy]
shortcut: refundpolicy
```

Use debounced search if necessary.

---

# 17. Local Storage / Cache

Use Chrome extension storage for local cached data and settings where appropriate.

Suggested local information:

```text
auth/session information as safely supported
cached personal cans
cached organization cans
last organization version
notification state
user preferences
```

Do not treat local storage as the permanent source of truth for cloud data.

---

# 18. Chrome Extension Architecture

Use a modern Manifest V3 architecture.

Recommended conceptual structure:

```text
extension/
│
├── manifest
├── background/
├── content/
├── popup/
├── options/
├── components/
├── services/
├── storage/
├── api/
├── utils/
└── assets/
```

Exact structure can be adjusted if the chosen framework requires it.

Keep responsibilities separated.

For example:

```text
UI
 ↓
Service layer
 ↓
API/storage
```

Avoid putting business logic directly inside UI components.

---

# 19. Backend Project Structure

Keep backend modules separated by responsibility.

Example:

```text
backend/
│
├── auth/
├── users/
├── cans/
├── organization/
├── notifications/
├── database/
├── middleware/
├── routes/
├── services/
├── models/
├── schemas/
└── config/
```

Do not over-engineer the backend.

---

# 20. Error Handling

Every API request must handle:

- Network failure
- Unauthorized user
- Expired session
- Not found
- Validation errors
- Server errors

User-facing errors should be simple.

Examples:

```text
Unable to save can.
Please try again.
```

```text
Your session has expired.
Please sign in again.
```

```text
Unable to sync organization cans.
Try again.
```

Developer errors should be logged with enough context for debugging.

Never expose sensitive server details to users.

---

# 21. Loading States

Every asynchronous UI action needs a proper loading state.

Examples:

```text
Saving...
Publishing...
Syncing...
Deleting...
```

Prevent duplicate submissions while an operation is in progress.

---

# 22. Empty States

Design useful empty states.

Example:

```text
No personal cans yet.

Create your first can to start expanding text.

[+ Create Can]
```

Organization:

```text
No organization cans available.
```

Admin:

```text
No organization cans created yet.

[+ Create Organization Can]
```

---

# 23. UI/UX Requirements

The UI should be:

- Modern
- Clean
- Compact
- Fast
- Responsive
- Accessible
- Easy for non-technical users
- Visually different from generic CRUD dashboards

Avoid:

- Huge cards
- Excessive gradients
- Too many colors
- Complex sidebars
- Unnecessary animations
- Deep navigation
- Information overload

Use a consistent design system.

The extension should prioritize usability over visual decoration.

---

# 24. Security

Implement basic production security from the beginning.

Requirements:

- Backend authorization for Admin operations
- Validate all input
- Sanitize user-provided content where necessary
- Never trust role values sent by the client
- Protect organization data from cross-organization access
- Secure authentication tokens/session handling
- Do not expose database credentials in the extension
- Do not expose private environment variables in frontend builds
- Use HTTPS in production

Critical rule:

**An Agent must never be able to call an Admin API successfully just by modifying frontend requests.**

---

# 25. Organization Isolation

Every organization-owned record must be associated with an organization.

Example:

```text
organizationId = org_001
```

An Admin from:

```text
org_001
```

must not be able to access:

```text
org_002
```

Agents must only receive organization cans belonging to their own organization.

This must be enforced on the backend.

---

# 26. Deployment Philosophy

The system must be designed for simple deployment.

Separate:

```text
Chrome Extension
Backend
Database
```

Keep environment configuration explicit.

Example:

```text
Development
Production
```

Never hardcode production URLs throughout the codebase.

Use environment variables/configuration.

---

# 27. Development Phases

The project must be built in the following phases.

Do not skip phases.

Each phase must be tested before moving to the next.

---

## PHASE 0 — Project Planning

### Tasks

- [ ] Confirm final V1 requirements
- [ ] Confirm technology stack
- [ ] Define repository structure
- [ ] Define environment variables
- [ ] Define database strategy
- [ ] Define API contract
- [ ] Define authentication approach
- [ ] Define Chrome extension architecture

### Completion criteria

The architecture is documented and there are no major unknowns before coding starts.

---

# PHASE 1 — Project Foundation

### Tasks

- [ ] Create clean repository
- [ ] Create extension project
- [ ] Create backend project
- [ ] Configure package management
- [ ] Configure linting/formatting
- [ ] Configure environment files
- [ ] Configure Git
- [ ] Create development README
- [ ] Create `.gitignore`
- [ ] Create basic health-check endpoint
- [ ] Load extension successfully in Chrome

### Completion criteria

```text
Chrome Extension → Loads successfully
Backend → Runs successfully
API → Responds successfully
```

---

# PHASE 2 — Extension UI Shell

### Tasks

- [ ] Build extension popup
- [ ] Build search UI
- [ ] Build My Cans section
- [ ] Build Organization Cans section
- [ ] Build can card
- [ ] Build create/edit can UI
- [ ] Build settings UI
- [ ] Build notification UI
- [ ] Build loading states
- [ ] Build empty states
- [ ] Build error states

### Completion criteria

The entire extension UI works with mock/local data.

No backend dependency is required yet.

---

# PHASE 3 — Local Text Expander

### Tasks

- [ ] Create local can storage
- [ ] Create shortcut detection
- [ ] Implement text replacement
- [ ] Support input
- [ ] Support textarea
- [ ] Support contenteditable where possible
- [ ] Handle cursor position
- [ ] Handle multi-line text
- [ ] Handle duplicate shortcuts
- [ ] Handle special characters
- [ ] Test on multiple websites

### Completion criteria

A user can create:

```text
hello1
```

and type it into a supported website to expand the correct text.

---

# PHASE 4 — Authentication

### Tasks

- [ ] Build login UI
- [ ] Build authentication API
- [ ] Implement session/token handling
- [ ] Implement logout
- [ ] Implement current-user endpoint
- [ ] Identify Agent/Admin role
- [ ] Handle expired sessions
- [ ] Protect backend routes

### Completion criteria

Both roles can authenticate successfully.

---

# PHASE 5 — Personal Cans

### Tasks

- [ ] Create personal can API
- [ ] Read personal cans
- [ ] Update personal cans
- [ ] Delete personal cans
- [ ] Connect extension to API
- [ ] Sync personal cans
- [ ] Cache personal cans locally
- [ ] Add search
- [ ] Add validation
- [ ] Add error handling

### Completion criteria

An Agent can fully manage their personal cans from the extension.

---

# PHASE 6 — Admin Personal Cans

### Tasks

- [ ] Allow Admin to manage personal cans
- [ ] Reuse existing personal can workflow
- [ ] Verify Admin data isolation
- [ ] Test Agent/Admin behavior

### Completion criteria

Admin personal cans behave exactly like Agent personal cans.

---

# PHASE 7 — Organization Cans

### Tasks

- [ ] Create organization can model
- [ ] Create organization can API
- [ ] Add Admin-only authorization
- [ ] Create draft state
- [ ] Create publish action
- [ ] Create update action
- [ ] Create delete action
- [ ] Add Organization Cans UI
- [ ] Display organization cans to Agents

### Completion criteria

Admin can:

```text
Create draft
   ↓
Edit
   ↓
Publish
   ↓
Agents can see/use it
```

---

# PHASE 8 — Cloud Synchronization

### Tasks

- [ ] Implement organization version/timestamp
- [ ] Implement sync endpoint
- [ ] Store local version
- [ ] Detect changes
- [ ] Fetch changed organization cans
- [ ] Update local cache
- [ ] Handle offline state
- [ ] Add manual refresh
- [ ] Add automatic refresh/check if appropriate

### Completion criteria

When Admin publishes a can:

```text
Admin
 ↓
Cloud
 ↓
Agent sync
 ↓
Agent sees updated can
```

No reinstall should be required.

---

# PHASE 9 — Notifications

### Tasks

- [ ] Create notification model
- [ ] Create notification API
- [ ] Generate notification when organization can is published
- [ ] Generate notification when organization can is updated
- [ ] Show unread count
- [ ] Show notification list
- [ ] Mark notification as read
- [ ] Link notification to can
- [ ] Test multiple users

### Completion criteria

Admin publishes a can and Agents receive a visible notification after synchronization.

---

# PHASE 10 — Complete Text Expander Integration

### Tasks

- [ ] Use synced personal cans
- [ ] Use synced organization cans
- [ ] Apply shortcut priority rule
- [ ] Test duplicate shortcuts
- [ ] Test editing/deleting cans
- [ ] Test stale cache
- [ ] Test sync while extension is open
- [ ] Test sync after extension restart

### Completion criteria

The full system works end-to-end:

```text
Admin publishes can
        ↓
Cloud
        ↓
Agent sync
        ↓
Agent sees notification
        ↓
Agent searches can
        ↓
Agent uses shortcut
        ↓
Text expands
```

---

# PHASE 11 — Security & Reliability Testing

### Tasks

- [ ] Test unauthorized API requests
- [ ] Test Agent attempting Admin API
- [ ] Test cross-organization access
- [ ] Test expired session
- [ ] Test invalid input
- [ ] Test network failure
- [ ] Test database failure handling
- [ ] Test duplicate requests
- [ ] Test duplicate publishing
- [ ] Test concurrent edits where applicable
- [ ] Test extension restart
- [ ] Test browser restart

### Completion criteria

No obvious authorization or data-isolation vulnerability remains.

---

# PHASE 12 — Production Deployment

### Tasks

- [ ] Create production database
- [ ] Deploy backend
- [ ] Configure production environment variables
- [ ] Configure CORS correctly
- [ ] Configure HTTPS
- [ ] Connect extension to production API
- [ ] Build production extension
- [ ] Test production backend
- [ ] Test production extension
- [ ] Test authentication
- [ ] Test sync
- [ ] Test notifications
- [ ] Test text expansion

### Completion criteria

The complete system works in a production-like environment.

---

# PHASE 13 — Final QA

Run the following end-to-end test.

## Agent test

```text
[ ] Login
[ ] Create personal can
[ ] Edit personal can
[ ] Delete personal can
[ ] Search personal can
[ ] Use personal shortcut
[ ] View organization cans
[ ] Search organization cans
[ ] Use organization shortcut
[ ] Receive organization notification
[ ] Sync updated organization can
[ ] Logout
[ ] Login again
[ ] Verify data remains available
```

## Admin test

```text
[ ] Login
[ ] Create personal can
[ ] Edit personal can
[ ] Delete personal can

[ ] Create organization can
[ ] Save draft
[ ] Edit draft
[ ] Publish can
[ ] Update published can
[ ] Delete organization can

[ ] Verify Agent receives published can
[ ] Verify Agent receives update
```

## Security test

```text
[ ] Agent cannot create organization can
[ ] Agent cannot publish organization can
[ ] Agent cannot delete organization can
[ ] User cannot access another organization
[ ] Client cannot override role permissions
```

---

# 28. Definition of Done

V1 is complete only when all of the following work:

```text
✓ Agent login
✓ Admin login
✓ Personal cans
✓ Organization cans
✓ Admin-only organization management
✓ Draft/publish workflow
✓ Cloud database
✓ Cloud synchronization
✓ Notifications
✓ Text expansion
✓ Search
✓ Local caching
✓ Error handling
✓ Authentication
✓ Authorization
✓ Organization isolation
✓ Production deployment
```

---

# 29. Development Rules for AI Coding Assistants

When using an AI coding assistant, follow these rules strictly.

## Rule 1 — Do not build everything at once

Implement one phase at a time.

After each phase:

1. Run the application
2. Test the functionality
3. Fix errors
4. Confirm completion
5. Only then continue

---

## Rule 2 — Do not introduce unnecessary dependencies

Before installing a package, determine whether it is genuinely required.

Prefer simple, stable dependencies.

---

## Rule 3 — Do not over-engineer

If a feature can be implemented simply, implement it simply.

Do not introduce:

- Microservices
- Message queues
- WebSockets
- Complex state-management systems
- Event buses
- Unnecessary abstractions

unless the actual requirement demands them.

---

## Rule 4 — Keep frontend and backend responsibilities separate

Frontend:

```text
UI
User interaction
Local cache
Extension behavior
```

Backend:

```text
Authentication
Authorization
Business rules
Database
Organization access
Synchronization
Notifications
```

---

## Rule 5 — Never bypass authorization

Frontend hiding a button is NOT security.

Every protected backend operation must validate:

```text
authenticated user
+
role
+
organization
+
resource ownership
```

---

## Rule 6 — Explain changes

Whenever modifying an existing file, explain:

- What changed
- Why it changed
- What functionality it affects
- How to test it

---

## Rule 7 — Keep code readable

Prefer:

```text
small functions
clear names
simple modules
predictable data flow
```

Avoid clever code that is difficult to debug.

---

# 30. Progress Tracker

Use this section to track development.

```text
PHASE 0  ☐
PHASE 1  ☐
PHASE 2  ☐
PHASE 3  ☐
PHASE 4  ☐
PHASE 5  ☐
PHASE 6  ☐
PHASE 7  ☐
PHASE 8  ☐
PHASE 9  ☐
PHASE 10 ☐
PHASE 11 ☐
PHASE 12 ☐
PHASE 13 ☐
```

For every completed phase, record:

```text
Phase:
Status:
Date:
What was completed:
Known issues:
Next step:
```

---

# 31. Final Product Flow

The complete product should behave like this:

```text
                         ┌───────────────┐
                         │     LOGIN     │
                         └───────┬───────┘
                                 │
                       ┌─────────┴─────────┐
                       │                   │
                    AGENT                ADMIN
                       │                   │
              ┌────────┴────────┐   ┌─────┴──────────┐
              │                 │   │                │
          MY CANS         ORG CANS MY CANS     ORG CANS
              │                 │   │                │
              └────────┬────────┘   └───────┬────────┘
                       │                    │
                       │                    │
                       │              DRAFT → PUBLISH
                       │                    │
                       │                    ▼
                       │                  CLOUD
                       │                    │
                       │              ┌─────┴─────┐
                       │              │           │
                       │           SYNC       NOTIFICATION
                       │              │           │
                       └──────────────┴───────────┘
                                      │
                                      ▼
                              TEXT EXPANSION
                                      │
                                      ▼
                              USER'S WEBSITE
```

---

# 32. Product Principle

The most important principle for this project:

> **Simple to use. Simple to build. Simple to debug. Simple to deploy.**

Do not add complexity unless it solves a real V1 problem.

Build the smallest reliable version first, validate the complete workflow, and only then consider additional features.
