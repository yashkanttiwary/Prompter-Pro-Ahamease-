
import React, { useState, useRef, useEffect, useCallback, useReducer } from 'react';
import { AlertTriangle, Settings } from 'lucide-react';
import { Message, AttachedFile } from './types';
import { generateResponseStream } from './services/geminiService';
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
    expandedThinking: { [key: string]: boolean };
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
    | { type: 'TOGGLE_THINKING'; payload: string }
    | { type: 'SET_COPIED_ID'; payload: string | null }
    | { type: 'SET_API_KEY_ERROR'; payload: boolean }
    | { type: 'SET_CONVERSATION_PHASE'; payload: 'INQUIRY' | 'GENERATION' }
    | { type: 'SET_PROMPT_GENERATED'; payload: boolean }
    | { type: 'SET_TOAST'; payload: AppState['toast'] }
    | { type: 'SET_ATTACHED_FILES'; payload: AttachedFile[] }
    | { type: 'SET_LISTENING'; payload: boolean }
    | { type: 'SET_WHITEBOARD_OPEN'; payload: boolean }
    | { type: 'SET_GENERATION_MODE', payload: 'PROMPT' | 'BUILD' }
    | { type: 'SET_API_KEY_MODAL_OPEN', payload: boolean }
    | { type: 'SET_CONFIRM_MODAL_OPEN', payload: boolean }
    | { type: 'RESET_STATE' };

const initialState: AppState = {
    view: 'landing',
    messages: [],
    history: [],
    input: '',
    isProcessing: false,
    expandedThinking: {},
    copiedId: null,
    apiKeyError: false,
    conversationPhase: 'INQUIRY',
    promptGenerated: false,
    toast: null,
    attachedFiles: [],
    isListening: false,
    isWhiteboardOpen: false,
    generationMode: 'BUILD',
    isApiKeyModalOpen: false,
    isConfirmModalOpen: false,
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
        case 'TOGGLE_THINKING': return { ...state, expandedThinking: { ...state.expandedThinking, [action.payload]: !state.expandedThinking[action.payload] } };
        case 'SET_COPIED_ID': return { ...state, copiedId: action.payload };
        case 'SET_API_KEY_ERROR': return { ...state, apiKeyError: action.payload };
        case 'SET_CONVERSATION_PHASE': return { ...state, conversationPhase: action.payload };
        case 'SET_PROMPT_GENERATED': return { ...state, promptGenerated: action.payload };
        case 'SET_TOAST': return { ...state, toast: action.payload };
        case 'SET_ATTACHED_FILES': return { ...state, attachedFiles: action.payload };
        case 'SET_LISTENING': return { ...state, isListening: action.payload };
        case 'SET_WHITEBOARD_OPEN': return { ...state, isWhiteboardOpen: action.payload };
        case 'SET_GENERATION_MODE': return { ...state, generationMode: action.payload };
        case 'SET_API_KEY_MODAL_OPEN': return { ...state, isApiKeyModalOpen: action.payload };
        case 'SET_CONFIRM_MODAL_OPEN': return { ...state, isConfirmModalOpen: action.payload };
        case 'RESET_STATE': return { ...initialState, apiKeyError: state.apiKeyError, view: 'landing' };
        default: return state;
    }
}


// --- Main App Component ---
export default function App() {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const { view, messages, history, input, isProcessing, expandedThinking, copiedId, apiKeyError, conversationPhase, promptGenerated, toast, attachedFiles, isListening, isWhiteboardOpen, generationMode, isApiKeyModalOpen, isConfirmModalOpen } = state;

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  const showToast = useCallback((message: string, type: 'success' | 'error', duration: number = 5000) => {
      dispatch({ type: 'SET_TOAST', payload: { message, type } });
      setTimeout(() => dispatch({ type: 'SET_TOAST', payload: null }), duration);
  }, []);
  
  const handleSaveApiKey = useCallback((key: string) => {
      localStorage.setItem('gemini-api-key', key);
      dispatch({ type: 'SET_API_KEY_ERROR', payload: false });
      showToast('API Key saved successfully!', 'success');
  }, [showToast]);

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
        if (event.error === 'not-allowed') {
            errorMessage = 'Microphone access denied. Please enable it in your browser settings.';
        }
        showToast(errorMessage, 'error');
        dispatch({ type: 'SET_LISTENING', payload: false });
      };
      
      recognitionRef.current = recognition;
    }
  }, [showToast, state.input]);

  const toggleThinking = (id: string) => {
    dispatch({ type: 'TOGGLE_THINKING', payload: id });
  };

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

    const handleFileChange = (files: FileList | null) => {
        if (files) {
            const fileArray = Array.from(files);
            const supportedImageTypes = ['image/jpeg', 'image/png', 'image/webp'];
            const supportedTextTypes = ['text/plain'];
            const supportedPdfTypes = ['application/pdf'];

            const currentFiles = [...attachedFiles];

            fileArray.forEach((file: File) => {
                if (currentFiles.length >= 5) {
                    showToast('You can attach a maximum of 5 files.', 'error');
                    return;
                }
                
                const filePlaceholder: AttachedFile = {
                  name: file.name,
                  mimeType: file.type,
                  content: '',
                  isLoading: true,
                };
                currentFiles.push(filePlaceholder);
                dispatch({ type: 'SET_ATTACHED_FILES', payload: [...currentFiles] });

                const reader = new FileReader();
                
                reader.onload = (e) => {
                    const result = e.target?.result as string;
                    let content: string, preview: string | undefined;

                    if (supportedImageTypes.includes(file.type) || supportedPdfTypes.includes(file.type)) {
                        content = result.split(',')[1];
                        if (file.type.startsWith('image/')) {
                            preview = result;
                        }
                    } else { // Text files
                        content = result;
                    }
                    
                    dispatch({ 
                        type: 'SET_ATTACHED_FILES', 
                        payload: attachedFiles.map(f => 
                            f.name === file.name && f.isLoading 
                            ? { ...f, content, preview, isLoading: false } 
                            : f
                        )
                    });
                };
                
                reader.onerror = () => {
                     showToast(`Failed to read file: ${file.name}`, 'error');
                     dispatch({ type: 'SET_ATTACHED_FILES', payload: attachedFiles.filter(f => !(f.name === file.name && f.isLoading)) });
                };

                if (supportedImageTypes.includes(file.type) || supportedPdfTypes.includes(file.type)) {
                    reader.readAsDataURL(file);
                } else if (supportedTextTypes.includes(file.type)) {
                    reader.readAsText(file);
                } else {
                    showToast(`Unsupported file type: ${file.name}`, 'error');
                    dispatch({ type: 'SET_ATTACHED_FILES', payload: attachedFiles.filter(f => !(f.name === file.name && f.isLoading)) });
                }
            });
        }
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

    const handleAnnotate = () => {
        dispatch({ type: 'SET_WHITEBOARD_OPEN', payload: true });
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
      
      let finalResult: { fullResponse: Message; newHistory: Content[] } | undefined;
      let result = await stream.next();
      while(!result.done) {
        dispatch({ type: 'UPDATE_STREAMING_MESSAGE', payload: { content: result.value } });
        result = await stream.next();
      }
      finalResult = result.value;

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
      dispatch({ type: 'SET_GENERATION_MODE', payload: mode });
  };

  const handleReset = useCallback(() => {
    if (messages.length > 0) {
        dispatch({ type: 'SET_CONFIRM_MODAL_OPEN', payload: true });
    }
  }, [messages.length]);

  const confirmReset = useCallback(() => {
      dispatch({ type: 'RESET_STATE' });
      dispatch({ type: 'SET_CONFIRM_MODAL_OPEN', payload: false });
  }, []);

  return (
    <>
      <div className="flex flex-col h-screen max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 box-border">
        <Header onOpenSettings={() => dispatch({ type: 'SET_API_KEY_MODAL_OPEN', payload: true })} onNewChat={handleReset} />
        
        <Toast toast={toast} onDismiss={() => dispatch({ type: 'SET_TOAST', payload: null })} />

        {apiKeyError && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md shadow-sm my-4" role="alert">
            <div className="flex items-center justify-between">
                <div className="flex items-center">
                    <AlertTriangle className="w-6 h-6 mr-3"/>
                    <div>
                        <p className="font-bold">Configuration Error</p>
                        <p>The Gemini API key is missing or invalid. Please add your key in settings.</p>
                    </div>
                </div>
                <button
                    onClick={() => dispatch({ type: 'SET_API_KEY_MODAL_OPEN', payload: true })}
                    className="ml-4 px-3 py-1.5 bg-red-500 text-white rounded-md text-sm font-semibold hover:bg-red-600 transition-colors flex items-center gap-2 whitespace-nowrap"
                    aria-label="Set API Key"
                >
                    <Settings className="w-4 h-4" />
                    Set API Key
                </button>
            </div>
          </div>
        )}

        {view === 'landing' && (
          <main className="flex-1 flex flex-col items-center overflow-y-auto">
              <div className="flex flex-col items-center text-center mt-20 sm:mt-24 gap-4">
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
                   <GenerationModeToggle mode={generationMode} setMode={handleModeChange} />
                   <InputArea 
                      input={input} 
                      setInput={(val) => dispatch({ type: 'SET_INPUT', payload: val })} 
                      handleSend={handleSend} 
                      handleKeyPress={handleKeyPress} 
                      isProcessing={isProcessing} 
                      apiKeyError={apiKeyError}
                      attachedFiles={attachedFiles}
                      onFileChange={handleFileChange}
                      onRemoveFile={removeFile}
                      onToggleListening={handleToggleListening}
                      isListening={isListening}
                      isSpeechRecognitionSupported={!!recognitionRef.current}
                      onAnnotate={handleAnnotate}
                      textareaRef={textareaRef}
                   />
                   <PromptSuggestions onSuggestionClick={handleSuggestionClick} />
              </div>
          </main>
        )}

        {view === 'chat' && (
          <div className="flex-1 flex flex-col w-full max-w-3xl mx-auto overflow-hidden">
               <div className="flex-1 overflow-y-auto space-y-6 p-2 pb-4">
                  {messages.map((msg) => (
                      <MessageBubble
                          key={msg.id}
                          msg={msg}
                          onCopy={copyToClipboard}
                          copiedId={copiedId}
                          onToggleThinking={toggleThinking}
                          expandedThinking={expandedThinking}
                          isStreaming={isProcessing && msg.id === messages[messages.length - 1].id}
                      />
                  ))}
                  <div ref={messagesEndRef} />
              </div>
              <div className="w-full max-w-3xl mx-auto py-4">
                  <GenerationModeToggle mode={generationMode} setMode={handleModeChange} />
                  <InputArea 
                        input={input} 
                        setInput={(val) => dispatch({ type: 'SET_INPUT', payload: val })} 
                        handleSend={handleSend} 
                        handleKeyPress={handleKeyPress} 
                        isProcessing={isProcessing} 
                        apiKeyError={apiKeyError}
                        attachedFiles={attachedFiles}
                        onFileChange={handleFileChange}
                        onRemoveFile={removeFile}
                        onToggleListening={handleToggleListening}
                        isListening={isListening}
                        isSpeechRecognitionSupported={!!recognitionRef.current}
                        onAnnotate={handleAnnotate}
                        textareaRef={textareaRef}
                  />
                  <PromptSuggestions onSuggestionClick={handleSuggestionClick} />
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