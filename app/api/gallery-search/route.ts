// File: app/api/gallery-search/route.ts
// Dependency Requirement: Execute `npm install openai` in the project root.

import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { portfolioProjects } from '@/lib/data';

// Instantiate the AI client. 
// SECURITY NOTE: Vercel handles the secure injection of process.env.OPENAI_API_KEY.
// This key must NEVER be exposed to the frontend React components.
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY |

| '', 
});

export async function POST(request: Request) {
  try {
    // 1. Initial Payload Validation
    // Prevents malformed requests from crashing the server parser.
    if (!request.body) {
      return NextResponse.json(
        { success: false, error: "Critical Error: Empty request body provided to API." }, 
        { status: 400 }
      );
    }

    const body = await request.json();
    const { query } = body;

    // Validate that the query is a valid, non-empty string.
    if (!query |

| typeof query!== 'string' |
| query.trim() === '') {
      return NextResponse.json(
        { success: false, error: "Validation Error: Invalid or empty search query." }, 
        { status: 400 }
      );
    }

    // 2. Environment Configuration Validation
    // This entirely prevents the silent Vercel runtime crashes that halt deployments.
    if (!process.env.OPENAI_API_KEY) {
      console.error("DEPLOYMENT ERROR: OPENAI_API_KEY environment variable is entirely missing from Vercel.");
      return NextResponse.json(
        { success: false, error: "Server infrastructure error. AI routing service is currently unavailable." }, 
        { status: 500 }
      );
    }

    // 3. Data Sanitization and Token Optimization
    // We strip out large URLs and images before sending data to the AI to save token costs
    // and drastically reduce processing latency.
    const sanitizedProjects = portfolioProjects.map(p => ({
      id: p.id,
      title: p.title,
      description: p.description,
      technologies: p.technologies
    }));

    // 4. Deterministic AI Execution
    // We force the AI into 'json_object' mode. This guarantees the output can be parsed programmatically.
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo-0125", // Selected for exceptional speed and low cost in routing tasks
      response_format: { type: "json_object" },
      messages:. Do not include conversational text or markdown formatting outside of the JSON object.`
        },
        {
          role: "user",
          content: `Project Database: ${JSON.stringify(sanitizedProjects)}\n\nUser Query: "${query}"`
        }
      ],
      temperature: 0.05, // Extremely low temperature ensures highly deterministic, logical matching without hallucinations.
      max_tokens: 200,   // Strict token limit prevents the AI from hanging the serverless function.
    });

    // 5. Response Parsing and Validation
    const aiResponseContent = completion.choices?.message?.content;
    
    if (!aiResponseContent) {
        throw new Error("Upstream Error: OpenAI returned an empty or malformed payload.");
    }

    const parsedResponse = JSON.parse(aiResponseContent);

    // Strict type checking of the AI's output before trusting it.
    if (!Array.isArray(parsedResponse.matchedIds)) {
        throw new Error("Data Integrity Error: AI response format invalid. 'matchedIds' array missing.");
    }

    // 6. Successful Network Resolution
    return NextResponse.json({
      success: true,
      matchedIds: parsedResponse.matchedIds
    }, { status: 200 });

  } catch (error: any) {
    // 7. Global Error Interception
    // This is the most critical block. It ensures the API NEVER hangs silently, regardless of the failure mode.
    console.error("AI Search Orchestration Error:", error.message |

| error);
    
    // Specifically intercept HTTP 429 Rate Limits from OpenAI to inform the user accurately.
    if (error?.status === 429) {
      return NextResponse.json(
        { success: false, error: "The AI service is currently experiencing high traffic. Please try again in a few moments." }, 
        { status: 429 }
      );
    }

    // Generic fallback for all other unhandled exceptions.
    return NextResponse.json({ 
      success: false, 
      error: "An internal orchestration error occurred while processing the semantic search." 
    }, { status: 500 });
  }
}
