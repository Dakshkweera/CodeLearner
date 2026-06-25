# CodeLearner — Visual Code Navigation & AI-Assisted Understanding

CodeLearner helps you understand an unfamiliar codebase fast. Paste any public GitHub repository, and it clones the repo, parses every JavaScript/TypeScript file with Tree-sitter, and renders an interactive dependency graph showing exactly how every file connects to every other file. Click any file to read it, and ask an AI assistant questions grounded in that file's actual code.

Built to solve a real problem: jumping into an unfamiliar repo (someone else's, or your own after months away) and not knowing where to even start reading.

---

## Table of Contents

- [System Architecture](#system-architecture)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Security & Auth](#security--auth)
- [Install and Run](#install-and-run)
- [Environment Variables](#environment-variables)
- [API Overview](#api-overview)
- [Folder Structure](#folder-structure)
- [Known Limitations](#known-limitations)
- [Architecture Notes & Decisions](#architecture-notes--decisions)
- [License](#license)

---

## System Architecture

### High-Level Design (HLD)

```mermaid
graph LR
    U([User]) --> FE["React + Vite\nFrontend"]
    FE -->|REST API, JWT| BE["Express + TypeScript\nBackend"]
    BE --> AUTH["Auth\nbcrypt + JWT"]
    BE --> REPO["Repo Clone\nsimple-git"]
    BE --> GRAPH["Graph Builder\nTree-sitter AST"]
    BE --> FILE["File Reader\npath-safe"]
    BE --> AI["AI Chat\nGroq Llama 3.3"]

    REPO -->|clones to disk| FS[("Filesystem\ntemp/repos/")]
    GRAPH -->|reads| FS
    FILE -->|reads, path-checked| FS
    AI -->|reads via FILE| FS
    AI -->|context injection| LLM[("Groq API\nllama-3.3-70b")]
    AUTH --> DB[("PostgreSQL\nNeonDB — users table")]
    AI --> DB

    style LLM fill:#1e3a8a,color:#fff,stroke:#3b82f6
    style FS fill:#581c87,color:#fff,stroke:#a855f7
    style DB fill:#7c2d12,color:#fff,stroke:#f97316
    style AUTH fill:#065f46,color:#fff,stroke:#10b981
```

### Request Flow (Sequence Diagram)

```mermaid
sequenceDiagram
    actor U as User
    participant F as Frontend
    participant B as Backend (Express)
    participant T as Tree-sitter
    participant FS as Filesystem
    participant G as Groq API

    U->>F: Sign up / Log in
    F->>B: POST /api/auth/signup or /login
    B-->>F: JWT token (7-day expiry)
    F->>F: store token in localStorage

    U->>F: Paste GitHub URL, click Load
    F->>B: POST /api/repo/clone (Bearer token)
    B->>FS: simple-git clone into temp/repos/owner/name
    B-->>F: repo info

    F->>B: GET /api/graph (Bearer token)
    B->>FS: recursively find .js/.ts files
    B->>T: parse imports per file (AST walk)
    T-->>B: import statements
    B->>B: resolve imports to real files → build nodes + edges
    B-->>F: { nodes, edges, folderGroups }
    F->>F: render graph (3D / Tree / Force layout)

    U->>F: click a file node
    F->>B: GET /api/file (Bearer token)
    B->>FS: read file (path-traversal checked)
    B-->>F: file content
    F->>F: show code in editor

    U->>F: ask AI a question about the open file
    F->>B: POST /api/ai/file-chat (Bearer token)
    B->>B: authenticateUser + checkAiQuota (max 10/user)
    B->>FS: read file + README
    B->>G: file content + README + question
    G-->>B: grounded answer
    B-->>F: { answer }
```

---

## Features

**Visual dependency graph, not a file tree.** See exactly which files import which, rendered three different ways — a 3D WebGL view, a top-down dependency tree, and a force-directed layout where related files naturally cluster together.

**AST-accurate import parsing, not regex.** Uses Tree-sitter — the same incremental parser VS Code uses internally — to extract `import`, `require`, and dynamic `import()` statements with full accuracy across JS and TS.

**Click a file, ask the AI about it.** The AI assistant reads the file you're viewing plus the repo's README and answers grounded in that actual code — no generic, repo-unaware explanations.

**Focus Mode.** Click any node in the graph to instantly highlight it and its direct dependencies, dimming everything else — built for exploring large, overwhelming codebases one neighborhood at a time.

**Secure by default.** Every data-touching route requires a valid JWT. File reading is hardened against path-traversal attacks. Passwords are bcrypt-hashed with proper salting.

**AI usage is cost-controlled.** Each account gets a fixed lifetime quota of AI questions, enforced server-side before any LLM call is made — not just a frontend suggestion.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, TypeScript, Tailwind CSS, Zustand, React Router DOM |
| Graph rendering | ReactFlow (2D), react-force-graph-3d + Three.js (3D) |
| Backend | Node.js, Express 5, TypeScript |
| Database | PostgreSQL (NeonDB, serverless) |
| Code parsing | Tree-sitter (`tree-sitter-javascript`, `tree-sitter-typescript`) |
| Git operations | simple-git |
| Auth | JWT (`jsonwebtoken`), bcrypt |
| LLM | Groq (`llama-3.3-70b-versatile`) |
| Code editor | Monaco Editor |

---

## Security & Auth

CodeLearner enforces authentication on every route that touches the filesystem, the database, or an external API — not just the obviously sensitive ones.

**Layer 1: JWT on every protected route.** `authenticateUser` middleware verifies a `Bearer` token before `/api/repo/clone`, `/api/graph`, `/api/file`, and `/api/ai/file-chat` are allowed to run. Signup and login are the only public routes, since no token exists yet at that point.

**Layer 2: Password hashing.** bcrypt with 10 salt rounds — slow by design, with a unique salt per password baked into the stored hash itself.

**Layer 3: Path-traversal protection.** Every file read is normalized, stripped of leading `../` sequences, then independently re-verified by resolving both the target path and the repo root to absolute form and checking containment — defense in depth, not a single check.

**Layer 4: AI quota enforcement.** A dedicated middleware checks `ai_questions_used` against a hard limit before any Groq API call is made, preventing runaway usage costs at the request level, not just in the UI.

**Layer 5: User-enumeration resistant login.** Login returns an identical error message for "no such user" and "wrong password," so the login endpoint can't be used to discover which emails have accounts.

> Direct context injection, not RAG: the AI assistant sends the full file content (plus README) as context on every question — there is no vector database, embedding step, or retrieval pipeline in the current build. A complete RAG pipeline (Tree-sitter chunking, Cohere embeddings, pgvector similarity search) was built but never deployed to production, and has since been removed from the codebase to keep it focused on what's actually working end-to-end.

---

## Install and Run

### Prerequisites

Node.js 18+ and a PostgreSQL database (NeonDB or local).

### 1. Clone and configure

```bash
git clone <repo-url>
cd CodeLearner
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
# Fill in DATABASE_URL, JWT_SECRET, GROQ_API_KEY (see below)
npm run dev
```

Backend runs at `http://localhost:5002`. The server validates required environment variables on startup and exits immediately with a clear error if any are missing.

### 3. Database

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT,
  email_verified BOOLEAN DEFAULT true,
  otp_code TEXT,
  otp_expires_at TIMESTAMPTZ,
  ai_questions_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4. Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Opens at `http://localhost:5173`.

---

## Environment Variables

### Backend (`backend/.env`)

```ini
PORT=5002
NODE_ENV=development

JWT_SECRET=your_super_secure_secret_key

DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require

TEMP_REPO_PATH=./temp/repos
BACKEND_URL=http://localhost:5002

GROQ_API_KEY=gsk_your_groq_api_key
```

### Frontend (`frontend/.env`)

```ini
VITE_API_URL=http://localhost:5002
```

---

## API Overview

| Endpoint | Method | Auth required | Description |
|---|---|---|---|
| `/api/auth/signup` | POST | No | Register a new user, auto-verified, returns JWT immediately |
| `/api/auth/login` | POST | No | Authenticate, returns JWT |
| `/api/auth/me` | GET | Yes | Return the current user from the token |
| `/api/repo/clone` | POST | Yes | Clone a public GitHub repo to local disk |
| `/api/graph` | GET | Yes | Build and return the file dependency graph |
| `/api/file` | GET | Yes | Read a single file's content (path-traversal protected) |
| `/api/ai/file-chat` | POST | Yes | Ask the AI a question about an open file (quota-limited) |

---

## Folder Structure

```
CodeLearner/
├── backend/
│   ├── src/
│   │   ├── api/             # Route definitions (auth, repo, graph, file, ai)
│   │   ├── config/          # Env-driven app config
│   │   ├── controllers/     # Request handling, validation, status codes
│   │   ├── middleware/      # authenticateUser, checkAiQuota
│   │   ├── models/          # TypeScript interfaces (FileNode, FileEdge, RepoInfo)
│   │   ├── services/        # Business logic (auth, repo, graph, file, chat)
│   │   ├── app.ts           # Express app, CORS, route registration
│   │   └── server.ts        # Entry point, env validation, DB connection
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── features/
│   │   │   ├── graph/       # GraphPanel — 3D/Tree/Force dependency graph
│   │   │   └── codeViewer/  # CodePanel, FileAiOverlay — code + AI chat
│   │   ├── pages/           # LandingPage, Auth (Signup/Login)
│   │   ├── shared/
│   │   │   ├── components/  # Header, ErrorMessage
│   │   │   ├── services/    # apiClient (axios + JWT interceptor)
│   │   │   ├── store/       # appStore.ts — single Zustand store
│   │   │   └── types/       # Shared TypeScript types
│   │   ├── App.tsx          # Routing, auth guard
│   │   └── main.tsx         # Entry point
│   └── package.json
│
├── docs/                    # Deep-dive study guides per feature (Mermaid diagrams, Q&A)
└── README.md
```

---

## Known Limitations

Documented honestly rather than glossed over — these are real, current gaps:

- **Public repos only.** Cloning is unauthenticated; private GitHub repositories cannot be cloned.
- **No automatic disk cleanup.** Cloned repos persist on disk indefinitely; there's no TTL or LRU eviction policy.
- **Graph is rebuilt on every request.** No caching layer — the same repo's graph is recomputed from scratch each time it's requested.
- **AI quota is a lifetime cap, not time-windowed.** Once a user hits 10 questions, there's no automatic reset.
- **No rate limiting on auth routes**, despite `express-rate-limit` being an installed dependency.
- **No token revocation.** JWTs remain valid until natural expiry; there's no logout blocklist or refresh-token rotation.

---

## Architecture Notes & Decisions

**Why Tree-sitter over regex for import parsing?** Tree-sitter builds a real Abstract Syntax Tree from the language's actual grammar, so it only matches genuine `import_statement` nodes — never false positives from the word "import" appearing in a comment or string literal.

**Why three separate graph rendering modes?** Different repo sizes and exploration styles call for different views. The 3D mode suits broad spatial exploration of large repos; the Tree mode gives a clean top-down dependency hierarchy from entry points; the Force mode (a physics simulation written from scratch — 220 iterations of repulsion and spring forces, since ReactFlow has no built-in force-directed layout) naturally clusters tightly-coupled files together.

**Why PostgreSQL instead of a NoSQL store?** The architecture was designed around pgvector — storing code embeddings as native vector columns and running similarity search directly in SQL, avoiding a separate vector database. The `users` table alone wouldn't require Postgres specifically, but the intended embedding pipeline did.

**Why direct context injection instead of RAG for the AI feature?** A full RAG pipeline (Tree-sitter chunking → Cohere embeddings → pgvector cosine search) was built, but deploying it required database infrastructure (the `vector` extension, two additional tables) that was never finished, mainly to control embedding API costs during solo development. Rather than ship a half-working RAG feature, the simpler and fully-working "send the whole file as context" approach was kept as the primary AI feature, and the unused RAG code was later removed entirely to keep the codebase honest and easy to navigate.

**Why two layers of path-traversal protection in file reading?** A regex strip of leading `../` sequences is cheap but not foolproof on its own; resolving both paths to absolute form and checking containment is the real guarantee, independent of how the input string was constructed. Relying on either alone would leave a gap the other closes.

---

## License

Distributed under the MIT License. See `LICENSE` for more information.
