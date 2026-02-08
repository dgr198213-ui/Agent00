/**
 * Motor de Evolución Adaptativa
 * Analiza performance de reglas, propone acciones y genera nuevas reglas
 */

import type { Rule, Pattern, Interaction, EvolutionEvent, RulePerformance, EvolutionMetrics, EvolutionCycleResult } from "@shared/types";
import { EvolutionAction, PatternType, RuleCategory } from "@shared/types";
import { nanoid } from "nanoid";

// ============================================================================
// PERFORMANCE ANALYZER
// ============================================================================

interface RuleExecution {
  timestamp: Date;
  success: boolean;
  executionTime?: number;
}

class RulePerformanceAnalyzer {
  private executions = new Map<string, RuleExecution[]>();
  private readonly MAX_EXECUTIONS_PER_RULE = 100;

  recordExecution(ruleId: string, success: boolean, executionTime?: number) {
    if (!this.executions.has(ruleId)) {
      this.executions.set(ruleId, []);
    }

    const executions = this.executions.get(ruleId)!;
    executions.push({ timestamp: new Date(), success, executionTime });

    // Mantener solo las últimas 100 ejecuciones
    if (executions.length > this.MAX_EXECUTIONS_PER_RULE) {
      executions.shift();
    }
  }

  analyzePerformance(rule: Rule): RulePerformance {
    const executions = this.executions.get(rule.id) || [];
    const executionCount = executions.length;

    if (executionCount === 0) {
      return {
        ruleId: rule.id,
        ruleName: rule.name,
        successRate: 0,
        executionCount: 0,
        lastExecutions: [],
        trend: 'stable',
        recommendation: EvolutionAction.TUNE,
      };
    }

    const successCount = executions.filter(e => e.success).length;
    const successRate: number = successCount / executionCount;

    // Analizar tendencia (últimas 10 ejecuciones vs anteriores)
    const recentExecutions = executions.slice(-10);
    const olderExecutions = executions.slice(0, -10);

    let trend: 'positive' | 'negative' | 'stable' = 'stable';

    if (recentExecutions.length > 0 && olderExecutions.length > 0) {
      const recentSuccess: number = recentExecutions.filter(e => e.success).length / recentExecutions.length;
      const olderSuccess: number = olderExecutions.filter(e => e.success).length / olderExecutions.length;

      if (recentSuccess > olderSuccess + 0.1) {
        trend = 'positive';
      } else if (recentSuccess < olderSuccess - 0.1) {
        trend = 'negative';
      }
    }

    // Determinar recomendación
    let recommendation = EvolutionAction.TUNE;

      if (successRate >= 0.85 && executionCount >= 20 && trend !== 'negative') {
        recommendation = EvolutionAction.PROMOTE;
      } else if (successRate < 0.4 && executionCount >= 10) {
        recommendation = EvolutionAction.DEPRECATE;
      } else if (successRate < 0.6 && trend === 'negative') {
        recommendation = EvolutionAction.DEPRECATE;
      } else if (successRate >= 0.5 && successRate <= 0.75) {
        recommendation = EvolutionAction.TUNE;
      } else {
        recommendation = EvolutionAction.TUNE;
      }

    return {
      ruleId: rule.id,
      ruleName: rule.name,
      successRate,
      executionCount,
      lastExecutions: executions.slice(-10),
      trend,
      recommendation,
    };
  }

  clear() {
    this.executions.clear();
  }
}

// ============================================================================
// RULE GENERATOR
// ============================================================================

class RuleGenerator {
  generateFromPattern(pattern: Pattern, userId: number): Partial<Rule> {
    const baseRule: Partial<Rule> = {
      id: nanoid(),
      name: `Auto: ${pattern.name}`,
      description: `Generada automáticamente desde patrón: ${pattern.description}`,
      category: RuleCategory.CUSTOM,
      priority: Math.round(pattern.confidence * 100),
      confidence: pattern.confidence,
      active: true,
      shadowMode: true, // Iniciar en shadow mode para A/B testing
      metadata: {
        generatedFrom: pattern.id,
        patternType: pattern.type,
      },
    };

    // Generar condición y comportamiento según tipo de patrón
    switch (pattern.type) {
      case PatternType.SEQUENTIAL: {
        const data = pattern.metadata as any;
        const sequence = data.sequence as string[];
        baseRule.condition = sequence.map((action: string) => `action.type == '${action}'`).join(' or ');
        baseRule.behavior = `Ejecutar secuencia: ${sequence.join(' → ')}`;
        break;
      }

      case PatternType.TEMPORAL: {
        const data = pattern.metadata as any;
        const timeSlot = data.timeSlot as string;
        baseRule.condition = `action.timeSlot == '${timeSlot}'`;
        baseRule.behavior = `Ejecutar en horario: ${timeSlot}`;
        break;
      }

      case PatternType.FREQUENCY: {
        const data = pattern.metadata as any;
        const actionType = data.actionType as string;
        baseRule.condition = `action.type == '${actionType}'`;
        baseRule.behavior = `Ejecutar acción frecuente: ${actionType}`;
        break;
      }

      case PatternType.CONTEXTUAL: {
        const data = pattern.metadata as any;
        const keywords = data.keywords as string[];
        baseRule.condition = keywords.map((kw: string) => `description contains '${kw}'`).join(' or ');
        baseRule.behavior = `Ejecutar contexto: ${keywords.join(', ')}`;
        break;
      }
    }

    return baseRule;
  }

  createVariant(rule: Rule): Partial<Rule> {
    const conf = typeof rule.confidence === 'string' ? parseFloat(rule.confidence) : (rule.confidence || 0.5);
    return {
      ...rule,
      id: nanoid(),
      name: `${rule.name} (Variante)`,
      shadowMode: true,
      confidence: Math.max(0.3, conf - 0.2),
    };
  }
}

// ============================================================================
// EVOLUTION ENGINE
// ============================================================================

export class EvolutionEngine {
  private performanceAnalyzer = new RulePerformanceAnalyzer();
  private ruleGenerator = new RuleGenerator();
  private evolutionEvents: EvolutionEvent[] = [];

  recordDecisionResult(ruleId: string, success: boolean, executionTime?: number) {
    this.performanceAnalyzer.recordExecution(ruleId, success, executionTime);
  }

  evaluateEvolution(rules: Rule[], patterns: Pattern[], interactions: Interaction[]) {
    const actions: Array<{
      action: string;
      ruleId: string;
      ruleName: string;
      reason: string;
    }> = [];

    // Analizar performance de reglas existentes
    for (const rule of rules) {
      const performance = this.performanceAnalyzer.analyzePerformance(rule);

      if (performance.recommendation !== EvolutionAction.TUNE) {
        actions.push({
          action: performance.recommendation as string,
          ruleId: rule.id,
          ruleName: rule.name,
          reason: `Success rate: ${(performance.successRate * 100).toFixed(1)}%, Trend: ${performance.trend}, Executions: ${performance.executionCount}`,
        });
      }
    }

    // Generar nuevas reglas desde patrones detectados
    for (const pattern of patterns) {
      if (pattern.confidence >= 0.7 && pattern.occurrences >= 5) {
        actions.push({
          action: EvolutionAction.CREATE_RULE,
          ruleId: nanoid(),
          ruleName: `Auto: ${pattern.name}`,
          reason: `Patrón detectado con confianza ${(pattern.confidence * 100).toFixed(1)}% y ${pattern.occurrences} ocurrencias`,
        });
      }
    }

    return actions;
  }

  applyEvolution(action: any, rules: Rule[], userId: number): { updatedRules: Rule[]; events: EvolutionEvent[] } {
    const events: EvolutionEvent[] = [];
    let updatedRules = [...rules];

    if (action.action === EvolutionAction.PROMOTE) {
      const rule = updatedRules.find(r => r.id === action.ruleId);
      if (rule) {
        rule.priority = Math.min(100, rule.priority + 10);
        const conf = typeof rule.confidence === 'string' ? parseFloat(rule.confidence) : (rule.confidence || 0);
        rule.confidence = Math.min(1, conf + 0.05) as any;

        events.push({
          id: nanoid(),
          timestamp: new Date(),
          action: EvolutionAction.PROMOTE,
          ruleId: rule.id,
          ruleName: rule.name,
          reason: action.reason,
          metrics: {
            successRate: typeof rule.successRate === 'number' ? rule.successRate : 0,
            executionCount: rule.executionCount || 0,
            trend: 'positive',
          },
        });
      }
    } else if (action.action === EvolutionAction.DEPRECATE) {
      const rule = updatedRules.find(r => r.id === action.ruleId);
      if (rule) {
        rule.active = false as any;

        events.push({
          id: nanoid(),
          timestamp: new Date(),
          action: EvolutionAction.DEPRECATE,
          ruleId: rule.id,
          ruleName: rule.name,
          reason: action.reason,
          metrics: {
            successRate: typeof rule.successRate === 'number' ? rule.successRate : 0,
            executionCount: rule.executionCount || 0,
            trend: 'negative',
          },
        });
      }
    } else if (action.action === EvolutionAction.TUNE) {
      const rule = updatedRules.find(r => r.id === action.ruleId);
      if (rule) {
        rule.priority = Math.max(1, rule.priority - 5) as any;

        events.push({
          id: nanoid(),
          timestamp: new Date(),
          action: EvolutionAction.TUNE,
          ruleId: rule.id,
          ruleName: rule.name,
          reason: action.reason,
          metrics: {
            successRate: typeof rule.successRate === 'number' ? rule.successRate : 0,
            executionCount: rule.executionCount || 0,
          },
        });
      }
      } else if (action.action === EvolutionAction.CREATE_RULE) {
      // Este tipo de acción se maneja en el nivel de aplicación
      events.push({
        id: nanoid(),
        timestamp: new Date(),
        action: action.action as EvolutionAction,
        ruleId: action.ruleId,
        ruleName: action.ruleName,
        reason: action.reason,
        metrics: {},
      });
    }

    this.evolutionEvents.push(...events);

    return { updatedRules, events };
  }

  getMetrics(rules: Rule[], interactions: Interaction[]): EvolutionMetrics {
    const activeRules = rules.filter(r => r.active).length;
    const deprecatedRules = rules.filter(r => !r.active).length;
    const avgSuccessRate = rules.reduce((sum: number, r: any) => sum + (typeof r.successRate === 'number' ? r.successRate : 0), 0) / Math.max(1, rules.length);

    // Calcular madurez del sistema basado en interacciones
    let systemMaturity = 0;
    if (interactions.length < 100) {
      systemMaturity = (interactions.length / 100) * 20;
    } else if (interactions.length < 500) {
      systemMaturity = 20 + ((interactions.length - 100) / 400) * 30;
    } else if (interactions.length < 2000) {
      systemMaturity = 50 + ((interactions.length - 500) / 1500) * 30;
    } else if (interactions.length < 5000) {
      systemMaturity = 80 + ((interactions.length - 2000) / 3000) * 15;
    } else {
      systemMaturity = 95 + Math.min(5, (interactions.length - 5000) / 10000);
    }

    return {
      systemMaturity: Math.min(100, systemMaturity),
      activeRules,
      deprecatedRules,
      averageSuccessRate: avgSuccessRate,
      totalEvolutionEvents: this.evolutionEvents.length,
      lastEvolutionCycle: this.evolutionEvents.length > 0 ? this.evolutionEvents[this.evolutionEvents.length - 1].timestamp : undefined,
    };
  }

  getEvolutionEvents(limit = 50): EvolutionEvent[] {
    return this.evolutionEvents.slice(-limit);
  }

  clear() {
    this.performanceAnalyzer.clear();
    this.evolutionEvents = [];
  }
}
