/**
 * Tests de integración de la capa Application con repositorios en memoria.
 * No requieren base de datos ni red: infraestructura mockeada en el borde.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetSharedState, sharedState as state } from "./in-memory-repos";

vi.mock("../../infrastructure/repositories", async () => {
  const { createInMemoryRepos, sharedState } = await import("./in-memory-repos");
  return createInMemoryRepos(sharedState);
});

// Embeddings no disponibles en tests → retrieval degrada a léxico.
vi.mock("../../infrastructure/embeddings", () => ({
  embedTexts: vi.fn(async () => null),
  embedQuery: vi.fn(async () => null),
}));

// LLM mockeado: los tests controlan cada respuesta.
const invokeLLMMock = vi.fn();
vi.mock("../../_core/llm", () => ({
  invokeLLM: (params: unknown) => invokeLLMMock(params),
}));
vi.mock("../../infrastructure/llm-stream", () => ({
  streamLLM: vi.fn(),
}));

import { agentService } from "../agent-service";
import { knowledgeService } from "../knowledge-service";
import { playgroundService } from "../playground-service";
import { deploymentService } from "../deployment-service";

const USER = 1;
const INTRUDER = 2;

function llmReply(content: string, toolCalls: unknown[] = []) {
  return {
    id: "r",
    created: 0,
    model: "test",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content, tool_calls: toolCalls },
        finish_reason: "stop",
      },
    ],
  };
}

beforeEach(() => {
  resetSharedState();
  invokeLLMMock.mockReset();
});

describe("agentService", () => {
  it("crea, actualiza y borra un agente del usuario", async () => {
    const agent = await agentService.create(USER, { name: "  Soporte  ", temperature: 0.3 });
    expect(agent.name).toBe("Soporte");
    expect(agent.temperature).toBe("0.30");
    expect(agent.status).toBe("draft");

    const updated = await agentService.update(USER, agent.id, { name: "Soporte v2" });
    expect(updated.name).toBe("Soporte v2");

    await agentService.delete(USER, agent.id);
    expect(await agentService.list(USER)).toHaveLength(0);
  });

  it("no permite acceder a agentes de otro usuario", async () => {
    const agent = await agentService.create(USER, { name: "Privado" });
    await expect(agentService.getOwned(INTRUDER, agent.id)).rejects.toThrow("no encontrado");
    await expect(agentService.update(INTRUDER, agent.id, { name: "hackeado" })).rejects.toThrow();
    await expect(agentService.delete(INTRUDER, agent.id)).rejects.toThrow();
  });
});

describe("knowledgeService", () => {
  it("ingesta texto: normaliza, trocea en chunks y marca como indexado", async () => {
    const agent = await agentService.create(USER, { name: "Docs" });
    const content = "El plan Beta es gratuito durante la beta abierta. ".repeat(60); // ~3.000 chars

    const items = await knowledgeService.add(USER, {
      agentId: agent.id,
      name: "Pricing",
      sourceType: "text",
      content,
    });

    expect(items).toHaveLength(1);
    expect(items[0].status).toBe("indexed");
    expect(items[0].size).toBeGreaterThan(0);

    const chunks = [...state.chunks.values()];
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every(chunk => chunk.agentId === agent.id)).toBe(true);
    expect(chunks.every(chunk => chunk.embedding === null)).toBe(true); // proveedor no disponible
  });

  it("buildContext con query recupera el chunk relevante (fallback léxico)", async () => {
    const agent = await agentService.create(USER, { name: "Docs" });
    await knowledgeService.add(USER, {
      agentId: agent.id,
      name: "Pricing",
      sourceType: "text",
      content: "El plan Beta cuesta 0 euros durante la beta abierta.",
    });
    await knowledgeService.add(USER, {
      agentId: agent.id,
      name: "Gatos",
      sourceType: "text",
      content: "Los gatos duermen dieciséis horas al día.",
    });

    const context = await knowledgeService.buildContext(agent.id, 12_000, "¿cuánto cuesta el plan Beta?");
    expect(context).toContain("plan Beta");
    expect(context).not.toContain("gatos");
  });

  it("remove borra la fuente y sus chunks", async () => {
    const agent = await agentService.create(USER, { name: "Docs" });
    const [item] = await knowledgeService.add(USER, {
      agentId: agent.id,
      name: "Nota",
      sourceType: "text",
      content: "contenido de prueba con suficiente texto",
    });

    await knowledgeService.remove(USER, item.id);
    expect(state.knowledge.size).toBe(0);
    expect(state.chunks.size).toBe(0);
  });

  it("rechaza fuentes URL sin URL y texto sin contenido", async () => {
    const agent = await agentService.create(USER, { name: "Docs" });
    await expect(
      knowledgeService.add(USER, { agentId: agent.id, name: "Web", sourceType: "website" })
    ).rejects.toThrow("URL");
    await expect(
      knowledgeService.add(USER, { agentId: agent.id, name: "Vacío", sourceType: "text", content: " " })
    ).rejects.toThrow("contenido");
  });
});

describe("playgroundService", () => {
  it("chat simple: persiste mensajes de usuario y asistente", async () => {
    const agent = await agentService.create(USER, { name: "Chat" });
    invokeLLMMock.mockResolvedValueOnce(llmReply("¡Hola! ¿En qué puedo ayudarte?"));

    const result = await playgroundService.chat(USER, agent.id, "Hola");

    const roles = result.messages.map(message => message.role);
    expect(roles).toEqual(["user", "assistant"]);
    expect(result.messages[1].content).toContain("ayudarte");
  });

  it("ejecuta el bucle de tool-calling con la herramienta memory", async () => {
    const agent = await agentService.create(USER, { name: "Con memoria" });
    state.tools.set("t1", {
      id: "t1",
      agentId: agent.id,
      userId: USER,
      toolKey: "memory",
      config: {},
      enabled: true,
      createdAt: new Date(),
    } as never);

    invokeLLMMock
      .mockResolvedValueOnce(
        llmReply("", [
          {
            id: "call_1",
            type: "function",
            function: {
              name: "memory",
              arguments: JSON.stringify({ action: "save", key: "color", value: "teal" }),
            },
          },
        ])
      )
      .mockResolvedValueOnce(llmReply("Anotado: tu color favorito es teal."));

    const result = await playgroundService.chat(USER, agent.id, "Recuerda que mi color es teal");

    expect(invokeLLMMock).toHaveBeenCalledTimes(2);
    expect(result.messages.some(message => message.role === "tool")).toBe(true);
    expect([...state.memories.values()].some(memory => memory.memoryKey === "color")).toBe(true);
  });

  it("inyecta el conocimiento relevante en el system prompt", async () => {
    const agent = await agentService.create(USER, { name: "Docs" });
    await knowledgeService.add(USER, {
      agentId: agent.id,
      name: "Pricing",
      sourceType: "text",
      content: "El plan Pro cuesta 29 euros al mes.",
    });
    invokeLLMMock.mockResolvedValueOnce(llmReply("El plan Pro cuesta 29€/mes."));

    await playgroundService.chat(USER, agent.id, "¿Cuánto cuesta el plan Pro?");

    const firstCall = invokeLLMMock.mock.calls[0][0] as { messages: Array<{ role: string; content: string }> };
    const systemPrompt = firstCall.messages.find(message => message.role === "system")!.content;
    expect(systemPrompt).toContain("plan Pro");
  });
});

describe("deploymentService", () => {
  it("publish genera API key para deployments tipo api y marca el agente published", async () => {
    const agent = await agentService.create(USER, { name: "API" });
    const deployments = await deploymentService.publish(USER, agent.id, "api");

    expect(deployments).toHaveLength(1);
    expect(deployments[0].apiKey).toMatch(/^agk_/);
    expect((await agentService.getOwned(USER, agent.id)).status).toBe("published");
  });

  it("revoke devuelve el agente a draft si no quedan deployments activos", async () => {
    const agent = await agentService.create(USER, { name: "API" });
    const [deployment] = await deploymentService.publish(USER, agent.id, "api");

    await deploymentService.revoke(USER, deployment.id);
    expect((await agentService.getOwned(USER, agent.id)).status).toBe("draft");
  });

  it("invokeViaApiKey responde con el agente publicado y rechaza claves revocadas", async () => {
    const agent = await agentService.create(USER, { name: "Público" });
    const [deployment] = await deploymentService.publish(USER, agent.id, "api");
    invokeLLMMock.mockResolvedValueOnce(llmReply("Respuesta pública"));

    const result = await deploymentService.invokeViaApiKey(deployment.apiKey!, "Hola");
    expect(result.reply).toBe("Respuesta pública");

    await deploymentService.revoke(USER, deployment.id);
    await expect(deploymentService.invokeViaApiKey(deployment.apiKey!, "Hola")).rejects.toThrow();
  });
});
