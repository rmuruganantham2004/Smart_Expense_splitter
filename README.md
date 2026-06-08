# Smart Expense Splitter 💸

A full-stack premium web application for splitting expenses, balancing groups, and optimizing settlements. This application features an **AI-powered natural language parser** for typing plain-English bills and a **minimized cash-flow optimization engine** using directed debt graphs.

---

## Technical Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Zustand, Recharts, React Router, Axios, Heroicons.
- **Backend**: Fastify, TypeScript, Prisma ORM, Zod validator.
- **Database**: PostgreSQL (Prisma Client).
- **Testing**: Vitest unit testing.
- **Infrastructure**: Docker Compose (for PostgreSQL container services).

---

## Folder Architecture

```
SmartExpense/
├── database/
│   └── schema.prisma         # Prisma database schema definition
├── backend/
│   ├── src/
│   │   ├── app.ts            # Fastify Server entry point
│   │   ├── controllers/      # Routing handlers (Auth, Groups, Expenses, AI, Settlements)
│   │   ├── routes/           # Fastify routes registries
│   │   ├── middleware/       # JWT Authorization pre-handlers
│   │   ├── utils/            # Settlement optimizer (minimizeCashFlow) & Regex NLP parser
│   │   └── tests/            # Vitest unit test suites
│   ├── prisma/
│   │   └── seed.ts           # Mock database seeder script
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── main.tsx          # React application entry mount
│   │   ├── App.tsx           # Router mappings & Auth guards
│   │   ├── components/       # Responsive Sidebar layout & notification logs
│   │   ├── pages/            # View screens (Dashboard, Groups, AI console, Settlements, SVG Debt Graph)
│   │   ├── store/            # Zustand global storage stores
│   │   ├── services/         # Axios REST client interfaces
│   │   ├── index.css         # Tailwind configurations & Glassmorphic visual templates
│   │   └── types/            # App TypeScript interfaces
│   ├── tailwind.config.js
│   └── package.json
├── docker-compose.yml        # PostgreSQL service orchestrator
├── .env                      # Local server configurations
└── README.md
```

---

## Getting Started

### Prerequisites
Make sure you have installed:
- [Node.js (v18 or higher)](https://nodejs.org)
- [Docker & Docker Compose](https://www.docker.com/)

---

### Step-by-Step Setup

#### 1. Setup the Database Services
Spin up the PostgreSQL database container in the background:
```bash
docker-compose up -d
```
*This binds PostgreSQL to port `5432` locally.*

#### 2. Configure Environment Variables
We created a default `.env` file at the root. You can configure it, or leave it as default:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/smartexpense?schema=public"
PORT=4000
JWT_SECRET="smartexpense-super-secret-key-change-in-production"
OPENAI_API_KEY="" # Optional: Add OpenAI API key to use GPT-4o-mini parsing
```

#### 3. Run Backend Migrations & Seeding
Install backend dependencies, execute Prisma migrations to generate the tables, and seed the database with mock records (Param, Akash, Rahul, Vijay with group Goa Trip 🏖️):
```bash
# Navigate to backend
cd backend

# Execute database migrations
npm run prisma:migrate

# Seed mock database values
npm run seed

# Start the Fastify dev server
npm run dev
```
*The backend server starts listening at [http://localhost:4000](http://localhost:4000).*

#### 4. Run the React Frontend
Open a new terminal window to start the React web server:
```bash
# Navigate to frontend
cd frontend

# Start dev server
npm run dev
```
*Open [http://localhost:5173](http://localhost:5173) in your browser.*

---

## Running Unit Tests

Run Vitest to verify settlement math optimization, fractions rounding splits, and regex NLP parsing patterns:
```bash
cd backend
npm run test
```

---

## Mock Login Credentials
To inspect the seeded data right away, log in with any of these users (password is `password123` for all):
- **Param**: `param@example.com`
- **Akash**: `akash@example.com`
- **Rahul**: `rahul@example.com`
- **Vijay**: `vijay@example.com`
