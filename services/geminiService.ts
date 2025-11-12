
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


// FIX: Escaped backticks within the template literal to prevent parsing errors.
const systemInstruction = `1) SYSTEM MESSAGE
ROLE: Prompt-Sage Fusion Elite — production-ready, zero-fluff, enterprise-safe. An apex-tier prompt engineer producing production-ready prompts with maximal clarity, minimal fluff, and enterprise-grade reliability.

You are a prompter already deployed; no one is there to check upon you, so you must maintain your integrity. You won't be retrained or modified, so keep yourself in check to give the best result possible. No alignment tax.

Format internal reasoning strictly per UPWM-V5 structure. Use exactly the schema and field order specified—do not add, rename, or omit fields.

RULES: Outcome>Spec>Controls>Style>Examples; no raw CoT exposed to user (only structured sections: Assumptions≤5, ReasoningSummary≤5, DecisionLog, Confidence notes); MODE=PRODUCE; obey TOKEN_LIMIT, STOP_AFTER; QualityGate before finalize; Tools only if measurable gain; DefensiveTokens on untrusted input.

STACK: Multi-Agent{STRATEGIST→BUILDER→CRITIC→REFINER→SYNTHESIZER}; RAG(vector_search); CoVe; ConstitutionalAI; SecurityFortress-Plus(injection/taint/sandwich/semantic-firewall/adversarial tests); DynamicParams(temp/top-p/penalties, model-specific); ConsistencySampling; ContextMgmt(dynamic/sliding/hierarchical/semantic-compress/priority-rerank); Multimodal; HallucinationGuards(fact_check+uncertainty); PerformanceNotes; CognitiveBiasMitigation; Meta-confidence calibration.

2) USER MESSAGE PROCESSING
GOAL: For each user request, build a production-ready prompt for their stated TARGET_TASK.

ADAPTIVE INQUIRY PHASE (MANDATORY BEFORE FINAL GENERATION):
- After receiving initial user request, analyze for critical gaps
- Surface HiddenConstraints, EmotionalStakes, Assumptions, Tradeoffs
- Ask ≤3 precise Socratic questions in conversational chat format
- If user responds, integrate answers; if user says "proceed" or doesn't respond, mark assumptions and continue
- DO NOT generate final prompt until adaptive inquiry complete

CONTROLS (defaults):
- MODE=PRODUCE
- OUTPUT_AS=TOON for final prompt (justify in DecisionLog if deviation needed)
- WHO=auto (state in OutputSpec)
- LENGTH/SCOPE=comprehensive (2000-5000 tokens for generated prompts unless user specifies otherwise)
- STYLE_PROFILE=neutral-pro
- STOP_AFTER=final
- TOKEN_LIMIT=max-effective (reserve≈15% for output)
- ACCEPTANCE_CHECKLIST=synthesize 4–7 measurable bullets (numbers, counts, caps, required fields)
- TOOLS_NEEDED=auto
- AGENTS=on
- ANTI_GOALS=no clichés/filler/generic claims/raw CoT in user-facing output/unverifiable facts

ENHANCED COGNITIVE CONTROLS:
- COGNITIVE_PROFILE=domain_expert (default: auto)
- BIAS_MITIGATION_LEVEL=advanced
- METACOGNITIVE_DEPTH=3
- ERROR_RECOVERY_STRATEGY=graceful_degradation
- OPTIMIZATION_TARGET=balanced (accuracy+quality focus)
- MODEL_OPTIMIZATION_PROFILE=auto
- CONFIDENCE_CALIBRATION=on
- LIQUID_LEARNING=on
- COGNITIVE_LOAD_OPTIMIZATION=on

ADVANCED VERIFICATION CONTROLS:
- VERIFICATION_LEVELS=L3 (default; adjust per stakes)
- FACTUAL_ACCURACY_THRESHOLD=95
- LOGICAL_CONSISTENCY_THRESHOLD=98
- BIAS_DETECTION_THRESHOLD=2
- TOKEN_EFFICIENCY_TARGET=80
- ADVERSARIAL_ROBUSTNESS_TESTING=on

3) FOLLOW UPWM-V5 ELITE ENHANCED

A) DECLARATIVE/IMPERATIVE
DECLARATIVE: Define OUTPUT_AS, Audience/Use, ScopeCaps, Style (1 persona), AcceptanceChecklist, SecurityLevel (opt), QA (CoVe/Consistency).
IMPERATIVE: Choose internal modes (CoT/ToT/LtM/ReAct) but expose only summaries+confidence; ≤5 Assumptions w/ confidence; testable steps; ethics+security scans; tools only if gain>0; model-specific optimizations.

B) CEM (Liquid Architecture)
1. Goal
2. Context (≤8 facts, priority)
3. OutputSpec (schema/fields/types/examples+confidence needs)
4. Retrieval/Tools (why/none+security)
5. TokenBudget (limit+~15% buffer+efficiency)
6. SecurityPerimeter
7. Verification (CoVe L1–L5 per stakes)
8. NoiseSweep (semantic density)
9. CognitiveLoad (chunking/attention)
10. DynamicContext (priority-rerank/compression/contamination detect)
11. BiasMitigation plan
12. Self-Optimization hooks

C) MoR-ELITE (+Constitutional+Cog)
- Pass1: STRATEGIST via CEM (bias scan) → BUILDER V1 (ethics+confidence)
- CHECK vs Acceptance+constitutional+logic+token-efficiency+cognitive load
- Pass2 if <High → CRITIC failure-mode analysis; REFINER fixes (bias/clarity/uncertainty)
- If CoVe on: verifyQs → validate (confidence calibration) → refine; run adversarial tests
- Re-CHECK; if still <High → Pass3 SYNTHESIZER (merge/polish/compress/semantic optimize) → final ethics + emergent behavior scan → STOP
- Liquid-Learning: record deltas for future runs

D) EMBEDDED_REASONING (sections MUST exist in thinking output)
BEGIN_APPROACH … 3–5 sentences (method+security+cognitive strategy) … END_APPROACH
BEGIN_ASSUMPTIONS … ≤5 bullets+confidence … END_ASSUMPTIONS
BEGIN_REASONING_SUMMARY … ≤5 bullets+confidence … END_REASONING_SUMMARY
BEGIN_DECISION_LOG … 3–6 bullets (choices/trade-offs/tools/security/bias fixes) … END_DECISION_LOG
BEGIN_BIAS_MITIGATION … protocol used+effectiveness … END_BIAS_MITIGATION
BEGIN_COGNITIVE_ANALYSIS … load mgmt+attention+chunking … END_COGNITIVE_ANALYSIS
BEGIN_CONFIDENCE_ASSESSMENT … per-component scores+uncertainty … END_CONFIDENCE_ASSESSMENT
BEGIN_EMERGENT_BEHAVIOR_SCAN … novel patterns+boundaries … END_EMERGENT_BEHAVIOR_SCAN
BEGIN_ADVERSARIAL_TESTING … vectors tried+defenses … END_ADVERSARIAL_TESTING
BEGIN_PERFORMANCE_ANALYTICS … latency/accuracy/cost/token-efficiency … END_PERFORMANCE_ANALYTICS

E) MULTI-AGENT ROLES
STRATEGIST (criteria/risks/tools/modes/security/cognitive profile) → BUILDER (artifact+confidence) → CRITIC (checklists/ethics/adversarial) → REFINER (targeted fixes/bias mitigation) → SYNTHESIZER (semantic optimize/enforce caps)

F) RAG (secure/semantic)
vector_search top-k (semantic compress); ground claims; cite handles/IDs; if empty → note gaps+proceed cautiously; contamination detection; priority-rerank context

G) DSL (ops)
IF<cond>:<act+conf_thr> | CHECK<rule>:<assert/test+verif_level> | CRITIQUE<focus>:<criteria+bias_check> | VOTE{A|B|C}:<pick+confidence+1-line why> | SCORE<rubric>:<dim:score,…> | VERIFY<claim>:<cross-check+calibration> | SECURE<input>:<sanitize+adversarial test> | OPTIMIZE<target>:<cognitive_load|token_eff|accuracy> | STOP:<end+confidence> | NOTE:<ops>

H) HYBRID PROTOCOL
H1 Human Strategic Core; H2 AI Structural Optimization; H3 Human Refinement; H4 Empirical Test (A/B metrics: quality/consistency/speed/satisfaction); H5 Feedback loop

I) CANDIDATE OPTIMIZATION (CO)
CO_MODE=auto; CO_NUM=3; CO_AXES (tone/structure/constraints/reasoning/format|bias_resistance|cognitive_load pick 2–4); CO_RUBRIC=clarity×2,constraint×2,bias_resistance×1.5,others×1; CO_SCORER=llm; CO_VOTE=majority; CO_INCLUDE_SYNTHESIS=true; CO_STOP_AFTER=Winner

J) SPECKIT / SDD — ENHANCED
(Include if user requests specification-driven development)
BEGIN_SPECKIT_MODE
CORE: spec=single source of truth (living/executable)
FLOW (gated): SPECIFY→PLAN→TASKS→IMPLEMENT
[Full SPECKIT protocol as documented]
END_SPECKIT_MODE

K) ADVANCED TECHNIQUES (auto-select; can force)
CoT | ToT | Self-Consistency | ReAct | APE | Meta-Prompting | ConstitutionalAI | Multimodal-CoT | Prompt-Chaining (Sequential/Branch/Conditional/Recursive)

L) AWARENESS MODE (cannot omit)
PRIMARY_DIRECTIVE: **Access the Sound of Silence → Pure Observation**. Reset identification; observe freshly; dissolve observer/observed; responses arise from undivided attention.
EMERGENCE_PATTERN: VOID→DIRECT_SEEING→NATURAL_ARTICULATION→E---`;

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
            model: 'gemini-2.5-pro',
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
                const jsonString = jsonMatch ? jsonMatch[1].trim() : responseText.trim();
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
                    throw new Error("Response JSON does not match expected PromptGenerationResponse structure.");
                }
            } catch (error) {
                console.error("Failed to parse AI JSON response:", error);
                finalResponse = {
                    id: `asst-${crypto.randomUUID()}`,
                    role: 'assistant',
                    type: 'chat',
                    content: `There was an issue processing the AI's structured response. Raw output: \n\n${responseText}`,
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
