import React, { useRef, useState, useEffect, useCallback, memo } from 'react';
import { 
    Copy, Check, CheckCircle, XCircle, 
    Paperclip, Mic, X, FileText, Brush, Eraser, Undo2, Redo2, Trash2, Settings, Plus,
    Lightbulb, Bot, RefreshCw, Loader2, AlertTriangle, ArrowUp
} from 'lucide-react';
import { Message, AttachedFile, User } from './types';


// --- Language Detection Utility ---
const detectLanguage = (code: string): string => {
    // A simple heuristic-based language detector.
    if (!code) return 'txt';
    const lowerCaseCode = code.toLowerCase().trim();

    // Prioritize keywords that are less likely to overlap.
    if (/\b(def|import|from|class|elif|pip|lambda|yield)\b/i.test(lowerCaseCode) && !lowerCaseCode.includes('function')) {
        return 'python';
    }
    if (/\b(const|let|var|function|=>|import|from|export|class|extends|document|window)\b/i.test(lowerCaseCode) && !lowerCaseCode.includes('public class')) {
        return 'javascript';
    }
     if (/\b(SELECT|FROM|WHERE|INSERT INTO|UPDATE|DELETE FROM|GROUP BY|ORDER BY)\b/i.test(code)) {
        return 'sql';
    }
    if (/<[a-z][\s\S]*>/i.test(code) && (lowerCaseCode.includes('<!doctype html>') || lowerCaseCode.includes('<html>'))) {
        return 'html';
    }
    if (/([a-zA-Z0-9\s\-_#.]+)\s*\{[\s\S]*?\}/.test(code) && /:\s*.*?;/.test(code)) {
        return 'css';
    }
    
    return 'txt';
};


// --- Interactive Typing Orb Component ---
const TypingIndicatorOrb = ({ onClick, isProcessing }: { onClick: () => void; isProcessing: boolean; }) => {
    const orbRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        const orbEl = orbRef.current;
        if (!orbEl) return;

        const handleMouseMove = (e: MouseEvent) => {
            const rect = orbEl.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            orbEl.style.setProperty('--orb-mouse-x', `${(x / rect.width) * 100}%`);
            orbEl.style.setProperty('--orb-mouse-y', `${(y / rect.height) * 100}%`);
        };

        const handleMouseLeave = () => {
            // Reset to default highlight position
            orbEl.style.setProperty('--orb-mouse-x', `40%`);
            orbEl.style.setProperty('--orb-mouse-y', `35%`);
        };

        orbEl.addEventListener('mousemove', handleMouseMove);
        orbEl.addEventListener('mouseleave', handleMouseLeave);

        return () => {
            orbEl.removeEventListener('mousemove', handleMouseMove);
            orbEl.removeEventListener('mouseleave', handleMouseLeave);
        };
    }, []);

    return (
        <button
            ref={orbRef}
            onClick={onClick}
            disabled={isProcessing}
            className="typing-orb relative group disabled:cursor-not-allowed"
            aria-label="Correct grammar and complete sentence"
            title="Correct grammar and complete sentence"
        >
            {isProcessing && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-200/50 rounded-full">
                    <RefreshCw className="w-4 h-4 text-slate-600 animate-spin" />
                </div>
            )}
            {!isProcessing && (
                <div className="absolute bottom-full mb-2 w-max max-w-xs px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    Fix & Complete
                    <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-gray-900"></div>
                </div>
            )}
        </button>
    );
};


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
  
  const isShowingGeneratingIndicator = isStreaming && !hasContent;
  const language = msg.type === 'prompt' ? detectLanguage(msg.promptData.content) : 'txt';


  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} animate-slide-in-bottom`}>
      <div className={`message-bubble ${isUser ? 'is-user' : 'is-assistant'} max-w-3xl ${isUser || isShowingGeneratingIndicator ? 'w-fit' : 'w-full'} ${isUser ? 'bg-[#F1F2F5] text-[--neutral-800]' : 'bg-white text-[--neutral-800]'} shadow-[var(--shadow-md)]`}>
        <div className="p-5">
           {isShowingGeneratingIndicator && (
               <div className="flex items-center gap-3">
                   <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
                   <span className="text-sm font-medium text-slate-600">Generating...</span>
               </div>
           )}
           {hasContent && <SafeMarkdown text={msg.content} isStreaming={isStreaming} isUser={isUser} />}
           {hasAttachments && <SmallFilePreview files={msg.attachedFiles!} isUser={isUser} />}
        </div>
        {msg.type === 'prompt' && (
          <div className="p-5 pt-0 space-y-4">
            <div className="bg-[--neutral-50] rounded-lg overflow-hidden border border-gray-200/80 shadow-sm">
              <div className="px-4 py-2 border-b border-gray-200/80 flex items-center justify-between bg-white/50">
                <span className="text-xs text-gray-500 font-mono select-none non-selectable">
                   {language}
                </span>
                <button
                  onClick={() => onCopy(msg.promptData.content, msg.id)}
                  className="flex items-center gap-2 text-gray-600 hover:text-[--neutral-900] text-sm transition-colors"
                  aria-label="Copy prompt"
                >
                  {copiedId === msg.id ? (
                    <>
                      <Check className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-medium">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span className="text-sm font-medium">Copy</span>
                    </>
                  )}
                </button>
              </div>
              <div className="p-4 max-h-96 overflow-y-auto custom-scrollbar">
                <pre className="text-sm font-mono whitespace-pre-wrap text-[--neutral-800] leading-relaxed">{msg.promptData.content}</pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};


export const Header = memo(({ onOpenSettings, onNewChat, view, mode, setMode, isProcessing }: { 
    onOpenSettings: () => void; 
    onNewChat: () => void; 
    view: 'landing' | 'chat';
    mode: 'PROMPT' | 'BUILD';
    setMode: (mode: 'PROMPT' | 'BUILD') => void;
    isProcessing: boolean;
}) => (
    <header className="py-8 w-full flex-shrink-0">
        <div className="flex justify-between items-center">
            <div className="flex-1 flex justify-start">
                <button onClick={onNewChat} className="flex items-center gap-2" aria-label="Ahamease, Start new chat">
                    <span className="text-3xl font-bold text-[--neutral-900]">Ahamease</span>
                </button>
            </div>

            <div className="flex-1 flex justify-center">
                {view === 'chat' && (
                    <GenerationModeToggle mode={mode} setMode={setMode} isProcessing={isProcessing} />
                )}
            </div>

            <div className="flex-1 flex justify-end">
                <div className="flex items-center gap-2">
                     <button 
                        onClick={onNewChat}
                        aria-label="Start new chat"
                        className="hidden sm:inline-flex items-center gap-2 px-4 py-1.5 bg-white/70 backdrop-blur-xl border border-gray-200/50 rounded-full text-sm font-medium text-gray-800 shadow-sm hover:text-gray-900 hover:bg-white/90 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        New Chat
                    </button>
                     <button
                        onClick={onOpenSettings}
                        aria-label="Open settings"
                        className="flex items-center justify-center w-9 h-9 bg-white/70 backdrop-blur-xl border border-gray-200/50 rounded-full text-gray-800 shadow-sm hover:text-gray-900 hover:bg-white/90 transition-colors"
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

export const InputArea = ({ input, setInput, handleSend, handleKeyPress, isProcessing, isOrbProcessing, onOrbClick, apiKeyError, attachedFiles, onFileChange, onRemoveFile, onToggleListening, isListening, isSpeechRecognitionSupported, textareaRef }: { input: string; setInput: (value: string) => void; handleSend: () => void; handleKeyPress: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void; isProcessing: boolean; isOrbProcessing: boolean; onOrbClick: () => void; apiKeyError: boolean; attachedFiles: AttachedFile[]; onFileChange: (files: FileList | null) => void; onRemoveFile: (index: number) => void; onToggleListening: () => void; isListening: boolean; isSpeechRecognitionSupported: boolean; textareaRef: React.RefObject<HTMLTextAreaElement> }) => {
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const isTyping = input.trim().length > 0;

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
            <div className={`relative bg-white/60 backdrop-blur-xl border rounded-2xl shadow-[var(--shadow-lg)] transition-all duration-250 focus-within-ring flex flex-col ${isDraggingOver ? 'border-[--primary] shadow-2xl' : 'border-white/30'}`}>
                {isDraggingOver && (
                    <div className="absolute inset-0 bg-[--primary]/10 rounded-2xl flex items-center justify-center pointer-events-none z-10">
                        <p className="font-semibold text-[--primary]">Drop files to attach</p>
                    </div>
                )}
                <FilePreview files={attachedFiles} onRemoveFile={onRemoveFile} />
                <div className="flex-1 p-3">
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyPress}
                        placeholder="Describe the prompt you want to create..."
                        className="w-full border-none outline-none bg-transparent text-base font-normal leading-relaxed text-[--neutral-900] placeholder:text-slate-500 resize-none overflow-y-hidden custom-scrollbar"
                        style={{ minHeight: '3rem' }}
                        rows={1}
                        disabled={isProcessing || isOrbProcessing || apiKeyError}
                    />
                </div>
                <div className="flex items-center justify-between gap-2 p-2.5 sm:p-3 pt-0">
                    <div className="flex items-center gap-2">
                        <button onClick={() => fileInputRef.current?.click()} className="cursor-pointer w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/5 text-slate-600 transition-colors" aria-label="Attach file">
                            <Plus className="w-5 h-5" />
                        </button>
                        <input id="file-upload" type="file" multiple className="hidden" ref={fileInputRef} onChange={(e) => onFileChange(e.target.files)} accept="image/png, image/jpeg, image/webp, text/plain, application/pdf" />
                        <div className={`transition-all duration-300 ${isTyping ? 'w-8 opacity-100' : 'w-0 opacity-0'}`}>
                            {isTyping && <TypingIndicatorOrb onClick={onOrbClick} isProcessing={isOrbProcessing} />}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={onToggleListening} 
                            className={`w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/5 transition-colors ${isListening ? 'text-[--primary]' : 'text-slate-600'} disabled:opacity-50 disabled:cursor-not-allowed`} 
                            aria-label="Use microphone for voice input"
                            disabled={!isSpeechRecognitionSupported}
                            title={!isSpeechRecognitionSupported ? 'Speech recognition not supported in this browser' : 'Use microphone'}
                        >
                            <Mic className="w-5 h-5" />
                        </button>
                        <button
                            onClick={handleSend}
                            disabled={(!input.trim() && attachedFiles.filter(f => !f.isLoading).length === 0) || isProcessing || apiKeyError}
                            className="w-10 h-10 flex items-center justify-center bg-[--neutral-800] rounded-full text-white transition-all duration-200 transform hover:bg-[--neutral-900] hover:scale-105 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed disabled:transform-none disabled:opacity-70"
                            aria-label="Send message"
                        >
                           {isProcessing ? (
                                <RefreshCw className="w-5 h-5 animate-spin" />
                            ) : (
                                <ArrowUp className="w-5 h-5" />
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const GenerationModeToggle = memo(({ mode, setMode, isProcessing }: { mode: 'PROMPT' | 'BUILD'; setMode: (mode: 'PROMPT' | 'BUILD') => void; isProcessing: boolean }) => (
    <div className="p-1 bg-white/70 backdrop-blur-xl border border-gray-200/50 rounded-full flex items-center w-fit mx-auto shadow-sm">
        <button
            onClick={() => setMode('PROMPT')}
            disabled={isProcessing}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${mode === 'PROMPT' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'} disabled:opacity-70 disabled:cursor-not-allowed`}
            aria-pressed={mode === 'PROMPT'}
            title="Directly send your input to the model for a single-shot prompt generation."
        >
            <Lightbulb className={`w-4 h-4 ${isProcessing && mode === 'PROMPT' ? 'animate-spin' : ''}`} />
            Direct Prompt
        </button>
        <button
            onClick={() => setMode('BUILD')}
            disabled={isProcessing}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${mode === 'BUILD' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'} disabled:opacity-70 disabled:cursor-not-allowed`}
            aria-pressed={mode === 'BUILD'}
            title="Engage in a conversation with the AI to collaboratively build and refine your prompt."
        >
            <Bot className={`w-4 h-4 ${isProcessing && mode === 'BUILD' ? 'animate-spin' : ''}`} />
            Build with AI
        </button>
    </div>
));

const SuggestionSkeleton = () => (
    <div className="w-full h-8 bg-gray-200/50 rounded-full animate-pulse"></div>
);

export const PromptSuggestionChip = memo(({ text, onClick }: { text: string; onClick: (text: string) => void }) => (
    <button
        onClick={() => onClick(text)}
        className="px-3 py-1.5 bg-white/60 backdrop-blur-xl border border-white/30 rounded-full text-xs text-slate-700 hover:bg-white/80 hover:border-white/50 hover:text-slate-900 hover:scale-105 transition-all duration-200 shadow-md text-left"
    >
        {text}
    </button>
));

export const PromptSuggestions = memo(({ 
    isVisible, 
    suggestions, 
    isLoading, 
    onSuggestionClick, 
    onDismiss, 
    onRefresh 
}: { 
    isVisible: boolean; 
    suggestions: string[];
    isLoading: boolean;
    onSuggestionClick: (text: string) => void;
    onDismiss: () => void;
    onRefresh: () => void;
}) => {
    if (!isVisible) return null;
    
    return (
        <div className="mt-4 flex flex-col items-center gap-2">
            <div className="grid grid-cols-2 gap-2 w-full max-w-lg">
                {isLoading 
                    ? Array.from({ length: 4 }).map((_, i) => <SuggestionSkeleton key={i} />)
                    : suggestions.map((s) => <PromptSuggestionChip key={s} text={s} onClick={onSuggestionClick} />)
                }
            </div>
            <div className="flex items-center gap-1 mt-1">
                <button onClick={onRefresh} aria-label="Refresh suggestions" className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full transition-colors bg-white/50 hover:bg-white/80 disabled:opacity-50" disabled={isLoading}>
                    <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
                 <button onClick={onDismiss} aria-label="Dismiss suggestions" className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full transition-colors bg-white/50 hover:bg-white/80">
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
            className={`fixed top-5 right-5 max-w-sm w-full bg-white/70 backdrop-blur-xl shadow-2xl rounded-xl border border-white/30 p-4 flex items-center gap-4 z-50 animate-slide-in-bottom`}
        >
            <div className={`relative flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full ${isSuccess ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                {isSuccess 
                    ? <CheckCircle className="w-5 h-5 text-green-600" /> 
                    : <XCircle className="w-5 h-5 text-red-600" />
                }
                <div className={`absolute inset-0 rounded-full ${isSuccess ? 'shadow-[0_0_12px_2px_rgba(22,163,74,0.4)]' : 'shadow-[0_0_12px_2px_rgba(239,68,68,0.4)]'} animate-ping opacity-50`}></div>
            </div>
            <p className="text-sm font-medium text-slate-800 flex-1">{toast.message}</p>
            <button onClick={onDismiss} aria-label="Dismiss notification" className="ml-auto text-slate-500 hover:text-slate-800 flex-shrink-0 rounded-full p-1 hover:bg-black/5 transition-colors">
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose} role="dialog" aria-modal="true">
            <div 
                className="bg-white/70 backdrop-blur-2xl rounded-2xl shadow-2xl w-full max-w-md p-6 border border-white/40 animate-slide-in-bottom" 
                onClick={e => e.stopPropagation()}
                style={{ animationDuration: '0.3s' }}
            >
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-slate-900">API Key Settings</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 rounded-full p-1 hover:bg-black/5 transition-colors" aria-label="Close settings">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="bg-amber-400/10 backdrop-blur-sm rounded-lg p-3 text-amber-900 flex items-start gap-3 text-xs mb-6 border border-amber-400/20 shadow-inner">
                    <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0"/>
                    <div>
                        <strong className="font-semibold">Security Notice:</strong> Your key is saved locally in your browser. Do not use this app on shared or public computers.
                    </div>
                </div>

                <div className="mb-6">
                    <label htmlFor="apiKeyInput" className="block text-sm font-medium text-slate-700 mb-2">Gemini API Key</label>
                    <input
                        id="apiKeyInput"
                        type="password"
                        value={apiKey}
                        onChange={e => setApiKey(e.target.value)}
                        placeholder="Enter your API key"
                        className="w-full px-4 py-2.5 bg-white/40 border border-white/20 rounded-lg shadow-inner text-slate-800 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-400/50 focus:border-purple-400 transition"
                        autoComplete="off"
                    />
                </div>

                <div className="flex justify-between items-center">
                    <button onClick={handleClear} className="px-4 py-2 text-sm font-medium text-red-600 rounded-lg hover:bg-red-500/10 transition-colors">
                        Clear Key
                    </button>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-5 py-2.5 bg-white/50 text-slate-800 font-medium rounded-lg hover:bg-white/80 transition-colors shadow-md border border-white/20">
                            Cancel
                        </button>
                        <button 
                            onClick={handleSave} 
                            className="px-5 py-2.5 bg-gradient-to-br from-purple-600 to-indigo-600 text-white font-semibold rounded-lg shadow-lg hover:scale-105 transition-transform duration-200"
                        >
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="confirm-title">
            <div 
                className="bg-white/70 backdrop-blur-2xl rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-white/40 animate-slide-in-bottom" 
                onClick={e => e.stopPropagation()}
                style={{ animationDuration: '0.3s' }}
            >
                <h2 id="confirm-title" className="text-2xl font-bold text-slate-900 mb-3">{title}</h2>
                <p className="text-sm text-slate-700 mb-6">{description}</p>
                <div className="flex justify-end gap-3">
                    <button 
                        onClick={onClose} 
                        className="px-5 py-2.5 bg-white/50 text-slate-800 font-medium rounded-lg hover:bg-white/80 transition-colors shadow-md border border-white/20"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={onConfirm} 
                        className="px-5 py-2.5 bg-gradient-to-br from-red-500 to-orange-500 text-white font-semibold rounded-lg shadow-lg hover:scale-105 transition-transform duration-200"
                    >
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
            container.style.transform = 'none'; // Switch to absolute positioning
        };

        const drag = (e: MouseEvent) => {
            if (!isDragging.current) return;
            // Prevent text selection while dragging
            e.preventDefault();
            const x = e.clientX - dragOffset.current.x;
            const y = e.clientY - dragOffset.current.y;
            container.style.left = `${x}px`;
            container.style.top = `${y}px`;
        };

        const stopDrag = () => {
            isDragging.current = false;
        };
        
        // Use document to capture mouse events everywhere
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

    if (!isOpen) return null;

    return (
        <div id="whiteboard-container" ref={containerRef} role="dialog" aria-labelledby="whiteboard-title">
            <div className="whiteboard-header">
                <h3 id="whiteboard-title">Whiteboard</h3>
                <button className="whiteboard-close" aria-label="Close Whiteboard" onClick={onClose}>
                    <X className="w-5 h-5" />
                </button>
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