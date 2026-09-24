# StartupVarsity Platform

## Overview Of startupVarsity
StartupVarsity is a comprehensive startup incubation program platform built as a full-stack web application. The platform manages a 6-month intensive program that helps students and professionals build real startups with ₹10L seed funding, mentorship, and structured learning. The application serves three primary user experiences
## Current Status (December 2025).

**Development Progress:**
- Complete database schema with 21 tables implemented using Drizzle ORM
- Database indexes on all foreign keys and composite indexes (teamId, userId) for performance
- Full backend API with authentication and role-based access control (RBAC)
- All marketing site pages built and connected to backend APIs
- 5 role-based portal dashboards (Admin, Mentor, Learner, University, Corporate)
- Studio IDE with Monaco Editor for team workspaces
- Comprehensive seed script with:
  - 1 Admin, 3 Mentors, 1 University org + user, 1 Corporate org + user
  - 1 Cohort (16 weeks) with 2 teams (10 learners each)
  - Role distribution per Business Plan v2: 2 Promoters, 2 Co-Promoters, 6 Members
  - Cap table entries: Promoters 40% (2×20%), Co-Promoters 20% (2×10%), SV 10%, ESOP 20%, Corporate 10%
  - Stipend rules: A=₹25k (Promoter), B=₹20k (Co-Promoter), C=₹10k (Member)
  - 12 problem statements (2 per track across 6 tracks)
  - 8 sprints with tasks, reviews, and stipend disbursements
- Dashboard APIs fully integrated with database (no mock data):
  - /api/my-team, /api/my-sprint, /api/my-tasks, /api/my-stipends (Learner)
  - /api/mentor/teams, /api/mentor/reviews, /api/mentor/sessions, /api/mentor/honorariums (Mentor)
  - /api/admin/stats, /api/admin/recent-applications, /api/admin/cohort-stats (Admin)
  - /api/university/stats (University)
  - /api/corporate/stats (Corporate)
- Sprint Board feature complete:
  - Route: /app/sprint-board
  - Kanban task board with TODO, In Progress, Done columns
  - Task creation with assignee selection from team members
  - Daily standups logging
  - Demo upload with both URL input and direct file upload to object storage
  - Evidence locker with GitHub webhook stub
  - Sprint pass/fail toggle with stipend engine trigger
- Enhanced Mentor Dashboard with tabbed interface:
  - Teams, Sprints, Reviews, Sessions, Honorarium tabs
  - Visual rubric-based review system with sliders for 6 criteria:
    - Code Quality, Reliability, UX, Customer Interviews, Go-to-Market, Professionalism
    - 1-5 scale with descriptive labels (Poor to Excellent)
    - Auto-calculated score with manual override option
  - CSV export for honorarium records

**Demo Accounts:**
- Admin: admin@startupvarsity.com / admin123
- Mentors: mentor1@startupvarsity.com, mentor2@startupvarsity.com, mentor3@startupvarsity.com / admin123
- University: university@iitd.ac.in / admin123
- Corporate: corporate@infosys.com / admin123
- Learners: learner1@demo.com through learner20@demo.com / admin123

1. **Marketing Site (/(site))** - Public-facing website for program discovery and applications
2. **Program Portal (/(app))** - Role-based dashboards for learners, mentors, universities, corporates, and administrators
3. **SV Studio (/(studio))** - Minimal cloud IDE environment for team collaboration

The platform handles the complete lifecycle from application submission through team formation, sprint-based development, funding disbursement, equity management, and stipend payments.

## Local Development Setup

### Prerequisites

- Node.js 20+
- [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html), configured with your Rooman account (`aws configure`)
- [session-manager-plugin](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html)

Your AWS user needs `ssm:StartSession` and `ssm:DescribeInstanceInformation`. Ask an admin if you do not have them.

### Steps

```bash
npm install
cp .env.example .env      # then fill in the values (ask a teammate)

./scripts/db-tunnel.sh    # terminal 1 -- leave running
npm run dev               # terminal 2
```

The app comes up on http://localhost:5000.

### Why the tunnel is needed

The dev database is the RDS instance **`startupvarsity-local`** in `ap-south-1`. It has
`PubliclyAccessible=false`, so its endpoint only resolves to a private VPC address —
connecting from a laptop just hangs until it times out. `scripts/db-tunnel.sh` forwards
`localhost:5433` to it through AWS Systems Manager, using an EC2 instance that already
sits in that VPC. No VPN and no SSH key required.

`DATABASE_URL` in `.env` therefore points at `127.0.0.1:5433`, not at the RDS hostname.

> **Do not point local development at `startupvarsity-portal-db`.** That is the
> production database behind www.startupvarsity.com. The two are not interchangeable —
> different engine versions (17.9 vs 15.17), master users, and database names.

### Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `Connection terminated due to connection timeout` on startup | The tunnel is not running. Start `./scripts/db-tunnel.sh` and retry. It does not survive a reboot. |
| `EADDRINUSE ... 0.0.0.0:5000` | An earlier `npm run dev` is still alive. `pkill -f 'tsx server/index.ts'`, then retry. |
| `port 5433 is already in use` from the tunnel script | A tunnel is already open — you may not need a second one. Otherwise `LOCAL_PORT=5544 ./scripts/db-tunnel.sh` and update `DATABASE_URL` to match. |
| `bastion ... is not reachable via SSM` | Missing IAM permissions, or the instance is stopped. Ask an admin, or pass another SSM-managed instance in the same VPC: `BASTION_INSTANCE_ID=i-xxxx ./scripts/db-tunnel.sh`. |
| `Failed to initialize Keycloak client: outgoing request timed out` | Expected off the office network — `sso.startupvarsity.com` filters by IP. The server keeps running and normal login works. Set `ENABLE_SSO=false` to skip the delay. |

### Known rough edges

- `.env` sets `NODE_TLS_REJECT_UNAUTHORIZED=0`, which disables TLS certificate
  verification for the **entire process**, not just the RDS connection. It is also
  hardcoded in `drizzle.config.ts` and several files under `scripts/`. The proper fix is
  bundling the `ap-south-1` RDS CA certificate instead.
- `npm run db:push` applies schema changes to whatever `DATABASE_URL` points at. Confirm
  you are on the tunnel before running it.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture.

**Technology Stack:**
- React 18 with TypeScript for type safety
- Vite as the build tool and development server
- Wouter for lightweight client-side routing
- TanStack Query (React Query) for server state management and caching
- React Hook Form with Zod for form validation

**UI Component System:**
- Shadcn/ui component library with Radix UI primitives
- Tailwind CSS for styling with custom design tokens
- Custom theme system supporting light/dark modes
- Responsive design with mobile-first approach

**Design System:**
- Typography: Inter for UI text, JetBrains Mono for code
- Custom color system based on HSL with CSS variables
- Consistent spacing primitives using Tailwind's spacing scale
- Three distinct design aesthetics: Marketing (reference-based), Portal (productivity-focused), Studio (minimal IDE)

### Backend Architecture

**Server Framework:**
- Express.js for HTTP server and API routing
- Session-based authentication using express-session with MemoryStore
- RESTful API design pattern for all endpoints

**Database Layer:**
- PostgreSQL as the primary database (via Neon serverless)
- Drizzle ORM for type-safe database queries and schema management
- Connection pooling using @neondatabase/serverless with WebSocket support
- Schema-first approach with TypeScript types generated from Drizzle schemas

**Data Models:**
The platform uses a comprehensive relational schema including:
- User management (multi-role system: Admin, Learner, Mentor, University, Corporate)
- Organization management for universities and corporates
- Cohort and team structures
- Application workflow (New → Review → Offer → Paid → Reject)
- Sprint-based project management with tasks and reviews
- Financial tracking (seed funds, cap tables, stipend disbursements, invoices)
- Evidence tracking (PRs, CI runs, tickets, documentation)
- Content management (blog posts, FAQs, problem statements)

**Authentication & Authorization:**
- Session-based authentication with HTTP-only cookies
- Role-based access control (RBAC) enforced at route level
- Session storage in memory (development) with production-ready configuration
- Secure session handling with configurable cookie settings
- Flexible admin privilege system:
  - `isAdmin` boolean field in users table allows any user to have admin capabilities alongside their primary role
  - Users with `role=ADMIN` or `isAdmin=true` can access admin features
  - Admin Users management page at `/app/admin/users` for granting/revoking admin privileges
  - API endpoints: `/api/admin/users/:id/grant-admin` and `/api/admin/users/:id/revoke-admin`

### File Storage

**Google Cloud Storage Integration:**
- Uses @google-cloud/storage for file uploads
- Presigned URL pattern for secure file access
- Support for multiple file types (documents, images, demos)
- Uppy.js integration for enhanced upload experience




### Business Logic.

**Seed Funding Model:**
- ₹10,00,000 total seed fund per team
- Equity distribution: Promoters 40% (2×20%), Co-Promoters 30% (3×10%), StartupVarsity 10%, Pool 20%
- Cap table tracking with cash and equity components
- Source tracking for fund composition

**Stipend System:**
- Role-based monthly stipends (Promoter: ₹25k, Co-Promoter: ₹20k, Member: ₹10k)
- 4-month disbursement period
- Sprint-gating mechanism: stipends released only if current sprint passed
- Status tracking: Pending, Released, Hold

**Financial Tracking:**
- Micro P&L per team showing inflows, pass-throughs, and outflows
- Invoice management for program fees and other charges
- Integration-ready for payment gateway (Razorpay mentioned but not fully implemented)

### Code Organization.

**Monorepo Structure:**  
- `/client` - Frontend React application
- `/server` - Backend Express application
- `/shared` - Shared TypeScript types and schemas
- `/attached_assets` - Static assets and documentation

**Path Aliases:**
- `@/*` → client/src
- `@shared/*` → shared directory
- `@assets/*` → attached_assets directory

**Build Process:**
- Client builds to `dist/public` via Vite
- Server bundles to `dist/index.cjs` via esbuild
- Development mode uses Vite middleware for HMR
- Production serves static client files from Express

### Development Workflow

**Development Mode:**
- Vite dev server with HMR
- Express API server
- Hot module replacement for client code
- TypeScript type checking

**Type Safety:**
- Shared schema definitions using Drizzle and Zod
- End-to-end type safety from database to frontend
- Strict TypeScript configuration
- Form validation schemas derived from database schemas

## External Dependenci**Database:**
- Neon Serverless PostgreSQL with WebSocket support
- Connection pooling for scalability
- Drizzle Kit for migrations

**UI Libraries:**
- Radix UI primitives for accessible components
- Lucide React for icons
- Monaco Editor for code editing in Studio
- Framer Motion mentioned in design docs (not fully implemented)

**Developer Tools:**
- Replit-specific plugins for development environment
- ESLint and Prettier for code quality (configured but not shown)
- Build tooling: esbuild for server, Vite for client

**Third-Party Services (Mentioned but Not Fully Implemented):**
- Razorpay for payment processing
- Resend for email delivery
- Redis + BullMQ for background jobs
- GitHub, Jira/Zoho Projects, Zoho CRM integrations
- S3-compatible storage (R2/MinIO) for file storage

**Session Management:**
- express-session with configurable store
- MemoryStore for development
- Production-ready with secure cookie configuration
- 7-day session duration

**Form Handling:**
- React Hook Form for form state management
- Zod for runtime validation
- @hookform/resolvers for Zod integration
- Type-safe form schemas matching database models
#Improve the sidebar tothe colapsable
-side bar is coloapseble
-added the changes in the enable-team-application
