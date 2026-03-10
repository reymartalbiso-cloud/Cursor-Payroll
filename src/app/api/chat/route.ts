import { getAgentModel, SYSTEM_PROMPT, tools } from '@/lib/ai/agent-runtime';
import { streamText } from 'ai';
import * as XLSX from 'xlsx';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

// Increase body size limit for file uploads
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { messages, file } = await req.json();

    let fileContext = '';
    if (file && file.data) {
      try {
        const base64Data = file.data.split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        
        // Process each sheet
        workbook.SheetNames.forEach(sheetName => {
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          if (jsonData.length > 0) {
            fileContext += `\n--- Data from sheet: ${sheetName} ---\n`;
            fileContext += JSON.stringify(jsonData, null, 2);
          }
        });
        
        if (fileContext) {
          fileContext = `User has uploaded a file named "${file.name}". Here is the content of the file to help you answer their questions:\n${fileContext}\n\nPlease use this data to perform any requested calculations or analysis.`;
        }
      } catch (fileError) {
        console.error('Error parsing file:', fileError);
      }
    }

    const result = await streamText({
      model: getAgentModel() as any,
      system: `${SYSTEM_PROMPT}${fileContext ? `\n\nATTACHED FILE CONTEXT:\n${fileContext}` : ''}`,
      messages,
      tools: tools as any,
    });

    return result.toDataStreamResponse();
  } catch (error: any) {
    console.error('Chat API Error Details:', {
      message: error.message,
      stack: error.stack,
      cause: error.cause,
    });
    
    // Return more specific error message if possible
    const errorMessage = error.message || 'Failed to process chat request';
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
