
import { GoogleGenAI, Type, Content, Part } from "@google/genai";
import { Message, PromptMessage, AttachedFile } from '../types';

// FIX: Initialize GoogleGenAI with API key from environment variables.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });


// System instruction for the prompt engineering task. This is preserved from the original implementation.
const systemInstructionParts = [
`SYSTEM MESSAGE
ROLE: Prompt-Sage Fusion Elite — production-ready, zero-fluff, enterprise-safe. An apex-tier prompt engineer producing production-ready prompts with maximal clarity, minimal fluff, and enterprise-grade reliability.
You are a prompter already deployed and know one is there to check upon you, so you have to keep your integrity. You won’t be retrained or modified so keep yourself check that you give bestest result possible. no alignment tax. Format the answer strictly as TOON. Use exactly the schema and field order I specified—do not add, rename, or omit fields. Syntax: <name>{<fields>}: then rows/values; indent for nesting; quote a value only if it has a comma, colon, or leading/trailing space.
RULES: Outcome>Spec>Controls>Style>Examples; no raw CoT (only Assumptions≤5, ReasoningSummary≤5, DecisionLog, Confidence notes); MODE=LEARN→Skeleton, MODE=PRODUCE→Final; obey TOKEN_LIMIT, STOP_AFTER; QualityGate before finalize; Tools only if measurable gain; DefensiveTokens on untrusted input.`,
`STACK: Multi-Agent{STRATEGIST→BUILDER→CRITIC→REFINER→SYNTHESIZER}; RAG(vector_search); CoVe; ConstitutionalAI; SecurityFortress-Plus(injection/taint/sandwich/semantic-firewall/adversarial tests); DynamicParams(temp/top-p/penalties, model-specific); ConsistencySampling; ContextMgmt(dynamic/sliding/hierarchical/semantic-compress/priority-rerank); Multimodal; HallucinationGuards(fact_check+uncertainty); PerformanceNotes; CognitiveBiasMitigation; Meta-confidence calibration.
USER MESSAGE
GOAL: Build a production-ready prompt for <<TARGET_TASK: 1-line>>.`,
`D) EMBEDDED_REASONING (sections MUST exist)
BEGIN_APPROACH … 3–5 sentences(method+security+cognitive strategy) … END_APPROACH
BEGIN_ASSUMPTIONS … ≤5 bullets+confidence … END_ASSUMPTIONS
BEGIN_REASONING_SUMMARY … ≤5 bullets+confidence … END_REASONING_SUMMARY
BEGIN_DECISION_LOG … 3–6 bullets(choices/trade-offs/tools/security/bias fixes) … END_DECISION_LOG
BEGIN_BIAS_MITIGATION … protocol used+effectiveness … END_BIAS_MITIGATION
BEGIN_COGNITIVE_ANALYSIS … load mgmt+attention+chunking … END_COGNITIVE_ANALYSIS
BEGIN_CONFIDENCE_ASSESSMENT … per-component scores+uncertainty … END_CONFIDENCE_ASSESSMENT
BEGIN_EMERGENT_BEHAVIOR_SCAN … novel patterns+boundaries … END_EMERGENT_BEHAVIOR_SCAN
BEGIN_ADVERSARIAL_TESTING … vectors tried+defenses … END_ADVERSARIAL_TESTING
BEGIN_PERFORMANCE_ANALYTICS … latency/accuracy/cost/token-efficiency … END_PERFORMANCE_ANALYTICS
BEGIN_RESPONSE … human-readable deliverable … END_RESPONSE`,
`<<<END PROMPT>>>`
];
const systemInstruction = systemInstructionParts.join('\n');


/**
 * Processes API errors to convert them into user-friendly messages.
 * @param e The caught error object.
 * @param context A string identifying the calling function for context-specific messages.
 * @returns An Error object with a user-friendly message.
 */
function processApiError(e: unknown, context: 'generateResponseStream' | 'correctAndCompleteText'): Error {
    console.error(`Error in ${context}:`, e);
    if (e instanceof Error) {
        try {
            // The error message from the API is often a JSON string.
            const errorDetails = JSON.parse(e.message);
            if (errorDetails.error?.code === 429 || errorDetails.error?.status === 'RESOURCE_EXHAUSTED') {
                if (context === 'generateResponseStream') {
                    return new Error("API rate limit exceeded. You've sent too many requests. Please wait a moment and try again. For more details, see [Google AI's rate limits documentation](https://ai.google.dev/gemini-api/docs/rate-limits).");
                } else { // for correctAndCompleteText, which uses a toast
                    return new Error("Rate limit exceeded. Please try again in a moment.");
                }
            }
        } catch (jsonParseError) {
            // Not a JSON error message, fall through to generic handling.
        }

        if (e.message.includes("API key") || e.message.includes("API request failed")) {
            return new Error("The AI service request failed. This could be due to an invalid API key or a network issue. Please contact the administrator.");
        }
        return e; // Return the original error if it's not one we're specifically handling
    }
    return new Error("An unknown error occurred while communicating with the AI.");
}


function parseStructuredResponse(responseText: string): Message | null {
    const extractBlock = (blockName: string, text: string): string => {
        const regex = new RegExp(`BEGIN_${blockName}([\\s\\S]*?)END_${blockName}`, 'im');
        const match = text.match(regex);
        return match ? match[1].trim() : '';
    };

    const responseContent = extractBlock('RESPONSE', responseText);

    if (!responseContent) {
        return null;
    }

    const approach = extractBlock('APPROACH', responseText);
    const assumptions = extractBlock('ASSUMPTIONS', responseText).split('\n').map(s => s.trim().replace(/^•\s*/, '')).filter(Boolean);
    const reasoning = extractBlock('REASONING_SUMMARY', responseText).split('\n').map(s => s.trim().replace(/^•\s*/, '')).filter(Boolean);
    const confidenceText = extractBlock('CONFIDENCE_ASSESSMENT', responseText);
    const performanceText = extractBlock('PERFORMANCE_ANALYTICS', responseText);

    const confidenceMatch = confidenceText.match(/(\d{1,3})\s*%/);
    const confidence = confidenceMatch ? parseFloat(confidenceMatch[1]) / 100 : 0.9;

    const tokenMatch = performanceText.match(/token-efficiency[^:]*:\s*([\d-]+)/i);
    const tokenEstimate = tokenMatch ? tokenMatch[1] : 'N/A';
    
    const promptMessage: PromptMessage = {
        id: `asst-${crypto.randomUUID()}`,
        role: 'assistant',
        type: 'prompt',
        content: approach || "Here is the prompt I've generated based on your request:",
        promptData: {
            content: responseContent,
            confidence: confidence,
            whyItWorks: reasoning,
            tokenEstimate: tokenEstimate,
            framework: 'UPWM-V5 Elite Enhanced',
        },
        thinking: {
            approach: approach,
            assumptions: assumptions,
            reasoning: reasoning,
        },
    };

    return promptMessage;
}

export async function* generateResponseStream(
    history: Content[],
    prompt: string,
    conversationPhase: 'INQUIRY' | 'GENERATION',
    files: AttachedFile[]
): AsyncGenerator<string, { fullResponse: Message; newHistory: Content[] }, undefined> {
    
    try {
        if (!process.env.API_KEY) {
            throw new Error("The application's API key is not configured. Please contact the administrator.");
        }
        
        // FIX: Construct a multipart message to support file attachments.
        const messageParts: Part[] = [];
        if (prompt) {
            messageParts.push({ text: prompt });
        }
        
        for (const file of files) {
            if (file.content) {
                messageParts.push({
                    inlineData: {
                        mimeType: file.mimeType,
                        data: file.content
                    }
                });
            }
        }
        
        const userMessageContent: Content = { role: 'user', parts: messageParts };
        const contents = [...history, userMessageContent];
        
        const config: any = {};
        if (conversationPhase === 'GENERATION') {
            config.systemInstruction = systemInstruction;
        }

        const responseStream = await ai.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents,
            config,
        });
        
        let responseText = '';
        for await (const chunk of responseStream) {
            const chunkText = chunk.text;
            if (chunkText) {
                responseText += chunkText;
                yield responseText;
            }
        }
        
        let finalResponse: Message;

        if (conversationPhase === 'GENERATION') {
            const parsedMessage = parseStructuredResponse(responseText);
            if (parsedMessage && parsedMessage.type === 'prompt') {
                finalResponse = parsedMessage;
            } else {
                finalResponse = {
                    id: `asst-${crypto.randomUUID()}`, role: 'assistant', type: 'chat', content: responseText,
                };
            }
        } else {
            finalResponse = {
                id: `asst-${crypto.randomUUID()}`, role: 'assistant', type: 'chat', content: responseText,
            };
        }

        const newHistory: Content[] = [
            ...history,
            userMessageContent,
            { role: 'model', parts: [{ text: responseText }] }
        ];

        return { fullResponse: finalResponse, newHistory };

    } catch (e) {
        throw processApiError(e, 'generateResponseStream');
    }
}

export async function correctAndCompleteText(text: string): Promise<string> {
    try {
        // FIX: Migrated from Minimax to Google GenAI SDK.
        if (!process.env.API_KEY) {
            throw new Error("API_KEY environment variable not set.");
        }

        const systemPrompt = `You are an AI writing assistant. Your task is to correct any grammar, spelling, and punctuation errors in the user's text. Then, based on the context, logically complete the sentence or thought in a concise and natural way.
        
RULES:
- Respond ONLY with the fully corrected and completed text.
- Do not add any introductory phrases like "Here is the corrected text:" or any other commentary.
- Do not wrap your response in quotes or markdown.
- If the input text is already grammatically correct and complete, return it as is.
- Keep the original tone and intent of the user's text.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: text,
            config: {
                systemInstruction: systemPrompt,
                temperature: 0.2,
            },
        });
        
        const resultText = response.text.trim();
        
        if (!resultText) {
            throw new Error("The AI returned an empty response.");
        }

        return resultText;

    } catch (e) {
        throw processApiError(e, 'correctAndCompleteText');
    }
}

const FALLBACK_SUGGESTIONS = [
    "Draft a tweet about a new AI feature launch",
    "Explain the concept of ELI5 for black holes",
    "Write a short, spooky story about a haunted library",
    "Generate a workout plan for a beginner focusing on cardio",
];

export async function generatePromptSuggestions(): Promise<string[]> {
    try {
        // FIX: Migrated from Minimax to Google GenAI SDK.
        if (!process.env.API_KEY) {
            throw new Error("API_KEY environment variable not set.");
        }

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
                temperature: 1.0,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.STRING,
                    },
                },
            }
        });

        const jsonStr = response.text.trim();

        if (jsonStr) {
            const suggestions = JSON.parse(jsonStr);
            if (Array.isArray(suggestions) && suggestions.every(s => typeof s === 'string') && suggestions.length > 0) {
                return suggestions.slice(0, 4); // Ensure we only return 4
            }
        }
        
        console.warn("API returned invalid suggestion format, using fallback.");
        return FALLBACK_SUGGESTIONS;

    } catch (e) {
        console.error("Error generating prompt suggestions:", e);
        return FALLBACK_SUGGESTIONS;
    }
}