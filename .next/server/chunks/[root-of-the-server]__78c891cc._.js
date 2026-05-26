module.exports=[93695,(e,t,i)=>{t.exports=e.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},70406,(e,t,i)=>{t.exports=e.x("next/dist/compiled/@opentelemetry/api",()=>require("next/dist/compiled/@opentelemetry/api"))},18622,(e,t,i)=>{t.exports=e.x("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js",()=>require("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js"))},56704,(e,t,i)=>{t.exports=e.x("next/dist/server/app-render/work-async-storage.external.js",()=>require("next/dist/server/app-render/work-async-storage.external.js"))},32319,(e,t,i)=>{t.exports=e.x("next/dist/server/app-render/work-unit-async-storage.external.js",()=>require("next/dist/server/app-render/work-unit-async-storage.external.js"))},24725,(e,t,i)=>{t.exports=e.x("next/dist/server/app-render/after-task-async-storage.external.js",()=>require("next/dist/server/app-render/after-task-async-storage.external.js"))},24361,(e,t,i)=>{t.exports=e.x("util",()=>require("util"))},14747,(e,t,i)=>{t.exports=e.x("path",()=>require("path"))},24836,(e,t,i)=>{t.exports=e.x("https",()=>require("https"))},46786,(e,t,i)=>{t.exports=e.x("os",()=>require("os"))},21517,(e,t,i)=>{t.exports=e.x("http",()=>require("http"))},4446,(e,t,i)=>{t.exports=e.x("net",()=>require("net"))},55004,(e,t,i)=>{t.exports=e.x("tls",()=>require("tls"))},92509,(e,t,i)=>{t.exports=e.x("url",()=>require("url"))},54799,(e,t,i)=>{t.exports=e.x("crypto",()=>require("crypto"))},874,(e,t,i)=>{t.exports=e.x("buffer",()=>require("buffer"))},81111,(e,t,i)=>{t.exports=e.x("node:stream",()=>require("node:stream"))},16828,73486,e=>{"use strict";let t={type:"object",properties:{recommendations:{type:"array",items:{type:"object",properties:{habitName:{type:"string"},category:{type:"string"},reasoning:{type:"string"},targetDaysPerWeek:{type:"number",minimum:1,maximum:7},stackWith:{type:"string"},difficulty:{type:"string",enum:["easy","medium","hard"]},expectedImpact:{type:"string",enum:["low","medium","high"]},relatedGoals:{type:"array",items:{type:"string"}}},required:["habitName","category","reasoning","targetDaysPerWeek","difficulty","expectedImpact"]},maxItems:5}},required:["recommendations"]},i={type:"object",properties:{goalId:{type:"string"},milestones:{type:"array",items:{type:"object",properties:{title:{type:"string"},description:{type:"string"},suggestedDeadline:{type:"string"},difficulty:{type:"string",enum:["easy","medium","hard"]},reasoning:{type:"string"},orderIndex:{type:"number"},estimatedTimeWeeks:{type:"number"}},required:["title","description","difficulty","orderIndex"]},minItems:3,maxItems:7},totalEstimatedWeeks:{type:"number"},confidenceScore:{type:"number",minimum:0,maximum:100},alternativeApproaches:{type:"array",items:{type:"string"}}},required:["goalId","milestones","totalEstimatedWeeks","confidenceScore"]},r={type:"object",properties:{stacks:{type:"array",items:{type:"object",properties:{name:{type:"string"},description:{type:"string"},triggerHabitId:{type:"string"},stackedHabitIds:{type:"array",items:{type:"string"}},suggestedOrder:{type:"array",items:{type:"string"}},reasoning:{type:"string"},difficulty:{type:"string",enum:["easy","medium","hard"]},estimatedTimeMinutes:{type:"number"},expectedSuccessRate:{type:"number",minimum:0,maximum:100}},required:["name","triggerHabitId","stackedHabitIds","reasoning"]},minItems:1,maxItems:4},topRecommendation:{type:"string"},tips:{type:"array",items:{type:"string"}}},required:["stacks","tips"]},a={type:"object",properties:{primaryQuote:{type:"object",properties:{quote:{type:"string"},author:{type:"string"},relevanceScore:{type:"number",minimum:1,maximum:10},context:{type:"string"},reasoning:{type:"string"},actionableInsight:{type:"string"}},required:["quote","relevanceScore","context","reasoning"]},alternativeQuotes:{type:"array",items:{type:"object",properties:{quote:{type:"string"},author:{type:"string"},relevanceScore:{type:"number"}}},maxItems:2}},required:["primaryQuote"]};function n(e){let{userData:t,context:i}=e;if(i?.mode==="suggestion")return`You are an expert Habit Coach. The user wants to improve in the area of "${i.category||"general productivity"}".
Suggest 3 small, atomic habits they could start today. 

Return a JSON object with:
- greeting: A motivational greeting
- focus: The main suggestion with the 3 habits explained
- quote: A relevant motivational quote

Be specific, actionable, and encouraging.`;let r=12>new Date().getHours()?"morning":18>new Date().getHours()?"afternoon":"evening";return`You are an expert Productivity Coach for a user named "${t?.userName||"Friend"}". 
Your goal is to provide a concise, motivating, and actionable daily briefing.

Current Context:
- Time: ${r}, ${new Date().toLocaleDateString()}
- Unfinished Tasks: ${i?.unfinishedTasks||0}
- Today's Habits: ${i?.todaysHabits||"No habits tracked yet"}
- XP Level: ${t?.level||1}
${i?.burnoutRisk?`- Burnout Risk: ${i.burnoutRisk}/100`:""}
${i?.topPriorityTask?`- Top Priority: ${i.topPriorityTask}`:""}
${i?.upcomingDeadlines?.length?`- Upcoming Deadlines: ${i.upcomingDeadlines.map(e=>`${e.title} (${e.daysLeft} days)`).join(", ")}`:""}

Instructions:
1. Start with a personalized greeting that acknowledges their level/progress
2. Give 1 specific, actionable recommendation based on their current context
3. End with a motivational quote (not generic - tie it to their situation)
4. Optionally add energyForecast ('low'/'medium'/'high'), streaksAtRisk (array), quickWins (array)

Be encouraging but honest. If they're behind, motivate them. If they're crushing it, celebrate them.`}function s(e){let{task:t,userContext:i}=e,r=t.due_date?Math.ceil((new Date(t.due_date).getTime()-Date.now())/864e5):null;return`You are a task prioritization expert. Analyze this task and recommend the optimal priority level.

Task Details:
- Title: ${t.title}
- Description: ${t.description||"No description"}
- Current Priority: ${t.priority||"not set"}
- Due Date: ${t.due_date||"not set"}${null!==r?` (${r} days from now)`:""}
- Tags: ${t.tags?.join(", ")||"none"}

User Context:
- Current Time: ${i?.currentTime||new Date().toLocaleString()}
${i?.activeGoals?.length?`- Active Goals: ${i.activeGoals.map(e=>e.title).join(", ")}`:""}
${i?.weekdayStats?`- This weekday typically has ${i.weekdayStats}% completion rate`:""}

Instructions:
Provide a priority recommendation with:
1. suggestedPriority: 'low', 'medium', or 'high'
2. reasoning: 2-3 sentences explaining why (consider urgency, importance, goal alignment)
3. urgencyScore: 0-100 (based on deadline proximity, dependencies, impact)
4. estimatedDuration: realistic time estimate (e.g., "30 minutes", "2 hours")
5. bestTimeSlot: when to do this (e.g., "Morning (high focus needed)", "Afternoon break")

Be practical and consider work-life balance. Don't over-prioritize everything.`}function o(e){let{goals:t,currentHabits:i,categoryPerformance:r,userLevel:a}=e;return`You are a habit formation expert. Based on the user's goals and current habits, recommend 3-5 new atomic habits that will help them succeed.

User's Active Goals:
${t.map(e=>`- ${e.title} (${e.areaOfLife}): ${e.description||"No description"}`).join("\n")}

Current Habits (${i.length} total):
${i.map(e=>`- ${e.name} (${e.category})`).join("\n")||"No habits yet"}

${r?`Category Performance:
${Object.entries(r).map(([e,t])=>`- ${e}: ${t}% completion rate`).join("\n")}`:""}

User Level: ${a||1}

Instructions:
Recommend 3-5 small, atomic habits that:
1. Directly support their goals
2. Fill gaps in their current routine
3. Are appropriate for their experience level (start small for beginners)
4. Can be realistically maintained

For each recommendation, provide:
- habitName: Clear, actionable name (e.g., "5-minute morning meditation")
- category: health, work, learning, personal, finance, or relationships
- reasoning: Why this habit will help (tie to specific goals)
- targetDaysPerWeek: 1-7 (be conservative - 3-5 is better than 7)
- difficulty: easy, medium, hard
- expectedImpact: low, medium, high
- stackWith: (optional) existing habit to pair with
- relatedGoals: array of goal IDs this supports

Prioritize keystone habits that create positive ripple effects.`}function l(e){let{title:t,description:i}=e;return`Break down the following task into 3-5 actionable subtasks.

Task Title: ${t}
Task Description: ${i||"No additional context provided"}

Instructions:
- Create 3-5 small, concrete subtasks
- Each subtask should be completable in one sitting
- Start each with an action verb (Research, Create, Review, etc.)
- Order them logically (what needs to happen first?)
- Be specific (not "Work on X" but "Draft X", "Review Y")

Return ONLY a JSON object with a "subtasks" array of strings.

Example good subtasks for "Build a website":
- "Research website builders and choose platform"
- "Create site structure and navigation plan"
- "Design homepage layout mockup"
- "Write homepage copy and content"
- "Set up hosting and deploy site"

Now generate subtasks for the given task.`}function c(e){let{goal:t,userContext:i}=e;return`You are an expert Goal Planning AI. Break down the following goal into 4-7 actionable milestones.

**Goal Information:**
- Title: "${t.title}"
- Description: ${t.description||"Not provided"}
- Deadline: ${t.deadline}
- Area of Life: ${t.areaOfLife}

**User Context:**
- User Level: ${i?.userLevel||1}
- Timeline Preference: ${({aggressive:"fast-paced with tight deadlines",balanced:"moderate pace with realistic deadlines",relaxed:"comfortable pace with flexible deadlines"})[i?.timelinePreference||"balanced"]}
- Existing Milestones: ${i?.currentMilestones||0}

**Instructions:**
1. Create 4-7 specific, measurable milestones that lead to goal completion
2. Order them logically (milestone 1 should be the first step)
3. Assign realistic deadlines based on the goal deadline and timeline preference
4. Mark difficulty (easy = can complete in 1 week, medium = 2-3 weeks, hard = 4+ weeks)
5. Provide clear reasoning for each milestone
6. Ensure milestones follow SMART criteria (Specific, Measurable, Achievable, Relevant, Time-bound)

**Example Milestone:**
{
  "title": "Research and document requirements",
  "description": "Spend 3-5 hours researching industry standards, competitor analysis, and create a requirements document",
  "difficulty": "easy",
  "orderIndex": 1,
  "estimatedTimeWeeks": 1,
  "suggestedDeadline": "2026-02-10",
  "reasoning": "Starting with research ensures we build on a solid foundation"
}

Return milestones in ascending order (1, 2, 3...). Set goalId to "${t.id}".`}function d(e){let{existingHabits:t,userContext:i}=e,r=t.map(e=>`- ${e.name} (${e.category}, ${e.completionRate}% success rate, ${e.currentStreak} day streak)`).join("\n");return`You are a Behavioral Science expert specializing in habit formation and habit stacking.

**User's Current Habits:**
${r}

**User Context:**
- Available time slots: ${i?.availableTimeSlots?.join(", ")||"Not specified"}
- Struggling with: ${i?.strugglingCategories?.join(", ")||"None reported"}
- Top performing habits: ${i?.topPerformingHabits?.join(", ")||"None yet"}

**Task:**
Suggest 2-4 "habit stacks" where the user can chain habits together for better success. Use the concept of "implementation intentions" and "habit stacking" from behavioral science.

**Habit Stacking Formula:**
After [EXISTING HABIT], I will [NEW HABIT SEQUENCE].

**Criteria:**
1. Choose a strong "trigger habit" (high completion rate, established streak)
2. Stack 2-3 related habits that naturally follow
3. Keep total time under 30 minutes per stack
4. Consider natural transitions (e.g., Morning routine: Wake up → Drink water → Meditate → Journal)
5. Suggest difficulty level and expected success rate
6. Provide actionable tips for implementation

**Example Stack:**
{
  "name": "Morning Wellness Stack",
  "description": "Build on your consistent water drinking habit to create a powerful morning routine",
  "triggerHabitId": "habit-123",
  "stackedHabitIds": ["habit-123", "habit-456", "habit-789"],
  "suggestedOrder": ["Drink water", "10-minute meditation", "5-minute journaling"],
  "reasoning": "Water drinking has 95% completion rate, making it ideal trigger. Meditation and journaling naturally follow when mind is fresh.",
  "difficulty": "easy",
  "estimatedTimeMinutes": 20,
  "expectedSuccessRate": 85
}

Return 2-4 stacks. Mark the topRecommendation with the stack name that has highest expected success.`}function u(e){let{userContext:t,context:i}=e;return`You are a Motivational Psychology expert. Generate a deeply personalized, relevant motivational quote.

**User Context:**
- Name: ${t.userName}
- Current State: ${({struggling:"feeling overwhelmed or behind on goals",motivated:"riding a wave of momentum",accomplished:"celebrating a recent win",neutral:"maintaining steady progress"})[t.currentMood||"neutral"]}
- Completed Habits Today: ${t.recentActivity?.completedHabitsToday||0}
${t.recentActivity?.missedStreak?"- Just broke a streak (needs encouragement)":""}
${t.recentActivity?.upcomingDeadline?`- Approaching deadline: ${t.recentActivity.upcomingDeadline}`:""}
${t.recentActivity?.recentWin?`- Recent win: ${t.recentActivity.recentWin}`:""}

**Active Goals:**
${t.goals?.map(e=>`- ${e.title} (${e.progress}% complete)`).join("\n")||"None set"}

**Context:** ${i||"general"}

**Instructions:**
1. Generate a quote that speaks DIRECTLY to their current situation
2. Avoid generic platitudes - make it specific and relevant
3. If they're struggling, be empathetic but empowering
4. If they're winning, celebrate but challenge them to go further
5. Include attribution if it's a real quote, or mark as "Original"
6. Add a brief "actionable insight" - one small thing they can do right now
7. Rate relevance 1-10 (only give 8+ scores for truly personalized quotes)

**Examples of Good Personalization:**
- Struggling with streak: "The master has failed more times than the beginner has even tried. - Stephen McCranie. Your 47-day streak taught you discipline; today teaches you resilience."
- Approaching deadline: "Deadlines aren't walls, they're trampolines. You've got 3 days - that's enough to make meaningful progress on your MVP."

Return ONE primary quote with reasoning, plus 0-2 alternatives.`}function p(e){let{habit:t,userGoals:i,generateTips:r}=e;return`You are a Health & Productivity expert. Write a compelling, scientifically-backed description for this habit.

**Habit Information:**
- Name: "${t.name}"
- Category: ${t.category}

**User's Active Goals:**
${i?.map(e=>`- ${e.title} (${e.areaOfLife})`).join("\n")||"None provided"}

**Task:**
Create an inspiring yet informative habit description that:

1. **Description (2-3 sentences):**
   - Explain what the habit is and why it matters
   - Connect to user's goals if relevant
   - Make it personal and actionable

2. **Benefits (3-5 bullet points):**
   - List specific, evidence-based benefits
   - Mix short-term wins with long-term gains
   - Be concrete (e.g., "Reduces cortisol by 20%" not "Reduces stress")

3. **Tips for Success (3-5 bullet points):**
   - Practical, immediately actionable advice
   - Address common obstacles
   - Include "if-then" planning tips

4. **Assessment:**
   - Difficulty: beginner/intermediate/advanced
   - Time: realistic daily time commitment in minutes
   - Scientific backing: 1-sentence citation or principle

5. **Common Pitfalls (2-3 items):**
   - What typically goes wrong
   - How to avoid it

**Example Output:**
{
  "description": "A 10-minute morning meditation practice trains your attention and emotional regulation. Research shows it reduces anxiety by 30% and improves focus for 4+ hours. Since you're working toward 'Launch MVP,' this habit will help you make clearer decisions under pressure.",
  "benefits": [
    "Reduces anxiety and cortisol levels by 20-30% (Harvard Medical School)",
    "Improves focus and concentration for 4-6 hours post-practice",
    "Enhances emotional regulation and stress resilience",
    "Better sleep quality (reported by 65% of practitioners)"
  ],
  "tips": [
    "Start with just 2 minutes - consistency beats duration",
    "Use a guided app like Headspace for the first 2 weeks",
    "If thoughts intrude, label them 'thinking' and return to breath - this IS the practice",
    "Meditate right after your morning coffee (habit stacking)",
    "Track mood before/after to see personal benefits"
  ],
  "difficultyAssessment": "beginner",
  "estimatedTimeMinutes": 10,
  "scientificBacking": "Meta-analysis of 47 RCTs shows 8 weeks of meditation reduces anxiety by 30% (JAMA Internal Medicine, 2014)",
  "commonPitfalls": [
    "Expecting immediate results - benefits compound over weeks",
    "Judging yourself for 'bad' sessions - all practice counts",
    "Skipping when stressed - that's when you need it most"
  ]
}

Make it inspiring, evidence-based, and actionable!`}e.s(["coachBriefingSchema",0,{type:"object",properties:{greeting:{type:"string"},focus:{type:"string"},quote:{type:"string"},energyForecast:{type:"string",enum:["low","medium","high"]},streaksAtRisk:{type:"array",items:{type:"string"}},quickWins:{type:"array",items:{type:"string"}},goalsDeadline:{type:"string"},weekMomentum:{type:"string",enum:["up","down","stable"]}},required:["greeting","focus","quote"]},"habitDescriptionSchema",0,{type:"object",properties:{description:{type:"string"},benefits:{type:"array",items:{type:"string"},minItems:3,maxItems:5},tips:{type:"array",items:{type:"string"},minItems:3,maxItems:5},difficultyAssessment:{type:"string",enum:["beginner","intermediate","advanced"]},estimatedTimeMinutes:{type:"number"},scientificBacking:{type:"string"},commonPitfalls:{type:"array",items:{type:"string"},maxItems:3}},required:["description","benefits","tips","difficultyAssessment","estimatedTimeMinutes"]},"habitRecommendationSchema",0,t,"habitStackingSchema",0,r,"milestoneGenerationSchema",0,i,"quotePersonalizationSchema",0,a,"subtaskGenerationSchema",0,{type:"object",properties:{subtasks:{type:"array",items:{type:"string"},minItems:3,maxItems:5}},required:["subtasks"]},"taskPrioritySchema",0,{type:"object",properties:{taskId:{type:"string"},suggestedPriority:{type:"string",enum:["low","medium","high"]},reasoning:{type:"string"},estimatedDuration:{type:"string"},bestTimeSlot:{type:"string"},dependencies:{type:"array",items:{type:"string"}},urgencyScore:{type:"number",minimum:0,maximum:100}},required:["taskId","suggestedPriority","reasoning","urgencyScore"]}],16828),e.s(["buildCoachPrompt",()=>n,"buildHabitDescriptionPrompt",()=>p,"buildHabitRecommendationPrompt",()=>o,"buildHabitStackingPrompt",()=>d,"buildMilestoneGenerationPrompt",()=>c,"buildPrioritizePrompt",()=>s,"buildQuotePersonalizationPrompt",()=>u,"buildSubtaskPrompt",()=>l],73486)},19251,e=>{"use strict";var t=e.i(47909),i=e.i(74017),r=e.i(96250),a=e.i(59756),n=e.i(61916),s=e.i(74677),o=e.i(69741),l=e.i(16795),c=e.i(87718),d=e.i(95169),u=e.i(47587),p=e.i(66012),m=e.i(70101),g=e.i(26937),h=e.i(10372),y=e.i(93695);e.i(52474);var b=e.i(5232),f=e.i(89171),x=e.i(90706),v=e.i(16828),k=e.i(73486);async function w(e){try{let t;try{t=await e.json()}catch(e){return f.NextResponse.json({error:"Invalid request body"},{status:400})}let i=t;if(!i.userContext||!i.userContext.userName)return f.NextResponse.json({error:"User context is required"},{status:400});let r=new x.HabitFlowAI("dashboard"),a=(0,k.buildQuotePersonalizationPrompt)(i),n=i.userContext.currentMood||"neutral",s=i.context||"general",o=new Date().toDateString(),l=`quote:${i.userContext.userName}:${n}:${s}:${o}`,c=await r.generate("motivate",a,v.quotePersonalizationSchema,i.forceRefresh?void 0:l,21600);return f.NextResponse.json(c)}catch(t){console.error("Quote Personalization Route Error:",t);let e=t.message?.includes("429")||t.message?.includes("quota")||t.message?.includes("rate limit");return f.NextResponse.json({error:e?"AI quota exceeded. Try again later.":"Failed to generate personalized quote",details:t.message||"Unknown error",isRateLimit:e},{status:e?429:500})}}e.s(["POST",()=>w],26321);var R=e.i(26321);let $=new t.AppRouteRouteModule({definition:{kind:i.RouteKind.APP_ROUTE,page:"/api/ai/personalize-quote/route",pathname:"/api/ai/personalize-quote",filename:"route",bundlePath:""},distDir:".next",relativeProjectDir:"",resolvedPagePath:"[project]/src/app/api/ai/personalize-quote/route.ts",nextConfigOutput:"",userland:R}),{workAsyncStorage:S,workUnitAsyncStorage:I,serverHooks:C}=$;function q(){return(0,r.patchFetch)({workAsyncStorage:S,workUnitAsyncStorage:I})}async function P(e,t,r){$.isDev&&(0,a.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let f="/api/ai/personalize-quote/route";f=f.replace(/\/index$/,"")||"/";let x=await $.prepare(e,t,{srcPage:f,multiZoneDraftMode:!1});if(!x)return t.statusCode=400,t.end("Bad Request"),null==r.waitUntil||r.waitUntil.call(r,Promise.resolve()),null;let{buildId:v,params:k,nextConfig:w,parsedUrl:R,isDraftMode:S,prerenderManifest:I,routerServerContext:C,isOnDemandRevalidate:q,revalidateOnlyGenerated:P,resolvedPathname:T,clientReferenceManifest:A,serverActionsManifest:E}=x,j=(0,o.normalizeAppPath)(f),D=!!(I.dynamicRoutes[j]||I.routes[T]),N=async()=>((null==C?void 0:C.render404)?await C.render404(e,t,R,!1):t.end("This page could not be found"),null);if(D&&!S){let e=!!I.routes[T],t=I.dynamicRoutes[j];if(t&&!1===t.fallback&&!e){if(w.experimental.adapterPath)return await N();throw new y.NoFallbackError}}let M=null;!D||$.isDev||S||(M="/index"===(M=T)?"/":M);let H=!0===$.isDev||!D,O=D&&!H;E&&A&&(0,s.setManifestsSingleton)({page:f,clientReferenceManifest:A,serverActionsManifest:E});let _=e.method||"GET",U=(0,n.getTracer)(),B=U.getActiveScopeSpan(),W={params:k,prerenderManifest:I,renderOpts:{experimental:{authInterrupts:!!w.experimental.authInterrupts},cacheComponents:!!w.cacheComponents,supportsDynamicResponse:H,incrementalCache:(0,a.getRequestMeta)(e,"incrementalCache"),cacheLifeProfiles:w.cacheLife,waitUntil:r.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,i,r,a)=>$.onRequestError(e,t,r,a,C)},sharedContext:{buildId:v}},z=new l.NodeNextRequest(e),G=new l.NodeNextResponse(t),L=c.NextRequestAdapter.fromNodeNextRequest(z,(0,c.signalFromNodeResponse)(t));try{let s=async e=>$.handle(L,W).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let i=U.getRootSpanAttributes();if(!i)return;if(i.get("next.span_type")!==d.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${i.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let r=i.get("next.route");if(r){let t=`${_} ${r}`;e.setAttributes({"next.route":r,"http.route":r,"next.span_name":t}),e.updateName(t)}else e.updateName(`${_} ${f}`)}),o=!!(0,a.getRequestMeta)(e,"minimalMode"),l=async a=>{var n,l;let c=async({previousCacheEntry:i})=>{try{if(!o&&q&&P&&!i)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let n=await s(a);e.fetchMetrics=W.renderOpts.fetchMetrics;let l=W.renderOpts.pendingWaitUntil;l&&r.waitUntil&&(r.waitUntil(l),l=void 0);let c=W.renderOpts.collectedTags;if(!D)return await (0,p.sendResponse)(z,G,n,W.renderOpts.pendingWaitUntil),null;{let e=await n.blob(),t=(0,m.toNodeOutgoingHttpHeaders)(n.headers);c&&(t[h.NEXT_CACHE_TAGS_HEADER]=c),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let i=void 0!==W.renderOpts.collectedRevalidate&&!(W.renderOpts.collectedRevalidate>=h.INFINITE_CACHE)&&W.renderOpts.collectedRevalidate,r=void 0===W.renderOpts.collectedExpire||W.renderOpts.collectedExpire>=h.INFINITE_CACHE?void 0:W.renderOpts.collectedExpire;return{value:{kind:b.CachedRouteKind.APP_ROUTE,status:n.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:i,expire:r}}}}catch(t){throw(null==i?void 0:i.isStale)&&await $.onRequestError(e,t,{routerKind:"App Router",routePath:f,routeType:"route",revalidateReason:(0,u.getRevalidateReason)({isStaticGeneration:O,isOnDemandRevalidate:q})},!1,C),t}},d=await $.handleResponse({req:e,nextConfig:w,cacheKey:M,routeKind:i.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:I,isRoutePPREnabled:!1,isOnDemandRevalidate:q,revalidateOnlyGenerated:P,responseGenerator:c,waitUntil:r.waitUntil,isMinimalMode:o});if(!D)return null;if((null==d||null==(n=d.value)?void 0:n.kind)!==b.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==d||null==(l=d.value)?void 0:l.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});o||t.setHeader("x-nextjs-cache",q?"REVALIDATED":d.isMiss?"MISS":d.isStale?"STALE":"HIT"),S&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let y=(0,m.fromNodeOutgoingHttpHeaders)(d.value.headers);return o&&D||y.delete(h.NEXT_CACHE_TAGS_HEADER),!d.cacheControl||t.getHeader("Cache-Control")||y.get("Cache-Control")||y.set("Cache-Control",(0,g.getCacheControlHeader)(d.cacheControl)),await (0,p.sendResponse)(z,G,new Response(d.value.body,{headers:y,status:d.value.status||200})),null};B?await l(B):await U.withPropagatedContext(e.headers,()=>U.trace(d.BaseServerSpan.handleRequest,{spanName:`${_} ${f}`,kind:n.SpanKind.SERVER,attributes:{"http.method":_,"http.target":e.url}},l))}catch(t){if(t instanceof y.NoFallbackError||await $.onRequestError(e,t,{routerKind:"App Router",routePath:j,routeType:"route",revalidateReason:(0,u.getRevalidateReason)({isStaticGeneration:O,isOnDemandRevalidate:q})},!1,C),D)throw t;return await (0,p.sendResponse)(z,G,new Response(null,{status:500})),null}}e.s(["handler",()=>P,"patchFetch",()=>q,"routeModule",()=>$,"serverHooks",()=>C,"workAsyncStorage",()=>S,"workUnitAsyncStorage",()=>I],19251)},85685,e=>{e.v(e=>Promise.resolve().then(()=>e(54799)))},91961,e=>{e.v(t=>Promise.all(["server/chunks/[root-of-the-server]__c130a00c._.js"].map(t=>e.l(t))).then(()=>t(12111)))},72331,e=>{e.v(t=>Promise.all(["server/chunks/[root-of-the-server]__ec3cd4cb._.js","server/chunks/[root-of-the-server]__c08a7b0d._.js","server/chunks/[root-of-the-server]__5ddcde7c._.js"].map(t=>e.l(t))).then(()=>t(20442)))}];

//# sourceMappingURL=%5Broot-of-the-server%5D__78c891cc._.js.map