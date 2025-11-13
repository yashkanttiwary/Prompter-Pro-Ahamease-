
export interface User {
  name: string;
  email: string;
}

export interface QualityMetrics {
  factualAccuracy: string;
  logicalConsistency: number;
  biasDetection: string;
  tokenEfficiency: number;
  securityRobustness: number;
}

export interface Thinking {
  approach: string;
  assumptions: string[];
  reasoning: string[];
  decisionLog?: string[];
  qualityMetrics?: QualityMetrics;
}

export interface PromptData {
  content: string;
  confidence: number;
  whyItWorks: string[];
  tokenEstimate: string;
  framework: string;
}

export interface BaseMessage {
  id: string;
  role: 'user' | 'assistant';
  type: 'chat' | 'prompt';
  thinking?: Thinking;
}

export interface ChatMessage extends BaseMessage {
  type: 'chat';
  content: string;
  attachedFiles?: AttachedFile[];
}

export interface PromptMessage extends BaseMessage {
  type: 'prompt';
  content: string;
  promptData: PromptData;
}

export type Message = ChatMessage | PromptMessage;

export interface PromptGenerationResponse {
  content: string;
  promptData: PromptData;
  thinking: Thinking;
}

export interface AttachedFile {
  name: string;
  mimeType: string;
  content: string; // Base64 for images/PDFs, text for others
  preview?: string; // data: URL for image thumbnails
  isLoading?: boolean;
}
