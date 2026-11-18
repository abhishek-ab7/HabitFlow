# Habit Flow - Deployment Guide

## Project Overview

**Habit Flow** is a full-stack habit tracker and goal planner with **real-time cloud sync** across all your devices (desktop, mobile, tablet). Built with Next.js 14, Supabase, and IndexedDB for a seamless offline-first experience.

---

## Features

- **Local-First Architecture**: Data stored in IndexedDB for instant access
- **Real-time Cloud Sync**: Automatic synchronization across all devices via Supabase
- **Offline Support**: Works fully offline, syncs when back online
- **Authentication**: Email/password and Google OAuth sign-in
- **PWA**: Install as a mobile/desktop app
- **Dark Mode**: Automatic theme detection + manual toggle
- **Beautiful UI**: Framer Motion animations, Tailwind CSS v4, shadcn/ui components

---

## Setup Instructions

### 1. Database Setup (Supabase)

1. **Create Supabase Project**: Visit [supabase.com](https://supabase.com) (already done - your project is active)

2. **Run SQL Migration**: 
   - Open your Supabase SQL Editor: https://supabase.com/dashboard/project/zqzegbvtoyqxidxuuzim/sql/new
   - Copy and paste the entire contents of `supabase-schema.sql` from the project root
   - Click "Run" to create all tables, indexes, RLS policies, and enable real-time

3. **Enable Google OAuth** (Optional):
   - Go to Authentication > Providers in Supabase dashboard
   - Enable Google provider
   - Add your Google OAuth credentials

### 2. Environment Variables

Your `.env.local` file is already configured with your Supabase credentials:

\`\`\`env
NEXT_PUBLIC_SUPABASE_URL=https://zqzegbvtoyqxidxuuzim.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your_key>
SUPABASE_SERVICE_ROLE_KEY=<your_secret>
NEXT_PUBLIC_APP_URL=http://localhost:3000
\`\`\`

**IMPORTANT**: Never commit `.env.local` to Git. It's already in `.gitignore`.

### 3. Local Development

\`\`\`bash
cd /home/abhi/Downloads/habit-tracker

# Install dependencies (already done)
npm install

# Run development server
npm run dev

# Open http://localhost:3000
\`\`\`

### 4. Testing the App

1. **First Visit**: You'll be redirected to `/login`
2. **Create Account**: Sign up with email/password or Google
3. **Load Demo Data**: Click "Load Demo Data" on dashboard to see the app in action
4. **Try Offline**: 
   - Disconnect internet
   - Add/edit habits - they save to IndexedDB
   - Reconnect - watch the sync indicator show "Syncing..." then "Synced"

---

## Deployment to Vercel

### Option 1: Deploy via Vercel CLI

\`\`\`bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd /home/abhi/Downloads/habit-tracker
vercel

# Follow prompts:
# - Link to existing project or create new
# - Set environment variables when prompted
\`\`\`

### Option 2: Deploy via Vercel Dashboard

1. **Push to GitHub**:
   \`\`\`bash
   cd /home/abhi/Downloads/habit-tracker
   git init
   git add .
   git commit -m "Initial commit - Habit Flow"
   git branch -M main
   git remote add origin <your-github-repo-url>
   git push -u origin main
   \`\`\`

2. **Import to Vercel**:
   - Go to [vercel.com/new](https://vercel.com/new)
   - Import your GitHub repository
   - Add environment variables:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `SUPABASE_SERVICE_ROLE_KEY`
     - `NEXT_PUBLIC_APP_URL` (set to your production URL)
   - Click "Deploy"

3. **Update Supabase Auth Settings**:
   - Go to Supabase Dashboard > Authentication > URL Configuration
   - Add your Vercel deployment URL to "Site URL"
   - Add `https://<your-app>.vercel.app/auth/callback` to "Redirect URLs"

---

## Mobile Access

### As PWA (Recommended)

1. **On Mobile Browser**: Visit your deployed URL
2. **Install Prompt**: Browser will show "Add to Home Screen"
3. **Launch**: App opens full-screen like a native app
4. **Sync**: Sign in to sync with desktop data

### Responsive Web

- Works perfectly in any mobile browser
- Offline support via Service Worker
- Touch-optimized UI

---

## How Sync Works

### Architecture

\`\`\`
┌──────────────┐         ┌──────────────┐
│   Desktop    │◄───────►│   Supabase   │◄───────►│   Mobile     │
│   Browser    │  Sync   │   Postgres   │  Sync   │   Browser    │
│              │         │  + Realtime  │         │              │
│  IndexedDB   │         └──────────────┘         │  IndexedDB   │
│  (Offline)   │                                   │  (Offline)   │
└──────────────┘                                   └──────────────┘
\`\`\`

### Data Flow

1. **Create/Update**: Data saved to IndexedDB first (instant)
2. **Push**: If online, sync engine pushes to Supabase
3. **Real-time Listen**: Supabase broadcasts changes to all connected devices
4. **Pull**: Other devices receive update and merge into their IndexedDB
5. **Offline**: Changes queue locally, sync when connection restored

### Conflict Resolution

- **Strategy**: Last-write-wins (timestamp-based)
- **Scope**: Per-record (habits, completions, goals, milestones)
- **Future**: Can implement CRDTs for more sophisticated merging

---

## Project Structure

\`\`\`
habit-tracker/
├── src/
│   ├── app/                  # Next.js 14 App Router
│   │   ├── (routes)/        # Main pages
│   │   ├── auth/            # Auth callback & error pages
│   │   ├── login/           # Login page
│   │   └── layout.tsx       # Root layout with providers
│   ├── components/
│   │   ├── auth/            # Login/signup form
│   │   ├── dashboard/       # Dashboard widgets
│   │   ├── habits/          # Habit grid & modals
│   │   ├── goals/           # Goal cards & forms
│   │   ├── analytics/       # Charts & insights
│   │   ├── layout/          # Header with sync indicator
│   │   ├── motion/          # Animation primitives
│   │   ├── pwa/             # Service worker registration
│   │   ├── skeletons/       # Loading states
│   │   └── ui/              # shadcn/ui components
│   ├── lib/
│   │   ├── supabase/        # Supabase client (browser + server)
│   │   ├── sync/            # Sync engine (THE MAGIC)
│   │   ├── stores/          # Zustand state management
│   │   ├── calculations/    # Stats & analytics logic
│   │   ├── db.ts            # Dexie.js (IndexedDB wrapper)
│   │   ├── types.ts         # TypeScript interfaces
│   │   └── quotes.ts        # Motivational quotes
│   ├── providers/
│   │   ├── auth-provider.tsx   # Auth context
│   │   ├── sync-provider.tsx   # Sync status context
│   │   └── theme-provider.tsx  # Dark/light theme
│   └── middleware.ts        # Auth redirect logic
├── public/
│   ├── manifest.json        # PWA manifest
│   ├── sw.js                # Service worker
│   └── icons/               # App icons
├── supabase-schema.sql      # Database migration
└── .env.local               # Environment variables (DO NOT COMMIT)
\`\`\`

---

## Key Files to Understand

| File | Purpose |
|------|---------|
| `src/lib/sync/sync-engine.ts` | Core sync logic - push/pull/realtime |
| `src/providers/sync-provider.tsx` | React context for sync status |
| `src/lib/stores/habit-store.ts` | Habit state + sync integration |
| `src/lib/stores/goal-store.ts` | Goal state + sync integration |
| `src/middleware.ts` | Auth redirect (login required) |
| `supabase-schema.sql` | Database schema with RLS policies |

---

## Troubleshooting

### Sync Not Working

1. **Check Auth**: User must be logged in
2. **Check Network**: Open DevTools > Network tab
3. **Check Supabase**: Ensure RLS policies are active
4. **Check Logs**: Look for errors in browser console

### Build Errors

\`\`\`bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Rebuild
npm run build
\`\`\`

### Database Issues

- **RLS Blocking Reads**: Ensure policies are created (run SQL migration)
- **Realtime Not Working**: Check that tables are added to `supabase_realtime` publication

---

## Next Steps / Enhancements

- [ ] Add profile picture upload
- [ ] Implement habit reminders (push notifications)
- [ ] Export data to CSV/JSON
- [ ] Share goals with friends
- [ ] Add habit templates
- [ ] Gamification (badges, streaks, leaderboards)
- [ ] Native mobile apps (React Native)

---

## Tech Stack

- **Framework**: Next.js 14 (App Router, Server Components)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui (Radix UI)
- **Animation**: Framer Motion
- **State**: Zustand
- **Local Storage**: Dexie.js (IndexedDB)
- **Backend**: Supabase (Postgres + Auth + Realtime)
- **Deployment**: Vercel
- **PWA**: Service Worker, Web Manifest

---

## License

MIT

---

## Support

For issues or questions:
- Check the code comments
- Review Supabase docs: https://supabase.com/docs
- Review Next.js docs: https://nextjs.org/docs

---

**Enjoy building better habits with Habit Flow!** 🚀
