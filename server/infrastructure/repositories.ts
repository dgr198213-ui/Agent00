/**
 * Capa de Infraestructura — implementaciones Drizzle de los repositorios del dominio.
 */

import { and, desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  agents,
  agentKnowledge,
  knowledgeChunks,
  agentTools,
  agentMemories,
  conversations,
  messages,
  deployments,
  type Agent,
  type InsertAgent,
  type AgentKnowledge,
  type InsertAgentKnowledge,
  type KnowledgeChunk,
  type InsertKnowledgeChunk,
  type AgentTool,
  type InsertAgentTool,
  type AgentMemory,
  type Conversation,
  type DbMessage,
  type InsertDbMessage,
  type Deployment,
  type InsertDeployment,
} from "../../drizzle/schema";
import { getDb } from "../db";
import type {
  AgentRepository,
  KnowledgeRepository,
  ChunkRepository,
  ToolRepository,
  MemoryRepository,
  ConversationRepository,
  DeploymentRepository,
} from "../domain";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Base de datos no disponible");
  return db;
}

// ============================================================================
// AGENTS
// ============================================================================

export const agentRepository: AgentRepository = {
  async listByUser(userId: number): Promise<Agent[]> {
    const db = await requireDb();
    return db.select().from(agents).where(eq(agents.userId, userId)).orderBy(desc(agents.updatedAt));
  },

  async findById(id: string): Promise<Agent | undefined> {
    const db = await requireDb();
    const rows = await db.select().from(agents).where(eq(agents.id, id)).limit(1);
    return rows[0];
  },

  async create(agent: InsertAgent): Promise<void> {
    const db = await requireDb();
    await db.insert(agents).values(agent);
  },

  async update(id: string, patch: Partial<InsertAgent>): Promise<void> {
    const db = await requireDb();
    await db.update(agents).set(patch).where(eq(agents.id, id));
  },

  async delete(id: string): Promise<void> {
    const db = await requireDb();
    await db.delete(agentKnowledge).where(eq(agentKnowledge.agentId, id));
    await db.delete(agentTools).where(eq(agentTools.agentId, id));
    await db.delete(agentMemories).where(eq(agentMemories.agentId, id));
    await db.delete(deployments).where(eq(deployments.agentId, id));
    const convs = await db.select().from(conversations).where(eq(conversations.agentId, id));
    for (const conv of convs) {
      await db.delete(messages).where(eq(messages.conversationId, conv.id));
    }
    await db.delete(conversations).where(eq(conversations.agentId, id));
    await db.delete(agents).where(eq(agents.id, id));
  },
};

// ============================================================================
// KNOWLEDGE
// ============================================================================

export const knowledgeRepository: KnowledgeRepository = {
  async listByAgent(agentId: string): Promise<AgentKnowledge[]> {
    const db = await requireDb();
    return db
      .select()
      .from(agentKnowledge)
      .where(eq(agentKnowledge.agentId, agentId))
      .orderBy(desc(agentKnowledge.createdAt));
  },

  async findById(id: string): Promise<AgentKnowledge | undefined> {
    const db = await requireDb();
    const rows = await db.select().from(agentKnowledge).where(eq(agentKnowledge.id, id)).limit(1);
    return rows[0];
  },

  async create(item: InsertAgentKnowledge): Promise<void> {
    const db = await requireDb();
    await db.insert(agentKnowledge).values(item);
  },

  async update(id: string, patch: Partial<InsertAgentKnowledge>): Promise<void> {
    const db = await requireDb();
    await db.update(agentKnowledge).set(patch).where(eq(agentKnowledge.id, id));
  },

  async delete(id: string): Promise<void> {
    const db = await requireDb();
    await db.delete(agentKnowledge).where(eq(agentKnowledge.id, id));
  },
};

// ============================================================================
// KNOWLEDGE CHUNKS
// ============================================================================

export const chunkRepository: ChunkRepository = {
  async listByAgent(agentId: string): Promise<KnowledgeChunk[]> {
    const db = await requireDb();
    return db
      .select()
      .from(knowledgeChunks)
      .where(eq(knowledgeChunks.agentId, agentId))
      .orderBy(knowledgeChunks.knowledgeId, knowledgeChunks.chunkIndex);
  },

  async createMany(chunks: InsertKnowledgeChunk[]): Promise<void> {
    if (chunks.length === 0) return;
    const db = await requireDb();
    // Insertar por lotes para no exceder el tamaño máximo de paquete MySQL.
    const BATCH = 50;
    for (let i = 0; i < chunks.length; i += BATCH) {
      await db.insert(knowledgeChunks).values(chunks.slice(i, i + BATCH));
    }
  },

  async deleteByKnowledgeId(knowledgeId: string): Promise<void> {
    const db = await requireDb();
    await db.delete(knowledgeChunks).where(eq(knowledgeChunks.knowledgeId, knowledgeId));
  },

  async deleteByAgentId(agentId: string): Promise<void> {
    const db = await requireDb();
    await db.delete(knowledgeChunks).where(eq(knowledgeChunks.agentId, agentId));
  },
};

// ============================================================================
// TOOLS
// ============================================================================

export const toolRepository: ToolRepository = {
  async listByAgent(agentId: string): Promise<AgentTool[]> {
    const db = await requireDb();
    return db.select().from(agentTools).where(eq(agentTools.agentId, agentId));
  },

  async findByAgentAndKey(agentId: string, toolKey: string): Promise<AgentTool | undefined> {
    const db = await requireDb();
    const rows = await db
      .select()
      .from(agentTools)
      .where(and(eq(agentTools.agentId, agentId), eq(agentTools.toolKey, toolKey)))
      .limit(1);
    return rows[0];
  },

  async upsert(item: InsertAgentTool): Promise<void> {
    const db = await requireDb();
    const existing = await this.findByAgentAndKey(item.agentId, item.toolKey);
    if (existing) {
      await db
        .update(agentTools)
        .set({ config: item.config, enabled: item.enabled ?? true })
        .where(eq(agentTools.id, existing.id));
    } else {
      await db.insert(agentTools).values({ ...item, id: item.id || nanoid() });
    }
  },

  async setEnabled(id: string, enabled: boolean): Promise<void> {
    const db = await requireDb();
    await db.update(agentTools).set({ enabled }).where(eq(agentTools.id, id));
  },

  async delete(id: string): Promise<void> {
    const db = await requireDb();
    await db.delete(agentTools).where(eq(agentTools.id, id));
  },
};

// ============================================================================
// MEMORY (persistente por agente)
// ============================================================================

export const memoryRepository: MemoryRepository = {
  async listByAgent(agentId: string, userId: number): Promise<AgentMemory[]> {
    const db = await requireDb();
    return db
      .select()
      .from(agentMemories)
      .where(and(eq(agentMemories.agentId, agentId), eq(agentMemories.userId, userId)))
      .orderBy(desc(agentMemories.updatedAt));
  },

  async upsert(agentId: string, userId: number, key: string, value: string): Promise<void> {
    const db = await requireDb();
    const rows = await db
      .select()
      .from(agentMemories)
      .where(
        and(
          eq(agentMemories.agentId, agentId),
          eq(agentMemories.userId, userId),
          eq(agentMemories.memoryKey, key)
        )
      )
      .limit(1);

    if (rows[0]) {
      await db.update(agentMemories).set({ value }).where(eq(agentMemories.id, rows[0].id));
    } else {
      await db.insert(agentMemories).values({ id: nanoid(), agentId, userId, memoryKey: key, value });
    }
  },

  async delete(id: string): Promise<void> {
    const db = await requireDb();
    await db.delete(agentMemories).where(eq(agentMemories.id, id));
  },
};

// ============================================================================
// CONVERSATIONS (memoria temporal)
// ============================================================================

export const conversationRepository: ConversationRepository = {
  async listByAgent(agentId: string, userId: number): Promise<Conversation[]> {
    const db = await requireDb();
    return db
      .select()
      .from(conversations)
      .where(and(eq(conversations.agentId, agentId), eq(conversations.userId, userId)))
      .orderBy(desc(conversations.updatedAt));
  },

  async findById(id: string): Promise<Conversation | undefined> {
    const db = await requireDb();
    const rows = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
    return rows[0];
  },

  async create(agentId: string, userId: number, title = "Nueva conversación"): Promise<Conversation> {
    const db = await requireDb();
    const id = nanoid();
    await db.insert(conversations).values({ id, agentId, userId, title });
    const rows = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
    return rows[0];
  },

  async touch(id: string): Promise<void> {
    const db = await requireDb();
    await db.update(conversations).set({ updatedAt: new Date() }).where(eq(conversations.id, id));
  },

  async delete(id: string): Promise<void> {
    const db = await requireDb();
    await db.delete(messages).where(eq(messages.conversationId, id));
    await db.delete(conversations).where(eq(conversations.id, id));
  },

  async listMessages(conversationId: string): Promise<DbMessage[]> {
    const db = await requireDb();
    return db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);
  },

  async appendMessage(message: InsertDbMessage): Promise<void> {
    const db = await requireDb();
    await db.insert(messages).values(message);
  },
};

// ============================================================================
// DEPLOYMENTS
// ============================================================================

export const deploymentRepository: DeploymentRepository = {
  async listByAgent(agentId: string): Promise<Deployment[]> {
    const db = await requireDb();
    return db
      .select()
      .from(deployments)
      .where(eq(deployments.agentId, agentId))
      .orderBy(desc(deployments.createdAt));
  },

  async findById(id: string): Promise<Deployment | undefined> {
    const db = await requireDb();
    const rows = await db.select().from(deployments).where(eq(deployments.id, id)).limit(1);
    return rows[0];
  },

  async findByApiKey(apiKey: string): Promise<Deployment | undefined> {
    const db = await requireDb();
    const rows = await db.select().from(deployments).where(eq(deployments.apiKey, apiKey)).limit(1);
    return rows[0];
  },

  async create(item: InsertDeployment): Promise<void> {
    const db = await requireDb();
    await db.insert(deployments).values(item);
  },

  async revoke(id: string): Promise<void> {
    const db = await requireDb();
    await db.update(deployments).set({ status: "revoked" }).where(eq(deployments.id, id));
  },
};
