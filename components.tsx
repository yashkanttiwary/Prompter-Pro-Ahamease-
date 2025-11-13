import React, { useRef, useState, useEffect, useCallback, memo } from 'react';
import { 
    Copy, Check, CheckCircle, XCircle, 
    Paperclip, Mic, X, FileText, MousePointer2, Brush, Eraser, Undo2, Redo2, Trash2, Settings, Plus,
    Lightbulb, Bot, RefreshCw
} from 'lucide-react';
import { Message, AttachedFile, User } from './types';


// --- SVG Icons for Ahamease UI ---
export const SparkleIcon = ({ className = '' }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" />
    </svg>
);

export const SendIcon = ({ className = '' }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
    </svg>
);

// --- Reusable Components ---
export const SafeMarkdown: React.FC<{ text: string, className?: string, isStreaming?: boolean, isUser?: boolean }> = React.memo(({ text, className = '', isStreaming = false, isUser = false }) => {
    const processInlineFormatting = (text: string) => {
        const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
        return parts.map((part, j) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={j} className="font-semibold text-[--neutral-900]">{part.slice(2, -2)}</strong>;
            }
            if (part.startsWith('*') && part.endsWith('*')) {
                return <em key={j} className="italic">{part.slice(1, -1)}</em>;
            }
            if (part.startsWith('`') && part.endsWith('`')) {
                return <code key={j} className={`text-sm rounded px-1 py-0.5 font-mono ${isUser ? 'bg-orange-100/70 text-red-700' : 'bg-gray-100 text-red-600'}`}>{part.slice(1, -1)}</code>;
            }
            return part;
        });
    };

    const lines = text.split('\n');
    const elements: React.ReactElement[] = [];
    let listItems: React.ReactElement[] = [];

    const flushList = (key: string) => {
        if (listItems.length > 0) {
            elements.push(<ul key={key} className="list-disc space-y-1 my-2 pl-5">{listItems}</ul>);
            listItems = [];
        }
    };

    lines.forEach((line, i) => {
        const isListItem = line.trim().startsWith('- ') || line.trim().startsWith('* ');
        if (isListItem) {
            const content = line.trim().substring(2);
            listItems.push(<li key={i}>{processInlineFormatting(content)}</li>);
        } else {
            flushList(`ul-${i}`);
            if (line.trim() === '') {
                 if (i !== lines.length -1) elements.push(<p key={i} className="my-1 h-4" />);
            } else {
                elements.push(<p key={i} className="my-1">{processInlineFormatting(line)}</p>);
            }
        }
    });

    flushList('ul-last');

    const streamingCursor = isStreaming ? <span className={`inline-block w-2 h-4 ${isUser ? 'bg-[--neutral-800]' : 'bg-[--neutral-800]'} animate-pulse ml-1`} /> : null;

    return <div className={className}>{elements}{streamingCursor}</div>;
});

const SmallFilePreview = ({ files, isUser }: { files: AttachedFile[], isUser: boolean }) => {
    if (!files || files.length === 0) return null;

    return (
        <div className="pt-2 flex flex-wrap gap-2">
            {files.map((file, index) => (
                <div key={`${file.name}-${index}`} className={`border rounded-lg px-3 py-2 flex items-center gap-2 text-sm h-fit shadow-sm max-w-xs ${isUser ? 'bg-white/60 border-orange-200/60 text-[--neutral-800]' : 'bg-white border-[--neutral-100] text-[--neutral-800]'}`}>
                    {file.preview ? (
                        <img src={file.preview} alt={file.name} className="w-6 h-6 object-cover rounded" />
                    ) : (
                        <FileText className={`w-5 h-5 ${isUser ? 'text-gray-600' : 'text-gray-500'} flex-shrink-0`} />
                    )}
                    <span className="truncate" title={file.name}>{file.name}</span>
                </div>
            ))}
        </div>
    );
};

export const MessageBubble: React.FC<{ msg: Message; onCopy: (text: string, id: string) => void; copiedId: string | null; isStreaming: boolean }> = ({ msg, onCopy, copiedId, isStreaming }) => {
  const isUser = msg.role === 'user';
  const hasContent = msg.content && msg.content.trim() !== '';
  const hasAttachments = msg.type === 'chat' && msg.attachedFiles && msg.attachedFiles.length > 0;
  
  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} animate-slide-in-bottom`}>
      <div className={`message-bubble ${isUser ? 'is-user' : 'is-assistant'} max-w-3xl w-full ${isUser ? 'bg-[#FEFAF7] text-[--neutral-800]' : 'bg-white text-[--neutral-800]'} shadow-[var(--shadow-md)]`}>
        <div className="p-5">
           {isStreaming && !hasContent && (
               <div className="flex items-center gap-2">
                   <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[--neutral-700]"></div>
                   <span className="text-sm text-[--neutral-700]">Generating...</span>
               </div>
           )}
           {hasContent && <SafeMarkdown text={msg.content} isStreaming={isStreaming} isUser={isUser} />}
           {hasAttachments && <SmallFilePreview files={msg.attachedFiles!} isUser={isUser} />}
        </div>
        {msg.type === 'prompt' && (
          <div className="p-5 pt-0 space-y-4">
            <div className="border-2 border-[hsl(280,70%,85%)] rounded-lg bg-[hsl(280,70%,98%)] overflow-hidden">
              <div className="bg-[--primary] text-white px-4 py-2 flex items-center justify-between">
                <span className="font-semibold text-sm">📋 Production-Ready Prompt</span>
                <button
                  onClick={() => onCopy(msg.promptData.content, msg.id)}
                  className="flex items-center gap-2 bg-[hsl(280,70%,50%)] hover:bg-[hsl(280,70%,45%)] px-3 py-1 rounded-full text-sm transition-colors"
                  aria-label="Copy prompt"
                >
                  {copiedId === msg.id ? <><Check className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy</>}
                </button>
              </div>
              <div className="p-4 max-h-96 overflow-y-auto bg-white custom-scrollbar">
                <pre className="text-xs font-mono whitespace-pre-wrap text-[--neutral-800]">{msg.promptData.content}</pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};


export const Header = memo(({ onOpenSettings, onNewChat, view, mode, setMode }: { 
    onOpenSettings: () => void; 
    onNewChat: () => void; 
    view: 'landing' | 'chat';
    mode: 'PROMPT' | 'BUILD';
    setMode: (mode: 'PROMPT' | 'BUILD') => void;
}) => (
    <header className="py-8 w-full flex-shrink-0">
        <div className="flex justify-between items-center">
            <div className="flex-1 flex justify-start">
                <button onClick={onNewChat} className="flex items-center gap-2" aria-label="Ahamease, Start new chat">
                    <span className="text-3xl font-bold text-[--neutral-900]">Ahamease</span>
                    <SparkleIcon className="w-5 h-5 text-[--primary] -translate-y-2" />
                </button>
            </div>

            <div className="flex-1 flex justify-center">
                {view === 'chat' && (
                    <GenerationModeToggle mode={mode} setMode={setMode} />
                )}
            </div>

            <div className="flex-1 flex justify-end">
                <div className="flex items-center gap-4">
                     <button 
                        onClick={onNewChat}
                        aria-label="Start new chat"
                        className="hidden sm:inline-flex items-center gap-2 px-4 py-2 bg-white border border-[hsl(240,10%,85%)] rounded-full text-[--neutral-800] text-[15px] font-medium shadow-[var(--shadow-sm)] hover:bg-[--neutral-50] hover:shadow-[var(--shadow-md)] transition-all transform hover:-translate-y-0.5"
                    >
                        <Plus className="w-4 h-4" />
                        New Chat
                    </button>
                     <button
                        onClick={onOpenSettings}
                        aria-label="Open settings"
                        className="p-2.5 bg-white border border-[hsl(240,10%,85%)] rounded-full text-[--neutral-800] shadow-[var(--shadow-sm)] hover:bg-[--neutral-50] hover:shadow-[var(--shadow-md)] transition-all"
                    >
                        <Settings className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    </header>
));

const FilePreview = ({ files, onRemoveFile }: { files: AttachedFile[], onRemoveFile: (index: number) => void }) => {
    if (files.length === 0) return null;

    const getFileIcon = (mimeType: string) => {
        if (mimeType === 'application/pdf') return <FileText className="w-5 h-5 text-red-600 flex-shrink-0" />;
        return <Paperclip className="w-5 h-5 text-[--neutral-700] flex-shrink-0" />;
    };

    return (
        <div className="px-4 pt-3 flex flex-wrap gap-3">
            {files.map((file, index) => {
                if (file.isLoading) {
                    return (
                        <div key={`${file.name}-${index}`} className="relative w-20 h-20 rounded-lg flex items-center justify-center border bg-[--neutral-50] shadow-sm">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[--primary]"></div>
                        </div>
                    );
                }
                if (file.preview) { // Image thumbnail
                    return (
                        <div key={`${file.name}-${index}`} className="relative w-20 h-20 rounded-lg overflow-hidden group border border-[--neutral-100] shadow-sm">
                            <img src={file.preview} alt={file.name} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-colors flex items-center justify-center">
                                <button
                                    onClick={() => onRemoveFile(index)}
                                    className="absolute top-1 right-1 bg-black bg-opacity-50 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
                                    aria-label={`Remove ${file.name}`}
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    );
                }
                // File chip for non-image files
                return (
                    <div key={`${file.name}-${index}`} className="bg-white border border-[--neutral-100] rounded-lg px-3 py-2 flex items-center gap-2 text-sm text-[--neutral-800] h-fit shadow-sm max-w-xs">
                        {getFileIcon(file.mimeType)}
                        <span className="truncate" title={file.name}>{file.name}</span>
                        <button onClick={() => onRemoveFile(index)} aria-label={`Remove ${file.name}`} className="text-[--neutral-500] hover:text-[--neutral-900] flex-shrink-0 ml-auto">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                );
            })}
        </div>
    );
};

export const InputArea = ({ input, setInput, handleSend, handleKeyPress, isProcessing, apiKeyError, attachedFiles, onFileChange, onRemoveFile, onToggleListening, isListening, isSpeechRecognitionSupported, onAnnotate, textareaRef }: { input: string; setInput: (value: string) => void; handleSend: () => void; handleKeyPress: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void; isProcessing: boolean; apiKeyError: boolean; attachedFiles: AttachedFile[]; onFileChange: (files: FileList | null) => void; onRemoveFile: (index: number) => void; onToggleListening: () => void; isListening: boolean; isSpeechRecognitionSupported: boolean; onAnnotate: () => void; textareaRef: React.RefObject<HTMLTextAreaElement> }) => {
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(true);
    };
    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(false);
    };
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(false);
        onFileChange(e.dataTransfer.files);
    };

    return (
        <div className="w-full max-w-3xl mx-auto" onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
            <div className={`relative bg-white/60 backdrop-blur-xl border rounded-2xl shadow-[var(--shadow-lg)] transition-all duration-250 focus-within-ring ${isDraggingOver ? 'border-[--primary] shadow-2xl' : 'border-white/30'}`}>
                {isDraggingOver && (
                    <div className="absolute inset-0 bg-[--primary]/10 rounded-2xl flex items-center justify-center pointer-events-none">
                        <p className="font-semibold text-[--primary]">Drop files to attach</p>
                    </div>
                )}
                <FilePreview files={attachedFiles} onRemoveFile={onRemoveFile} />
                <div className="flex items-center gap-2 p-2.5 sm:p-3">
                     <button onClick={() => fileInputRef.current?.click()} className="cursor-pointer p-2.5 rounded-lg hover:bg-black/5 text-slate-600 transition-colors" aria-label="Attach file">
                        <Paperclip className="w-5 h-5" />
                    </button>
                    <input id="file-upload" type="file" multiple className="hidden" ref={fileInputRef} onChange={(e) => onFileChange(e.target.files)} accept="image/png, image/jpeg, image/webp, text/plain, application/pdf" />
                    
                    <button onClick={onAnnotate} className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-black/5 text-slate-600 transition-colors" aria-label="Open whiteboard for annotation">
                        <MousePointer2 className="w-5 h-5" />
                    </button>

                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyPress}
                        placeholder="Describe the prompt you want to create..."
                        className="flex-1 w-full border-none outline-none bg-transparent text-base font-normal leading-relaxed text-[--neutral-900] placeholder:text-slate-500 resize-none overflow-y-auto pr-2 custom-scrollbar"
                        style={{ minHeight: '3rem', maxHeight: '12rem', padding: '0.625rem 0' }} // 10px 0
                        rows={1}
                        disabled={isProcessing || apiKeyError}
                    />
                    <div className="flex items-center">
                        <button 
                            onClick={onToggleListening} 
                            className={`w-10 h-10 flex items-center justify-center rounded-lg hover:bg-black/5 transition-colors ${isListening ? 'text-[--primary]' : 'text-slate-600'} disabled:opacity-50 disabled:cursor-not-allowed`} 
                            aria-label="Use microphone for voice input"
                            disabled={!isSpeechRecognitionSupported}
                            title={!isSpeechRecognitionSupported ? 'Speech recognition not supported in this browser' : 'Use microphone'}
                        >
                            <Mic className="w-5 h-5" />
                        </button>
                        <button
                            onClick={handleSend}
                            disabled={(!input.trim() && attachedFiles.filter(f => !f.isLoading).length === 0) || isProcessing || apiKeyError}
                            className="w-10 h-10 flex items-center justify-center bg-[--neutral-800] rounded-lg text-white transition-all duration-200 transform hover:bg-[--neutral-900] hover:scale-105 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed disabled:transform-none disabled:opacity-70"
                            aria-label="Send message"
                        >
                           <SendIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const GenerationModeToggle = memo(({ mode, setMode }: { mode: 'PROMPT' | 'BUILD'; setMode: (mode: 'PROMPT' | 'BUILD') => void; }) => (
    <div className="p-1 bg-white/70 backdrop-blur-xl border border-gray-200/50 rounded-full flex items-center w-fit mx-auto shadow-sm">
        <button
            onClick={() => setMode('PROMPT')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${mode === 'PROMPT' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
            aria-pressed={mode === 'PROMPT'}
            title="Directly send your input to the model for a single-shot prompt generation."
        >
            <Lightbulb className="w-4 h-4" />
            Direct Prompt
        </button>
        <button
            onClick={() => setMode('BUILD')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${mode === 'BUILD' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
            aria-pressed={mode === 'BUILD'}
            title="Engage in a conversation with the AI to collaboratively build and refine your prompt."
        >
            <Bot className="w-4 h-4" />
            Build with AI
        </button>
    </div>
));

const FULL_SUGGESTIONS = [
    "Draft a tweet about a new AI feature launch",
    "Explain the ELI5 of black holes",
    "Write a Python script to organize files by extension",
    "Plan a 3-day trip to Tokyo",
    "Summarize the plot of 'Dune' in three paragraphs",
    "Generate a recipe for a vegan chocolate cake",
    "Create a catchy slogan for a new coffee brand",
    "Write a short, spooky story about a haunted library",
    "Translate 'Hello, how are you?' into Spanish and Japanese",
    "Compose a professional email asking for a deadline extension",
    "List three pros and cons of remote work",
    "Generate a workout plan for a beginner focusing on cardio",
];

const shuffleArray = <T,>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
};


export const PromptSuggestionChip = memo(({ text, onClick }: { text: string; onClick: (text: string) => void }) => (
    <button
        onClick={() => onClick(text)}
        className="px-3 py-1.5 bg-white/60 backdrop-blur-xl border border-gray-200/50 rounded-full text-xs text-[--neutral-700] hover:bg-black/5 hover:border-black/10 transition-colors shadow-sm"
    >
        {text}
    </button>
));

export const PromptSuggestions = memo(({ isVisible, onSuggestionClick, onDismiss }: { isVisible: boolean; onSuggestionClick: (text: string) => void, onDismiss: () => void }) => {
    const [currentSuggestions, setCurrentSuggestions] = useState<string[]>([]);
    
    const refreshSuggestions = useCallback(() => {
        setCurrentSuggestions(shuffleArray(FULL_SUGGESTIONS).slice(0, 4));
    }, []);

    useEffect(() => {
        refreshSuggestions();
    }, [refreshSuggestions]);
    
    if (!isVisible) return null;
    
    return (
        <div className="flex items-center justify-center gap-2 mt-3 flex-wrap px-4">
            {currentSuggestions.map((s) => <PromptSuggestionChip key={s} text={s} onClick={onSuggestionClick} />)}
            <div className="flex items-center gap-1">
                <button onClick={refreshSuggestions} aria-label="Refresh suggestions" className="p-1 text-gray-400 hover:text-gray-600 rounded-full">
                    <RefreshCw className="w-3 h-3" />
                </button>
                 <button onClick={onDismiss} aria-label="Dismiss suggestions" className="p-1 text-gray-400 hover:text-gray-600 rounded-full">
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
});

export const Toast = ({ toast, onDismiss }: { toast: { message: string, type: 'success' | 'error' } | null, onDismiss: () => void }) => {
    if (!toast) return null;

    const isSuccess = toast.type === 'success';

    return (
        <div
            role="alert"
            className={`fixed top-5 right-5 max-w-sm w-full bg-white shadow-[var(--shadow-lg)] rounded-lg p-4 flex items-center gap-3 border-l-4 ${isSuccess ? 'border-green-500' : 'border-red-500'} animate-fade-in-down z-50`}
        >
            {isSuccess ? <CheckCircle className="w-6 h-6 text-green-500" /> : <XCircle className="w-6 h-6 text-red-500" />}
            <p className="text-sm font-medium text-[--neutral-800] flex-1">{toast.message}</p>
            <button onClick={onDismiss} aria-label="Dismiss notification" className="ml-auto text-[--neutral-500] hover:text-[--neutral-800] flex-shrink-0">
                <X className="w-5 h-5" />
            </button>
        </div>
    );
};

export const ApiKeyModal = ({ isOpen, onClose, onSave, showToast }: { isOpen: boolean; onClose: () => void; onSave: (key: string) => void; showToast: (msg: string, type: 'success' | 'error') => void; }) => {
    const [apiKey, setApiKey] = useState('');

    useEffect(() => {
        if (isOpen) {
            setApiKey(localStorage.getItem('gemini-api-key') || '');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSave = () => {
        onSave(apiKey);
        onClose();
    };
    
    const handleClear = () => {
        setApiKey('');
        localStorage.removeItem('gemini-api-key');
        showToast('API Key cleared.', 'success');
    }

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center" onClick={onClose} role="dialog" aria-modal="true">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 m-4" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-[--neutral-900]">API Key Settings</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close settings">
                        <X className="w-6 h-6" />
                    </button>
                </div>
                <div className="bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800 p-3 rounded-md text-xs mb-4">
                    <strong>Security Notice:</strong> Your key is saved locally in your browser. Do not use this app on shared or public computers.
                </div>
                <div className="mb-4">
                    <label htmlFor="apiKeyInput" className="block text-sm font-medium text-gray-700 mb-1">Gemini API Key</label>
                    <input
                        id="apiKeyInput"
                        type="password"
                        value={apiKey}
                        onChange={e => setApiKey(e.target.value)}
                        placeholder="Enter your API key"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-[--primary] focus:border-[--primary] transition placeholder:text-gray-500"
                        autoComplete="off"
                    />
                </div>
                <div className="flex justify-between items-center">
                    <button onClick={handleClear} className="px-4 py-2 text-sm text-red-600 rounded-md hover:bg-red-50 transition">
                        Clear Key
                    </button>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-4 py-2 bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200 transition">
                            Cancel
                        </button>
                        <button onClick={handleSave} className="px-4 py-2 bg-[--primary] text-white rounded-md hover:bg-opacity-90 transition">
                            Save Key
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const ConfirmModal = ({ isOpen, onClose, onConfirm, title, description }: { isOpen: boolean; onClose: () => void; onConfirm: () => void; title: string; description: string }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="confirm-title">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 m-4" onClick={e => e.stopPropagation()}>
                <h2 id="confirm-title" className="text-xl font-bold text-[--neutral-900] mb-2">{title}</h2>
                <p className="text-sm text-gray-600 mb-6">{description}</p>
                <div className="flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200 transition">
                        Cancel
                    </button>
                    <button onClick={onConfirm} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition">
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    );
};


// --- Floating Whiteboard Component ---
interface WhiteboardProps {
    isOpen: boolean;
    onClose: () => void;
}

export const Whiteboard: React.FC<WhiteboardProps> = ({ isOpen, onClose }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const contextRef = useRef<CanvasRenderingContext2D | null>(null);

    const isDrawing = useRef(false);
    const isDragging = useRef(false);
    const dragOffset = useRef({ x: 0, y: 0 });
    const strokes = useRef<any[]>([]);
    const redoStack = useRef<any[]>([]);
    const currentStroke = useRef<any[]>([]);

    const [activeTool, setActiveTool] = useState('brush');
    const [brushSize, setBrushSize] = useState(8);
    const [color, setColor] = useState('#000000');
    const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });

    const updateHistoryState = useCallback(() => {
        setHistoryState({
            canUndo: strokes.current.length > 0,
            canRedo: redoStack.current.length > 0,
        });
    }, []);

    const redrawCanvas = useCallback(() => {
        if (!contextRef.current || !canvasRef.current) return;
        const ctx = contextRef.current;
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

        strokes.current.forEach(stroke => {
            if (stroke.length === 0) return;

            ctx.beginPath();
            ctx.moveTo(stroke[0].x, stroke[0].y);

            stroke.forEach((point: any, index: number) => {
                if (index === 0) return;
                ctx.lineWidth = point.size;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.globalCompositeOperation = point.tool === 'brush' ? 'source-over' : 'destination-out';
                ctx.strokeStyle = point.tool === 'brush' ? point.color : 'rgba(0,0,0,1)';
                ctx.lineTo(point.x, point.y);
                ctx.stroke();
            });
            ctx.beginPath(); // Reset path
        });
        updateHistoryState();
    }, [updateHistoryState]);

    const handleUndo = useCallback(() => {
        if (strokes.current.length === 0) return;
        const lastStroke = strokes.current.pop();
        if (lastStroke) redoStack.current.push(lastStroke);
        redrawCanvas();
    }, [redrawCanvas]);

    const handleRedo = useCallback(() => {
        if (redoStack.current.length === 0) return;
        const strokeToRedo = redoStack.current.pop();
        if (strokeToRedo) strokes.current.push(strokeToRedo);
        redrawCanvas();
    }, [redrawCanvas]);

    const handleClear = useCallback(() => {
        if (strokes.current.length > 0) {
             strokes.current = [];
             redoStack.current = [];
             redrawCanvas();
        }
    }, [redrawCanvas]);
    
    // Draggable header logic
    useEffect(() => {
        const container = containerRef.current;
        if (!container || !isOpen) return;

        const startDrag = (e: MouseEvent) => {
            const header = container.querySelector('.whiteboard-header');
            if (!header || !header.contains(e.target as Node)) return;
            isDragging.current = true;
            const rect = container.getBoundingClientRect();
            dragOffset.current = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
            };
            container.style.transform = 'none';
        };

        const drag = (e: MouseEvent) => {
            if (!isDragging.current) return;
            const x = e.clientX - dragOffset.current.x;
            const y = e.clientY - dragOffset.current.y;
            container.style.left = `${x}px`;
            container.style.top = `${y}px`;
        };

        const stopDrag = () => {
            isDragging.current = false;
        };

        document.addEventListener('mousedown', startDrag);
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', stopDrag);

        return () => {
            document.removeEventListener('mousedown', startDrag);
            document.removeEventListener('mousemove', drag);
            document.removeEventListener('mouseup', stopDrag);
        };
    }, [isOpen]);

    // Drawing logic
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !isOpen) return;
        
        contextRef.current = canvas.getContext('2d');
        const ctx = contextRef.current;
        if (!ctx) return;
        
        const getPos = (e: MouseEvent | TouchEvent) => {
            const rect = canvas.getBoundingClientRect();
            const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
            const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
            return { x: clientX - rect.left, y: clientY - rect.top };
        };

        const startDrawing = (e: MouseEvent | TouchEvent) => {
            e.preventDefault();
            isDrawing.current = true;
            const pos = getPos(e);
            currentStroke.current = [{ x: pos.x, y: pos.y, tool: activeTool, color, size: brushSize }];
            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);
        };

        const draw = (e: MouseEvent | TouchEvent) => {
            if (!isDrawing.current) return;
            e.preventDefault();
            const pos = getPos(e);
            ctx.lineWidth = brushSize;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.globalCompositeOperation = activeTool === 'brush' ? 'source-over' : 'destination-out';
            ctx.strokeStyle = activeTool === 'brush' ? color : 'rgba(0,0,0,1)';
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();
            currentStroke.current.push({ x: pos.x, y: pos.y, tool: activeTool, color, size: brushSize });
        };

        const stopDrawing = () => {
            if (!isDrawing.current) return;
            isDrawing.current = false;
            ctx.beginPath();
            if (currentStroke.current.length > 1) {
                strokes.current.push([...currentStroke.current]);
                redoStack.current = [];
            }
            currentStroke.current = [];
            updateHistoryState();
        };

        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', stopDrawing);
        canvas.addEventListener('mouseout', stopDrawing);
        canvas.addEventListener('touchstart', startDrawing, { passive: false });
        canvas.addEventListener('touchmove', draw, { passive: false });
        canvas.addEventListener('touchend', stopDrawing);

        return () => {
            canvas.removeEventListener('mousedown', startDrawing);
            canvas.removeEventListener('mousemove', draw);
            canvas.removeEventListener('mouseup', stopDrawing);
            canvas.removeEventListener('mouseout', stopDrawing);
            canvas.removeEventListener('touchstart', startDrawing);
            canvas.removeEventListener('touchmove', draw);
            canvas.removeEventListener('touchend', stopDrawing);
        };
    }, [isOpen, activeTool, brushSize, color, updateHistoryState]);

    // Keyboard shortcuts
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo(); }
            if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); handleRedo(); }
            if (e.key === 'b') setActiveTool('brush');
            if (e.key === 'e') setActiveTool('eraser');
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, handleUndo, handleRedo, onClose]);

    const BRUSH_SIZES = [2, 8, 15];

    return (
        <div id="whiteboard-container" ref={containerRef} className={isOpen ? 'visible flex' : 'hidden'} role="dialog" aria-labelledby="whiteboard-title">
            <div className="whiteboard-header">
                <h3 id="whiteboard-title">Whiteboard</h3>
                <button className="whiteboard-close" aria-label="Close Whiteboard" onClick={onClose}>×</button>
            </div>
            <div className="whiteboard-toolbar">
                <div className="flex items-center gap-2 flex-wrap">
                    <button className={`tool-btn ${activeTool === 'brush' ? 'active' : ''}`} onClick={() => setActiveTool('brush')} title="Brush (B)">
                        <Brush className="w-4 h-4" /> Brush
                    </button>
                    <button className={`tool-btn ${activeTool === 'eraser' ? 'active' : ''}`} onClick={() => setActiveTool('eraser')} title="Eraser (E)">
                        <Eraser className="w-4 h-4" /> Eraser
                    </button>
                    <div className="size-group" role="radiogroup" aria-label="Brush size">
                        {BRUSH_SIZES.map(size => (
                            <button key={size} className={`size-btn ${brushSize === size ? 'active' : ''}`} data-size={size} onClick={() => setBrushSize(size)} title={`${size}px`}>
                                <span className="size-dot"></span>
                            </button>
                        ))}
                    </div>
                    <div className="custom-color-picker">
                        <div className="color-swatch-container">
                            <div className="color-swatch" style={{ backgroundColor: color }}></div>
                            <input type="color" value={color} onChange={(e) => { setColor(e.target.value); setActiveTool('brush'); }} title="Pick Color" />
                        </div>
                        <span className="color-hex">{color}</span>
                    </div>
                    <button className="tool-btn" onClick={handleUndo} title="Undo (Ctrl+Z)" disabled={!historyState.canUndo}>
                        <Undo2 className="w-4 h-4" /> Undo
                    </button>
                    <button className="tool-btn" onClick={handleRedo} title="Redo (Ctrl+Y)" disabled={!historyState.canRedo}>
                        <Redo2 className="w-4 h-4" /> Redo
                    </button>
                     <button className="tool-btn" onClick={handleClear} title="Clear All" disabled={!historyState.canUndo}>
                        <Trash2 className="w-4 h-4" /> Clear
                    </button>
                </div>
            </div>
            <div className="canvas-wrapper">
                <canvas id="whiteboard-canvas" ref={canvasRef} width="560" height="400"></canvas>
            </div>
        </div>
    );
};