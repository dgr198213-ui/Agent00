/**
 * Capa de Aplicación — Playground.
 *
 * El Playground es donde se prueba un agente: construye el prompt del agente
 * (identidad + conocimiento + memoria persistente), invoca el LLM con las
 * herramientas conectadas y ejecuta el bucle de tool-calling.
 *
 * Memoria de conversación (temporal)  → tablas conversations/messages.
 * Memoria del agente (persistente)    → tabla agentMemories. Nunca se mezclan.
 */

import { nanoid } from "nanoid";
import { invokeLLM, type Message, type Tool as LLMTool, type ToolCall } from "../_core/llm";
import { streamLLM } from "../infrastructure/llm-stream";
import type { Agent, Conversation, DbMessage } from "../domain";
import {
  conversationRepository,
  memoryRepository,
  toolRepository,
} from "../infrastructure/repositories";
import { executeTool, getTool } from "../tools/registry";
import { agentService } from "./agent-service";
import { knowledgeService } from "./knowledge-service";

const MAX_TOOL_ITERATIONS = 5;
const MAX_HISTORY_MESSAGES = 30;

async function buildSystemPrompt(agent: Agent, userId: number, query?: string): Promise<string> {
  const sections: string[] = [];

  sections.push(
    agent.systemPrompt?.trim() ||
      `Eres ${agent.name}, un agente de IA. ${agent.description ?? ""}`.trim()
  );

  const knowledgeContext = await knowledgeService.buildContext(agent.id, 12_000, query);
  if (knowledgeContext) {
    sections.push(
      `## Conocimiento del agente\nUsa esta información como fuente principal cuando sea relevante:\n\n${knowledgeContext}`
    );
  }

  const memories = await memoryRepository.listByAgent(agent.id, userId);
  if (memories.length > 0) {
    sections.push(
      `## Memoria persistente\nHechos que recuerdas de interacciones anteriores:\n${memories
        .slice(0, 20)
        .map(m => `- ${m.memoryKey}: ${m.value}`)
        .join("\n")}`
    );
  }

  return sections.join("\n\n");
}

async function buildLLMTools(agentId: string): Promise<LLMTool[]> {
  const connected = await toolRepository.listByAgent(agentId);
  const tools: LLMTool[] = [];
  for (const item of connected) {
    if (!item.enabled) continue;
    const definition = getTool(item.toolKey);
    if (!definition) continue;
    tools.push({
      type: "function",
      function: {
        name: definition.id,
        description: definition.description,
        parameters: definition.schema(),
      },
    });
  }
  return tools;
}

export interface ChatResult {
  conversationId: string;
  messages: DbMessage[];
}

/**
 * Eventos emitidos durante un chat en streaming.
 * - onToken: fragmento de texto de la respuesta según se genera.
 * - onTool: el agente ha decidido usar una herramienta (el cliente debería
 *   descartar el texto parcial acumulado de este turno).
 */
export interface ChatEvents {
  onToken?: (text: string) => void;
  onTool?: (toolName: string) => void;
}

export const playgroundService = {
  listConversations(userId: number, agentId: string): Promise<Conversation[]> {
    return conversationRepository.listByAgent(agentId, userId);
  },

  async getMessages(userId: number, conversationId: string): Promise<DbMessage[]> {
    const conversation = await conversationRepository.findById(conversationId);
    if (!conversation || conversation.userId !== userId) throw new Error("Conversación no encontrada");
    return conversationRepository.listMessages(conversationId);
  },

  async deleteConversation(userId: number, conversationId: string): Promise<void> {
    const conversation = await conversationRepository.findById(conversationId);
    if (!conversation || conversation.userId !== userId) throw new Error("Conversación no encontrada");
    await conversationRepository.delete(conversationId);
  },

  /**
   * Envía un mensaje del usuario al agente y ejecuta el ciclo completo:
   * prompt → LLM → (tool calls → resultados → LLM)* → respuesta final.
   */
  async chat(
    userId: number,
    agentId: string,
    userMessage: string,
    conversationId?: string,
    events?: ChatEvents
  ): Promise<ChatResult> {
    const agent = await agentService.getOwned(userId, agentId);

    const conversation = conversationId
      ? await conversationRepository.findById(conversationId)
      : await conversationRepository.create(agentId, userId, userMessage.slice(0, 80));

    if (!conversation || conversation.userId !== userId || conversation.agentId !== agentId) {
      throw new Error("Conversación no encontrada");
    }

    await conversationRepository.appendMessage({
      id: nanoid(),
      conversationId: conversation.id,
      role: "user",
      content: userMessage,
    });

    const systemPrompt = await buildSystemPrompt(agent, userId, userMessage);
    const history = await conversationRepository.listMessages(conversation.id);
    const recent = history.slice(-MAX_HISTORY_MESSAGES);

    const llmMessages: Message[] = [
      { role: "system", content: systemPrompt },
      ...recent
        .filter(m => m.role === "user" || m.role === "assistant")
        .map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
    ];

    const tools = await buildLLMTools(agentId);
    const toolCtxBase = { agentId, userId, conversationId: conversation.id };

    let iterations = 0;
    let finalContent = "";

    while (iterations < MAX_TOOL_ITERATIONS) {
      iterations += 1;

      let content: string;
      let toolCalls: ToolCall[];

      if (events?.onToken) {
        // Modo streaming: los tokens se emiten según llegan. Si el turno
        // termina en tool calls, el cliente descarta el parcial al recibir onTool.
        const result = await streamLLM({
          messages: llmMessages,
          ...(tools.length > 0 ? { tools } : {}),
          onToken: events.onToken,
        });
        content = result.content;
        toolCalls = result.toolCalls;
      } else {
        const result = await invokeLLM({
          messages: llmMessages,
          ...(tools.length > 0 ? { tools, toolChoice: "auto" as const } : {}),
        });
        const choice = result.choices[0];
        content =
          typeof choice?.message.content === "string"
            ? choice.message.content
            : (choice?.message.content ?? [])
                .map(part => ("text" in part ? part.text : ""))
                .join("");
        toolCalls = choice?.message.tool_calls ?? [];
      }

      if (toolCalls.length === 0) {
        finalContent = content || "(sin respuesta)";
        break;
      }

      // Registrar la decisión del asistente de usar herramientas
      llmMessages.push({
        role: "assistant",
        content: content || `Usando herramientas: ${toolCalls.map(c => c.function.name).join(", ")}`,
      });

      for (const call of toolCalls) {
        let input: Record<string, unknown> = {};
        try {
          input = JSON.parse(call.function.arguments || "{}");
        } catch {
          /* argumentos inválidos: se ejecuta con objeto vacío */
        }

        events?.onTool?.(call.function.name);
        const connected = await toolRepository.findByAgentAndKey(agentId, call.function.name);
        const config = (connected?.config as Record<string, unknown>) ?? {};
        const toolResult = await executeTool(call.function.name, input, { ...toolCtxBase, config });

        await conversationRepository.appendMessage({
          id: nanoid(),
          conversationId: conversation.id,
          role: "tool",
          content: `[${call.function.name}] ${toolResult.output}`,
          toolCalls: { call: call.function.name, input },
        });

        llmMessages.push({
          role: "user",
          content: `Resultado de la herramienta ${call.function.name}:\n${toolResult.output}\n\nContinúa con la petición original del usuario usando este resultado.`,
        });
      }
    }

    if (!finalContent) {
      finalContent = "He alcanzado el límite de pasos de herramientas sin llegar a una respuesta final.";
    }

    await conversationRepository.appendMessage({
      id: nanoid(),
      conversationId: conversation.id,
      role: "assistant",
      content: finalContent,
    });
    await conversationRepository.touch(conversation.id);

    return {
      conversationId: conversation.id,
      messages: await conversationRepository.listMessages(conversation.id),
    };
  },
};
