/**
 * Helpers de base de datos para el copiloto
 * Operaciones CRUD para reglas, interacciones, patrones, etc.
 */

import { eq, and, desc } from "drizzle-orm";
import { getDb } from "./db";
import {
  rules,
  interactions,
  patterns,
  evolutionEvents,
  userProfiles,
  systemStates,
  backups,
  type Rule,
  type Interaction,
  type Pattern,
  type EvolutionEvent,
  type UserProfile,
  type SystemState,
  type Backup,
  type InsertRule,
  type InsertInteraction,
  type InsertPattern,
  type InsertEvolutionEvent,
  type InsertUserProfile,
  type InsertSystemState,
  type InsertBackup,
} from "../drizzle/schema";

// ============================================================================
// REGLAS
// ============================================================================

export async function getRulesByUserId(userId: number): Promise<Rule[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(rules).where(eq(rules.userId, userId));
}

export async function getRuleById(ruleId: string): Promise<Rule | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(rules).where(eq(rules.id, ruleId)).limit(1);
  return result[0];
}

export async function createRule(userId: number, rule: Omit<InsertRule, 'userId'>): Promise<Rule> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const newRule: InsertRule = { ...rule, userId };
  await db.insert(rules).values(newRule);

  const created = await getRuleById(rule.id);
  if (!created) throw new Error("Failed to create rule");

  return created;
}

export async function updateRule(ruleId: string, updates: Partial<Rule>): Promise<Rule> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(rules).set(updates).where(eq(rules.id, ruleId));

  const updated = await getRuleById(ruleId);
  if (!updated) throw new Error("Failed to update rule");

  return updated;
}

export async function deleteRule(ruleId: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(rules).where(eq(rules.id, ruleId));
}

// ============================================================================
// INTERACCIONES
// ============================================================================

export async function getInteractionsByUserId(userId: number, limit = 100): Promise<Interaction[]> {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(interactions)
    .where(eq(interactions.userId, userId))
    .orderBy(desc(interactions.timestamp))
    .limit(limit);
}

export async function createInteraction(userId: number, interaction: Omit<InsertInteraction, 'userId'>): Promise<Interaction> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const newInteraction: InsertInteraction = { ...interaction, userId };
  await db.insert(interactions).values(newInteraction);

  const created = await db.select().from(interactions).where(eq(interactions.id, interaction.id)).limit(1);
  if (!created[0]) throw new Error("Failed to create interaction");

  return created[0];
}

export async function getInteractionStats(userId: number): Promise<{
  total: number;
  successRate: number;
  lastInteraction?: Date;
}> {
  const db = await getDb();
  if (!db) return { total: 0, successRate: 0 };

  const userInteractions = await getInteractionsByUserId(userId, 1000);

  const successCount = userInteractions.filter(i => i.outcome === 'success').length;
  const successRate = userInteractions.length > 0 ? successCount / userInteractions.length : 0;
  const lastInteraction = userInteractions.length > 0 ? userInteractions[0].timestamp : undefined;

  return {
    total: userInteractions.length,
    successRate,
    lastInteraction,
  };
}

// ============================================================================
// PATRONES
// ============================================================================

export async function getPatternsByUserId(userId: number): Promise<Pattern[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(patterns).where(eq(patterns.userId, userId));
}

export async function createPattern(userId: number, pattern: Omit<InsertPattern, 'userId'>): Promise<Pattern> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const newPattern: InsertPattern = { ...pattern, userId };
  await db.insert(patterns).values(newPattern);

  const created = await db.select().from(patterns).where(eq(patterns.id, pattern.id)).limit(1);
  if (!created[0]) throw new Error("Failed to create pattern");

  return created[0];
}

export async function deleteOldPatterns(userId: number, daysOld = 7): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  // Nota: Drizzle no tiene soporte directo para comparaciones de fecha en todas las BD
  // Esta es una aproximación simplificada
  const allPatterns = await getPatternsByUserId(userId);
  const oldPatterns = allPatterns.filter(p => p.lastDetected < cutoffDate);

  for (const pattern of oldPatterns) {
    await db.delete(patterns).where(eq(patterns.id, pattern.id));
  }
}

// ============================================================================
// EVENTOS DE EVOLUCIÓN
// ============================================================================

export async function getEvolutionEventsByUserId(userId: number, limit = 50): Promise<EvolutionEvent[]> {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(evolutionEvents)
    .where(eq(evolutionEvents.userId, userId))
    .orderBy(desc(evolutionEvents.timestamp))
    .limit(limit);
}

export async function createEvolutionEvent(userId: number, event: Omit<InsertEvolutionEvent, 'userId'>): Promise<EvolutionEvent> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const newEvent: InsertEvolutionEvent = { ...event, userId };
  await db.insert(evolutionEvents).values(newEvent);

  const created = await db.select().from(evolutionEvents).where(eq(evolutionEvents.id, event.id)).limit(1);
  if (!created[0]) throw new Error("Failed to create evolution event");

  return created[0];
}

// ============================================================================
// PERFILES DE USUARIO
// ============================================================================

export async function getUserProfile(userId: number): Promise<UserProfile | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);
  return result[0];
}

export async function createOrUpdateUserProfile(userId: number, profile: Omit<InsertUserProfile, 'userId'>): Promise<UserProfile> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await getUserProfile(userId);

  if (existing) {
    await db.update(userProfiles).set(profile).where(eq(userProfiles.userId, userId));
    const updated = await getUserProfile(userId);
    if (!updated) throw new Error("Failed to update profile");
    return updated;
  } else {
    const newProfile: InsertUserProfile = { ...profile, userId };
    await db.insert(userProfiles).values(newProfile);
    const created = await getUserProfile(userId);
    if (!created) throw new Error("Failed to create profile");
    return created;
  }
}

// ============================================================================
// ESTADO DEL SISTEMA
// ============================================================================

export async function getSystemState(userId: number): Promise<SystemState | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(systemStates).where(eq(systemStates.userId, userId)).limit(1);
  return result[0];
}

export async function createOrUpdateSystemState(userId: number, state: Omit<InsertSystemState, 'userId'>): Promise<SystemState> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await getSystemState(userId);

  if (existing) {
    await db.update(systemStates).set(state).where(eq(systemStates.userId, userId));
    const updated = await getSystemState(userId);
    if (!updated) throw new Error("Failed to update system state");
    return updated;
  } else {
    const newState: InsertSystemState = { ...state, userId };
    await db.insert(systemStates).values(newState);
    const created = await getSystemState(userId);
    if (!created) throw new Error("Failed to create system state");
    return created;
  }
}

// ============================================================================
// BACKUPS
// ============================================================================

export async function getBackupsByUserId(userId: number): Promise<Backup[]> {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(backups)
    .where(eq(backups.userId, userId))
    .orderBy(desc(backups.createdAt))
    .limit(10);
}

export async function createBackup(userId: number, backup: Omit<InsertBackup, 'userId'>): Promise<Backup> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const newBackup: InsertBackup = { ...backup, userId };
  await db.insert(backups).values(newBackup);

  const created = await db.select().from(backups).where(eq(backups.id, backup.id)).limit(1);
  if (!created[0]) throw new Error("Failed to create backup");

  return created[0];
}

export async function deleteOldBackups(userId: number, keepCount = 5): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const userBackups = await getBackupsByUserId(userId);

  if (userBackups.length > keepCount) {
    const toDelete = userBackups.slice(keepCount);
    for (const backup of toDelete) {
      await db.delete(backups).where(eq(backups.id, backup.id));
    }
  }
}
