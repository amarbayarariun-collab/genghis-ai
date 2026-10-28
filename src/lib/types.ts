export type ChatRole = "user" | "assistant" | "system";

export type ToolMode =
  | "chat"
  | "think"
  | "research"
  | "image"
  | "document"
  | "code"
  | "web";

export type AttachmentKind = "image" | "file";

export type ChatAttachment = {
  id: string;
  name: string;
  mime: string;
  kind: AttachmentKind;
  /** Client preview / vision payload (data URL). */
  dataUrl?: string;
  /** Extracted text for documents. */
  text?: string;
  size: number;
};

export type ThinkingStep = {
  summary: string;
  detail: string;
};

export type ThinkingTrace = {
  steps: ThinkingStep[];
  activeIndex: number;
  durationSec: number;
  startedAt: number;
};

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  attachments?: ChatAttachment[];
  /** Assistant-generated image URL (data or https). */
  imageUrl?: string;
  tool?: ToolMode;
  /** Claude-style expandable thinking summary for this reply. */
  thinking?: ThinkingTrace;
};

export type ChatSession = {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
};

export type ApiAttachment = {
  name: string;
  mime: string;
  kind: AttachmentKind;
  dataUrl?: string;
  text?: string;
};
