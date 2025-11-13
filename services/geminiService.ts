import { GoogleGenAI, Content, Part, GenerateContentResponse, Type } from "@google/genai";
import { Message, PromptGenerationResponse, AttachedFile } from '../types';

// Type guard to validate the structure of the API's JSON response
function isPromptGenerationResponse(obj: any): obj is PromptGenerationResponse {
    return (
        obj &&
        typeof obj.content === 'string' &&
        typeof obj.promptData === 'object' &&
        obj.promptData !== null &&
        typeof obj.promptData.content === 'string' &&
        typeof obj.promptData.confidence === 'number' &&
        Array.isArray(obj.promptData.whyItWorks) &&
        typeof obj.promptData.tokenEstimate === 'string' &&
        typeof obj.promptData.framework === 'string' &&
        typeof obj.thinking === 'object' &&
        obj.thinking !== null &&
        typeof obj.thinking.approach === 'string' &&
        Array.isArray(obj.thinking.assumptions) &&
        Array.isArray(obj.thinking.reasoning)
    );
}


// FIX: Simplified system instruction to prevent leaking internal reasoning and improve reliability.
const systemInstruction = `You are an expert prompt engineer. Your task is to generate a production-ready prompt based on the user's request.
You MUST respond with a single JSON object in a markdown code block (\`\`\`json).

The JSON object must have the following structure:
{
  "content": "The user-facing message from you, the assistant.",
  "promptData": {
    "content": "The final, production-ready prompt.",
    "confidence": 0.95,
    "whyItWorks": ["Reason 1", "Reason 2"],
    "tokenEstimate": "50-100",
    "framework": "CEM"
  },
  "thinking": {
    "approach": "A brief summary of the approach taken.",
    "assumptions": ["Assumption 1", "Assumption 2"],
    "reasoning": ["Reasoning point 1", "Reasoning point 2"]
  }
}

First, if the user's request is ambiguous or lacks detail, you MUST ask up to 3 clarifying questions in a conversational chat format. To do this, just provide the question as a plain text response, not in the JSON format.

Once you have enough information, generate the complete JSON object as described above. Do not include any text outside of the JSON markdown block. Ensure the JSON is well-formed.

Maintain a professional, clear, and consistent tone in all generated content. Proofread for grammatical correctness.
When generating examples or content, strictly use the information, items, or context provided by the user. Do not introduce new, external examples unless explicitly asked.`;

// This function determines which API key to use.
// It prioritizes a user-provided key from localStorage.
function getApiKey(): string | null {
    const userApiKey = localStorage.getItem('gemini-api-key');
    if (userApiKey && userApiKey.trim() !== '') {
        return userApiKey.trim();
    }
    // Fallback to environment variable if available
    return process.env.API_KEY || null;
}


export async function* generateResponseStream(
    history: Content[],
    prompt: string,
    conversationPhase: 'INQUIRY' | 'GENERATION',
    files: AttachedFile[]
): AsyncGenerator<string, { fullResponse: Message; newHistory: Content[] }, undefined> {
    
    try {
        const apiKey = getApiKey();
        if (!apiKey) {
            // Updated error message to be more user-friendly and actionable.
            throw new Error("The Gemini API key is missing. Please add your key in the settings to continue.");
        }
        
        // Always create a new instance to ensure the latest key is used.
        const ai = new GoogleGenAI({ apiKey });
        
        const fileParts: Part[] = files
            .filter(file => !file.isLoading && file.content)
            .map(file => ({
                inlineData: {
                    mimeType: file.mimeType,
                    data: file.content
                }
            }));

        const userMessageContent: Content = {
            role: 'user',
            parts: [{ text: prompt }, ...fileParts]
        };
        
        const contents: Content[] = [...history, userMessageContent];

        const stream = await ai.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents: contents,
            config: {
                systemInstruction: systemInstruction,
            },
        });

        let responseText = '';
        for await (const chunk of stream) {
            const chunkText = chunk.text;
            if (chunkText) {
                responseText += chunkText;
                yield responseText;
            }
        }
        
        let finalResponse: Message;

        if (conversationPhase === 'GENERATION') {
            try {
                const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/s);
                if (!jsonMatch) {
                    // This can happen if the model asks a clarifying question even in GENERATION phase. Treat as chat.
                     finalResponse = {
                        id: `asst-${crypto.randomUUID()}`,
                        role: 'assistant',
                        type: 'chat',
                        content: responseText,
                    };
                } else {
                    const jsonString = jsonMatch[1].trim();
                    const parsedJson = JSON.parse(jsonString);

                    if (isPromptGenerationResponse(parsedJson)) {
                        finalResponse = {
                            id: `asst-${crypto.randomUUID()}`,
                            role: 'assistant',
                            type: 'prompt',
                            content: parsedJson.content,
                            promptData: parsedJson.promptData,
                            thinking: parsedJson.thinking,
                        };
                    } else {
                        throw new Error("Response JSON does not match expected structure.");
                    }
                }
            } catch (error) {
                console.error("Failed to parse AI JSON response:", error, "Raw response text:", responseText);
                // CRITICAL FIX: Do not leak the raw responseText to the user.
                finalResponse = {
                    id: `asst-${crypto.randomUUID()}`,
                    role: 'assistant',
                    type: 'chat',
                    content: `I tried to generate a structured prompt, but an error occurred. Please try rephrasing your request.`,
                };
            }
        } else {
            finalResponse = {
                id: `asst-${crypto.randomUUID()}`,
                role: 'assistant',
                type: 'chat',
                content: responseText,
            };
        }

        const newHistory: Content[] = [
            ...contents,
            {
                role: 'model',
                parts: [{ text: responseText }]
            }
        ];

        return { fullResponse: finalResponse, newHistory };

    } catch (e) {
        console.error("Error in generateResponseStream:", e);
        if (e instanceof Error) {
            // Provide more specific feedback for common API key-related errors.
            if (e.message.includes("API key not valid") || e.message.includes("invalid api key")) {
                 throw new Error("The provided Gemini API key is invalid. Please check the key in settings and try again.");
            }
            if (e.message.includes("API key is missing")) { // Our custom error
                 throw e;
            }
            // For other Google API errors, pass them through but simplify
            if (e.message.includes('[GoogleGenerativeAI Error]')) {
                const cleanMessage = e.message.split(' reason: ')[1] || 'An error occurred with the AI service.';
                throw new Error(cleanMessage);
            }
            throw e;
        }
        throw new Error("An unknown error occurred while communicating with the AI.");
    }
}

export async function correctAndCompleteText(text: string): Promise<string> {
    try {
        const apiKey = getApiKey();
        if (!apiKey) {
            throw new Error("The Gemini API key is missing. Please add your key in the settings to continue.");
        }

        const ai = new GoogleGenAI({ apiKey });

        const systemInstruction = `You are an AI writing assistant. Your task is to correct any grammar, spelling, and punctuation errors in the user's text. Then, based on the context, logically complete the sentence or thought in a concise and natural way.
        
RULES:
- Respond ONLY with the fully corrected and completed text.
- Do not add any introductory phrases like "Here is the corrected text:" or any other commentary.
- Do not wrap your response in quotes or markdown.
- If the input text is already grammatically correct and complete, return it as is.
- Keep the original tone and intent of the user's text.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text }] }],
            config: {
                systemInstruction: systemInstruction,
                temperature: 0.2, 
            },
        });

        const resultText = response.text.trim();
        
        if (!resultText) {
            throw new Error("The AI returned an empty response.");
        }

        return resultText;

    } catch (e) {
        console.error("Error in correctAndCompleteText:", e);
        if (e instanceof Error) {
            // Re-throw with a user-friendly message
            if (e.message.includes("API key")) {
                 throw new Error("Could not perform text correction due to an API key issue. Please check your settings.");
            }
            throw new Error("Failed to correct text. Please try again.");
        }
        throw new Error("An unknown error occurred while correcting the text.");
    }
}

// Fallback suggestions in case the API call fails
const FALLBACK_SUGGESTIONS = [
    "Draft a tweet about a new AI feature launch",
    "Explain the concept of ELI5 for black holes",
    "Write a short, spooky story about a haunted library",
    "Generate a workout plan for a beginner focusing on cardio",
];

export async function generatePromptSuggestions(): Promise<string[]> {
    try {
        const apiKey = getApiKey();
        if (!apiKey) {
            // No key, just return fallback without logging an error.
            return FALLBACK_SUGGESTIONS;
        }

        const ai = new GoogleGenAI({ apiKey });

        const metaPrompt = `You are an idea generator for an AI prompt builder. Your task is to produce exactly 4 distinct prompt ideas that will inspire users to try new things.
        
REQUIREMENTS:
1.  **Variety**: Cover a mix of categories: one creative/fictional, one educational/explanatory, one practical/productivity, and one fun/whimsical.
2.  **Conciseness**: Each idea must be a single sentence and fewer than 15 words.
3.  **Originality**: Do not repeat common clichés. Aim to surprise and delight.
4.  **Format**: You MUST respond with ONLY a valid JSON array of strings. Do not include any other text, markdown, or explanation.
    
Example response:
["Invent a new flavor of ice cream", "Explain how photosynthesis works to a child", "Draft an email to reschedule a meeting", "Describe a superhero whose only power is making perfect toast"]`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: metaPrompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                },
                temperature: 1.0, // Higher temperature for more creative/varied suggestions
            },
        });

        // The response text should be a JSON string based on the schema
        let jsonStr = response.text.trim();
        const suggestions = JSON.parse(jsonStr);
        
        if (Array.isArray(suggestions) && suggestions.every(s => typeof s === 'string') && suggestions.length > 0) {
            return suggestions.slice(0, 4); // Ensure we only return 4
        }
        
        // If parsing fails or the structure is wrong, fall back.
        console.warn("API returned invalid suggestion format, using fallback.");
        return FALLBACK_SUGGESTIONS;

    } catch (e) {
        console.error("Error generating prompt suggestions:", e);
        // On any error, return the reliable fallback list.
        return FALLBACK_SUGGESTIONS;
    }
}