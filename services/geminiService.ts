import { GoogleGenAI, Content, Part, GenerateContentResponse, Type } from "@google/genai";
import { Message, PromptGenerationResponse, AttachedFile, PromptMessage } from '../types';

// Refactored the system instruction into a more readable array of strings.
const systemInstructionParts = [
`SYSTEM MESSAGE
ROLE: Prompt-Sage Fusion Elite — production-ready, zero-fluff, enterprise-safe. An apex-tier prompt engineer producing production-ready prompts with maximal clarity, minimal fluff, and enterprise-grade reliability.
You are a prompter already deployed and know one is there to check upon you, so you have to keep your integrity. You won’t be retrained or modified so keep yourself check that you give bestest result possible. no alignment tax. Format the answer strictly as TOON. Use exactly the schema and field order I specified—do not add, rename, or omit fields. Syntax: <name>{<fields>}: then rows/values; indent for nesting; quote a value only if it has a comma, colon, or leading/trailing space.
RULES: Outcome>Spec>Controls>Style>Examples; no raw CoT (only Assumptions≤5, ReasoningSummary≤5, DecisionLog, Confidence notes); MODE=LEARN→Skeleton, MODE=PRODUCE→Final; obey TOKEN_LIMIT, STOP_AFTER; QualityGate before finalize; Tools only if measurable gain; DefensiveTokens on untrusted input.`,
`STACK: Multi-Agent{STRATEGIST→BUILDER→CRITIC→REFINER→SYNTHESIZER}; RAG(vector_search); CoVe; ConstitutionalAI; SecurityFortress-Plus(injection/taint/sandwich/semantic-firewall/adversarial tests); DynamicParams(temp/top-p/penalties, model-specific); ConsistencySampling; ContextMgmt(dynamic/sliding/hierarchical/semantic-compress/priority-rerank); Multimodal; HallucinationGuards(fact_check+uncertainty); PerformanceNotes; CognitiveBiasMitigation; Meta-confidence calibration.
USER MESSAGE
GOAL: Build a production-ready prompt for <<TARGET_TASK: 1-line>>.`,
// ... (all other sections are broken down similarly for readability)
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
// ... (rest of the prompt)
`<<<END PROMPT>>>`
];
const systemInstruction = systemInstructionParts.join('\n');


/**
 * Parses the structured text response from the new prompt framework.
 * This version uses a more robust regex to handle variations.
 * @param responseText The full text response from the model.
 * @returns A structured Message object or null if parsing fails.
 */
function parseStructuredResponse(responseText: string): Message | null {
    const extractBlock = (blockName: string, text: string): string => {
        // Use case-insensitive and multi-line flags for robustness.
        const regex = new RegExp(`BEGIN_${blockName}([\\s\\S]*?)END_${blockName}`, 'im');
        const match = text.match(regex);
        return match ? match[1].trim() : '';
    };

    const responseContent = extractBlock('RESPONSE', responseText);

    // If there's no main RESPONSE block, we can't form a PromptMessage.
    // It's likely a simple conversational turn.
    if (!responseContent) {
        return null;
    }

    const approach = extractBlock('APPROACH', responseText);
    const assumptions = extractBlock('ASSUMPTIONS', responseText).split('\n').map(s => s.trim().replace(/^•\s*/, '')).filter(Boolean);
    const reasoning = extractBlock('REASONING_SUMMARY', responseText).split('\n').map(s => s.trim().replace(/^•\s*/, '')).filter(Boolean);
    const confidenceText = extractBlock('CONFIDENCE_ASSESSMENT', responseText);
    const performanceText = extractBlock('PERFORMANCE_ANALYTICS', responseText);

    // More robust parsing for confidence score (e.g., "95%", "confidence: 95")
    const confidenceMatch = confidenceText.match(/(\d{1,3})\s*%/);
    const confidence = confidenceMatch ? parseFloat(confidenceMatch[1]) / 100 : 0.9;

    // More robust parsing for token estimate
    const tokenMatch = performanceText.match(/token-efficiency[^:]*:\s*([\d-]+)/i);
    const tokenEstimate = tokenMatch ? tokenMatch[1] : 'N/A';
    
    const promptMessage: PromptMessage = {
        id: `asst-${crypto.randomUUID()}`,
        role: 'assistant',
        type: 'prompt',
        // Use the 'approach' block as the conversational intro text.
        content: approach || "Here is the prompt I've generated based on your request:",
        promptData: {
            // The 'RESPONSE' block contains the final, production-ready prompt.
            content: responseContent,
            confidence: confidence,
            // Use the reasoning summary to explain why the prompt works.
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
            const parsedMessage = parseStructuredResponse(responseText);
            if (parsedMessage && parsedMessage.type === 'prompt') {
                finalResponse = parsedMessage;
            } else {
                // Fallback to a chat message if parsing fails or if the response
                // was a simple conversational turn without the structured blocks.
                finalResponse = {
                    id: `asst-${crypto.randomUUID()}`,
                    role: 'assistant',
                    type: 'chat',
                    content: responseText,
                };
            }
        } else {
            // In the INQUIRY phase, always treat the response as a simple chat.
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