/**
 * Unified type exports
 * Import shared types from this single entry point.
 */

export type * from "../drizzle/schema";
export * from "./_core/errors";

// ============================================================================
// ENUMS Y CONSTANTES
// ============================================================================

export enum RuleCategory {
  SAFETY = 'safety',
  PRODUCTIVITY = 'productivity',
  LEARNING = 'learning',
  WORKFLOW = 'workflow',
  CUSTOM = 'custom',
}

export enum SystemMode {
  ZERO_KNOWLEDGE = 'zero_knowledge',
  LEARNING = 'learning',
  COMPETENT = 'competent',
  EXPERT = 'expert',
  MASTER = 'master',
}

export enum EvolutionAction {
  PROMOTE = 'promote',
  DEPRECATE = 'deprecate',
  TUNE = 'tune',
  CREATE_RULE = 'create_rule',
  ARCHIVE = 'archive',
}

export enum PatternType {
  SEQUENTIAL = 'sequential',
  TEMPORAL = 'temporal',
  FREQUENCY = 'frequency',
  CONTEXTUAL = 'contextual',
}

export enum InteractionOutcome {
  SUCCESS = 'success',
  FAILURE = 'failure',
  PARTIAL = 'partial',
  UNKNOWN = 'unknown',
}

// ============================================================================
// REGLAS Y DECISIONES
// ============================================================================

export interface Rule {
  id: string;
  name: string;
  description: string | null;
  category: RuleCategory | string;
  condition: string;
  behavior: string;
  priority: number;
  active: boolean;
  confidence: string | number;
  successRate?: string | number | null;
  executionCount?: number | null;
  lastExecuted?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  shadowMode?: boolean | null;
  metadata?: Record<string, unknown> | null;
}

export interface DecisionContext {
  [key: string]: unknown;
  action?: {
    type: string;
    target?: string;
    [key: string]: unknown;
  };
  file?: {
    size?: number;
    type?: string;
    [key: string]: unknown;
  };
  user?: {
    activity?: string;
    [key: string]: unknown;
  };
}

export interface DecisionResult {
  ruleId: string;
  ruleName: string;
  matched: boolean;
  confidence: number;
  behavior: string;
  reasoning: string;
  timestamp: Date;
  executionTime?: number;
}

export interface EvaluationStats {
  totalRules: number;
  matchedRules: number;
  averageConfidence: number;
  evaluationTime: number;
  topMatches: DecisionResult[];
}

// ============================================================================
// INTERACCIONES Y HISTORIAL
// ============================================================================

export interface InteractionLog {
  id: string;
  userId: string;
  type: string;
  description: string;
  outcome: InteractionOutcome;
  context?: DecisionContext;
  timestamp: Date;
  duration?: number;
  metadata?: Record<string, unknown>;
}

export interface InteractionStats {
  totalInteractions: number;
  successRate: number;
  averageOutcome: string;
  frequencyPerDay: number;
  lastInteraction?: Date;
}

// ============================================================================
// PATRONES
// ============================================================================

export interface Pattern {
  id: string;
  type: string;
  name: string;
  description: string;
  confidence: number;
  occurrences: number;
  lastDetected: Date;
  suggestedRule?: Partial<Rule>;
  metadata?: Record<string, unknown>;
}

export interface SequentialPattern extends Pattern {
  sequence: string[];
  averageTimeBetweenActions: number;
}

export interface TemporalPattern extends Pattern {
  timeSlot: 'morning' | 'afternoon' | 'evening' | 'night';
  concentrationPercentage: number;
}

export interface FrequencyPattern extends Pattern {
  actionType: string;
  averagePerDay: number;
}

export interface ContextualPattern extends Pattern {
  keywords: string[];
  relatedActions: string[];
}

export type AnyPattern = SequentialPattern | TemporalPattern | FrequencyPattern | ContextualPattern;

export interface PatternDetectionResult {
  patterns: AnyPattern[];
  timestamp: Date;
  analysisTime: number;
  suggestedRules: Partial<Rule>[];
}

// ============================================================================
// EVOLUCIÓN
// ============================================================================

export interface EvolutionEvent {
  id: string;
  timestamp: Date;
  action: string;
  ruleId: string;
  ruleName: string;
  reason: string;
  metrics: {
    successRate?: number;
    executionCount?: number;
    trend?: 'positive' | 'negative' | 'stable';
  };
  metadata?: Record<string, unknown>;
}

export interface RulePerformance {
  ruleId: string;
  ruleName: string;
  successRate: number;
  executionCount: number;
  lastExecutions: Array<{
    timestamp: Date;
    success: boolean;
  }>;
  trend: 'positive' | 'negative' | 'stable';
  recommendation: string;
}

export interface EvolutionMetrics {
  systemMaturity: number;
  activeRules: number;
  deprecatedRules: number;
  averageSuccessRate: number;
  totalEvolutionEvents: number;
  lastEvolutionCycle?: Date;
}

export interface EvolutionCycleResult {
  actions: Array<{
    action: string;
    ruleId: string;
    ruleName: string;
    reason: string;
  }>;
  events: EvolutionEvent[];
  metrics: EvolutionMetrics;
  timestamp: Date;
}

// ============================================================================
// ESTADO DEL SISTEMA
// ============================================================================

export interface SystemState {
  mode: string;
  maturity: number;
  totalInteractions: number;
  activeRules: number;
  detectedPatterns: number;
  lastEvolutionCycle?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfile {
  id: string;
  userId: string;
  role: string;
  domain: string;
  goals: string;
  prefersAutomation: boolean;
  riskTolerance: 'low' | 'medium' | 'high';
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// BACKUPS Y VERSIONADO
// ============================================================================

export interface BackupMetadata {
  id: string;
  timestamp: Date;
  size: number;
  rulesCount: number;
  interactionsCount: number;
  description?: string;
}

export interface SchemaVersion {
  version: number;
  timestamp: Date;
  changes: string[];
}

// ============================================================================
// RESPUESTAS DE API
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
