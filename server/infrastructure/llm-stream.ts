/**
 * Capa de Infraestructura — invocación del LLM con streaming.
 *
 * Complementa a `server/_core/llm.ts` (que no soporta streaming) usando el
 * mismo endpoint OpenAI-compatible con `stream: true` y parseando los
 * eventos SSE (`data: {...}`) del proveedor.
 *
 * Soporta tool-calling en streaming: los deltas de `tool_calls` se acumulan
 * por índice hasta reconstruir cada llamada completa.
 */

import { ENV } from "../_core/env";
import type { Message, Tool, ToolCall } from "../_core/llm";

const STREAM_TIMEOUT_MS = 120_000;

export interface StreamLLMParams {
  messages: Message[];
  tools?: Tool[];
  /** Callback invocado con cada fragmento de texto según llega. */
  onToken?: (text: string) => void;
}

export interface StreamLLMResult {
  content: string;
  toolCalls: ToolCall[];
}

function resolveStreamUrl(): string {
  const base =
    ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0
      ? ENV.forgeApiUrl.replace(/\/$/, "")
      : "https://forge.manus.im";
  return `${base}/v1/chat/completions`;
}

interface StreamDelta {
  content?: string;
  tool_calls?: Array<{
    index: number;
    id?: string;
    type?: "function";
    function?: { name?: string; arguments?: string };
  }>;
}

/**
 * Invoca el LLM en modo streaming. Devuelve el contenido completo y las
 * tool calls reconstruidas cuando el stream termina.
 */
export async function streamLLM(params: StreamLLMParams): Promise<StreamLLMResult> {
  if (!ENV.forgeApiKey) throw new Error("LLM API key no configurada");

  const payload: Record<string, unknown> = {
    model: "gemini-2.5-flash",
    stream: true,
    max_tokens: 32768,
    messages: params.messages.map(message => ({
      role: message.role,
      content:
        typeof message.content === "string"
          ? message.content
          : JSON.stringify(message.content),
      ...(message.name ? { name: message.name } : {}),
      ...(message.tool_call_id ? { tool_call_id: message.tool_call_id } : {}),
    })),
  };
  if (params.tools && params.tools.length > 0) {
    payload.tools = params.tools;
    payload.tool_choice = "auto";
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);

  try {
    const response = await fetch(resolveStreamUrl(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok || !response.body) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`LLM stream failed: ${response.status} – ${errorText}`);
    }

    let content = "";
    const pendingCalls = new Map<
      number,
      { id: string; name: string; arguments: string }
    >();

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    const processLine = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) return;
      const data = trimmed.slice(5).trim();
      if (!data || data === "[DONE]") return;

      let parsed: { choices?: Array<{ delta?: StreamDelta }> };
      try {
        parsed = JSON.parse(data);
      } catch {
        return; // fragmento malformado: ignorar
      }

      const delta = parsed.choices?.[0]?.delta;
      if (!delta) return;

      if (typeof delta.content === "string" && delta.content.length > 0) {
        content += delta.content;
        params.onToken?.(delta.content);
      }

      for (const call of delta.tool_calls ?? []) {
        const existing = pendingCalls.get(call.index) ?? {
          id: "",
          name: "",
          arguments: "",
        };
        if (call.id) existing.id = call.id;
        if (call.function?.name) existing.name += call.function.name;
        if (call.function?.arguments) existing.arguments += call.function.arguments;
        pendingCalls.set(call.index, existing);
      }
    };

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newlineIndex = buffer.indexOf("\n");
      while (newlineIndex >= 0) {
        processLine(buffer.slice(0, newlineIndex));
        buffer = buffer.slice(newlineIndex + 1);
        newlineIndex = buffer.indexOf("\n");
      }
    }
    if (buffer.length > 0) processLine(buffer);

    const toolCalls: ToolCall[] = Array.from(pendingCalls.entries())
      .sort(([a], [b]) => a - b)
      .map(([, call]) => ({
        id: call.id || `call_${Math.random().toString(36).slice(2)}`,
        type: "function" as const,
        function: { name: call.name, arguments: call.arguments },
      }))
      .filter(call => call.function.name.length > 0);

    return { content, toolCalls };
  } finally {
    clearTimeout(timer);
  }
}
