/**
 * Capa API — endpoint SSE para el chat en streaming del Playground.
 *
 * POST /api/playground/stream  { agentId, message, conversationId? }
 *
 * Emite eventos `data: {...}` con este protocolo:
 *   { type: "token", text }                      → fragmento de la respuesta
 *   { type: "tool",  name }                      → el agente usa una herramienta
 *                                                  (descartar texto parcial del turno)
 *   { type: "done",  conversationId, messages }  → resultado final persistido
 *   { type: "error", message }                   → error
 *
 * Autenticación: misma cookie de sesión que el resto de la app
 * (sdk.authenticateRequest), igual que hace el contexto de tRPC.
 */

import type { Express, Request, Response } from "express";
import { z } from "zod";
import { sdk } from "../_core/sdk";
import { playgroundService } from "../application/playground-service";

const bodySchema = z.object({
  agentId: z.string().min(1),
  message: z.string().min(1).max(8_000),
  conversationId: z.string().optional(),
});

function sendEvent(res: Response, payload: Record<string, unknown>): void {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

export function registerPlaygroundStreamRoute(app: Express): void {
  app.post("/api/playground/stream", async (req: Request, res: Response) => {
    let userId: number;
    try {
      const user = await sdk.authenticateRequest(req);
      userId = user.id;
    } catch {
      res.status(401).json({ error: "No autenticado" });
      return;
    }

    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Parámetros inválidos" });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    // Latido para evitar timeouts de proxies intermedios.
    const heartbeat = setInterval(() => res.write(": ping\n\n"), 15_000);

    try {
      const { agentId, message, conversationId } = parsed.data;
      const result = await playgroundService.chat(userId, agentId, message, conversationId, {
        onToken: text => sendEvent(res, { type: "token", text }),
        onTool: name => sendEvent(res, { type: "tool", name }),
      });
      sendEvent(res, {
        type: "done",
        conversationId: result.conversationId,
        messages: result.messages,
      });
    } catch (error) {
      sendEvent(res, {
        type: "error",
        message: error instanceof Error ? error.message : "Error inesperado",
      });
    } finally {
      clearInterval(heartbeat);
      res.end();
    }
  });
}
