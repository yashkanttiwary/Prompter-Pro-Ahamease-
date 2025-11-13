// This file contains ambient type declarations for Web APIs.

// --- Web Speech API Types for TypeScript ---
interface SpeechRecognitionEvent extends Event {
  // FIX: Add readonly modifier to match lib.dom.d.ts and prevent conflicts.
  readonly results: SpeechRecognitionResultList;
  readonly resultIndex: number;
}
interface SpeechRecognitionResult {
    // FIX: Add readonly modifier to resolve error "All declarations of 'isFinal' must have identical modifiers."
    readonly isFinal: boolean;
    [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionResultList {
    // FIX: Add readonly modifier to resolve error "All declarations of 'length' must have identical modifiers."
    readonly length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionAlternative {
    // FIX: Add readonly modifier to resolve error "All declarations of 'transcript' must have identical modifiers."
    readonly transcript: string;
    // FIX: Add readonly modifier to resolve error "All declarations of 'confidence' must have identical modifiers."
    readonly confidence: number;
}
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onend: () => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onresult: (event: SpeechRecognitionEvent) => void;
}
interface SpeechRecognitionErrorEvent extends Event {
    // FIX: Add readonly modifier to match lib.dom.d.ts and prevent conflicts.
    readonly error: string;
}

// These are declared in the global scope, so they need to be available on the window object.
declare global {
    interface Window {
        SpeechRecognition: {
            new (): SpeechRecognition;
        };
        webkitSpeechRecognition: {
            new (): SpeechRecognition;
        };
    }
}

// FIX: Add "export {}" to make this a module file. This is required for "declare global" to work correctly and resolves the error "Augmentations for the global scope can only be directly nested in external modules or ambient module declarations."
export {};
