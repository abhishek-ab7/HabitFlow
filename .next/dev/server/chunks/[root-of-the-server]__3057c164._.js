module.exports = [
"[externals]/child_process [external] (child_process, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("child_process", () => require("child_process"));

module.exports = mod;
}),
"[externals]/fs [external] (fs, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("fs", () => require("fs"));

module.exports = mod;
}),
"[externals]/https [external] (https, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("https", () => require("https"));

module.exports = mod;
}),
"[externals]/stream [external] (stream, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("stream", () => require("stream"));

module.exports = mod;
}),
"[externals]/os [external] (os, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("os", () => require("os"));

module.exports = mod;
}),
"[externals]/events [external] (events, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("events", () => require("events"));

module.exports = mod;
}),
"[externals]/process [external] (process, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("process", () => require("process"));

module.exports = mod;
}),
"[externals]/util [external] (util, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("util", () => require("util"));

module.exports = mod;
}),
"[externals]/path [external] (path, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("path", () => require("path"));

module.exports = mod;
}),
"[externals]/crypto [external] (crypto, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("crypto", () => require("crypto"));

module.exports = mod;
}),
"[externals]/querystring [external] (querystring, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("querystring", () => require("querystring"));

module.exports = mod;
}),
"[externals]/buffer [external] (buffer, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("buffer", () => require("buffer"));

module.exports = mod;
}),
"[externals]/fs/promises [external] (fs/promises, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("fs/promises", () => require("fs/promises"));

module.exports = mod;
}),
"[externals]/node:stream [external] (node:stream, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:stream", () => require("node:stream"));

module.exports = mod;
}),
"[externals]/node:stream/promises [external] (node:stream/promises, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:stream/promises", () => require("node:stream/promises"));

module.exports = mod;
}),
"[externals]/http [external] (http, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("http", () => require("http"));

module.exports = mod;
}),
"[externals]/net [external] (net, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("net", () => require("net"));

module.exports = mod;
}),
"[externals]/tls [external] (tls, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("tls", () => require("tls"));

module.exports = mod;
}),
"[externals]/url [external] (url, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("url", () => require("url"));

module.exports = mod;
}),
"[externals]/zlib [external] (zlib, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("zlib", () => require("zlib"));

module.exports = mod;
}),
"[project]/src/lib/ai/cache.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// In-Memory Cache with TTL (can be upgraded to Redis/Vercel KV later)
__turbopack_context__.s([
    "deleteCacheKey",
    ()=>deleteCacheKey,
    "getCacheStats",
    ()=>getCacheStats,
    "getCachedResponse",
    ()=>getCachedResponse,
    "invalidateCache",
    ()=>invalidateCache,
    "setCachedResponse",
    ()=>setCachedResponse
]);
class InMemoryCache {
    cache = new Map();
    cleanupInterval;
    constructor(){
        // Cleanup expired entries every 5 minutes
        this.cleanupInterval = setInterval(()=>{
            this.cleanup();
        }, 5 * 60 * 1000);
    }
    cleanup() {
        const now = Date.now();
        const expired = [];
        this.cache.forEach((entry, key)=>{
            if (now - entry.timestamp > entry.ttl * 1000) {
                expired.push(key);
            }
        });
        expired.forEach((key)=>this.cache.delete(key));
        if (expired.length > 0) {
            console.log(`[Cache] Cleaned up ${expired.length} expired entries`);
        }
    }
    async get(key) {
        const entry = this.cache.get(`ai:${key}`);
        if (!entry) return null;
        const now = Date.now();
        if (now - entry.timestamp > entry.ttl * 1000) {
            // Expired
            this.cache.delete(`ai:${key}`);
            return null;
        }
        return entry.data;
    }
    async set(key, data, ttlSeconds) {
        const entry = {
            data,
            timestamp: Date.now(),
            ttl: ttlSeconds
        };
        this.cache.set(`ai:${key}`, entry);
    }
    async delete(key) {
        this.cache.delete(`ai:${key}`);
    }
    async invalidatePattern(pattern) {
        const regex = new RegExp(pattern.replace('*', '.*'));
        const keysToDelete = [];
        this.cache.forEach((_, key)=>{
            if (regex.test(key)) {
                keysToDelete.push(key);
            }
        });
        keysToDelete.forEach((key)=>this.cache.delete(key));
        console.log(`[Cache] Invalidated ${keysToDelete.length} keys matching pattern: ${pattern}`);
    }
    getStats() {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }
    destroy() {
        clearInterval(this.cleanupInterval);
        this.cache.clear();
    }
}
// Singleton instance
const cache = new InMemoryCache();
async function getCachedResponse(key) {
    try {
        return await cache.get(key);
    } catch (error) {
        console.error('[Cache] Read error:', error);
        return null; // Fail gracefully
    }
}
async function setCachedResponse(key, data, ttlSeconds) {
    try {
        await cache.set(key, data, ttlSeconds);
    } catch (error) {
        console.error('[Cache] Write error:', error);
    // Don't throw - caching failure shouldn't break the feature
    }
}
async function invalidateCache(pattern) {
    try {
        await cache.invalidatePattern(pattern);
    } catch (error) {
        console.error('[Cache] Invalidation error:', error);
    }
}
async function deleteCacheKey(key) {
    try {
        await cache.delete(key);
    } catch (error) {
        console.error('[Cache] Delete error:', error);
    }
}
function getCacheStats() {
    return cache.getStats();
}
}),
"[project]/src/lib/ai/retry.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Retry Logic with Exponential Backoff
__turbopack_context__.s([
    "retryWithBackoff",
    ()=>retryWithBackoff
]);
async function retryWithBackoff(fn, options = {}) {
    const { maxRetries = 3, initialDelay = 1000, maxDelay = 10000, backoffMultiplier = 2, feature = 'unknown' } = options;
    let lastError;
    let delay = initialDelay;
    for(let attempt = 0; attempt <= maxRetries; attempt++){
        try {
            console.log(`[AI] ${feature} attempt ${attempt + 1}/${maxRetries + 1}`);
            return await fn();
        } catch (error) {
            lastError = error;
            // Check if error is retryable
            const isRateLimit = error.message?.includes('429') || error.message?.includes('quota') || error.message?.includes('RESOURCE_EXHAUSTED');
            const isNetworkError = error.message?.includes('fetch') || error.message?.includes('network') || error.message?.includes('ECONNREFUSED');
            const isServerError = error.message?.includes('500') || error.message?.includes('503') || error.message?.includes('INTERNAL');
            const shouldRetry = isRateLimit || isNetworkError || isServerError;
            if (!shouldRetry || attempt === maxRetries) {
                console.error(`[AI] ${feature} failed after ${attempt + 1} attempts:`, error.message);
                throw createAIError(error, feature);
            }
            // Exponential backoff
            const jitter = Math.random() * 1000; // Add jitter to prevent thundering herd
            const actualDelay = Math.min(delay + jitter, maxDelay);
            console.warn(`[AI] ${feature} failed (attempt ${attempt + 1}), retrying in ${Math.round(actualDelay)}ms...`);
            await sleep(actualDelay);
            delay = delay * backoffMultiplier;
        }
    }
    throw lastError;
}
function sleep(ms) {
    return new Promise((resolve)=>setTimeout(resolve, ms));
}
function createAIError(error, feature) {
    const message = error.message || 'Unknown error';
    if (message.includes('429') || message.includes('quota')) {
        return new Error(`AI rate limit exceeded for ${feature}. Please try again in a few minutes.`);
    }
    if (message.includes('network') || message.includes('fetch')) {
        return new Error(`Network error for ${feature}. Please check your connection.`);
    }
    if (message.includes('500') || message.includes('503')) {
        return new Error(`AI service temporarily unavailable for ${feature}. Please try again.`);
    }
    return new Error(`AI error for ${feature}: ${message}`);
}
}),
"[project]/src/lib/ai/service.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "HabitFlowAI",
    ()=>HabitFlowAI
]);
// Unified AI Service Layer for HabitFlow
// REFACTORED: Module-Based API Key Rotation System (3 pools × 3 keys)
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$google$2f$genai$2f$dist$2f$node$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@google/genai/dist/node/index.mjs [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ai$2f$cache$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/ai/cache.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ai$2f$retry$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/ai/retry.ts [app-route] (ecmascript)");
;
;
;
class HabitFlowAI {
    // Static configuration: Load all 9 keys from environment
    static KEY_POOLS = HabitFlowAI.initializeKeyPools();
    // Health tracking: Shared across all instances per module+key
    static keyHealth = new Map();
    // Request queue: Per instance to prevent race conditions
    requestQueue = Promise.resolve();
    lastRequestTime = 0;
    MIN_REQUEST_INTERVAL = 4000;
    // Instance configuration
    module;
    currentKeyIndex = 0;
    model = 'gemini-2.5-flash-lite';
    constructor(module){
        this.module = module;
        // Validate module has keys configured
        const keys = HabitFlowAI.KEY_POOLS[module];
        if (!keys || keys.length === 0) {
            throw new Error(`No API keys configured for module "${module}". ` + `Expected GEMINI_KEY_${module.toUpperCase()}_1, _2, _3 in environment.`);
        }
        console.log(`[AI Service] Initialized for module: ${module} with ${keys.length} keys`);
    }
    // Static initializer: Load keys from environment on first import
    static initializeKeyPools() {
        const modules = [
            'dashboard',
            'tasks',
            'habits'
        ];
        const pools = {};
        for (const mod of modules){
            const moduleUpper = mod.toUpperCase();
            const keys = [];
            for(let i = 1; i <= 3; i++){
                const envKey = `GEMINI_KEY_${moduleUpper}_${i}`;
                const apiKey = process.env[envKey];
                if (apiKey) {
                    keys.push(apiKey);
                } else {
                    console.warn(`[AI Service] Missing ${envKey} - pool will have only ${keys.length} keys`);
                }
            }
            pools[mod] = keys;
        }
        return pools;
    }
    // Key selection with health tracking
    selectHealthyKey() {
        const keys = HabitFlowAI.KEY_POOLS[this.module];
        const poolSize = keys.length;
        const now = Date.now();
        // Try all keys starting from current index (round-robin)
        for(let i = 0; i < poolSize; i++){
            const keyIndex = (this.currentKeyIndex + i) % poolSize;
            const key = keys[keyIndex];
            const healthKey = `${this.module}:${keyIndex}`;
            const health = HabitFlowAI.keyHealth.get(healthKey);
            // Check if key is in cooldown
            if (health) {
                const timeSinceFailure = now - health.lastFailureTime;
                if (timeSinceFailure < health.cooldownMs) {
                    console.log(`[AI Key Health] Skipping ${this.module} key #${keyIndex + 1} ` + `(cooldown: ${Math.round((health.cooldownMs - timeSinceFailure) / 1000)}s remaining)`);
                    continue;
                } else {
                    // Cooldown expired, clear health record
                    HabitFlowAI.keyHealth.delete(healthKey);
                }
            }
            // Key is healthy, use it
            this.currentKeyIndex = keyIndex;
            console.log(`[AI Key Rotation] Using ${this.module} key #${keyIndex + 1} (round-robin)`);
            return key;
        }
        // All keys unhealthy
        console.error(`[AI Key Health] All keys for ${this.module} are in cooldown!`);
        return null;
    }
    // Mark key as unhealthy after 429 error
    markKeyUnhealthy(keyIndex) {
        const healthKey = `${this.module}:${keyIndex}`;
        HabitFlowAI.keyHealth.set(healthKey, {
            lastFailureTime: Date.now(),
            cooldownMs: 60000 // 60 seconds
        });
        console.warn(`[AI Key Health] Marked ${this.module} key #${keyIndex + 1} as unhealthy (60s cooldown)`);
    }
    // Queue management (preserved from original)
    async processInQueue(operation) {
        const result = this.requestQueue.then(async ()=>{
            const now = Date.now();
            const timeSinceLast = now - this.lastRequestTime;
            if (timeSinceLast < this.MIN_REQUEST_INTERVAL) {
                const waitTime = this.MIN_REQUEST_INTERVAL - timeSinceLast;
                console.log(`[AI Queue] Throttling request by ${waitTime}ms to respect rate limits...`);
                await new Promise((resolve)=>setTimeout(resolve, waitTime));
            }
            try {
                this.lastRequestTime = Date.now();
                return await operation();
            } catch (e) {
                throw e;
            }
        });
        this.requestQueue = result.then(()=>{}).catch(()=>{});
        return result;
    }
    async generate(feature, prompt, schema, cacheKey, cacheTTL) {
        // 1. Check Cache First
        if (cacheKey) {
            const cached = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ai$2f$cache$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getCachedResponse"])(cacheKey);
            if (cached) {
                console.log(`[AI Cache HIT] ${feature} - key: ${cacheKey}`);
                return cached;
            }
            console.log(`[AI Cache MISS] ${feature} - key: ${cacheKey}`);
        }
        // 2. Select Healthy Key
        const apiKey = this.selectHealthyKey();
        if (!apiKey) {
            // All keys exhausted - try cache fallback
            if (cacheKey) {
                const staleCache = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ai$2f$cache$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getCachedResponse"])(cacheKey);
                if (staleCache) {
                    console.warn(`[AI Fallback] Returning stale cache for ${feature} (all keys unhealthy)`);
                    return staleCache;
                }
            }
            throw new Error(`All API keys for module "${this.module}" are rate-limited. ` + `Please try again in 60 seconds or check your rate limits.`);
        }
        // 3. Execute with Rotation & Retry
        const result = await this.processInQueue(async ()=>{
            const currentKeyIndex = this.currentKeyIndex;
            try {
                return await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ai$2f$retry$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["retryWithBackoff"])(async ()=>{
                    const client = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$google$2f$genai$2f$dist$2f$node$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["GoogleGenAI"]({
                        apiKey
                    });
                    const config = {};
                    if (schema) {
                        config.responseMimeType = 'application/json';
                        config.responseSchema = schema;
                    }
                    const response = await client.models.generateContent({
                        model: this.model,
                        contents: prompt,
                        ...Object.keys(config).length > 0 && {
                            config
                        }
                    });
                    return response.text || '';
                }, {
                    maxRetries: 3,
                    feature
                });
            } catch (error) {
                // Check if 429 rate limit error
                if (error?.message?.includes('429') || error?.status === 429) {
                    this.markKeyUnhealthy(currentKeyIndex);
                    // Retry with next key (recursive call advances index internally)
                    console.log(`[AI Retry] 429 error detected, retrying with next key...`);
                    return this.generate(feature, prompt, schema, cacheKey, cacheTTL);
                }
                throw error;
            }
        });
        // 4. Advance to next key (round-robin)
        const keys = HabitFlowAI.KEY_POOLS[this.module];
        this.currentKeyIndex = (this.currentKeyIndex + 1) % keys.length;
        // 5. Parse & Cache
        let data;
        try {
            if (!result) throw new Error('Empty response from AI');
            data = JSON.parse(result);
        } catch (error) {
            console.error(`[AI] Failed to parse JSON for ${feature}:`, result);
            throw new Error(`Failed to parse AI response for ${feature}`);
        }
        if (cacheKey && cacheTTL) {
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ai$2f$cache$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["setCachedResponse"])(cacheKey, data, cacheTTL);
            console.log(`[AI] Cached ${feature} for ${cacheTTL}s - key: ${cacheKey}`);
        }
        return data;
    }
    async generateWithoutSchema(feature, prompt, cacheKey, cacheTTL) {
        // 1. Check Cache
        if (cacheKey) {
            const cached = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ai$2f$cache$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getCachedResponse"])(cacheKey);
            if (cached) {
                console.log(`[AI Cache HIT] ${feature} - key: ${cacheKey}`);
                return cached;
            }
        }
        // 2. Select Healthy Key
        const apiKey = this.selectHealthyKey();
        if (!apiKey) {
            if (cacheKey) {
                const staleCache = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ai$2f$cache$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getCachedResponse"])(cacheKey);
                if (staleCache) {
                    console.warn(`[AI Fallback] Returning stale cache for ${feature} (all keys unhealthy)`);
                    return staleCache;
                }
            }
            throw new Error(`All API keys for module "${this.module}" are rate-limited.`);
        }
        // 3. Execute with Rotation
        const result = await this.processInQueue(async ()=>{
            const currentKeyIndex = this.currentKeyIndex;
            try {
                return await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ai$2f$retry$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["retryWithBackoff"])(async ()=>{
                    const client = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$google$2f$genai$2f$dist$2f$node$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["GoogleGenAI"]({
                        apiKey
                    });
                    const response = await client.models.generateContent({
                        model: this.model,
                        contents: prompt
                    });
                    return response.text || '';
                }, {
                    maxRetries: 3,
                    feature
                });
            } catch (error) {
                if (error?.message?.includes('429') || error?.status === 429) {
                    this.markKeyUnhealthy(currentKeyIndex);
                    console.log(`[AI Retry] 429 error detected, retrying with next key...`);
                    const keys = HabitFlowAI.KEY_POOLS[this.module];
                    this.currentKeyIndex = (this.currentKeyIndex + 1) % keys.length;
                    return await this.generateWithoutSchema(feature, prompt, cacheKey, cacheTTL);
                }
                throw error;
            }
        });
        // 4. Advance round-robin
        const keys = HabitFlowAI.KEY_POOLS[this.module];
        this.currentKeyIndex = (this.currentKeyIndex + 1) % keys.length;
        // 5. Cache
        if (cacheKey && cacheTTL) {
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ai$2f$cache$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["setCachedResponse"])(cacheKey, result, cacheTTL);
        }
        return result;
    }
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__3057c164._.js.map