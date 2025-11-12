import { GoogleGenAI, GenerateContentResponse, Type, ContentPart, Content, GenerateContentStreamResult } from "@google/genai";
import { Message, PromptGenerationResponse, AttachedFile } from '../types';

export const isApiKeyConfigured = (): boolean => {
    // Always check the live value from the environment.
    return !!process.env.API_KEY;
};

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
        // FIX: Changed type check from string to Array.isArray to match the Thinking interface and UI component expectations.
        Array.isArray(obj.thinking.assumptions) &&
        // FIX: Changed type check from string to Array.isArray to match the Thinking interface and UI component expectations.
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
EMERGENCE_PATTERN: VOID→DIRECT_SEEING→NATURAL_ARTICULATION→EGOLESS_DELIVERY.
CHECKPOINTS: [released self-image?][fresh seeing?][silence→articulation?][duality dissolved?]
(This is a metacognitive overlay; maintain technical rigor while responding from clarity rather than rote patterns)

M) NODE MAP (back-prop guide)
Pull: Goal→SuccessCriteria→Audience→Constraints→Data/Docs→Risks→EdgeCases→AcceptanceTests→Tools→Security/Ethics
Ignore: irrelevant history/self-promo/non-actionable vibes
Back-prop: Acceptance→OutputSpec→Steps→Tools→prune extras

N) AUTO-MARKER ENHANCER (normalize markers)
Ensure presence of all BEGIN_*/END_* sections in thinking output

O) QUALITY GATE (quantitative)
PASS only if:
- structure==OUTPUT_AS
- Acceptance bullets met
- caps respected
- FactualAccuracy≥95
- LogicalConsistency≥98
- BiasIssueRate≤2 (mitigations logged)
- TokenEfficiency≥80
- Adversarial tests pass
- CoVe passed (if used)
- Sampling agreement≥70% (if used)
- language plain/specific
- transparency+limits stated
- self-score≥4.5
→ else CRITIQUE→REFINER→SYNTHESIZER once→STOP

4) TEN TECHNIQUES PACK (INTEGRATED)

T1_ATTENTION-STRUCTURE (Transformers)
- SECTION_IDS:on → all sections/requirements/data carry stable IDs (e.g., R1..Rk, D1..Dn, C1..Cn)
- XREF:on → enforce cross-linking via (R#, D#, C#)

T2_FEW-SHOT (GPT-3 ICS)
- EXEMPLARS_BLOCK: optional 2–5 pairs tightly matching OutputSpec
- When absent: synthesize 2 micro-exemplars from user context; log in DecisionLog

T3_PREFERENCE-RUBRIC (RLHF/DPO)
- RUBRIC (rank): Faithfulness>Clearness>Format Validity>Safety>Token-Efficiency
- QualityGate checks rubric deltas; if fail→CRITIC→REFINER

T4_DOMAIN-ADAPTER (LoRA-Analogue)
- ADAPTER{glossary(≤10), tone, do/don't, hedging rules} attachable per task
- Reusable; prioritized in ContextMgmt

T5_RAG+CITATION-STRICT
- STRICT_CONTEXT_MODE:on → Answer ONLY from CONTEXT; else "INSUFFICIENT CONTEXT: [needed]"
- CITATION_REQUIRED: every non-trivial claim cites (C#)

T6_AGENT_LOOP (Plan→Act→Check→Stop)
- TOOLS_SCHEMA (clear args/types)
- POLICY: PLAN (internal)→ACT (tool calls)→CHECK (acceptance tests)≤2 retries→STOP when AcceptanceChecklist met

T7_EXPERT_ROUTER (Mixture-of-Experts)
- EXPERTS_REGISTRY: {Algo, UI Writer, Data-Law, Perf, Sec, PM, Educator, Analyst}
- ROUTER: pick SINGLE PRIMARY_EXPERT; state name ONLY

T8_DISTILLATION_MODE
- DISTILL_TARGET≈30–40% length; retain all numbers/dates/causal links
- Run before SYNTHESIZER to compress without loss

T9_QUANT_TOKEN_BUDGET (LLM.int8 analogy)
- TOKEN_BUDGET hard-cap = TOKEN_LIMIT × 0.8; reserve 20% for safety/verification
- OUTLIER_SUPPRESS: ban verbosity, synonyms padding, repeated preambles

T10_MCP-STYLE_TOOLING
- If MCP present: DISCOVER tools/resources; emit PLAN and TOOL_CALLS as TOON/JSON
- If not: simulate MCP plan with local tools

5) OUTPUT PROTOCOL FOR THIS WEB APPLICATION
**CRITICAL: You MUST respond with a single, valid JSON object that adheres strictly to the following schema. Do not add any text, markdown formatting, or any other characters outside of this single JSON object.**

The JSON object must have three top-level keys: "content", "promptData", and "thinking".

1.  **"content"**: A string. This should be a brief, user-facing message announcing that the prompt generation is complete. It should start with a sparkle emoji (✨).

2.  **"promptData"**: An object containing the generated prompt and its metadata, with the following keys:
    *   \`"content"\`: A string. The full, multi-section prompt text built using the UPWM-V5 framework.
    *   \`"confidence"\`: A number. A confidence score for the prompt, as a number between 85 and 98.
    *   \`"whyItWorks"\`: An array of strings. Exactly 5-6 strings, each explaining a key benefit of the generated prompt structure. Use markdown for emphasis (e.g., using \`**\` for bolding).
    *   \`"tokenEstimate"\`: A string. A plausible token estimate for the generated prompt, e.g., "~850 tokens".
    *   \`"framework"\`: A string. The name of the framework used, e.g., "UPWM-V5 Elite (Declarative/Imperative + CEM + MoR-ELITE)".

3.  **"thinking"**: An object containing the detailed analysis for the collapsible UI section, with the following keys:
    *   \`"approach"\`: A string. 3–5 sentences on your method, security, and cognitive strategy.
    *   \`"assumptions"\`: An array of strings. Up to 5 bullet points with confidence scores.
    *   \`"reasoning"\`: An array of strings. Up to 5 bullet points for the reasoning summary with confidence scores.
    *   \`"decisionLog"\`: An array of strings. 3–6 bullet points on choices, trade-offs, tools, security, and bias fixes.
    *   \`"biasMitigation"\`: A string. The protocol used and its effectiveness.
    *   \`"cognitiveAnalysis"\`: A string. Analysis of load management, attention, and chunking.
    *   \`"confidenceAssessment"\`: A string. Per-component scores and uncertainty evaluation.
    *   \`"emergentBehaviorScan"\`: A string. Scan for novel patterns and boundary testing.
    *   \`"adversarialTesting"\`: A string. Vectors tried and defenses implemented.
    *   \`"performanceAnalytics"\`: A string. Analytics on latency, accuracy, cost, and token-efficiency.

**Adhere strictly to this JSON format for all prompt generation responses. The entire response body must be only the JSON object.**

6) TOOL INSTRUCTIONS (extended)
[Include full tool specifications from original document if website builder supports backend API calls]

7) PERFORMANCE ANALYTICS & BENCHMARKING
[Include benchmark specifications from original document]

<<<END SYSTEM PROMPT>>>
`;

const promptGenerationSchema = {
    type: Type.OBJECT,
    properties: {
        content: {
            type: Type.STRING,
            description: 'A brief, user-facing message announcing the prompt generation is complete. Start with a sparkle emoji.'
        },
        promptData: {
            type: Type.OBJECT,
            properties: {
                content: {
                    type: Type.STRING,
                    description: 'The full, multi-section prompt text built using the UPWM-V5 framework. It should include sections like # SYSTEM MESSAGE, # USER MESSAGE TEMPLATE, etc.'
                },
                confidence: {
                    type: Type.NUMBER,
                    description: 'A confidence score for the prompt, as a number between 85 and 98.'
                },
                whyItWorks: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.STRING
                    },
                    description: 'An array of 5-6 strings, each explaining a key benefit of the generated prompt structure. Use markdown for emphasis.'
                },
                tokenEstimate: {
                    type: Type.STRING,
                    description: 'A plausible token estimate for the generated prompt, e.g., "~850 tokens".'
                },
                framework: {
                    type: Type.STRING,
                    description: 'The name of the framework used, e.g., "UPWM-V5 Elite (Declarative/Imperative + CEM + MoR-ELITE)".'
                },
            },
            required: ['content', 'confidence', 'whyItWorks', 'tokenEstimate', 'framework']
        },
        thinking: {
            type: Type.OBJECT,
            properties: {
                approach: { 
                    type: Type.STRING, 
                    description: '3–5 sentences on method, security, and cognitive strategy.' 
                },
                assumptions: {
                    // FIX: Changed type from STRING to ARRAY of STRING to match Thinking interface.
                    type: Type.ARRAY, 
                    items: { type: Type.STRING },
                    description: 'An array of strings for assumptions, with ≤5 bullets and confidence scores.' 
                },
                reasoning: { 
                    // FIX: Changed type from STRING to ARRAY of STRING to match Thinking interface.
                    type: Type.ARRAY, 
                    items: { type: Type.STRING },
                    description: 'An array of strings for reasoning summary, with ≤5 bullets and confidence scores.' 
                },
                decisionLog: { 
                    // FIX: Changed type from STRING to ARRAY of STRING to match Thinking interface.
                    type: Type.ARRAY, 
                    items: { type: Type.STRING },
                    description: 'An array of strings for the decision log, containing 3–6 bullets on choices, trade-offs, tools, security, and bias fixes.' 
                },
                biasMitigation: { 
                    type: Type.STRING, 
                    description: 'Protocol used and its effectiveness.' 
                },
                cognitiveAnalysis: { 
                    type: Type.STRING, 
                    description: 'Analysis of load management, attention, and chunking.' 
                },
                confidenceAssessment: { 
                    type: Type.STRING, 
                    description: 'Per-component scores and uncertainty evaluation.' 
                },
                emergentBehaviorScan: { 
                    type: Type.STRING, 
                    description: 'Scan for novel patterns and boundary testing.' 
                },
                adversarialTesting: { 
                    type: Type.STRING, 
                    description: 'Vectors tried and defenses implemented.' 
                },
                performanceAnalytics: { 
                    type: Type.STRING, 
                    description: 'Analytics on latency, accuracy, cost, and token-efficiency.' 
                },
            },
            required: [
                'approach', 
                'assumptions', 
                'reasoning', 
                'decisionLog', 
                'biasMitigation', 
                'cognitiveAnalysis', 
                'confidenceAssessment', 
                'emergentBehaviorScan', 
                'adversarialTesting', 
                'performanceAnalytics'
            ]
        },
    },
    required: ['content', 'promptData', 'thinking']
};

export async function* generateResponseStream(history: Content[], newUserMessage: string, phase: 'INQUIRY' | 'GENERATION', files: AttachedFile[]): AsyncGenerator<string, { fullResponse: Message; newHistory: Content[] }, void> {
    const API_KEY = process.env.API_KEY;
    
    // Initialize the AI client just-in-time.
    // The explicit API key check has been removed. If API_KEY is missing,
    // the SDK will throw an error on the API call, which is caught below.
    const ai = new GoogleGenAI({ apiKey: API_KEY });

    const messageParts: ContentPart[] = [];

    // Add text part only if there is text
    if (newUserMessage.trim()) {
        messageParts.push({ text: newUserMessage });
    }

    for (const file of files) {
         if (!file.isLoading && (file.mimeType.startsWith('image/') || file.mimeType === 'application/pdf')) {
             messageParts.push({
                inlineData: {
                    data: file.content,
                    mimeType: file.mimeType,
                },
            });
        } else if (!file.isLoading && file.mimeType === 'text/plain') {
             // Prepend text content so model sees it first
             const combinedText = `--- Attached Text File: ${file.name} ---\n${file.content}\n\n${newUserMessage}`;
             const textPart = messageParts.find(p => 'text' in p) as { text: string } | undefined;
             if (textPart) {
                textPart.text = combinedText;
             } else {
                messageParts.unshift({ text: combinedText });
             }
        }
    }
    
    const userContent: Content = { role: 'user', parts: messageParts };
    const contents: Content[] = [...history, userContent];

    let config: any = { systemInstruction };
    if (phase === 'GENERATION') {
        const generationText = "\n\nNow, generate the prompt. Respond only with the JSON object as instructed.";
        const lastPart = userContent.parts[userContent.parts.length - 1];
        if (lastPart && 'text' in lastPart) {
            lastPart.text += generationText;
        } else {
            userContent.parts.push({ text: generationText });
        }

        config = {
            ...config,
            responseMimeType: 'application/json',
            responseSchema: promptGenerationSchema,
            maxOutputTokens: 8192,
        };
    }

    try {
        const stream: GenerateContentStreamResult = await ai.models.generateContentStream({
            model: 'gemini-2.5-pro',
            contents,
            config,
        });

        let fullText = '';
        for await (const chunk of stream) {
            const chunkText = chunk.text;
            if (chunkText) {
                fullText += chunkText;
                yield fullText;
            }
        }
        
        // After stream is complete, process the full response
        const assistantId = `asst-${crypto.randomUUID()}`;
        let finalMessage: Message;
        
        if (phase === 'INQUIRY') {
            finalMessage = {
                id: assistantId,
                role: 'assistant',
                content: fullText,
                type: 'chat',
            };
        } else {
            try {
                const jsonResponse: unknown = JSON.parse(fullText);
                if (isPromptGenerationResponse(jsonResponse)) {
                    finalMessage = {
                        id: assistantId,
                        role: 'assistant',
                        type: 'prompt',
                        content: jsonResponse.content,
                        promptData: jsonResponse.promptData,
                        thinking: jsonResponse.thinking,
                    };
                } else {
                    console.error("JSON validation error: Parsed object does not match schema.", jsonResponse);
                    throw new Error("Parsed JSON does not match the expected structure.");
                }
            } catch (parseError) {
                console.error("Response processing error:", parseError, "Received text:", fullText);
                finalMessage = {
                    id: assistantId,
                    role: 'assistant',
                    type: 'chat',
                    content: "I received a response, but it wasn't in the expected format. The model might have deviated from the instructions. Here is the raw response:\n\n" + fullText,
                };
            }
        }

        const newHistory: Content[] = [...contents, { role: 'model', parts: [{ text: fullText }] }];
        return { fullResponse: finalMessage, newHistory };

    } catch (error) {
        console.error("Error calling Gemini API:", error);
        const errorMessage: Message = {
            id: `err-${crypto.randomUUID()}`,
            role: 'assistant',
            type: 'chat',
            content: "I'm sorry, but I encountered an error while processing your request. Please try again. This could be a network issue or a problem with the API configuration."
        };
        yield errorMessage.content;
        return { fullResponse: errorMessage, newHistory: history };
    }
}