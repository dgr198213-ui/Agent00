/**
 * Herramientas de integración: Slack, Discord, Email (Resend), Database y Stripe.
 *
 * Mismos principios que el resto del registro:
 *  - Interfaz única AgentToolDefinition.
 *  - Credenciales solo en `config` (nunca las decide el LLM).
 *  - Validación de host en URLs configurables (anti-SSRF).
 *  - Salida truncada y errores sin filtrar secretos.
 */

import mysql from "mysql2/promise";
import type { AgentToolDefinition, ToolResult } from "../domain";

const HTTP_TIMEOUT_MS = 15_000;
const MAX_OUTPUT_CHARS = 8_000;

function truncate(text: string, max = MAX_OUTPUT_CHARS): string {
  return text.length > max ? text.slice(0, max) + "\n…[truncado]" : text;
}

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

async function postJson(url: string, body: unknown, headers: Record<string, string> = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
  try {
    return await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

// ============================================================================
// Slack — enviar mensajes vía Incoming Webhook
// ============================================================================

export const slackTool: AgentToolDefinition = {
  id: "slack",
  name: "Slack",
  description: "Envía un mensaje a un canal de Slack mediante un Incoming Webhook configurado.",
  configFields: [
    {
      key: "webhookUrl",
      label: "URL del Incoming Webhook",
      required: true,
      placeholder: "https://hooks.slack.com/services/…",
    },
  ],
  schema: () => ({
    type: "object",
    properties: {
      message: { type: "string", description: "Texto del mensaje a enviar al canal" },
    },
    required: ["message"],
  }),
  async execute(input, ctx): Promise<ToolResult> {
    const webhookUrl = String(ctx.config?.webhookUrl ?? "");
    if (hostnameOf(webhookUrl) !== "hooks.slack.com") {
      return { success: false, output: "Configura una URL válida de hooks.slack.com." };
    }
    const message = String(input.message ?? "").trim();
    if (!message) return { success: false, output: "El mensaje no puede estar vacío." };
    try {
      const res = await postJson(webhookUrl, { text: message.slice(0, 4_000) });
      return res.ok
        ? { success: true, output: "Mensaje enviado a Slack." }
        : { success: false, output: `Slack respondió ${res.status}.` };
    } catch {
      return { success: false, output: "No se pudo contactar con Slack." };
    }
  },
};

// ============================================================================
// Discord — enviar mensajes vía Webhook
// ============================================================================

export const discordTool: AgentToolDefinition = {
  id: "discord",
  name: "Discord",
  description: "Envía un mensaje a un canal de Discord mediante un Webhook configurado.",
  configFields: [
    {
      key: "webhookUrl",
      label: "URL del Webhook",
      required: true,
      placeholder: "https://discord.com/api/webhooks/…",
    },
  ],
  schema: () => ({
    type: "object",
    properties: {
      message: { type: "string", description: "Texto del mensaje a enviar al canal" },
    },
    required: ["message"],
  }),
  async execute(input, ctx): Promise<ToolResult> {
    const webhookUrl = String(ctx.config?.webhookUrl ?? "");
    const host = hostnameOf(webhookUrl);
    if (host !== "discord.com" && host !== "discordapp.com") {
      return { success: false, output: "Configura una URL válida de discord.com/api/webhooks." };
    }
    const message = String(input.message ?? "").trim();
    if (!message) return { success: false, output: "El mensaje no puede estar vacío." };
    try {
      const res = await postJson(webhookUrl, { content: message.slice(0, 2_000) });
      return res.ok
        ? { success: true, output: "Mensaje enviado a Discord." }
        : { success: false, output: `Discord respondió ${res.status}.` };
    } catch {
      return { success: false, output: "No se pudo contactar con Discord." };
    }
  },
};

// ============================================================================
// Email — envío vía Resend
// ============================================================================

export const emailTool: AgentToolDefinition = {
  id: "email",
  name: "Email (Resend)",
  description: "Envía un correo electrónico usando la API de Resend con el remitente configurado.",
  configFields: [
    { key: "apiKey", label: "API key de Resend", required: true, placeholder: "re_…" },
    {
      key: "from",
      label: "Remitente verificado",
      required: true,
      placeholder: "Agente <agente@tudominio.com>",
    },
  ],
  schema: () => ({
    type: "object",
    properties: {
      to: { type: "string", description: "Dirección de correo del destinatario" },
      subject: { type: "string", description: "Asunto del correo" },
      body: { type: "string", description: "Cuerpo del correo en texto plano" },
    },
    required: ["to", "subject", "body"],
  }),
  async execute(input, ctx): Promise<ToolResult> {
    const apiKey = String(ctx.config?.apiKey ?? "");
    const from = String(ctx.config?.from ?? "");
    if (!apiKey || !from) {
      return { success: false, output: "Configura la API key de Resend y el remitente." };
    }
    const to = String(input.to ?? "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return { success: false, output: "Destinatario inválido." };
    }
    try {
      const res = await postJson(
        "https://api.resend.com/emails",
        {
          from,
          to: [to],
          subject: String(input.subject ?? "").slice(0, 200),
          text: String(input.body ?? "").slice(0, 20_000),
        },
        { Authorization: `Bearer ${apiKey}` }
      );
      if (!res.ok) return { success: false, output: `Resend respondió ${res.status}.` };
      const data = (await res.json()) as { id?: string };
      return { success: true, output: `Correo enviado (id: ${data.id ?? "desconocido"}).` };
    } catch {
      return { success: false, output: "No se pudo contactar con Resend." };
    }
  },
};

// ============================================================================
// Database — consultas MySQL de solo lectura
// ============================================================================

const DB_ROW_LIMIT = 50;
const DB_TIMEOUT_MS = 10_000;
const READ_ONLY_PREFIXES = ["select", "show", "describe", "desc", "explain"];

export const databaseTool: AgentToolDefinition = {
  id: "database",
  name: "Base de datos (MySQL, solo lectura)",
  description:
    "Ejecuta consultas de SOLO LECTURA (SELECT, SHOW, DESCRIBE, EXPLAIN) contra una base de datos MySQL configurada.",
  configFields: [
    {
      key: "connectionUrl",
      label: "URL de conexión MySQL",
      required: true,
      placeholder: "mysql://usuario:contraseña@host:3306/basededatos",
    },
  ],
  schema: () => ({
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Consulta SQL de solo lectura. Solo SELECT/SHOW/DESCRIBE/EXPLAIN.",
      },
    },
    required: ["query"],
  }),
  async execute(input, ctx): Promise<ToolResult> {
    const connectionUrl = String(ctx.config?.connectionUrl ?? "");
    if (!connectionUrl.startsWith("mysql://")) {
      return { success: false, output: "Configura una URL de conexión mysql:// válida." };
    }

    const query = String(input.query ?? "").trim().replace(/;+\s*$/, "");
    const firstWord = query.toLowerCase().split(/\s+/)[0] ?? "";
    if (!READ_ONLY_PREFIXES.includes(firstWord)) {
      return {
        success: false,
        output: "Solo se permiten consultas de lectura: SELECT, SHOW, DESCRIBE o EXPLAIN.",
      };
    }
    if (query.includes(";")) {
      return { success: false, output: "No se permiten múltiples sentencias en una consulta." };
    }

    let connection: mysql.Connection | undefined;
    try {
      connection = await mysql.createConnection({
        uri: connectionUrl,
        connectTimeout: DB_TIMEOUT_MS,
      });
      const [rows] = await connection.query({ sql: query, timeout: DB_TIMEOUT_MS });
      const list = Array.isArray(rows) ? rows.slice(0, DB_ROW_LIMIT) : rows;
      const total = Array.isArray(rows) ? rows.length : undefined;
      const suffix =
        typeof total === "number" && total > DB_ROW_LIMIT
          ? `\n(mostrando ${DB_ROW_LIMIT} de ${total} filas)`
          : "";
      return { success: true, output: truncate(JSON.stringify(list, null, 2)) + suffix };
    } catch (error) {
      const message = error instanceof Error ? error.message : "error desconocido";
      // No filtrar credenciales que pudieran aparecer en el mensaje del driver.
      return { success: false, output: `Error de consulta: ${message.replace(/mysql:\/\/\S+/g, "mysql://***")}` };
    } finally {
      await connection?.end().catch(() => undefined);
    }
  },
};

// ============================================================================
// Stripe — consultas de solo lectura a la API
// ============================================================================

const STRIPE_ACTIONS: Record<string, string> = {
  balance: "/v1/balance",
  customers: "/v1/customers?limit=10",
  payment_intents: "/v1/payment_intents?limit=10",
  charges: "/v1/charges?limit=10",
  subscriptions: "/v1/subscriptions?limit=10",
};

export const stripeTool: AgentToolDefinition = {
  id: "stripe",
  name: "Stripe (solo lectura)",
  description:
    "Consulta datos de Stripe: balance, clientes, pagos, cargos o suscripciones. Solo operaciones de lectura.",
  configFields: [
    {
      key: "apiKey",
      label: "API key (usa una clave restringida de solo lectura)",
      required: true,
      placeholder: "rk_live_… o sk_test_…",
    },
  ],
  schema: () => ({
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: Object.keys(STRIPE_ACTIONS),
        description: "Qué consultar en Stripe",
      },
    },
    required: ["action"],
  }),
  async execute(input, ctx): Promise<ToolResult> {
    const apiKey = String(ctx.config?.apiKey ?? "");
    if (!apiKey) return { success: false, output: "Configura la API key de Stripe." };

    const path = STRIPE_ACTIONS[String(input.action ?? "")];
    if (!path) {
      return {
        success: false,
        output: `Acción no soportada. Usa una de: ${Object.keys(STRIPE_ACTIONS).join(", ")}.`,
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
    try {
      const res = await fetch(`https://api.stripe.com${path}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: controller.signal,
      });
      const text = await res.text();
      if (!res.ok) return { success: false, output: `Stripe respondió ${res.status}.` };
      return { success: true, output: truncate(text) };
    } catch {
      return { success: false, output: "No se pudo contactar con Stripe." };
    } finally {
      clearTimeout(timer);
    }
  },
};
