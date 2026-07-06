/**
 * Capa de Aplicación — casos de uso de Agentes.
 */

import { nanoid } from "nanoid";
import type { Agent } from "../domain";
import { agentRepository } from "../infrastructure/repositories";

export interface CreateAgentInput {
  name: string;
  description?: string;
  model?: string;
  temperature?: number;
  systemPrompt?: string;
  icon?: string;
}

export interface UpdateAgentInput extends Partial<CreateAgentInput> {
  visibility?: "private" | "public";
}

export const agentService = {
  list(userId: number): Promise<Agent[]> {
    return agentRepository.listByUser(userId);
  },

  async getOwned(userId: number, agentId: string): Promise<Agent> {
    const agent = await agentRepository.findById(agentId);
    if (!agent || agent.userId !== userId) {
      throw new Error("Agente no encontrado");
    }
    return agent;
  },

  async create(userId: number, input: CreateAgentInput): Promise<Agent> {
    const id = nanoid();
    await agentRepository.create({
      id,
      userId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      model: input.model || "default",
      temperature: (input.temperature ?? 0.7).toFixed(2),
      systemPrompt: input.systemPrompt?.trim() || null,
      icon: input.icon || "bot",
      visibility: "private",
      status: "draft",
    });
    return this.getOwned(userId, id);
  },

  async update(userId: number, agentId: string, input: UpdateAgentInput): Promise<Agent> {
    await this.getOwned(userId, agentId);
    await agentRepository.update(agentId, {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
      ...(input.model !== undefined ? { model: input.model } : {}),
      ...(input.temperature !== undefined ? { temperature: input.temperature.toFixed(2) } : {}),
      ...(input.systemPrompt !== undefined ? { systemPrompt: input.systemPrompt?.trim() || null } : {}),
      ...(input.icon !== undefined ? { icon: input.icon } : {}),
      ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
    });
    return this.getOwned(userId, agentId);
  },

  async delete(userId: number, agentId: string): Promise<void> {
    await this.getOwned(userId, agentId);
    await agentRepository.delete(agentId);
  },
};
