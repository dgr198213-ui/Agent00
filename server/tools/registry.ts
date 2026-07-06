/**
 * Registro de herramientas de la plataforma.
 *
 * Cada herramienta implementa la interfaz única del dominio:
 *   Tool { id, name, description, schema(), execute() }
 *
 * Para añadir una herramienta nueva: crear el objeto y añadirlo a TOOL_REGISTRY.
 */

import axios from "axios";
import * as cheerio from "cheerio";
import type { AgentToolDefinition, ToolExecutionContext, ToolResult } from "../domain";
import { memoryRepository } from "../infrastructure/repositories";
import { databaseTool, discordTool, emailTool, slackTool, stripeTool } from "./integrations";

const HTTP_TIMEOUT_MS = 15_000;
const MAX_OUTPUT_CHARS = 8_000;

function truncate(text: string, max = MAX_OUTPUT_CHARS): string {
  return text.length > max ? text.slice(0, max) + "\n…[truncado]" : text;
}

function isPrivateHost(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return (
      hostname === "localhost" ||
      hostname === "0.0.0.0" ||
      /^127\./.test(hostname) ||
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
      hostname.endsWith(".internal") ||
      hostname.endsWith(".local")
    );
  } catch {
    return true;
  }
}

// ============================================================================
// Browser — lee páginas web y devuelve su texto
// ============================================================================

const browserTool: AgentToolDefinition = {
  id: "browser",
  name: "Navegador web",
  description: "Lee el contenido de una página web pública y lo devuelve como texto.",
  schema: () => ({
    type: "object",
    properties: {
      url: { type: "string", description: "URL completa de la página a leer (https://…)" },
    },
    required: ["url"],
  }),
  async execute(input): Promise<ToolResult> {
    const url = String(input.url ?? "");
    if (!/^https?:\/\//.test(url)) {
      return { success: false, output: "URL inválida: debe empezar por http(s)://" };
    }
    if (isPrivateHost(url)) {
      return { success: false, output: "URL bloqueada: no se permiten hosts privados o internos." };
    }
    try {
      const res = await axios.get(url, {
        timeout: HTTP_TIMEOUT_MS,
        maxContentLength: 2_000_000,
        headers: { "User-Agent": "Agent00-Browser/1.0" },
      });
      const $ = cheerio.load(String(res.data));
      $("script, style, noscript, iframe").remove();
      const text = $("body").text().replace(/\s+/g, " ").trim();
      return { success: true, output: truncate(text) || "(página sin texto visible)" };
    } catch (error) {
      return { success: false, output: `Error al leer la página: ${(error as Error).message}` };
    }
  },
};

// ============================================================================
// HTTP API — llamadas a APIs REST configuradas por el usuario
// ============================================================================

const apiTool: AgentToolDefinition = {
  id: "api",
  name: "API HTTP",
  description:
    "Realiza peticiones HTTP a la API base configurada por el usuario. Útil para consultar servicios externos.",
  configFields: [
    { key: "baseUrl", label: "URL base de la API", required: true, placeholder: "https://api.ejemplo.com" },
    { key: "apiKeyHeader", label: "Cabecera de autenticación (opcional)", required: false, placeholder: "Authorization" },
    { key: "apiKeyValue", label: "Valor de la cabecera (opcional)", required: false, placeholder: "Bearer sk-…" },
  ],
  schema: () => ({
    type: "object",
    properties: {
      method: { type: "string", enum: ["GET", "POST", "PUT", "DELETE"], description: "Método HTTP" },
      path: { type: "string", description: "Ruta relativa a la URL base, p. ej. /v1/users" },
      body: { type: "object", description: "Cuerpo JSON opcional para POST/PUT" },
    },
    required: ["method", "path"],
  }),
  async execute(input, ctx): Promise<ToolResult> {
    const baseUrl = String(ctx.config.baseUrl ?? "");
    if (!baseUrl) return { success: false, output: "La herramienta API no tiene URL base configurada." };
    if (isPrivateHost(baseUrl)) {
      return { success: false, output: "URL base bloqueada: no se permiten hosts privados o internos." };
    }
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const headerName = String(ctx.config.apiKeyHeader ?? "");
    const headerValue = String(ctx.config.apiKeyValue ?? "");
    if (headerName && headerValue) headers[headerName] = headerValue;

    try {
      const res = await axios.request({
        method: String(input.method ?? "GET"),
        url: baseUrl.replace(/\/$/, "") + String(input.path ?? "/"),
        data: input.body,
        headers,
        timeout: HTTP_TIMEOUT_MS,
        maxContentLength: 2_000_000,
        validateStatus: () => true,
      });
      const body = typeof res.data === "string" ? res.data : JSON.stringify(res.data, null, 2);
      return {
        success: res.status < 400,
        output: truncate(`HTTP ${res.status}\n${body}`),
        metadata: { status: res.status },
      };
    } catch (error) {
      return { success: false, output: `Error en la petición: ${(error as Error).message}` };
    }
  },
};

// ============================================================================
// Webhook — notifica eventos a una URL configurada
// ============================================================================

const webhookTool: AgentToolDefinition = {
  id: "webhook",
  name: "Webhook",
  description: "Envía un evento JSON (POST) a la URL de webhook configurada por el usuario.",
  configFields: [
    { key: "url", label: "URL del webhook", required: true, placeholder: "https://hooks.ejemplo.com/…" },
  ],
  schema: () => ({
    type: "object",
    properties: {
      event: { type: "string", description: "Nombre del evento" },
      payload: { type: "object", description: "Datos del evento" },
    },
    required: ["event"],
  }),
  async execute(input, ctx): Promise<ToolResult> {
    const url = String(ctx.config.url ?? "");
    if (!url) return { success: false, output: "El webhook no tiene URL configurada." };
    if (isPrivateHost(url)) {
      return { success: false, output: "URL bloqueada: no se permiten hosts privados o internos." };
    }
    try {
      const res = await axios.post(
        url,
        { event: input.event, payload: input.payload ?? {}, agentId: ctx.agentId, ts: Date.now() },
        { timeout: HTTP_TIMEOUT_MS, validateStatus: () => true }
      );
      return { success: res.status < 400, output: `Webhook enviado (HTTP ${res.status}).` };
    } catch (error) {
      return { success: false, output: `Error al enviar webhook: ${(error as Error).message}` };
    }
  },
};

// ============================================================================
// Memory — memoria persistente del agente (Agent Memory, no conversacional)
// ============================================================================

const memoryTool: AgentToolDefinition = {
  id: "memory",
  name: "Memoria persistente",
  description:
    "Guarda o recupera hechos importantes en la memoria persistente del agente, que sobrevive entre conversaciones.",
  schema: () => ({
    type: "object",
    properties: {
      action: { type: "string", enum: ["save", "list"], description: "save para guardar, list para recuperar" },
      key: { type: "string", description: "Clave corta del recuerdo (solo para save)" },
      value: { type: "string", description: "Contenido del recuerdo (solo para save)" },
    },
    required: ["action"],
  }),
  async execute(input, ctx): Promise<ToolResult> {
    const action = String(input.action ?? "list");
    if (action === "save") {
      const key = String(input.key ?? "").trim();
      const value = String(input.value ?? "").trim();
      if (!key || !value) return { success: false, output: "save requiere key y value." };
      await memoryRepository.upsert(ctx.agentId, ctx.userId, key.slice(0, 255), value.slice(0, 4000));
      return { success: true, output: `Recuerdo guardado: ${key}` };
    }
    const items = await memoryRepository.listByAgent(ctx.agentId, ctx.userId);
    if (items.length === 0) return { success: true, output: "La memoria está vacía." };
    return {
      success: true,
      output: truncate(items.map(m => `- ${m.memoryKey}: ${m.value}`).join("\n")),
    };
  },
};

// ============================================================================
// REGISTRO
// ============================================================================

export const TOOL_REGISTRY: Record<string, AgentToolDefinition> = {
  [browserTool.id]: browserTool,
  [apiTool.id]: apiTool,
  [webhookTool.id]: webhookTool,
  [memoryTool.id]: memoryTool,
  [slackTool.id]: slackTool,
  [discordTool.id]: discordTool,
  [emailTool.id]: emailTool,
  [databaseTool.id]: databaseTool,
  [stripeTool.id]: stripeTool,
};

export function listAvailableTools() {
  return Object.values(TOOL_REGISTRY).map(tool => ({
    id: tool.id,
    name: tool.name,
    description: tool.description,
    configFields: tool.configFields ?? [],
  }));
}

export function getTool(toolKey: string): AgentToolDefinition | undefined {
  return TOOL_REGISTRY[toolKey];
}

export async function executeTool(
  toolKey: string,
  input: Record<string, unknown>,
  ctx: ToolExecutionContext
): Promise<ToolResult> {
  const tool = getTool(toolKey);
  if (!tool) return { success: false, output: `Herramienta desconocida: ${toolKey}` };
  try {
    return await tool.execute(input, ctx);
  } catch (error) {
    return { success: false, output: `Error interno de la herramienta: ${(error as Error).message}` };
  }
}
