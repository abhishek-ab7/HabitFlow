# Habit Flow

A beautiful, offline-first habit tracker and goal planner with **real-time cloud sync** across all your devices.

![Habit Flow](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)
![Supabase](https://img.shields.io/badge/Supabase-Cloud-green?style=for-the-badge&logo=supabase)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript)

---

## Features

- ✅ **Track Daily Habits** - Grid view with streaks and completion rates
- 🎯 **Manage Goals** - Milestones, deadlines, and progress tracking
- 📊 **Analytics Dashboard** - Heatmaps, charts, and insights
- 🔄 **Real-time Sync** - Works across desktop, mobile, and tablet
- 🔒 **Secure Auth** - Email/password + Google OAuth
- 📱 **PWA Support** - Install as a native app
- 🌙 **Dark Mode** - Auto-detect or manual toggle
- ⚡ **Offline-First** - Works without internet, syncs when online

---

## Quick Start

### 1. Setup Database

1. Open [Supabase SQL Editor](https://supabase.com/dashboard/project/zqzegbvtoyqxidxuuzim/sql/new)
2. Copy & paste the contents of `supabase-schema.sql`
3. Click "Run"

### 2. Run Locally

\`\`\`bash
npm install
npm run dev
\`\`\`

Open http://localhost:3000

### 3. Deploy to Vercel

\`\`\`bash
vercel
\`\`\`

See `DEPLOYMENT.md` for detailed instructions.

---

## Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS v4
- **UI**: shadcn/ui, Framer Motion
- **State**: Zustand
- **Local Storage**: IndexedDB (Dexie.js)
- **Backend**: Supabase (Postgres + Auth + Realtime)
- **Deployment**: Vercel

---

## How Sync Works

1. **Write**: Data saves to local IndexedDB first (instant)
2. **Push**: If online, syncs to Supabase
3. **Listen**: Supabase broadcasts changes to all devices
4. **Merge**: Other devices pull updates and merge into local storage

**Result**: Your habits and goals are always in sync across all devices, even when offline.

---

## Project Structure

\`\`\`
src/
├── app/              # Next.js pages
├── components/       # React components
├── lib/
│   ├── sync/        # Sync engine (THE MAGIC)
│   ├── supabase/    # Database client
│   ├── stores/      # Zustand state
│   └── db.ts        # IndexedDB wrapper
└── providers/       # React contexts
\`\`\`

---

## Environment Variables

Create `.env.local`:

\`\`\`env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
\`\`\`

---

## Scripts

\`\`\`bash
npm run dev        # Start development server
npm run build      # Build for production
npm run start      # Start production server
npm run lint       # Run ESLint
\`\`\`

---

## License

MIT

---

**Build better habits, achieve your goals.** 🚀
