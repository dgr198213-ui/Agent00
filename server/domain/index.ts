/**
 * Capa de Dominio — Agent Builder Platform
 *
 * Define las entidades y contratos del ciclo de vida de un agente:
 * Agent → Knowledge → Tool → Memory → Deployment
 *
 * Esta capa NO depende de Express, tRPC ni Drizzle.
 */

export type {
  Agent,
  InsertAgent,
  AgentKnowledge,
  InsertAgentKnowledge,
  KnowledgeChunk,
  InsertKnowledgeChunk,
  AgentTool,
  InsertAgentTool,
  AgentMemory,
  InsertAgentMemory,
  Conversation,
  InsertConversation,
  DbMessage,
  InsertDbMessage,
  Deployment,
  InsertDeployment,
  Workspace,
} from "../../drizzle/schema";

// ============================================================================
// TOOLS — interfaz única que implementa cada herramienta
// ============================================================================

export interface ToolExecutionContext {
  agentId: string;
  userId: number;
  conversationId?: string;
  /** Configuración guardada por el usuario para esta herramienta (URLs, headers…) */
  config: Record<string, unknown>;
}

export interface ToolResult {
  success: boolean;
  output: string;
  metadata?: Record<string, unknown>;
}

/**
 * Tool { id, name, execute(), schema() }
 * Contrato único para todas las herramientas de la plataforma.
 */
export interface AgentToolDefinition {
  /** Clave estable usada en BD (toolKey) */
  id: string;
  name: string;
  description: string;
  /** JSON Schema de los parámetros que el LLM debe generar */
  schema(): Record<string, unknown>;
  execute(input: Record<string, unknown>, ctx: ToolExecutionContext): Promise<ToolResult>;
  /** Campos de configuración que el usuario debe rellenar al conectar la herramienta */
  configFields?: Array<{ key: string; label: string; required: boolean; placeholder?: string }>;
}

// ============================================================================
// REPOSITORIOS — contratos de persistencia (implementados en Infrastructure)
// ============================================================================

import type {
  Agent,
  InsertAgent,
  AgentKnowledge,
  InsertAgentKnowledge,
  KnowledgeChunk,
  InsertKnowledgeChunk,
  AgentTool,
  InsertAgentTool,
  AgentMemory,
  Conversation,
  DbMessage,
  InsertDbMessage,
  Deployment,
  InsertDeployment,
} from "../../drizzle/schema";

export interface AgentRepository {
  listByUser(userId: number): Promise<Agent[]>;
  findById(id: string): Promise<Agent | undefined>;
  create(agent: InsertAgent): Promise<void>;
  update(id: string, patch: Partial<InsertAgent>): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface KnowledgeRepository {
  listByAgent(agentId: string): Promise<AgentKnowledge[]>;
  findById(id: string): Promise<AgentKnowledge | undefined>;
  create(item: InsertAgentKnowledge): Promise<void>;
  update(id: string, patch: Partial<InsertAgentKnowledge>): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface ChunkRepository {
  listByAgent(agentId: string): Promise<KnowledgeChunk[]>;
  createMany(chunks: InsertKnowledgeChunk[]): Promise<void>;
  deleteByKnowledgeId(knowledgeId: string): Promise<void>;
  deleteByAgentId(agentId: string): Promise<void>;
}

export interface ToolRepository {
  listByAgent(agentId: string): Promise<AgentTool[]>;
  findByAgentAndKey(agentId: string, toolKey: string): Promise<AgentTool | undefined>;
  upsert(item: InsertAgentTool): Promise<void>;
  setEnabled(id: string, enabled: boolean): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface MemoryRepository {
  listByAgent(agentId: string, userId: number): Promise<AgentMemory[]>;
  upsert(agentId: string, userId: number, key: string, value: string): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface ConversationRepository {
  listByAgent(agentId: string, userId: number): Promise<Conversation[]>;
  findById(id: string): Promise<Conversation | undefined>;
  create(agentId: string, userId: number, title?: string): Promise<Conversation>;
  touch(id: string): Promise<void>;
  delete(id: string): Promise<void>;
  listMessages(conversationId: string): Promise<DbMessage[]>;
  appendMessage(message: InsertDbMessage): Promise<void>;
}

export interface DeploymentRepository {
  listByAgent(agentId: string): Promise<Deployment[]>;
  findById(id: string): Promise<Deployment | undefined>;
  findByApiKey(apiKey: string): Promise<Deployment | undefined>;
  create(item: InsertDeployment): Promise<void>;
  revoke(id: string): Promise<void>;
}
