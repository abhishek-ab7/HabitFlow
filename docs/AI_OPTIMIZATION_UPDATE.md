# ✅ AI Auto-Triggers Disabled

I've updated the **Habit Suggestions** feature to prevent it from automatically triggering on load. This ensures you have full control over when AI requests are made.

### 🛠️ Changes Made

**File:** [`HabitSuggestions.tsx`](file:///home/abhi/Downloads/habit-tracker/src/components/habits/HabitSuggestions.tsx)
- ❌ **Removed:** `useEffect` hook that was auto-fetching suggestions whenever goals/habits changed.
- ✨ **Added:** "Generate Suggestions" button for the empty state.
- 🧹 **Cleanup:** Removed unused imports.

### 🔍 System-Wide Check
I verified other AI widgets to ensure they respect your preference:
- **AI Coach**: ✅ Already requires manual "Connect AI Coach" click.
- **Daily Quote**: ✅ Already requires manual "Get Daily Quote" click.
- **Stack Suggestions**: ✅ Already requires manual "Generate" click.

**Result:** No AI features will trigger automatically on page load. You are now fully in control of your API usage! 🎯
