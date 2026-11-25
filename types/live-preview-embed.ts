import type { ThemeEditorState } from "@/types/editor";

// Keep in sync with public/live-preview-embed-script.js STUDIO_MESSAGE
export const MESSAGE = {
  PING: "STUDIO_PING",
  PONG: "STUDIO_PONG",
  CHECK_SHADCN: "STUDIO_CHECK_SHADCN",
  SHADCN_STATUS: "STUDIO_SHADCN_STATUS",
  THEME_UPDATE: "STUDIO_THEME_UPDATE",
  THEME_APPLIED: "STUDIO_THEME_APPLIED",
  EMBED_LOADED: "STUDIO_EMBED_LOADED",
  EMBED_ERROR: "STUDIO_EMBED_ERROR",
} as const;

export type MessageType = (typeof MESSAGE)[keyof typeof MESSAGE];

export interface ShadcnStatusPayload {
  supported: boolean;
}

export interface ThemeUpdatePayload {
  themeState: ThemeEditorState;
  /**
   * Variables CSS déjà résolues du squelette étendu (couleurs étendues du mode courant + tokens),
   * `{ "--nom": valeur }`. Optionnel : les anciens scripts embarqués l'ignorent.
   */
  cssVars?: Record<string, string>;
}

export type EmbedMessage =
  | { type: typeof MESSAGE.PING }
  | { type: typeof MESSAGE.PONG }
  | { type: typeof MESSAGE.CHECK_SHADCN }
  | { type: typeof MESSAGE.SHADCN_STATUS; payload: ShadcnStatusPayload }
  | { type: typeof MESSAGE.THEME_UPDATE; payload: ThemeUpdatePayload }
  | { type: typeof MESSAGE.THEME_APPLIED }
  | { type: typeof MESSAGE.EMBED_LOADED }
  | { type: typeof MESSAGE.EMBED_ERROR; payload: { error: string } };

export type IframeStatus =
  | "unknown"
  | "checking"
  | "connected"
  | "supported"
  | "unsupported"
  | "missing"
  | "error";
