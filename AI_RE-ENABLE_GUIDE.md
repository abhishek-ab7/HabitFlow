# How to Re-Enable AI Features

This guide explains how to turn AI features back on when you're ready.

---

## Quick Re-Enable (1 Minute)

### Step 1: Update Environment Variable

Edit `.env.local` in your project root:

```bash
# Change this line from:
NEXT_PUBLIC_ENABLE_AI_FEATURES=false

# To:
NEXT_PUBLIC_ENABLE_AI_FEATURES=true
```

### Step 2: Restart Your Development Server

```bash
# Stop the current server (Ctrl+C)
# Then restart:
npm run dev
```

That's it! All AI features are now active again.

---

## What Gets Re-Enabled?

### Dashboard (/)
- ✅ BurnoutAlert component
- ✅ PersonalizedQuote component  
- ✅ AICoachWidget component

### Habits Page (/habits)
- ✅ HabitSuggestions component
- ✅ HabitStackSuggestions component

### Goal Detail Pages (/goals/[id])
- ✅ MilestoneGenerator component

### Task Components (anywhere tasks are shown)
- ✅ "AI Priority" button on TaskCard
- ✅ "Auto-Generate" subtasks button in CreateTaskModal

### API Endpoints (all 9)
- ✅ /api/ai/burnout-check
- ✅ /api/ai/coach
- ✅ /api/ai/generate-habit-description
- ✅ /api/ai/generate-milestones
- ✅ /api/ai/generate-subtasks
- ✅ /api/ai/personalize-quote
- ✅ /api/ai/prioritize-task
- ✅ /api/ai/recommend-habits
- ✅ /api/ai/suggest-habit-stacks

---

## Deployment (Vercel)

To enable AI features in production:

### Option 1: Via Vercel Dashboard (Recommended)

1. Go to your [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Navigate to **Settings** → **Environment Variables**
4. Find `NEXT_PUBLIC_ENABLE_AI_FEATURES` or create a new one
5. Set the value to `true`
6. Select which environments to apply (Production, Preview, Development)
7. Click **Save**
8. Redeploy:
   - Go to **Deployments** tab
   - Click the three dots (...) on the latest deployment
   - Click **Redeploy**

### Option 2: Via Vercel CLI

```bash
# Set the environment variable
vercel env add NEXT_PUBLIC_ENABLE_AI_FEATURES

# When prompted:
# - Value: true
# - Environments: Production, Preview, Development

# Redeploy
vercel --prod
```

---

## Verifying AI Features Are Active

### 1. Check Dashboard
- Navigate to `/` (homepage/dashboard)
- You should see:
  - BurnoutAlert card (if you have burnout risk)
  - PersonalizedQuote card with motivational quote
  - AICoachWidget with daily briefing

### 2. Check Habits Page
- Navigate to `/habits`
- Look for the right sidebar with 2 AI cards:
  - "AI Habit Suggestions"
  - "Smart Habit Stacking"

### 3. Check Browser Console
- Open DevTools (F12)
- Go to Network tab
- Refresh the page
- Look for API calls to `/api/ai/*` endpoints
- They should return status 200 (not 503)

### 4. Check Build Output
When you run `npm run build`, you should see all 9 AI API routes:

```
Route (app)
├ ƒ /api/ai/burnout-check
├ ƒ /api/ai/coach
├ ƒ /api/ai/generate-habit-description
├ ƒ /api/ai/generate-milestones
├ ƒ /api/ai/generate-subtasks
├ ƒ /api/ai/personalize-quote
├ ƒ /api/ai/prioritize-task
├ ƒ /api/ai/recommend-habits
└ ƒ /api/ai/suggest-habit-stacks
```

---

## Troubleshooting

### AI Components Still Not Showing?

**Cause:** Browser cache might be stale

**Fix:**
1. Hard refresh your browser: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
2. Or clear browser cache completely
3. Restart dev server: `npm run dev`

### API Routes Returning 503?

**Cause:** Environment variable not loaded

**Fix:**
1. Double-check `.env.local` has `NEXT_PUBLIC_ENABLE_AI_FEATURES=true`
2. Ensure there are no typos
3. Restart dev server (IMPORTANT - env changes require restart)
4. Check the terminal output shows: `- Environments: .env.local`

### Build Errors?

**Cause:** TypeScript errors or dependency issues

**Fix:**
```bash
# Clear caches and rebuild
rm -rf .next node_modules
npm install
npm run build
```

### Still Getting Quota Errors?

**Cause:** Gemini API quota exceeded or invalid API key

**Fix:**
1. Check your Gemini API key in `.env.local`
2. Verify quota at [Google Cloud Console](https://console.cloud.google.com/)
3. If needed, get a new API key from [Google AI Studio](https://aistudio.google.com/apikey)
4. Update `GEMINI_API_KEY` in `.env.local`
5. Restart dev server

---

## Performance Tips When Re-Enabled

To keep your app fast with AI enabled:

### 1. Monitor API Usage
- Keep an eye on your Gemini API quota
- Free tier: 1,500 requests/day
- Your app uses ~795/day with all features enabled

### 2. Leverage Caching
The app automatically caches AI responses:
- Quotes: 6 hours
- Coach briefings: 6 hours
- Habit suggestions: 7 days
- Milestones: 7 days
- Stacks: 3 days

### 3. Optimize Page Load
If dashboard feels slow:
- Consider loading AI components after initial render
- Use Suspense boundaries
- Show skeleton loaders while fetching

### 4. Selective Enable (Future Enhancement)
If you want to enable only some features, you can:
1. Modify `src/lib/ai-features-flag.ts`
2. Add granular flags like `isCoachEnabled()`, `isQuotesEnabled()`, etc.
3. Wrap components with specific flags

---

## Summary

**To Enable:**
1. Set `NEXT_PUBLIC_ENABLE_AI_FEATURES=true` in `.env.local`
2. Restart dev server: `npm run dev`

**To Disable:**
1. Set `NEXT_PUBLIC_ENABLE_AI_FEATURES=false` in `.env.local`
2. Restart dev server: `npm run dev`

**Current State:** ❌ DISABLED (as per your request)

---

## Need Help?

- Check the main setup guide: `SETUP_GUIDE.md`
- Review implementation details: `AI_FEATURES_IMPLEMENTATION_GUIDE.md`
- All code is intact - nothing was deleted, just hidden behind feature flag

**Last Updated:** February 3, 2026  
**Status:** All AI features successfully disabled and can be re-enabled anytime
