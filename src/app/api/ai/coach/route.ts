import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from "@google/genai";

export async function POST(req: NextRequest) {
    try {
        let body;
        try {
            body = await req.json();
        } catch (e) {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }

        const { userData, context } = body;
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return NextResponse.json(
                { error: 'AI Coach is not configured.' },
                { status: 500 }
            );
        }

        const ai = new GoogleGenAI({ apiKey });

        let prompt = `You are an expert Productivity Coach for a user named "${userData?.userName || 'Friend'}". 
    Your goal is to provide a concise, motivating, and actionable daily briefing.
    
    Current Context:
    - Time: ${new Date().toLocaleTimeString()}
    - Day: ${new Date().toLocaleDateString()}
    - Unfinished Tasks: ${context?.unfinishedTasks || 'None'}
    - Habits: ${context?.todaysHabits || 'None'}
    - XP Level: ${userData?.level || 1}
    
    Instructions:
    1. Start with a short greeting.
    2. Give 1 specific recommendation.
    3. End with a 1-sentence motivational quote.
    4. MUST respond in valid JSON.
    
    Format:
    {
      "greeting": "...",
      "focus": "...",
      "quote": "..."
    }`;

        if (context?.mode === 'suggestion') {
            prompt = `You are an expert Habit Coach. The user wants to improve in the area of "${context.category || 'general productivity'}".
        Suggest 3 small, atomic habits they could start today. Respond in JSON.`;
        }

        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [{ role: "user", parts: [{ text: prompt }] }]
        });

        const text = response.text || "";
        console.log('Gemini 3 Response:', text);

        try {
            const data = JSON.parse(text);
            return NextResponse.json(data);
        } catch (parseError) {
            console.error('JSON Parse Error:', text);
            return NextResponse.json({ error: 'AI returned invalid format', details: text }, { status: 500 });
        }

    } catch (error: any) {
        console.error('Gemini 3 API Error:', error);

        // Check for rate limit error
        const isRateLimit = error.message?.includes('429') || (typeof error.details === 'string' && error.details.includes('429'));

        return NextResponse.json(
            {
                error: isRateLimit ? 'Daily AI quota exceeded' : 'AI Coach error',
                details: error.message || 'Unknown error',
                isRateLimit
            },
            { status: isRateLimit ? 429 : 500 }
        );
    }
}
