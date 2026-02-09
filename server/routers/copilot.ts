/**
 * Router tRPC para el Copiloto Maestro
 * Procedimientos para reglas, interacciones, patrones, evolución y más
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { DecisionEngine } from "../engines/decision-engine";
import { PatternDetector } from "../engines/pattern-detector";
import { EvolutionEngine } from "../engines/evolution-engine";
import * as db from "../copilot-db";
import { nanoid } from "nanoid";
import type { Rule, DecisionContext, Pattern } from "@shared/types";
import { RuleCategory, SystemMode } from "@shared/types";

// ============================================================================
// INSTANCIAS DE MOTORES
// ============================================================================

const decisionEngine = new DecisionEngine();
const patternDetector = new PatternDetector();
const evolutionEngine = new EvolutionEngine();

// ============================================================================
// VALIDADORES
// ============================================================================

const RuleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.enum(["safety", "productivity", "learning", "workflow", "custom"]),
  condition: z.string().min(1),
  behavior: z.string().min(1),
  priority: z.number().int().min(1).max(100).default(50),
  confidence: z.number().min(0).max(1).default(0.5),
});

const InteractionSchema = z.object({
  type: z.string().min(1),
  description: z.string().min(1),
  outcome: z.enum(["success", "failure", "partial", "unknown"]).default("unknown"),
  context: z.record(z.string(), z.any()).optional(),
  duration: z.number().optional(),
});

const DecisionContextSchema = z.record(z.string(), z.any());

// ============================================================================
// ROUTER COPILOTO
// ============================================================================

export const copilotRouter = router({
  // ========================================================================
  // REGLAS
  // ========================================================================

  rules: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const userRules = await db.getRulesByUserId(ctx.user.id);
      return userRules;
    }),

    get: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ input }) => {
      const rule = await db.getRuleById(input.id);
      if (!rule) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Regla no encontrada" });
      }
      return rule;
    }),

    create: protectedProcedure.input(RuleSchema).mutation(async ({ ctx, input }) => {
      // Validar condición
      const validation = decisionEngine.validateCondition(input.condition);
      if (!validation.valid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Condición inválida: ${validation.error}`,
        });
      }

      const newRule = await db.createRule(ctx.user.id, {
        id: nanoid(),
        name: input.name,
        description: input.description || null,
        category: input.category,
        condition: input.condition,
        behavior: input.behavior,
        priority: input.priority,
        confidence: input.confidence.toString(),
        active: true,
        executionCount: 0,
        successRate: null,
      });

      // Invalidar índice para que se reconstruya en la próxima evaluación
      decisionEngine.invalidateIndex();

      return newRule;
    }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.string(),
          updates: RuleSchema.partial(),
        })
      )
      .mutation(async ({ input }) => {
        // Validar condición si se actualiza
        if (input.updates.condition) {
          const validation = decisionEngine.validateCondition(input.updates.condition);
          if (!validation.valid) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Condición inválida: ${validation.error}`,
            });
          }
        }

        const updated = await db.updateRule(input.id, {
          ...input.updates,
          updatedAt: new Date(),
        } as any);

        // Invalidar índice después de actualizar
        decisionEngine.invalidateIndex();

        return updated;
      }),

    delete: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ input }) => {
      await db.deleteRule(input.id);
      // Invalidar índice después de eliminar
      decisionEngine.invalidateIndex();
      return { success: true };
    }),

    toggle: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ input }) => {
      const rule = await db.getRuleById(input.id);
      if (!rule) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Regla no encontrada" });
      }

      const updated = await db.updateRule(input.id, {
        active: !rule.active,
        updatedAt: new Date(),
      } as any);

      // Invalidar índice después de cambiar estado
      decisionEngine.invalidateIndex();

      return updated;
    }),

    test: protectedProcedure
      .input(
        z.object({
          id: z.string(),
          context: DecisionContextSchema,
        })
      )
      .query(async ({ input }) => {
        const rule = await db.getRuleById(input.id);
        if (!rule) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Regla no encontrada" });
        }

        const result = decisionEngine.evaluateRule(rule as any, input.context);
        return result;
      }),
  }),

  // ========================================================================
  // INTERACCIONES
  // ========================================================================

  interactions: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const userInteractions = await db.getInteractionsByUserId(ctx.user.id, 100);
      return userInteractions;
    }),

    record: protectedProcedure.input(InteractionSchema).mutation(async ({ ctx, input }) => {
      const newInteraction = await db.createInteraction(ctx.user.id, {
        id: nanoid(),
        type: input.type,
        description: input.description,
        outcome: input.outcome as any,
        context: input.context,
        duration: input.duration,
        timestamp: new Date(),
      });

      return newInteraction;
    }),

    stats: protectedProcedure.query(async ({ ctx }) => {
      const stats = await db.getInteractionStats(ctx.user.id);
      return stats;
    }),
  }),

  // ========================================================================
  // DECISIONES
  // ========================================================================

  decisions: router({
    evaluate: protectedProcedure.input(DecisionContextSchema).query(async ({ ctx, input }) => {
      const rules = await db.getRulesByUserId(ctx.user.id);
      const result = decisionEngine.evaluateRules(rules as any, input);

      // Registrar ejecuciones en el motor de evolución
      for (const decision of result.results) {
        evolutionEngine.recordDecisionResult(decision.ruleId, true, decision.executionTime);
      }

      return result;
    }),
  }),

  metrics: router({
    system: protectedProcedure.query(async () => {
      return decisionEngine.getSystemMetrics();
    }),

    rule: protectedProcedure
      .input(z.object({ ruleId: z.string() }))
      .query(async ({ input }) => {
        const metrics = decisionEngine.getRuleMetrics(input.ruleId);
        if (!metrics) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Metricas no encontradas para esta regla",
          });
        }
        return metrics;
      }),
  }),

  // ========================================================================
  // PATRONES
  // ========================================================================

  patterns: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const userPatterns = await db.getPatternsByUserId(ctx.user.id);
      return userPatterns;
    }),

    detect: protectedProcedure.mutation(async ({ ctx }) => {
      const interactions = await db.getInteractionsByUserId(ctx.user.id, 100);
      const detectedPatterns = patternDetector.detectPatterns(interactions);

      // Guardar patrones detectados
      for (const pattern of detectedPatterns) {
        await db.createPattern(ctx.user.id, {
          id: nanoid(),
          type: pattern.type as any,
          name: pattern.name,
          description: pattern.description || null,
          confidence: pattern.confidence.toString(),
          occurrences: pattern.occurrences,
          lastDetected: new Date(),
          patternData: pattern.metadata || {},
          suggestedRule: pattern.suggestedRule || null,
        });
      }

      return detectedPatterns;
    }),
  }),

  // ========================================================================
  // EVOLUCIÓN
  // ========================================================================

  evolution: router({
    run: protectedProcedure.mutation(async ({ ctx }) => {
      const rules = await db.getRulesByUserId(ctx.user.id);
      const patterns = await db.getPatternsByUserId(ctx.user.id);
      const interactions = await db.getInteractionsByUserId(ctx.user.id, 1000);

      // Evaluar evolución
      const actions = evolutionEngine.evaluateEvolution(rules as any, patterns as any, interactions);

      // Aplicar acciones
      const evolutionResult = evolutionEngine.applyEvolution(
        { action: "evaluate" },
        rules as any,
        ctx.user.id
      );

      // Guardar eventos
      for (const event of evolutionResult.events) {
        await db.createEvolutionEvent(ctx.user.id, {
          id: nanoid(),
          action: event.action as any,
          ruleId: event.ruleId,
          ruleName: event.ruleName,
          reason: event.reason,
          metrics: event.metrics,
          timestamp: new Date(),
        });
      }

      // Actualizar estado del sistema
      const metrics = evolutionEngine.getMetrics(rules as any, interactions);
      const systemMode = calculateSystemMode(metrics.systemMaturity);

      await db.createOrUpdateSystemState(ctx.user.id, {
        id: nanoid(),
        mode: systemMode as any,
        maturity: metrics.systemMaturity.toString(),
        totalInteractions: interactions.length,
        activeRules: metrics.activeRules,
        detectedPatterns: patterns.length,
        lastEvolutionCycle: new Date(),
      } as any);

      return {
        actions,
        events: evolutionResult.events,
        metrics,
      };
    }),

    events: protectedProcedure.query(async ({ ctx }) => {
      const events = await db.getEvolutionEventsByUserId(ctx.user.id, 50);
      return events;
    }),

    metrics: protectedProcedure.query(async ({ ctx }) => {
      const rules = await db.getRulesByUserId(ctx.user.id);
      const interactions = await db.getInteractionsByUserId(ctx.user.id, 1000);
      const metrics = evolutionEngine.getMetrics(rules as any, interactions);
      return metrics;
    }),
  }),

  // ========================================================================
  // SISTEMA
  // ========================================================================

  system: router({
    getState: protectedProcedure.query(async ({ ctx }) => {
      const state = await db.getSystemState(ctx.user.id);
      if (!state) {
        // Crear estado inicial
      return await db.createOrUpdateSystemState(ctx.user.id, {
        id: nanoid(),
        mode: SystemMode.ZERO_KNOWLEDGE,
        maturity: '0',
        totalInteractions: 0,
        activeRules: 0,
        detectedPatterns: 0,
      });
      }
      return state;
    }),

    getProfile: protectedProcedure.query(async ({ ctx }) => {
      const profile = await db.getUserProfile(ctx.user.id);
      return profile;
    }),

    updateProfile: protectedProcedure
      .input(
        z.object({
          role: z.string().optional(),
          domain: z.string().optional(),
          goals: z.string().optional(),
          prefersAutomation: z.boolean().optional(),
          riskTolerance: z.enum(["low", "medium", "high"]).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const updated = await db.createOrUpdateUserProfile(ctx.user.id, {
          id: nanoid(),
          role: input.role || null,
          domain: input.domain || null,
          goals: input.goals || null,
          prefersAutomation: input.prefersAutomation || false,
          riskTolerance: input.riskTolerance || 'medium',
        });
        return updated;
      }),
  }),

  // ========================================================================
  // BACKUPS
  // ========================================================================

  backups: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const userBackups = await db.getBackupsByUserId(ctx.user.id);
      return userBackups;
    }),

    create: protectedProcedure
      .input(z.object({ name: z.string().optional(), description: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const rules = await db.getRulesByUserId(ctx.user.id);
        const interactions = await db.getInteractionsByUserId(ctx.user.id, 1000);
        const patterns = await db.getPatternsByUserId(ctx.user.id);

        const backupData = {
          rules,
          interactions,
          patterns,
          timestamp: new Date(),
        };

        const backup = await db.createBackup(ctx.user.id, {
          id: nanoid(),
          name: input.name || `Backup ${new Date().toISOString()}`,
          description: input.description || null,
          size: JSON.stringify(backupData).length,
          rulesCount: rules.length,
          interactionsCount: interactions.length,
          backupData: backupData as any,
        });

        // Limpiar backups antiguos
        await db.deleteOldBackups(ctx.user.id, 5);

        return backup;
      }),
  }),
});

// ============================================================================
// UTILIDADES
// ============================================================================

function calculateSystemMode(maturity: number): string {
  if (maturity < 20) return SystemMode.ZERO_KNOWLEDGE;
  if (maturity < 50) return SystemMode.LEARNING;
  if (maturity < 80) return SystemMode.COMPETENT;
  if (maturity < 95) return SystemMode.EXPERT;
  return SystemMode.MASTER;
}
