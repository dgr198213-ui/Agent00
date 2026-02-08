import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
  json,
  boolean,
  index,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Reglas del sistema de decisión
 */
export const rules = mysqlTable("rules", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  category: mysqlEnum("category", ["safety", "productivity", "learning", "workflow", "custom"]).notNull(),
  condition: text("condition").notNull(),
  behavior: text("behavior").notNull(),
  priority: int("priority").default(50).notNull(),
  active: boolean("active").default(true).notNull(),
  confidence: decimal("confidence", { precision: 3, scale: 2 }).default("0.5").notNull(),
  successRate: decimal("successRate", { precision: 5, scale: 4 }),
  executionCount: int("executionCount").default(0),
  lastExecuted: timestamp("lastExecuted"),
  shadowMode: boolean("shadowMode").default(false),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("rules_userId_idx").on(table.userId),
  categoryIdx: index("rules_category_idx").on(table.category),
  activeIdx: index("rules_active_idx").on(table.active),
}));

export type Rule = typeof rules.$inferSelect;
export type InsertRule = typeof rules.$inferInsert;

/**
 * Registro de interacciones del usuario
 */
export const interactions = mysqlTable("interactions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull(),
  type: varchar("type", { length: 64 }).notNull(),
  description: text("description").notNull(),
  outcome: mysqlEnum("outcome", ["success", "failure", "partial", "unknown"]).default("unknown"),
  context: json("context"),
  duration: int("duration"),
  metadata: json("metadata"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("interactions_userId_idx").on(table.userId),
  typeIdx: index("interactions_type_idx").on(table.type),
  timestampIdx: index("interactions_timestamp_idx").on(table.timestamp),
}));

export type Interaction = typeof interactions.$inferSelect;
export type InsertInteraction = typeof interactions.$inferInsert;

/**
 * Patrones detectados en interacciones
 */
export const patterns = mysqlTable("patterns", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["sequential", "temporal", "frequency", "contextual"]).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  confidence: decimal("confidence", { precision: 3, scale: 2 }).notNull(),
  occurrences: int("occurrences").default(1),
  lastDetected: timestamp("lastDetected").defaultNow().notNull(),
  patternData: json("patternData").notNull(),
  suggestedRule: json("suggestedRule"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("patterns_userId_idx").on(table.userId),
  typeIdx: index("patterns_type_idx").on(table.type),
  confidenceIdx: index("patterns_confidence_idx").on(table.confidence),
}));

export type Pattern = typeof patterns.$inferSelect;
export type InsertPattern = typeof patterns.$inferInsert;

/**
 * Eventos de evolución del sistema
 */
export const evolutionEvents = mysqlTable("evolutionEvents", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull(),
  action: mysqlEnum("action", ["promote", "deprecate", "tune", "create_rule", "archive"]).notNull(),
  ruleId: varchar("ruleId", { length: 64 }),
  ruleName: varchar("ruleName", { length: 255 }),
  reason: text("reason"),
  metrics: json("metrics"),
  metadata: json("metadata"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("evolutionEvents_userId_idx").on(table.userId),
  actionIdx: index("evolutionEvents_action_idx").on(table.action),
  timestampIdx: index("evolutionEvents_timestamp_idx").on(table.timestamp),
}));

export type EvolutionEvent = typeof evolutionEvents.$inferSelect;
export type InsertEvolutionEvent = typeof evolutionEvents.$inferInsert;

/**
 * Perfil del usuario y preferencias
 */
export const userProfiles = mysqlTable("userProfiles", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull().unique(),
  role: varchar("role", { length: 64 }),
  domain: varchar("domain", { length: 255 }),
  goals: text("goals"),
  prefersAutomation: boolean("prefersAutomation").default(false),
  riskTolerance: mysqlEnum("riskTolerance", ["low", "medium", "high"]).default("medium"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("userProfiles_userId_idx").on(table.userId),
}));

export type UserProfile = typeof userProfiles.$inferSelect;
export type InsertUserProfile = typeof userProfiles.$inferInsert;

/**
 * Backups del sistema
 */
export const backups = mysqlTable("backups", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }),
  description: text("description"),
  size: int("size"),
  rulesCount: int("rulesCount"),
  interactionsCount: int("interactionsCount"),
  backupData: json("backupData").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("backups_userId_idx").on(table.userId),
  createdAtIdx: index("backups_createdAt_idx").on(table.createdAt),
}));

export type Backup = typeof backups.$inferSelect;
export type InsertBackup = typeof backups.$inferInsert;

/**
 * Estado del sistema por usuario
 */
export const systemStates = mysqlTable("systemStates", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull().unique(),
  mode: mysqlEnum("mode", ["zero_knowledge", "learning", "competent", "expert", "master"]).default("zero_knowledge"),
  maturity: decimal("maturity", { precision: 5, scale: 2 }).default("0").notNull(),
  totalInteractions: int("totalInteractions").default(0),
  activeRules: int("activeRules").default(0),
  detectedPatterns: int("detectedPatterns").default(0),
  lastEvolutionCycle: timestamp("lastEvolutionCycle"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("systemStates_userId_idx").on(table.userId),
}));

export type SystemState = typeof systemStates.$inferSelect;
export type InsertSystemState = typeof systemStates.$inferInsert;
