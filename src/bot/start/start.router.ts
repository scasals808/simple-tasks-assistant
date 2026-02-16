export type ParsedStartPayload =
  | { type: "join"; token: string }
  | { type: "task"; token: string }
  | { type: "none"; token: null };

export type StartRoute = "join" | "task" | "plain";

export function extractStartPayload(text: string | undefined): string | null {
  if (!text) return null;
  const parts = text.trim().split(/\s+/);
  return parts.length > 1 ? parts[1] : null;
}

export function parseStartPayload(payload: string | null): ParsedStartPayload {
  if (!payload) {
    return { type: "none", token: null };
  }
  if (payload.startsWith("join_")) {
    return { type: "join", token: payload.slice(5) };
  }
  return { type: "task", token: payload };
}

export function selectStartRoute(parsed: ParsedStartPayload): StartRoute {
  if (parsed.type === "join") return "join";
  if (parsed.type === "task") return "task";
  return "plain";
}
