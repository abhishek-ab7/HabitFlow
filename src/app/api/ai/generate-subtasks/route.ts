import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || '');

export async function POST(req: NextRequest) {
    try {
        const { title, description } = await req.json();

        if (!process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
            return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });
        }

        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

        const prompt = `
      Break down the following task into 3-5 actionable subtasks.
      Task Title: ${title}
      Task Description: ${description || ''}
      
      Return ONLY a JSON array of strings, e.g., ["Subtask 1", "Subtask 2"].
      Do not include markdown formatting or backticks.
    `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Clean up if markdown is returned despite instructions
        const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();

        const subtasks = JSON.parse(cleanedText);

        return NextResponse.json({ subtasks });
    } catch (error: any) {
        console.error('AI Generation Error:', error);
        return NextResponse.json({ error: 'Failed to generate subtasks' }, { status: 500 });
    }
}
