
import { getAgentModel } from '@/lib/ai/agent-runtime';
import { streamText } from 'ai';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mistralai/mistral-7b-instruct:free',
        messages: [{ role: 'user', content: 'Say hi' }],
        stream: false,
      })
    });

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(error.message, { status: 500 });
  }
}
