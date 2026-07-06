/**
 * Capa de Aplicación — Deploy.
 *
 * Publicar un agente crea un Deployment. Tipos soportados:
 *  - private : el agente queda publicado solo para su propietario
 *  - public  : el agente aparece como público
 *  - api     : genera una API key para invocarlo vía REST (/api/v1/agents/:id/invoke)
 *  - widget  : genera un snippet embebible que usa la misma API
 *  - webhook : genera un endpoint + API key pensado para integraciones entrantes
 */

import { nanoid } from "nanoid";
import { invokeLLM, type Message } from "../_core/llm";
import type { Deployment } from "../domain";
import { agentRepository, deploymentRepository, memoryRepository } from "../infrastructure/repositories";
import { agentService } from "./agent-service";
import { knowledgeService } from "./knowledge-service";

export type DeploymentType = Deployment["type"];

function generateApiKey(): string {
  return `agk_${nanoid(40)}`;
}

const NEEDS_API_KEY: DeploymentType[] = ["api", "widget", "webhook"];

export const deploymentService = {
  async list(userId: number, agentId: string): Promise<Deployment[]> {
    await agentService.getOwned(userId, agentId);
    return deploymentRepository.listByAgent(agentId);
  },

  async publish(userId: number, agentId: string, type: DeploymentType): Promise<Deployment[]> {
    const agent = await agentService.getOwned(userId, agentId);

    const existing = await deploymentRepository.listByAgent(agentId);
    const active = existing.find(d => d.type === type && d.status === "active");
    if (!active) {
      await deploymentRepository.create({
        id: nanoid(),
        agentId,
        userId,
        type,
        apiKey: NEEDS_API_KEY.includes(type) ? generateApiKey() : null,
        status: "active",
        config: null,
      });
    }

    await agentRepository.update(agentId, {
      status: "published",
      visibility: type === "public" ? "public" : agent.visibility,
    });

    return deploymentRepository.listByAgent(agentId);
  },

  async revoke(userId: number, deploymentId: string): Promise<Deployment[]> {
    const deployment = await deploymentRepository.findById(deploymentId);
    if (!deployment || deployment.userId !== userId) throw new Error("Deployment no encontrado");
    await deploymentRepository.revoke(deploymentId);

    const remaining = await deploymentRepository.listByAgent(deployment.agentId);
    if (!remaining.some(d => d.status === "active")) {
      await agentRepository.update(deployment.agentId, { status: "draft" });
    }
    return remaining;
  },

  /**
   * Invocación externa vía API key (endpoint REST público).
   * Es stateless: no usa memoria de conversación, solo identidad + conocimiento + memoria del agente.
   */
  async invokeViaApiKey(apiKey: string, userMessage: string): Promise<{ agent: string; reply: string }> {
    const deployment = await deploymentRepository.findByApiKey(apiKey);
    if (!deployment || deployment.status !== "active") {
      throw new Error("API key inválida o revocada");
    }

    const agent = await agentRepository.findById(deployment.agentId);
    if (!agent || agent.status !== "published") {
      throw new Error("Agente no disponible");
    }

    const sections: string[] = [
      agent.systemPrompt?.trim() || `Eres ${agent.name}. ${agent.description ?? ""}`.trim(),
    ];
    const knowledgeContext = await knowledgeService.buildContext(agent.id);
    if (knowledgeContext) sections.push(`## Conocimiento del agente\n${knowledgeContext}`);
    const memories = await memoryRepository.listByAgent(agent.id, agent.userId);
    if (memories.length > 0) {
      sections.push(
        `## Memoria persistente\n${memories.slice(0, 20).map(m => `- ${m.memoryKey}: ${m.value}`).join("\n")}`
      );
    }

    const messages: Message[] = [
      { role: "system", content: sections.join("\n\n") },
      { role: "user", content: userMessage },
    ];

    const result = await invokeLLM({ messages });
    const choice = result.choices[0];
    const reply =
      typeof choice?.message.content === "string"
        ? choice.message.content
        : (choice?.message.content ?? []).map(p => ("text" in p ? p.text : "")).join("");

    return { agent: agent.name, reply: reply || "(sin respuesta)" };
  },
};
