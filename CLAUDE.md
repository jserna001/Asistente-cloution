# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**asistente-ia-nuevo** is a personal AI assistant application built with **Next.js 16** and **TypeScript 5.9**, featuring:
- Multi-service integration (Google, Notion, Gmail, Calendar)
- ReAct agent pattern for multi-step task reasoning
- RAG (Retrieval-Augmented Generation) for semantic memory
- Headless browser automation for web tasks
- Secure encrypted token management with AES-256-GCM
- Supabase PostgreSQL backend with Row-Level Security

## Common Development Commands

```bash
# Install dependencies
npm install

# Development server (with Turbopack enabled)
npm run dev

# Development without Turbopack (troubleshooting)
npm run dev -- --no-turbo

# Build for production
npm run build

# Run production server
npm run start

# Lint code
npm run lint

# Run TypeScript scripts (custom background jobs)
npx tsx scripts/generate-summary.ts      # Daily summary generation
npx tsx scripts/ingest-gmail.ts          # Gmail data ingestion
npx tsx scripts/ingest-notion.ts         # Notion data ingestion
npx tsx scripts/test-token.ts            # Token encryption/decryption testing
npx tsx scripts/test-notion-write.ts     # Notion write operations testing
```

## Architecture Overview

### High-Level Flow

```
User Input
    ↓
Authentication (Google OAuth 2.0 → Supabase)
    ↓
POST /api/chat with Bearer token
    ↓
RAG Service (vector search in document_chunks table)
    ↓
Gemini 2.5 Pro ReAct Agent Loop (max 5 iterations)
    ├─ Gemini analyzes query + RAG context
    ├─ Decides which tool to call:
    │   ├─ browser.* tools (calls browser-service microservice)
    │   ├─ api.add_task_to_notion (Notion integration)
    │   └─ Return answer directly (from RAG)
    └─ Executes tool and continues loop
    ↓
Response to user
```

### Directory Structure

```
/app                          # Next.js App Router
├── /api/auth/google/         # Google OAuth 2.0 endpoints
├── /api/chat                 # ReAct agent orchestration
├── /login                    # Login page
├── /settings                 # User settings
└── page.tsx                  # Main chat interface (Client Component)

/lib                          # Shared utilities
├── supabaseClient.ts         # Supabase client factory
├── googleAuth.ts             # Google OAuth config
├── browserService.ts         # Browser automation orchestrator
├── ragService.ts             # RAG (vector search) service
├── notionActions.ts          # Notion API integration
├── calendarActions.ts        # Google Calendar operations
├── encryption.ts             # AES-256-GCM encrypt/decrypt

/browser-service              # Separate Fastify microservice
├── index.js                  # Fastify server with Playwright
└── Dockerfile                # Container config

/scripts                      # CLI tools and background jobs
├── generate-summary.ts       # Daily summary (cron-ready)
├── ingest-gmail.ts           # RAG ingestion from Gmail
├── ingest-notion.ts          # RAG ingestion from Notion
├── test-token.ts
└── test-notion-write.ts

/migration*.sql               # Database migrations
├── migration.sql             # Initial schema
├── migration_2.sql through migration_5.sql  # Incremental updates

proxy.ts                      # Middleware for auth/routing
```

## Authentication & Security

### Google OAuth 2.0 Flow
1. User clicks "Iniciar sesión con Google" on `/login`
2. Redirect to `/api/auth/google/redirect` → Google consent screen
3. User grants permissions → Google redirects to `/api/auth/google/callback`
4. Server exchanges code for `access_token` and `refresh_token`
5. `refresh_token` is encrypted with AES-256-GCM and stored in Supabase
6. User is signed into Supabase using ID token
7. Redirected to `/page.tsx` with status parameter

### Token Encryption
- **Key:** `ENCRYPTION_KEY` (32-byte Base64-encoded)
- **Algorithm:** AES-256-GCM
- **Storage Format:** `{ ciphertext, iv, auth_tag }` in user_credentials table
- **Decryption:** See `lib/encryption.ts` for encrypt/decrypt functions

### API Authentication
- All requests to `/api/chat` require `Authorization: Bearer {supabase_session_token}`
- Supabase middleware verifies token and extracts `user_id`
- Database queries filtered by user_id via Row-Level Security (RLS)

## Database Schema

### Key Tables (Supabase PostgreSQL)

**document_chunks** - RAG storage
- Stores vectorized content from Gmail, Notion, etc.
- Embedding: pgvector(768) for Gemini embeddings
- RLS: Users can only access their own chunks

**user_credentials** - Encrypted service tokens
- Stores encrypted Google refresh tokens, Notion tokens, etc.
- Format: { service_name, encrypted_refresh_token, iv, auth_tag }

**daily_summaries** - Generated daily summaries
- User_id, summary_text, created_at timestamp

**browser_sessions** - Browser automation state
- Tracks active browser contexts per user

### Custom Functions
- **match_document_chunks()** - Vector similarity search for RAG retrieval

### Applying Migrations
Run all migration files sequentially in order:
```bash
# Via Supabase CLI or SQL editor
psql -U postgres -d your_db < migration.sql
psql -U postgres -d your_db < migration_2.sql
# ... continue through migration_5.sql
```

## Key Concepts

### ReAct Agent Pattern
The chat endpoint implements a reasoning loop where Gemini:
1. Receives: System instructions + RAG context + User query
2. Decides: Which tool to use (browser, notion, or answer directly)
3. Executes: Tool and receives semantic context back
4. Repeats: Up to 5 steps until task is complete or answer found

### RAG (Retrieval-Augmented Generation)
- User queries are vectorized using Gemini embeddings
- Vector search finds relevant document chunks from user's data
- Retrieved context is injected into agent system prompt
- Enables answering questions about user's Gmail, Notion, etc.

### Browser Service Microservice
- Separate Node.js + Fastify server on port 3001
- Playwright headless browser contexts per user
- Endpoints: `/session/create`, `/session/execute`
- Tools: browse_web, type_text, click_element, get_semantic_context

### System Instruction Prompt
The agent operates under a system instruction that defines:
- Tool descriptions and how to use them
- Behavior rules (be helpful, be accurate, etc.)
- Constraints (max 5 steps, etc.)
- Located in: `/api/chat` route handler

## Environment Variables (.env.local)

```
ENCRYPTION_KEY                      # 32-byte Base64-encoded AES key
GOOGLE_CLIENT_ID                    # Google Cloud OAuth app ID
GOOGLE_CLIENT_SECRET                # Google Cloud OAuth app secret
GEMINI_API_KEY                      # Google Generative AI API key
NOTION_INTERNAL_INTEGRATION_TOKEN   # Notion workspace integration token
NEXT_PUBLIC_SUPABASE_URL            # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY       # Supabase public/anonymous key
SUPABASE_SERVICE_ROLE_KEY           # Supabase admin key (server-side only)
NOTION_CLIENT_ID                    # Notion OAuth app ID (for future flows)
NOTION_CLIENT_SECRET                # Notion OAuth app secret (for future flows)
```

## Development Setup

1. **Clone & Install**
   ```bash
   git clone <repo>
   cd asistente-ia-nuevo
   npm install
   ```

2. **Environment Setup**
   - Create `.env.local` with all variables above
   - Ensure Supabase database is created and migrations applied
   - Get credentials from: Google Cloud, Notion, Gemini API, Supabase

3. **Start Development**
   ```bash
   npm run dev                    # Terminal 1: Next.js on :3000
   npm start browser-service      # Terminal 2: Fastify on :3001 (optional)
   ```

4. **Access**
   - Open http://localhost:3000 → Redirects to /login
   - Click "Iniciar sesión con Google"
   - After auth, accesses main chat interface at `/page.tsx`

## API Endpoints

### Authentication
- `GET /api/auth/google/redirect` - Initiate OAuth flow
- `GET /api/auth/google/callback?code=...` - Handle OAuth callback

### Chat
- `POST /api/chat` - Send message, receive agent response
  - Required header: `Authorization: Bearer {token}`
  - Body: `{ message: string }`
  - Returns: `{ answer: string }`

### Settings (Frontend)
- `GET /settings` - User settings page

## Important Files & Their Roles

| File | Purpose |
|------|---------|
| `app/page.tsx` | Main chat UI (Client Component with message history) |
| `app/api/chat/route.ts` | ReAct agent orchestration, tool execution |
| `lib/ragService.ts` | Vector embedding and similarity search |
| `lib/browserService.ts` | Browser action orchestration |
| `lib/notionActions.ts` | Notion CRUD operations |
| `lib/encryption.ts` | AES-256-GCM token encrypt/decrypt |
| `browser-service/index.js` | Fastify server with Playwright |
| `proxy.ts` | Next.js middleware for auth/redirects |
| `GEMINI.md` | Additional project documentation |

## Testing & Debugging

**Test Token Encryption:**
```bash
npx tsx scripts/test-token.ts
# Encrypts and decrypts a test token to verify ENCRYPTION_KEY is correct
```

**Test Notion Write:**
```bash
npx tsx scripts/test-notion-write.ts
# Creates a test task in Notion to verify API connection
```

**Test RAG Ingestion:**
```bash
npx tsx scripts/ingest-notion.ts
npx tsx scripts/ingest-gmail.ts
# Ingests data into document_chunks table
```

## Production Deployment

- **Host:** Supabase (PostgreSQL backend)
- **Frontend:** Vercel, Dokku, or self-hosted Node.js
- **Browser Service:** Docker container on internal network or cloud function
- **Environment Variables:** Set in deployment platform secrets
- **Migrations:** Apply all migration files to production database before deploying
- **Domain:** https://asistente-justine.cloution.cloud (current)

## Known Issues & Workarounds

- **Turbopack Alias Issue:** `next.config.ts` has workaround for path aliases - if developing without Turbopack, can be simplified
- **Browser Service Dependency:** Chat endpoint requires browser-service running if browser tools are needed; handle gracefully with timeout/fallback

## Code Style & Patterns

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript strict mode
- **Frontend:** React 19 with Client Components
- **State Management:** React hooks + Supabase client
- **Styling:** CSS Modules + GSAP animations
- **API Routes:** Node.js handlers, async/await
- **Error Handling:** Try-catch blocks, return error responses

## Git Workflow

- Main branch: `master` (production)
- Current changes may be in progress; review git status before making modifications
- Encrypted tokens in `.env.local` should never be committed

---

**Last Updated:** Generated from codebase analysis
**Framework Versions:** Next.js 16.0.1, React 19.2.0, TypeScript 5.9.3
