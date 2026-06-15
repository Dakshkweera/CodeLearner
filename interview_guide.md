# CodeLearner — Interview Guide

---

## 1. One-Minute Project Explanation (Say This in Interview)

> "I built CodeLearner, a full-stack web app that lets developers explore and understand any GitHub codebase using AI.
>
> A user logs in, pastes a GitHub repository URL, and the system clones it, parses all JavaScript and TypeScript files using Tree-sitter, and builds a visual dependency graph showing how every file imports from every other file.
>
> When the user clicks a file, they can read the code and ask AI questions about it. The AI uses a technique called RAG — Retrieval Augmented Generation — where the codebase is split into function-level chunks, converted into vector embeddings using Cohere, stored in PostgreSQL with pgvector, and then at query time the most semantically relevant chunks are retrieved and sent as context to Perplexity AI to generate a grounded answer.
>
> On the backend I used Node.js with Express and TypeScript, PostgreSQL with pgvector for vector storage, JWT for auth, and Bcrypt for password hashing. The frontend is React with Vite, TypeScript, Tailwind CSS, and Zustand for state management. The project is deployed with the backend on Railway and frontend on Vercel."

---

## 2. High-Level Design (HLD)

```
┌─────────────────────────────────────────────────────────────────────┐
│                          USER (Browser)                             │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTPS
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  FRONTEND  (React + Vite + TypeScript)              │
│                                                                     │
│   LandingPage ──► /signup or /login ──► /app (protected)           │
│                                                                     │
│   /app layout:                                                      │
│   ┌──────────────────┐   ┌──────────────────────────────────────┐  │
│   │   GraphPanel     │   │         CodePanel                    │  │
│   │ (File dep. graph)│   │  (File viewer + AI chat overlay)     │  │
│   └──────────────────┘   └──────────────────────────────────────┘  │
│                                                                     │
│   Global State: Zustand store (repo, graph, selectedFile, error)   │
│   Auth: JWT stored in localStorage                                  │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ REST API calls (Bearer JWT)
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  BACKEND  (Express.js + TypeScript)                 │
│                                                                     │
│   ┌─────────────┐  ┌──────────────┐  ┌──────────────┐             │
│   │  /api/auth  │  │  /api/repo   │  │  /api/file   │             │
│   │  signup     │  │  /clone      │  │  GET content │             │
│   │  login      │  └──────────────┘  └──────────────┘             │
│   │  /me        │                                                   │
│   └─────────────┘  ┌──────────────┐  ┌──────────────┐             │
│                    │  /api/graph  │  │  /api/rag    │             │
│                    │  dependency  │  │  /process    │             │
│                    │  graph       │  │  /ask        │             │
│                    └──────────────┘  │  /ask-pre... │             │
│                                      └──────────────┘             │
│                    ┌──────────────────────────────────┐            │
│                    │  /api/ai  (file-chat)             │            │
│                    │  Auth middleware + Quota check    │            │
│                    └──────────────────────────────────┘            │
└──────┬────────────────────────┬──────────────────────┬─────────────┘
       │                        │                      │
       ▼                        ▼                      ▼
┌──────────────┐   ┌───────────────────────┐  ┌───────────────────┐
│  PostgreSQL  │   │   GitHub (via         │  │  External AI APIs │
│  + pgvector  │   │   simple-git clone)   │  │                   │
│              │   │                       │  │  Cohere           │
│  tables:     │   │  Clones repo to       │  │  (embeddings)     │
│  - users     │   │  /temp/repos/owner/   │  │                   │
│  - repos     │   │  name/ on disk        │  │  Perplexity AI    │
│  - code_emb  │   │                       │  │  (chat answers)   │
└──────────────┘   └───────────────────────┘  └───────────────────┘
```

---

## 3. Full System Flow (Step by Step)

### A. Authentication Flow
```
User fills signup form
      │
      ▼
POST /api/auth/signup
      │
      ├─► Validate email + password
      ├─► Check if user exists in DB
      ├─► bcrypt.hash(password, 10)
      ├─► INSERT into users (email_verified = true)  ← auto-verified
      ├─► jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '7d' })
      └─► Return { token, user }

Frontend stores JWT in localStorage
      │
      ▼
All protected requests → Authorization: Bearer <token>
      │
      ▼
authMiddleware: jwt.verify(token) → attaches req.user = { userId, email }
```

### B. Repository Clone & Graph Flow
```
User enters GitHub URL
      │
      ▼
POST /api/repo/clone
      │
      ├─► Validate GitHub URL (regex)
      ├─► simpleGit.clone(url, ./temp/repos/owner/name)
      ├─► If folder param given → validate folder exists
      └─► Return repoInfo

GET /api/graph?owner=&name=&folder=
      │
      ├─► Find all .js/.ts/.tsx/.jsx files (skip node_modules, dist, .git)
      ├─► Tree-sitter parses each file → extract import/require/dynamic imports
      ├─► Build nodes (files) + edges (import relationships)
      ├─► Group nodes by folder
      └─► Return { nodes, edges, folderGroups, stats }

Frontend renders interactive dependency graph using GraphPanel
```

### C. RAG Pipeline Flow (Core AI Feature)
```
POST /api/rag/process (or /process-local)
      │
      ├─► Check DB cache (repositories table) → CACHE HIT → return
      ├─► CACHE MISS:
      │     ├─► Clone repo (simpleGit)
      │     ├─► Build graph (graphService)
      │     ├─► Read file contents
      │     ├─► ChunkingService: Tree-sitter parses → extract function-level chunks
      │     ├─► Limit to 30 chunks (API cost control)
      │     ├─► EmbeddingService: Cohere embed-english-v3.0 → float[] vectors
      │     ├─► DB INSERT into repositories + code_embeddings (with ::vector cast)
      │     └─► Delete local clone (disk cleanup)

POST /api/rag/ask
      │
      ├─► Check repo exists in DB
      ├─► Cohere: embed user question → queryVector[]
      ├─► pgvector cosine similarity search:
      │     SELECT ... 1 - (embedding <=> queryVector) AS similarity ... ORDER BY
      ├─► Top 5 most similar code chunks
      ├─► Build prompt with code context
      ├─► Perplexity AI (sonar-pro model) → generates answer
      └─► Return { answer, relevantCode }
```

### D. File-Level AI Chat Flow
```
User clicks file → GET /api/file?owner=&name=&path=
      │
      ├─► fileService.readFile() with path traversal protection
      └─► Return file content

User asks question about file → POST /api/ai/file-chat
      │
      ├─► authenticateUser middleware (JWT check)
      ├─► checkAiQuota middleware (max 10 questions per user)
      ├─► fileService.readFile() → get code
      ├─► fileService.readReadme() → get project context
      ├─► Build system prompt with code + README
      ├─► Perplexity AI (sonar-pro) with conversation history (last 5 messages)
      ├─► UPDATE users SET ai_questions_used = ai_questions_used + 1
      └─► Return { answer }
```

---

## 4. Tech Stack — What & Why

| Technology | Purpose | Why This Choice |
|---|---|---|
| **Node.js + Express 5** | Backend server | Non-blocking I/O ideal for file I/O, cloning, API calls. Express is minimal and flexible. |
| **TypeScript** | Language for both FE & BE | Catches bugs at compile time. Interfaces for FileNode, FileEdge, CodeChunk kept the codebase maintainable. |
| **PostgreSQL + pgvector** | Database + vector search | pgvector extension adds a `vector` column type and cosine similarity operator `<=>`. No need for a separate vector DB (Pinecone etc.) — keeps the stack simple. |
| **Tree-sitter** | Code parsing (JS + TS) | Industrial-strength incremental parser. Used by VS Code itself. Enables AST-level extraction of import statements and function boundaries — more accurate than regex. |
| **Cohere embed-english-v3.0** | Code embeddings | Strong code-aware embedding model. `inputType: 'search_document'` vs `'search_query'` distinction improves retrieval quality. |
| **Perplexity AI (sonar-pro)** | LLM for answers | Fast inference, supports system/user/assistant roles, good at code Q&A. Used over OpenAI to reduce cost. |
| **simple-git** | Git clone | Programmatic git wrapper for Node.js. Lets the backend clone any public GitHub repo on demand. |
| **bcrypt** | Password hashing | Industry standard adaptive hashing. Salt rounds = 10 makes brute force impractical. |
| **JWT (jsonwebtoken)** | Auth sessions | Stateless — no session store needed. Token carries userId + email, verified on every protected request. |
| **Nodemailer / Resend** | OTP email (built, now disabled) | Dual provider approach: Resend for production (deliverability), Gmail SMTP as fallback. OTP flow is implemented but disabled (auto-verified now). |
| **React + Vite** | Frontend framework | Vite gives instant HMR. React component model maps well to graph panels, code viewer, overlays. |
| **Zustand** | Frontend state | Lightweight alternative to Redux. Single `useAppStore` holds repo, graph, selectedFile, errors. No boilerplate. |
| **Tailwind CSS** | Styling | Utility-first. Rapid UI development without custom CSS files. |
| **React Router DOM** | Routing | Declarative routes. Token-based route guard (Navigate to /login if no token). |
| **express-rate-limit** | Rate limiting | Prevents abuse on signup and AI routes. |
| **CORS (custom)** | Cross-origin | Allows localhost:5173 in dev + any `*.code-learner.vercel.app` domain in production. |

---

## 5. Key Design Decisions (Be Ready to Explain)

### Why pgvector instead of Pinecone/Weaviate?
pgvector keeps the entire stack in one database. No extra service to manage or pay for. For a project of this scale, cosine similarity in Postgres is fast enough.

### Why chunk by function (Tree-sitter) instead of by lines?
Function-level chunks are semantically meaningful. A 50-line function is a complete unit of logic. Line-based chunking might split a function mid-way, destroying context for the embedding.

### Why Perplexity instead of OpenAI?
Cost and speed. The sonar-pro model gives quality answers for code questions at lower cost. The RAG approach means the LLM doesn't need to "know" the codebase — it just synthesizes from context provided.

### Why auto-verify users (no OTP in production)?
OTP requires a proper sending domain. The OTP flow is fully built (code is in comments) but disabled until a custom domain is available. This is a pragmatic tradeoff explained in the codebase.

### What is the AI quota system?
Each user gets 10 AI questions (lifetime). `ai_questions_used` column in DB, incremented after each successful AI response. The `checkAiQuota` middleware enforces this before hitting the AI API — preventing runaway costs.

### Path traversal protection in fileService
Before reading any file from a cloned repo, the path is normalized and checked that it starts with the repo root. Prevents `../../etc/passwd` style attacks.

---

## 6. Interview Q&A

### General / Architecture

**Q: Walk me through what happens when a user enters a GitHub URL.**
A: The frontend sends `POST /api/repo/clone`. The backend validates the URL with a regex, uses `simple-git` to clone the repo to a temp directory on disk (`./temp/repos/owner/name`). If a subfolder is specified, it validates that folder exists. The frontend then calls `GET /api/graph` which uses `graphService` to scan all JS/TS files, parse imports with Tree-sitter, and returns a graph of nodes (files) and edges (imports).

**Q: What is RAG and how did you implement it?**
A: RAG stands for Retrieval Augmented Generation. Instead of sending the entire codebase to an LLM (which is too large), we split code into function-level chunks, convert each chunk into a vector embedding (a list of numbers representing meaning), store them in PostgreSQL. At query time, we embed the user's question the same way, then find the top-N chunks with highest cosine similarity. Those chunks become the context for the LLM prompt. The LLM answers grounded in actual code.

**Q: How does the vector similarity search work?**
A: PostgreSQL with the pgvector extension stores embeddings as `vector` type columns. We query with the `<=>` operator (cosine distance). The SQL is:
```sql
SELECT *, 1 - (embedding <=> $1::vector) AS similarity
FROM code_embeddings
WHERE repo_id = $2
ORDER BY embedding <=> $1::vector
LIMIT 5
```
Lower cosine distance = higher similarity.

**Q: How does JWT authentication work in your app?**
A: On login/signup, the server calls `jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '7d' })` and returns the token. The frontend stores it in `localStorage`. Every protected API call sends `Authorization: Bearer <token>`. The `authenticateUser` middleware calls `jwt.verify(token, JWT_SECRET)` — if valid, it attaches `req.user = { userId, email }` and calls `next()`. If invalid/expired, it returns 401.

**Q: Why did you use Zustand instead of Redux?**
A: For this project, the global state is simple: repository info, graph data, selected file, loading states, errors. Zustand needs no reducers, no actions, no dispatch — just a single `create` call with state and setters. Redux would have been significant boilerplate for this scope.

**Q: How did you prevent path traversal attacks?**
A: In `fileService.readFile()`, the path is normalized with `path.normalize()` and leading `../` sequences stripped. The resolved full path is then checked with `resolvedFullPath.startsWith(resolvedRepoRoot)`. If it escapes the repo directory, the request is rejected.

**Q: How does CORS work in this project?**
A: The CORS middleware has a custom `origin` callback. It allows `localhost:5173` in development and any origin that starts with `https://`, ends with `.vercel.app`, and includes `code-learner` in the hostname. This supports all Vercel preview deployments without hardcoding URLs.

**Q: Explain the chunking strategy.**
A: `chunkingService` uses Tree-sitter to walk the AST of each file and extract `function_declaration`, `arrow_function`, `method_definition`, and `function_expression` nodes. Each function becomes one chunk with metadata (file path, function name, start/end lines). If no functions are found (e.g., a config file), the entire file is treated as one chunk.

**Q: What happens if Cohere rate-limits you?**
A: The embedding service catches `statusCode === 429` and throws a descriptive error. `repositoryService` catches it and propagates a user-friendly message. In production, `ENABLE_RAG_PROCESS=false` can be set to disable new processing — only pre-embedded demo repos are available then.

**Q: What is the pre-embedded flow vs the standard flow?**
A: Standard flow: user processes a repo (calls Cohere for embeddings, stores in DB). Pre-embedded flow (`/api/rag/ask-preembedded`): only repos that already have embeddings in DB can be queried. The search uses keyword matching (`ILIKE`) on the code_snippet column instead of cosine similarity — so it works without calling Cohere at all. This is the cost-controlled production mode.

### Frontend

**Q: How is auth handled on the frontend?**
A: After login/signup, the JWT is stored in `localStorage`. `App.tsx` reads it on mount with `localStorage.getItem('codelearnerToken')`. Routes to `/app` are guarded with `token ? AppLayout : <Navigate to="/login" />`. The token is sent as a Bearer header in all API calls.

**Q: What state management approach did you use?**
A: Zustand. A single `useAppStore` store holds `repository`, `graphData`, `selectedFile`, `loading` (cloning/loadingGraph/loadingFile booleans), and `error`. Components call `useAppStore()` to read state and `set*` actions to update it.

**Q: How is the graph rendered?**
A: `GraphPanel` fetches the graph data from `/api/graph` and renders it visually. The graph data is `{ nodes: FileNode[], edges: FileEdge[], folderGroups: FolderGroup[] }`. Each node is a file, each edge is an import relationship.

---

## 7. Things That Could Be Improved (Show Self-Awareness)

- **OTP email verification**: The code is fully built but disabled. Would re-enable with a proper sending domain (Resend with custom domain).
- **Vector search in pre-embedded mode**: Currently uses `ILIKE` keyword search instead of real cosine similarity. Should add query embedding generation for fully semantic search.
- **Chunk limit of 30**: Hardcoded to control API costs. A better approach would be rate-limiting per user or batching requests over time.
- **Repo cleanup**: Cloned repos sit on disk between clone and processing. Should stream or process in memory for production.
- **No unit tests**: Would add tests for authService (bcrypt), parseService (imports), and vectorSearchService.
- **Rate limiting on auth routes**: The code is in comments. Would re-enable for production to prevent brute force.

---

## 8. Quick Tech Facts for Rapid-Fire Questions

| Question | Answer |
|---|---|
| Port backend runs on | 5002 |
| Port frontend runs on | 5173 (Vite default) |
| JWT expiry | 7 days |
| Max AI questions per user | 10 |
| Max code chunks per repo | 30 |
| Embedding model | Cohere embed-english-v3.0 |
| LLM model | Perplexity sonar-pro |
| bcrypt salt rounds | 10 |
| Conversation history sent to AI | Last 5 messages |
| DB extension for vectors | pgvector |
| Vector similarity operator | `<=>` (cosine distance) |
| Code parser | Tree-sitter (tree-sitter-javascript, tree-sitter-typescript) |
| Git cloning library | simple-git |
| Frontend state library | Zustand |
| Frontend build tool | Vite |
| Temp repo storage path | `./temp/repos/owner/name` |
