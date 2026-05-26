(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/src/providers/theme-provider.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ThemeProvider",
    ()=>ThemeProvider,
    "useTheme",
    ()=>useTheme
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature();
'use client';
;
const ThemeContext = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createContext"])(undefined);
function ThemeProvider({ children }) {
    _s();
    const [theme, setTheme] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        "ThemeProvider.useState": ()=>{
            if ("TURBOPACK compile-time truthy", 1) {
                const stored = localStorage.getItem('theme');
                return stored || 'system';
            }
            //TURBOPACK unreachable
            ;
        }
    }["ThemeProvider.useState"]);
    const [resolvedTheme, setResolvedTheme] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        "ThemeProvider.useState": ()=>{
            if ("TURBOPACK compile-time truthy", 1) {
                const stored = localStorage.getItem('theme');
                const activeTheme = stored || 'system';
                if (activeTheme === 'system') {
                    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                }
                if (activeTheme === 'auto') {
                    const hour = new Date().getHours();
                    return hour >= 18 || hour < 5 ? 'dark' : 'light';
                }
                return activeTheme;
            }
            //TURBOPACK unreachable
            ;
        }
    }["ThemeProvider.useState"]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "ThemeProvider.useEffect": ()=>{
            const root = window.document.documentElement;
            // Remove all theme classes first
            root.classList.remove('light', 'dark', 'theme-morning', 'theme-afternoon', 'theme-night');
            let newResolved;
            let classesToAdd = [];
            if (theme === 'system') {
                newResolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                classesToAdd.push(newResolved);
            } else if (theme === 'auto') {
                const hour = new Date().getHours();
                if (hour >= 5 && hour < 12) {
                    newResolved = 'light';
                    classesToAdd.push('theme-morning');
                } else if (hour >= 12 && hour < 18) {
                    newResolved = 'light';
                    classesToAdd.push('theme-afternoon');
                } else {
                    newResolved = 'dark';
                    classesToAdd.push('theme-night', 'dark');
                }
            } else {
                newResolved = theme;
                classesToAdd.push(newResolved);
            }
            root.classList.add(...classesToAdd);
            Promise.resolve().then({
                "ThemeProvider.useEffect": ()=>{
                    setResolvedTheme(newResolved);
                }
            }["ThemeProvider.useEffect"]);
            localStorage.setItem('theme', theme);
        }
    }["ThemeProvider.useEffect"], [
        theme
    ]);
    // Listen for system theme changes and time changes for auto
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "ThemeProvider.useEffect": ()=>{
            if (theme === 'system') {
                const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
                const handleChange = {
                    "ThemeProvider.useEffect.handleChange": (e)=>{
                        const root = window.document.documentElement;
                        root.classList.remove('light', 'dark', 'theme-morning', 'theme-afternoon', 'theme-night');
                        const newTheme = e.matches ? 'dark' : 'light';
                        root.classList.add(newTheme);
                        setResolvedTheme(newTheme);
                    }
                }["ThemeProvider.useEffect.handleChange"];
                mediaQuery.addEventListener('change', handleChange);
                return ({
                    "ThemeProvider.useEffect": ()=>mediaQuery.removeEventListener('change', handleChange)
                })["ThemeProvider.useEffect"];
            } else if (theme === 'auto') {
                // Check every minute if time theme needs to change
                const interval = setInterval({
                    "ThemeProvider.useEffect.interval": ()=>{
                        const hour = new Date().getHours();
                        const root = window.document.documentElement;
                        let shouldUpdate = false;
                        let isDark = hour >= 18 || hour < 5;
                        if (isDark && !root.classList.contains('theme-night')) shouldUpdate = true;
                        if (hour >= 5 && hour < 12 && !root.classList.contains('theme-morning')) shouldUpdate = true;
                        if (hour >= 12 && hour < 18 && !root.classList.contains('theme-afternoon')) shouldUpdate = true;
                        if (shouldUpdate) {
                            root.classList.remove('light', 'dark', 'theme-morning', 'theme-afternoon', 'theme-night');
                            if (hour >= 5 && hour < 12) {
                                root.classList.add('theme-morning');
                                setResolvedTheme('light');
                            } else if (hour >= 12 && hour < 18) {
                                root.classList.add('theme-afternoon');
                                setResolvedTheme('light');
                            } else {
                                root.classList.add('theme-night', 'dark');
                                setResolvedTheme('dark');
                            }
                        }
                    }
                }["ThemeProvider.useEffect.interval"], 60000);
                return ({
                    "ThemeProvider.useEffect": ()=>clearInterval(interval)
                })["ThemeProvider.useEffect"];
            }
        }
    }["ThemeProvider.useEffect"], [
        theme
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ThemeContext.Provider, {
        value: {
            theme,
            setTheme,
            resolvedTheme
        },
        children: children
    }, void 0, false, {
        fileName: "[project]/src/providers/theme-provider.tsx",
        lineNumber: 125,
        columnNumber: 5
    }, this);
}
_s(ThemeProvider, "kJDXAz9T3CrQT6QyEN7RwQA3xPI=");
_c = ThemeProvider;
function useTheme() {
    _s1();
    const context = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useContext"])(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}
_s1(useTheme, "b9L3QQ+jgeyIrH0NfHrJ8nn7VMU=");
var _c;
__turbopack_context__.k.register(_c, "ThemeProvider");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/supabase/client.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createClient",
    ()=>createClient,
    "getSupabaseClient",
    ()=>getSupabaseClient
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$ssr$2f$dist$2f$module$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@supabase/ssr/dist/module/index.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$ssr$2f$dist$2f$module$2f$createBrowserClient$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@supabase/ssr/dist/module/createBrowserClient.js [app-client] (ecmascript)");
;
function createClient() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$ssr$2f$dist$2f$module$2f$createBrowserClient$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createBrowserClient"])(("TURBOPACK compile-time value", "https://zqzegbvtoyqxidxuuzim.supabase.co"), ("TURBOPACK compile-time value", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxemVnYnZ0b3lxeGlkeHV1emltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5NzcwODQsImV4cCI6MjA4NDU1MzA4NH0.3ML4sc6DlmtzOUfXS6zUDRY5klzITgGSriD7f6QOmC8"), {
        cookieOptions: {
            sameSite: 'lax',
            secure: true
        }
    });
}
// Singleton instance for client-side usage
let browserClient = null;
function getSupabaseClient() {
    if (!browserClient) {
        browserClient = createClient();
    }
    return browserClient;
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/providers/auth-provider.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AuthProvider",
    ()=>AuthProvider,
    "useAuth",
    ()=>useAuth
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/supabase/client.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature();
'use client';
;
;
;
const AuthContext = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createContext"])(undefined);
function AuthProvider({ children }) {
    _s();
    const [user, setUser] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [session, setSession] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [isLoading, setIsLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"])();
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "AuthProvider.useEffect": ()=>{
            const supabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSupabaseClient"])();
            // Get initial session
            supabase.auth.getSession().then({
                "AuthProvider.useEffect": ({ data: { session } })=>{
                    setSession(session);
                    setUser(session?.user ?? null);
                    setIsLoading(false);
                }
            }["AuthProvider.useEffect"]);
            // Listen for auth changes
            const { data: { subscription } } = supabase.auth.onAuthStateChange({
                "AuthProvider.useEffect": async (event, session)=>{
                    setSession(session);
                    setUser(session?.user ?? null);
                    setIsLoading(false);
                    // Refresh server components on auth changes
                    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'PASSWORD_RECOVERY') {
                        router.refresh();
                    }
                }
            }["AuthProvider.useEffect"]);
            return ({
                "AuthProvider.useEffect": ()=>{
                    subscription.unsubscribe();
                }
            })["AuthProvider.useEffect"];
        }
    }["AuthProvider.useEffect"], []);
    const signUp = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AuthProvider.useCallback[signUp]": async (email, password, fullName)=>{
            const supabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSupabaseClient"])();
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: `${window.location.origin}/auth/callback`,
                    data: fullName ? {
                        full_name: fullName
                    } : undefined
                }
            });
            return {
                error
            };
        }
    }["AuthProvider.useCallback[signUp]"], []);
    const signIn = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AuthProvider.useCallback[signIn]": async (email, password)=>{
            const supabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSupabaseClient"])();
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });
            return {
                error
            };
        }
    }["AuthProvider.useCallback[signIn]"], []);
    const signInWithGoogle = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AuthProvider.useCallback[signInWithGoogle]": async ()=>{
            const supabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSupabaseClient"])();
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/auth/callback`
                }
            });
            return {
                error
            };
        }
    }["AuthProvider.useCallback[signInWithGoogle]"], []);
    const signOut = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AuthProvider.useCallback[signOut]": async ()=>{
            const supabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSupabaseClient"])();
            await supabase.auth.signOut();
        }
    }["AuthProvider.useCallback[signOut]"], []);
    const resetPassword = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AuthProvider.useCallback[resetPassword]": async (email)=>{
            const supabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSupabaseClient"])();
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/auth/callback?type=recovery`
            });
            return {
                error
            };
        }
    }["AuthProvider.useCallback[resetPassword]"], []);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(AuthContext.Provider, {
        value: {
            user,
            session,
            isLoading,
            isAuthenticated: !!session,
            signUp,
            signIn,
            signInWithGoogle,
            signOut,
            resetPassword
        },
        children: children
    }, void 0, false, {
        fileName: "[project]/src/providers/auth-provider.tsx",
        lineNumber: 106,
        columnNumber: 5
    }, this);
}
_s(AuthProvider, "h2uYgQUfBGcNyzTjuaPirpRTem4=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"]
    ];
});
_c = AuthProvider;
function useAuth() {
    _s1();
    const context = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useContext"])(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
_s1(useAuth, "b9L3QQ+jgeyIrH0NfHrJ8nn7VMU=");
var _c;
__turbopack_context__.k.register(_c, "AuthProvider");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/db.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "batchCompleteHabits",
    ()=>batchCompleteHabits,
    "cleanupDuplicateCompletions",
    ()=>cleanupDuplicateCompletions,
    "cleanupDuplicateGoals",
    ()=>cleanupDuplicateGoals,
    "cleanupDuplicateHabits",
    ()=>cleanupDuplicateHabits,
    "createGoal",
    ()=>createGoal,
    "createHabit",
    ()=>createHabit,
    "createMilestone",
    ()=>createMilestone,
    "createTask",
    ()=>createTask,
    "db",
    ()=>db,
    "deleteGoal",
    ()=>deleteGoal,
    "deleteHabit",
    ()=>deleteHabit,
    "deleteMilestone",
    ()=>deleteMilestone,
    "deleteTask",
    ()=>deleteTask,
    "freezeCompletion",
    ()=>freezeCompletion,
    "getAllCompletionsInRange",
    ()=>getAllCompletionsInRange,
    "getGoals",
    ()=>getGoals,
    "getHabits",
    ()=>getHabits,
    "getHabitsForRoutine",
    ()=>getHabitsForRoutine,
    "getMilestones",
    ()=>getMilestones,
    "getRoutinesForHabit",
    ()=>getRoutinesForHabit,
    "getRoutinesForHabits",
    ()=>getRoutinesForHabits,
    "getSettings",
    ()=>getSettings,
    "getTasks",
    ()=>getTasks,
    "linkHabitToRoutine",
    ()=>linkHabitToRoutine,
    "reorderHabits",
    ()=>reorderHabits,
    "seedDemoData",
    ()=>seedDemoData,
    "setFocusGoal",
    ()=>setFocusGoal,
    "toggleCompletion",
    ()=>toggleCompletion,
    "toggleMilestone",
    ()=>toggleMilestone,
    "unlinkAllHabitsFromRoutine",
    ()=>unlinkAllHabitsFromRoutine,
    "unlinkHabitFromRoutine",
    ()=>unlinkHabitFromRoutine,
    "updateGoal",
    ()=>updateGoal,
    "updateHabit",
    ()=>updateHabit,
    "updateHabitRoutineOrder",
    ()=>updateHabitRoutineOrder,
    "updateMilestone",
    ()=>updateMilestone,
    "updateSettings",
    ()=>updateSettings,
    "updateTask",
    ()=>updateTask
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$dexie$2f$import$2d$wrapper$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/dexie/import-wrapper.mjs [app-client] (ecmascript)");
;
// Define the database schema
const db = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$dexie$2f$import$2d$wrapper$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"]('HabitFlowDB');
// Schema version 5 - Added HabitRoutines junction table for many-to-many
db.version(5).stores({
    habits: 'id, userId, name, category, archived, order, createdAt, routineId',
    completions: 'id, userId, habitId, date, [habitId+date]',
    goals: 'id, userId, title, areaOfLife, status, archived, isFocus, deadline, createdAt',
    milestones: 'id, userId, goalId, completed, order',
    userSettings: 'id, userId',
    tasks: 'id, userId, status, priority, due_date, created_at',
    routines: 'id, userId, isActive, orderIndex',
    habitRoutines: 'id, habitId, routineId, [habitId+routineId]'
}).upgrade(async (tx)=>{
    // Migrate existing routineId data to habitRoutines junction table
    const habits = await tx.table('habits').toArray();
    const habitRoutines = habits.filter((h)=>h.routineId).map((h)=>({
            id: crypto.randomUUID(),
            habitId: h.id,
            routineId: h.routineId,
            orderIndex: 0,
            createdAt: new Date().toISOString()
        }));
    if (habitRoutines.length > 0) {
        await tx.table('habitRoutines').bulkAdd(habitRoutines);
    }
});
// Schema version 6 - Add updatedAt timestamps for conflict resolution
db.version(6).stores({
    habits: 'id, userId, name, category, archived, order, createdAt, routineId',
    completions: 'id, userId, habitId, date, [habitId+date], updatedAt',
    goals: 'id, userId, title, areaOfLife, status, archived, isFocus, deadline, createdAt, updatedAt',
    milestones: 'id, userId, goalId, completed, order, updatedAt',
    userSettings: 'id, userId, updatedAt',
    tasks: 'id, userId, status, priority, due_date, created_at, updated_at',
    routines: 'id, userId, isActive, orderIndex, updatedAt',
    habitRoutines: 'id, habitId, routineId, [habitId+routineId], updatedAt'
}).upgrade(async (tx)=>{
    // Backfill updatedAt = createdAt for existing records (Option A)
    const now = new Date().toISOString();
    // Completions
    const completions = await tx.table('completions').toArray();
    for (const c of completions){
        if (!c.updatedAt) {
            await tx.table('completions').update(c.id, {
                updatedAt: c.createdAt || now
            });
        }
    }
    // Milestones
    const milestones = await tx.table('milestones').toArray();
    for (const m of milestones){
        if (!m.updatedAt) {
            await tx.table('milestones').update(m.id, {
                updatedAt: m.createdAt || now
            });
        }
    }
    // Goals
    const goals = await tx.table('goals').toArray();
    for (const g of goals){
        if (!g.updatedAt) {
            await tx.table('goals').update(g.id, {
                updatedAt: g.createdAt || now
            });
        }
    }
    // UserSettings
    const settings = await tx.table('userSettings').toArray();
    for (const s of settings){
        if (!s.updatedAt) {
            await tx.table('userSettings').update(s.id, {
                updatedAt: s.createdAt || now
            });
        }
    }
    // Routines
    const routines = await tx.table('routines').toArray();
    for (const r of routines){
        if (!r.updatedAt) {
            await tx.table('routines').update(r.id, {
                updatedAt: r.createdAt || now
            });
        }
    }
    // HabitRoutines
    const habitRoutines = await tx.table('habitRoutines').toArray();
    for (const hr of habitRoutines){
        if (!hr.updatedAt) {
            await tx.table('habitRoutines').update(hr.id, {
                updatedAt: hr.createdAt || now
            });
        }
    }
});
// Schema version 7 - Add sub-tasks and routine completions
db.version(7).stores({
    habits: 'id, userId, name, category, archived, order, createdAt, routineId',
    completions: 'id, userId, habitId, date, [habitId+date], updatedAt',
    goals: 'id, userId, title, areaOfLife, status, archived, isFocus, deadline, createdAt, updatedAt',
    milestones: 'id, userId, goalId, completed, order, updatedAt',
    userSettings: 'id, userId, updatedAt',
    tasks: 'id, userId, status, priority, due_date, created_at, updated_at, parentTaskId, depth',
    routines: 'id, userId, isActive, orderIndex, updatedAt',
    habitRoutines: 'id, habitId, routineId, [habitId+routineId], updatedAt',
    routineCompletions: 'id, userId, routineId, date, [routineId+date], updatedAt'
}).upgrade(async (tx)=>{
    // Backfill depth = 0 for existing tasks
    const tasks = await tx.table('tasks').toArray();
    for (const task of tasks){
        if (task.depth === undefined) {
            await tx.table('tasks').update(task.id, {
                depth: 0,
                parentTaskId: null
            });
        }
    }
});
async function getHabits(userId) {
    if (!userId) return [];
    return db.habits.where('userId').equals(userId).filter((h)=>!h.archived).sortBy('order');
}
async function createHabit(data) {
    const now = new Date().toISOString();
    const habit = {
        id: crypto.randomUUID(),
        userId: data.userId,
        name: data.name,
        icon: data.icon || '✓',
        category: data.category,
        targetDaysPerWeek: data.targetDaysPerWeek,
        archived: false,
        order: await db.habits.where('userId').equals(data.userId).count(),
        createdAt: now,
        updatedAt: now
    };
    await db.habits.add(habit);
    return habit;
}
async function updateHabit(id, data) {
    await db.habits.update(id, {
        ...data,
        updatedAt: new Date().toISOString()
    });
}
async function deleteHabit(id) {
    // Soft delete - mark as archived with timestamp
    const now = new Date().toISOString();
    await db.habits.update(id, {
        archived: true,
        archivedAt: now,
        updatedAt: now
    });
// Note: We keep completions for history
}
async function reorderHabits(orderedIds) {
    await db.transaction('rw', db.habits, async ()=>{
        for(let i = 0; i < orderedIds.length; i++){
            await db.habits.update(orderedIds[i], {
                order: i
            });
        }
    });
}
async function toggleCompletion(habitId, date, userId) {
    const existing = await db.completions.where('[habitId+date]').equals([
        habitId,
        date
    ]).first();
    const now = new Date().toISOString();
    if (existing) {
        // Soft delete / Toggle - update status instead of deleting
        const updated = {
            ...existing,
            completed: !existing.completed,
            updatedAt: now
        };
        await db.completions.update(existing.id, updated);
        return updated;
    } else {
        // Create new
        const completion = {
            id: crypto.randomUUID(),
            userId,
            habitId,
            date,
            completed: true,
            createdAt: now,
            updatedAt: now
        };
        await db.completions.add(completion);
        return completion;
    }
}
async function freezeCompletion(habitId, date, userId) {
    const existing = await db.completions.where('[habitId+date]').equals([
        habitId,
        date
    ]).first();
    const now = new Date().toISOString();
    if (existing) {
        const updated = {
            ...existing,
            completed: true,
            status: 'frozen',
            updatedAt: now
        };
        await db.completions.update(existing.id, updated);
        return updated;
    } else {
        const completion = {
            id: crypto.randomUUID(),
            userId,
            habitId,
            date,
            completed: true,
            status: 'frozen',
            createdAt: now,
            updatedAt: now
        };
        await db.completions.add(completion);
        return completion;
    }
}
async function batchCompleteHabits(habitIds, date, userId) {
    const results = [];
    await db.transaction('rw', db.completions, async ()=>{
        for (const habitId of habitIds){
            const existing = await db.completions.where('[habitId+date]').equals([
                habitId,
                date
            ]).first();
            const now = new Date().toISOString();
            if (existing) {
                if (!existing.completed || existing.status !== 'completed') {
                    const updated = {
                        ...existing,
                        completed: true,
                        status: 'completed',
                        updatedAt: now
                    };
                    await db.completions.update(existing.id, updated);
                    results.push(updated);
                } else {
                    results.push(existing);
                }
            } else {
                const newCompletion = {
                    id: crypto.randomUUID(),
                    habitId,
                    date,
                    completed: true,
                    status: 'completed',
                    userId,
                    createdAt: now,
                    updatedAt: now
                };
                await db.completions.add(newCompletion);
                results.push(newCompletion);
            }
        }
    });
    return results;
}
async function getAllCompletionsInRange(startDate, endDate, userId) {
    return db.completions.where('date').between(startDate, endDate, true, true).filter((c)=>c.userId === userId).toArray();
}
async function cleanupDuplicateCompletions() {
    // Find and remove duplicate completions (same habitId + date)
    const allCompletions = await db.completions.toArray();
    const seen = new Map(); // key: habitId-date, value: first completion id
    const duplicates = [];
    for (const completion of allCompletions){
        const key = `${completion.habitId}-${completion.date}`;
        if (seen.has(key)) {
            // This is a duplicate, mark for deletion
            duplicates.push(completion.id);
        } else {
            // First occurrence, keep it
            seen.set(key, completion.id);
        }
    }
    // Delete duplicates
    if (duplicates.length > 0) {
        await db.completions.bulkDelete(duplicates);
    }
    return duplicates.length;
}
async function cleanupDuplicateHabits() {
    // Find and remove duplicate habits (same name + category)
    const allHabits = await db.habits.toArray();
    const seen = new Map(); // key: name-category, value: first habit
    const duplicates = [];
    const completionUpdates = [];
    for (const habit of allHabits){
        const key = `${habit.name}-${habit.category}`;
        const existing = seen.get(key);
        if (existing) {
            // This is a duplicate
            // Keep the one with earlier creation date
            if (new Date(habit.createdAt) < new Date(existing.createdAt)) {
                // Current habit is older, keep it and delete existing
                duplicates.push(existing.id);
                // Mark completions for update from existing to current
                const comps = await db.completions.where('habitId').equals(existing.id).toArray();
                comps.forEach((c)=>completionUpdates.push({
                        id: c.id,
                        habitId: habit.id
                    }));
                seen.set(key, habit);
            } else {
                // Existing is older, delete current
                duplicates.push(habit.id);
                // Mark completions for update from current to existing
                const comps = await db.completions.where('habitId').equals(habit.id).toArray();
                comps.forEach((c)=>completionUpdates.push({
                        id: c.id,
                        habitId: existing.id
                    }));
            }
        } else {
            // First occurrence, keep it
            seen.set(key, habit);
        }
    }
    // Update completions to point to the kept habit
    for (const update of completionUpdates){
        await db.completions.update(update.id, {
            habitId: update.habitId
        });
    }
    // Delete duplicate habits
    if (duplicates.length > 0) {
        await db.habits.bulkDelete(duplicates);
    }
    return duplicates.length;
}
async function cleanupDuplicateGoals() {
    // Find and remove duplicate goals (same title, case-insensitive)
    const allGoals = await db.goals.toArray();
    const seen = new Map(); // key: title (lowercase), value: first goal
    const duplicates = [];
    const milestoneUpdates = [];
    for (const goal of allGoals){
        const key = goal.title.toLowerCase();
        const existing = seen.get(key);
        if (existing) {
            // This is a duplicate
            // Keep the one with earlier creation date
            if (new Date(goal.createdAt) < new Date(existing.createdAt)) {
                // Current goal is older, keep it and delete existing
                duplicates.push(existing.id);
                // Mark milestones for update from existing to current
                const miles = await db.milestones.where('goalId').equals(existing.id).toArray();
                miles.forEach((m)=>milestoneUpdates.push({
                        id: m.id,
                        goalId: goal.id
                    }));
                seen.set(key, goal);
            } else {
                // Existing is older, delete current
                duplicates.push(goal.id);
                // Mark milestones for update from current to existing
                const miles = await db.milestones.where('goalId').equals(goal.id).toArray();
                miles.forEach((m)=>milestoneUpdates.push({
                        id: m.id,
                        goalId: existing.id
                    }));
            }
        } else {
            // First occurrence, keep it
            seen.set(key, goal);
        }
    }
    // Update milestones to point to the kept goal
    for (const update of milestoneUpdates){
        await db.milestones.update(update.id, {
            goalId: update.goalId
        });
    }
    // Delete duplicate goals
    if (duplicates.length > 0) {
        await db.goals.bulkDelete(duplicates);
    }
    return duplicates.length;
}
async function getGoals(userId) {
    if (!userId) return [];
    return db.goals.where('userId').equals(userId).filter((g)=>!g.archived).toArray();
}
async function createGoal(data) {
    const now = new Date().toISOString();
    const goal = {
        id: crypto.randomUUID(),
        ...data,
        createdAt: now,
        startDate: now,
        updatedAt: now
    };
    await db.goals.add(goal);
    return goal;
}
async function updateGoal(id, data) {
    await db.goals.update(id, {
        ...data,
        updatedAt: new Date().toISOString()
    });
}
async function deleteGoal(id) {
    await db.goals.delete(id);
    await db.milestones.where('goalId').equals(id).delete();
}
async function setFocusGoal(goalId) {
    const goal = await db.goals.get(goalId);
    if (goal) {
        // Toggle the focus status
        await db.goals.update(goalId, {
            isFocus: !goal.isFocus,
            updatedAt: new Date().toISOString()
        });
    }
}
async function getMilestones(goalId) {
    return db.milestones.where('goalId').equals(goalId).sortBy('order');
}
async function createMilestone(data) {
    const count = await db.milestones.where('goalId').equals(data.goalId).count();
    const now = new Date().toISOString();
    const milestone = {
        id: crypto.randomUUID(),
        ...data,
        completed: false,
        order: count,
        createdAt: now,
        updatedAt: now
    };
    await db.milestones.add(milestone);
    return milestone;
}
async function updateMilestone(id, data) {
    await db.milestones.update(id, {
        ...data,
        updatedAt: new Date().toISOString()
    });
}
async function deleteMilestone(id) {
    await db.milestones.delete(id);
}
async function toggleMilestone(id) {
    const milestone = await db.milestones.get(id);
    if (!milestone) return null;
    const now = new Date().toISOString();
    const updated = {
        ...milestone,
        completed: !milestone.completed,
        completedAt: !milestone.completed ? now : undefined,
        updatedAt: now
    };
    await db.milestones.update(id, updated);
    return updated;
}
async function getSettings(userId) {
    if (!userId) return undefined;
    return db.userSettings.where('userId').equals(userId).first();
}
async function updateSettings(data) {
    if (!data.userId) return;
    const existing = await getSettings(data.userId);
    const now = new Date().toISOString();
    if (existing) {
        await db.userSettings.update(existing.id, {
            ...data,
            updatedAt: now
        });
    } else {
        const settings = {
            id: crypto.randomUUID(),
            userId: data.userId,
            theme: data.theme || 'system',
            userName: data.userName,
            weekStartsOn: data.weekStartsOn ?? 0,
            showMotivationalQuotes: data.showMotivationalQuotes ?? true,
            defaultCategory: data.defaultCategory || 'health',
            createdAt: now,
            updatedAt: now,
            xp: 0,
            level: 1,
            gems: 0,
            streakShield: 0,
            avatarId: 'avatar-1',
            soundEnabled: data.soundEnabled ?? true,
            hapticsEnabled: data.hapticsEnabled ?? true,
            stats: data.stats || {
                vitality: 1,
                intelligence: 1,
                discipline: 1,
                charisma: 1,
                wealth: 1,
                creativity: 1
            },
            unlockedThemes: data.unlockedThemes || [],
            dashboardLayout: data.dashboardLayout || [
                'hero',
                'metrics',
                'today-tasks',
                'habit-overview',
                'focus-goal',
                'ai-quote',
                'ai-coach',
                'quick-actions'
            ]
        };
        await db.userSettings.add(settings);
    }
}
async function seedDemoData(userId) {
    // Clear existing data for this user
    await db.habits.where('userId').equals(userId).delete();
    await db.completions.where('userId').equals(userId).delete();
    // Note: We might want to keep goals/milestones or clear them too if they are demo data
    // For now, let's strictly clear what we are about to seed to avoid duplicates if run multiple times
    // Create demo habits
    const demoHabits = [
        {
            id: crypto.randomUUID(),
            userId: userId,
            name: 'Morning Exercise',
            icon: '🏃',
            category: 'health',
            targetDaysPerWeek: 5,
            archived: false,
            order: 0,
            createdAt: new Date().toISOString()
        },
        {
            id: crypto.randomUUID(),
            userId: userId,
            name: 'Read for 30 minutes',
            icon: '📚',
            category: 'learning',
            targetDaysPerWeek: 7,
            archived: false,
            order: 1,
            createdAt: new Date().toISOString()
        },
        {
            id: crypto.randomUUID(),
            userId: userId,
            name: 'Meditate',
            icon: '🧘',
            category: 'health',
            targetDaysPerWeek: 7,
            archived: false,
            order: 2,
            createdAt: new Date().toISOString()
        }
    ];
    await db.habits.bulkAdd(demoHabits);
    // Create demo completions for the past week
    const today = new Date();
    const completions = [];
    for(let i = 0; i < 7; i++){
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        demoHabits.forEach((habit, index)=>{
            // Random completion pattern
            if (Math.random() > 0.3) {
                completions.push({
                    id: crypto.randomUUID(),
                    userId: userId,
                    habitId: habit.id,
                    date: dateStr,
                    completed: true
                });
            }
        });
    }
    await db.completions.bulkAdd(completions);
}
async function getTasks(userId) {
    if (!userId) return [];
    return db.tasks.where('userId').equals(userId).filter((t)=>t.status !== 'archived').reverse().sortBy('created_at');
}
async function createTask(data) {
    const now = new Date().toISOString();
    const task = {
        id: crypto.randomUUID(),
        userId: data.userId,
        title: data.title,
        description: data.description || null,
        status: 'todo',
        priority: data.priority,
        due_date: data.due_date || null,
        goal_id: data.goal_id || null,
        tags: data.tags || [],
        metadata: {},
        created_at: now,
        updated_at: now
    };
    await db.tasks.add(task);
    return task;
}
async function updateTask(id, data) {
    await db.tasks.update(id, {
        ...data,
        updated_at: new Date().toISOString()
    });
}
async function deleteTask(id) {
    // Soft delete
    await db.tasks.update(id, {
        status: 'archived',
        updated_at: new Date().toISOString()
    });
}
async function linkHabitToRoutine(habitId, routineId, orderIndex = 0) {
    // Check if link already exists
    const existing = await db.habitRoutines.where('[habitId+routineId]').equals([
        habitId,
        routineId
    ]).first();
    if (existing) {
        return existing;
    }
    const now = new Date().toISOString();
    const link = {
        id: crypto.randomUUID(),
        habitId,
        routineId,
        orderIndex,
        createdAt: now,
        updatedAt: now
    };
    await db.habitRoutines.add(link);
    return link;
}
async function unlinkHabitFromRoutine(habitId, routineId) {
    const link = await db.habitRoutines.where('[habitId+routineId]').equals([
        habitId,
        routineId
    ]).first();
    if (link) {
        await db.habitRoutines.delete(link.id);
    }
}
async function getRoutinesForHabit(habitId) {
    const links = await db.habitRoutines.where('habitId').equals(habitId).toArray();
    const routineIds = links.map((link)=>link.routineId);
    const routines = await db.routines.where('id').anyOf(routineIds).toArray();
    return routines;
}
async function getRoutinesForHabits(habitIds) {
    // Load all habit-routine links for these habits in one query
    const links = await db.habitRoutines.where('habitId').anyOf(habitIds).toArray();
    // Get unique routine IDs
    const routineIds = [
        ...new Set(links.map((link)=>link.routineId))
    ];
    // Load all routines in one query
    const routines = await db.routines.where('id').anyOf(routineIds).toArray();
    // Create a map of routineId -> Routine for fast lookup
    const routineMap = new Map(routines.map((r)=>[
            r.id,
            r
        ]));
    // Group routines by habitId
    const result = new Map();
    for (const link of links){
        const routine = routineMap.get(link.routineId);
        if (routine) {
            const existing = result.get(link.habitId) || [];
            result.set(link.habitId, [
                ...existing,
                routine
            ]);
        }
    }
    return result;
}
async function getHabitsForRoutine(routineId) {
    const links = await db.habitRoutines.where('routineId').equals(routineId).sortBy('orderIndex');
    const habitIds = links.map((link)=>link.habitId);
    const habits = await db.habits.where('id').anyOf(habitIds).toArray();
    // Sort habits according to the order in the routine
    const habitMap = new Map(habits.map((h)=>[
            h.id,
            h
        ]));
    return links.map((link)=>habitMap.get(link.habitId)).filter(Boolean);
}
async function updateHabitRoutineOrder(habitId, routineId, newOrderIndex) {
    const link = await db.habitRoutines.where('[habitId+routineId]').equals([
        habitId,
        routineId
    ]).first();
    if (link) {
        await db.habitRoutines.update(link.id, {
            orderIndex: newOrderIndex,
            updatedAt: new Date().toISOString()
        });
    }
}
async function unlinkAllHabitsFromRoutine(routineId) {
    const links = await db.habitRoutines.where('routineId').equals(routineId).toArray();
    const linkIds = links.map((link)=>link.id);
    await db.habitRoutines.bulkDelete(linkIds);
}
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/cleanup.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "cleanupAllDuplicates",
    ()=>cleanupAllDuplicates,
    "cleanupDuplicateCompletions",
    ()=>cleanupDuplicateCompletions,
    "cleanupDuplicateGoals",
    ()=>cleanupDuplicateGoals,
    "cleanupDuplicateHabits",
    ()=>cleanupDuplicateHabits,
    "countAllDuplicates",
    ()=>countAllDuplicates,
    "countDuplicateCompletions",
    ()=>countDuplicateCompletions,
    "countDuplicateGoals",
    ()=>countDuplicateGoals,
    "countDuplicateHabits",
    ()=>countDuplicateHabits
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/db.ts [app-client] (ecmascript)");
;
async function cleanupDuplicateCompletions() {
    const allCompletions = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].completions.toArray();
    // Group by habitId+date
    const completionMap = new Map();
    for (const completion of allCompletions){
        const key = `${completion.habitId}-${completion.date}`;
        if (!completionMap.has(key)) {
            completionMap.set(key, []);
        }
        completionMap.get(key).push(completion);
    }
    // Find and remove duplicates
    let removedCount = 0;
    for (const [key, completions] of completionMap.entries()){
        if (completions.length > 1) {
            // Keep the first one, delete the rest
            const [keep, ...duplicates] = completions;
            for (const duplicate of duplicates){
                await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].completions.delete(duplicate.id);
                removedCount++;
            }
            console.log(`Removed ${duplicates.length} duplicate completion(s) for ${key}`);
        }
    }
    return removedCount;
}
async function countDuplicateCompletions() {
    const allCompletions = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].completions.toArray();
    const seen = new Set();
    let duplicates = 0;
    for (const completion of allCompletions){
        const key = `${completion.habitId}-${completion.date}`;
        if (seen.has(key)) {
            duplicates++;
        } else {
            seen.add(key);
        }
    }
    return duplicates;
}
async function cleanupDuplicateHabits() {
    const allHabits = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].habits.toArray();
    const habitMap = new Map();
    // Group by name+category
    for (const habit of allHabits){
        const key = `${habit.name}-${habit.category}`;
        if (!habitMap.has(key)) {
            habitMap.set(key, []);
        }
        habitMap.get(key).push(habit);
    }
    let removedCount = 0;
    for (const [key, habits] of habitMap.entries()){
        if (habits.length > 1) {
            // Keep the oldest one (by createdAt), delete the rest
            const sorted = habits.sort((a, b)=>new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
            const [keep, ...duplicates] = sorted;
            // Migrate completions from duplicates to the kept habit
            for (const duplicate of duplicates){
                const completions = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].completions.where('habitId').equals(duplicate.id).toArray();
                for (const completion of completions){
                    // Check if completion already exists for this date
                    const existing = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].completions.where('[habitId+date]').equals([
                        keep.id,
                        completion.date
                    ]).first();
                    if (!existing) {
                        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].completions.update(completion.id, {
                            habitId: keep.id
                        });
                    } else {
                        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].completions.delete(completion.id);
                    }
                }
                // Delete the duplicate habit
                await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].habits.delete(duplicate.id);
                removedCount++;
            }
            console.log(`Removed ${duplicates.length} duplicate habit(s) for ${key}`);
        }
    }
    return removedCount;
}
async function countDuplicateHabits() {
    const allHabits = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].habits.toArray();
    const seen = new Set();
    let duplicates = 0;
    for (const habit of allHabits){
        const key = `${habit.name}-${habit.category}`;
        if (seen.has(key)) {
            duplicates++;
        } else {
            seen.add(key);
        }
    }
    return duplicates;
}
async function cleanupDuplicateGoals() {
    const allGoals = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].goals.toArray();
    const goalMap = new Map();
    // Group by title (case-insensitive)
    for (const goal of allGoals){
        const key = goal.title.toLowerCase();
        if (!goalMap.has(key)) {
            goalMap.set(key, []);
        }
        goalMap.get(key).push(goal);
    }
    let removedCount = 0;
    for (const [key, goals] of goalMap.entries()){
        if (goals.length > 1) {
            // Keep the oldest one (by createdAt), delete the rest
            const sorted = goals.sort((a, b)=>new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
            const [keep, ...duplicates] = sorted;
            // Migrate milestones from duplicates to the kept goal
            for (const duplicate of duplicates){
                const milestones = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].milestones.where('goalId').equals(duplicate.id).toArray();
                for (const milestone of milestones){
                    await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].milestones.update(milestone.id, {
                        goalId: keep.id
                    });
                }
                // Delete the duplicate goal
                await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].goals.delete(duplicate.id);
                removedCount++;
            }
            console.log(`Removed ${duplicates.length} duplicate goal(s) for ${key}`);
        }
    }
    return removedCount;
}
async function countDuplicateGoals() {
    const allGoals = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].goals.toArray();
    const seen = new Set();
    let duplicates = 0;
    for (const goal of allGoals){
        const key = goal.title.toLowerCase();
        if (seen.has(key)) {
            duplicates++;
        } else {
            seen.add(key);
        }
    }
    return duplicates;
}
async function cleanupAllDuplicates() {
    const habits = await cleanupDuplicateHabits();
    const goals = await cleanupDuplicateGoals();
    const completions = await cleanupDuplicateCompletions();
    return {
        habits,
        goals,
        completions
    };
}
async function countAllDuplicates() {
    const habits = await countDuplicateHabits();
    const goals = await countDuplicateGoals();
    const completions = await countDuplicateCompletions();
    return {
        habits,
        goals,
        completions
    };
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/stores/sync-status-store.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useSyncStatusStore",
    ()=>useSyncStatusStore
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/zustand/esm/react.mjs [app-client] (ecmascript)");
'use client';
;
const initialState = {
    isSyncing: false,
    lastSyncTime: null,
    syncError: null,
    entityStatus: {
        habits: 'synced',
        routines: 'synced',
        goals: 'synced',
        tasks: 'synced',
        completions: 'synced',
        routineCompletions: 'synced'
    },
    pendingChanges: 0
};
const useSyncStatusStore = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["create"])((set)=>({
        ...initialState,
        setIsSyncing: (syncing)=>set({
                isSyncing: syncing
            }),
        setLastSyncTime: (time)=>set({
                lastSyncTime: time
            }),
        setSyncError: (error)=>set({
                syncError: error
            }),
        setEntityStatus: (entity, status)=>set((state)=>({
                    entityStatus: {
                        ...state.entityStatus,
                        [entity]: status
                    }
                })),
        setPendingChanges: (count)=>set({
                pendingChanges: count
            }),
        reset: ()=>set(initialState)
    }));
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/sync/conflict-resolution.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/* eslint-disable @typescript-eslint/no-explicit-any */ // =============================================
// CONFLICT RESOLUTION UTILITY
// =============================================
// Intelligent conflict resolution for sync operations
// Strategy 1: Completed always wins (for boolean completed fields)
// Strategy 2: Completed status wins (for status fields)
// Strategy 3: Highest value wins (for XP/gems/level)
// Strategy 4: Most recent timestamp wins (fallback)
__turbopack_context__.s([
    "mergeGamificationFields",
    ()=>mergeGamificationFields,
    "resolveConflict",
    ()=>resolveConflict
]);
function resolveConflict(local, remote, options = {}) {
    // Strategy 0: Custom comparison (highest priority)
    if (options.customComparison) {
        const customResult = options.customComparison(local, remote);
        if (customResult && customResult !== 'equal') {
            return {
                winner: customResult,
                data: customResult === 'local' ? local : remote,
                reason: 'Custom comparison logic'
            };
        }
    }
    // Strategy 1: Completed always wins (for completions, milestones)
    if (options.preferCompleted && 'completed' in local && 'completed' in remote) {
        const localCompleted = local.completed === true;
        const remoteCompleted = remote.completed === true;
        if (localCompleted && !remoteCompleted) {
            return {
                winner: 'local',
                data: local,
                reason: '✅ Local is completed (completed always wins)'
            };
        }
        if (!localCompleted && remoteCompleted) {
            return {
                winner: 'remote',
                data: remote,
                reason: '✅ Remote is completed (completed always wins)'
            };
        }
    // Both completed or both incomplete - continue to next strategy
    }
    // Strategy 2: Completed status wins (for goals, tasks)
    if (options.completedStatuses && 'status' in local && 'status' in remote) {
        const localStatus = local.status;
        const remoteStatus = remote.status;
        const localIsCompleted = options.completedStatuses.includes(localStatus);
        const remoteIsCompleted = options.completedStatuses.includes(remoteStatus);
        if (localIsCompleted && !remoteIsCompleted) {
            return {
                winner: 'local',
                data: local,
                reason: `✅ Local has completed status: ${localStatus} (completed status wins)`
            };
        }
        if (!localIsCompleted && remoteIsCompleted) {
            return {
                winner: 'remote',
                data: remote,
                reason: `✅ Remote has completed status: ${remoteStatus} (completed status wins)`
            };
        }
    // Both completed or both incomplete - continue to next strategy
    }
    // Strategy 3: Highest value wins (for XP, gems, level)
    if (options.preferHigherValues && options.preferHigherValues.length > 0) {
        for (const field of options.preferHigherValues){
            const localValue = local[field];
            const remoteValue = remote[field];
            // Only compare if both have numeric values
            if (typeof localValue === 'number' && typeof remoteValue === 'number') {
                if (localValue > remoteValue) {
                    return {
                        winner: 'local',
                        data: local,
                        reason: `🏆 Local has higher ${String(field)}: ${localValue} > ${remoteValue} (highest value wins)`
                    };
                }
                if (remoteValue > localValue) {
                    return {
                        winner: 'remote',
                        data: remote,
                        reason: `🏆 Remote has higher ${String(field)}: ${remoteValue} > ${localValue} (highest value wins)`
                    };
                }
            }
        }
    // Values equal or not comparable - continue to next strategy
    }
    // Strategy 4: Most recent timestamp wins
    // Try updated_at first (snake_case for remote, camelCase for local), then created_at
    const localUpdatedAt = local.updated_at || local.updatedAt;
    const remoteUpdatedAt = remote.updated_at || remote.updatedAt;
    const localCreatedAt = local.created_at || local.createdAt;
    const remoteCreatedAt = remote.created_at || remote.createdAt;
    const localTime = new Date(localUpdatedAt || localCreatedAt || 0).getTime();
    const remoteTime = new Date(remoteUpdatedAt || remoteCreatedAt || 0).getTime();
    if (localTime > remoteTime) {
        const timestamp = new Date(localTime).toISOString();
        return {
            winner: 'local',
            data: local,
            reason: `⏰ Local is newer: ${timestamp} (timestamp wins)`
        };
    }
    if (remoteTime > localTime) {
        const timestamp = new Date(remoteTime).toISOString();
        return {
            winner: 'remote',
            data: remote,
            reason: `⏰ Remote is newer: ${timestamp} (timestamp wins)`
        };
    }
    // Strategy 5: Equal timestamps - prefer local (tie-breaker)
    return {
        winner: 'equal',
        data: local,
        reason: '⚖️ Timestamps equal, keeping local (tie-breaker)'
    };
}
function mergeGamificationFields(local, remote) {
    // Merge stats by taking max of each
    const mergedStats = {
        ...local.stats,
        ...remote.stats
    };
    if (local.stats && remote.stats) {
        for (const key of Object.keys(mergedStats)){
            mergedStats[key] = Math.max(local.stats[key] || 0, remote.stats[key] || 0);
        }
    }
    // Merge unlocked themes by union
    const mergedThemes = Array.from(new Set([
        ...local.unlockedThemes || [],
        ...remote.unlockedThemes || []
    ]));
    return {
        ...local,
        xp: Math.max(local.xp || 0, remote.xp || 0),
        level: Math.max(local.level || 0, remote.level || 0),
        gems: Math.max(local.gems || 0, remote.gems || 0),
        streakShield: Math.max(local.streakShield || 0, remote.streakShield || 0),
        stats: mergedStats,
        unlockedThemes: mergedThemes
    };
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/sync/sync-engine.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "SyncEngine",
    ()=>SyncEngine,
    "getSyncEngine",
    ()=>getSyncEngine
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
/* eslint-disable @typescript-eslint/no-explicit-any */ var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/supabase/client.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/db.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$cleanup$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/cleanup.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$stores$2f$sync$2d$status$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/stores/sync-status-store.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$sync$2f$conflict$2d$resolution$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/sync/conflict-resolution.ts [app-client] (ecmascript)");
;
;
;
;
;
// ===================
// CONSTANTS
// ===================
const SYNC_DEBOUNCE_MS = 1000;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000;
const BATCH_SIZE = 50;
const SYNC_WINDOW_DAYS = 90;
const SYNC_VERSION = '2.0.0'; // Bumped for habit property migration
class SyncEngine {
    supabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSupabaseClient"])();
    userId = null;
    isSyncing = false;
    syncLock = false;
    syncCallbacks = [];
    realtimeChannel = null;
    pendingOperations = new Map();
    syncDebounceTimer = null;
    lastSyncAt = null;
    isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    // Auth ready promise to prevent race conditions
    authReadyResolve;
    authReady = new Promise((resolve)=>{
        this.authReadyResolve = resolve;
    });
    // Entity-specific sync locks to prevent race conditions
    habitSyncLock = false;
    completionSyncLock = false;
    taskSyncLock = false;
    routineSyncLock = false;
    goalSyncLock = false;
    milestoneSyncLock = false;
    // Periodic duplicate cleanup
    duplicateCleanupInterval = null;
    constructor(){
        this.setupAuth();
        this.setupNetworkListeners();
        this.loadPendingOperations();
    }
    // ===================
    // INITIALIZATION
    // ===================
    async setupAuth() {
        try {
            const { data: { session } } = await this.supabase.auth.getSession();
            this.userId = session?.user?.id || null;
            console.log('[SyncEngine] Auth setup complete, userId:', this.userId);
            // Resolve the auth ready promise
            this.authReadyResolve();
            this.supabase.auth.onAuthStateChange((event, session)=>{
                const newUserId = session?.user?.id || null;
                if (newUserId !== this.userId) {
                    this.userId = newUserId;
                    console.log('[SyncEngine] Auth state changed, new userId:', this.userId);
                    if (newUserId) {
                        this.syncAll();
                        this.setupRealtime();
                    } else {
                        this.cleanupRealtime();
                        this.pendingOperations.clear();
                    }
                }
            });
            if (this.userId) {
                this.setupRealtime();
            }
        } catch (error) {
            this.log('error', 'Failed to setup auth', error);
            // Resolve anyway to prevent hanging
            this.authReadyResolve();
        }
    }
    setupNetworkListeners() {
        if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
        ;
        window.addEventListener('online', ()=>{
            this.isOnline = true;
            this.log('info', 'Back online, syncing pending changes...');
            this.processPendingOperations();
            this.syncAll();
        });
        window.addEventListener('offline', ()=>{
            this.isOnline = false;
            this.log('info', 'Offline mode activated');
            this.notifyStatus({
                type: 'idle',
                message: 'Offline - changes will sync when online'
            });
        });
    }
    async loadPendingOperations() {
        try {
            if (typeof localStorage === 'undefined') return;
            const stored = localStorage.getItem('habit_sync_pending');
            if (stored) {
                const operations = JSON.parse(stored);
                operations.forEach((op)=>this.pendingOperations.set(op.id, op));
            }
        } catch (error) {
            this.log('warn', 'Failed to load pending operations', error);
        }
    }
    // ===================
    // MIGRATION METHODS
    // ===================
    /**
   * Migrate habit properties to fix archived boolean mapping
   * This fixes the issue where remote.is_archived was not properly mapped to local archived property
   */ async migrateHabitProperties() {
        if (!this.userId) return;
        this.log('info', '🔧 Starting habit property migration...');
        try {
            const habits = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].habits.where('userId').equals(this.userId).toArray();
            let fixedCount = 0;
            for (const habit of habits){
                // Fix any habits with undefined or incorrectly typed archived property
                if (habit.archived === undefined || habit.archived === null) {
                    await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].habits.update(habit.id, {
                        archived: false
                    });
                    fixedCount++;
                }
            }
            this.log('info', `✅ Migration complete: Fixed ${fixedCount} habits`);
        } catch (error) {
            this.log('error', `❌ Migration failed: ${error}`);
        // Don't throw - allow app to continue even if migration fails
        }
    }
    /**
   * Check sync version and run migrations if needed
   * This ensures migrations run exactly once per user per version
   */ async checkAndRunMigrations() {
        if (!this.userId) {
            this.log('warn', 'Cannot run migrations: no user ID');
            return;
        }
        try {
            const storageKey = `sync_version_${this.userId}`;
            const currentVersion = localStorage.getItem(storageKey);
            if (currentVersion !== SYNC_VERSION) {
                this.log('info', `🔄 Version mismatch (${currentVersion} → ${SYNC_VERSION}), running migrations...`);
                // Run migrations
                await this.migrateHabitProperties();
                // Update version
                localStorage.setItem(storageKey, SYNC_VERSION);
                this.log('info', `✅ Migrations complete, version updated to ${SYNC_VERSION}`);
            } else {
                this.log('info', `✅ Sync version ${SYNC_VERSION} matches, skipping migrations`);
            }
        } catch (error) {
            this.log('error', `❌ Migration check failed: ${error}`);
        // Don't throw - allow app to continue
        }
    }
    savePendingOperations() {
        try {
            if (typeof localStorage === 'undefined') return;
            const operations = Array.from(this.pendingOperations.values());
            localStorage.setItem('habit_sync_pending', JSON.stringify(operations));
        } catch (error) {
            this.log('warn', 'Failed to save pending operations', error);
        }
    }
    // ===================
    // LOGGING
    // ===================
    log(level, message, data) {
        const prefix = `[SyncEngine]`;
        const timestamp = new Date().toISOString();
        if ("TURBOPACK compile-time truthy", 1) {
            switch(level){
                case 'info':
                    console.log(`${prefix} ${timestamp} - ${message}`, data || '');
                    break;
                case 'warn':
                    console.warn(`${prefix} ${timestamp} - ${message}`, data || '');
                    break;
                case 'error':
                    console.error(`${prefix} ${timestamp} - ${message}`, data || '');
                    break;
            }
        }
    }
    // ===================
    // STATUS MANAGEMENT
    // ===================
    onSyncStatusChange(callback) {
        this.syncCallbacks.push(callback);
        return ()=>{
            this.syncCallbacks = this.syncCallbacks.filter((cb)=>cb !== callback);
        };
    }
    notifyStatus(status) {
        this.syncCallbacks.forEach((cb)=>{
            try {
                cb(status);
            } catch (error) {
                this.log('error', 'Status callback error', error);
            }
        });
        // Update global store
        try {
            const store = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$stores$2f$sync$2d$status$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useSyncStatusStore"].getState();
            if (status.type === 'syncing') {
                store.setIsSyncing(true);
                if (status.message) store.setSyncError(null);
            } else if (status.type === 'success') {
                store.setIsSyncing(false);
                store.setLastSyncTime(status.syncedAt || new Date());
                store.setSyncError(null);
            } else if (status.type === 'error') {
                store.setIsSyncing(false);
                store.setSyncError(status.message);
            } else {
                store.setIsSyncing(false);
            }
        } catch (e) {
            // Ignore store errors during sync to prevent crash
            console.warn('Failed to update sync store', e);
        }
    }
    // ===================
    // MAIN SYNC FUNCTIONS
    // ===================
    async syncAll() {
        // Wait for auth to be ready first
        await this.authReady;
        if (!this.userId) {
            this.log('warn', '- Sync skipped - no user (after auth ready)');
            return;
        }
        if (this.syncLock) {
            this.log('info', 'Sync already in progress, skipping');
            return;
        }
        if (!this.isOnline) {
            this.notifyStatus({
                type: 'idle',
                message: 'Offline - waiting for connection'
            });
            return;
        }
        this.syncLock = true;
        this.isSyncing = true;
        this.notifyStatus({
            type: 'syncing',
            message: 'Starting sync...',
            progress: 0
        });
        try {
            // Process any pending operations first
            await this.processPendingOperations();
            this.notifyStatus({
                type: 'syncing',
                message: 'Syncing habits...',
                progress: 20
            });
            // Sync all data types with proper error handling
            const results = await Promise.allSettled([
                this.syncHabitsWithRetry(),
                this.syncGoalsWithRetry(),
                this.syncTasksWithRetry(),
                this.syncRoutinesWithRetry(),
                this.syncUserSettingsWithRetry()
            ]);
            // Check for failures
            const failures = results.filter((r)=>r.status === 'rejected');
            if (failures.length > 0) {
                this.log('error', 'Some sync operations failed', failures);
            }
            this.notifyStatus({
                type: 'syncing',
                message: 'Syncing completions...',
                progress: 50
            });
            // Sync completions and milestones (depends on habits/goals)
            await Promise.allSettled([
                this.syncCompletionsWithRetry(),
                this.syncMilestonesWithRetry(),
                this.syncHabitRoutinesWithRetry(),
                this.syncRoutineCompletions()
            ]);
            this.notifyStatus({
                type: 'syncing',
                message: 'Cleaning up duplicates...',
                progress: 80
            });
            // Cleanup duplicates with logging
            await this.cleanupLocalDuplicatesWithLogging();
            // Start periodic cleanup if not already running
            if (!this.duplicateCleanupInterval && ("TURBOPACK compile-time value", "object") !== 'undefined') {
                this.duplicateCleanupInterval = setInterval(()=>{
                    this.cleanupLocalDuplicatesQuietly();
                }, 30000); // Every 30 seconds
                this.log('info', '🔄 Periodic duplicate cleanup started (every 30s)');
            }
            this.lastSyncAt = new Date();
            this.notifyStatus({
                type: 'success',
                message: 'All data synced',
                syncedAt: this.lastSyncAt
            });
            this.log('info', 'Sync completed successfully');
        } catch (error) {
            this.log('error', 'Sync failed', error);
            this.notifyStatus({
                type: 'error',
                message: 'Sync failed - will retry',
                retryable: true
            });
        } finally{
            this.syncLock = false;
            this.isSyncing = false;
        }
    }
    async withRetry(operation, name, maxRetries = MAX_RETRY_ATTEMPTS) {
        let lastError;
        for(let attempt = 1; attempt <= maxRetries; attempt++){
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                this.log('warn', `${name} failed (attempt ${attempt}/${maxRetries})`, error?.message);
                if (attempt < maxRetries) {
                    await this.delay(RETRY_DELAY_MS * attempt);
                }
            }
        }
        throw lastError;
    }
    delay(ms) {
        return new Promise((resolve)=>setTimeout(resolve, ms));
    }
    // ===================
    // PENDING OPERATIONS
    // ===================
    async processPendingOperations() {
        if (this.pendingOperations.size === 0) return;
        this.log('info', `Processing ${this.pendingOperations.size} pending operations`);
        const operations = Array.from(this.pendingOperations.values()).sort((a, b)=>a.timestamp - b.timestamp);
        for (const op of operations){
            try {
                await this.executePendingOperation(op);
                this.pendingOperations.delete(op.id);
            } catch  {
                op.retryCount++;
                if (op.retryCount >= MAX_RETRY_ATTEMPTS) {
                    this.log('error', `Dropping failed operation after ${MAX_RETRY_ATTEMPTS} attempts`, op);
                    this.pendingOperations.delete(op.id);
                }
            }
        }
        this.savePendingOperations();
    }
    async executePendingOperation(op) {
        if (!this.userId) return;
        switch(op.type){
            case 'create':
            case 'update':
                await this.supabase.from(op.table).upsert(op.data);
                break;
            case 'delete':
                await this.supabase.from(op.table).delete().eq('id', op.data.id);
                break;
        }
    }
    queueOperation(op) {
        const operation = {
            ...op,
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            retryCount: 0
        };
        this.pendingOperations.set(operation.id, operation);
        this.savePendingOperations();
        // Try to process immediately if online
        if (this.isOnline && !this.isSyncing) {
            this.processPendingOperations();
        }
    }
    // ===================
    // HABITS SYNC
    // ===================
    async syncHabitsWithRetry() {
        return this.withRetry(()=>this.syncHabits(), 'Habits sync');
    }
    async syncHabits() {
        if (!this.userId) return;
        // Prevent concurrent syncs
        if (this.habitSyncLock) {
            this.log('warn', 'Habit sync already running, skipping');
            return;
        }
        this.habitSyncLock = true;
        try {
            return await this.syncHabitsImpl();
        } finally{
            this.habitSyncLock = false;
        }
    }
    async syncHabitsImpl() {
        if (!this.userId) return;
        this.log('info', '🔄 Starting habit sync...');
        // Pull ALL habits from Supabase (including archived for proper merge)
        const { data: remoteHabits, error } = await this.supabase.from('habits').select('*').eq('user_id', this.userId);
        if (error) throw error;
        const localHabits = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].habits.where('userId').equals(this.userId).toArray();
        this.log('info', `📊 Habit counts: Local=${localHabits.length}, Remote=${remoteHabits?.length || 0}`);
        // Create lookup maps - use lowercase for case-insensitive matching
        const remoteById = new Map((remoteHabits || []).map((h)=>[
                h.id,
                h
            ]));
        const remoteByKey = new Map((remoteHabits || []).map((h)=>[
                `${h.name.toLowerCase()}-${h.category}`,
                h
            ]));
        const localById = new Map(localHabits.map((h)=>[
                h.id,
                h
            ]));
        // Track processed remote habits
        const processedRemoteIds = new Set();
        // Process local habits
        for (const local of localHabits){
            const remoteById_ = remoteById.get(local.id);
            const habitKey = `${local.name.toLowerCase()}-${local.category}`;
            const remoteByKey_ = remoteByKey.get(habitKey);
            if (remoteById_) {
                // Same ID exists remotely - use conflict resolution based on updatedAt
                processedRemoteIds.add(remoteById_.id);
                const resolution = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$sync$2f$conflict$2d$resolution$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["resolveConflict"])({
                    ...local,
                    updatedAt: local.updatedAt || local.createdAt
                }, {
                    ...remoteById_,
                    updated_at: remoteById_.updated_at,
                    created_at: remoteById_.created_at
                }, {});
                if (resolution.winner === 'local') {
                    // Local is newer - push to remote (including archived status)
                    await this.pushHabitToRemote(local);
                    this.log('info', `🔄 Habit conflict (${local.name}): ${resolution.reason}`);
                } else if (resolution.winner === 'remote') {
                    // Remote is newer - update local (including archived status)
                    await this.updateLocalHabit(remoteById_);
                    this.log('info', `🔄 Habit conflict (${local.name}): ${resolution.reason}`);
                }
            // If equal, do nothing (already in sync)
            } else if (remoteByKey_ && remoteByKey_.id !== local.id) {
                // Different ID but same name+category - merge (remote wins for ID)
                processedRemoteIds.add(remoteByKey_.id);
                await this.mergeHabitToRemote(local, remoteByKey_);
            } else {
                // Local only - push to remote (even if archived, for sync)
                await this.pushHabitToRemote(local);
            }
        }
        // Process remote habits not yet seen (pull to local)
        for (const remote of remoteHabits || []){
            if (!processedRemoteIds.has(remote.id) && !localById.has(remote.id)) {
                // Remote only - pull to local (even if archived)
                await this.updateLocalHabit(remote);
            }
        }
        // Clean up archived habits that have been synced and are old (optional)
        // This permanently removes habits that have been archived for more than 30 days
        await this.cleanupOldArchivedHabits();
    }
    async pushHabitToRemote(habit) {
        if (!this.userId) return;
        const { error } = await this.supabase.from('habits').upsert({
            id: habit.id,
            user_id: this.userId,
            name: habit.name,
            description: null,
            icon: habit.icon || '✓',
            color: '#6366f1',
            category: habit.category,
            frequency: {
                type: 'daily',
                days: [
                    0,
                    1,
                    2,
                    3,
                    4,
                    5,
                    6
                ]
            },
            target_days: habit.targetDaysPerWeek,
            reminder_time: null,
            is_archived: habit.archived,
            // REMOVED: archived_at (column doesn't exist in Supabase)
            order_index: habit.order,
            updated_at: habit.updatedAt || habit.createdAt
        });
        if (error) throw error;
    }
    async updateLocalHabit(remote) {
        const localHabit = {
            id: remote.id,
            userId: this.userId || remote.user_id,
            name: remote.name,
            icon: remote.icon || '✓',
            category: remote.category,
            targetDaysPerWeek: remote.target_days || 7,
            archived: Boolean(remote.is_archived),
            archivedAt: remote.archived_at || undefined,
            updatedAt: remote.updated_at || remote.created_at,
            order: remote.order_index || 0,
            createdAt: remote.created_at
        };
        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].habits.put(localHabit);
    }
    async mergeHabitToRemote(local, remote) {
        this.log('info', `Merging duplicate habit: "${local.name}" (local: ${local.id}, remote: ${remote.id})`);
        // Remote wins for the ID - migrate all completions from local to remote
        const completions = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].completions.where('habitId').equals(local.id).toArray();
        for (const completion of completions){
            // Check if completion already exists for remote habit on same date
            const existing = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].completions.where('[habitId+date]').equals([
                remote.id,
                completion.date
            ]).first();
            if (!existing) {
                // Update local completion to use remote habit ID
                await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].completions.update(completion.id, {
                    habitId: remote.id
                });
                // Also push to remote
                if (this.userId) {
                    await this.supabase.from('completions').upsert({
                        id: completion.id,
                        user_id: this.userId,
                        habit_id: remote.id,
                        date: completion.date,
                        completed: completion.completed,
                        notes: completion.note || null
                    });
                }
            } else {
                // Duplicate completion - delete local one
                await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].completions.delete(completion.id);
            }
        }
        // Delete the local duplicate habit
        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].habits.delete(local.id);
        // Update local with remote version
        await this.updateLocalHabit(remote);
    }
    async pushHabit(habit) {
        if (!this.userId) return;
        if (!this.isOnline) {
            this.queueOperation({
                type: 'update',
                table: 'habits',
                data: {
                    id: habit.id,
                    user_id: this.userId,
                    name: habit.name,
                    icon: habit.icon || '✓',
                    category: habit.category,
                    target_days: habit.targetDaysPerWeek,
                    is_archived: habit.archived,
                    order_index: habit.order,
                    updated_at: new Date().toISOString()
                }
            });
            return;
        }
        await this.pushHabitToRemote(habit);
    }
    async archiveHabit(habitId) {
        if (!this.userId) return;
        const now = new Date().toISOString();
        if (!this.isOnline) {
            this.queueOperation({
                type: 'update',
                table: 'habits',
                data: {
                    id: habitId,
                    user_id: this.userId,
                    is_archived: true,
                    archived_at: now,
                    updated_at: now
                }
            });
            return;
        }
        // Soft delete - mark as archived (no timestamp since column doesn't exist)
        // @ts-expect-error - Supabase type issue with update
        const { error } = await this.supabase.from('habits').update({
            is_archived: true,
            updated_at: now
        }).eq('id', habitId).eq('user_id', this.userId);
        if (error) throw error;
    }
    async deleteHabit(habitId) {
        if (!this.userId) return;
        const now = new Date().toISOString();
        if (!this.isOnline) {
            this.queueOperation({
                type: 'update',
                table: 'habits',
                data: {
                    id: habitId,
                    user_id: this.userId,
                    is_archived: true,
                    archived_at: now,
                    updated_at: now
                }
            });
            return;
        }
        // Soft delete - mark as archived (no timestamp since column doesn't exist)
        // @ts-expect-error - Supabase type issue with update
        const { error } = await this.supabase.from('habits').update({
            is_archived: true,
            updated_at: now
        }).eq('id', habitId).eq('user_id', this.userId);
        if (error) throw error;
    }
    /**
   * Remove habits that have been archived for more than 30 days
   * This helps keep the database clean and performant
   */ async cleanupOldArchivedHabits() {
        if (!this.userId) return;
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        try {
            // Find locally archived habits older than 30 days
            const oldArchivedHabits = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].habits.where('archived').equals(1).and((h)=>{
                if (!h.archivedAt) return false;
                return new Date(h.archivedAt) < thirtyDaysAgo;
            }).toArray();
            if (oldArchivedHabits.length === 0) return;
            // Delete from local DB
            const habitIds = oldArchivedHabits.map((h)=>h.id);
            await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].habits.bulkDelete(habitIds);
            // Delete from remote
            await this.supabase.from('habits').delete().in('id', habitIds).eq('user_id', this.userId);
            // Delete related completions
            await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].completions.where('habitId').anyOf(habitIds).delete();
            await this.supabase.from('completions').delete().in('habit_id', habitIds).eq('user_id', this.userId);
            console.log(`Cleaned up ${habitIds.length} old archived habits`);
        } catch (error) {
            console.error('Error cleaning up old archived habits:', error);
        }
    }
    // ===================
    // COMPLETIONS SYNC
    // ===================
    async syncCompletionsWithRetry() {
        return this.withRetry(()=>this.syncCompletions(), 'Completions sync');
    }
    async syncCompletions() {
        if (!this.userId) return;
        // Prevent concurrent syncs
        if (this.completionSyncLock) {
            this.log('warn', 'Completion sync already running, skipping');
            return;
        }
        this.completionSyncLock = true;
        try {
            return await this.syncCompletionsImpl();
        } finally{
            this.completionSyncLock = false;
        }
    }
    async syncCompletionsImpl() {
        if (!this.userId) return;
        const startDate = this.getStartDate();
        const { data: remoteCompletions, error } = await this.supabase.from('completions').select('*').eq('user_id', this.userId).gte('date', startDate);
        if (error) throw error;
        const localCompletions = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].completions.where('date').aboveOrEqual(startDate).filter((c)=>c.userId === this.userId).toArray();
        this.log('info', `📊 Completions: Local=${localCompletions.length}, Remote=${remoteCompletions?.length || 0}`);
        // Create lookup maps using habitId-date as unique key
        const remoteMap = new Map((remoteCompletions || []).map((c)=>[
                `${c.habit_id}-${c.date}`,
                c
            ]));
        const localMap = new Map(localCompletions.map((c)=>[
                `${c.habitId}-${c.date}`,
                c
            ]));
        // Track IDs we've seen to avoid duplicates
        const processedKeys = new Set();
        // Collect batch operations
        const toInsertRemote = [];
        const toUpdateRemote = [];
        const toUpsertLocal = [];
        // Process local completions
        for (const local of localCompletions){
            const key = `${local.habitId}-${local.date}`;
            const remote = remoteMap.get(key);
            processedKeys.add(key);
            if (!remote) {
                // Local only - push to remote
                toInsertRemote.push({
                    id: local.id,
                    user_id: this.userId,
                    habit_id: local.habitId,
                    date: local.date,
                    completed: local.completed,
                    status: local.status || 'completed',
                    notes: local.note || null,
                    created_at: new Date().toISOString()
                });
            } else if (local.completed !== remote.completed || local.note !== remote.notes) {
                // Both exist but differ - use intelligent conflict resolution
                const resolution = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$sync$2f$conflict$2d$resolution$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["resolveConflict"])({
                    ...local,
                    updatedAt: local.updatedAt || local.createdAt,
                    completed: local.completed
                }, {
                    ...remote,
                    updated_at: remote.updated_at,
                    created_at: remote.created_at,
                    completed: remote.completed
                }, {
                    preferCompleted: true
                } // Completed always wins
                );
                if (resolution.winner === 'local') {
                    // Local wins - push to remote
                    toUpdateRemote.push({
                        id: remote.id,
                        user_id: this.userId,
                        habit_id: local.habitId,
                        date: local.date,
                        completed: local.completed,
                        status: local.status || 'completed',
                        notes: local.note || null,
                        updated_at: new Date().toISOString()
                    });
                    this.log('info', `🔄 Completion conflict (${local.habitId} on ${local.date}): ${resolution.reason}`);
                } else if (resolution.winner === 'remote') {
                    // Remote wins - pull to local
                    toUpsertLocal.push({
                        id: remote.id,
                        userId: this.userId || remote.user_id,
                        habitId: remote.habit_id,
                        date: remote.date,
                        completed: remote.completed,
                        status: remote.status || 'completed',
                        note: remote.notes || undefined,
                        updatedAt: remote.updated_at,
                        createdAt: remote.created_at
                    });
                    this.log('info', `🔄 Completion conflict (${local.habitId} on ${local.date}): ${resolution.reason}`);
                }
            // If 'equal', do nothing - already in sync
            }
        }
        // Pull remote completions that don't exist locally
        for (const remote of remoteCompletions || []){
            const key = `${remote.habit_id}-${remote.date}`;
            if (!processedKeys.has(key) && !localMap.has(key)) {
                toUpsertLocal.push({
                    id: remote.id,
                    userId: this.userId || remote.user_id,
                    habitId: remote.habit_id,
                    date: remote.date,
                    completed: remote.completed,
                    status: remote.status || 'completed',
                    note: remote.notes || undefined
                });
            }
        }
        // Execute batch operations
        if (toInsertRemote.length > 0) {
            await this.batchUpsert('completions', toInsertRemote);
            this.log('info', `✅ Pushed ${toInsertRemote.length} new completions to remote`);
        }
        if (toUpdateRemote.length > 0) {
            await this.batchUpsert('completions', toUpdateRemote);
            this.log('info', `✅ Updated ${toUpdateRemote.length} completions on remote (conflict resolution)`);
        }
        if (toUpsertLocal.length > 0) {
            // DEDUP before writing to prevent duplicates
            const dedupedCompletions = this.deduplicateByKey(toUpsertLocal, (c)=>`${c.habitId}-${c.date}`);
            // Use transaction with existence checks for atomicity
            await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].transaction('rw', __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].completions, async ()=>{
                for (const completion of dedupedCompletions){
                    const existing = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].completions.where('[habitId+date]').equals([
                        completion.habitId,
                        completion.date
                    ]).first();
                    if (existing) {
                        // Update only if remote is newer
                        const shouldUpdate = (completion.updatedAt || completion.createdAt || '') > (existing.updatedAt || existing.createdAt || '');
                        if (shouldUpdate) {
                            await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].completions.update(existing.id, completion);
                        }
                    } else {
                        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].completions.add(completion);
                    }
                }
            });
            this.log('info', `✅ Pulled ${dedupedCompletions.length} completions (deduped from ${toUpsertLocal.length})`);
        }
    }
    async pushCompletion(completion) {
        if (!this.userId) return;
        const data = {
            id: completion.id,
            user_id: this.userId,
            habit_id: completion.habitId,
            date: completion.date,
            completed: completion.completed,
            status: completion.status || 'completed',
            notes: completion.note || null
        };
        if (!this.isOnline) {
            this.queueOperation({
                type: 'update',
                table: 'completions',
                data
            });
            return;
        }
        await this.supabase.from('completions').upsert(data);
    }
    async deleteCompletion(completionId) {
        if (!this.userId) return;
        if (!this.isOnline) {
            this.queueOperation({
                type: 'delete',
                table: 'completions',
                data: {
                    id: completionId
                }
            });
            return;
        }
        await this.supabase.from('completions').delete().eq('id', completionId);
    }
    // ===================
    // GOALS SYNC
    // ===================
    async syncGoalsWithRetry() {
        return this.withRetry(()=>this.syncGoals(), 'Goals sync');
    }
    async syncGoals() {
        if (!this.userId) return;
        // Prevent concurrent syncs
        if (this.goalSyncLock) {
            this.log('warn', 'Goal sync already running, skipping');
            return;
        }
        this.goalSyncLock = true;
        try {
            return await this.syncGoalsImpl();
        } finally{
            this.goalSyncLock = false;
        }
    }
    async syncGoalsImpl() {
        if (!this.userId) return;
        this.log('info', '🔄 Syncing goals from Supabase...');
        const { data: remoteGoals, error } = await this.supabase.from('goals').select('*').eq('user_id', this.userId);
        if (error) throw error;
        const localGoals = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].goals.where('userId').equals(this.userId).toArray();
        const remoteById = new Map((remoteGoals || []).map((g)=>[
                g.id,
                g
            ]));
        const remoteByTitle = new Map((remoteGoals || []).map((g)=>[
                g.title.toLowerCase(),
                g
            ]));
        const localById = new Map(localGoals.map((g)=>[
                g.id,
                g
            ]));
        const processedRemoteIds = new Set();
        for (const local of localGoals){
            const remoteById_ = remoteById.get(local.id);
            const remoteByTitle_ = remoteByTitle.get(local.title.toLowerCase());
            if (remoteById_) {
                processedRemoteIds.add(remoteById_.id);
                // Use conflict resolution with "completed status wins"
                const resolution = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$sync$2f$conflict$2d$resolution$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["resolveConflict"])({
                    ...local,
                    updatedAt: local.updatedAt || local.createdAt
                }, {
                    ...remoteById_
                }, {
                    completedStatuses: [
                        'completed'
                    ]
                });
                if (resolution.winner === 'local') {
                    await this.pushGoalToRemote(local);
                    this.log('info', `🔄 Goal conflict (${local.title}): ${resolution.reason}`);
                } else if (resolution.winner === 'remote') {
                    await this.updateLocalGoal(remoteById_);
                    this.log('info', `🔄 Goal conflict (${local.title}): ${resolution.reason}`);
                }
            // If 'equal', do nothing - already in sync
            } else if (remoteByTitle_ && remoteByTitle_.id !== local.id) {
                processedRemoteIds.add(remoteByTitle_.id);
                await this.mergeGoalToRemote(local, remoteByTitle_);
            } else if (!local.archived) {
                await this.pushGoalToRemote(local);
                // Mark as processed to prevent duplicate pull
                processedRemoteIds.add(local.id);
            }
        }
        // FIXED: Only pull remote goals that haven't been processed AND don't exist locally
        for (const remote of remoteGoals || []){
            if (!processedRemoteIds.has(remote.id) && !localById.has(remote.id) && !remote.is_archived) {
                await this.updateLocalGoal(remote);
            }
        }
    }
    async pushGoalToRemote(goal) {
        if (!this.userId) return;
        await this.supabase.from('goals').upsert({
            id: goal.id,
            user_id: this.userId,
            title: goal.title,
            description: goal.description || null,
            category: goal.areaOfLife,
            priority: goal.priority,
            status: goal.status,
            target_date: goal.deadline,
            progress: 0,
            is_focus: goal.isFocus,
            is_archived: goal.archived,
            updated_at: new Date().toISOString()
        });
    }
    async updateLocalGoal(remote) {
        const localGoal = {
            id: remote.id,
            userId: this.userId || remote.user_id,
            title: remote.title,
            description: remote.description || undefined,
            areaOfLife: remote.category,
            priority: remote.priority || 'medium',
            status: remote.status || 'not_started',
            deadline: remote.target_date,
            isFocus: remote.is_focus || false,
            archived: remote.is_archived || false,
            createdAt: remote.created_at,
            startDate: remote.created_at
        };
        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].goals.put(localGoal);
    }
    async mergeGoalToRemote(local, remote) {
        this.log('info', `Merging duplicate goal: "${local.title}" (local: ${local.id}, remote: ${remote.id})`);
        // Migrate milestones from local to remote
        const milestones = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].milestones.where('goalId').equals(local.id).toArray();
        for (const milestone of milestones){
            await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].milestones.update(milestone.id, {
                goalId: remote.id
            });
            if (this.userId) {
                await this.supabase.from('milestones').upsert({
                    id: milestone.id,
                    user_id: this.userId,
                    goal_id: remote.id,
                    title: milestone.title,
                    is_completed: milestone.completed,
                    completed_at: milestone.completedAt,
                    order_index: milestone.order
                });
            }
        }
        // Delete the local duplicate goal
        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].goals.delete(local.id);
        // Update local with remote version
        await this.updateLocalGoal(remote);
    }
    async pushGoal(goal) {
        if (!this.userId) return;
        if (!this.isOnline) {
            this.queueOperation({
                type: 'update',
                table: 'goals',
                data: {
                    id: goal.id,
                    user_id: this.userId,
                    title: goal.title,
                    description: goal.description || null,
                    category: goal.areaOfLife,
                    priority: goal.priority,
                    status: goal.status,
                    target_date: goal.deadline,
                    is_focus: goal.isFocus,
                    is_archived: goal.archived,
                    updated_at: new Date().toISOString()
                }
            });
            return;
        }
        await this.pushGoalToRemote(goal);
    }
    async deleteGoal(goalId) {
        if (!this.userId) return;
        if (!this.isOnline) {
            this.queueOperation({
                type: 'delete',
                table: 'goals',
                data: {
                    id: goalId
                }
            });
            return;
        }
        // Delete milestones first, then goal
        await this.supabase.from('milestones').delete().eq('goal_id', goalId);
        await this.supabase.from('goals').delete().eq('id', goalId);
    }
    // ===================
    // MILESTONES SYNC
    // ===================
    async syncMilestonesWithRetry() {
        return this.withRetry(()=>this.syncMilestones(), 'Milestones sync');
    }
    async syncMilestones() {
        if (!this.userId) return;
        // Prevent concurrent syncs
        if (this.milestoneSyncLock) {
            this.log('warn', 'Milestone sync already running, skipping');
            return;
        }
        this.milestoneSyncLock = true;
        try {
            return await this.syncMilestonesImpl();
        } finally{
            this.milestoneSyncLock = false;
        }
    }
    async syncMilestonesImpl() {
        if (!this.userId) return;
        const { data: remoteMilestones, error } = await this.supabase.from('milestones').select('*').eq('user_id', this.userId);
        if (error) throw error;
        const localMilestones = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].milestones.toArray();
        const remoteMap = new Map((remoteMilestones || []).map((m)=>[
                m.id,
                m
            ]));
        const localMap = new Map(localMilestones.map((m)=>[
                m.id,
                m
            ]));
        // Collect batch operations
        const toInsertRemote = [];
        const toUpdateRemote = [];
        const toUpsertLocal = [];
        // Process local milestones
        for (const local of localMilestones){
            const remote = remoteMap.get(local.id);
            if (!remote) {
                // Local only - push to remote
                toInsertRemote.push({
                    id: local.id,
                    user_id: this.userId,
                    goal_id: local.goalId,
                    title: local.title,
                    is_completed: local.completed,
                    completed_at: local.completedAt || null,
                    order_index: local.order,
                    created_at: local.createdAt || new Date().toISOString(),
                    updated_at: new Date().toISOString()
                });
            } else if (local.completed !== remote.is_completed || local.title !== remote.title) {
                // Both exist but differ - use conflict resolution with "completed always wins"
                const resolution = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$sync$2f$conflict$2d$resolution$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["resolveConflict"])({
                    ...local,
                    updatedAt: local.updatedAt || local.createdAt
                }, {
                    ...remote,
                    completed: remote.is_completed,
                    updated_at: remote.updated_at,
                    created_at: remote.created_at
                }, {
                    preferCompleted: true
                });
                if (resolution.winner === 'local') {
                    toUpdateRemote.push({
                        id: remote.id,
                        user_id: this.userId,
                        goal_id: local.goalId,
                        title: local.title,
                        is_completed: local.completed,
                        completed_at: local.completedAt || null,
                        order_index: local.order,
                        updated_at: new Date().toISOString()
                    });
                    this.log('info', `🔄 Milestone conflict (${local.title}): ${resolution.reason}`);
                } else if (resolution.winner === 'remote') {
                    toUpsertLocal.push({
                        id: remote.id,
                        userId: this.userId || remote.user_id,
                        goalId: remote.goal_id,
                        title: remote.title,
                        completed: remote.is_completed || false,
                        completedAt: remote.completed_at || undefined,
                        order: remote.order_index || 0,
                        updatedAt: remote.updated_at,
                        createdAt: remote.created_at
                    });
                    this.log('info', `🔄 Milestone conflict (${local.title}): ${resolution.reason}`);
                }
            // If 'equal', do nothing
            }
        }
        // Execute batch operations
        if (toInsertRemote.length > 0) {
            await this.batchUpsert('milestones', toInsertRemote);
            this.log('info', `✅ Pushed ${toInsertRemote.length} new milestones to remote`);
        }
        if (toUpdateRemote.length > 0) {
            await this.batchUpsert('milestones', toUpdateRemote);
            this.log('info', `✅ Updated ${toUpdateRemote.length} milestones on remote (conflict resolution)`);
        }
        // Pull remote milestones not in local
        for (const remote of remoteMilestones || []){
            if (!localMap.has(remote.id)) {
                toUpsertLocal.push({
                    id: remote.id,
                    userId: this.userId || remote.user_id,
                    goalId: remote.goal_id,
                    title: remote.title,
                    completed: remote.is_completed || false,
                    completedAt: remote.completed_at || undefined,
                    order: remote.order_index || 0,
                    updatedAt: remote.updated_at,
                    createdAt: remote.created_at
                });
            }
        }
        if (toUpsertLocal.length > 0) {
            // DEDUP before writing to prevent duplicates
            const dedupedMilestones = this.deduplicateByKey(toUpsertLocal, (m)=>m.id // Milestones have unique IDs
            );
            // Use transaction with existence checks for atomicity
            await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].transaction('rw', __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].milestones, async ()=>{
                for (const milestone of dedupedMilestones){
                    const existing = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].milestones.get(milestone.id);
                    if (existing) {
                        // Update only if remote is newer
                        const shouldUpdate = (milestone.updatedAt || milestone.createdAt || '') > (existing.updatedAt || existing.createdAt || '');
                        if (shouldUpdate) {
                            await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].milestones.update(milestone.id, milestone);
                        }
                    } else {
                        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].milestones.add(milestone);
                    }
                }
            });
            this.log('info', `✅ Pulled ${dedupedMilestones.length} milestones (deduped from ${toUpsertLocal.length})`);
        }
    }
    async pushMilestone(milestone) {
        if (!this.userId) return;
        const data = {
            id: milestone.id,
            user_id: this.userId,
            goal_id: milestone.goalId,
            title: milestone.title,
            is_completed: milestone.completed,
            completed_at: milestone.completedAt,
            order_index: milestone.order
        };
        if (!this.isOnline) {
            this.queueOperation({
                type: 'update',
                table: 'milestones',
                data
            });
            return;
        }
        await this.supabase.from('milestones').upsert(data);
    }
    async deleteMilestone(milestoneId) {
        if (!this.userId) return;
        if (!this.isOnline) {
            this.queueOperation({
                type: 'delete',
                table: 'milestones',
                data: {
                    id: milestoneId
                }
            });
            return;
        }
        await this.supabase.from('milestones').delete().eq('id', milestoneId);
    }
    // ===================
    // TASKS SYNC
    // ===================
    async syncTasksWithRetry() {
        return this.withRetry(()=>this.syncTasks(), 'Tasks sync');
    }
    async syncTasks() {
        if (!this.userId) return;
        // Prevent concurrent syncs
        if (this.taskSyncLock) {
            this.log('warn', 'Task sync already running, skipping');
            return;
        }
        this.taskSyncLock = true;
        try {
            return await this.syncTasksImpl();
        } finally{
            this.taskSyncLock = false;
        }
    }
    async syncTasksImpl() {
        if (!this.userId) return;
        this.log('info', '🔄 Syncing tasks from Supabase...');
        const { data: remoteTasks, error } = await this.supabase.from('tasks').select('*').eq('user_id', this.userId);
        if (error) throw error;
        const localTasks = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].tasks.where('userId').equals(this.userId).toArray();
        const remoteById = new Map((remoteTasks || []).map((t)=>[
                t.id,
                t
            ]));
        const localById = new Map(localTasks.map((t)=>[
                t.id,
                t
            ]));
        // Sort tasks by depth to ensure parents sync before children
        const sortedLocalTasks = [
            ...localTasks
        ].sort((a, b)=>(a.depth || 0) - (b.depth || 0));
        // Push local tasks not in remote
        const toInsertRemote = [];
        for (const local of sortedLocalTasks){
            if (!remoteById.has(local.id)) {
                // If not archived locally, or archived but we want to sync deletion state
                toInsertRemote.push({
                    id: local.id,
                    user_id: this.userId,
                    title: local.title,
                    description: local.description,
                    status: local.status,
                    priority: local.priority,
                    due_date: local.due_date,
                    goal_id: local.goal_id,
                    parent_task_id: local.parentTaskId || null,
                    depth: local.depth || 0,
                    tags: local.tags,
                    created_at: local.created_at,
                    updated_at: local.updated_at
                });
            } else {
                // Exists in remote, use conflict resolution with "done status wins"
                const remote = remoteById.get(local.id);
                const resolution = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$sync$2f$conflict$2d$resolution$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["resolveConflict"])({
                    ...local,
                    updatedAt: local.updated_at
                }, {
                    ...remote,
                    updated_at: remote.updated_at,
                    created_at: remote.created_at
                }, {
                    completedStatuses: [
                        'done'
                    ]
                });
                if (resolution.winner === 'local') {
                    await this.pushTaskToRemote(local);
                    this.log('info', `🔄 Task conflict (${local.title}): ${resolution.reason}`);
                } else if (resolution.winner === 'remote') {
                    await this.updateLocalTask(remote);
                    this.log('info', `🔄 Task conflict (${local.title}): ${resolution.reason}`);
                }
            // If 'equal', do nothing
            }
        }
        if (toInsertRemote.length > 0) {
            await this.batchUpsert('tasks', toInsertRemote);
        }
        // Pull remote tasks not in local
        const toUpsertLocal = [];
        for (const remote of remoteTasks || []){
            if (!localById.has(remote.id)) {
                toUpsertLocal.push(remote);
            }
        }
        if (toUpsertLocal.length > 0) {
            for (const remote of toUpsertLocal){
                await this.updateLocalTask(remote);
            }
        }
    }
    async pushTaskToRemote(task) {
        if (!this.userId) return;
        await this.supabase.from('tasks').upsert({
            id: task.id,
            user_id: this.userId,
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            due_date: task.due_date,
            goal_id: task.goal_id,
            parent_task_id: task.parentTaskId || null,
            depth: task.depth || 0,
            tags: task.tags,
            created_at: task.created_at,
            updated_at: task.updated_at
        });
    }
    async updateLocalTask(remote) {
        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].tasks.put({
            id: remote.id,
            userId: this.userId,
            title: remote.title,
            description: remote.description,
            status: remote.status,
            priority: remote.priority,
            due_date: remote.due_date,
            goal_id: remote.goal_id,
            parentTaskId: remote.parent_task_id || null,
            depth: remote.depth || 0,
            tags: remote.tags || [],
            metadata: {},
            created_at: remote.created_at,
            updated_at: remote.updated_at || remote.created_at
        });
    }
    async pushTask(task) {
        if (!this.userId) return;
        if (!this.isOnline) {
            this.queueOperation({
                type: 'update',
                table: 'tasks',
                data: {
                    ...task,
                    user_id: this.userId
                }
            });
            return;
        }
        await this.pushTaskToRemote(task);
    }
    async deleteTask(taskId) {
        if (!this.userId) return;
        if (!this.isOnline) {
            this.queueOperation({
                type: 'delete',
                table: 'tasks',
                data: {
                    id: taskId
                }
            });
            return;
        }
        await this.supabase.from('tasks').delete().eq('id', taskId);
    }
    // ===================
    // ROUTINES SYNC
    // ===================
    async syncRoutinesWithRetry() {
        return this.withRetry(()=>this.syncRoutines(), 'Routines sync');
    }
    async syncRoutines() {
        if (!this.userId) return;
        // Prevent concurrent syncs
        if (this.routineSyncLock) {
            this.log('warn', 'Routine sync already running, skipping');
            return;
        }
        this.routineSyncLock = true;
        try {
            return await this.syncRoutinesImpl();
        } finally{
            this.routineSyncLock = false;
        }
    }
    async syncRoutinesImpl() {
        if (!this.userId) return;
        this.log('info', '🔄 Syncing routines from Supabase...');
        const { data: remoteRoutines, error } = await this.supabase.from('routines').select('*').eq('user_id', this.userId);
        if (error) throw error;
        const localRoutines = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].routines.where('userId').equals(this.userId).toArray();
        const remoteById = new Map((remoteRoutines || []).map((r)=>[
                r.id,
                r
            ]));
        const localById = new Map(localRoutines.map((r)=>[
                r.id,
                r
            ]));
        const processedRemoteIds = new Set();
        // Process local routines
        for (const local of localRoutines){
            const remote = remoteById.get(local.id);
            if (remote) {
                processedRemoteIds.add(remote.id);
                const resolution = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$sync$2f$conflict$2d$resolution$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["resolveConflict"])({
                    ...local,
                    updatedAt: local.updatedAt || local.createdAt
                }, {
                    ...remote,
                    updated_at: remote.updated_at,
                    created_at: remote.created_at
                }, {});
                if (resolution.winner === 'local') {
                    await this.pushRoutineToRemote(local);
                    this.log('info', `🔄 Routine conflict (${local.title}): ${resolution.reason}`);
                } else if (resolution.winner === 'remote') {
                    await this.updateLocalRoutine(remote);
                    this.log('info', `🔄 Routine conflict (${local.title}): ${resolution.reason}`);
                }
            // If 'equal', do nothing
            } else {
                // Local only - push to remote
                await this.pushRoutineToRemote(local);
            }
        }
        // Process remote routines not yet seen
        for (const remote of remoteRoutines || []){
            if (!processedRemoteIds.has(remote.id) && !localById.has(remote.id)) {
                await this.updateLocalRoutine(remote);
            }
        }
    }
    async pushRoutineToRemote(routine) {
        if (!this.userId) return;
        await this.supabase.from('routines').upsert({
            id: routine.id,
            user_id: this.userId,
            title: routine.title,
            description: routine.description || null,
            trigger_type: routine.triggerType,
            trigger_value: routine.triggerValue || null,
            is_active: routine.isActive,
            order_index: routine.orderIndex,
            created_at: routine.createdAt,
            updated_at: routine.updatedAt || routine.createdAt
        });
    }
    async updateLocalRoutine(remote) {
        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].routines.put({
            id: remote.id,
            userId: this.userId,
            title: remote.title,
            description: remote.description,
            triggerType: remote.trigger_type,
            triggerValue: remote.trigger_value,
            isActive: remote.is_active,
            orderIndex: remote.order_index,
            createdAt: remote.created_at,
            updatedAt: remote.updated_at || remote.created_at
        });
    }
    async pushRoutine(routine) {
        if (!this.userId) return;
        if (!this.isOnline) {
            this.queueOperation({
                type: 'update',
                table: 'routines',
                data: {
                    id: routine.id,
                    user_id: this.userId,
                    title: routine.title,
                    description: routine.description,
                    trigger_type: routine.triggerType,
                    trigger_value: routine.triggerValue,
                    is_active: routine.isActive,
                    order_index: routine.orderIndex,
                    updated_at: new Date().toISOString()
                }
            });
            return;
        }
        await this.pushRoutineToRemote(routine);
    }
    async deleteRoutine(routineId) {
        if (!this.userId) return;
        if (!this.isOnline) {
            this.queueOperation({
                type: 'delete',
                table: 'routines',
                data: {
                    id: routineId
                }
            });
            return;
        }
        await this.supabase.from('routines').delete().eq('id', routineId);
    }
    // ===================
    // USER SETTINGS SYNC
    // ===================
    async syncUserSettingsWithRetry() {
        return this.withRetry(()=>this.syncUserSettings(), 'User settings sync');
    }
    async syncUserSettings() {
        if (!this.userId) return;
        this.log('info', '🔄 Starting user settings sync...');
        // Pull settings from Supabase
        const { data: rawRemoteSettings, error } = await this.supabase.from('user_settings').select('*').eq('user_id', this.userId).maybeSingle();
        if (error) {
            throw error;
        }
        const remoteSettings = rawRemoteSettings;
        const localSettings = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].userSettings.where('userId').equals(this.userId).first();
        this.log('info', `📊 Settings: Local=${!!localSettings}, Remote=${!!remoteSettings}`);
        // Map remote settings to camelCase format if they exist
        const mappedRemoteSettings = remoteSettings ? {
            id: localSettings?.id || remoteSettings.id || crypto.randomUUID(),
            userId: remoteSettings.user_id,
            userName: remoteSettings.user_name || undefined,
            avatarId: remoteSettings.avatar_id || 'avatar-1',
            weekStartsOn: remoteSettings.week_start_day ?? 0,
            theme: localSettings?.theme || 'system',
            showMotivationalQuotes: localSettings?.showMotivationalQuotes ?? true,
            defaultCategory: remoteSettings.default_category || 'health',
            xp: remoteSettings.xp || 0,
            level: remoteSettings.level || 1,
            gems: remoteSettings.gems || 0,
            streakShield: remoteSettings.streak_shield || 0,
            soundEnabled: localSettings?.soundEnabled ?? true,
            hapticsEnabled: localSettings?.hapticsEnabled ?? true,
            stats: remoteSettings.stats || {
                vitality: 1,
                intelligence: 1,
                discipline: 1,
                charisma: 1,
                wealth: 1,
                creativity: 1
            },
            unlockedThemes: remoteSettings.unlocked_themes || [],
            dashboardLayout: remoteSettings.dashboard_layout || [
                'hero',
                'metrics',
                'today-tasks',
                'habit-overview',
                'focus-goal',
                'ai-quote',
                'ai-coach',
                'quick-actions'
            ],
            createdAt: remoteSettings.created_at || new Date().toISOString(),
            updatedAt: remoteSettings.updated_at || undefined
        } : null;
        if (!localSettings && !mappedRemoteSettings) {
            // No settings anywhere - create defaults locally
            this.log('info', 'Creating default user settings');
            await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].userSettings.add({
                id: crypto.randomUUID(),
                userId: this.userId,
                theme: 'system',
                weekStartsOn: 0,
                showMotivationalQuotes: true,
                defaultCategory: 'health',
                createdAt: new Date().toISOString(),
                xp: 0,
                level: 1,
                gems: 0,
                streakShield: 0,
                avatarId: 'avatar-1',
                stats: {
                    vitality: 1,
                    intelligence: 1,
                    discipline: 1,
                    charisma: 1,
                    wealth: 1,
                    creativity: 1
                },
                unlockedThemes: [],
                dashboardLayout: [
                    'hero',
                    'metrics',
                    'today-tasks',
                    'habit-overview',
                    'focus-goal',
                    'ai-quote',
                    'ai-coach',
                    'quick-actions'
                ]
            });
            return;
        }
        if (!mappedRemoteSettings && localSettings) {
            // Local only - push to remote
            await this.pushUserSettingsToRemote(localSettings);
        } else if (mappedRemoteSettings && !localSettings) {
            // Remote only - pull to local
            await this.updateLocalUserSettings(mappedRemoteSettings);
        } else if (mappedRemoteSettings && localSettings) {
            // Both exist - merge gamification fields (highest value wins) and use timestamp for other fields
            this.log('info', '🎮 Both settings exist, merging with conflict resolution...');
            // First, merge gamification fields to ensure highest values
            // EXCEPTION: If remote settings indicate a reset (level=1, xp=0, gems=0) and remote is newer,
            // allow remote settings to override local settings to let the reset take effect.
            const isRemoteReset = mappedRemoteSettings.level === 1 && mappedRemoteSettings.xp === 0 && mappedRemoteSettings.gems === 0;
            const isRemoteNewer = new Date(mappedRemoteSettings.updatedAt || 0) > new Date(localSettings.updatedAt || localSettings.createdAt || 0);
            const mergedGamification = isRemoteReset && isRemoteNewer ? mappedRemoteSettings : (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$sync$2f$conflict$2d$resolution$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["mergeGamificationFields"])(localSettings, mappedRemoteSettings);
            // Then use conflict resolution for other fields based on timestamp
            const resolution = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$sync$2f$conflict$2d$resolution$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["resolveConflict"])({
                ...localSettings,
                updatedAt: localSettings.updatedAt || localSettings.createdAt
            }, {
                ...mappedRemoteSettings
            }, {});
            // Merge: Take winner's data for non-gamification fields, but always use merged gamification values
            const winner = resolution.winner === 'local' ? localSettings : mappedRemoteSettings;
            const finalSettings = {
                ...winner,
                xp: mergedGamification.xp,
                level: mergedGamification.level,
                gems: mergedGamification.gems,
                streakShield: mergedGamification.streakShield,
                stats: mergedGamification.stats,
                unlockedThemes: mergedGamification.unlockedThemes,
                dashboardLayout: winner.dashboardLayout || localSettings.dashboardLayout || [
                    'hero',
                    'metrics',
                    'today-tasks',
                    'habit-overview',
                    'focus-goal',
                    'ai-quote',
                    'ai-coach',
                    'quick-actions'
                ]
            };
            // Push merged settings to both local and remote to ensure consistency
            await this.pushUserSettingsToRemote(finalSettings);
            await this.updateLocalUserSettings(finalSettings);
            this.log('info', `🎮 Settings merged: XP=${finalSettings.xp}, Level=${finalSettings.level}, Gems=${finalSettings.gems}, Shield=${finalSettings.streakShield}`);
            this.log('info', `🔄 ${resolution.reason}`);
        }
    }
    async pushUserSettingsToRemote(settings) {
        if (!this.userId) return;
        const { error } = await this.supabase.from('user_settings').upsert({
            user_id: this.userId,
            user_name: settings.userName || null,
            avatar_id: settings.avatarId || 'avatar-1',
            week_start_day: settings.weekStartsOn || 0,
            default_category: settings.defaultCategory || 'health',
            xp: settings.xp || 0,
            level: settings.level || 1,
            gems: settings.gems || 0,
            streak_shield: settings.streakShield || 0,
            stats: settings.stats || null,
            unlocked_themes: settings.unlockedThemes || [],
            dashboard_layout: settings.dashboardLayout || [
                'hero',
                'metrics',
                'today-tasks',
                'habit-overview',
                'focus-goal',
                'ai-quote',
                'ai-coach',
                'quick-actions'
            ],
            updated_at: new Date().toISOString()
        }, {
            onConflict: 'user_id'
        });
        if (error) {
            this.log('error', '❌ Failed to push user settings to remote', error);
            throw error;
        }
        this.log('info', '✅ User settings pushed to remote');
    }
    async updateLocalUserSettings(settings) {
        const localSettings = {
            id: settings.id || crypto.randomUUID(),
            userId: this.userId,
            theme: settings.theme || 'system',
            userName: settings.userName,
            weekStartsOn: settings.weekStartsOn ?? 0,
            showMotivationalQuotes: settings.showMotivationalQuotes ?? true,
            defaultCategory: settings.defaultCategory || 'health',
            createdAt: settings.createdAt || new Date().toISOString(),
            updatedAt: settings.updatedAt || new Date().toISOString(),
            xp: settings.xp ?? 0,
            level: settings.level ?? 1,
            gems: settings.gems ?? 0,
            streakShield: settings.streakShield ?? 0,
            avatarId: settings.avatarId || 'avatar-1',
            stats: settings.stats || {
                vitality: 1,
                intelligence: 1,
                discipline: 1,
                charisma: 1,
                wealth: 1,
                creativity: 1
            },
            unlockedThemes: settings.unlockedThemes || [],
            dashboardLayout: settings.dashboardLayout || [
                'hero',
                'metrics',
                'today-tasks',
                'habit-overview',
                'focus-goal',
                'ai-quote',
                'ai-coach',
                'quick-actions'
            ]
        };
        // Check if settings exist for this user
        const existing = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].userSettings.where('userId').equals(this.userId).first();
        if (existing) {
            await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].userSettings.update(existing.id, localSettings);
        } else {
            await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].userSettings.add(localSettings);
        }
        // Update Zustand gamification store to reflect synced data
        try {
            const { useGamificationStore } = await __turbopack_context__.A("[project]/src/lib/stores/gamification-store.ts [app-client] (ecmascript, async loader)");
            const store = useGamificationStore.getState();
            // Only update if values have actually changed
            if (store.xp !== localSettings.xp || store.level !== localSettings.level || store.gems !== localSettings.gems || store.streakShield !== localSettings.streakShield) {
                store.loadGamification(); // Reload from IndexedDB
                this.log('info', `🎮 UI updated: XP=${localSettings.xp}, Level=${localSettings.level}, Gems=${localSettings.gems}`);
            }
        } catch (error) {
            this.log('warn', 'Failed to update gamification UI, but data is synced', error);
        }
        // Update user store to refresh display name
        try {
            const { useUserStore } = await __turbopack_context__.A("[project]/src/lib/stores/user-store.ts [app-client] (ecmascript, async loader)");
            const userStore = useUserStore.getState();
            // Only update if display name changed
            if (userStore.displayName !== localSettings.userName && localSettings.userName) {
                userStore.loadUser(); // Reload from IndexedDB
                this.log('info', `👤 Display name updated in UI: ${localSettings.userName}`);
            }
        } catch (error) {
            this.log('warn', 'Failed to update user store UI, but data is synced', error);
        }
        this.log('info', '✅ User settings pulled from remote');
    }
    async pushUserSettings(settings) {
        if (!this.userId) return;
        if (!this.isOnline) {
            this.queueOperation({
                type: 'update',
                table: 'user_settings',
                data: {
                    user_id: this.userId,
                    user_name: settings.userName,
                    avatar_id: settings.avatarId || 'avatar-1',
                    week_start_day: settings.weekStartsOn,
                    default_category: settings.defaultCategory,
                    xp: settings.xp,
                    level: settings.level,
                    gems: settings.gems,
                    streak_shield: settings.streakShield,
                    updated_at: new Date().toISOString()
                }
            });
            return;
        }
        await this.pushUserSettingsToRemote(settings);
    }
    // ===================
    // HABIT-ROUTINES JUNCTION SYNC
    // ===================
    async syncHabitRoutinesWithRetry() {
        return this.withRetry(()=>this.syncHabitRoutines(), 'Habit-routines sync');
    }
    async syncHabitRoutines() {
        if (!this.userId) return;
        this.log('info', '🔄 Starting habit-routines junction sync...');
        // Get all habit IDs for this user to filter junction table
        const userHabits = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].habits.where('userId').equals(this.userId).toArray();
        const userHabitIds = userHabits.map((h)=>h.id);
        if (userHabitIds.length === 0) {
            this.log('info', 'No habits found, skipping habit-routines sync');
            return;
        }
        // Pull junction records from Supabase (filtered by user's habits)
        const { data: remoteLinks, error } = await this.supabase.from('habit_routines').select('*').in('habit_id', userHabitIds);
        if (error) throw error;
        const localLinks = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].habitRoutines.toArray();
        // Filter local links to only those belonging to user's habits
        const userLocalLinks = localLinks.filter((link)=>userHabitIds.includes(link.habitId));
        this.log('info', `📊 Habit-Routines: Local=${userLocalLinks.length}, Remote=${remoteLinks?.length || 0}`);
        const remoteMap = new Map((remoteLinks || []).map((l)=>[
                `${l.habit_id}-${l.routine_id}`,
                l
            ]));
        const localMap = new Map(userLocalLinks.map((l)=>[
                `${l.habitId}-${l.routineId}`,
                l
            ]));
        // Collect batch operations
        const toInsertRemote = [];
        const toUpdateRemote = [];
        const toUpsertLocal = [];
        // Process local links
        for (const local of userLocalLinks){
            const key = `${local.habitId}-${local.routineId}`;
            const remote = remoteMap.get(key);
            if (!remote) {
                // Local only - push to remote
                toInsertRemote.push({
                    id: local.id,
                    habit_id: local.habitId,
                    routine_id: local.routineId,
                    order_index: local.orderIndex,
                    created_at: local.createdAt,
                    updated_at: local.updatedAt || local.createdAt
                });
            } else if (local.orderIndex !== remote.order_index) {
                // Both exist but differ - use conflict resolution
                const resolution = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$sync$2f$conflict$2d$resolution$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["resolveConflict"])({
                    ...local,
                    updatedAt: local.updatedAt || local.createdAt
                }, {
                    ...remote,
                    updated_at: remote.updated_at,
                    created_at: remote.created_at
                }, {});
                if (resolution.winner === 'local') {
                    toUpdateRemote.push({
                        id: remote.id,
                        habit_id: local.habitId,
                        routine_id: local.routineId,
                        order_index: local.orderIndex,
                        updated_at: new Date().toISOString()
                    });
                    this.log('info', `🔄 Habit-routine conflict (${key}): ${resolution.reason}`);
                } else if (resolution.winner === 'remote') {
                    toUpsertLocal.push({
                        id: remote.id,
                        habitId: remote.habit_id,
                        routineId: remote.routine_id,
                        orderIndex: remote.order_index || 0,
                        createdAt: remote.created_at,
                        updatedAt: remote.updated_at
                    });
                    this.log('info', `🔄 Habit-routine conflict (${key}): ${resolution.reason}`);
                }
            // If 'equal', do nothing
            }
        }
        if (toInsertRemote.length > 0) {
            await this.batchUpsert('habit_routines', toInsertRemote);
            this.log('info', `✅ Pushed ${toInsertRemote.length} habit-routine links to remote`);
        }
        if (toUpdateRemote.length > 0) {
            await this.batchUpsert('habit_routines', toUpdateRemote);
            this.log('info', `✅ Updated ${toUpdateRemote.length} habit-routine links on remote (conflict resolution)`);
        }
        // Pull remote links not in local
        for (const remote of remoteLinks || []){
            const key = `${remote.habit_id}-${remote.routine_id}`;
            if (!localMap.has(key)) {
                toUpsertLocal.push({
                    id: remote.id,
                    habitId: remote.habit_id,
                    routineId: remote.routine_id,
                    orderIndex: remote.order_index || 0,
                    createdAt: remote.created_at,
                    updatedAt: remote.updated_at
                });
            }
        }
        if (toUpsertLocal.length > 0) {
            // DEDUP before writing to prevent duplicates
            const dedupedLinks = this.deduplicateByKey(toUpsertLocal, (link)=>`${link.habitId}-${link.routineId}` // Composite key
            );
            // Use transaction with existence checks for atomicity
            await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].transaction('rw', __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].habitRoutines, async ()=>{
                for (const link of dedupedLinks){
                    const existing = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].habitRoutines.where('[habitId+routineId]').equals([
                        link.habitId,
                        link.routineId
                    ]).first();
                    if (existing) {
                        // Update only if remote is newer
                        const shouldUpdate = (link.updatedAt || link.createdAt || '') > (existing.updatedAt || existing.createdAt || '');
                        if (shouldUpdate) {
                            await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].habitRoutines.update(existing.id, link);
                        }
                    } else {
                        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].habitRoutines.add(link);
                    }
                }
            });
            this.log('info', `✅ Pulled ${dedupedLinks.length} habit-routine links (deduped from ${toUpsertLocal.length})`);
        }
    }
    async pushHabitRoutine(link) {
        if (!this.userId) return;
        const data = {
            id: link.id,
            habit_id: link.habitId,
            routine_id: link.routineId,
            order_index: link.orderIndex,
            created_at: link.createdAt
        };
        if (!this.isOnline) {
            this.queueOperation({
                type: 'update',
                table: 'habit_routines',
                data
            });
            return;
        }
        await this.supabase.from('habit_routines').upsert(data);
    }
    async deleteHabitRoutine(linkId) {
        if (!this.userId) return;
        if (!this.isOnline) {
            this.queueOperation({
                type: 'delete',
                table: 'habit_routines',
                data: {
                    id: linkId
                }
            });
            return;
        }
        await this.supabase.from('habit_routines').delete().eq('id', linkId);
    }
    // ==================
    // ROUTINE COMPLETIONS SYNC
    // ==================
    async syncRoutineCompletions() {
        if (!this.userId) return;
        const { data: remoteCompletions, error } = await this.supabase.from('routine_completions').select('*').eq('user_id', this.userId);
        if (error) throw error;
        const localCompletions = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].routineCompletions.where('userId').equals(this.userId).toArray();
        const remoteById = new Map((remoteCompletions || []).map((c)=>[
                c.id,
                c
            ]));
        const localById = new Map(localCompletions.map((c)=>[
                c.id,
                c
            ]));
        // Push local completions not in remote
        const toInsertRemote = [];
        for (const local of localCompletions){
            if (!remoteById.has(local.id)) {
                toInsertRemote.push({
                    id: local.id,
                    user_id: this.userId,
                    routine_id: local.routineId,
                    date: local.date,
                    completed: local.completed,
                    completed_at: local.completedAt,
                    notes: local.notes,
                    created_at: local.createdAt,
                    updated_at: local.updatedAt
                });
            } else {
                // Conflict resolution: prefer completed = true
                const remote = remoteById.get(local.id);
                const resolution = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$sync$2f$conflict$2d$resolution$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["resolveConflict"])({
                    ...local,
                    updatedAt: local.updatedAt
                }, {
                    ...remote,
                    updated_at: remote.updated_at
                }, {
                    preferCompleted: true
                });
                if (resolution.winner === 'local') {
                    await this.pushRoutineCompletionToRemote(local);
                } else if (resolution.winner === 'remote') {
                    await this.updateLocalRoutineCompletion(remote);
                }
            }
        }
        if (toInsertRemote.length > 0) {
            await this.batchUpsert('routine_completions', toInsertRemote);
        }
        // Pull remote completions not in local
        for (const remote of remoteCompletions || []){
            if (!localById.has(remote.id)) {
                await this.updateLocalRoutineCompletion(remote);
            }
        }
    }
    async pushRoutineCompletionToRemote(completion) {
        if (!this.userId) return;
        await this.supabase.from('routine_completions').upsert({
            id: completion.id,
            user_id: this.userId,
            routine_id: completion.routineId,
            date: completion.date,
            completed: completion.completed,
            completed_at: completion.completedAt,
            notes: completion.notes,
            created_at: completion.createdAt,
            updated_at: completion.updatedAt
        });
    }
    async updateLocalRoutineCompletion(remote) {
        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].routineCompletions.put({
            id: remote.id,
            userId: this.userId,
            routineId: remote.routine_id,
            date: remote.date,
            completed: remote.completed,
            completedAt: remote.completed_at,
            notes: remote.notes,
            createdAt: remote.created_at,
            updatedAt: remote.updated_at
        });
    }
    // ===================
    // REALTIME SYNC
    // ===================
    setupRealtime() {
        if (!this.userId || this.realtimeChannel) return;
        this.realtimeChannel = this.supabase.channel('db-changes').on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'habits',
            filter: `user_id=eq.${this.userId}`
        }, ()=>this.debouncedSync('habits')).on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'completions',
            filter: `user_id=eq.${this.userId}`
        }, ()=>this.debouncedSync('completions')).on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'goals',
            filter: `user_id=eq.${this.userId}`
        }, ()=>this.debouncedSync('goals')).on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'tasks',
            filter: `user_id=eq.${this.userId}`
        }, ()=>this.debouncedSync('tasks')).on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'milestones',
            filter: `user_id=eq.${this.userId}`
        }, ()=>this.debouncedSync('milestones')).on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'routines',
            filter: `user_id=eq.${this.userId}`
        }, ()=>this.debouncedSync('routines')).on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'user_settings',
            filter: `user_id=eq.${this.userId}`
        }, ()=>this.debouncedSync('user_settings')).on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'habit_routines'
        }, ()=>this.debouncedSync('habit_routines')).on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'routine_completions',
            filter: `user_id=eq.${this.userId}`
        }, ()=>this.debouncedSync('routine_completions')).subscribe((status)=>{
            this.log('info', `Realtime subscription status: ${status}`);
        });
    }
    debouncedSync(table) {
        if (this.syncDebounceTimer) {
            clearTimeout(this.syncDebounceTimer);
        }
        this.syncDebounceTimer = setTimeout(async ()=>{
            this.log('info', `Realtime change detected in ${table}, syncing...`);
            try {
                switch(table){
                    case 'habits':
                        await this.syncHabitsWithRetry();
                        break;
                    case 'completions':
                        await this.syncCompletionsWithRetry();
                        break;
                    case 'goals':
                        await this.syncGoalsWithRetry();
                        break;
                    case 'tasks':
                        await this.syncTasksWithRetry();
                        break;
                    case 'milestones':
                        await this.syncMilestonesWithRetry();
                        break;
                    case 'routines':
                        await this.syncRoutinesWithRetry();
                        break;
                    case 'user_settings':
                        await this.syncUserSettingsWithRetry();
                        break;
                    case 'habit_routines':
                        await this.syncHabitRoutinesWithRetry();
                        break;
                    case 'routine_completions':
                        await this.syncRoutineCompletions();
                        break;
                }
                this.notifyStatus({
                    type: 'success',
                    message: 'Data updated'
                });
            } catch (error) {
                this.log('error', `Realtime sync failed for ${table}`, error);
            }
        }, SYNC_DEBOUNCE_MS);
    }
    cleanupRealtime() {
        if (this.realtimeChannel) {
            this.supabase.removeChannel(this.realtimeChannel);
            this.realtimeChannel = null;
        }
    }
    // ===================
    // UTILITIES
    // ===================
    getStartDate() {
        const date = new Date();
        date.setDate(date.getDate() - SYNC_WINDOW_DAYS);
        return date.toISOString().split('T')[0];
    }
    async batchUpsert(table, items) {
        for(let i = 0; i < items.length; i += BATCH_SIZE){
            const batch = items.slice(i, i + BATCH_SIZE);
            const { error } = await this.supabase.from(table).upsert(batch);
            if (error) {
                this.log('error', `Batch upsert failed for ${table}: ${error.message}`, {
                    code: error.code,
                    details: error.details,
                    hint: error.hint,
                    batchSize: batch.length
                });
                throw error;
            }
        }
    }
    async cleanupLocalDuplicates() {
        if (!this.userId) return;
        try {
            // Cleanup duplicate habits (same name + category)
            const habits = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].habits.where('userId').equals(this.userId).toArray();
            const habitKeys = new Map();
            for (const habit of habits){
                const key = `${habit.name.toLowerCase()}-${habit.category}`;
                const existing = habitKeys.get(key);
                if (existing) {
                    // Keep the one with earlier creation date
                    const keepHabit = new Date(habit.createdAt) < new Date(existing.createdAt) ? habit : existing;
                    const deleteHabit = keepHabit === habit ? existing : habit;
                    this.log('info', `Cleaning up duplicate habit: ${deleteHabit.name}`);
                    // Migrate completions
                    const completions = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].completions.where('habitId').equals(deleteHabit.id).toArray();
                    for (const c of completions){
                        const exists = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].completions.where('[habitId+date]').equals([
                            keepHabit.id,
                            c.date
                        ]).first();
                        if (!exists) {
                            await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].completions.update(c.id, {
                                habitId: keepHabit.id
                            });
                        } else {
                            await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].completions.delete(c.id);
                        }
                    }
                    await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].habits.delete(deleteHabit.id);
                    habitKeys.set(key, keepHabit);
                } else {
                    habitKeys.set(key, habit);
                }
            }
            // Cleanup duplicate goals
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cleanupDuplicateGoals"])();
            // Cleanup duplicate completions
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cleanupDuplicateCompletions"])();
        // Cleanup duplicate tasks (same title + created within 1s? or just let ID handle it?)
        // For tasks, duplicates usually come from ID collisions or double creates.
        // We'll rely on ID uniqueness for now, but maybe same title?
        } catch (error) {
            this.log('error', 'Cleanup failed', error);
        }
    }
    async cleanupLocalDuplicatesWithLogging() {
        if (!this.userId) return;
        try {
            const before = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$cleanup$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["countAllDuplicates"])();
            // Run cleanup
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cleanupDuplicateCompletions"])();
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cleanupDuplicateGoals"])();
            const after = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$cleanup$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["countAllDuplicates"])();
            if (before.completions > 0 || before.habits > 0 || before.goals > 0) {
                this.log('warn', `🧹 Cleaned duplicates: ${before.completions} completions, ${before.habits} habits, ${before.goals} goals`);
            }
        } catch (error) {
            this.log('error', 'Cleanup with logging failed', error);
        }
    }
    async cleanupLocalDuplicatesQuietly() {
        try {
            await this.cleanupLocalDuplicatesWithLogging();
        } catch (error) {
            // Silent failure - don't interrupt user experience
            if ("TURBOPACK compile-time truthy", 1) {
                console.error('[SyncEngine] Auto-cleanup failed:', error);
            }
        }
    }
    // ===================
    //DEDUPLICATION HELPERS
    // ===================
    /**
   * Generic deduplication helper - keeps the newest item based on updatedAt/createdAt
   */ deduplicateByKey(items, keyFn) {
        const seen = new Map();
        for (const item of items){
            const key = keyFn(item);
            const existing = seen.get(key);
            if (!existing) {
                seen.set(key, item);
            } else {
                // Keep the newer one
                const itemTime = new Date(item.updatedAt || item.createdAt || 0).getTime();
                const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
                if (itemTime > existingTime) {
                    seen.set(key, item);
                }
            }
        }
        return Array.from(seen.values());
    }
    // Public utility methods
    getSyncMetadata() {
        return {
            lastSyncAt: this.lastSyncAt?.toISOString() || null,
            pendingChanges: this.pendingOperations.size,
            isOnline: this.isOnline
        };
    }
    isCurrentlySyncing() {
        return this.isSyncing;
    }
    getOnlineStatus() {
        return this.isOnline;
    }
}
// ===================
// SINGLETON
// ===================
let syncEngine = null;
function getSyncEngine() {
    if (!syncEngine) {
        syncEngine = new SyncEngine();
    }
    return syncEngine;
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/sync/index.ts [app-client] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$sync$2f$sync$2d$engine$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/sync/sync-engine.ts [app-client] (ecmascript)");
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/calculations/index.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "calculateBestStreak",
    ()=>calculateBestStreak,
    "calculateCategoryBreakdown",
    ()=>calculateCategoryBreakdown,
    "calculateCompletionRate",
    ()=>calculateCompletionRate,
    "calculateCurrentStreak",
    ()=>calculateCurrentStreak,
    "calculateDailyStats",
    ()=>calculateDailyStats,
    "calculateGoalStats",
    ()=>calculateGoalStats,
    "calculateHabitStats",
    ()=>calculateHabitStats,
    "calculateMomentum",
    ()=>calculateMomentum,
    "calculateMonthlyCompletionRate",
    ()=>calculateMonthlyCompletionRate,
    "formatDate",
    ()=>formatDate,
    "generateHeatmapData",
    ()=>generateHeatmapData,
    "getDeadlineStatus",
    ()=>getDeadlineStatus,
    "getMonthDates",
    ()=>getMonthDates,
    "getWeekDates",
    ()=>getWeekDates,
    "isDateInFuture",
    ()=>isDateInFuture,
    "isDateToday",
    ()=>isDateToday
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$format$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/date-fns/format.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$startOfMonth$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/date-fns/startOfMonth.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$endOfMonth$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/date-fns/endOfMonth.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$eachDayOfInterval$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/date-fns/eachDayOfInterval.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$differenceInDays$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/date-fns/differenceInDays.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$isAfter$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/date-fns/isAfter.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$isBefore$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/date-fns/isBefore.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$isToday$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/date-fns/isToday.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$parseISO$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/date-fns/parseISO.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$startOfWeek$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/date-fns/startOfWeek.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$endOfWeek$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/date-fns/endOfWeek.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$subDays$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/date-fns/subDays.js [app-client] (ecmascript)");
;
function formatDate(date) {
    const d = typeof date === 'string' ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$parseISO$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["parseISO"])(date) : date;
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$format$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["format"])(d, 'yyyy-MM-dd');
}
function getMonthDates(year, month) {
    const start = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$startOfMonth$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["startOfMonth"])(new Date(year, month));
    const end = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$endOfMonth$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["endOfMonth"])(new Date(year, month));
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$eachDayOfInterval$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["eachDayOfInterval"])({
        start,
        end
    });
}
function getWeekDates(date, weekStartsOn = 1) {
    const start = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$startOfWeek$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["startOfWeek"])(date, {
        weekStartsOn
    });
    const end = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$endOfWeek$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["endOfWeek"])(date, {
        weekStartsOn
    });
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$eachDayOfInterval$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["eachDayOfInterval"])({
        start,
        end
    });
}
function isDateInFuture(date) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$isAfter$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isAfter"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$parseISO$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["parseISO"])(date), new Date());
}
function isDateToday(date) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$isToday$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isToday"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$parseISO$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["parseISO"])(date));
}
function calculateCurrentStreak(completions, today = new Date()) {
    if (completions.length === 0) return 0;
    // Sort completions by date descending, including frozen
    const sorted = [
        ...completions
    ].filter((c)=>c.completed || c.status === 'frozen').sort((a, b)=>b.date.localeCompare(a.date));
    if (sorted.length === 0) return 0;
    // Check if today or yesterday is completed or frozen (streak is active)
    const todayStr = formatDate(today);
    const yesterdayStr = formatDate((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$subDays$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["subDays"])(today, 1));
    const hasRecent = sorted.some((c)=>c.date === todayStr || c.date === yesterdayStr);
    if (!hasRecent) return 0;
    // Count consecutive days
    let streak = 0;
    let currentDate = sorted[0].date === todayStr ? today : (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$subDays$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["subDays"])(today, 1);
    for(let i = 0; i < 365; i++){
        const dateStr = formatDate(currentDate);
        const comp = sorted.find((c)=>c.date === dateStr);
        if (comp) {
            if (comp.status !== 'frozen' && comp.completed) {
                streak++;
            }
            currentDate = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$subDays$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["subDays"])(currentDate, 1);
        } else {
            break;
        }
    }
    return streak;
}
function calculateBestStreak(completions) {
    if (completions.length === 0) return 0;
    const sorted = [
        ...completions
    ].filter((c)=>c.completed || c.status === 'frozen').sort((a, b)=>a.date.localeCompare(b.date));
    if (sorted.length === 0) return 0;
    let bestStreak = 0;
    let currentStreak = sorted[0].status === 'frozen' ? 0 : 1;
    bestStreak = Math.max(bestStreak, currentStreak);
    for(let i = 1; i < sorted.length; i++){
        const prevDate = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$parseISO$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["parseISO"])(sorted[i - 1].date);
        const currDate = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$parseISO$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["parseISO"])(sorted[i].date);
        const diff = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$differenceInDays$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["differenceInDays"])(currDate, prevDate);
        if (diff === 1) {
            if (sorted[i].status !== 'frozen' && sorted[i].completed) {
                currentStreak++;
            }
            bestStreak = Math.max(bestStreak, currentStreak);
        } else if (diff > 1) {
            currentStreak = sorted[i].status === 'frozen' ? 0 : 1;
        }
    // If diff === 0, same day, ignore
    }
    return bestStreak;
}
function calculateCompletionRate(completions, totalDays) {
    if (totalDays === 0) return 0;
    const completed = completions.filter((c)=>c.completed).length;
    return Math.round(completed / totalDays * 100);
}
function calculateMonthlyCompletionRate(completions, year, month, today = new Date()) {
    const monthStart = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$startOfMonth$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["startOfMonth"])(new Date(year, month));
    const monthEnd = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$endOfMonth$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["endOfMonth"])(new Date(year, month));
    // Only count days up to today if current month
    const endDate = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$isBefore$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isBefore"])(monthEnd, today) ? monthEnd : today;
    const totalDays = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$differenceInDays$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["differenceInDays"])(endDate, monthStart) + 1;
    const monthCompletions = completions.filter((c)=>{
        const date = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$parseISO$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["parseISO"])(c.date);
        return !(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$isBefore$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isBefore"])(date, monthStart) && !(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$isAfter$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isAfter"])(date, endDate) && c.completed;
    });
    return calculateCompletionRate(monthCompletions, totalDays);
}
function calculateMomentum(completions, today = new Date()) {
    // Compare last 7 days vs previous 7 days
    const last7DaysStart = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$subDays$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["subDays"])(today, 6);
    const prev7DaysStart = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$subDays$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["subDays"])(today, 13);
    const prev7DaysEnd = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$subDays$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["subDays"])(today, 7);
    const last7 = completions.filter((c)=>{
        const date = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$parseISO$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["parseISO"])(c.date);
        return !(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$isBefore$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isBefore"])(date, last7DaysStart) && !(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$isAfter$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isAfter"])(date, today) && c.completed;
    }).length;
    const prev7 = completions.filter((c)=>{
        const date = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$parseISO$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["parseISO"])(c.date);
        return !(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$isBefore$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isBefore"])(date, prev7DaysStart) && !(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$isAfter$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isAfter"])(date, prev7DaysEnd) && c.completed;
    }).length;
    if (last7 > prev7) return 'up';
    if (last7 < prev7) return 'down';
    return 'stable';
}
function calculateHabitStats(habit, completions, today = new Date()) {
    const habitCompletions = completions.filter((c)=>c.habitId === habit.id);
    const createdDate = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$parseISO$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["parseISO"])(habit.createdAt);
    const totalDays = Math.max(1, (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$differenceInDays$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["differenceInDays"])(today, createdDate) + 1);
    return {
        habitId: habit.id,
        currentStreak: calculateCurrentStreak(habitCompletions, today),
        bestStreak: calculateBestStreak(habitCompletions),
        completionRate: calculateCompletionRate(habitCompletions, totalDays),
        totalCompletions: habitCompletions.filter((c)=>c.completed).length,
        totalDays,
        momentum: calculateMomentum(habitCompletions, today)
    };
}
function calculateGoalStats(goal, milestones, today = new Date()) {
    const goalMilestones = milestones.filter((m)=>m.goalId === goal.id);
    const completedMilestones = goalMilestones.filter((m)=>m.completed);
    const startDate = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$parseISO$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["parseISO"])(goal.startDate);
    const deadline = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$parseISO$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["parseISO"])(goal.deadline);
    const totalDays = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$differenceInDays$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["differenceInDays"])(deadline, startDate);
    const daysElapsed = Math.max(0, (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$differenceInDays$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["differenceInDays"])(today, startDate));
    const daysRemaining = Math.max(0, (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$differenceInDays$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["differenceInDays"])(deadline, today));
    const progress = goalMilestones.length > 0 ? Math.round(completedMilestones.length / goalMilestones.length * 100) : 0;
    // Calculate if on track
    const expectedProgress = totalDays > 0 ? daysElapsed / totalDays * 100 : 0;
    const isOnTrack = progress >= expectedProgress - 10; // 10% tolerance
    // Project completion
    let projectedCompletion;
    if (daysElapsed > 0 && progress > 0) {
        const progressRate = progress / daysElapsed;
        projectedCompletion = Math.min(100, Math.round(progressRate * (daysElapsed + daysRemaining)));
    }
    return {
        goalId: goal.id,
        progress,
        milestonesCompleted: completedMilestones.length,
        milestonesTotal: goalMilestones.length,
        daysRemaining,
        daysElapsed,
        totalDays,
        isOnTrack,
        projectedCompletion
    };
}
function getDeadlineStatus(deadline, today = new Date()) {
    const deadlineDate = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$parseISO$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["parseISO"])(deadline);
    const daysLeft = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$differenceInDays$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["differenceInDays"])(deadlineDate, today);
    if (daysLeft < 0) {
        return {
            label: `Overdue by ${Math.abs(daysLeft)} days`,
            color: 'destructive',
            daysLeft
        };
    }
    if (daysLeft === 0) {
        return {
            label: 'Due today',
            color: 'warning',
            daysLeft
        };
    }
    if (daysLeft === 1) {
        return {
            label: 'Due tomorrow',
            color: 'warning',
            daysLeft
        };
    }
    if (daysLeft <= 7) {
        return {
            label: `${daysLeft} days left`,
            color: 'warning',
            daysLeft
        };
    }
    return {
        label: `${daysLeft} days left`,
        color: 'muted',
        daysLeft
    };
}
function calculateDailyStats(habits, completions, startDate, endDate) {
    const days = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$eachDayOfInterval$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["eachDayOfInterval"])({
        start: startDate,
        end: endDate
    });
    return days.map((day)=>{
        const dateStr = formatDate(day);
        const dayCompletions = completions.filter((c)=>c.date === dateStr && c.completed);
        const activeHabits = habits.filter((h)=>!h.archived && !(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$isAfter$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isAfter"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$parseISO$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["parseISO"])(h.createdAt), day));
        return {
            date: dateStr,
            completedHabits: dayCompletions.length,
            totalHabits: activeHabits.length,
            completionRate: activeHabits.length > 0 ? Math.round(dayCompletions.length / activeHabits.length * 100) : 0
        };
    });
}
function calculateCategoryBreakdown(habits, completions) {
    const categories = [
        'health',
        'work',
        'learning',
        'personal',
        'finance',
        'relationships'
    ];
    const breakdown = categories.map((category)=>{
        const categoryHabits = habits.filter((h)=>h.category === category && !h.archived);
        const categoryCompletions = completions.filter((c)=>categoryHabits.some((h)=>h.id === c.habitId) && c.completed);
        const totalPossible = categoryHabits.length * 30; // Approximate month
        return {
            category,
            count: categoryHabits.length,
            percentage: habits.length > 0 ? Math.round(categoryHabits.length / habits.length * 100) : 0,
            completionRate: totalPossible > 0 ? Math.round(categoryCompletions.length / totalPossible * 100) : 0
        };
    });
    return breakdown.filter((b)=>b.count > 0);
}
function generateHeatmapData(completions, habits, days = 365) {
    const today = new Date();
    const startDate = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$subDays$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["subDays"])(today, days - 1);
    const dates = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$eachDayOfInterval$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["eachDayOfInterval"])({
        start: startDate,
        end: today
    });
    const maxPossible = habits.filter((h)=>!h.archived).length;
    return dates.map((date)=>{
        const dateStr = formatDate(date);
        const count = completions.filter((c)=>c.date === dateStr && c.completed).length;
        // Calculate intensity level (0-4)
        let level = 0;
        if (maxPossible > 0) {
            const percentage = count / maxPossible;
            if (percentage > 0.8) level = 4;
            else if (percentage > 0.6) level = 3;
            else if (percentage > 0.4) level = 2;
            else if (percentage > 0) level = 1;
        }
        return {
            date: dateStr,
            count,
            level
        };
    });
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/stores/goal-store.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useGoalStore",
    ()=>useGoalStore
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/zustand/esm/react.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/db.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/supabase/client.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$calculations$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/calculations/index.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$sync$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/src/lib/sync/index.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$sync$2f$sync$2d$engine$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/sync/sync-engine.ts [app-client] (ecmascript)");
;
;
;
;
;
const useGoalStore = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["create"])((set, get)=>({
        goals: [],
        milestones: [],
        isLoading: false,
        error: null,
        statusFilter: [],
        areaFilter: [],
        loadGoals: async ()=>{
            set({
                isLoading: true,
                error: null
            });
            try {
                const supabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSupabaseClient"])();
                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.user?.id) {
                    set({
                        goals: [],
                        isLoading: false
                    });
                    return;
                }
                const goals = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getGoals"])(session.user.id);
                set({
                    goals,
                    isLoading: false
                });
            } catch (error) {
                set({
                    error: error.message,
                    isLoading: false
                });
            }
        },
        loadAllMilestones: async ()=>{
            try {
                const supabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSupabaseClient"])();
                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.user?.id) {
                    set({
                        milestones: []
                    });
                    return;
                }
                const milestones = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].milestones.where('userId').equals(session.user.id).toArray();
                set({
                    milestones
                });
            } catch (error) {
                set({
                    error: error.message
                });
            }
        },
        addGoal: async (data)=>{
            const { milestones: milestoneTitles, isFocus, ...goalData } = data;
            const supabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSupabaseClient"])();
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user?.id) throw new Error("User not authenticated");
            const userId = session.user.id;
            const goal = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createGoal"])({
                ...goalData,
                userId,
                status: 'not_started',
                isFocus: isFocus || false,
                // Actually, createGoal doesn't handle the "exclusive" logic, setFocus does.
                // Let's rely on setFocus to ensure exclusivity.
                archived: false
            });
            // Create milestones
            const createdMilestones = [];
            for (const title of milestoneTitles){
                if (title.trim()) {
                    const milestone = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createMilestone"])({
                        goalId: goal.id,
                        title: title.trim(),
                        userId: userId
                    });
                    createdMilestones.push(milestone);
                }
            }
            set((state)=>({
                    goals: [
                        ...state.goals,
                        goal
                    ],
                    milestones: [
                        ...state.milestones,
                        ...createdMilestones
                    ]
                }));
            // If isFocus is true, we need to update the store and DB to reflect this exclusive status
            if (isFocus) {
                await get().setFocus(goal.id);
            }
            // Sync to cloud
            try {
                const syncEngine = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$sync$2f$sync$2d$engine$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSyncEngine"])();
                await syncEngine.pushGoal(goal);
                for (const milestone of createdMilestones){
                    await syncEngine.pushMilestone(milestone);
                }
            // If we called setFocus, we might need to sync the updates to other goals (unsetting their focus)
            // setFocus action handles syncing of the updated goals, so we are good there.
            } catch (error) {
                console.error('Failed to sync goal:', error);
            }
            return goal;
        },
        editGoal: async (id, data)=>{
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["updateGoal"])(id, data);
            const updatedGoal = get().goals.find((g)=>g.id === id);
            set((state)=>({
                    goals: state.goals.map((g)=>g.id === id ? {
                            ...g,
                            ...data
                        } : g)
                }));
            // Sync to cloud
            if (updatedGoal) {
                try {
                    const syncEngine = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$sync$2f$sync$2d$engine$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSyncEngine"])();
                    await syncEngine.pushGoal({
                        ...updatedGoal,
                        ...data
                    });
                } catch (error) {
                    console.error('Failed to sync goal:', error);
                }
            }
        },
        removeGoal: async (id)=>{
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["deleteGoal"])(id);
            set((state)=>({
                    goals: state.goals.filter((g)=>g.id !== id),
                    milestones: state.milestones.filter((m)=>m.goalId !== id)
                }));
            // Sync to cloud
            try {
                const syncEngine = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$sync$2f$sync$2d$engine$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSyncEngine"])();
                await syncEngine.deleteGoal(id);
            } catch (error) {
                console.error('Failed to sync goal deletion:', error);
            }
        },
        setFocus: async (goalId)=>{
            const currentGoal = get().goals.find((g)=>g.id === goalId);
            if (!currentGoal) return;
            // If trying to set as focus (currently not focus)
            if (!currentGoal.isFocus) {
                // Check how many focus goals we already have
                const currentFocusCount = get().goals.filter((g)=>g.isFocus && !g.archived).length;
                // If we already have 2 focus goals, don't allow setting another
                if (currentFocusCount >= 2) {
                    console.warn('Maximum of 2 focus goals allowed');
                    return;
                }
            }
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["setFocusGoal"])(goalId);
            // Toggle the focus status in the store
            const updatedGoals = get().goals.map((g)=>g.id === goalId ? {
                    ...g,
                    isFocus: !g.isFocus
                } : g);
            set({
                goals: updatedGoals
            });
            // Sync to cloud
            try {
                const syncEngine = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$sync$2f$sync$2d$engine$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSyncEngine"])();
                const updatedGoal = updatedGoals.find((g)=>g.id === goalId);
                if (updatedGoal) {
                    await syncEngine.pushGoal(updatedGoal);
                }
            } catch (error) {
                console.error('Failed to sync focus goal:', error);
            }
        },
        addMilestone: async (goalId, data)=>{
            const supabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSupabaseClient"])();
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user?.id) throw new Error("User not authenticated");
            const milestone = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createMilestone"])({
                goalId,
                ...data,
                userId: session.user.id
            });
            set((state)=>({
                    milestones: [
                        ...state.milestones,
                        milestone
                    ]
                }));
            // Sync to cloud
            try {
                const syncEngine = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$sync$2f$sync$2d$engine$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSyncEngine"])();
                await syncEngine.pushMilestone(milestone);
            } catch (error) {
                console.error('Failed to sync milestone:', error);
            }
            return milestone;
        },
        editMilestone: async (id, data)=>{
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["updateMilestone"])(id, data);
            const updatedMilestone = get().milestones.find((m)=>m.id === id);
            set((state)=>({
                    milestones: state.milestones.map((m)=>m.id === id ? {
                            ...m,
                            ...data
                        } : m)
                }));
            // Sync to cloud
            if (updatedMilestone) {
                try {
                    const syncEngine = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$sync$2f$sync$2d$engine$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSyncEngine"])();
                    await syncEngine.pushMilestone({
                        ...updatedMilestone,
                        ...data
                    });
                } catch (error) {
                    console.error('Failed to sync milestone:', error);
                }
            }
        },
        removeMilestone: async (id)=>{
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["deleteMilestone"])(id);
            set((state)=>({
                    milestones: state.milestones.filter((m)=>m.id !== id)
                }));
            // Sync to cloud
            try {
                const syncEngine = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$sync$2f$sync$2d$engine$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSyncEngine"])();
                await syncEngine.deleteMilestone(id);
            } catch (error) {
                console.error('Failed to sync milestone deletion:', error);
            }
        },
        toggleMilestoneComplete: async (id)=>{
            const updated = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toggleMilestone"])(id);
            if (updated) {
                set((state)=>({
                        milestones: state.milestones.map((m)=>m.id === id ? updated : m)
                    }));
                // Sync to cloud
                try {
                    const syncEngine = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$sync$2f$sync$2d$engine$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSyncEngine"])();
                    await syncEngine.pushMilestone(updated);
                } catch (error) {
                    console.error('Failed to sync milestone:', error);
                }
            }
        },
        setStatusFilter: (statuses)=>{
            set({
                statusFilter: statuses
            });
        },
        setAreaFilter: (areas)=>{
            set({
                areaFilter: areas
            });
        },
        getGoalStats: (goalId)=>{
            const { goals, milestones } = get();
            const goal = goals.find((g)=>g.id === goalId);
            if (!goal) {
                return {
                    goalId,
                    progress: 0,
                    milestonesCompleted: 0,
                    milestonesTotal: 0,
                    daysRemaining: 0,
                    daysElapsed: 0,
                    totalDays: 0,
                    isOnTrack: false
                };
            }
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$calculations$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["calculateGoalStats"])(goal, milestones);
        },
        getGoalMilestones: (goalId)=>{
            return get().milestones.filter((m)=>m.goalId === goalId).sort((a, b)=>a.order - b.order);
        },
        getFocusGoal: ()=>{
            return get().goals.find((g)=>g.isFocus && !g.archived);
        },
        getFocusGoals: ()=>{
            // Return up to 2 focus goals, sorted by priority (high first) then deadline (earliest first)
            const focusGoals = get().goals.filter((g)=>g.isFocus && !g.archived);
            return focusGoals.sort((a, b)=>{
                const priorityOrder = {
                    high: 0,
                    medium: 1,
                    low: 2
                };
                const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
                if (priorityDiff !== 0) return priorityDiff;
                return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
            }).slice(0, 2);
        },
        getGoalDeadlineStatus: (goalId)=>{
            const goal = get().goals.find((g)=>g.id === goalId);
            if (!goal) {
                return {
                    label: 'Unknown',
                    color: 'muted',
                    daysLeft: 0
                };
            }
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$calculations$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getDeadlineStatus"])(goal.deadline);
        },
        getFilteredGoals: ()=>{
            const { goals, statusFilter, areaFilter } = get();
            return goals.filter((goal)=>{
                if (goal.archived) return false;
                if (statusFilter.length > 0 && !statusFilter.includes(goal.status)) {
                    return false;
                }
                if (areaFilter.length > 0 && !areaFilter.includes(goal.areaOfLife)) {
                    return false;
                }
                return true;
            });
        },
        getActiveGoalsCount: ()=>{
            return get().goals.filter((g)=>!g.archived && g.status !== 'completed').length;
        },
        getUpcomingDeadlines: (days = 7)=>{
            const today = new Date();
            const futureDate = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);
            return get().goals.filter((goal)=>{
                if (goal.archived || goal.status === 'completed') return false;
                const deadline = new Date(goal.deadline);
                return deadline <= futureDate;
            }).sort((a, b)=>new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
        }
    }));
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/stores/gamification-store.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GEMS_PER_LEVEL",
    ()=>GEMS_PER_LEVEL,
    "SHIELD_COST",
    ()=>SHIELD_COST,
    "XP_PER_HABIT",
    ()=>XP_PER_HABIT,
    "XP_PER_ROUTINE",
    ()=>XP_PER_ROUTINE,
    "XP_PER_TASK",
    ()=>XP_PER_TASK,
    "useGamificationStore",
    ()=>useGamificationStore
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/zustand/esm/react.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/db.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/supabase/client.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$sync$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/src/lib/sync/index.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$sync$2f$sync$2d$engine$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/sync/sync-engine.ts [app-client] (ecmascript)");
;
;
;
;
const XP_PER_TASK = 10;
const XP_PER_HABIT = 15;
const XP_PER_ROUTINE = 50;
const GEMS_PER_LEVEL = 5;
const SHIELD_COST = 20;
const useGamificationStore = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["create"])((set, get)=>({
        xp: 0,
        level: 1,
        gems: 0,
        streakShield: 0,
        isLoading: false,
        showLevelUp: false,
        rulesModalOpen: false,
        activeRulesTab: 'xp',
        // Default Stats (Will be overridden by DB)
        stats: {
            vitality: 1,
            intelligence: 1,
            discipline: 1,
            charisma: 1,
            wealth: 1,
            creativity: 1
        },
        unlockedThemes: [],
        motivationText: '',
        loadGamification: async ()=>{
            set({
                isLoading: true
            });
            try {
                const supabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSupabaseClient"])();
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.user?.id) {
                    const settings = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSettings"])(session.user.id);
                    if (settings) {
                        set({
                            xp: settings.xp ?? 0,
                            level: settings.level ?? 1,
                            gems: settings.gems ?? 0,
                            streakShield: settings.streakShield ?? 0,
                            stats: settings.stats || get().stats,
                            unlockedThemes: settings.unlockedThemes || [],
                            // If DB doesn't have these fields yet, use defaults or mock
                            motivationText: settings.motivation_text ?? ''
                        });
                    }
                }
            } catch (error) {
                console.error('Failed to load gamification data:', error);
            } finally{
                set({
                    isLoading: false
                });
            }
        },
        openRules: (tab = 'xp')=>set({
                rulesModalOpen: true,
                activeRulesTab: tab
            }),
        closeRules: ()=>set({
                rulesModalOpen: false
            }),
        setActiveRulesTab: (tab)=>set({
                activeRulesTab: tab
            }),
        updateMotivation: async (text)=>{
            set({
                motivationText: text
            });
            // Persist to DB
            const supabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSupabaseClient"])();
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                // Note: 'motivation_text' needs to be added to DB schema if not present.
                // For now, we'll try to save it if the column exists, or rely on local state/mock.
                // In a real scenario, we'd add a migration.
                try {
                    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["updateSettings"])({
                        userId: session.user.id,
                        motivation_text: text
                    });
                } catch (e) {
                    console.warn("Failed to persist motivation text (column might be missing)", e);
                }
            }
        },
        addXp: async (amount, category)=>{
            const { xp, level, gems, streakShield, stats, unlockedThemes } = get();
            let newXp = xp + amount;
            let newLevel = level;
            let newGems = gems;
            let leveledUp = false;
            // Calculate stat increments (1 point per 10 XP)
            const statPoints = Math.max(1, Math.floor(amount / 10));
            const newStats = {
                ...stats
            };
            newStats.discipline += statPoints; // Always give discipline
            if (category) {
                switch(category){
                    case 'health':
                        newStats.vitality += statPoints;
                        break;
                    case 'learning':
                    case 'work':
                        newStats.intelligence += statPoints;
                        break;
                    case 'personal':
                        newStats.creativity += statPoints;
                        break;
                    case 'finance':
                        newStats.wealth += statPoints;
                        break;
                    case 'relationships':
                        newStats.charisma += statPoints;
                        break;
                }
            }
            // Formula: XP required for next level = Level * 100
            const xpRequired = level * 100;
            if (newXp >= xpRequired) {
                newLevel += 1;
                newXp = newXp - xpRequired; // Carry over excess XP
                newGems += GEMS_PER_LEVEL;
                leveledUp = true;
            }
            set({
                xp: newXp,
                level: newLevel,
                gems: newGems,
                showLevelUp: leveledUp,
                stats: newStats
            });
            // Persist to DB
            const supabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSupabaseClient"])();
            const { data: { session } = {} } = await supabase.auth.getSession();
            if (session?.user) {
                await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["updateSettings"])({
                    userId: session.user.id,
                    xp: newXp,
                    level: newLevel,
                    gems: newGems,
                    streakShield,
                    stats: newStats,
                    unlockedThemes
                });
                // Sync to Supabase via sync engine with COMPLETE settings
                const currentSettings = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSettings"])(session.user.id);
                const syncEngine = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$sync$2f$sync$2d$engine$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSyncEngine"])();
                syncEngine.pushUserSettings({
                    userName: currentSettings?.userName,
                    weekStartsOn: currentSettings?.weekStartsOn ?? 0,
                    defaultCategory: currentSettings?.defaultCategory ?? 'health',
                    xp: newXp,
                    level: newLevel,
                    gems: newGems,
                    streakShield,
                    stats: newStats,
                    unlockedThemes
                });
            }
            return {
                leveledUp,
                newLevel
            };
        },
        spendGems: async (amount)=>{
            const { gems } = get();
            if (gems < amount) return false;
            const newGems = gems - amount;
            set({
                gems: newGems
            });
            const supabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSupabaseClient"])();
            const { data: { session } = {} } = await supabase.auth.getSession();
            if (session?.user) {
                const { xp, level, streakShield } = get();
                await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["updateSettings"])({
                    userId: session.user.id,
                    gems: newGems
                });
                // Sync to Supabase with complete settings
                const currentSettings = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSettings"])(session.user.id);
                const syncEngine = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$sync$2f$sync$2d$engine$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSyncEngine"])();
                syncEngine.pushUserSettings({
                    userName: currentSettings?.userName,
                    weekStartsOn: currentSettings?.weekStartsOn ?? 0,
                    defaultCategory: currentSettings?.defaultCategory ?? 'health',
                    xp,
                    level,
                    gems: newGems,
                    streakShield
                });
            }
            return true;
        },
        buyShield: async ()=>{
            const { gems, streakShield } = get();
            if (gems < SHIELD_COST) return false;
            const newGems = gems - SHIELD_COST;
            const newShields = streakShield + 1;
            set({
                gems: newGems,
                streakShield: newShields
            });
            const supabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSupabaseClient"])();
            const { data: { session } = {} } = await supabase.auth.getSession();
            if (session?.user) {
                const { xp, level } = get();
                await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["updateSettings"])({
                    userId: session.user.id,
                    gems: newGems,
                    streakShield: newShields
                });
                // Sync to Supabase with complete settings
                const currentSettings = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSettings"])(session.user.id);
                const syncEngine = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$sync$2f$sync$2d$engine$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSyncEngine"])();
                syncEngine.pushUserSettings({
                    userName: currentSettings?.userName,
                    weekStartsOn: currentSettings?.weekStartsOn ?? 0,
                    defaultCategory: currentSettings?.defaultCategory ?? 'health',
                    xp,
                    level,
                    gems: newGems,
                    streakShield: newShields
                });
            }
            return true;
        },
        closeLevelUp: ()=>set({
                showLevelUp: false
            }),
        getBufferProgress: ()=>{
            const { xp, level } = get();
            const xpRequired = level * 100;
            return Math.min(100, xp / xpRequired * 100);
        }
    }));
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/stores/habit-store.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useHabitStore",
    ()=>useHabitStore
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/zustand/esm/react.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/db.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/supabase/client.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$calculations$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/calculations/index.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$format$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/date-fns/format.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$startOfMonth$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/date-fns/startOfMonth.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$endOfMonth$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/date-fns/endOfMonth.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$subMonths$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/date-fns/subMonths.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$sync$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/src/lib/sync/index.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$sync$2f$sync$2d$engine$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/sync/sync-engine.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$stores$2f$gamification$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/stores/gamification-store.ts [app-client] (ecmascript)");
;
;
;
;
;
;
;
const useHabitStore = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["create"])((set, get)=>({
        habits: [],
        completions: [],
        isLoading: false,
        error: null,
        selectedMonth: new Date(),
        categoryFilter: [],
        loadHabits: async ()=>{
            set({
                isLoading: true,
                error: null
            });
            try {
                // Clean up any duplicate habits first
                await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cleanupDuplicateHabits"])();
                const supabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSupabaseClient"])();
                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.user?.id) {
                    set({
                        habits: [],
                        isLoading: false
                    });
                    return;
                }
                const habits = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getHabits"])(session.user.id);
                set({
                    habits,
                    isLoading: false
                });
            } catch (error) {
                set({
                    error: error.message,
                    isLoading: false
                });
            }
        },
        loadCompletions: async (startDate, endDate)=>{
            try {
                // Clean up any duplicate completions first
                await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cleanupDuplicateCompletions"])();
                const supabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSupabaseClient"])();
                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.user?.id) {
                    set({
                        completions: []
                    });
                    return;
                }
                const completions = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAllCompletionsInRange"])(startDate, endDate, session.user.id);
                set({
                    completions
                });
            } catch (error) {
                set({
                    error: error.message
                });
            }
        },
        loadAllCompletions: async ()=>{
            try {
                const completions = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].completions.toArray();
                set({
                    completions
                });
            } catch (error) {
                set({
                    error: error.message
                });
            }
        },
        addHabit: async (data)=>{
            const supabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSupabaseClient"])();
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user?.id) throw new Error("User not authenticated");
            const habit = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createHabit"])({
                ...data,
                userId: session.user.id
            });
            set((state)=>({
                    habits: [
                        ...state.habits,
                        habit
                    ]
                }));
            // Sync to cloud
            try {
                const syncEngine = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$sync$2f$sync$2d$engine$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSyncEngine"])();
                await syncEngine.pushHabit(habit);
            } catch (error) {
                console.error('Failed to sync habit:', error);
            }
            return habit;
        },
        editHabit: async (id, data)=>{
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["updateHabit"])(id, data);
            const updatedHabit = get().habits.find((h)=>h.id === id);
            set((state)=>({
                    habits: state.habits.map((h)=>h.id === id ? {
                            ...h,
                            ...data
                        } : h)
                }));
            // Sync to cloud
            if (updatedHabit) {
                try {
                    const syncEngine = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$sync$2f$sync$2d$engine$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSyncEngine"])();
                    await syncEngine.pushHabit({
                        ...updatedHabit,
                        ...data
                    });
                } catch (error) {
                    console.error('Failed to sync habit:', error);
                }
            }
        },
        removeHabit: async (id)=>{
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["deleteHabit"])(id);
            set((state)=>({
                    habits: state.habits.filter((h)=>h.id !== id),
                    completions: state.completions.filter((c)=>c.habitId !== id)
                }));
            // Sync to cloud
            try {
                const syncEngine = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$sync$2f$sync$2d$engine$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSyncEngine"])();
                await syncEngine.deleteHabit(id);
            } catch (error) {
                console.error('Failed to sync habit deletion:', error);
            }
        },
        toggle: async (habitId, date)=>{
            const supabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSupabaseClient"])();
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user?.id) throw new Error("User not authenticated");
            const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toggleCompletion"])(habitId, date, session.user.id);
            // If completed is true, add XP
            if (result.completed) {
                const today = new Date().toISOString().split('T')[0];
                if (date === today) {
                    const habit = get().habits.find((h)=>h.id === habitId);
                    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$stores$2f$gamification$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGamificationStore"].getState().addXp(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$stores$2f$gamification$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["XP_PER_HABIT"], habit?.category);
                }
            }
            set((state)=>{
                // Remove existing for this habit/date
                const filtered = state.completions.filter((c)=>!(c.habitId === habitId && c.date === date));
                // Add updated result (whether true or false)
                // We keep 'false' completions in store so UI knows they exist (and synced)
                // Filters in UI should check c.completed
                return {
                    completions: [
                        ...filtered,
                        result
                    ]
                };
            });
            // Sync to cloud
            try {
                const syncEngine = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$sync$2f$sync$2d$engine$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSyncEngine"])();
                // Always push the update (whether true or false)
                await syncEngine.pushCompletion(result);
            } catch (error) {
                console.error('Failed to sync completion:', error);
            }
        },
        freezeHabit: async (habitId, date)=>{
            const supabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSupabaseClient"])();
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user?.id) throw new Error("User not authenticated");
            const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["freezeCompletion"])(habitId, date, session.user.id);
            set((state)=>{
                const filtered = state.completions.filter((c)=>!(c.habitId === habitId && c.date === date));
                return {
                    completions: [
                        ...filtered,
                        result
                    ]
                };
            });
            // Sync to cloud
            try {
                const syncEngine = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$sync$2f$sync$2d$engine$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSyncEngine"])();
                await syncEngine.pushCompletion(result);
            } catch (error) {
                console.error('Failed to sync freeze completion:', error);
            }
        },
        ensureComplete: async (habitId, date)=>{
            const { completions, toggle } = get();
            // Check if truly completed (exists AND completed=true)
            const isCompleted = completions.some((c)=>c.habitId === habitId && c.date === date && c.completed);
            if (!isCompleted) {
                await toggle(habitId, date);
            }
        },
        batchComplete: async (habitIds, date)=>{
            const supabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSupabaseClient"])();
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user?.id) throw new Error("User not authenticated");
            const { batchCompleteHabits } = await __turbopack_context__.A("[project]/src/lib/db.ts [app-client] (ecmascript, async loader)");
            const results = await batchCompleteHabits(habitIds, date, session.user.id);
            // Add XP for newly completed habits
            const today = new Date().toISOString().split('T')[0];
            if (date === today) {
                const { useGamificationStore, XP_PER_HABIT } = await __turbopack_context__.A("[project]/src/lib/stores/gamification-store.ts [app-client] (ecmascript, async loader)");
                results.forEach((r)=>{
                    // Simple heuristic: if created recently or updated recently (in this transaction)
                    if (r.updatedAt === r.createdAt || new Date(r.updatedAt).getTime() - new Date(r.createdAt).getTime() < 1000) {
                        const habit = get().habits.find((h)=>h.id === r.habitId);
                        useGamificationStore.getState().addXp(XP_PER_HABIT, habit?.category);
                    }
                });
            }
            set((state)=>{
                const filtered = state.completions.filter((c)=>!(habitIds.includes(c.habitId) && c.date === date));
                return {
                    completions: [
                        ...filtered,
                        ...results
                    ]
                };
            });
            // Sync to cloud
            try {
                const syncEngine = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$sync$2f$sync$2d$engine$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSyncEngine"])();
                for (const result of results){
                    await syncEngine.pushCompletion(result);
                }
            } catch (error) {
                console.error('Failed to sync batch completions:', error);
            }
        },
        reorder: async (orderedIds)=>{
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["reorderHabits"])(orderedIds);
            set((state)=>{
                const reordered = orderedIds.map((id, index)=>{
                    const habit = state.habits.find((h)=>h.id === id);
                    return habit ? {
                        ...habit,
                        order: index
                    } : null;
                }).filter(Boolean);
                // Sync all reordered habits to cloud
                try {
                    const syncEngine = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$sync$2f$sync$2d$engine$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSyncEngine"])();
                    reordered.forEach((habit)=>syncEngine.pushHabit(habit));
                } catch (error) {
                    console.error('Failed to sync habit reorder:', error);
                }
                return {
                    habits: reordered
                };
            });
        },
        setSelectedMonth: (date)=>{
            set({
                selectedMonth: date
            });
        },
        setCategoryFilter: (categories)=>{
            set({
                categoryFilter: categories
            });
        },
        initializeWithDemoData: async ()=>{
            set({
                isLoading: true
            });
            const supabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSupabaseClient"])();
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user?.id) {
                await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["seedDemoData"])(session.user.id);
                await get().loadHabits();
                // Load completions for current and previous month
                const today = new Date();
                const start = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$format$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["format"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$startOfMonth$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["startOfMonth"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$subMonths$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["subMonths"])(today, 1)), 'yyyy-MM-dd');
                const end = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$format$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["format"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$endOfMonth$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["endOfMonth"])(today), 'yyyy-MM-dd');
                await get().loadCompletions(start, end);
            }
            set({
                isLoading: false
            });
        },
        getHabitStats: (habitId)=>{
            const { habits, completions } = get();
            const habit = habits.find((h)=>h.id === habitId);
            if (!habit) return null;
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$calculations$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["calculateHabitStats"])(habit, completions);
        },
        getCompletionForDate: (habitId, date)=>{
            return get().completions.find((c)=>c.habitId === habitId && c.date === date);
        },
        getTodayProgress: ()=>{
            const { habits, completions } = get();
            const today = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$format$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["format"])(new Date(), 'yyyy-MM-dd');
            const activeHabits = habits.filter((h)=>!h.archived);
            const todayCompletions = completions.filter((c)=>c.date === today && c.completed && activeHabits.some((h)=>h.id === c.habitId));
            // Deduplicate by habitId - only count each habit once
            const uniqueHabitIds = new Set(todayCompletions.map((c)=>c.habitId));
            const completed = uniqueHabitIds.size;
            const total = activeHabits.length;
            const percentage = total > 0 ? Math.round(completed / total * 100) : 0;
            return {
                completed,
                total,
                percentage
            };
        },
        getMonthlyProgress: ()=>{
            const { habits, completions, selectedMonth } = get();
            const start = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$startOfMonth$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["startOfMonth"])(selectedMonth);
            const end = new Date() < (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$endOfMonth$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["endOfMonth"])(selectedMonth) ? new Date() : (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$endOfMonth$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["endOfMonth"])(selectedMonth);
            const activeHabits = habits.filter((h)=>!h.archived);
            const days = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            const total = activeHabits.length * days;
            const startStr = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$format$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["format"])(start, 'yyyy-MM-dd');
            const endStr = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$format$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["format"])(end, 'yyyy-MM-dd');
            const monthCompletions = completions.filter((c)=>c.date >= startStr && c.date <= endStr && c.completed);
            const completed = monthCompletions.length;
            const percentage = total > 0 ? Math.round(completed / total * 100) : 0;
            return {
                completed,
                total,
                percentage
            };
        },
        getCurrentStreaks: ()=>{
            const { habits, completions } = get();
            const streaks = new Map();
            for (const habit of habits){
                const stats = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$calculations$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["calculateHabitStats"])(habit, completions);
                streaks.set(habit.id, stats.currentStreak);
            }
            return streaks;
        },
        getHabitRoutines: async (habitId)=>{
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getRoutinesForHabit"])(habitId);
        },
        getRoutinesForMultipleHabits: async (habitIds)=>{
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getRoutinesForHabits"])(habitIds);
        },
        getHabitCompletions: (habitId)=>{
            return get().completions.filter((c)=>c.habitId === habitId);
        },
        linkToRoutine: async (habitId, routineId)=>{
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["linkHabitToRoutine"])(habitId, routineId);
        },
        unlinkFromRoutine: async (habitId, routineId)=>{
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["unlinkHabitFromRoutine"])(habitId, routineId);
        }
    }));
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/stores/task-store.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useTaskStore",
    ()=>useTaskStore
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/zustand/esm/react.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/db.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/supabase/client.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$sync$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/src/lib/sync/index.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$sync$2f$sync$2d$engine$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/sync/sync-engine.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$stores$2f$gamification$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/stores/gamification-store.ts [app-client] (ecmascript)");
;
;
;
;
;
const useTaskStore = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["create"])((set, get)=>({
        tasks: [],
        isLoading: false,
        error: null,
        loadTasks: async ()=>{
            set({
                isLoading: true,
                error: null
            });
            try {
                const supabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSupabaseClient"])();
                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.user?.id) {
                    set({
                        tasks: [],
                        isLoading: false
                    });
                    return;
                }
                const tasks = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getTasks"])(session.user.id);
                set({
                    tasks,
                    isLoading: false
                });
            } catch (error) {
                set({
                    error: error.message,
                    isLoading: false
                });
            }
        },
        addTask: async (data)=>{
            const supabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSupabaseClient"])();
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user?.id) throw new Error("User not authenticated");
            const userId = session.user.id;
            const task = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createTask"])({
                ...data,
                userId
            });
            set((state)=>({
                    tasks: [
                        task,
                        ...state.tasks
                    ].sort((a, b)=>new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                }));
            // Sync to cloud
            try {
                const syncEngine = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$sync$2f$sync$2d$engine$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSyncEngine"])();
                await syncEngine.pushTask(task);
            } catch (error) {
                console.error('Failed to sync task:', error);
            }
            return task;
        },
        editTask: async (id, data)=>{
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["updateTask"])(id, data);
            const updatedTask = get().tasks.find((t)=>t.id === id);
            set((state)=>({
                    tasks: state.tasks.map((t)=>t.id === id ? {
                            ...t,
                            ...data
                        } : t)
                }));
            // Sync to cloud
            if (updatedTask) {
                try {
                    const syncEngine = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$sync$2f$sync$2d$engine$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSyncEngine"])();
                    await syncEngine.pushTask({
                        ...updatedTask,
                        ...data
                    });
                } catch (error) {
                    console.error('Failed to sync task:', error);
                }
            }
        },
        removeTask: async (id)=>{
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["deleteTask"])(id);
            set((state)=>({
                    tasks: state.tasks.filter((t)=>t.id !== id)
                }));
            // Sync to cloud
            try {
                const syncEngine = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$sync$2f$sync$2d$engine$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSyncEngine"])();
                await syncEngine.deleteTask(id);
            } catch (error) {
                console.error('Failed to sync task deletion:', error);
            }
        },
        toggleTaskComplete: async (id)=>{
            const task = get().tasks.find((t)=>t.id === id);
            if (!task) return;
            const newStatus = task.status === 'done' ? 'todo' : 'done';
            if (newStatus === 'done') {
                __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$stores$2f$gamification$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGamificationStore"].getState().addXp(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$stores$2f$gamification$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["XP_PER_TASK"]);
            }
            const updates = {
                status: newStatus
            };
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["updateTask"])(id, updates);
            set((state)=>({
                    tasks: state.tasks.map((t)=>t.id === id ? {
                            ...t,
                            ...updates
                        } : t)
                }));
            // Sync to cloud
            try {
                const syncEngine = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$sync$2f$sync$2d$engine$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSyncEngine"])();
                await syncEngine.pushTask({
                    ...task,
                    ...updates
                });
            } catch (error) {
                console.error('Failed to sync task completion:', error);
            }
        },
        getActiveTasks: ()=>{
            return get().tasks.filter((t)=>t.status !== 'done' && t.status !== 'archived');
        },
        getCompletedTasks: ()=>{
            return get().tasks.filter((t)=>t.status === 'done');
        },
        getTasksByDate: (dateStr)=>{
            // dateStr is YYYY-MM-DD
            // Compare with due_date (which might be ISO or YYYY-MM-DD)
            return get().tasks.filter((t)=>{
                if (!t.due_date) return false;
                return t.due_date.startsWith(dateStr);
            });
        }
    }));
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/stores/routine-store.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useRoutineStore",
    ()=>useRoutineStore
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/zustand/esm/react.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/db.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/supabase/client.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$v4$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__v4$3e$__ = __turbopack_context__.i("[project]/node_modules/uuid/dist/v4.js [app-client] (ecmascript) <export default as v4>");
;
;
;
;
const useRoutineStore = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["create"])((set, get)=>({
        routines: [],
        isLoading: false,
        error: null,
        loadRoutines: async ()=>{
            set({
                isLoading: true,
                error: null
            });
            try {
                const supabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSupabaseClient"])();
                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.user?.id) {
                    set({
                        routines: [],
                        isLoading: false
                    });
                    return;
                }
                // Load from local DB
                const routines = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].routines.where('userId').equals(session.user.id).sortBy('orderIndex');
                set({
                    routines,
                    isLoading: false
                });
            } catch (error) {
                set({
                    error: error.message,
                    isLoading: false
                });
            }
        },
        addRoutine: async (data)=>{
            const supabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSupabaseClient"])();
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user?.id) throw new Error("User not authenticated");
            const newRoutine = {
                id: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$v4$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__v4$3e$__["v4"])(),
                userId: session.user.id,
                title: data.title || 'New Routine',
                description: data.description,
                triggerType: data.triggerType || 'manual',
                triggerValue: data.triggerValue,
                isActive: true,
                orderIndex: get().routines.length,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                ...data
            };
            await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].routines.add(newRoutine);
            set((state)=>({
                    routines: [
                        ...state.routines,
                        newRoutine
                    ]
                }));
            return newRoutine;
        },
        updateRoutine: async (id, data)=>{
            const updates = {
                ...data,
                updatedAt: new Date().toISOString()
            };
            await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].routines.update(id, updates);
            set((state)=>({
                    routines: state.routines.map((r)=>r.id === id ? {
                            ...r,
                            ...updates
                        } : r)
                }));
        },
        deleteRoutine: async (id)=>{
            await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].routines.delete(id);
            // Unlink all habits from this routine
            const links = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].habitRoutines.where('routineId').equals(id).toArray();
            const linkIds = links.map((link)=>link.id);
            await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].habitRoutines.bulkDelete(linkIds);
            set((state)=>({
                    routines: state.routines.filter((r)=>r.id !== id)
                }));
        },
        reorderRoutines: async (orderedIds)=>{
            const now = new Date().toISOString();
            // Optimistic update
            set((state)=>{
                const reordered = orderedIds.map((id, index)=>{
                    const routine = state.routines.find((r)=>r.id === id);
                    return routine ? {
                        ...routine,
                        orderIndex: index,
                        updatedAt: now
                    } : null;
                }).filter(Boolean);
                return {
                    routines: reordered
                };
            });
            // DB update
            for(let i = 0; i < orderedIds.length; i++){
                await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].routines.update(orderedIds[i], {
                    orderIndex: i,
                    updatedAt: now
                });
            }
        },
        toggleActive: async (id)=>{
            const routine = get().routines.find((r)=>r.id === id);
            if (routine) {
                await get().updateRoutine(id, {
                    isActive: !routine.isActive
                });
            }
        },
        optimizeRoutineSequences: async ()=>{
            set({
                isLoading: true,
                error: null
            });
            try {
                const { routines } = get();
                const now = new Date().toISOString();
                for (const routine of routines){
                    // 1. Get all habit-routine links for this routine
                    const links = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].habitRoutines.where('routineId').equals(routine.id).toArray();
                    if (links.length <= 1) continue;
                    // 2. Fetch habits in this routine
                    const habitIds = links.map((l)=>l.habitId);
                    const habits = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].habits.where('id').anyOf(habitIds).toArray();
                    // 3. For each habit, calculate its completion rate based on completions
                    const habitsWithScores = await Promise.all(habits.map(async (habit)=>{
                        const completionsCount = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].completions.where('habitId').equals(habit.id).filter((c)=>c.completed).count();
                        return {
                            id: habit.id,
                            score: completionsCount
                        };
                    }));
                    // 4. Sort in descending order of performance (highest consistency first = trigger habit anchor)
                    habitsWithScores.sort((a, b)=>b.score - a.score);
                    // 5. Update orderIndex of links in DB
                    for(let i = 0; i < habitsWithScores.length; i++){
                        const habitId = habitsWithScores[i].id;
                        const link = links.find((l)=>l.habitId === habitId);
                        if (link) {
                            await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].habitRoutines.update(link.id, {
                                orderIndex: i,
                                updatedAt: now
                            });
                        }
                    }
                }
                // Reload routines to refresh state/UI
                await get().loadRoutines();
            } catch (error) {
                set({
                    error: error.message,
                    isLoading: false
                });
                throw error;
            }
        },
        getRoutineHabits: async (routineId)=>{
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getHabitsForRoutine"])(routineId);
        },
        linkHabit: async (habitId, routineId)=>{
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["linkHabitToRoutine"])(habitId, routineId);
        },
        unlinkHabit: async (habitId, routineId)=>{
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["unlinkHabitFromRoutine"])(habitId, routineId);
        }
    }));
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/stores/user-store.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useUserStore",
    ()=>useUserStore
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/zustand/esm/react.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/db.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/supabase/client.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$sync$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/src/lib/sync/index.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$sync$2f$sync$2d$engine$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/sync/sync-engine.ts [app-client] (ecmascript)");
;
;
;
;
const useUserStore = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["create"])((set, get)=>({
        displayName: '',
        email: null,
        isLoading: false,
        realtimeChannel: null,
        loadUser: async ()=>{
            set({
                isLoading: true
            });
            try {
                const supabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSupabaseClient"])();
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.user) {
                    set({
                        email: session.user.email ?? null
                    });
                    // NEW: Try to fetch from remote first (latest data across devices)
                    let displayNameLoaded = false;
                    try {
                        const { data: remoteSettings, error } = await supabase.from('user_settings').select('user_name').eq('user_id', session.user.id).single();
                        if (!error && remoteSettings && remoteSettings.user_name) {
                            const userName = remoteSettings.user_name;
                            console.log('[UserStore] Loaded display name from Supabase:', userName);
                            set({
                                displayName: userName
                            });
                            // Also update local DB to keep in sync
                            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["updateSettings"])({
                                userId: session.user.id,
                                userName: userName
                            });
                            displayNameLoaded = true;
                        }
                    } catch (error) {
                        console.warn('[UserStore] Failed to fetch from remote, falling back to local:', error);
                    }
                    // Fallback 2: local DB
                    if (!displayNameLoaded) {
                        const settings = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSettings"])(session.user.id);
                        if (settings?.userName) {
                            console.log('[UserStore] Loaded display name from local DB:', settings.userName);
                            set({
                                displayName: settings.userName
                            });
                            displayNameLoaded = true;
                        }
                    }
                    // Fallback 3: Supabase auth metadata (set at signup via options.data.full_name)
                    if (!displayNameLoaded) {
                        const metaName = session.user.user_metadata?.full_name;
                        if (metaName) {
                            console.log('[UserStore] Loaded display name from auth metadata:', metaName);
                            set({
                                displayName: metaName
                            });
                            // Persist into local + remote DB so subsequent loads hit Fallback 1/2
                            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["updateSettings"])({
                                userId: session.user.id,
                                userName: metaName
                            });
                        }
                    }
                    // NEW: Setup realtime subscription for cross-device sync
                    get().setupRealtimeSubscription();
                }
            } catch (error) {
                console.error('[UserStore] Failed to load user data:', error);
            } finally{
                set({
                    isLoading: false
                });
            }
        },
        setupRealtimeSubscription: ()=>{
            const supabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSupabaseClient"])();
            // Clean up existing subscription first
            get().cleanupRealtimeSubscription();
            supabase.auth.getSession().then(({ data: { session } })=>{
                if (!session?.user) {
                    console.log('[UserStore] No session, skipping realtime setup');
                    return;
                }
                console.log('[UserStore] Setting up realtime subscription for user:', session.user.id);
                const channel = supabase.channel('user_settings_realtime').on('postgres_changes', {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'user_settings',
                    filter: `user_id=eq.${session.user.id}`
                }, async (payload)=>{
                    console.log('[UserStore] 🔔 Realtime update detected:', payload.new);
                    const newName = payload.new.user_name;
                    if (newName && newName !== get().displayName) {
                        console.log('[UserStore] Updating display name from realtime:', newName);
                        set({
                            displayName: newName
                        });
                        // Update local DB to keep in sync
                        try {
                            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["updateSettings"])({
                                userId: session.user.id,
                                userName: newName
                            });
                            console.log('[UserStore] ✅ Display name synced via realtime');
                        } catch (error) {
                            console.error('[UserStore] Failed to update local DB:', error);
                        }
                    }
                }).subscribe((status)=>{
                    console.log('[UserStore] Realtime subscription status:', status);
                });
                set({
                    realtimeChannel: channel
                });
            });
        },
        cleanupRealtimeSubscription: ()=>{
            const channel = get().realtimeChannel;
            if (channel) {
                console.log('[UserStore] Cleaning up realtime subscription');
                const supabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSupabaseClient"])();
                supabase.removeChannel(channel);
                set({
                    realtimeChannel: null
                });
            }
        },
        setDisplayName: (name)=>{
            // LOCAL STATE UPDATE ONLY - NO ASYNC, NO SUPABASE PUSH
            console.log('[UserStore] Setting display name (local only):', name);
            // Warn if setting empty value to track where it's being called from
            if (name === '') {
                console.warn('[UserStore] ⚠️ Setting empty name - caller:', new Error().stack?.split('\n')[2]);
            }
            set({
                displayName: name
            });
        },
        saveDisplayNameToServer: async ()=>{
            const { displayName } = get();
            const supabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSupabaseClient"])();
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) {
                throw new Error('No active session');
            }
            console.log('[UserStore] 💾 Saving display name to server:', displayName);
            // 1. Update local DB
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["updateSettings"])({
                userId: session.user.id,
                userName: displayName
            });
            // 2. Push to Supabase
            const currentSettings = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSettings"])(session.user.id);
            if (currentSettings) {
                const syncEngine = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$sync$2f$sync$2d$engine$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSyncEngine"])();
                await syncEngine.pushUserSettings(currentSettings);
                console.log('[UserStore] ✅ Display name saved to Supabase');
            } else {
                console.warn('[UserStore] ⚠️ No current settings found in local DB');
            }
        }
    }));
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/providers/sync-provider.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "SyncProvider",
    ()=>SyncProvider,
    "useSync",
    ()=>useSync
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$sync$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/src/lib/sync/index.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$sync$2f$sync$2d$engine$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/sync/sync-engine.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$providers$2f$auth$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/providers/auth-provider.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$stores$2f$goal$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/stores/goal-store.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$stores$2f$habit$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/stores/habit-store.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$stores$2f$task$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/stores/task-store.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$stores$2f$routine$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/stores/routine-store.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$stores$2f$user$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/stores/user-store.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature();
'use client';
;
;
;
;
;
;
;
;
const SyncContext = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createContext"])(undefined);
function SyncProvider({ children }) {
    _s();
    const { isAuthenticated } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$providers$2f$auth$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAuth"])();
    const [syncStatus, setSyncStatus] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        type: 'idle'
    });
    const [isSyncing, setIsSyncing] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [isOnline, setIsOnline] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    const [pendingChanges, setPendingChanges] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(0);
    const [lastSyncAt, setLastSyncAt] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [isDataLoaded, setIsDataLoaded] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    // Update metadata periodically
    const updateMetadata = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "SyncProvider.useCallback[updateMetadata]": ()=>{
            const syncEngine = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$sync$2f$sync$2d$engine$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSyncEngine"])();
            const metadata = syncEngine.getSyncMetadata();
            setPendingChanges(metadata.pendingChanges);
            setLastSyncAt(metadata.lastSyncAt);
            setIsOnline(metadata.isOnline);
        }
    }["SyncProvider.useCallback[updateMetadata]"], []);
    // Eager data load - sync from Supabase FIRST, then preload into Zustand
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "SyncProvider.useEffect": ()=>{
            console.log('[SyncProvider] useEffect triggered, isAuthenticated:', isAuthenticated);
            if (!isAuthenticated) {
                console.log('[SyncProvider] Skipping sync - not authenticated');
                Promise.resolve().then({
                    "SyncProvider.useEffect": ()=>{
                        setIsDataLoaded(true); // Skip if not authenticated
                    }
                }["SyncProvider.useEffect"]);
                return;
            }
            console.log('[SyncProvider] Starting data initialization...');
            const initializeData = {
                "SyncProvider.useEffect.initializeData": async ()=>{
                    try {
                        const syncEngine = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$sync$2f$sync$2d$engine$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSyncEngine"])();
                        // Subscribe to sync status for UI feedback
                        const unsubscribe = syncEngine.onSyncStatusChange({
                            "SyncProvider.useEffect.initializeData.unsubscribe": (status)=>{
                                setSyncStatus(status);
                                setIsSyncing(status.type === 'syncing');
                            }
                        }["SyncProvider.useEffect.initializeData.unsubscribe"]);
                        // STEP 1: Check and run migrations if needed
                        console.log('[SyncProvider] STEP 1: Checking for migrations...');
                        setSyncStatus({
                            type: 'syncing',
                            message: 'Checking migrations...',
                            progress: 10
                        });
                        await syncEngine.checkAndRunMigrations();
                        console.log('[SyncProvider] STEP 1: Migration check complete');
                        // STEP 2: Sync from Supabase (pulls remote data into IndexedDB)
                        console.log('[SyncProvider] STEP 2: Syncing from Supabase to IndexedDB...');
                        setSyncStatus({
                            type: 'syncing',
                            message: 'Syncing from cloud...',
                            progress: 40
                        });
                        await syncEngine.syncAll();
                        console.log('[SyncProvider] STEP 2: Sync complete');
                        // STEP 3: Then preload from IndexedDB into Zustand stores
                        console.log('[SyncProvider] STEP 3: Loading data into Zustand stores...');
                        setSyncStatus({
                            type: 'syncing',
                            message: 'Loading data...',
                            progress: 80
                        });
                        await Promise.all([
                            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$stores$2f$user$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useUserStore"].getState().loadUser(),
                            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$stores$2f$goal$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGoalStore"].getState().loadGoals(),
                            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$stores$2f$habit$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useHabitStore"].getState().loadHabits(),
                            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$stores$2f$task$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTaskStore"].getState().loadTasks(),
                            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$stores$2f$routine$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRoutineStore"].getState().loadRoutines()
                        ]);
                        console.log('[SyncProvider] STEP 3: Store loading complete');
                        setIsDataLoaded(true);
                        setSyncStatus({
                            type: 'success',
                            message: 'All data loaded'
                        });
                        // Update metadata
                        updateMetadata();
                        // Setup periodic metadata updates
                        const metadataInterval = setInterval(updateMetadata, 30000);
                        return ({
                            "SyncProvider.useEffect.initializeData": ()=>{
                                unsubscribe();
                                clearInterval(metadataInterval);
                            }
                        })["SyncProvider.useEffect.initializeData"];
                    } catch (error) {
                        console.error('[SyncProvider] Initialization failed:', error);
                        setSyncStatus({
                            type: 'error',
                            message: 'Failed to load data'
                        });
                        setIsDataLoaded(true); // Still render even if sync fails
                    }
                }
            }["SyncProvider.useEffect.initializeData"];
            const cleanup = initializeData();
            return ({
                "SyncProvider.useEffect": ()=>{
                    cleanup.then({
                        "SyncProvider.useEffect": (fn)=>fn?.()
                    }["SyncProvider.useEffect"]);
                }
            })["SyncProvider.useEffect"];
        }
    }["SyncProvider.useEffect"], [
        isAuthenticated,
        updateMetadata
    ]);
    // Listen for online/offline events
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "SyncProvider.useEffect": ()=>{
            const handleOnline = {
                "SyncProvider.useEffect.handleOnline": ()=>setIsOnline(true)
            }["SyncProvider.useEffect.handleOnline"];
            const handleOffline = {
                "SyncProvider.useEffect.handleOffline": ()=>setIsOnline(false)
            }["SyncProvider.useEffect.handleOffline"];
            window.addEventListener('online', handleOnline);
            window.addEventListener('offline', handleOffline);
            return ({
                "SyncProvider.useEffect": ()=>{
                    window.removeEventListener('online', handleOnline);
                    window.removeEventListener('offline', handleOffline);
                }
            })["SyncProvider.useEffect"];
        }
    }["SyncProvider.useEffect"], []);
    const triggerSync = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "SyncProvider.useCallback[triggerSync]": async ()=>{
            if (!isAuthenticated) return;
            const syncEngine = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$sync$2f$sync$2d$engine$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSyncEngine"])();
            await syncEngine.syncAll();
            updateMetadata();
        }
    }["SyncProvider.useCallback[triggerSync]"], [
        isAuthenticated,
        updateMetadata
    ]);
    // Show loading state while data is being preloaded
    if (isAuthenticated && !isDataLoaded) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "flex items-center justify-center min-h-screen",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "text-center",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"
                    }, void 0, false, {
                        fileName: "[project]/src/providers/sync-provider.tsx",
                        lineNumber: 141,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-sm text-muted-foreground",
                        children: "Loading your data..."
                    }, void 0, false, {
                        fileName: "[project]/src/providers/sync-provider.tsx",
                        lineNumber: 142,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/providers/sync-provider.tsx",
                lineNumber: 140,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/src/providers/sync-provider.tsx",
            lineNumber: 139,
            columnNumber: 7
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SyncContext.Provider, {
        value: {
            syncStatus,
            isSyncing,
            isOnline,
            pendingChanges,
            lastSyncAt,
            triggerSync
        },
        children: children
    }, void 0, false, {
        fileName: "[project]/src/providers/sync-provider.tsx",
        lineNumber: 149,
        columnNumber: 5
    }, this);
}
_s(SyncProvider, "yH98On7qBehViB1k9tFWXlj4s+o=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$providers$2f$auth$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAuth"]
    ];
});
_c = SyncProvider;
function useSync() {
    _s1();
    const context = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useContext"])(SyncContext);
    if (context === undefined) {
        throw new Error('useSync must be used within a SyncProvider');
    }
    return context;
}
_s1(useSync, "b9L3QQ+jgeyIrH0NfHrJ8nn7VMU=");
var _c;
__turbopack_context__.k.register(_c, "SyncProvider");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/utils.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "cn",
    ()=>cn
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$clsx$2f$dist$2f$clsx$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/clsx/dist/clsx.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$tailwind$2d$merge$2f$dist$2f$bundle$2d$mjs$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/tailwind-merge/dist/bundle-mjs.mjs [app-client] (ecmascript)");
;
;
function cn(...inputs) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$tailwind$2d$merge$2f$dist$2f$bundle$2d$mjs$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["twMerge"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$clsx$2f$dist$2f$clsx$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["clsx"])(inputs));
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/sync/SyncStatusBadge.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "SyncStatusBadge",
    ()=>SyncStatusBadge
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$cloud$2d$off$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__CloudOff$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/cloud-off.js [app-client] (ecmascript) <export default as CloudOff>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$refresh$2d$cw$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__RefreshCw$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/refresh-cw.js [app-client] (ecmascript) <export default as RefreshCw>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$alert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__AlertCircle$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/circle-alert.js [app-client] (ecmascript) <export default as AlertCircle>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$check$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Check$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/check.js [app-client] (ecmascript) <export default as Check>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$stores$2f$sync$2d$status$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/stores/sync-status-store.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$formatDistanceToNow$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/date-fns/formatDistanceToNow.js [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
function SyncStatusBadge() {
    _s();
    const { isSyncing, lastSyncTime, syncError, pendingChanges } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$stores$2f$sync$2d$status$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useSyncStatusStore"])();
    const getStatusIcon = ()=>{
        if (syncError) {
            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$alert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__AlertCircle$3e$__["AlertCircle"], {
                className: "w-4 h-4 text-red-500"
            }, void 0, false, {
                fileName: "[project]/src/components/sync/SyncStatusBadge.tsx",
                lineNumber: 13,
                columnNumber: 20
            }, this);
        }
        if (isSyncing) {
            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$refresh$2d$cw$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__RefreshCw$3e$__["RefreshCw"], {
                className: "w-4 h-4 text-blue-500 animate-spin"
            }, void 0, false, {
                fileName: "[project]/src/components/sync/SyncStatusBadge.tsx",
                lineNumber: 16,
                columnNumber: 20
            }, this);
        }
        if (pendingChanges > 0) {
            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$cloud$2d$off$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__CloudOff$3e$__["CloudOff"], {
                className: "w-4 h-4 text-yellow-500"
            }, void 0, false, {
                fileName: "[project]/src/components/sync/SyncStatusBadge.tsx",
                lineNumber: 19,
                columnNumber: 20
            }, this);
        }
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$check$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Check$3e$__["Check"], {
            className: "w-4 h-4 text-green-500"
        }, void 0, false, {
            fileName: "[project]/src/components/sync/SyncStatusBadge.tsx",
            lineNumber: 21,
            columnNumber: 16
        }, this);
    };
    const getStatusText = ()=>{
        if (syncError) return 'Sync error';
        if (isSyncing) return 'Syncing...';
        if (pendingChanges > 0) return `${pendingChanges} pending`;
        if (lastSyncTime) {
            const distance = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$formatDistanceToNow$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatDistanceToNow"])(lastSyncTime);
            if (distance.includes('less than a minute')) {
                return 'Just now';
            }
            return distance;
        }
        return 'Not synced';
    };
    const getTooltipText = ()=>{
        if (syncError) return `Sync error: ${syncError}`;
        if (isSyncing) return 'Syncing your data with the cloud...';
        if (pendingChanges > 0) return `${pendingChanges} local changes pending cloud sync`;
        if (lastSyncTime) {
            return `Successfully synced. Last sync: ${lastSyncTime.toLocaleDateString()} at ${lastSyncTime.toLocaleTimeString()}`;
        }
        return 'Data is not synced to cloud yet';
    };
    const getStatusColor = ()=>{
        if (syncError) return 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400';
        if (isSyncing) return 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400';
        if (pendingChanges > 0) return 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400';
        return 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400';
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: `
        flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium
        ${getStatusColor()}
        transition-colors
      `,
        title: getTooltipText(),
        children: [
            getStatusIcon(),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "inline-block",
                children: getStatusText()
            }, void 0, false, {
                fileName: "[project]/src/components/sync/SyncStatusBadge.tsx",
                lineNumber: 65,
                columnNumber: 13
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/sync/SyncStatusBadge.tsx",
        lineNumber: 56,
        columnNumber: 9
    }, this);
}
_s(SyncStatusBadge, "1bQ1M8Zb1rhc3UOI+pCwKNFJ4XE=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$stores$2f$sync$2d$status$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useSyncStatusStore"]
    ];
});
_c = SyncStatusBadge;
var _c;
__turbopack_context__.k.register(_c, "SyncStatusBadge");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/ui/button.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Button",
    ()=>Button,
    "buttonVariants",
    ()=>buttonVariants
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$slot$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@radix-ui/react-slot/dist/index.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$class$2d$variance$2d$authority$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/class-variance-authority/dist/index.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/utils.ts [app-client] (ecmascript)");
;
;
;
;
const buttonVariants = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$class$2d$variance$2d$authority$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cva"])("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive", {
    variants: {
        variant: {
            default: "bg-primary text-primary-foreground hover:bg-primary/90",
            destructive: "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
            outline: "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
            secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
            ghost: "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
            link: "text-primary underline-offset-4 hover:underline"
        },
        size: {
            default: "h-9 px-4 py-2 has-[>svg]:px-3",
            sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
            lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
            icon: "size-9",
            "icon-sm": "size-8",
            "icon-lg": "size-10"
        }
    },
    defaultVariants: {
        variant: "default",
        size: "default"
    }
});
function Button({ className, variant = "default", size = "default", asChild = false, ...props }) {
    const Comp = asChild ? __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$slot$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Slot"] : "button";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Comp, {
        "data-slot": "button",
        "data-variant": variant,
        "data-size": size,
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])(buttonVariants({
            variant,
            size,
            className
        })),
        ...props
    }, void 0, false, {
        fileName: "[project]/src/components/ui/button.tsx",
        lineNumber: 52,
        columnNumber: 5
    }, this);
}
_c = Button;
;
var _c;
__turbopack_context__.k.register(_c, "Button");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/ui/tooltip.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Tooltip",
    ()=>Tooltip,
    "TooltipContent",
    ()=>TooltipContent,
    "TooltipProvider",
    ()=>TooltipProvider,
    "TooltipTrigger",
    ()=>TooltipTrigger
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$tooltip$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@radix-ui/react-tooltip/dist/index.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/utils.ts [app-client] (ecmascript)");
"use client";
;
;
;
function TooltipProvider({ delayDuration = 0, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$tooltip$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Provider"], {
        "data-slot": "tooltip-provider",
        delayDuration: delayDuration,
        ...props
    }, void 0, false, {
        fileName: "[project]/src/components/ui/tooltip.tsx",
        lineNumber: 13,
        columnNumber: 5
    }, this);
}
_c = TooltipProvider;
function Tooltip({ ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(TooltipProvider, {
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$tooltip$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Root"], {
            "data-slot": "tooltip",
            ...props
        }, void 0, false, {
            fileName: "[project]/src/components/ui/tooltip.tsx",
            lineNumber: 26,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/components/ui/tooltip.tsx",
        lineNumber: 25,
        columnNumber: 5
    }, this);
}
_c1 = Tooltip;
function TooltipTrigger({ ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$tooltip$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Trigger"], {
        "data-slot": "tooltip-trigger",
        ...props
    }, void 0, false, {
        fileName: "[project]/src/components/ui/tooltip.tsx",
        lineNumber: 34,
        columnNumber: 10
    }, this);
}
_c2 = TooltipTrigger;
function TooltipContent({ className, sideOffset = 0, children, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$tooltip$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Portal"], {
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$tooltip$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Content"], {
            "data-slot": "tooltip-content",
            sideOffset: sideOffset,
            className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("bg-foreground text-background animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-fit origin-(--radix-tooltip-content-transform-origin) rounded-md px-3 py-1.5 text-xs text-balance", className),
            ...props,
            children: [
                children,
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$tooltip$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Arrow"], {
                    className: "bg-foreground fill-foreground z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px]"
                }, void 0, false, {
                    fileName: "[project]/src/components/ui/tooltip.tsx",
                    lineNumber: 55,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/src/components/ui/tooltip.tsx",
            lineNumber: 45,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/components/ui/tooltip.tsx",
        lineNumber: 44,
        columnNumber: 5
    }, this);
}
_c3 = TooltipContent;
;
var _c, _c1, _c2, _c3;
__turbopack_context__.k.register(_c, "TooltipProvider");
__turbopack_context__.k.register(_c1, "Tooltip");
__turbopack_context__.k.register(_c2, "TooltipTrigger");
__turbopack_context__.k.register(_c3, "TooltipContent");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/gamification/UserStatusHUD.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "UserStatusHUD",
    ()=>UserStatusHUD
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/framer-motion/dist/es/render/components/motion/proxy.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$stores$2f$gamification$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/stores/gamification-store.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trophy$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Trophy$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/trophy.js [app-client] (ecmascript) <export default as Trophy>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$diamond$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Diamond$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/diamond.js [app-client] (ecmascript) <export default as Diamond>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$shield$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Shield$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/shield.js [app-client] (ecmascript) <export default as Shield>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$tooltip$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/tooltip.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
;
;
;
;
;
function UserStatusHUD() {
    _s();
    const { xp, level, gems, streakShield, loadGamification, getBufferProgress, openRules } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$stores$2f$gamification$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGamificationStore"])();
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "UserStatusHUD.useEffect": ()=>{
            loadGamification();
        }
    }["UserStatusHUD.useEffect"], [
        loadGamification
    ]);
    const progress = getBufferProgress();
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex items-center gap-3",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$tooltip$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TooltipProvider"], {
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$tooltip$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Tooltip"], {
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$tooltip$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TooltipTrigger"], {
                            asChild: true,
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["motion"].div, {
                                className: "flex items-center gap-1.5 px-2 py-1 bg-indigo-500/10 dark:bg-indigo-400/10 rounded-full border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-semibold text-xs min-w-[32px] justify-center cursor-pointer hover:bg-indigo-500/20 transition-colors",
                                whileHover: {
                                    scale: 1.05
                                },
                                onClick: ()=>openRules('levels'),
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trophy$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Trophy$3e$__["Trophy"], {
                                        className: "w-3 h-3"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/gamification/UserStatusHUD.tsx",
                                        lineNumber: 34,
                                        columnNumber: 29
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        children: [
                                            "Lv.",
                                            level
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/gamification/UserStatusHUD.tsx",
                                        lineNumber: 35,
                                        columnNumber: 29
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/gamification/UserStatusHUD.tsx",
                                lineNumber: 29,
                                columnNumber: 25
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/src/components/gamification/UserStatusHUD.tsx",
                            lineNumber: 28,
                            columnNumber: 21
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$tooltip$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TooltipContent"], {
                            side: "bottom",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-xs",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "font-semibold",
                                        children: [
                                            "Current Level: ",
                                            level
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/gamification/UserStatusHUD.tsx",
                                        lineNumber: 40,
                                        columnNumber: 29
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        children: [
                                            "XP: ",
                                            xp,
                                            " / ",
                                            level * 100
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/gamification/UserStatusHUD.tsx",
                                        lineNumber: 41,
                                        columnNumber: 29
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-[10px] text-muted-foreground mt-1",
                                        children: "Click for details"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/gamification/UserStatusHUD.tsx",
                                        lineNumber: 42,
                                        columnNumber: 29
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/gamification/UserStatusHUD.tsx",
                                lineNumber: 39,
                                columnNumber: 25
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/src/components/gamification/UserStatusHUD.tsx",
                            lineNumber: 38,
                            columnNumber: 21
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/gamification/UserStatusHUD.tsx",
                    lineNumber: 27,
                    columnNumber: 17
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/gamification/UserStatusHUD.tsx",
                lineNumber: 26,
                columnNumber: 13
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "block w-20 md:w-32 h-2.5 bg-secondary rounded-full overflow-hidden relative border border-border/50 cursor-pointer hover:opacity-80 transition-opacity",
                onClick: ()=>openRules('xp'),
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["motion"].div, {
                    className: "h-full bg-gradient-to-r from-indigo-500 to-purple-500",
                    initial: {
                        width: 0
                    },
                    animate: {
                        width: `${progress}%`
                    },
                    transition: {
                        type: 'spring',
                        damping: 20
                    }
                }, void 0, false, {
                    fileName: "[project]/src/components/gamification/UserStatusHUD.tsx",
                    lineNumber: 53,
                    columnNumber: 17
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/gamification/UserStatusHUD.tsx",
                lineNumber: 49,
                columnNumber: 13
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$tooltip$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TooltipProvider"], {
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$tooltip$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Tooltip"], {
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$tooltip$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TooltipTrigger"], {
                            asChild: true,
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400 cursor-pointer bg-amber-500/10 px-2 py-1 rounded-full border border-amber-500/20 hover:bg-amber-500/20 transition-colors",
                                onClick: ()=>openRules('gems'),
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$diamond$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Diamond$3e$__["Diamond"], {
                                        className: "w-3.5 h-3.5 fill-current"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/gamification/UserStatusHUD.tsx",
                                        lineNumber: 69,
                                        columnNumber: 29
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        children: gems
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/gamification/UserStatusHUD.tsx",
                                        lineNumber: 70,
                                        columnNumber: 29
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/gamification/UserStatusHUD.tsx",
                                lineNumber: 65,
                                columnNumber: 25
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/src/components/gamification/UserStatusHUD.tsx",
                            lineNumber: 64,
                            columnNumber: 21
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$tooltip$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TooltipContent"], {
                            side: "bottom",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-xs",
                                    children: "Habit Gems: Earn by completing tasks!"
                                }, void 0, false, {
                                    fileName: "[project]/src/components/gamification/UserStatusHUD.tsx",
                                    lineNumber: 74,
                                    columnNumber: 25
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-[10px] text-muted-foreground mt-1",
                                    children: "Click to see shop"
                                }, void 0, false, {
                                    fileName: "[project]/src/components/gamification/UserStatusHUD.tsx",
                                    lineNumber: 75,
                                    columnNumber: 25
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/gamification/UserStatusHUD.tsx",
                            lineNumber: 73,
                            columnNumber: 21
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/gamification/UserStatusHUD.tsx",
                    lineNumber: 63,
                    columnNumber: 17
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/gamification/UserStatusHUD.tsx",
                lineNumber: 62,
                columnNumber: 13
            }, this),
            streakShield > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$tooltip$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TooltipProvider"], {
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$tooltip$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Tooltip"], {
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$tooltip$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TooltipTrigger"], {
                            asChild: true,
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex items-center gap-1 text-xs font-medium text-blue-500 dark:text-blue-400 bg-blue-500/10 px-2 py-1 rounded-full border border-blue-500/20 cursor-pointer hover:bg-blue-500/20 transition-colors",
                                onClick: ()=>openRules('gems'),
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$shield$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Shield$3e$__["Shield"], {
                                        className: "w-3.5 h-3.5 fill-current"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/gamification/UserStatusHUD.tsx",
                                        lineNumber: 89,
                                        columnNumber: 33
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        children: streakShield
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/gamification/UserStatusHUD.tsx",
                                        lineNumber: 90,
                                        columnNumber: 33
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/gamification/UserStatusHUD.tsx",
                                lineNumber: 85,
                                columnNumber: 29
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/src/components/gamification/UserStatusHUD.tsx",
                            lineNumber: 84,
                            columnNumber: 25
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$tooltip$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TooltipContent"], {
                            side: "bottom",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-xs",
                                children: "Streak Shield Active: Protects your streak!"
                            }, void 0, false, {
                                fileName: "[project]/src/components/gamification/UserStatusHUD.tsx",
                                lineNumber: 94,
                                columnNumber: 29
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/src/components/gamification/UserStatusHUD.tsx",
                            lineNumber: 93,
                            columnNumber: 25
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/gamification/UserStatusHUD.tsx",
                    lineNumber: 83,
                    columnNumber: 21
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/gamification/UserStatusHUD.tsx",
                lineNumber: 82,
                columnNumber: 17
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/gamification/UserStatusHUD.tsx",
        lineNumber: 24,
        columnNumber: 9
    }, this);
}
_s(UserStatusHUD, "vi8cXy/CChvF8884y6oyitxYoWc=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$stores$2f$gamification$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGamificationStore"]
    ];
});
_c = UserStatusHUD;
var _c;
__turbopack_context__.k.register(_c, "UserStatusHUD");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/layout/header.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Header",
    ()=>Header
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/framer-motion/dist/es/render/components/motion/proxy.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$layout$2d$dashboard$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__LayoutDashboard$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/layout-dashboard.js [app-client] (ecmascript) <export default as LayoutDashboard>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$square$2d$check$2d$big$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__CheckSquare$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/square-check-big.js [app-client] (ecmascript) <export default as CheckSquare>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$list$2d$todo$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ListTodo$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/list-todo.js [app-client] (ecmascript) <export default as ListTodo>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$target$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Target$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/target.js [app-client] (ecmascript) <export default as Target>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chart$2d$column$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__BarChart3$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/chart-column.js [app-client] (ecmascript) <export default as BarChart3>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$sun$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Sun$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/sun.js [app-client] (ecmascript) <export default as Sun>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$moon$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Moon$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/moon.js [app-client] (ecmascript) <export default as Moon>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$menu$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Menu$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/menu.js [app-client] (ecmascript) <export default as Menu>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/x.js [app-client] (ecmascript) <export default as X>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$settings$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Settings$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/settings.js [app-client] (ecmascript) <export default as Settings>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$user$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__User$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/user.js [app-client] (ecmascript) <export default as User>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$log$2d$out$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__LogOut$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/log-out.js [app-client] (ecmascript) <export default as LogOut>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$workflow$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Workflow$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/workflow.js [app-client] (ecmascript) <export default as Workflow>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trophy$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Trophy$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/trophy.js [app-client] (ecmascript) <export default as Trophy>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/utils.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$providers$2f$theme$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/providers/theme-provider.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$providers$2f$auth$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/providers/auth-provider.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$providers$2f$sync$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/providers/sync-provider.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$sync$2f$SyncStatusBadge$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/sync/SyncStatusBadge.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/button.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$gamification$2f$UserStatusHUD$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/gamification/UserStatusHUD.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
;
;
;
;
;
;
;
;
;
const navItems = [
    {
        href: '/',
        label: 'Dashboard',
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$layout$2d$dashboard$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__LayoutDashboard$3e$__["LayoutDashboard"]
    },
    {
        href: '/tasks',
        label: 'Tasks',
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$list$2d$todo$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ListTodo$3e$__["ListTodo"]
    },
    {
        href: '/routines',
        label: 'Routines',
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$workflow$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Workflow$3e$__["Workflow"]
    },
    {
        href: '/habits',
        label: 'Habits',
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$square$2d$check$2d$big$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__CheckSquare$3e$__["CheckSquare"]
    },
    {
        href: '/goals',
        label: 'Goals',
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$target$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Target$3e$__["Target"]
    },
    {
        href: '/analytics',
        label: 'Analytics',
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chart$2d$column$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__BarChart3$3e$__["BarChart3"]
    },
    {
        href: '/leaderboard',
        label: 'Leaderboard',
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trophy$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Trophy$3e$__["Trophy"]
    },
    {
        href: '/settings',
        label: 'Settings',
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$settings$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Settings$3e$__["Settings"]
    }
];
function Header() {
    _s();
    const pathname = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["usePathname"])();
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"])();
    const { theme, setTheme, resolvedTheme } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$providers$2f$theme$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTheme"])();
    const { isAuthenticated, user, signOut } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$providers$2f$auth$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAuth"])();
    const { syncStatus, isSyncing } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$providers$2f$sync$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useSync"])();
    const [mobileMenuOpen, setMobileMenuOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const handleSignOut = async ()=>{
        try {
            // Call server-side route to clear cookies reliably
            await fetch('/auth/signout', {
                method: 'POST',
                redirect: 'manual'
            });
            // Force a hard navigation to ensure clean state
            window.location.href = '/login';
        } catch (error) {
            console.error('Logout failed:', error);
            // Fallback
            router.push('/login');
        }
    };
    const toggleTheme = ()=>{
        setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("header", {
        className: "sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "w-full flex h-16 items-center px-4 md:px-6",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex-grow-0 flex-shrink-0 flex justify-start mr-4 lg:mr-8",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                            href: "/",
                            className: "flex items-center gap-2.5 flex-shrink-0",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["motion"].div, {
                                    className: "relative flex h-11 w-11 min-w-[2.75rem] min-h-[2.75rem] aspect-square items-center justify-center rounded-xl bg-gradient-to-br from-primary/10 to-purple-600/10 border border-purple-500/30 dark:border-purple-400/40 shadow-sm shadow-purple-500/10 shrink-0 overflow-hidden",
                                    whileHover: {
                                        scale: 1.05,
                                        rotate: [
                                            0,
                                            -5,
                                            5,
                                            0
                                        ]
                                    },
                                    whileTap: {
                                        scale: 0.95
                                    },
                                    transition: {
                                        type: 'tween',
                                        duration: 0.5
                                    },
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                                        viewBox: "0 0 32 32",
                                        className: "h-7 w-7",
                                        fill: "none",
                                        xmlns: "http://www.w3.org/2000/svg",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["motion"].path, {
                                                d: "M 16 4 A 12 12 0 1 1 15.99 4",
                                                stroke: "url(#logo-grad)",
                                                strokeWidth: "3.5",
                                                strokeLinecap: "round",
                                                strokeLinejoin: "round",
                                                initial: {
                                                    pathLength: 0,
                                                    opacity: 0
                                                },
                                                animate: {
                                                    pathLength: 1,
                                                    opacity: 1
                                                },
                                                transition: {
                                                    duration: 1.2,
                                                    ease: "easeOut"
                                                }
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/layout/header.tsx",
                                                lineNumber: 89,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["motion"].path, {
                                                d: "M 12 16.5 L 15 19.5 L 21 12.5",
                                                stroke: "url(#logo-grad-2)",
                                                strokeWidth: "3.5",
                                                strokeLinecap: "round",
                                                strokeLinejoin: "round",
                                                initial: {
                                                    pathLength: 0,
                                                    opacity: 0
                                                },
                                                animate: {
                                                    pathLength: 1,
                                                    opacity: 1
                                                },
                                                transition: {
                                                    duration: 0.8,
                                                    delay: 0.6,
                                                    ease: "easeOut"
                                                }
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/layout/header.tsx",
                                                lineNumber: 100,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("defs", {
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("linearGradient", {
                                                        id: "logo-grad",
                                                        x1: "0%",
                                                        y1: "0%",
                                                        x2: "100%",
                                                        y2: "100%",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("stop", {
                                                                offset: "0%",
                                                                stopColor: "var(--primary)"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/layout/header.tsx",
                                                                lineNumber: 112,
                                                                columnNumber: 21
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("stop", {
                                                                offset: "100%",
                                                                stopColor: "#9333ea"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/layout/header.tsx",
                                                                lineNumber: 113,
                                                                columnNumber: 21
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/components/layout/header.tsx",
                                                        lineNumber: 111,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("linearGradient", {
                                                        id: "logo-grad-2",
                                                        x1: "0%",
                                                        y1: "0%",
                                                        x2: "100%",
                                                        y2: "100%",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("stop", {
                                                                offset: "0%",
                                                                stopColor: "#9333ea"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/layout/header.tsx",
                                                                lineNumber: 116,
                                                                columnNumber: 21
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("stop", {
                                                                offset: "100%",
                                                                stopColor: "#ec4899"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/layout/header.tsx",
                                                                lineNumber: 117,
                                                                columnNumber: 21
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/components/layout/header.tsx",
                                                        lineNumber: 115,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("linearGradient", {
                                                        id: "nav-icon-grad-active",
                                                        x1: "0",
                                                        y1: "0",
                                                        x2: "20",
                                                        y2: "20",
                                                        gradientUnits: "userSpaceOnUse",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("stop", {
                                                                offset: "0%",
                                                                stopColor: "var(--primary)"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/layout/header.tsx",
                                                                lineNumber: 127,
                                                                columnNumber: 21
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("stop", {
                                                                offset: "100%",
                                                                stopColor: "#d946ef"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/layout/header.tsx",
                                                                lineNumber: 128,
                                                                columnNumber: 21
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/components/layout/header.tsx",
                                                        lineNumber: 119,
                                                        columnNumber: 19
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/components/layout/header.tsx",
                                                lineNumber: 110,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/layout/header.tsx",
                                        lineNumber: 82,
                                        columnNumber: 15
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/src/components/layout/header.tsx",
                                    lineNumber: 76,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "hidden font-semibold text-lg sm:inline-block bg-gradient-to-r from-primary via-purple-600 to-pink-500 bg-clip-text text-transparent whitespace-nowrap tracking-tight",
                                    children: "Habit Flow"
                                }, void 0, false, {
                                    fileName: "[project]/src/components/layout/header.tsx",
                                    lineNumber: 133,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/layout/header.tsx",
                            lineNumber: 75,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/src/components/layout/header.tsx",
                        lineNumber: 74,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("nav", {
                        className: "nav-container hidden md:flex items-center justify-center flex-1 -ml-6 lg:-ml-10",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("style", {
                                dangerouslySetInnerHTML: {
                                    __html: `
            @media (max-width: 1535px) {
              .nav-link {
                width: 2.5rem;
                transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.2s;
              }
              .nav-container:hover .nav-link {
                transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.2s;
              }
              .nav-link:hover ~ .nav-link {
                transform: translateX(85px);
              }
            }
            .nav-link svg {
              transition: stroke 0.3s ease, transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
            }
            .nav-link.nav-link-active svg {
              stroke: url(#nav-icon-grad-active);
            }
            .nav-link:hover svg {
              stroke: url(#nav-icon-grad-active);
              transform: scale(1.15) rotate(4deg) translateY(-0.5px);
            }
          `
                                }
                            }, void 0, false, {
                                fileName: "[project]/src/components/layout/header.tsx",
                                lineNumber: 141,
                                columnNumber: 11
                            }, this),
                            navItems.map((item)=>{
                                const isActive = pathname === item.href;
                                const Icon = item.icon;
                                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                    href: item.href,
                                    className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("nav-link relative flex items-center justify-start h-10 px-3 py-2 rounded-lg group", isActive && "nav-link-active"),
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])('flex items-center text-sm font-medium transition-colors whitespace-nowrap', isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'),
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "relative flex items-center justify-center shrink-0",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("absolute -inset-2.5 rounded-full bg-gradient-to-br from-primary/10 via-purple-500/5 to-pink-500/10 dark:from-primary/20 dark:via-purple-500/10 dark:to-pink-500/20 blur-sm opacity-0 transition-all duration-500 scale-75 group-hover:opacity-100 group-hover:scale-100", isActive && "opacity-100 scale-100")
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/components/layout/header.tsx",
                                                            lineNumber: 188,
                                                            columnNumber: 21
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Icon, {
                                                            className: "h-[20px] w-[20px] shrink-0 relative z-10"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/components/layout/header.tsx",
                                                            lineNumber: 194,
                                                            columnNumber: 21
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/components/layout/header.tsx",
                                                    lineNumber: 186,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "absolute left-10 opacity-0 pointer-events-none transition-all duration-300 ease-out group-hover:opacity-100 group-hover:translate-x-1 2xl:relative 2xl:left-0 2xl:opacity-100 2xl:pointer-events-auto 2xl:ml-2",
                                                    children: item.label
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/layout/header.tsx",
                                                    lineNumber: 196,
                                                    columnNumber: 19
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/components/layout/header.tsx",
                                            lineNumber: 178,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "absolute bottom-0 left-3 right-3 h-[2px] bg-gradient-to-r from-primary to-purple-600 transform scale-x-0 origin-left transition-transform duration-300 ease-out group-hover:scale-x-100 2xl:hidden"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/layout/header.tsx",
                                            lineNumber: 202,
                                            columnNumber: 17
                                        }, this),
                                        isActive && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "absolute inset-0 rounded-lg bg-muted border-none outline-none",
                                            style: {
                                                zIndex: -1
                                            }
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/layout/header.tsx",
                                            lineNumber: 205,
                                            columnNumber: 19
                                        }, this)
                                    ]
                                }, item.href, true, {
                                    fileName: "[project]/src/components/layout/header.tsx",
                                    lineNumber: 170,
                                    columnNumber: 15
                                }, this);
                            })
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/layout/header.tsx",
                        lineNumber: 140,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex-grow-0 flex-shrink-0 flex items-center justify-end gap-1.5 lg:gap-2",
                        children: [
                            isAuthenticated && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "hidden md:flex items-center gap-1.5 lg:gap-2",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$gamification$2f$UserStatusHUD$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["UserStatusHUD"], {}, void 0, false, {
                                        fileName: "[project]/src/components/layout/header.tsx",
                                        lineNumber: 219,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$sync$2f$SyncStatusBadge$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SyncStatusBadge"], {}, void 0, false, {
                                        fileName: "[project]/src/components/layout/header.tsx",
                                        lineNumber: 220,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/layout/header.tsx",
                                lineNumber: 218,
                                columnNumber: 13
                            }, this),
                            isAuthenticated ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                variant: "ghost",
                                size: "icon",
                                onClick: handleSignOut,
                                className: "h-9 w-9",
                                title: "Sign out",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$log$2d$out$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__LogOut$3e$__["LogOut"], {
                                        className: "h-5 w-5"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/layout/header.tsx",
                                        lineNumber: 233,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "sr-only",
                                        children: "Sign out"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/layout/header.tsx",
                                        lineNumber: 234,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/layout/header.tsx",
                                lineNumber: 226,
                                columnNumber: 13
                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                variant: "ghost",
                                size: "icon",
                                onClick: ()=>router.push('/login'),
                                className: "h-9 w-9",
                                title: "Sign in",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$user$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__User$3e$__["User"], {
                                        className: "h-5 w-5"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/layout/header.tsx",
                                        lineNumber: 244,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "sr-only",
                                        children: "Sign in"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/layout/header.tsx",
                                        lineNumber: 245,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/layout/header.tsx",
                                lineNumber: 237,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                variant: "ghost",
                                size: "icon",
                                onClick: toggleTheme,
                                className: "h-9 w-9",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["motion"].div, {
                                        initial: false,
                                        animate: {
                                            rotate: resolvedTheme === 'dark' ? 180 : 0
                                        },
                                        transition: {
                                            duration: 0.3
                                        },
                                        children: resolvedTheme === 'dark' ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$moon$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Moon$3e$__["Moon"], {
                                            className: "h-5 w-5"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/layout/header.tsx",
                                            lineNumber: 262,
                                            columnNumber: 17
                                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$sun$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Sun$3e$__["Sun"], {
                                            className: "h-5 w-5"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/layout/header.tsx",
                                            lineNumber: 264,
                                            columnNumber: 17
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/layout/header.tsx",
                                        lineNumber: 256,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "sr-only",
                                        children: "Toggle theme"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/layout/header.tsx",
                                        lineNumber: 267,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/layout/header.tsx",
                                lineNumber: 250,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                variant: "ghost",
                                size: "icon",
                                className: "h-9 w-9 md:hidden",
                                onClick: ()=>setMobileMenuOpen(!mobileMenuOpen),
                                children: [
                                    mobileMenuOpen ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__["X"], {
                                        className: "h-5 w-5"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/layout/header.tsx",
                                        lineNumber: 278,
                                        columnNumber: 15
                                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$menu$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Menu$3e$__["Menu"], {
                                        className: "h-5 w-5"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/layout/header.tsx",
                                        lineNumber: 280,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "sr-only",
                                        children: "Toggle menu"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/layout/header.tsx",
                                        lineNumber: 282,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/layout/header.tsx",
                                lineNumber: 271,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/layout/header.tsx",
                        lineNumber: 216,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/layout/header.tsx",
                lineNumber: 72,
                columnNumber: 7
            }, this),
            mobileMenuOpen && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["motion"].nav, {
                initial: {
                    opacity: 0,
                    y: -10
                },
                animate: {
                    opacity: 1,
                    y: 0
                },
                exit: {
                    opacity: 0,
                    y: -10
                },
                className: "md:hidden border-t border-border/40 bg-background/95 backdrop-blur-xl",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "container px-4 py-4 space-y-1",
                    children: navItems.map((item)=>{
                        const isActive = pathname === item.href;
                        const Icon = item.icon;
                        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                            href: item.href,
                            onClick: ()=>setMobileMenuOpen(false),
                            className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])('flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors', isActive ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'),
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Icon, {
                                    className: "h-5 w-5"
                                }, void 0, false, {
                                    fileName: "[project]/src/components/layout/header.tsx",
                                    lineNumber: 312,
                                    columnNumber: 19
                                }, this),
                                item.label
                            ]
                        }, item.href, true, {
                            fileName: "[project]/src/components/layout/header.tsx",
                            lineNumber: 301,
                            columnNumber: 17
                        }, this);
                    })
                }, void 0, false, {
                    fileName: "[project]/src/components/layout/header.tsx",
                    lineNumber: 295,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/layout/header.tsx",
                lineNumber: 289,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/layout/header.tsx",
        lineNumber: 71,
        columnNumber: 5
    }, this);
}
_s(Header, "8kouGEJ+a2Q4WdoqA7IotuZ0Vz4=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["usePathname"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"],
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$providers$2f$theme$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTheme"],
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$providers$2f$auth$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAuth"],
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$providers$2f$sync$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useSync"]
    ];
});
_c = Header;
var _c;
__turbopack_context__.k.register(_c, "Header");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/pwa/service-worker-registration.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ServiceWorkerRegistration",
    ()=>ServiceWorkerRegistration
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$providers$2f$auth$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/providers/auth-provider.tsx [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
'use client';
;
;
function ServiceWorkerRegistration() {
    _s();
    const { isAuthenticated, isLoading } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$providers$2f$auth$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAuth"])();
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "ServiceWorkerRegistration.useEffect": ()=>{
            // Only register service worker after auth is loaded and user is authenticated
            // This prevents issues with service worker caching login pages
            if (("TURBOPACK compile-time value", "object") === 'undefined' || !('serviceWorker' in navigator)) {
                return;
            }
            // Wait for auth to finish loading
            if (isLoading) {
                return;
            }
            // Only register if authenticated to avoid caching auth redirects
            if (!isAuthenticated) {
                // Unregister any existing service workers if user is not authenticated
                navigator.serviceWorker.getRegistrations().then({
                    "ServiceWorkerRegistration.useEffect": (registrations)=>{
                        for (const registration of registrations){
                            registration.unregister();
                        }
                    }
                }["ServiceWorkerRegistration.useEffect"]);
                return;
            }
            // Register service worker after page load
            const registerSW = {
                "ServiceWorkerRegistration.useEffect.registerSW": ()=>{
                    navigator.serviceWorker.register('/sw.js', {
                        scope: '/'
                    }).then({
                        "ServiceWorkerRegistration.useEffect.registerSW": (registration)=>{
                            console.log('Service Worker registered with scope:', registration.scope);
                            // Check for updates periodically
                            setInterval({
                                "ServiceWorkerRegistration.useEffect.registerSW": ()=>{
                                    registration.update();
                                }
                            }["ServiceWorkerRegistration.useEffect.registerSW"], 60 * 60 * 1000); // Check every hour
                        }
                    }["ServiceWorkerRegistration.useEffect.registerSW"]).catch({
                        "ServiceWorkerRegistration.useEffect.registerSW": (error)=>{
                            console.error('Service Worker registration failed:', error);
                        }
                    }["ServiceWorkerRegistration.useEffect.registerSW"]);
                }
            }["ServiceWorkerRegistration.useEffect.registerSW"];
            if (document.readyState === 'complete') {
                registerSW();
            } else {
                window.addEventListener('load', registerSW);
                return ({
                    "ServiceWorkerRegistration.useEffect": ()=>window.removeEventListener('load', registerSW)
                })["ServiceWorkerRegistration.useEffect"];
            }
        }
    }["ServiceWorkerRegistration.useEffect"], [
        isAuthenticated,
        isLoading
    ]);
    return null;
}
_s(ServiceWorkerRegistration, "Jdv03TWtwLqaElyylV5IrKIoQUo=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$providers$2f$auth$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAuth"]
    ];
});
_c = ServiceWorkerRegistration;
var _c;
__turbopack_context__.k.register(_c, "ServiceWorkerRegistration");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/ui/sonner.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Toaster",
    ()=>Toaster
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$check$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__CircleCheckIcon$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/circle-check.js [app-client] (ecmascript) <export default as CircleCheckIcon>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$info$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__InfoIcon$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/info.js [app-client] (ecmascript) <export default as InfoIcon>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Loader2Icon$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/loader-circle.js [app-client] (ecmascript) <export default as Loader2Icon>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$octagon$2d$x$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__OctagonXIcon$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/octagon-x.js [app-client] (ecmascript) <export default as OctagonXIcon>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$triangle$2d$alert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__TriangleAlertIcon$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/triangle-alert.js [app-client] (ecmascript) <export default as TriangleAlertIcon>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2d$themes$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next-themes/dist/index.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/sonner/dist/index.mjs [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
const Toaster = ({ ...props })=>{
    _s();
    const { theme = "system" } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2d$themes$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTheme"])();
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Toaster"], {
        theme: theme,
        className: "toaster group",
        icons: {
            success: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$check$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__CircleCheckIcon$3e$__["CircleCheckIcon"], {
                className: "size-4"
            }, void 0, false, {
                fileName: "[project]/src/components/ui/sonner.tsx",
                lineNumber: 21,
                columnNumber: 18
            }, void 0),
            info: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$info$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__InfoIcon$3e$__["InfoIcon"], {
                className: "size-4"
            }, void 0, false, {
                fileName: "[project]/src/components/ui/sonner.tsx",
                lineNumber: 22,
                columnNumber: 15
            }, void 0),
            warning: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$triangle$2d$alert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__TriangleAlertIcon$3e$__["TriangleAlertIcon"], {
                className: "size-4"
            }, void 0, false, {
                fileName: "[project]/src/components/ui/sonner.tsx",
                lineNumber: 23,
                columnNumber: 18
            }, void 0),
            error: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$octagon$2d$x$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__OctagonXIcon$3e$__["OctagonXIcon"], {
                className: "size-4"
            }, void 0, false, {
                fileName: "[project]/src/components/ui/sonner.tsx",
                lineNumber: 24,
                columnNumber: 16
            }, void 0),
            loading: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Loader2Icon$3e$__["Loader2Icon"], {
                className: "size-4 animate-spin"
            }, void 0, false, {
                fileName: "[project]/src/components/ui/sonner.tsx",
                lineNumber: 25,
                columnNumber: 18
            }, void 0)
        },
        style: {
            "--normal-bg": "var(--popover)",
            "--normal-text": "var(--popover-foreground)",
            "--normal-border": "var(--border)",
            "--border-radius": "var(--radius)"
        },
        ...props
    }, void 0, false, {
        fileName: "[project]/src/components/ui/sonner.tsx",
        lineNumber: 17,
        columnNumber: 5
    }, ("TURBOPACK compile-time value", void 0));
};
_s(Toaster, "EriOrahfenYKDCErPq+L6926Dw4=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2d$themes$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTheme"]
    ];
});
_c = Toaster;
;
var _c;
__turbopack_context__.k.register(_c, "Toaster");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/motion/confetti.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Confetti",
    ()=>Confetti
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/framer-motion/dist/es/render/components/motion/proxy.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$components$2f$AnimatePresence$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/framer-motion/dist/es/components/AnimatePresence/index.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
const COLORS = [
    '#818cf8',
    '#4ade80',
    '#fbbf24',
    '#f472b6',
    '#38bdf8',
    '#fb923c'
];
const SHAPES = [
    'circle',
    'square',
    'triangle'
];
function Confetti({ trigger, onComplete, particleCount = 25, duration = 2000 }) {
    _s();
    const [pieces, setPieces] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [isActive, setIsActive] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "Confetti.useEffect": ()=>{
            if (trigger && !isActive) {
                setIsActive(true);
                const newPieces = Array.from({
                    length: particleCount
                }, {
                    "Confetti.useEffect.newPieces": (_, i)=>({
                            id: i,
                            x: Math.random() * 100,
                            y: -10,
                            rotation: Math.random() * 360,
                            color: COLORS[Math.floor(Math.random() * COLORS.length)],
                            scale: 0.5 + Math.random() * 0.5,
                            shape: SHAPES[Math.floor(Math.random() * SHAPES.length)]
                        })
                }["Confetti.useEffect.newPieces"]);
                setPieces(newPieces);
                const timer = setTimeout({
                    "Confetti.useEffect.timer": ()=>{
                        setPieces([]);
                        setIsActive(false);
                        onComplete?.();
                    }
                }["Confetti.useEffect.timer"], duration);
                return ({
                    "Confetti.useEffect": ()=>clearTimeout(timer)
                })["Confetti.useEffect"];
            }
        }
    }["Confetti.useEffect"], [
        trigger,
        isActive,
        particleCount,
        duration,
        onComplete
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$components$2f$AnimatePresence$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AnimatePresence"], {
        children: pieces.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "fixed inset-0 pointer-events-none overflow-hidden z-50",
            children: pieces.map((piece)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["motion"].div, {
                    className: "absolute",
                    initial: {
                        x: `${piece.x}vw`,
                        y: '-10vh',
                        rotate: 0,
                        scale: piece.scale
                    },
                    animate: {
                        y: '110vh',
                        rotate: piece.rotation + 720,
                        x: `${piece.x + (Math.random() - 0.5) * 20}vw`
                    },
                    exit: {
                        opacity: 0
                    },
                    transition: {
                        duration: 2 + Math.random(),
                        ease: 'linear'
                    },
                    children: [
                        piece.shape === 'circle' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "w-3 h-3 rounded-full",
                            style: {
                                backgroundColor: piece.color
                            }
                        }, void 0, false, {
                            fileName: "[project]/src/components/motion/confetti.tsx",
                            lineNumber: 95,
                            columnNumber: 17
                        }, this),
                        piece.shape === 'square' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "w-3 h-3",
                            style: {
                                backgroundColor: piece.color
                            }
                        }, void 0, false, {
                            fileName: "[project]/src/components/motion/confetti.tsx",
                            lineNumber: 101,
                            columnNumber: 17
                        }, this),
                        piece.shape === 'triangle' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "w-0 h-0 border-l-[6px] border-r-[6px] border-b-[10px] border-l-transparent border-r-transparent",
                            style: {
                                borderBottomColor: piece.color
                            }
                        }, void 0, false, {
                            fileName: "[project]/src/components/motion/confetti.tsx",
                            lineNumber: 107,
                            columnNumber: 17
                        }, this)
                    ]
                }, piece.id, true, {
                    fileName: "[project]/src/components/motion/confetti.tsx",
                    lineNumber: 74,
                    columnNumber: 13
                }, this))
        }, void 0, false, {
            fileName: "[project]/src/components/motion/confetti.tsx",
            lineNumber: 72,
            columnNumber: 9
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/components/motion/confetti.tsx",
        lineNumber: 70,
        columnNumber: 5
    }, this);
}
_s(Confetti, "Gbz2ZdK31cBruxhPjiPDGUf4Ew0=");
_c = Confetti;
var _c;
__turbopack_context__.k.register(_c, "Confetti");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/ui/dialog.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Dialog",
    ()=>Dialog,
    "DialogClose",
    ()=>DialogClose,
    "DialogContent",
    ()=>DialogContent,
    "DialogDescription",
    ()=>DialogDescription,
    "DialogFooter",
    ()=>DialogFooter,
    "DialogHeader",
    ()=>DialogHeader,
    "DialogOverlay",
    ()=>DialogOverlay,
    "DialogPortal",
    ()=>DialogPortal,
    "DialogTitle",
    ()=>DialogTitle,
    "DialogTrigger",
    ()=>DialogTrigger
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@radix-ui/react-dialog/dist/index.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__XIcon$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/x.js [app-client] (ecmascript) <export default as XIcon>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/utils.ts [app-client] (ecmascript)");
"use client";
;
;
;
;
function Dialog({ ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Root"], {
        "data-slot": "dialog",
        ...props
    }, void 0, false, {
        fileName: "[project]/src/components/ui/dialog.tsx",
        lineNumber: 12,
        columnNumber: 10
    }, this);
}
_c = Dialog;
function DialogTrigger({ ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Trigger"], {
        "data-slot": "dialog-trigger",
        ...props
    }, void 0, false, {
        fileName: "[project]/src/components/ui/dialog.tsx",
        lineNumber: 18,
        columnNumber: 10
    }, this);
}
_c1 = DialogTrigger;
function DialogPortal({ ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Portal"], {
        "data-slot": "dialog-portal",
        ...props
    }, void 0, false, {
        fileName: "[project]/src/components/ui/dialog.tsx",
        lineNumber: 24,
        columnNumber: 10
    }, this);
}
_c2 = DialogPortal;
function DialogClose({ ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Close"], {
        "data-slot": "dialog-close",
        ...props
    }, void 0, false, {
        fileName: "[project]/src/components/ui/dialog.tsx",
        lineNumber: 30,
        columnNumber: 10
    }, this);
}
_c3 = DialogClose;
function DialogOverlay({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Overlay"], {
        "data-slot": "dialog-overlay",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/src/components/ui/dialog.tsx",
        lineNumber: 38,
        columnNumber: 5
    }, this);
}
_c4 = DialogOverlay;
function DialogContent({ className, children, showCloseButton = true, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(DialogPortal, {
        "data-slot": "dialog-portal",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(DialogOverlay, {}, void 0, false, {
                fileName: "[project]/src/components/ui/dialog.tsx",
                lineNumber: 59,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Content"], {
                "data-slot": "dialog-content",
                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 outline-none sm:max-w-lg", className),
                ...props,
                children: [
                    children,
                    showCloseButton && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Close"], {
                        "data-slot": "dialog-close",
                        className: "ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__XIcon$3e$__["XIcon"], {}, void 0, false, {
                                fileName: "[project]/src/components/ui/dialog.tsx",
                                lineNumber: 74,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "sr-only",
                                children: "Close"
                            }, void 0, false, {
                                fileName: "[project]/src/components/ui/dialog.tsx",
                                lineNumber: 75,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/ui/dialog.tsx",
                        lineNumber: 70,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/ui/dialog.tsx",
                lineNumber: 60,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/ui/dialog.tsx",
        lineNumber: 58,
        columnNumber: 5
    }, this);
}
_c5 = DialogContent;
function DialogHeader({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        "data-slot": "dialog-header",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("flex flex-col gap-2 text-center sm:text-left", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/src/components/ui/dialog.tsx",
        lineNumber: 85,
        columnNumber: 5
    }, this);
}
_c6 = DialogHeader;
function DialogFooter({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        "data-slot": "dialog-footer",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/src/components/ui/dialog.tsx",
        lineNumber: 95,
        columnNumber: 5
    }, this);
}
_c7 = DialogFooter;
function DialogTitle({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Title"], {
        "data-slot": "dialog-title",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("text-lg leading-none font-semibold", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/src/components/ui/dialog.tsx",
        lineNumber: 111,
        columnNumber: 5
    }, this);
}
_c8 = DialogTitle;
function DialogDescription({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Description"], {
        "data-slot": "dialog-description",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("text-muted-foreground text-sm", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/src/components/ui/dialog.tsx",
        lineNumber: 124,
        columnNumber: 5
    }, this);
}
_c9 = DialogDescription;
;
var _c, _c1, _c2, _c3, _c4, _c5, _c6, _c7, _c8, _c9;
__turbopack_context__.k.register(_c, "Dialog");
__turbopack_context__.k.register(_c1, "DialogTrigger");
__turbopack_context__.k.register(_c2, "DialogPortal");
__turbopack_context__.k.register(_c3, "DialogClose");
__turbopack_context__.k.register(_c4, "DialogOverlay");
__turbopack_context__.k.register(_c5, "DialogContent");
__turbopack_context__.k.register(_c6, "DialogHeader");
__turbopack_context__.k.register(_c7, "DialogFooter");
__turbopack_context__.k.register(_c8, "DialogTitle");
__turbopack_context__.k.register(_c9, "DialogDescription");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/gamification/LevelUpModal.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "LevelUpModal",
    ()=>LevelUpModal
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/framer-motion/dist/es/render/components/motion/proxy.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$stores$2f$gamification$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/stores/gamification-store.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$motion$2f$confetti$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/motion/confetti.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/button.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trophy$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Trophy$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/trophy.js [app-client] (ecmascript) <export default as Trophy>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$diamond$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Diamond$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/diamond.js [app-client] (ecmascript) <export default as Diamond>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/dialog.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
;
function LevelUpModal() {
    _s();
    const { showLevelUp, level, closeLevelUp } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$stores$2f$gamification$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGamificationStore"])();
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$motion$2f$confetti$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Confetti"], {
                trigger: showLevelUp,
                duration: 5000,
                particleCount: 150
            }, void 0, false, {
                fileName: "[project]/src/components/gamification/LevelUpModal.tsx",
                lineNumber: 20,
                columnNumber: 13
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Dialog"], {
                open: showLevelUp,
                onOpenChange: (open)=>!open && closeLevelUp(),
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogContent"], {
                    className: "sm:max-w-md bg-gradient-to-br from-indigo-900/95 to-purple-900/95 border-indigo-500/50 backdrop-blur-xl text-white shadow-2xl z-[100]",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogHeader"], {
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogTitle"], {
                                className: "text-center text-4xl font-black bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-500 bg-clip-text text-transparent uppercase tracking-wider drop-shadow-md py-2",
                                children: "Level Up!"
                            }, void 0, false, {
                                fileName: "[project]/src/components/gamification/LevelUpModal.tsx",
                                lineNumber: 24,
                                columnNumber: 25
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/src/components/gamification/LevelUpModal.tsx",
                            lineNumber: 23,
                            columnNumber: 21
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex flex-col items-center justify-center p-6 space-y-8",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "relative",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "absolute inset-0 bg-yellow-400/30 blur-[40px] rounded-full animate-pulse"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/gamification/LevelUpModal.tsx",
                                            lineNumber: 32,
                                            columnNumber: 29
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["motion"].div, {
                                            initial: {
                                                scale: 0.5,
                                                rotateY: 180
                                            },
                                            animate: {
                                                scale: 1.2,
                                                rotateY: 0
                                            },
                                            transition: {
                                                type: 'spring',
                                                damping: 10,
                                                duration: 0.8
                                            },
                                            className: "relative z-10",
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trophy$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Trophy$3e$__["Trophy"], {
                                                className: "w-32 h-32 text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.6)]",
                                                strokeWidth: 1.5
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/gamification/LevelUpModal.tsx",
                                                lineNumber: 40,
                                                columnNumber: 33
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/gamification/LevelUpModal.tsx",
                                            lineNumber: 34,
                                            columnNumber: 29
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/gamification/LevelUpModal.tsx",
                                    lineNumber: 30,
                                    columnNumber: 25
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "text-center space-y-1",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-indigo-200 text-lg font-medium tracking-wide",
                                            children: "You are now"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/gamification/LevelUpModal.tsx",
                                            lineNumber: 45,
                                            columnNumber: 29
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["motion"].p, {
                                            initial: {
                                                scale: 0.8,
                                                opacity: 0
                                            },
                                            animate: {
                                                scale: 1,
                                                opacity: 1
                                            },
                                            transition: {
                                                delay: 0.3
                                            },
                                            className: "text-6xl font-black text-white drop-shadow-[0_4px_0_rgba(79,70,229,1)]",
                                            children: [
                                                "LEVEL ",
                                                level
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/components/gamification/LevelUpModal.tsx",
                                            lineNumber: 46,
                                            columnNumber: 29
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/gamification/LevelUpModal.tsx",
                                    lineNumber: 44,
                                    columnNumber: 25
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["motion"].div, {
                                    initial: {
                                        y: 20,
                                        opacity: 0
                                    },
                                    animate: {
                                        y: 0,
                                        opacity: 1
                                    },
                                    transition: {
                                        delay: 0.5
                                    },
                                    className: "flex flex-col items-center gap-3 w-full",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex items-center gap-2 px-6 py-3 bg-white/10 rounded-2xl border border-white/20 backdrop-blur-md w-full justify-center",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$diamond$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Diamond$3e$__["Diamond"], {
                                                    className: "w-6 h-6 text-amber-400 fill-amber-400"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/gamification/LevelUpModal.tsx",
                                                    lineNumber: 63,
                                                    columnNumber: 33
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "font-bold text-xl text-amber-100",
                                                    children: [
                                                        "+",
                                                        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$stores$2f$gamification$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["GEMS_PER_LEVEL"],
                                                        " Gems"
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/components/gamification/LevelUpModal.tsx",
                                                    lineNumber: 64,
                                                    columnNumber: 33
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/components/gamification/LevelUpModal.tsx",
                                            lineNumber: 62,
                                            columnNumber: 29
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex items-center gap-2 px-6 py-3 bg-white/10 rounded-2xl border border-white/20 backdrop-blur-md w-full justify-center",
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "font-bold text-lg text-emerald-300",
                                                children: "Attributes Increased!"
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/gamification/LevelUpModal.tsx",
                                                lineNumber: 67,
                                                columnNumber: 33
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/gamification/LevelUpModal.tsx",
                                            lineNumber: 66,
                                            columnNumber: 29
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/gamification/LevelUpModal.tsx",
                                    lineNumber: 56,
                                    columnNumber: 25
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                    onClick: closeLevelUp,
                                    size: "lg",
                                    className: "w-full bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-300 hover:to-orange-400 text-purple-900 font-extrabold text-lg shadow-lg hover:shadow-yellow-500/20 hover:scale-105 transition-all duration-300",
                                    children: "CLAIM REWARDS"
                                }, void 0, false, {
                                    fileName: "[project]/src/components/gamification/LevelUpModal.tsx",
                                    lineNumber: 71,
                                    columnNumber: 25
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/gamification/LevelUpModal.tsx",
                            lineNumber: 29,
                            columnNumber: 21
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/gamification/LevelUpModal.tsx",
                    lineNumber: 22,
                    columnNumber: 17
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/gamification/LevelUpModal.tsx",
                lineNumber: 21,
                columnNumber: 13
            }, this)
        ]
    }, void 0, true);
}
_s(LevelUpModal, "3QchqRwB2nkV1kwLKpC9lt+unLc=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$stores$2f$gamification$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGamificationStore"]
    ];
});
_c = LevelUpModal;
var _c;
__turbopack_context__.k.register(_c, "LevelUpModal");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/ui/tabs.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Tabs",
    ()=>Tabs,
    "TabsContent",
    ()=>TabsContent,
    "TabsList",
    ()=>TabsList,
    "TabsTrigger",
    ()=>TabsTrigger
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$tabs$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@radix-ui/react-tabs/dist/index.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/utils.ts [app-client] (ecmascript)");
"use client";
;
;
;
function Tabs({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$tabs$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Root"], {
        "data-slot": "tabs",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("flex flex-col gap-2", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/src/components/ui/tabs.tsx",
        lineNumber: 13,
        columnNumber: 5
    }, this);
}
_c = Tabs;
function TabsList({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$tabs$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["List"], {
        "data-slot": "tabs-list",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("bg-muted text-muted-foreground inline-flex h-9 w-fit items-center justify-center rounded-lg p-[3px]", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/src/components/ui/tabs.tsx",
        lineNumber: 26,
        columnNumber: 5
    }, this);
}
_c1 = TabsList;
function TabsTrigger({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$tabs$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Trigger"], {
        "data-slot": "tabs-trigger",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("data-[state=active]:bg-background dark:data-[state=active]:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30 text-foreground dark:text-muted-foreground inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:shadow-sm [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/src/components/ui/tabs.tsx",
        lineNumber: 42,
        columnNumber: 5
    }, this);
}
_c2 = TabsTrigger;
function TabsContent({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$tabs$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Content"], {
        "data-slot": "tabs-content",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("flex-1 outline-none", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/src/components/ui/tabs.tsx",
        lineNumber: 58,
        columnNumber: 5
    }, this);
}
_c3 = TabsContent;
;
var _c, _c1, _c2, _c3;
__turbopack_context__.k.register(_c, "Tabs");
__turbopack_context__.k.register(_c1, "TabsList");
__turbopack_context__.k.register(_c2, "TabsTrigger");
__turbopack_context__.k.register(_c3, "TabsContent");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/ui/scroll-area.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ScrollArea",
    ()=>ScrollArea,
    "ScrollBar",
    ()=>ScrollBar
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$scroll$2d$area$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@radix-ui/react-scroll-area/dist/index.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/utils.ts [app-client] (ecmascript)");
"use client";
;
;
;
function ScrollArea({ className, children, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$scroll$2d$area$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Root"], {
        "data-slot": "scroll-area",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("relative", className),
        ...props,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$scroll$2d$area$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Viewport"], {
                "data-slot": "scroll-area-viewport",
                className: "focus-visible:ring-ring/50 size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:outline-1",
                children: children
            }, void 0, false, {
                fileName: "[project]/src/components/ui/scroll-area.tsx",
                lineNumber: 19,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ScrollBar, {}, void 0, false, {
                fileName: "[project]/src/components/ui/scroll-area.tsx",
                lineNumber: 25,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$scroll$2d$area$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Corner"], {}, void 0, false, {
                fileName: "[project]/src/components/ui/scroll-area.tsx",
                lineNumber: 26,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/ui/scroll-area.tsx",
        lineNumber: 14,
        columnNumber: 5
    }, this);
}
_c = ScrollArea;
function ScrollBar({ className, orientation = "vertical", ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$scroll$2d$area$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ScrollAreaScrollbar"], {
        "data-slot": "scroll-area-scrollbar",
        orientation: orientation,
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("flex touch-none p-px transition-colors select-none", orientation === "vertical" && "h-full w-2.5 border-l border-l-transparent", orientation === "horizontal" && "h-2.5 flex-col border-t border-t-transparent", className),
        ...props,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$scroll$2d$area$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ScrollAreaThumb"], {
            "data-slot": "scroll-area-thumb",
            className: "bg-border relative flex-1 rounded-full"
        }, void 0, false, {
            fileName: "[project]/src/components/ui/scroll-area.tsx",
            lineNumber: 50,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/components/ui/scroll-area.tsx",
        lineNumber: 37,
        columnNumber: 5
    }, this);
}
_c1 = ScrollBar;
;
var _c, _c1;
__turbopack_context__.k.register(_c, "ScrollArea");
__turbopack_context__.k.register(_c1, "ScrollBar");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/gamification/DisciplineRadar.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DisciplineRadar",
    ()=>DisciplineRadar
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$recharts$2f$es6$2f$component$2f$ResponsiveContainer$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/recharts/es6/component/ResponsiveContainer.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$recharts$2f$es6$2f$chart$2f$RadarChart$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/recharts/es6/chart/RadarChart.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$recharts$2f$es6$2f$polar$2f$PolarGrid$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/recharts/es6/polar/PolarGrid.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$recharts$2f$es6$2f$polar$2f$PolarAngleAxis$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/recharts/es6/polar/PolarAngleAxis.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$recharts$2f$es6$2f$polar$2f$PolarRadiusAxis$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/recharts/es6/polar/PolarRadiusAxis.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$recharts$2f$es6$2f$polar$2f$Radar$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/recharts/es6/polar/Radar.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$stores$2f$gamification$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/stores/gamification-store.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/framer-motion/dist/es/render/components/motion/proxy.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/utils.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
;
function DisciplineRadar({ stats: customStats }) {
    _s();
    const storeStats = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$stores$2f$gamification$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGamificationStore"])({
        "DisciplineRadar.useGamificationStore[storeStats]": (state)=>state.stats
    }["DisciplineRadar.useGamificationStore[storeStats]"]);
    const stats = customStats || storeStats;
    const data = [
        {
            subject: 'Vitality',
            A: stats?.vitality || 1,
            fullMark: 100
        },
        {
            subject: 'Intellect',
            A: stats?.intelligence || 1,
            fullMark: 100
        },
        {
            subject: 'Discipline',
            A: stats?.discipline || 1,
            fullMark: 100
        },
        {
            subject: 'Charisma',
            A: stats?.charisma || 1,
            fullMark: 100
        },
        {
            subject: 'Wealth',
            A: stats?.wealth || 1,
            fullMark: 100
        },
        {
            subject: 'Creativity',
            A: stats?.creativity || 1,
            fullMark: 100
        }
    ];
    const maxVal = Math.max(5, stats?.vitality || 1, stats?.intelligence || 1, stats?.discipline || 1, stats?.charisma || 1, stats?.wealth || 1, stats?.creativity || 1);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["motion"].div, {
        initial: {
            opacity: 0,
            scale: 0.9
        },
        animate: {
            opacity: 1,
            scale: 1
        },
        className: "w-full h-auto min-h-[380px] flex flex-col items-center justify-center bg-gradient-to-b from-white/10 to-transparent dark:from-white/5 dark:to-transparent rounded-3xl border border-white/20 dark:border-white/10 p-6 shadow-xl backdrop-blur-md",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex items-center justify-between w-full mb-4 px-2",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                        className: "text-sm font-bold text-foreground/80 uppercase tracking-widest",
                        children: "Mastery Radar"
                    }, void 0, false, {
                        fileName: "[project]/src/components/gamification/DisciplineRadar.tsx",
                        lineNumber: 63,
                        columnNumber: 17
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "px-2 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-bold text-indigo-500",
                        children: "LIVE"
                    }, void 0, false, {
                        fileName: "[project]/src/components/gamification/DisciplineRadar.tsx",
                        lineNumber: 64,
                        columnNumber: 17
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/gamification/DisciplineRadar.tsx",
                lineNumber: 62,
                columnNumber: 13
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "w-full h-[180px] relative",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$recharts$2f$es6$2f$component$2f$ResponsiveContainer$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ResponsiveContainer"], {
                        width: "100%",
                        height: "100%",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$recharts$2f$es6$2f$chart$2f$RadarChart$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["RadarChart"], {
                            cx: "50%",
                            cy: "50%",
                            outerRadius: "75%",
                            data: data,
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("defs", {
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("linearGradient", {
                                        id: "radarGradient",
                                        x1: "0",
                                        y1: "0",
                                        x2: "0",
                                        y2: "1",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("stop", {
                                                offset: "5%",
                                                stopColor: "#8b5cf6",
                                                stopOpacity: 0.8
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/gamification/DisciplineRadar.tsx",
                                                lineNumber: 74,
                                                columnNumber: 33
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("stop", {
                                                offset: "95%",
                                                stopColor: "#6366f1",
                                                stopOpacity: 0.2
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/gamification/DisciplineRadar.tsx",
                                                lineNumber: 75,
                                                columnNumber: 33
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/gamification/DisciplineRadar.tsx",
                                        lineNumber: 73,
                                        columnNumber: 29
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/src/components/gamification/DisciplineRadar.tsx",
                                    lineNumber: 72,
                                    columnNumber: 25
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$recharts$2f$es6$2f$polar$2f$PolarGrid$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PolarGrid"], {
                                    stroke: "currentColor",
                                    className: "text-muted-foreground/10",
                                    gridType: "polygon"
                                }, void 0, false, {
                                    fileName: "[project]/src/components/gamification/DisciplineRadar.tsx",
                                    lineNumber: 78,
                                    columnNumber: 25
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$recharts$2f$es6$2f$polar$2f$PolarAngleAxis$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PolarAngleAxis"], {
                                    dataKey: "subject",
                                    tick: {
                                        fill: 'currentColor',
                                        fontSize: 10,
                                        fontWeight: 800
                                    },
                                    className: "text-muted-foreground uppercase"
                                }, void 0, false, {
                                    fileName: "[project]/src/components/gamification/DisciplineRadar.tsx",
                                    lineNumber: 79,
                                    columnNumber: 25
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$recharts$2f$es6$2f$polar$2f$PolarRadiusAxis$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PolarRadiusAxis"], {
                                    angle: 30,
                                    domain: [
                                        0,
                                        maxVal
                                    ],
                                    tick: false,
                                    axisLine: false
                                }, void 0, false, {
                                    fileName: "[project]/src/components/gamification/DisciplineRadar.tsx",
                                    lineNumber: 84,
                                    columnNumber: 25
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$recharts$2f$es6$2f$polar$2f$Radar$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Radar"], {
                                    name: "Stats",
                                    dataKey: "A",
                                    stroke: "#8b5cf6",
                                    strokeWidth: 3,
                                    fill: "url(#radarGradient)",
                                    fillOpacity: 1,
                                    isAnimationActive: true
                                }, void 0, false, {
                                    fileName: "[project]/src/components/gamification/DisciplineRadar.tsx",
                                    lineNumber: 85,
                                    columnNumber: 25
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/gamification/DisciplineRadar.tsx",
                            lineNumber: 71,
                            columnNumber: 21
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/src/components/gamification/DisciplineRadar.tsx",
                        lineNumber: 70,
                        columnNumber: 17
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-indigo-500/20 blur-[50px] rounded-full pointer-events-none"
                    }, void 0, false, {
                        fileName: "[project]/src/components/gamification/DisciplineRadar.tsx",
                        lineNumber: 98,
                        columnNumber: 17
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/gamification/DisciplineRadar.tsx",
                lineNumber: 69,
                columnNumber: 13
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "grid grid-cols-3 gap-2 w-full mt-4",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(StatItem, {
                        label: "Vitality",
                        value: stats?.vitality || 1,
                        color: "text-red-500"
                    }, void 0, false, {
                        fileName: "[project]/src/components/gamification/DisciplineRadar.tsx",
                        lineNumber: 102,
                        columnNumber: 17
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(StatItem, {
                        label: "Intellect",
                        value: stats?.intelligence || 1,
                        color: "text-blue-500"
                    }, void 0, false, {
                        fileName: "[project]/src/components/gamification/DisciplineRadar.tsx",
                        lineNumber: 103,
                        columnNumber: 17
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(StatItem, {
                        label: "Discipline",
                        value: stats?.discipline || 1,
                        color: "text-violet-500"
                    }, void 0, false, {
                        fileName: "[project]/src/components/gamification/DisciplineRadar.tsx",
                        lineNumber: 104,
                        columnNumber: 17
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(StatItem, {
                        label: "Charisma",
                        value: stats?.charisma || 1,
                        color: "text-pink-500"
                    }, void 0, false, {
                        fileName: "[project]/src/components/gamification/DisciplineRadar.tsx",
                        lineNumber: 105,
                        columnNumber: 17
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(StatItem, {
                        label: "Wealth",
                        value: stats?.wealth || 1,
                        color: "text-emerald-500"
                    }, void 0, false, {
                        fileName: "[project]/src/components/gamification/DisciplineRadar.tsx",
                        lineNumber: 106,
                        columnNumber: 17
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(StatItem, {
                        label: "Creativity",
                        value: stats?.creativity || 1,
                        color: "text-amber-500"
                    }, void 0, false, {
                        fileName: "[project]/src/components/gamification/DisciplineRadar.tsx",
                        lineNumber: 107,
                        columnNumber: 17
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/gamification/DisciplineRadar.tsx",
                lineNumber: 101,
                columnNumber: 13
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/gamification/DisciplineRadar.tsx",
        lineNumber: 57,
        columnNumber: 9
    }, this);
}
_s(DisciplineRadar, "VPBlTuY3OFtWDD1VERCoZ/KBldY=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$stores$2f$gamification$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGamificationStore"]
    ];
});
_c = DisciplineRadar;
function StatItem({ label, value, color }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex flex-col items-center bg-white/5 rounded-lg py-2 border border-white/5",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "text-[10px] text-muted-foreground uppercase tracking-wider",
                children: label
            }, void 0, false, {
                fileName: "[project]/src/components/gamification/DisciplineRadar.tsx",
                lineNumber: 116,
                columnNumber: 13
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("font-bold text-xl", color),
                children: value
            }, void 0, false, {
                fileName: "[project]/src/components/gamification/DisciplineRadar.tsx",
                lineNumber: 117,
                columnNumber: 13
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/gamification/DisciplineRadar.tsx",
        lineNumber: 115,
        columnNumber: 9
    }, this);
}
_c1 = StatItem;
var _c, _c1;
__turbopack_context__.k.register(_c, "DisciplineRadar");
__turbopack_context__.k.register(_c1, "StatItem");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/gamification/XPJourneyMap.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "XPJourneyMap",
    ()=>XPJourneyMap
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$stores$2f$gamification$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/stores/gamification-store.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/framer-motion/dist/es/render/components/motion/proxy.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/utils.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$check$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Check$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/check.js [app-client] (ecmascript) <export default as Check>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$lock$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Lock$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/lock.js [app-client] (ecmascript) <export default as Lock>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$star$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Star$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/star.js [app-client] (ecmascript) <export default as Star>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trophy$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Trophy$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/trophy.js [app-client] (ecmascript) <export default as Trophy>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$sparkles$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Sparkles$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/sparkles.js [app-client] (ecmascript) <export default as Sparkles>");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
;
;
function XPJourneyMap() {
    _s();
    const { level } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$stores$2f$gamification$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGamificationStore"])();
    const currentLevelRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    // Generate levels array (e.g., from 1 to current level + 2)
    const levels = Array.from({
        length: Math.max(5, level + 3)
    }, (_, i)=>i + 1);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "XPJourneyMap.useEffect": ()=>{
            // Auto-scroll to current level after a short delay to allow rendering
            if (currentLevelRef.current) {
                setTimeout({
                    "XPJourneyMap.useEffect": ()=>{
                        currentLevelRef.current?.scrollIntoView({
                            behavior: 'smooth',
                            block: 'center'
                        });
                    }
                }["XPJourneyMap.useEffect"], 500);
            }
        }
    }["XPJourneyMap.useEffect"], []);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "relative py-8 pl-4 pr-2",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "absolute left-[27px] top-8 bottom-8 w-[2px] bg-gradient-to-b from-indigo-500/0 via-indigo-500/50 to-indigo-500/0",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "absolute inset-0 bg-background/50 backdrop-blur-[1px]",
                    style: {
                        maskImage: 'linear-gradient(to bottom, transparent, black 10%, black 90%, transparent)'
                    },
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "h-full w-full border-l-2 border-dashed border-indigo-500/30"
                    }, void 0, false, {
                        fileName: "[project]/src/components/gamification/XPJourneyMap.tsx",
                        lineNumber: 30,
                        columnNumber: 21
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/src/components/gamification/XPJourneyMap.tsx",
                    lineNumber: 29,
                    columnNumber: 17
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/gamification/XPJourneyMap.tsx",
                lineNumber: 28,
                columnNumber: 13
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "space-y-8 relative",
                children: levels.map((lvl)=>{
                    const status = lvl < level ? 'completed' : lvl === level ? 'current' : 'locked';
                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(LevelNode, {
                        level: lvl,
                        status: status,
                        isRef: lvl === level ? currentLevelRef : null
                    }, lvl, false, {
                        fileName: "[project]/src/components/gamification/XPJourneyMap.tsx",
                        lineNumber: 37,
                        columnNumber: 28
                    }, this);
                })
            }, void 0, false, {
                fileName: "[project]/src/components/gamification/XPJourneyMap.tsx",
                lineNumber: 34,
                columnNumber: 13
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/gamification/XPJourneyMap.tsx",
        lineNumber: 26,
        columnNumber: 9
    }, this);
}
_s(XPJourneyMap, "XV0kOy+ONUjm9k80ZcqErMKLBB4=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$stores$2f$gamification$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGamificationStore"]
    ];
});
_c = XPJourneyMap;
function LevelNode({ level, status, isRef }) {
    const isCompleted = status === 'completed';
    const isCurrent = status === 'current';
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["motion"].div, {
        ref: isRef,
        initial: {
            opacity: 0,
            x: -20
        },
        animate: {
            opacity: 1,
            x: 0
        },
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("flex items-center gap-4 group relative", status === 'locked' && "opacity-60 grayscale-[0.8]"),
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("relative z-10 w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shadow-xl border-4 transition-all duration-300", isCompleted ? "bg-gradient-to-br from-indigo-600 to-violet-600 border-indigo-200/50 text-white" : "", isCurrent ? "bg-background border-indigo-500 text-indigo-500 scale-110 shadow-indigo-500/40 ring-4 ring-indigo-500/10" : "", status === 'locked' ? "bg-muted border-white/10 text-muted-foreground" : ""),
                children: [
                    isCompleted ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$check$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Check$3e$__["Check"], {
                        className: "w-5 h-5"
                    }, void 0, false, {
                        fileName: "[project]/src/components/gamification/XPJourneyMap.tsx",
                        lineNumber: 65,
                        columnNumber: 32
                    }, this) : status === 'locked' ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$lock$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Lock$3e$__["Lock"], {
                        className: "w-4 h-4"
                    }, void 0, false, {
                        fileName: "[project]/src/components/gamification/XPJourneyMap.tsx",
                        lineNumber: 65,
                        columnNumber: 86
                    }, this) : level,
                    isCurrent && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "absolute inset-0 rounded-full bg-indigo-500 animate-ping opacity-20"
                            }, void 0, false, {
                                fileName: "[project]/src/components/gamification/XPJourneyMap.tsx",
                                lineNumber: 70,
                                columnNumber: 25
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["motion"].div, {
                                className: "absolute -top-1 -right-1",
                                animate: {
                                    rotate: 360
                                },
                                transition: {
                                    duration: 4,
                                    repeat: Infinity,
                                    ease: "linear"
                                },
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$sparkles$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Sparkles$3e$__["Sparkles"], {
                                    className: "w-4 h-4 text-amber-400 fill-amber-400"
                                }, void 0, false, {
                                    fileName: "[project]/src/components/gamification/XPJourneyMap.tsx",
                                    lineNumber: 76,
                                    columnNumber: 29
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/src/components/gamification/XPJourneyMap.tsx",
                                lineNumber: 71,
                                columnNumber: 25
                            }, this)
                        ]
                    }, void 0, true)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/gamification/XPJourneyMap.tsx",
                lineNumber: 59,
                columnNumber: 13
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("flex-1 p-4 rounded-xl border transition-all duration-300", isCurrent ? "bg-gradient-to-r from-indigo-500/10 to-purple-500/5 border-indigo-500/30 shadow-lg shadow-indigo-500/10 backdrop-blur-sm" : "bg-card/50 border-white/5 hover:bg-card/80", isCompleted ? "opacity-80" : ""),
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex justify-between items-center mb-1",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h4", {
                                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("font-bold", isCurrent ? "text-indigo-600 dark:text-indigo-400" : "text-foreground/80"),
                                children: [
                                    "Level ",
                                    level
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/gamification/XPJourneyMap.tsx",
                                lineNumber: 89,
                                columnNumber: 21
                            }, this),
                            isCurrent && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-bold text-indigo-500 uppercase tracking-wide",
                                children: "Current"
                            }, void 0, false, {
                                fileName: "[project]/src/components/gamification/XPJourneyMap.tsx",
                                lineNumber: 93,
                                columnNumber: 25
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/gamification/XPJourneyMap.tsx",
                        lineNumber: 88,
                        columnNumber: 17
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-xs text-muted-foreground font-medium",
                        children: getLevelDescription(level)
                    }, void 0, false, {
                        fileName: "[project]/src/components/gamification/XPJourneyMap.tsx",
                        lineNumber: 99,
                        columnNumber: 17
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex flex-wrap gap-2 mt-3",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(RewardBadge, {
                                icon: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$star$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Star$3e$__["Star"], {
                                    className: "w-3 h-3 text-amber-500"
                                }, void 0, false, {
                                    fileName: "[project]/src/components/gamification/XPJourneyMap.tsx",
                                    lineNumber: 105,
                                    columnNumber: 40
                                }, void 0),
                                text: "Title",
                                active: isCompleted || isCurrent
                            }, void 0, false, {
                                fileName: "[project]/src/components/gamification/XPJourneyMap.tsx",
                                lineNumber: 105,
                                columnNumber: 21
                            }, this),
                            level % 5 === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(RewardBadge, {
                                icon: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trophy$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Trophy$3e$__["Trophy"], {
                                    className: "w-3 h-3 text-indigo-500"
                                }, void 0, false, {
                                    fileName: "[project]/src/components/gamification/XPJourneyMap.tsx",
                                    lineNumber: 106,
                                    columnNumber: 60
                                }, void 0),
                                text: "Rare Badge",
                                active: isCompleted || isCurrent
                            }, void 0, false, {
                                fileName: "[project]/src/components/gamification/XPJourneyMap.tsx",
                                lineNumber: 106,
                                columnNumber: 41
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/gamification/XPJourneyMap.tsx",
                        lineNumber: 104,
                        columnNumber: 17
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/gamification/XPJourneyMap.tsx",
                lineNumber: 83,
                columnNumber: 13
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/gamification/XPJourneyMap.tsx",
        lineNumber: 49,
        columnNumber: 9
    }, this);
}
_c1 = LevelNode;
function RewardBadge({ icon, text, active }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium transition-colors", active ? "bg-background border border-border shadow-sm text-foreground" : "bg-muted/30 text-muted-foreground border border-transparent"),
        children: [
            icon,
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                children: text
            }, void 0, false, {
                fileName: "[project]/src/components/gamification/XPJourneyMap.tsx",
                lineNumber: 120,
                columnNumber: 13
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/gamification/XPJourneyMap.tsx",
        lineNumber: 115,
        columnNumber: 9
    }, this);
}
_c2 = RewardBadge;
function getLevelDescription(level) {
    if (level === 1) return "The journey begins.";
    if (level === 5) return "Unlocking consistency mastery.";
    if (level === 10) return "A true habit building legend.";
    return `Mastering the art of small steps.`;
}
var _c, _c1, _c2;
__turbopack_context__.k.register(_c, "XPJourneyMap");
__turbopack_context__.k.register(_c1, "LevelNode");
__turbopack_context__.k.register(_c2, "RewardBadge");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/ui/textarea.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Textarea",
    ()=>Textarea
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/utils.ts [app-client] (ecmascript)");
;
;
function Textarea({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("textarea", {
        "data-slot": "textarea",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/src/components/ui/textarea.tsx",
        lineNumber: 7,
        columnNumber: 5
    }, this);
}
_c = Textarea;
;
var _c;
__turbopack_context__.k.register(_c, "Textarea");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/gamification/AccountabilityPledge.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AccountabilityPledge",
    ()=>AccountabilityPledge
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$stores$2f$gamification$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/stores/gamification-store.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$textarea$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/textarea.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/button.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/framer-motion/dist/es/render/components/motion/proxy.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$components$2f$AnimatePresence$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/framer-motion/dist/es/components/AnimatePresence/index.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$pen$2d$line$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__PenLine$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/pen-line.js [app-client] (ecmascript) <export default as PenLine>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$save$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Save$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/save.js [app-client] (ecmascript) <export default as Save>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$shield$2d$check$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ShieldCheck$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/shield-check.js [app-client] (ecmascript) <export default as ShieldCheck>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$sparkles$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Sparkles$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/sparkles.js [app-client] (ecmascript) <export default as Sparkles>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/sonner/dist/index.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/utils.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
;
;
;
;
;
function AccountabilityPledge() {
    _s();
    const { motivationText, updateMotivation } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$stores$2f$gamification$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGamificationStore"])();
    const [text, setText] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(motivationText);
    const [isEditing, setIsEditing] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    // Sync local state with store when store loads
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "AccountabilityPledge.useEffect": ()=>{
            setText(motivationText);
        }
    }["AccountabilityPledge.useEffect"], [
        motivationText
    ]);
    const handleSave = async ()=>{
        if (!text.trim()) return;
        await updateMotivation(text);
        setIsEditing(false);
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toast"].success("Identity Protocol Updated", {
            description: "Your motivation core has been synchronized."
        });
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["motion"].div, {
        layoutId: "pledge-card",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("group relative overflow-hidden rounded-3xl p-[1px] cursor-pointer transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-500/20", isEditing ? "ring-2 ring-indigo-500/50" : ""),
        onClick: ()=>!isEditing && setIsEditing(true),
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "absolute inset-0 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 opacity-30 dark:opacity-50"
            }, void 0, false, {
                fileName: "[project]/src/components/gamification/AccountabilityPledge.tsx",
                lineNumber: 42,
                columnNumber: 13
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "relative h-full bg-white/90 dark:bg-black/90 backdrop-blur-xl rounded-[23px] p-6 overflow-hidden",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:14px_14px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"
                    }, void 0, false, {
                        fileName: "[project]/src/components/gamification/AccountabilityPledge.tsx",
                        lineNumber: 46,
                        columnNumber: 17
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "relative z-10",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex items-center justify-between mb-4",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex items-center gap-2",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20",
                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$shield$2d$check$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ShieldCheck$3e$__["ShieldCheck"], {
                                                    className: "w-5 h-5 text-indigo-500"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/gamification/AccountabilityPledge.tsx",
                                                    lineNumber: 52,
                                                    columnNumber: 33
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/gamification/AccountabilityPledge.tsx",
                                                lineNumber: 51,
                                                columnNumber: 29
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                                className: "text-sm font-bold uppercase tracking-widest text-foreground/80",
                                                children: "Motivation Core"
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/gamification/AccountabilityPledge.tsx",
                                                lineNumber: 54,
                                                columnNumber: 29
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/gamification/AccountabilityPledge.tsx",
                                        lineNumber: 50,
                                        columnNumber: 25
                                    }, this),
                                    !isEditing && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["motion"].div, {
                                        initial: {
                                            opacity: 0
                                        },
                                        animate: {
                                            opacity: 1
                                        },
                                        className: "text-[10px] font-mono text-indigo-500 bg-indigo-500/10 px-2 py-1 rounded-full border border-indigo-500/20",
                                        children: text ? 'ACTIVE' : 'SETUP REQ'
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/gamification/AccountabilityPledge.tsx",
                                        lineNumber: 59,
                                        columnNumber: 29
                                    }, this),
                                    !isEditing && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                        size: "icon",
                                        variant: "ghost",
                                        className: "h-8 w-8 text-muted-foreground group-hover:text-indigo-500 transition-colors -mr-2",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$pen$2d$line$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__PenLine$3e$__["PenLine"], {
                                            className: "w-4 h-4"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/gamification/AccountabilityPledge.tsx",
                                            lineNumber: 69,
                                            columnNumber: 33
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/gamification/AccountabilityPledge.tsx",
                                        lineNumber: 68,
                                        columnNumber: 29
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/gamification/AccountabilityPledge.tsx",
                                lineNumber: 49,
                                columnNumber: 21
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$components$2f$AnimatePresence$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AnimatePresence"], {
                                mode: "wait",
                                children: isEditing ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["motion"].div, {
                                    initial: {
                                        opacity: 0,
                                        y: 10
                                    },
                                    animate: {
                                        opacity: 1,
                                        y: 0
                                    },
                                    exit: {
                                        opacity: 0,
                                        y: -10
                                    },
                                    className: "space-y-4",
                                    onClick: (e)=>e.stopPropagation(),
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$textarea$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Textarea"], {
                                            value: text,
                                            onChange: (e)=>setText(e.target.value),
                                            placeholder: "I commit to excellence because...",
                                            className: "min-h-[120px] bg-white/50 dark:bg-black/50 border-indigo-500/30 focus-visible:ring-indigo-500/50 resize-none text-lg font-medium leading-relaxed",
                                            autoFocus: true
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/gamification/AccountabilityPledge.tsx",
                                            lineNumber: 84,
                                            columnNumber: 33
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex justify-end gap-2",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                                    variant: "ghost",
                                                    onClick: (e)=>{
                                                        e.stopPropagation();
                                                        setIsEditing(false);
                                                    },
                                                    children: "Cancel"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/gamification/AccountabilityPledge.tsx",
                                                    lineNumber: 92,
                                                    columnNumber: 37
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                                    onClick: handleSave,
                                                    className: "gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/25",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$save$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Save$3e$__["Save"], {
                                                            className: "w-4 h-4"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/components/gamification/AccountabilityPledge.tsx",
                                                            lineNumber: 94,
                                                            columnNumber: 41
                                                        }, this),
                                                        "Save Protocol"
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/components/gamification/AccountabilityPledge.tsx",
                                                    lineNumber: 93,
                                                    columnNumber: 37
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/components/gamification/AccountabilityPledge.tsx",
                                            lineNumber: 91,
                                            columnNumber: 33
                                        }, this)
                                    ]
                                }, "editing", true, {
                                    fileName: "[project]/src/components/gamification/AccountabilityPledge.tsx",
                                    lineNumber: 76,
                                    columnNumber: 29
                                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["motion"].div, {
                                    initial: {
                                        opacity: 0
                                    },
                                    animate: {
                                        opacity: 1
                                    },
                                    className: "space-y-6",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("text-lg font-medium leading-relaxed", text ? "text-foreground" : "text-muted-foreground italic"),
                                            children: [
                                                '"',
                                                text || "Define your Why. Click to initialize your motivation protocol.",
                                                '"'
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/components/gamification/AccountabilityPledge.tsx",
                                            lineNumber: 106,
                                            columnNumber: 33
                                        }, this),
                                        text && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex items-center gap-2 pt-4 border-t border-dashed border-indigo-500/20 text-indigo-500/70",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$sparkles$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Sparkles$3e$__["Sparkles"], {
                                                    className: "w-3 h-3"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/gamification/AccountabilityPledge.tsx",
                                                    lineNumber: 115,
                                                    columnNumber: 41
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "text-[10px] uppercase tracking-[0.2em] font-bold",
                                                    children: "Signature Verified"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/gamification/AccountabilityPledge.tsx",
                                                    lineNumber: 116,
                                                    columnNumber: 41
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/components/gamification/AccountabilityPledge.tsx",
                                            lineNumber: 114,
                                            columnNumber: 37
                                        }, this)
                                    ]
                                }, "viewing", true, {
                                    fileName: "[project]/src/components/gamification/AccountabilityPledge.tsx",
                                    lineNumber: 100,
                                    columnNumber: 29
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/src/components/gamification/AccountabilityPledge.tsx",
                                lineNumber: 74,
                                columnNumber: 21
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/gamification/AccountabilityPledge.tsx",
                        lineNumber: 48,
                        columnNumber: 17
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/gamification/AccountabilityPledge.tsx",
                lineNumber: 44,
                columnNumber: 13
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/gamification/AccountabilityPledge.tsx",
        lineNumber: 33,
        columnNumber: 9
    }, this);
}
_s(AccountabilityPledge, "Ad0+BncUUkdMKoK/eyJaC5HAfz8=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$stores$2f$gamification$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGamificationStore"]
    ];
});
_c = AccountabilityPledge;
var _c;
__turbopack_context__.k.register(_c, "AccountabilityPledge");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/gamification/GamificationRulesModal.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GamificationRulesModal",
    ()=>GamificationRulesModal
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/dialog.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$tabs$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/tabs.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$scroll$2d$area$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/scroll-area.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trophy$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Trophy$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/trophy.js [app-client] (ecmascript) <export default as Trophy>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$diamond$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Diamond$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/diamond.js [app-client] (ecmascript) <export default as Diamond>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$shield$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Shield$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/shield.js [app-client] (ecmascript) <export default as Shield>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$zap$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Zap$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/zap.js [app-client] (ecmascript) <export default as Zap>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$target$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Target$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/target.js [app-client] (ecmascript) <export default as Target>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$book$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Book$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/book.js [app-client] (ecmascript) <export default as Book>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/framer-motion/dist/es/render/components/motion/proxy.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$stores$2f$gamification$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/stores/gamification-store.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$gamification$2f$DisciplineRadar$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/gamification/DisciplineRadar.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$gamification$2f$XPJourneyMap$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/gamification/XPJourneyMap.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$gamification$2f$AccountabilityPledge$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/gamification/AccountabilityPledge.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
;
;
;
;
;
;
function GamificationRulesModal() {
    _s();
    const { rulesModalOpen, activeRulesTab, closeRules, setActiveRulesTab } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$stores$2f$gamification$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGamificationStore"])();
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Dialog"], {
        open: rulesModalOpen,
        onOpenChange: (open)=>!open && closeRules(),
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogContent"], {
            className: "sm:max-w-2xl bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl border-white/20 dark:border-white/10",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogHeader"], {
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogTitle"], {
                            className: "text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-600",
                            children: "How to Play"
                        }, void 0, false, {
                            fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
                            lineNumber: 22,
                            columnNumber: 21
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogDescription"], {
                            children: "Master the rules to level up faster and earn rewards."
                        }, void 0, false, {
                            fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
                            lineNumber: 25,
                            columnNumber: 21
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
                    lineNumber: 21,
                    columnNumber: 17
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$tabs$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Tabs"], {
                    defaultValue: "xp",
                    value: activeRulesTab,
                    onValueChange: (val)=>setActiveRulesTab(val),
                    className: "w-full",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$tabs$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TabsList"], {
                            className: "grid w-full grid-cols-3 mb-4",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$tabs$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TabsTrigger"], {
                                    value: "xp",
                                    className: "flex items-center gap-2",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$zap$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Zap$3e$__["Zap"], {
                                            className: "w-4 h-4 text-amber-500"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
                                            lineNumber: 38,
                                            columnNumber: 29
                                        }, this),
                                        "XP & Levels"
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
                                    lineNumber: 37,
                                    columnNumber: 25
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$tabs$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TabsTrigger"], {
                                    value: "gems",
                                    className: "flex items-center gap-2",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$diamond$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Diamond$3e$__["Diamond"], {
                                            className: "w-4 h-4 text-blue-500"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
                                            lineNumber: 42,
                                            columnNumber: 29
                                        }, this),
                                        "Gems & Shop"
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
                                    lineNumber: 41,
                                    columnNumber: 25
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$tabs$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TabsTrigger"], {
                                    value: "rules",
                                    className: "flex items-center gap-2",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$book$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Book$3e$__["Book"], {
                                            className: "w-4 h-4 text-emerald-500"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
                                            lineNumber: 46,
                                            columnNumber: 29
                                        }, this),
                                        "Rules"
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
                                    lineNumber: 45,
                                    columnNumber: 25
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
                            lineNumber: 36,
                            columnNumber: 21
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$scroll$2d$area$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ScrollArea"], {
                            className: "h-[400px] pr-4",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$tabs$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TabsContent"], {
                                    value: "xp",
                                    className: "space-y-4 focus-visible:ring-0",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "grid grid-cols-1 md:grid-cols-2 gap-4 h-[450px]",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$scroll$2d$area$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ScrollArea"], {
                                                className: "h-full pr-4",
                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "space-y-4",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "bg-amber-50 dark:bg-amber-950/30 p-4 rounded-xl border border-amber-100 dark:border-amber-900/50",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                                                    className: "text-lg font-semibold text-amber-900 dark:text-amber-100 flex items-center gap-2 mb-2",
                                                                    children: [
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trophy$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Trophy$3e$__["Trophy"], {
                                                                            className: "w-5 h-5"
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
                                                                            lineNumber: 59,
                                                                            columnNumber: 49
                                                                        }, this),
                                                                        "Your Mastery Profile"
                                                                    ]
                                                                }, void 0, true, {
                                                                    fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
                                                                    lineNumber: 58,
                                                                    columnNumber: 45
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                    className: "text-sm text-amber-800 dark:text-amber-300",
                                                                    children: "Track your discipline, focus, and resilience. Level up to boost these stats!"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
                                                                    lineNumber: 62,
                                                                    columnNumber: 45
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
                                                            lineNumber: 57,
                                                            columnNumber: 41
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$gamification$2f$DisciplineRadar$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DisciplineRadar"], {}, void 0, false, {
                                                            fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
                                                            lineNumber: 66,
                                                            columnNumber: 41
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$gamification$2f$AccountabilityPledge$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AccountabilityPledge"], {}, void 0, false, {
                                                            fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
                                                            lineNumber: 67,
                                                            columnNumber: 41
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
                                                    lineNumber: 56,
                                                    columnNumber: 37
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
                                                lineNumber: 55,
                                                columnNumber: 33
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "bg-white/50 dark:bg-black/20 rounded-xl border p-1 h-full overflow-hidden flex flex-col",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                                        className: "text-sm font-bold px-4 py-3 bg-white/80 dark:bg-black/80 backdrop-blur-md border-b sticky top-0 z-10 flex items-center gap-2",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$target$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Target$3e$__["Target"], {
                                                                className: "w-4 h-4 text-indigo-500"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
                                                                lineNumber: 74,
                                                                columnNumber: 41
                                                            }, this),
                                                            "Journey Map"
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
                                                        lineNumber: 73,
                                                        columnNumber: 37
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$scroll$2d$area$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ScrollArea"], {
                                                        className: "flex-1",
                                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$gamification$2f$XPJourneyMap$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["XPJourneyMap"], {}, void 0, false, {
                                                            fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
                                                            lineNumber: 78,
                                                            columnNumber: 41
                                                        }, this)
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
                                                        lineNumber: 77,
                                                        columnNumber: 37
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
                                                lineNumber: 72,
                                                columnNumber: 33
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
                                        lineNumber: 53,
                                        columnNumber: 29
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
                                    lineNumber: 52,
                                    columnNumber: 25
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$tabs$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TabsContent"], {
                                    value: "gems",
                                    className: "space-y-4 focus-visible:ring-0",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "bg-blue-50 dark:bg-blue-950/30 p-4 rounded-xl border border-blue-100 dark:border-blue-900/50",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                                    className: "text-lg font-semibold text-blue-900 dark:text-blue-100 flex items-center gap-2 mb-2",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$diamond$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Diamond$3e$__["Diamond"], {
                                                            className: "w-5 h-5"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
                                                            lineNumber: 87,
                                                            columnNumber: 37
                                                        }, this),
                                                        "Gem Economy"
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
                                                    lineNumber: 86,
                                                    columnNumber: 33
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    className: "text-sm text-blue-800 dark:text-blue-300",
                                                    children: "Gems are a premium currency earned by leveling up. Spend them on powerful boosters."
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
                                                    lineNumber: 90,
                                                    columnNumber: 33
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
                                            lineNumber: 85,
                                            columnNumber: 29
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "grid md:grid-cols-2 gap-4",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "p-4 border rounded-xl bg-gradient-to-br from-white to-blue-50 dark:from-zinc-900 dark:to-blue-950/20",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h4", {
                                                            className: "font-semibold flex items-center gap-2 mb-2",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trophy$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Trophy$3e$__["Trophy"], {
                                                                    className: "w-4 h-4 text-yellow-500"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
                                                                    lineNumber: 98,
                                                                    columnNumber: 41
                                                                }, this),
                                                                "How to Earn"
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
                                                            lineNumber: 97,
                                                            columnNumber: 37
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                                                            className: "space-y-2 text-sm",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                                                    className: "flex justify-between items-center",
                                                                    children: [
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                            children: "Level Up"
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
                                                                            lineNumber: 103,
                                                                            columnNumber: 45
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                            className: "font-bold text-blue-600",
                                                                            children: "+5 Gems"
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
                                                                            lineNumber: 104,
                                                                            columnNumber: 45
                                                                        }, this)
                                                                    ]
                                                                }, void 0, true, {
                                                                    fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
                                                                    lineNumber: 102,
                                                                    columnNumber: 41
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                                                    className: "flex justify-between items-center text-muted-foreground",
                                                                    children: [
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                            children: "Special Events"
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
                                                                            lineNumber: 107,
                                                                            columnNumber: 45
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                            children: "Coming Soon"
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
                                                                            lineNumber: 108,
                                                                            columnNumber: 45
                                                                        }, this)
                                                                    ]
                                                                }, void 0, true, {
                                                                    fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
                                                                    lineNumber: 106,
                                                                    columnNumber: 41
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
                                                            lineNumber: 101,
                                                            columnNumber: 37
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
                                                    lineNumber: 96,
                                                    columnNumber: 33
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "p-4 border rounded-xl bg-gradient-to-br from-white to-purple-50 dark:from-zinc-900 dark:to-purple-950/20",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h4", {
                                                            className: "font-semibold flex items-center gap-2 mb-2",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$shield$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Shield$3e$__["Shield"], {
                                                                    className: "w-4 h-4 text-indigo-500"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
                                                                    lineNumber: 115,
                                                                    columnNumber: 41
                                                                }, this),
                                                                "Streak Store"
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
                                                            lineNumber: 114,
                                                            columnNumber: 37
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                                                            className: "space-y-2 text-sm",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                                                    className: "flex justify-between items-center",
                                                                    children: [
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                            children: "Streak Shield"
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
                                                                            lineNumber: 120,
                                                                            columnNumber: 45
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                            className: "font-bold text-red-500",
                                                                            children: "-20 Gems"
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
                                                                            lineNumber: 121,
                                                                            columnNumber: 45
                                                                        }, this)
                                                                    ]
                                                                }, void 0, true, {
                                                                    fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
                                                                    lineNumber: 119,
                                                                    columnNumber: 41
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                                                    className: "text-xs text-muted-foreground mt-1",
                                                                    children: "Protects your streak if you miss a day. Automatically consumed."
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
                                                                    lineNumber: 123,
                                                                    columnNumber: 41
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
                                                            lineNumber: 118,
                                                            columnNumber: 37
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
                                                    lineNumber: 113,
                                                    columnNumber: 33
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
                                            lineNumber: 95,
                                            columnNumber: 29
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
                                    lineNumber: 84,
                                    columnNumber: 25
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$tabs$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TabsContent"], {
                                    value: "rules",
                                    className: "space-y-4 focus-visible:ring-0",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "space-y-4",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(RuleItem, {
                                                title: "Streaks",
                                                description: "Completing a habit consecutively builds your streak. Missing a day resets it to 0 unless you have a Shield."
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
                                                lineNumber: 133,
                                                columnNumber: 33
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(RuleItem, {
                                                title: "Streak Shields",
                                                description: "A shield is automatically used when you miss a habit, keeping your streak alive. You can hold multiple shields."
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
                                                lineNumber: 137,
                                                columnNumber: 33
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(RuleItem, {
                                                title: "Levels",
                                                description: "Your level represents your overall consistency. There is no level cap. Show off your high level to friends!"
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
                                                lineNumber: 141,
                                                columnNumber: 33
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
                                        lineNumber: 132,
                                        columnNumber: 29
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
                                    lineNumber: 131,
                                    columnNumber: 25
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
                            lineNumber: 51,
                            columnNumber: 21
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
                    lineNumber: 30,
                    columnNumber: 17
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
            lineNumber: 20,
            columnNumber: 13
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
        lineNumber: 19,
        columnNumber: 9
    }, this);
}
_s(GamificationRulesModal, "QmYjz03Pw11zpSnpjgJe8p47U1k=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$stores$2f$gamification$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGamificationStore"]
    ];
});
_c = GamificationRulesModal;
function RewardCard({ icon, title, reward, description }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["motion"].div, {
        whileHover: {
            scale: 1.02
        },
        className: "flex items-center p-3 rounded-xl border bg-white dark:bg-zinc-900 shadow-sm",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "p-2 rounded-full bg-muted mr-3",
                children: icon
            }, void 0, false, {
                fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
                lineNumber: 160,
                columnNumber: 13
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex-1",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex justify-between items-center mb-1",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h4", {
                                className: "font-semibold text-sm",
                                children: title
                            }, void 0, false, {
                                fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
                                lineNumber: 165,
                                columnNumber: 21
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                                children: reward
                            }, void 0, false, {
                                fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
                                lineNumber: 166,
                                columnNumber: 21
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
                        lineNumber: 164,
                        columnNumber: 17
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-xs text-muted-foreground",
                        children: description
                    }, void 0, false, {
                        fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
                        lineNumber: 170,
                        columnNumber: 17
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
                lineNumber: 163,
                columnNumber: 13
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
        lineNumber: 156,
        columnNumber: 9
    }, this);
}
_c1 = RewardCard;
function RuleItem({ title, description }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "p-4 rounded-xl bg-muted/30 border",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h4", {
                className: "font-semibold mb-1",
                children: title
            }, void 0, false, {
                fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
                lineNumber: 179,
                columnNumber: 13
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "text-sm text-muted-foreground leading-relaxed",
                children: description
            }, void 0, false, {
                fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
                lineNumber: 180,
                columnNumber: 13
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/gamification/GamificationRulesModal.tsx",
        lineNumber: 178,
        columnNumber: 9
    }, this);
}
_c2 = RuleItem;
var _c, _c1, _c2;
__turbopack_context__.k.register(_c, "GamificationRulesModal");
__turbopack_context__.k.register(_c1, "RewardCard");
__turbopack_context__.k.register(_c2, "RuleItem");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/location.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "calculateDistance",
    ()=>calculateDistance,
    "getCurrentPosition",
    ()=>getCurrentPosition,
    "parseCoordinates",
    ()=>parseCoordinates
]);
function getCurrentPosition() {
    return new Promise((resolve, reject)=>{
        if (!navigator.geolocation) {
            reject(new Error('Geolocation is not supported by your browser'));
        } else {
            navigator.geolocation.getCurrentPosition((position)=>{
                resolve({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                });
            }, (error)=>{
                reject(error);
            });
        }
    });
}
function calculateDistance(coord1, coord2) {
    const R = 6371e3; // Earth radius in meters
    const lat1 = coord1.latitude * Math.PI / 180;
    const lat2 = coord2.latitude * Math.PI / 180;
    const deltaLat = (coord2.latitude - coord1.latitude) * Math.PI / 180;
    const deltaLon = (coord2.longitude - coord1.longitude) * Math.PI / 180;
    const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in meters
}
function parseCoordinates(value) {
    try {
        const [lat, lng] = value.split(',').map((s)=>parseFloat(s.trim()));
        if (!isNaN(lat) && !isNaN(lng)) {
            return {
                latitude: lat,
                longitude: lng
            };
        }
        return null;
    } catch (e) {
        return null;
    }
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/routines/RoutineTriggerWatcher.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "RoutineTriggerWatcher",
    ()=>RoutineTriggerWatcher
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$stores$2f$routine$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/stores/routine-store.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$location$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/location.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/sonner/dist/index.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
;
;
function RoutineTriggerWatcher() {
    _s();
    const { routines } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$stores$2f$routine$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRoutineStore"])();
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"])();
    const pathname = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["usePathname"])();
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "RoutineTriggerWatcher.useEffect": ()=>{
            if (("TURBOPACK compile-time value", "object") === 'undefined' || !navigator.geolocation) return;
            // Check if we have any routines that need location monitoring
            // We look for inactive routines with location triggers
            const hasLocationRoutines = routines.some({
                "RoutineTriggerWatcher.useEffect.hasLocationRoutines": (routine)=>routine.triggerType === 'location' && routine.triggerValue && !routine.isActive
            }["RoutineTriggerWatcher.useEffect.hasLocationRoutines"]);
            if (!hasLocationRoutines) return;
            const checkLocation = {
                "RoutineTriggerWatcher.useEffect.checkLocation": async ()=>{
                    try {
                        const position = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$location$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getCurrentPosition"])();
                        routines.forEach({
                            "RoutineTriggerWatcher.useEffect.checkLocation": (routine)=>{
                                if (routine.triggerType === 'location' && routine.triggerValue && !routine.isActive) {
                                    const targetCoords = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$location$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["parseCoordinates"])(routine.triggerValue);
                                    if (targetCoords) {
                                        const distance = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$location$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["calculateDistance"])(position, targetCoords);
                                        // If within 100 meters
                                        if (distance < 100) {
                                            (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toast"])(`Arrived at location`, {
                                                description: `Start "${routine.title}" routine?`,
                                                action: {
                                                    label: 'Start',
                                                    onClick: {
                                                        "RoutineTriggerWatcher.useEffect.checkLocation": ()=>{
                                                            router.push(`/routines?play=${routine.id}`);
                                                        }
                                                    }["RoutineTriggerWatcher.useEffect.checkLocation"]
                                                },
                                                duration: 10000
                                            });
                                        }
                                    }
                                }
                            }
                        }["RoutineTriggerWatcher.useEffect.checkLocation"]);
                    } catch (e) {
                    // ignore errors
                    }
                }
            }["RoutineTriggerWatcher.useEffect.checkLocation"];
            // Check on mount (after 2s delay)
            const initialTimeout = setTimeout(checkLocation, 2000);
            // Check every 5 minutes
            const intervalId = setInterval(checkLocation, 5 * 60 * 1000);
            return ({
                "RoutineTriggerWatcher.useEffect": ()=>{
                    clearInterval(intervalId);
                    clearTimeout(initialTimeout);
                }
            })["RoutineTriggerWatcher.useEffect"];
        }
    }["RoutineTriggerWatcher.useEffect"], [
        routines,
        router
    ]);
    return null;
}
_s(RoutineTriggerWatcher, "TJSrD2HqHUlhfXLHZ9zskJq5YZY=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$stores$2f$routine$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRoutineStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["usePathname"]
    ];
});
_c = RoutineTriggerWatcher;
var _c;
__turbopack_context__.k.register(_c, "RoutineTriggerWatcher");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=src_e9a065ec._.js.map