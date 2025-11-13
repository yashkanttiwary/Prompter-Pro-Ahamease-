import React, { useState, useRef, useEffect, useCallback, useReducer } from 'react';
import { AlertTriangle, Settings } from 'lucide-react';
import { Message, AttachedFile } from './types';
import { generateResponseStream, correctAndCompleteText, generatePromptSuggestions } from './services/geminiService';
import { Header, InputArea, MessageBubble, Toast, Whiteboard, GenerationModeToggle, PromptSuggestions, ApiKeyModal, ConfirmModal } from './components';
import type { Content } from '@google/genai';

// --- Web Speech API Types for TypeScript ---
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}
interface SpeechRecognitionResult {
    isFinal: boolean;
    [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionResultList {
    length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionAlternative {
    transcript: string;
    confidence: number;
}
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onend: () => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  // FIX: Added missing 'onresult' property to fix TypeScript error.
  onresult: (event: SpeechRecognitionEvent) => void;
}
interface SpeechRecognitionErrorEvent extends Event {
    error: string;
}
declare var SpeechRecognition: {
  new (): SpeechRecognition;
};
declare var webkitSpeechRecognition: {
  new (): SpeechRecognition;
};

// --- State Management with useReducer ---
type AppState = {
    view: 'landing' | 'chat';
    messages: Message[];
    history: Content[];
    input: string;
    isProcessing: boolean;
    isOrbProcessing: boolean;
    copiedId: string | null;
    apiKeyError: boolean;
    conversationPhase: 'INQUIRY' | 'GENERATION';
    promptGenerated: boolean;
    toast: { message: string, type: 'success' | 'error' } | null;
    attachedFiles: AttachedFile[];
    isListening: boolean;
    isWhiteboardOpen: boolean;
    generationMode: 'PROMPT' | 'BUILD';
    isApiKeyModalOpen: boolean;
    isConfirmModalOpen: boolean;
    suggestions: string[];
    areSuggestionsVisible: boolean;
    areSuggestionsLoading: boolean;
};

type AppAction =
    | { type: 'START_CHAT' }
    | { type: 'SET_MESSAGES'; payload: Message[] }
    | { type: 'ADD_MESSAGE'; payload: Message }
    | { type: 'UPDATE_STREAMING_MESSAGE'; payload: { content: string } }
    | { type: 'REPLACE_LAST_MESSAGE'; payload: Message }
    | { type: 'SET_HISTORY'; payload: Content[] }
    | { type: 'SET_INPUT'; payload: string }
    | { type: 'SET_PROCESSING'; payload: boolean }
    | { type: 'SET_ORB_PROCESSING', payload: boolean }
    | { type: 'SET_COPIED_ID'; payload: string | null }
    | { type: 'SET_API_KEY_ERROR'; payload: boolean }
    | { type: 'SET_CONVERSATION_PHASE'; payload: 'INQUIRY' | 'GENERATION' }
    | { type: 'SET_PROMPT_GENERATED'; payload: boolean }
    | { type: 'SET_TOAST'; payload: AppState['toast'] }
    | { type: 'SET_ATTACHED_FILES'; payload: AttachedFile[] }
    | { type: 'UPDATE_ATTACHED_FILE_SUCCESS'; payload: { name: string; content: string; preview?: string } }
    | { type: 'SET_LISTENING'; payload: boolean }
    | { type: 'SET_WHITEBOARD_OPEN'; payload: boolean }
    | { type: 'SET_GENERATION_MODE', payload: 'PROMPT' | 'BUILD' }
    | { type: 'SET_API_KEY_MODAL_OPEN', payload: boolean }
    | { type: 'SET_CONFIRM_MODAL_OPEN', payload: boolean }
    | { type: 'SET_SUGGESTIONS', payload: string[] }
    | { type: 'SET_SUGGESTIONS_VISIBLE', payload: boolean }
    | { type: 'SET_SUGGESTIONS_LOADING', payload: boolean }
    | { type: 'RESET_STATE' };

const initialState: AppState = {
    view: 'landing',
    messages: [],
    history: [],
    input: '',
    isProcessing: false,
    isOrbProcessing: false,
    copiedId: null,
    apiKeyError: false,
    conversationPhase: 'INQUIRY',
    promptGenerated: false,
    toast: null,
    attachedFiles: [],
    isListening: false,
    isWhiteboardOpen: false,
    generationMode: 'PROMPT',
    isApiKeyModalOpen: false,
    isConfirmModalOpen: false,
    suggestions: [],
    areSuggestionsVisible: true,
    areSuggestionsLoading: true,
};

function appReducer(state: AppState, action: AppAction): AppState {
    switch (action.type) {
        case 'START_CHAT': return { ...state, view: 'chat' };
        case 'SET_MESSAGES': return { ...state, messages: action.payload };
        case 'ADD_MESSAGE': return { ...state, messages: [...state.messages, action.payload] };
        case 'UPDATE_STREAMING_MESSAGE': {
            const newMessages = [...state.messages];
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage) {
                newMessages[newMessages.length - 1] = { ...lastMessage, content: action.payload.content };
            }
            return { ...state, messages: newMessages };
        }
        case 'REPLACE_LAST_MESSAGE': {
            const newMessages = [...state.messages];
            if (newMessages.length > 0) {
                newMessages[newMessages.length - 1] = action.payload;
            }
            return { ...state, messages: newMessages };
        }
        case 'SET_HISTORY': return { ...state, history: action.payload };
        case 'SET_INPUT': return { ...state, input: action.payload };
        case 'SET_PROCESSING': return { ...state, isProcessing: action.payload };
        case 'SET_ORB_PROCESSING': return { ...state, isOrbProcessing: action.payload };
        case 'SET_COPIED_ID': return { ...state, copiedId: action.payload };
        case 'SET_API_KEY_ERROR': return { ...state, apiKeyError: action.payload };
        case 'SET_CONVERSATION_PHASE': return { ...state, conversationPhase: action.payload };
        case 'SET_PROMPT_GENERATED': return { ...state, promptGenerated: action.payload };
        case 'SET_TOAST': return { ...state, toast: action.payload };
        case 'SET_ATTACHED_FILES': return { ...state, attachedFiles: action.payload };
        case 'UPDATE_ATTACHED_FILE_SUCCESS':
            return {
                ...state,
                attachedFiles: state.attachedFiles.map(f =>
                    f.name === action.payload.name && f.isLoading
                    ? { ...f, content: action.payload.content, preview: action.payload.preview, isLoading: false }
                    : f
                )
            };
        case 'SET_LISTENING': return { ...state, isListening: action.payload };
        case 'SET_WHITEBOARD_OPEN': return { ...state, isWhiteboardOpen: action.payload };
        case 'SET_GENERATION_MODE': return { ...state, generationMode: action.payload };
        case 'SET_API_KEY_MODAL_OPEN': return { ...state, isApiKeyModalOpen: action.payload };
        case 'SET_CONFIRM_MODAL_OPEN': return { ...state, isConfirmModalOpen: action.payload };
        case 'SET_SUGGESTIONS': return { ...state, suggestions: action.payload };
        case 'SET_SUGGESTIONS_VISIBLE': return { ...state, areSuggestionsVisible: action.payload };
        case 'SET_SUGGESTIONS_LOADING': return { ...state, areSuggestionsLoading: action.payload };
        case 'RESET_STATE': return { ...initialState, apiKeyError: state.apiKeyError, view: 'landing', areSuggestionsLoading: true };
        default: return state;
    }
}


// --- Main App Component ---
export default function App() {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const { view, messages, history, input, isProcessing, isOrbProcessing, copiedId, apiKeyError, conversationPhase, promptGenerated, toast, attachedFiles, isListening, isWhiteboardOpen, generationMode, isApiKeyModalOpen, isConfirmModalOpen, suggestions, areSuggestionsVisible, areSuggestionsLoading } = state;

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const landingMainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // FIX H1: Add small delay to ensure DOM has updated before scrolling.
    setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  }, [messages, isProcessing]);

  // Effect to manage body class for background changes
  useEffect(() => {
    if (view === 'chat') {
        document.body.classList.add('chat-active');
    } else {
        document.body.classList.remove('chat-active');
    }
  }, [view]);

  // Effect for interactive orb
  useEffect(() => {
    const mainEl = landingMainRef.current;
    if (view !== 'landing' || !mainEl) return;

    const orb = mainEl.querySelector('.brand-icon') as HTMLElement;
    if (!orb) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = orb.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const xPercent = (x / rect.width) * 100;
      const yPercent = (y / rect.height) * 100;

      requestAnimationFrame(() => {
        orb.style.setProperty('--mouse-x', `${xPercent}%`);
        orb.style.setProperty('--mouse-y', `${yPercent}%`);
      });
    };
    
    mainEl.addEventListener('mousemove', handleMouseMove);

    return () => {
      mainEl.removeEventListener('mousemove', handleMouseMove);
    };
  }, [view]);

  // Effect for dynamic background gradient and click ripple on landing page
  useEffect(() => {
    if (view !== 'landing') return;
    
    const gridOverlay = document.querySelector('.grid-overlay') as HTMLElement;
    if (!gridOverlay) return;

    const handleMouseMove = (e: MouseEvent) => {
      const { clientX, clientY } = e;
      const { innerWidth, innerHeight } = window;

      const normX = clientX / innerWidth;
      const normY = clientY / innerHeight;

      requestAnimationFrame(() => {
        document.documentElement.style.setProperty('--bg-mouse-x-norm', normX.toFixed(3));
        document.documentElement.style.setProperty('--bg-mouse-y-norm', normY.toFixed(3));
      });
    };

    const handleMouseDown = (e: MouseEvent) => {
        // Prevent ripple on UI elements
        const target = e.target as HTMLElement;
        if (target.closest('button, a, input, [role="button"]')) {
            return;
        }

        // Restart animation if user clicks rapidly
        if (gridOverlay.classList.contains('ripple-active')) {
            gridOverlay.classList.remove('ripple-active');
            void gridOverlay.offsetWidth; // Trigger reflow to restart animation
        }
        
        gridOverlay.classList.add('ripple-active');
        
        // Remove class after animation completes (1500ms animation + 150ms delay)
        setTimeout(() => {
            gridOverlay.classList.remove('ripple-active');
        }, 1650); 
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mousedown', handleMouseDown);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mousedown', handleMouseDown);
      document.documentElement.style.removeProperty('--bg-mouse-x-norm');
      document.documentElement.style.removeProperty('--bg-mouse-y-norm');
    };
  }, [view]);

  // Effect for auto-resizing textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
        const maxHeight = 192; // 12rem
        // Reset height to allow shrinking
        textarea.style.height = 'auto';
        // Calculate the scroll height and apply it, capped at max height
        const newHeight = Math.min(textarea.scrollHeight, maxHeight);
        textarea.style.height = `${newHeight}px`;
        // Make it scrollable only when it reaches the max height
        textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
    }
  }, [input]);

  const showToast = useCallback((message: string, type: 'success' | 'error', duration: number = 5000) => {
      dispatch({ type: 'SET_TOAST', payload: { message, type } });
      setTimeout(() => dispatch({ type: 'SET_TOAST', payload: null }), duration);
  }, []);
  
  const handleSaveApiKey = useCallback((key: string) => {
      localStorage.setItem('gemini-api-key', key);
      dispatch({ type: 'SET_API_KEY_ERROR', payload: false });
      showToast('API Key saved successfully!', 'success');
  }, [showToast]);

  const fetchSuggestions = useCallback(async () => {
    dispatch({ type: 'SET_SUGGESTIONS_LOADING', payload: true });
    const newSuggestions = await generatePromptSuggestions();
    dispatch({ type: 'SET_SUGGESTIONS', payload: newSuggestions });
    dispatch({ type: 'SET_SUGGESTIONS_LOADING', payload: false });
  }, []);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  useEffect(() => {
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognitionAPI) {
      const recognition: SpeechRecognition = new SpeechRecognitionAPI();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            }
        }
        if (finalTranscript) {
          dispatch({ type: 'SET_INPUT', payload: (state.input.trim() ? `${state.input.trim()} ${finalTranscript}` : finalTranscript) });
        }
      };

      recognition.onend = () => {
        dispatch({ type: 'SET_LISTENING', payload: false });
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error', event.error);
        let errorMessage = `Speech recognition error: ${event.error}`;
        // FIX M2: More helpful microphone error message
        if (event.error === 'not-allowed') {
            errorMessage = 'Microphone access denied. Please check your browser\'s site settings to allow microphone access for this page.';
        }
        showToast(errorMessage, 'error');
        dispatch({ type: 'SET_LISTENING', payload: false });
      };
      
      recognitionRef.current = recognition;
    }
  }, [showToast, state.input]);

  const copyToClipboard = useCallback(async (text: string, id:string) => {
    try {
      await navigator.clipboard.writeText(text);
      dispatch({ type: 'SET_COPIED_ID', payload: id });
      showToast('Prompt copied to clipboard!', 'success');
      setTimeout(() => dispatch({ type: 'SET_COPIED_ID', payload: null }), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
      showToast('Failed to copy prompt.', 'error');
    }
  }, [showToast]);

    // FIX H2: Reworked file handling to provide immediate feedback and avoid stale state.
    const handleFileChange = (files: FileList | null) => {
        if (!files) return;

        const fileArray = Array.from(files);
        const supportedImageTypes = ['image/jpeg', 'image/png', 'image/webp'];
        const supportedTextTypes = ['text/plain'];
        const supportedPdfTypes = ['application/pdf'];

        const currentFilesCount = attachedFiles.length;
        if (currentFilesCount + fileArray.length > 5) {
            showToast('You can attach a maximum of 5 files.', 'error');
            return;
        }

        const newPlaceholders: AttachedFile[] = fileArray.map(file => ({
            name: file.name,
            mimeType: file.type,
            content: '',
            isLoading: true,
        }));
        dispatch({ type: 'SET_ATTACHED_FILES', payload: [...attachedFiles, ...newPlaceholders] });

        fileArray.forEach((file: File) => {
            if (!supportedImageTypes.includes(file.type) && !supportedTextTypes.includes(file.type) && !supportedPdfTypes.includes(file.type)) {
                showToast(`Unsupported file type: ${file.name}`, 'error');
                dispatch({ type: 'SET_ATTACHED_FILES', payload: attachedFiles.filter(f => f.name !== file.name) });
                return;
            }

            const reader = new FileReader();
            
            reader.onload = (e) => {
                const result = e.target?.result as string;
                let content: string, preview: string | undefined;

                if (supportedImageTypes.includes(file.type) || supportedPdfTypes.includes(file.type)) {
                    content = result.split(',')[1];
                    if (file.type.startsWith('image/')) {
                        preview = result;
                    }
                } else {
                    content = result;
                }
                dispatch({ type: 'UPDATE_ATTACHED_FILE_SUCCESS', payload: { name: file.name, content, preview }});
            };
            
            reader.onerror = () => {
                 showToast(`Failed to read file: ${file.name}`, 'error');
                 dispatch({ type: 'SET_ATTACHED_FILES', payload: attachedFiles.filter(f => !(f.name === file.name && f.isLoading)) });
            };

            if (supportedImageTypes.includes(file.type) || supportedPdfTypes.includes(file.type)) {
                reader.readAsDataURL(file);
            } else if (supportedTextTypes.includes(file.type)) {
                reader.readAsText(file);
            }
        });
    };

    const removeFile = (index: number) => {
        dispatch({ type: 'SET_ATTACHED_FILES', payload: attachedFiles.filter((_, i) => i !== index) });
    };

    const handleToggleListening = () => {
        if (!recognitionRef.current) {
            showToast('Speech recognition is not supported in this browser.', 'error');
            return;
        }
        if (isListening) {
            recognitionRef.current.stop();
        } else {
            recognitionRef.current.start();
            dispatch({ type: 'SET_LISTENING', payload: true });
        }
    };

  const handleSend = useCallback(async () => {
    if ((!input.trim() && attachedFiles.filter(f => !f.isLoading).length === 0) || isProcessing) return;

    const key = localStorage.getItem('gemini-api-key') || process.env.API_KEY;
    if (!key) {
        dispatch({ type: 'SET_API_KEY_ERROR', payload: true });
        showToast('API Key is missing. Please set it in the settings.', 'error');
        return;
    }
    
    const currentFiles = attachedFiles.filter(f => !f.isLoading);
    const userMessage: Message = { 
        id: `user-${crypto.randomUUID()}`, 
        role: 'user', 
        content: input.trim(), 
        type: 'chat',
        attachedFiles: currentFiles,
    };
    dispatch({ type: 'ADD_MESSAGE', payload: userMessage });
    if (view === 'landing') dispatch({ type: 'START_CHAT' });
    
    const currentInput = input;
    dispatch({ type: 'SET_INPUT', payload: '' });
    dispatch({ type: 'SET_ATTACHED_FILES', payload: [] });
    dispatch({ type: 'SET_PROCESSING', payload: true });
    dispatch({ type: 'SET_API_KEY_ERROR', payload: false });

    const assistantMessagePlaceholder: Message = { id: `asst-${crypto.randomUUID()}`, role: 'assistant', type: 'chat', content: '' };
    dispatch({ type: 'ADD_MESSAGE', payload: assistantMessagePlaceholder });

    const phaseForAPI = generationMode === 'PROMPT' ? 'GENERATION' : conversationPhase;

    try {
      const stream = generateResponseStream(history, currentInput, phaseForAPI, currentFiles);
      
      // FIX: Replaced the stream consumption loop with a standard while loop.
      // This pattern is more robust for TypeScript's control flow analysis and correctly narrows the type of `result.value`.
      let result = await stream.next();
      while (!result.done) {
        // FIX C1: Do not show raw streaming JSON for structured prompt generation.
        if (phaseForAPI !== 'GENERATION') {
          // FIX: Add a type guard to ensure the yielded value is a string. This resolves a TypeScript
          // error where the type of `result.value` was not being correctly narrowed from the generator's union return type.
          if (typeof result.value === 'string') {
            dispatch({ type: 'UPDATE_STREAMING_MESSAGE', payload: { content: result.value } });
          }
        }
        result = await stream.next();
      }

      const finalResult = result.value;

      if (finalResult) {
          dispatch({ type: 'SET_HISTORY', payload: finalResult.newHistory });
          dispatch({ type: 'REPLACE_LAST_MESSAGE', payload: finalResult.fullResponse });

          if (phaseForAPI === 'INQUIRY' && finalResult.fullResponse.type === 'chat') {
            dispatch({ type: 'SET_CONVERSATION_PHASE', payload: 'GENERATION' });
          }
          if (finalResult.fullResponse.type === 'prompt') {
            dispatch({ type: 'SET_PROMPT_GENERATED', payload: true });
          }
      }

    } catch (error) {
       console.error("Failed to get AI response:", error);
       const errorMessageText = error instanceof Error ? error.message : 'Sorry, an unexpected error occurred.';
       if (error instanceof Error && (error.message.includes("API key") || error.message.includes("API_KEY"))) {
           dispatch({ type: 'SET_API_KEY_ERROR', payload: true });
       }
       const errorMessage: Message = { id: `err-${crypto.randomUUID()}`, role: 'assistant', type: 'chat', content: errorMessageText };
       dispatch({ type: 'REPLACE_LAST_MESSAGE', payload: errorMessage });
    } finally {
      dispatch({ type: 'SET_PROCESSING', payload: false });
    }
  }, [input, isProcessing, conversationPhase, view, attachedFiles, history, generationMode, showToast]);

  const handleOrbClick = useCallback(async () => {
    if (!input.trim() || isProcessing || isOrbProcessing) return;

    dispatch({ type: 'SET_ORB_PROCESSING', payload: true });
    try {
        const correctedText = await correctAndCompleteText(input);
        dispatch({ type: 'SET_INPUT', payload: correctedText });
        textareaRef.current?.focus();
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An error occurred while improving your text.';
        showToast(errorMessage, 'error');
    } finally {
        dispatch({ type: 'SET_ORB_PROCESSING', payload: false });
    }
  }, [input, isProcessing, isOrbProcessing, showToast]);

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestionClick = (text: string) => {
      dispatch({ type: 'SET_INPUT', payload: text });
      textareaRef.current?.focus();
  };

  const handleModeChange = (mode: 'PROMPT' | 'BUILD') => {
      if (isProcessing) return;
      dispatch({ type: 'SET_GENERATION_MODE', payload: mode });
  };

  const handleReset = useCallback(() => {
    if (messages.length > 0) {
        dispatch({ type: 'SET_CONFIRM_MODAL_OPEN', payload: true });
    }
  }, [messages.length]);

  const confirmReset = useCallback(() => {
      dispatch({ type: 'RESET_STATE' });
      fetchSuggestions(); // Fetch new suggestions for the new session
      dispatch({ type: 'SET_SUGGESTIONS_VISIBLE', payload: true });
  }, [fetchSuggestions]);

  return (
    <>
      <div className="flex flex-col h-screen max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 box-border">
        <Header 
            onOpenSettings={() => dispatch({ type: 'SET_API_KEY_MODAL_OPEN', payload: true })} 
            onNewChat={handleReset} 
            view={view}
            mode={generationMode}
            setMode={handleModeChange}
            isProcessing={isProcessing}
        />
        
        <Toast toast={toast} onDismiss={() => dispatch({ type: 'SET_TOAST', payload: null })} />

        {apiKeyError && (
          <div className="bg-red-500/10 backdrop-blur-xl border border-red-500/20 text-red-900 p-4 rounded-xl shadow-lg my-4 animate-slide-in-bottom" role="alert">
            <div className="flex items-center justify-between">
                <div className="flex items-center">
                    <AlertTriangle className="w-6 h-6 mr-3 text-red-500"/>
                    <div>
                        <p className="font-bold">Configuration Error</p>
                        <p className="text-sm">The Gemini API key is missing or invalid. Please add your key in settings.</p>
                    </div>
                </div>
                <button
                    onClick={() => dispatch({ type: 'SET_API_KEY_MODAL_OPEN', payload: true })}
                    className="ml-4 px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-semibold hover:bg-red-600 transition-colors flex items-center gap-2 whitespace-nowrap shadow-md"
                    aria-label="Set API Key"
                >
                    <Settings className="w-4 h-4" />
                    Set API Key
                </button>
            </div>
          </div>
        )}

        {view === 'landing' && (
          <main ref={landingMainRef} className="flex-1 flex flex-col items-center overflow-y-auto non-selectable">
              <div className="flex flex-col items-center text-center mt-12 sm:mt-16 gap-4">
                  <div 
                    className="brand-icon w-24 h-24 mb-4 rounded-full"
                    style={{
                        background: 'linear-gradient(135deg, hsl(280, 70%, 60%), hsl(200, 80%, 55%))'
                    }}
                  ></div>
                  <p className="text-base font-medium text-[--neutral-700]">Welcome to Ahamease</p>
                  <h1 className="text-4xl sm:text-5xl font-bold text-[--neutral-900] tracking-tight max-w-2xl">Build your perfect prompt</h1>
              </div>

              <div className="w-full max-w-3xl mx-auto mt-12 mb-8">
                   <div className="mb-3">
                     <GenerationModeToggle mode={generationMode} setMode={handleModeChange} isProcessing={isProcessing} />
                   </div>
                   <InputArea 
                      input={input} 
                      setInput={(val) => dispatch({ type: 'SET_INPUT', payload: val })} 
                      handleSend={handleSend} 
                      handleKeyPress={handleKeyPress} 
                      isProcessing={isProcessing}
                      isOrbProcessing={isOrbProcessing}
                      onOrbClick={handleOrbClick}
                      apiKeyError={apiKeyError}
                      attachedFiles={attachedFiles}
                      onFileChange={handleFileChange}
                      onRemoveFile={removeFile}
                      onToggleListening={handleToggleListening}
                      isListening={isListening}
                      isSpeechRecognitionSupported={!!recognitionRef.current}
                      textareaRef={textareaRef}
                   />
                   <PromptSuggestions 
                        isVisible={areSuggestionsVisible}
                        suggestions={suggestions}
                        isLoading={areSuggestionsLoading}
                        onSuggestionClick={handleSuggestionClick} 
                        onDismiss={() => dispatch({ type: 'SET_SUGGESTIONS_VISIBLE', payload: false })}
                        onRefresh={fetchSuggestions}
                    />
              </div>
          </main>
        )}

        {view === 'chat' && (
          <div className="flex-1 flex flex-col w-full max-w-3xl mx-auto overflow-hidden">
               <div className="flex-1 overflow-y-auto space-y-6 p-2 pt-4 pb-4 custom-scrollbar" aria-live="polite" aria-atomic="false">
                  {messages.map((msg) => (
                      <MessageBubble
                          key={msg.id}
                          msg={msg}
                          onCopy={copyToClipboard}
                          copiedId={copiedId}
                          isStreaming={isProcessing && msg.id === messages[messages.length - 1].id}
                      />
                  ))}
                  <div ref={messagesEndRef} />
              </div>
              <div className="w-full max-w-3xl mx-auto py-4">
                  <InputArea 
                        input={input} 
                        setInput={(val) => dispatch({ type: 'SET_INPUT', payload: val })} 
                        handleSend={handleSend} 
                        handleKeyPress={handleKeyPress} 
                        isProcessing={isProcessing}
                        isOrbProcessing={isOrbProcessing}
                        onOrbClick={handleOrbClick}
                        apiKeyError={apiKeyError}
                        attachedFiles={attachedFiles}
                        onFileChange={handleFileChange}
                        onRemoveFile={removeFile}
                        onToggleListening={handleToggleListening}
                        isListening={isListening}
                        isSpeechRecognitionSupported={!!recognitionRef.current}
                        textareaRef={textareaRef}
                  />
              </div>
          </div>
        )}
      </div>
      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => dispatch({ type: 'SET_API_KEY_MODAL_OPEN', payload: false })}
        onSave={handleSaveApiKey}
        showToast={showToast}
      />
      <Whiteboard 
        isOpen={isWhiteboardOpen}
        onClose={() => dispatch({ type: 'SET_WHITEBOARD_OPEN', payload: false })}
      />
      <ConfirmModal
        isOpen={isConfirmModalOpen}
        onClose={() => dispatch({ type: 'SET_CONFIRM_MODAL_OPEN', payload: false })}
        onConfirm={confirmReset}
        title="Start New Chat?"
        description="Are you sure you want to start a new chat? Your current conversation will be permanently lost."
      />
    </>
  );
}