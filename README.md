# CodeLearner – Intelligent Code Navigation & Learning Platform

CodeLearner is a full-stack web application designed to help developers explore, search, and understand codebases efficiently. It features secure authentication with email OTP verification, repository ingestion, vector-based semantic search, and an AI-powered assistant to answer context-aware questions about your code.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Overview](#api-overview)
- [License](#license)

---

## Features

- **Secure Authentication:** Email-password signup with secure **email OTP verification** using Gmail SMTP (Nodemailer) and JWT-based session management.
- **Repository Ingestion:** Parse code repositories into structured representations (files, folders, relationships).
- **Semantic Search:** Embeddings-based code search leveraging PostgreSQL and vector storage (pgvector).
- **AI Assistant:** Chat-style interface to ask questions grounded in the ingested repository context.
- **Modern UI:** Responsive interface built with React, TypeScript, Vite, and Tailwind CSS.

---

## Tech Stack

### Frontend
- **Framework:** React (Vite)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Routing:** React Router DOM

### Backend
- **Runtime:** Node.js
- **Framework:** Express.js
- **Language:** TypeScript
- **Database:** PostgreSQL (with vector extension)
- **Email:** Nodemailer (Gmail SMTP)
- **Security:** Bcrypt (hashing), JWT (auth)
- **AI/ML:** OpenAI (or compatible embeddings service)

---

## Architecture

1.  **Backend:** Exposes REST APIs for auth, repo management, embeddings, and chat. Handles the "heavy lifting" of parsing code and managing vector data.
2.  **Frontend:** Consumes APIs, manages JWT state, and handles the interactive flows (OTP entry, Chat UI).
3.  **Email Flow:** Uses a 2-step verification process. The backend generates a short-lived OTP, emails it via SMTP, and verifies it before issuing a JWT.

---

## Project Structure

```bash
codelearner/
├── backend/
│   ├── src/
│   │   ├── api/                # Route registration
│   │   ├── config/             # DB, env, and app config
│   │   ├── controllers/        # Request handlers
│   │   ├── middleware/         # Auth & error handling
│   │   ├── models/             # Database models
│   │   ├── services/           # Business logic (Auth, Email, Repo, AI)
│   │   ├── app.ts              # App bootstrap
│   │   └── index.ts            # Entrypoint
│   ├── .env.example
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/         # Reusable UI elements
│   │   ├── pages/              # Views (Login, Dashboard, Chat)
│   │   ├── hooks/              # Custom hooks (useAuth, useApi)
│   │   ├── router/             # Route definitions
│   │   ├── styles/             # Tailwind imports
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── .env.example
│   └── package.json
│
└── README.md

```

---

## Prerequisites

Before running the application, ensure you have the following installed:

1. **Node.js** (LTS version recommended) & **npm/pnpm**.
2. **PostgreSQL** instance (Local or Cloud).
3. **Gmail Account** with 2-Step Verification enabled and an **App Password** generated for SMTP access.

---

## Getting Started

### 1. Clone the Repository

```bash
git clone [https://github.com/](https://github.com/)<your-username>/codelearner.git
cd codelearner

```

### 2. Install Dependencies

**Backend:**

```bash
cd backend
npm install

```

**Frontend:**

```bash
cd ../frontend
npm install

```

### 3. Database Setup

Create your PostgreSQL database. If you are using `pgvector`, ensure the extension is enabled.

```bash
createdb codelearner
# Run your migration scripts here (e.g., npx prisma migrate dev)

```

### 4. Configure Environment Variables

You must configure `.env` files for both the backend and frontend.

**Backend Configuration:**

```bash
cd backend
cp .env.example .env
# Edit .env with your credentials (see section below)

```

**Frontend Configuration:**

```bash
cd ../frontend
cp .env.example .env

```

### 5. Run the Application

Open two terminal windows.

**Terminal 1 (Backend):**

```bash
cd backend
npm run dev

```

**Terminal 2 (Frontend):**

```bash
cd frontend
npm run dev

```

The frontend will be available at `http://localhost:5173` and the backend at `http://localhost:5002`.

---

## Environment Variables

### Backend (`backend/.env`)

```ini
# Server Configuration
PORT=5002
NODE_ENV=development

# Database Connection
DATABASE_URL=postgres://user:password@localhost:5432/codelearner

# Security (JWT)
JWT_SECRET=your_super_secure_secret_key
JWT_EXPIRES_IN=7d

# Email Service (Gmail SMTP)
# Note: You must use an App Password, not your login password.
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_16_char_app_password
EMAIL_FROM="CodeLearner <your_email@gmail.com>"

# AI Services
OPENAI_API_KEY=sk-your-openai-api-key

```

### Frontend (`frontend/.env`)

```ini
VITE_API_URL=http://localhost:5002

```

---

## API Overview

| Endpoint | Method | Description |
| --- | --- | --- |
| `/api/auth/signup` | POST | Register a new user and trigger OTP email. |
| `/api/auth/verify-email` | POST | Verify OTP code and issue JWT. |
| `/api/auth/login` | POST | Authenticate user (email/password) and return JWT. |
| `/api/repos` | POST | Ingest/Import a new repository. |
| `/api/repos/:id/search` | POST | Perform semantic search on a repo. |
| `/api/chat` | POST | Send a query to the AI assistant with repo context. |

---

## License

Distributed under the MIT License. See `LICENSE` for more information.

```

```