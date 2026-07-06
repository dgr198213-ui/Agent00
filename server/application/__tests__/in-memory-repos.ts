/**
 * Implementaciones en memoria de los repositorios del dominio.
 *
 * Permiten testear la capa Application de extremo a extremo sin base de
 * datos: los tests hacen `vi.mock("../infrastructure/repositories")` y
 * exportan estas implementaciones en su lugar (misma interfaz del dominio).
 */

import { nanoid } from "nanoid";
import type {
  Agent,
  AgentKnowledge,
  AgentMemory,
  AgentTool,
  AgentRepository,
  ChunkRepository,
  Conversation,
  ConversationRepository,
  DbMessage,
  Deployment,
  DeploymentRepository,
  InsertAgent,
  InsertAgentKnowledge,
  InsertAgentTool,
  InsertDbMessage,
  InsertDeployment,
  InsertKnowledgeChunk,
  KnowledgeChunk,
  KnowledgeRepository,
  MemoryRepository,
  ToolRepository,
} from "../../domain";

export interface InMemoryState {
  agents: Map<string, Agent>;
  knowledge: Map<string, AgentKnowledge>;
  chunks: Map<string, KnowledgeChunk>;
  tools: Map<string, AgentTool>;
  memories: Map<string, AgentMemory>;
  conversations: Map<string, Conversation>;
  messages: DbMessage[];
  deployments: Map<string, Deployment>;
}

export function createInMemoryState(): InMemoryState {
  return {
    agents: new Map(),
    knowledge: new Map(),
    chunks: new Map(),
    tools: new Map(),
    memories: new Map(),
    conversations: new Map(),
    messages: [],
    deployments: new Map(),
  };
}

export function createInMemoryRepos(state: InMemoryState) {
  const now = () => new Date();

  const agentRepository: AgentRepository = {
    async listByUser(userId) {
      return [...state.agents.values()].filter(agent => agent.userId === userId);
    },
    async findById(id) {
      return state.agents.get(id);
    },
    async create(agent: InsertAgent) {
      state.agents.set(agent.id, {
        description: null,
        systemPrompt: null,
        icon: "bot",
        visibility: "private",
        status: "draft",
        workspaceId: null,
        model: "default",
        temperature: "0.70",
        createdAt: now(),
        updatedAt: now(),
        ...agent,
      } as Agent);
    },
    async update(id, patch) {
      const existing = state.agents.get(id);
      if (existing) state.agents.set(id, { ...existing, ...patch, updatedAt: now() } as Agent);
    },
    async delete(id) {
      state.agents.delete(id);
      for (const [key, chunk] of state.chunks) if (chunk.agentId === id) state.chunks.delete(key);
      for (const [key, item] of state.knowledge) if (item.agentId === id) state.knowledge.delete(key);
    },
  };

  const knowledgeRepository: KnowledgeRepository = {
    async listByAgent(agentId) {
      return [...state.knowledge.values()].filter(item => item.agentId === agentId);
    },
    async findById(id) {
      return state.knowledge.get(id);
    },
    async create(item: InsertAgentKnowledge) {
      state.knowledge.set(item.id, {
        content: null,
        sourceUrl: null,
        errorMessage: null,
        size: 0,
        status: "pending",
        createdAt: now(),
        updatedAt: now(),
        ...item,
      } as AgentKnowledge);
    },
    async update(id, patch) {
      const existing = state.knowledge.get(id);
      if (existing) state.knowledge.set(id, { ...existing, ...patch } as AgentKnowledge);
    },
    async delete(id) {
      state.knowledge.delete(id);
    },
  };

  const chunkRepository: ChunkRepository = {
    async listByAgent(agentId) {
      return [...state.chunks.values()]
        .filter(chunk => chunk.agentId === agentId)
        .sort((a, b) => a.chunkIndex - b.chunkIndex);
    },
    async createMany(chunks: InsertKnowledgeChunk[]) {
      for (const chunk of chunks) {
        state.chunks.set(chunk.id, { createdAt: now(), embedding: null, ...chunk } as KnowledgeChunk);
      }
    },
    async deleteByKnowledgeId(knowledgeId) {
      for (const [key, chunk] of state.chunks) {
        if (chunk.knowledgeId === knowledgeId) state.chunks.delete(key);
      }
    },
    async deleteByAgentId(agentId) {
      for (const [key, chunk] of state.chunks) {
        if (chunk.agentId === agentId) state.chunks.delete(key);
      }
    },
  };

  const toolRepository: ToolRepository = {
    async listByAgent(agentId) {
      return [...state.tools.values()].filter(tool => tool.agentId === agentId);
    },
    async findByAgentAndKey(agentId, toolKey) {
      return [...state.tools.values()].find(
        tool => tool.agentId === agentId && tool.toolKey === toolKey
      );
    },
    async upsert(item: InsertAgentTool) {
      const existing = await this.findByAgentAndKey(item.agentId, item.toolKey);
      const id = existing?.id ?? item.id;
      state.tools.set(id, {
        enabled: true,
        config: {},
        createdAt: now(),
        ...existing,
        ...item,
        id,
      } as AgentTool);
    },
    async setEnabled(id, enabled) {
      const existing = state.tools.get(id);
      if (existing) state.tools.set(id, { ...existing, enabled });
    },
    async delete(id) {
      state.tools.delete(id);
    },
  };

  const memoryRepository: MemoryRepository = {
    async listByAgent(agentId, userId) {
      return [...state.memories.values()].filter(
        memory => memory.agentId === agentId && memory.userId === userId
      );
    },
    async upsert(agentId, userId, key, value) {
      const existing = [...state.memories.values()].find(
        memory => memory.agentId === agentId && memory.userId === userId && memory.memoryKey === key
      );
      const id = existing?.id ?? nanoid();
      state.memories.set(id, {
        id,
        agentId,
        userId,
        memoryKey: key,
        value,
        createdAt: existing?.createdAt ?? now(),
        updatedAt: now(),
      } as AgentMemory);
    },
    async delete(id) {
      state.memories.delete(id);
    },
  };

  const conversationRepository: ConversationRepository = {
    async listByAgent(agentId, userId) {
      return [...state.conversations.values()].filter(
        conversation => conversation.agentId === agentId && conversation.userId === userId
      );
    },
    async findById(id) {
      return state.conversations.get(id);
    },
    async create(agentId, userId, title) {
      const conversation = {
        id: nanoid(),
        agentId,
        userId,
        title: title ?? "Nueva conversación",
        createdAt: now(),
        updatedAt: now(),
      } as Conversation;
      state.conversations.set(conversation.id, conversation);
      return conversation;
    },
    async touch(id) {
      const existing = state.conversations.get(id);
      if (existing) state.conversations.set(id, { ...existing, updatedAt: now() });
    },
    async delete(id) {
      state.conversations.delete(id);
      state.messages = state.messages.filter(message => message.conversationId !== id);
    },
    async listMessages(conversationId) {
      return state.messages.filter(message => message.conversationId === conversationId);
    },
    async appendMessage(message: InsertDbMessage) {
      state.messages.push({ toolCalls: null, createdAt: now(), ...message } as DbMessage);
    },
  };

  const deploymentRepository: DeploymentRepository = {
    async listByAgent(agentId) {
      return [...state.deployments.values()].filter(
        deployment => deployment.agentId === agentId
      );
    },
    async findById(id) {
      return state.deployments.get(id);
    },
    async findByApiKey(apiKey) {
      return [...state.deployments.values()].find(deployment => deployment.apiKey === apiKey);
    },
    async create(item: InsertDeployment) {
      state.deployments.set(item.id, {
        apiKey: null,
        config: null,
        status: "active",
        createdAt: now(),
        ...item,
      } as Deployment);
    },
    async revoke(id) {
      const existing = state.deployments.get(id);
      if (existing) state.deployments.set(id, { ...existing, status: "revoked" });
    },
  };

  return {
    agentRepository,
    knowledgeRepository,
    chunkRepository,
    toolRepository,
    memoryRepository,
    conversationRepository,
    deploymentRepository,
  };
}

/** Estado singleton compartido entre el mock (hoisted) y los tests. */
export const sharedState = createInMemoryState();

export function resetSharedState(): void {
  sharedState.agents.clear();
  sharedState.knowledge.clear();
  sharedState.chunks.clear();
  sharedState.tools.clear();
  sharedState.memories.clear();
  sharedState.conversations.clear();
  sharedState.messages = [];
  sharedState.deployments.clear();
}
