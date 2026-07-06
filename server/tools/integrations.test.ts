/**
 * Tests de las validaciones de seguridad de las herramientas de integración.
 * No hacen red: validan los rechazos previos a cualquier llamada externa.
 */

import { describe, expect, it } from "vitest";
import { databaseTool, discordTool, emailTool, slackTool, stripeTool } from "./integrations";

const ctx = (config: Record<string, unknown>) => ({
  agentId: "a1",
  userId: 1,
  config,
});

describe("slackTool", () => {
  it("rechaza webhooks que no sean de hooks.slack.com (anti-SSRF)", async () => {
    const result = await slackTool.execute(
      { message: "hola" },
      ctx({ webhookUrl: "https://atacante.com/exfiltrar" })
    );
    expect(result.success).toBe(false);
    expect(result.output).toContain("hooks.slack.com");
  });

  it("rechaza mensajes vacíos", async () => {
    const result = await slackTool.execute(
      { message: "  " },
      ctx({ webhookUrl: "https://hooks.slack.com/services/X" })
    );
    expect(result.success).toBe(false);
  });
});

describe("discordTool", () => {
  it("rechaza webhooks fuera de discord.com", async () => {
    const result = await discordTool.execute(
      { message: "hola" },
      ctx({ webhookUrl: "https://evil.example/webhook" })
    );
    expect(result.success).toBe(false);
  });
});

describe("emailTool", () => {
  it("exige configuración completa", async () => {
    const result = await emailTool.execute(
      { to: "a@b.com", subject: "x", body: "y" },
      ctx({})
    );
    expect(result.success).toBe(false);
  });

  it("rechaza destinatarios inválidos", async () => {
    const result = await emailTool.execute(
      { to: "no-es-un-email", subject: "x", body: "y" },
      ctx({ apiKey: "re_test", from: "Agente <a@dominio.com>" })
    );
    expect(result.success).toBe(false);
    expect(result.output).toContain("inválido");
  });
});

describe("databaseTool", () => {
  const config = { connectionUrl: "mysql://u:p@localhost:3306/db" };

  it.each(["UPDATE users SET admin=1", "DELETE FROM users", "DROP TABLE users", "INSERT INTO x VALUES (1)"])(
    "rechaza sentencias de escritura: %s",
    async query => {
      const result = await databaseTool.execute({ query }, ctx(config));
      expect(result.success).toBe(false);
      expect(result.output.toLowerCase()).toContain("solo");
    }
  );

  it("rechaza múltiples sentencias encadenadas", async () => {
    const result = await databaseTool.execute(
      { query: "SELECT 1; DROP TABLE users" },
      ctx(config)
    );
    expect(result.success).toBe(false);
  });

  it("rechaza URLs de conexión que no sean mysql://", async () => {
    const result = await databaseTool.execute(
      { query: "SELECT 1" },
      ctx({ connectionUrl: "postgres://u:p@host/db" })
    );
    expect(result.success).toBe(false);
  });
});

describe("stripeTool", () => {
  it("exige API key", async () => {
    const result = await stripeTool.execute({ action: "balance" }, ctx({}));
    expect(result.success).toBe(false);
  });

  it("rechaza acciones fuera de la lista blanca", async () => {
    const result = await stripeTool.execute(
      { action: "delete_customer" },
      ctx({ apiKey: "sk_test_x" })
    );
    expect(result.success).toBe(false);
    expect(result.output).toContain("no soportada");
  });
});
