import React, { useRef, useState, useEffect, useCallback, memo, useLayoutEffect } from 'react';
import { 
    Copy, Check, ChevronDown, ChevronRight, RefreshCw, CheckCircle, XCircle, 
    Paperclip, Mic, X, FileText, PenTool, Undo2, Trash2, Eraser, 
    Save, Redo2, Sparkles, Brush
} from 'lucide-react';
import { Message, AttachedFile } from './types';


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
export const SafeMarkdown: React.FC<{ text: string, className?: string, isStreaming?: boolean }> = React.memo(({ text, className = '', isStreaming = false }) => {
    const processInlineFormatting = (text: string) => {
        const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
        return parts.map((part, j) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={j} className="font-semibold text-[--neutral-900]">{part.slice(2, -2)}</strong>;
            }
            if (part.startsWith('*') && part.endsWith('*')) {
                return <em key={j} className="italic">{part.slice(1, -1)}</em>;
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
                elements.push(<p key={i} className="my-1 h-4" />);
            } else {
                elements.push(<p key={i} className="my-1">{processInlineFormatting(line)}</p>);
            }
        }
    });

    flushList('ul-last');

    const streamingCursor = isStreaming ? <span className="inline-block w-2 h-4 bg-[--neutral-800] animate-pulse ml-1" /> : null;

    return <div className={className}>{elements}{streamingCursor}</div>;
});


export const ThinkingSection: React.FC<{ msg: Message; index: number; expanded: boolean; onToggle: () => void }> = ({ msg, index, expanded, onToggle }) => {
  if (!msg.thinking || msg.role !== 'assistant') return null;
  const { thinking } = msg;

  return (
    <div className="border-t border-[hsl(240,10%,90%)] bg-white mt-4 pt-4">
      <button
        onClick={onToggle}
        className="w-full px-4 py-2 flex items-center justify-between hover:bg-[--neutral-50] transition-colors rounded-md"
        aria-expanded={expanded}
        aria-controls={`thinking-content-${msg.id}`}
      >
        <span className="text-sm font-medium text-[--neutral-700] flex items-center gap-2">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          Show Analysis & Reasoning
        </span>
      </button>

      {expanded && thinking && (
        <div id={`thinking-content-${msg.id}`} className="px-4 pb-2 pt-2 space-y-3 text-sm">
          <div>
            <h4 className="font-semibold text-[--neutral-800] mb-1">Approach:</h4>
            <p className="text-[--neutral-700] text-xs">{thinking.approach}</p>
          </div>
          <div>
            <h4 className="font-semibold text-[--neutral-800] mb-1">Assumptions:</h4>
            <ul className="list-disc list-inside text-xs text-[--neutral-700] space-y-1">
              {thinking.assumptions.map((a, i) => <li key={i}>{a}</li>)}
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-[--neutral-800] mb-1">Reasoning Summary:</h4>
            <ul className="list-disc list-inside text-xs text-[--neutral-700] space-y-1">
              {thinking.reasoning.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export const MessageBubble: React.FC<{ msg: Message; onCopy: (text: string, id: string) => void; copiedId: string | null; onToggleThinking: (id: string) => void; expandedThinking: { [key: string]: boolean }, isStreaming: boolean }> = ({ msg, onCopy, copiedId, onToggleThinking, expandedThinking, isStreaming }) => {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
      <div className={`max-w-3xl w-full ${isUser ? 'bg-white' : 'bg-white'} border border-[hsl(240,10%,92%)] rounded-xl shadow-[var(--shadow-md)] overflow-hidden`}>
        <div className={`p-5 text-[--neutral-800]`}>
           <SafeMarkdown text={msg.content} isStreaming={isStreaming && !isUser} />
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
              <div className="p-4 max-h-96 overflow-y-auto bg-white">
                <pre className="text-xs font-mono whitespace-pre-wrap text-[--neutral-800]">{msg.promptData.content}</pre>
              </div>
            </div>
          </div>
        )}
        <ThinkingSection msg={msg} index={0} expanded={!!expandedThinking[msg.id]} onToggle={() => onToggleThinking(msg.id)} />
      </div>
    </div>
  );
};


export const Header = memo(({ onShare }: { onShare: () => void }) => (
    <header className="py-8 w-full">
        <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 cursor-pointer">
                <span className="text-3xl font-bold text-[--neutral-900]">Ahamease</span>
                <SparkleIcon className="w-5 h-5 text-[--primary] -translate-y-2" />
            </div>
            <button 
                onClick={onShare}
                aria-label="Share chat"
                className="hidden sm:inline-flex items-center gap-2 px-4 py-2 bg-white border border-[hsl(240,10%,85%)] rounded-full text-[--neutral-800] text-[15px] font-medium shadow-[var(--shadow-sm)] hover:bg-[--neutral-50] hover:shadow-[var(--shadow-md)] transition-all transform hover:-translate-y-0.5"
            >
                Share
            </button>
        </div>
    </header>
));

export const ExampleCard = memo(({ text, onClick }: { text: string; onClick: () => void }) => (
    <button
        onClick={onClick}
        className="w-full text-left p-6 bg-white border border-[--neutral-100] rounded-xl shadow-[var(--shadow-sm)] transition-all duration-250 transform hover:-translate-y-1 hover:border-[--primary] hover:shadow-[var(--shadow-lg)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[--primary]"
    >
        <p className="text-[15px] text-[--neutral-800] leading-relaxed">{text}</p>
    </button>
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
        <div className="w-full max-w-3xl mx-auto pointer-events-auto" onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
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
                    
                    <button onClick={onAnnotate} className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-black/5 text-slate-600 transition-colors" aria-label="Open whiteboard">
                        <PenTool className="w-5 h-5" />
                    </button>

                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyPress}
                        placeholder="Describe the prompt you want to create..."
                        className="flex-1 w-full border-none outline-none bg-transparent text-base font-normal leading-relaxed text-[--neutral-900] placeholder:text-slate-500 resize-none overflow-y-auto pr-2"
                        style={{ minHeight: '3rem', maxHeight: '12rem', padding: '0.625rem 0' }} // 10px 0
                        rows={1}
                        disabled={isProcessing || apiKeyError}
                    />
                    <div className="flex items-center">
                        <button 
                            onClick={onToggleListening} 
                            className={`w-10 h-10 flex items-center justify-center rounded-lg hover:bg-black/5 transition-colors ${isListening ? 'text-[--primary]' : 'text-slate-600'} disabled:opacity-50 disabled:cursor-not-allowed`} 
                            aria-label="Use microphone"
                            disabled={!isSpeechRecognitionSupported}
                            title={!isSpeechRecognitionSupported ? 'Speech recognition not supported in this browser' : 'Use microphone'}
                        >
                            <Mic className="w-5 h-5" />
                        </button>
                        <button
                            onClick={handleSend}
                            disabled={(!input.trim() && attachedFiles.filter(f => !f.isLoading).length === 0) || isProcessing || apiKeyError}
                            className="w-10 h-10 flex items-center justify-center bg-[--neutral-800] rounded-lg text-white transition-all duration-200 transform hover:bg-[--neutral-900] hover:scale-105 disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed disabled:transform-none disabled:opacity-70"
                            aria-label="Send prompt"
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
    <div className="p-1 bg-white/70 backdrop-blur-xl border border-gray-200/50 rounded-full flex items-center w-fit mx-auto shadow-sm mb-3">
        <button
            onClick={() => setMode('PROMPT')}
            className={`px-5 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${mode === 'PROMPT' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
            aria-pressed={mode === 'PROMPT'}
        >
            Direct Prompt
        </button>
        <button
            onClick={() => setMode('BUILD')}
            className={`px-5 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${mode === 'BUILD' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
            aria-pressed={mode === 'BUILD'}
        >
            Build with AI
        </button>
    </div>
));

const SUGGESTIONS = [
    "Draft a tweet about a new AI feature launch",
    "Explain the ELI5 of black holes",
    "Write a Python script to organize files by extension",
    "Plan a 3-day trip to Tokyo",
];

export const PromptSuggestionChip = memo(({ text, onClick }: { text: string; onClick: (text: string) => void }) => (
    <button
        onClick={() => onClick(text)}
        className="px-3 py-1.5 bg-white/60 backdrop-blur-xl border border-gray-200/50 rounded-full text-xs text-[--neutral-700] hover:bg-black/5 hover:border-black/10 transition-colors shadow-sm"
    >
        {text}
    </button>
));

export const PromptSuggestions = memo(({ onSuggestionClick }: { onSuggestionClick: (text: string) => void }) => {
    return (
        <div className="flex items-center justify-center gap-2 mt-3 flex-wrap px-4">
            {SUGGESTIONS.map((s) => <PromptSuggestionChip key={s} text={s} onClick={onSuggestionClick} />)}
        </div>
    );
});


export const NewPromptButton = ({ onClick }: { onClick: () => void }) => (
    <button
        onClick={onClick}
        className="pointer-events-auto inline-flex items-center gap-3 px-6 py-3 bg-white border border-[hsl(240,10%,85%)] rounded-full text-[--neutral-800] text-base font-medium shadow-[var(--shadow-md)] hover:bg-[--neutral-50] hover:shadow-[var(--shadow-lg)] transition-all transform hover:-translate-y-0.5"
    >
        <RefreshCw className="w-5 h-5 text-[--primary]" />
        Start New Prompt
    </button>
);

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

// --- Whiteboard Component (Rebuilt for Reliability) ---
type Tool = 'brush' | 'eraser' | 'delete';

const FRAME_RATIOS: { [key: string]: number | null } = {
    '1:1': 1, '2:3': 2/3, '3:2': 3/2, '4:3': 4/3, '16:9': 16/9, '9:16': 9/16, '21:9': 21/9, 'Custom': null
};
const PRESET_COLORS = ["#000000","#263238","#546E7A","#90A4AE","#F44336","#E91E63","#9C27B0","#673AB7","#3F51B5","#03A9F4","#00BCD4","#009688","#4CAF50","#8BC34A","#FFC107","#FF9800","#FF5722","#795548","#9E9E9E","#7C4DFF"];

const TOOLS_CONFIG = [
    { id: 'brush' as const, icon: Brush, type: 'brush' as const, cursor: 'crosshair', hotkey: 'b' },
    { id: 'eraser' as const, icon: Eraser, type: 'eraser' as const, cursor: 'grab', hotkey: 'e' },
    { id: 'delete' as const, icon: Trash2, type: 'action' as const, cursor: 'default', hotkey: 'Delete' },
];

interface WhiteboardProps {
    isOpen: boolean;
    onClose: () => void;
    onGenerate: (imageDataUrl: string, prompt: string) => void;
}

export const Whiteboard: React.FC<WhiteboardProps> = ({ isOpen, onClose, onGenerate }) => {
    // Refs for canvas and drawing state that shouldn't trigger re-renders
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const contextRef = useRef<CanvasRenderingContext2D | null>(null);
    const whiteboardContainerRef = useRef<HTMLDivElement>(null);
    const isDrawing = useRef(false);
    const hasMoved = useRef(false);
    const lastCoords = useRef({ x: 0, y: 0 });

    // State for tool settings that should trigger UI re-renders
    const [activeTool, setActiveTool] = useState<Tool>('brush');
    const [color, setColor] = useState('#263238');
    const [brushSize, setBrushSize] = useState(3);
    const [frameRatioKey, setFrameRatioKey] = useState('1:1');
    const [customRatio, setCustomRatio] = useState('16:10');
    const [isCustomRatioValid, setIsCustomRatioValid] = useState(true);
    const [promptText, setPromptText] = useState('');
    const [history, setHistory] = useState<ImageData[]>([]);
    const [redoHistory, setRedoHistory] = useState<ImageData[]>([]);

    const redrawCanvasFromHistory = useCallback(() => {
        if (!contextRef.current || !canvasRef.current) return;
        const context = contextRef.current;
        const lastState = history[history.length - 1];
        context.clearRect(0, 0, context.canvas.width, context.canvas.height);
        if (lastState) {
            context.putImageData(lastState, 0, 0);
        }
    }, [history]);

    const resizeCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || !canvas.parentElement?.parentElement) return;
        
        const context = canvas.getContext('2d');
        const container = canvas.parentElement.parentElement;
        
        let ratio: number | null = FRAME_RATIOS[frameRatioKey];
        if (frameRatioKey === 'Custom') {
            const match = customRatio.match(/^(\d+(\.\d+)?):(\d+(\.\d+)?)$/);
            ratio = match ? parseFloat(match[1]) / parseFloat(match[3]) : null;
            setIsCustomRatioValid(!!match);
        }

        const containerWidth = container.clientWidth - 32;
        const containerHeight = container.clientHeight - 32;
        let newWidth = containerWidth;
        let newHeight = containerHeight;

        if (ratio) {
            newWidth = (containerWidth / containerHeight > ratio) ? containerHeight * ratio : containerWidth;
            newHeight = (containerWidth / containerHeight > ratio) ? containerHeight : containerWidth / ratio;
        }
        
        canvas.style.width = `${newWidth}px`;
        canvas.style.height = `${newHeight}px`;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = newWidth * dpr;
        canvas.height = newHeight * dpr;

        if (context) {
            context.scale(dpr, dpr);
            contextRef.current = context;
            redrawCanvasFromHistory();
        }
    }, [frameRatioKey, customRatio, redrawCanvasFromHistory]);
    
    useLayoutEffect(() => {
        if (!isOpen || !canvasRef.current || !whiteboardContainerRef.current) return;
        contextRef.current = canvasRef.current.getContext('2d');
        resizeCanvas();
        const container = whiteboardContainerRef.current.querySelector('.flex-grow');
        if (!container) return;
        const observer = new ResizeObserver(() => resizeCanvas());
        observer.observe(container);
        return () => observer.disconnect();
    }, [isOpen, resizeCanvas]);

    useEffect(() => {
        if (isOpen) resizeCanvas();
    }, [frameRatioKey, customRatio, isOpen, resizeCanvas]);
    
    const saveToHistory = useCallback(() => {
        if (!canvasRef.current || !contextRef.current) return;
        const imageData = contextRef.current.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
        setHistory(prev => [...prev.slice(-30), imageData]);
        setRedoHistory([]);
    }, []);

    const handleUndo = useCallback(() => {
        if (history.length === 0) return;
        const lastState = history[history.length - 1];
        setRedoHistory(prev => [lastState, ...prev]);
        const newHistory = history.slice(0, -1);
        setHistory(newHistory);
        if (contextRef.current && canvasRef.current) {
            const context = contextRef.current;
            context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            if (newHistory.length > 0) {
                context.putImageData(newHistory[newHistory.length - 1], 0, 0);
            }
        }
    }, [history]);

    const handleRedo = useCallback(() => {
        if (redoHistory.length === 0) return;
        const nextState = redoHistory[0];
        setHistory(prev => [...prev, nextState]);
        setRedoHistory(prev => prev.slice(1));
        if (contextRef.current) contextRef.current.putImageData(nextState, 0, 0);
    }, [redoHistory]);

    const getCoords = useCallback((e: React.MouseEvent): { x: number, y: number } | null => {
        if (!canvasRef.current) return null;
        const rect = canvasRef.current.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }, []);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        const context = contextRef.current;
        const coords = getCoords(e);
        if (!context || !coords) return;
        
        saveToHistory();
        isDrawing.current = true;
        hasMoved.current = false;
        lastCoords.current = coords;

        context.globalCompositeOperation = activeTool === 'eraser' ? 'destination-out' : 'source-over';
        context.strokeStyle = color;
        context.fillStyle = color;
        context.lineWidth = brushSize;
        context.lineCap = 'round';
        context.lineJoin = 'round';

        context.beginPath();
        context.moveTo(coords.x, coords.y);
    }, [getCoords, saveToHistory, activeTool, color, brushSize]);
    
    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isDrawing.current) return;
        const context = contextRef.current;
        const coords = getCoords(e);
        if (!context || !coords) return;
        
        hasMoved.current = true;
        context.lineTo(coords.x, coords.y);
        context.stroke();
    }, [getCoords]);
    
    const handleMouseUp = useCallback(() => {
        if (!isDrawing.current) return;
        const context = contextRef.current;
        if (context) {
            if (!hasMoved.current) { // Draw a dot for single clicks
                context.beginPath();
                context.arc(lastCoords.current.x, lastCoords.current.y, brushSize / 2, 0, Math.PI * 2);
                context.fill();
            }
            context.closePath();
        }
        isDrawing.current = false;
    }, [brushSize]);
    
    const handleSave = useCallback(() => {
        if (!canvasRef.current) return;
        const link = document.createElement('a');
        link.download = `whiteboard_${new Date().toISOString().slice(0,19).replace('T','_').replace(/:/g,'-')}.png`;
        link.href = canvasRef.current.toDataURL('image/png');
        link.click();
    }, []);

    const handleGenerate = () => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        if (tempCtx) {
            tempCtx.fillStyle = '#FFFFFF';
            tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
            tempCtx.drawImage(canvas, 0, 0);
            onGenerate(tempCanvas.toDataURL('image/png'), promptText);
        }
    };
    
    const handleClearCanvas = useCallback(() => {
        if (window.confirm('Are you sure you want to clear the canvas? This cannot be undone.')) {
            saveToHistory();
            if (contextRef.current && canvasRef.current) {
                contextRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            }
        }
    }, [saveToHistory]);

    const handleToolSelect = useCallback((tool: Tool) => {
        if (tool === 'delete') {
            handleClearCanvas();
        } else {
            setActiveTool(tool);
        }
    }, [handleClearCanvas]);

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
             if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
            if (e.metaKey || e.ctrlKey) {
                if (e.key === 'z') { e.preventDefault(); e.shiftKey ? handleRedo() : handleUndo(); }
                if (e.key === 's') { e.preventDefault(); handleSave(); }
                return;
            }
            const tool = TOOLS_CONFIG.find(t => t.hotkey === e.key.toLowerCase());
            if (tool) { e.preventDefault(); handleToolSelect(tool.id); }
            if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); handleClearCanvas(); }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, handleUndo, handleRedo, handleSave, handleToolSelect, handleClearCanvas]);

    useEffect(() => {
        if (canvasRef.current) {
            const toolConfig = TOOLS_CONFIG.find(t => t.id === activeTool);
            canvasRef.current.style.cursor = toolConfig?.cursor || 'default';
        }
    }, [activeTool]);

    const ToolButton = ({ id, icon: Icon, type }: { id: Tool; icon: React.ElementType; type: string }) => {
        const isSettingsVisible = (type === 'brush' || type === 'eraser') && activeTool === id;
        return (
            <div className="relative group">
                <button 
                  onClick={() => handleToolSelect(id)} 
                  className={`p-3 rounded-xl transition-colors duration-200 ${activeTool === id ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-600'}`}
                  aria-label={id}
                  title={id}
                >
                    <Icon className="w-6 h-6" />
                </button>
                {isSettingsVisible && (
                    <div className="absolute left-full top-0 ml-3 bg-white/90 backdrop-blur-md p-3 rounded-xl shadow-lg border border-gray-200/50 w-48 space-y-3 z-20">
                        <div>
                            <label className="text-xs font-medium text-gray-600 flex justify-between">Size <span>{brushSize}</span></label>
                            <input type="range" min="1" max="64" value={brushSize} onChange={e => setBrushSize(Number(e.target.value))} className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer range-sm" />
                        </div>
                    </div>
                )}
            </div>
        );
    }
    
    return (
        <div className={`fixed inset-0 z-40 flex items-center justify-center transition-opacity duration-300 ease-in-out ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose}></div>
            <div ref={whiteboardContainerRef} className={`relative bg-gray-50 rounded-2xl shadow-2xl flex flex-col transition-all duration-300 ease-in-out w-[95vw] h-[90vh] max-w-7xl max-h-[900px] ${isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
                {/* Header */}
                <header className="flex-shrink-0 p-4 border-b border-gray-200 flex items-center justify-between text-gray-600">
                    <button onClick={onClose} aria-label="Close" className="p-2 rounded-full hover:bg-gray-100"><X className="w-5 h-5"/></button>
                    <div className="text-center flex items-center gap-2">
                        <h2 className="text-lg font-semibold text-gray-800">Imagine Anything</h2>
                        <div className="flex items-center gap-1">
                            <select value={frameRatioKey} onChange={(e) => setFrameRatioKey(e.target.value)} title="Frame Ratio" className="text-sm text-gray-500 bg-transparent border-none focus:ring-0 cursor-pointer p-0 pr-6 appearance-none bg-no-repeat bg-right" style={{backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`}}>
                               {Object.keys(FRAME_RATIOS).map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                            {frameRatioKey === 'Custom' && (
                                <input 
                                  type="text" 
                                  value={customRatio} 
                                  onChange={e => setCustomRatio(e.target.value)}
                                  className={`text-sm w-20 p-0.5 rounded border ${isCustomRatioValid ? 'border-gray-300 focus:border-blue-500' : 'border-red-500 focus:border-red-500'} focus:ring-1 focus:outline-none`}
                                  placeholder="W:H"
                                />
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={handleSave} aria-label="Save" className="p-2 rounded-full hover:bg-gray-100"><Save className="w-5 h-5"/></button>
                        <button onClick={handleUndo} disabled={history.length === 0} aria-label="Undo" className="p-2 rounded-full hover:bg-gray-100 disabled:opacity-40"><Undo2 className="w-5 h-5"/></button>
                        <button onClick={handleRedo} disabled={redoHistory.length === 0} aria-label="Redo" className="p-2 rounded-full hover:bg-gray-100 disabled:opacity-40"><Redo2 className="w-5 h-5"/></button>
                    </div>
                </header>

                {/* Main Content */}
                <main className="flex-grow relative flex p-4 overflow-hidden">
                    {/* Left Toolbar */}
                    <aside className="absolute top-4 left-4 z-10">
                        <div className="bg-white/80 backdrop-blur-md p-2 rounded-2xl shadow-md flex flex-col gap-2 border border-gray-200/50">
                            {/* FIX: Using argument destructuring in the map callback to resolve a TypeScript inference issue. */}
                            {TOOLS_CONFIG.map(({ id, icon, type }) => <ToolButton key={id} id={id} icon={icon} type={type} />)}
                        </div>
                    </aside>
                    
                    {/* Right Palette */}
                    <aside className="absolute top-4 right-4 z-10">
                         <div className="bg-white/80 backdrop-blur-md p-2 rounded-2xl shadow-md flex flex-col gap-2 border border-gray-200/50">
                             <div className="grid grid-cols-4 gap-2 p-1">
                                {PRESET_COLORS.map(c => (
                                    <button key={c} onClick={() => setColor(c)} aria-label={`Color ${c}`} className={`w-6 h-6 rounded-full transition-transform transform hover:scale-110 border-2 ${color === c ? 'border-blue-500 ring-2 ring-offset-1 ring-blue-500' : 'border-white/50'}`} style={{backgroundColor: c}}></button>
                                ))}
                             </div>
                             <input type="color" value={color} onChange={e => setColor(e.target.value)} aria-label="Custom color picker" className="w-full h-8 p-0 border-none rounded-md cursor-pointer"/>
                        </div>
                    </aside>
                    
                    {/* Canvas Area */}
                    <div className="flex-grow flex items-center justify-center h-full w-full">
                        <canvas
                            ref={canvasRef}
                            className="bg-white rounded-lg shadow-inner"
                            style={{ touchAction: 'none' }}
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                        />
                    </div>
                </main>

                {/* Footer AI Prompt */}
                <footer className="flex-shrink-0 p-4 border-t border-gray-200 flex items-center gap-4 bg-gray-50">
                    <input 
                        type="text" 
                        value={promptText}
                        onChange={e => setPromptText(e.target.value)}
                        placeholder="Describe what you're imagining..."
                        className="flex-grow bg-white border border-gray-300 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[--primary] focus:border-transparent"
                    />
                    <button onClick={handleGenerate} aria-label="Generate with AI Magic" className="px-5 py-2.5 bg-[--primary] text-white rounded-xl font-semibold flex items-center gap-2 hover:opacity-90 transition-opacity shadow-md">
                        <Sparkles className="w-5 h-5"/> AI Magic
                    </button>
                </footer>
            </div>
        </div>
    );
};