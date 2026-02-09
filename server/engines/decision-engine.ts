/**
 * Motor de Decisiones con Parser AST Real + Indexación Optimizada
 * v2.0 - Incluye:
 * - Parser AST seguro (sin eval)
 * - Indexación O(k) en lugar de O(n)
 * - Métricas de performance por regla
 * - Validación estricta con mensajes de error
 */

import type { Rule, DecisionContext, DecisionResult } from "@shared/types";

// ============================================================================
// TOKENIZER
// ============================================================================

interface Token {
  type: 'OPERATOR' | 'LOGICAL' | 'VALUE' | 'PATH' | 'UNIT' | 'PAREN';
  value: string;
}

class Tokenizer {
  private input: string;
  private pos = 0;

  constructor(input: string) {
    this.input = input.trim();
  }

  tokenize(): Token[] {
    const tokens: Token[] = [];

    while (this.pos < this.input.length) {
      this.skipWhitespace();
      if (this.pos >= this.input.length) break;

      const char = this.input[this.pos];

      // Parentheses
      if (char === '(' || char === ')') {
        tokens.push({ type: 'PAREN', value: char });
        this.pos++;
        continue;
      }

      // Logical operators
      if (this.match('AND') || this.match('and')) {
        tokens.push({ type: 'LOGICAL', value: 'and' });
        this.pos += 3;
        continue;
      }
      if (this.match('OR') || this.match('or')) {
        tokens.push({ type: 'LOGICAL', value: 'or' });
        this.pos += 2;
        continue;
      }

      // Comparison operators
      if (this.match('==')) {
        tokens.push({ type: 'OPERATOR', value: '==' });
        this.pos += 2;
        continue;
      }
      if (this.match('!=')) {
        tokens.push({ type: 'OPERATOR', value: '!=' });
        this.pos += 2;
        continue;
      }
      if (this.match('>=')) {
        tokens.push({ type: 'OPERATOR', value: '>=' });
        this.pos += 2;
        continue;
      }
      if (this.match('<=')) {
        tokens.push({ type: 'OPERATOR', value: '<=' });
        this.pos += 2;
        continue;
      }
      if (this.match('in')) {
        tokens.push({ type: 'OPERATOR', value: 'in' });
        this.pos += 2;
        continue;
      }
      if (char === '>' || char === '<') {
        tokens.push({ type: 'OPERATOR', value: char });
        this.pos++;
        continue;
      }

      // String values
      if (char === '"' || char === "'") {
        const quote = char;
        this.pos++;
        let value = '';
        while (this.pos < this.input.length && this.input[this.pos] !== quote) {
          value += this.input[this.pos];
          this.pos++;
        }
        this.pos++; // Skip closing quote
        tokens.push({ type: 'VALUE', value });
        continue;
      }

      // Numbers and units
      if (this.isDigit(char)) {
        let value = '';
        while (this.pos < this.input.length && (this.isDigit(this.input[this.pos]) || this.input[this.pos] === '.')) {
          value += this.input[this.pos];
          this.pos++;
        }

        // Check for units (MB, KB, min, s)
        if (this.match('MB')) {
          tokens.push({ type: 'VALUE', value: (parseFloat(value) * 1024 * 1024).toString() });
          this.pos += 2;
        } else if (this.match('KB')) {
          tokens.push({ type: 'VALUE', value: (parseFloat(value) * 1024).toString() });
          this.pos += 2;
        } else if (this.match('min')) {
          tokens.push({ type: 'VALUE', value: (parseFloat(value) * 60 * 1000).toString() });
          this.pos += 3;
        } else if (this.match('s')) {
          tokens.push({ type: 'VALUE', value: (parseFloat(value) * 1000).toString() });
          this.pos++;
        } else {
          tokens.push({ type: 'VALUE', value });
        }
        continue;
      }

      // Paths (action.type, file.size, etc.)
      if (this.isAlpha(char)) {
        let value = '';
        while (this.pos < this.input.length && (this.isAlphaNumeric(this.input[this.pos]) || this.input[this.pos] === '_' || this.input[this.pos] === '.')) {
          value += this.input[this.pos];
          this.pos++;
        }
        tokens.push({ type: 'PATH', value });
        continue;
      }

      this.pos++;
    }

    return tokens;
  }

  private skipWhitespace() {
    while (this.pos < this.input.length && /\s/.test(this.input[this.pos])) {
      this.pos++;
    }
  }

  private match(str: string): boolean {
    return this.input.substr(this.pos, str.length) === str;
  }

  private isDigit(char: string): boolean {
    return /\d/.test(char);
  }

  private isAlpha(char: string): boolean {
    return /[a-zA-Z]/.test(char);
  }

  private isAlphaNumeric(char: string): boolean {
    return /[a-zA-Z0-9]/.test(char);
  }
}

// ============================================================================
// AST NODES
// ============================================================================

interface ASTNode {
  type: string;
}

interface BinaryOp extends ASTNode {
  type: 'BinaryOp';
  operator: string;
  left: ASTNode;
  right: ASTNode;
}

interface Literal extends ASTNode {
  type: 'Literal';
  value: string | number;
}

interface Identifier extends ASTNode {
  type: 'Identifier';
  name: string;
}

// ============================================================================
// PARSER
// ============================================================================

class Parser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): ASTNode {
    return this.parseOr();
  }

  private parseOr(): ASTNode {
    let left = this.parseAnd();

    while (this.current()?.type === 'LOGICAL' && this.current()?.value === 'or') {
      this.pos++;
      const right = this.parseAnd();
      left = { type: 'BinaryOp', operator: 'or', left, right } as BinaryOp;
    }

    return left;
  }

  private parseAnd(): ASTNode {
    let left = this.parseComparison();

    while (this.current()?.type === 'LOGICAL' && this.current()?.value === 'and') {
      this.pos++;
      const right = this.parseComparison();
      left = { type: 'BinaryOp', operator: 'and', left, right } as BinaryOp;
    }

    return left;
  }

  private parseComparison(): ASTNode {
    let left = this.parsePrimary();

    if (this.current()?.type === 'OPERATOR') {
      const operator = this.current()!.value;
      this.pos++;
      const right = this.parsePrimary();
      return { type: 'BinaryOp', operator, left, right } as BinaryOp;
    }

    return left;
  }

  private parsePrimary(): ASTNode {
    const token = this.current();

    if (!token) {
      throw new Error('Unexpected end of input');
    }

    // Handle PATH tokens (identifiers)
    if (token.type === 'PATH') {
      this.pos++;
      return { type: 'Identifier', name: token.value } as Identifier;
    }

    if (token.type === 'PAREN' && token.value === '(') {
      this.pos++;
      const expr = this.parseOr();
      if (this.current()?.value !== ')') {
        throw new Error('Expected closing parenthesis');
      }
      this.pos++;
      return expr;
    }

    if (token.type === 'VALUE') {
      this.pos++;
      // Try to parse as number
      const num = Number(token.value);
      if (!isNaN(num)) {
        return { type: 'Literal', value: num } as Literal;
      }
      return { type: 'Literal', value: token.value } as Literal;
    }

    throw new Error(`Unexpected token: ${token.value}`);
  }

  private current(): Token | undefined {
    return this.tokens[this.pos];
  }
}

// ============================================================================
// EVALUATOR
// ============================================================================

class Evaluator {
  evaluate(node: ASTNode, context: DecisionContext): boolean {
    if (node.type === 'Literal') {
      const literal = node as Literal;
      return Boolean(literal.value);
    }

    if (node.type === 'Identifier') {
      const identifier = node as Identifier;
      return Boolean(this.getValueFromContext(identifier.name, context));
    }

    if (node.type === 'BinaryOp') {
      const binOp = node as BinaryOp;
      const left = this.getValueFromContext((binOp.left as Identifier).name, context);
      const right = this.getValueFromContext((binOp.right as Identifier).name, context) || (binOp.right as Literal).value;

      switch (binOp.operator) {
        case '==':
          return left === right;
        case '!=':
          return left !== right;
        case '>':
          return Number(left) > Number(right);
        case '<':
          return Number(left) < Number(right);
        case '>=':
          return Number(left) >= Number(right);
        case '<=':
          return Number(left) <= Number(right);
        case 'in':
          return Array.isArray(right) ? right.includes(left) : false;
        case 'and':
          return this.evaluate(binOp.left, context) && this.evaluate(binOp.right, context);
        case 'or':
          return this.evaluate(binOp.left, context) || this.evaluate(binOp.right, context);
        default:
          return false;
      }
    }

    return false;
  }

  private getValueFromContext(path: string, context: DecisionContext): unknown {
    const parts = path.split('.');
    let current: unknown = context;

    for (const part of parts) {
      if (current && typeof current === 'object') {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  }
}

// ============================================================================
// SISTEMA DE INDEXACIÓN
// ============================================================================

interface RuleIndex {
  byActionType: Map<string, Rule[]>;
  byFileExtension: Map<string, Rule[]>;
  byCategory: Map<string, Rule[]>;
  global: Rule[];
}

interface RuleMetrics {
  ruleId: string;
  evaluations: number;
  matches: number;
  executionTimes: number[];
  lastUsed: number;
}

interface IndexTerms {
  actionTypes: string[];
  fileExtensions: string[];
  filePaths: string[];
}

// ============================================================================
// DECISION ENGINE
// ============================================================================

export class DecisionEngine {
  private evaluator = new Evaluator();
  
  private ruleIndex: RuleIndex = {
    byActionType: new Map(),
    byFileExtension: new Map(),
    byCategory: new Map(),
    global: []
  };
  
  private indexDirty = true;
  private cachedRules: Rule[] = [];
  private metrics = new Map<string, RuleMetrics>();

  private extractIndexTerms(condition: string): IndexTerms {
    const terms: IndexTerms = {
      actionTypes: [],
      fileExtensions: [],
      filePaths: []
    };
    
    const actionTypeRegex = /action\.type\s*==\s*['"](\w+)['"]/g;
    let match;
    while ((match = actionTypeRegex.exec(condition)) !== null) {
      terms.actionTypes.push(match[1]);
    }
    
    const extensionSingleRegex = /file\.extension\s*==\s*['"](\.\w+)['"]/g;
    while ((match = extensionSingleRegex.exec(condition)) !== null) {
      terms.fileExtensions.push(match[1]);
    }
    
    const extensionArrayRegex = /file\.extension\s+in\s+\[(.*?)\]/g;
    while ((match = extensionArrayRegex.exec(condition)) !== null) {
      const extensions = match[1]
        .split(',')
        .map(s => s.trim().replace(/['"]/g, ''))
        .filter(s => s.startsWith('.'));
      terms.fileExtensions.push(...extensions);
    }
    
    const pathRegex = /file\.path\.includes\(['"](\w+)['"]\)/g;
    while ((match = pathRegex.exec(condition)) !== null) {
      terms.filePaths.push(match[1]);
    }
    
    return terms;
  }

  rebuildIndex(rules: Rule[]): void {
    this.ruleIndex = {
      byActionType: new Map(),
      byFileExtension: new Map(),
      byCategory: new Map(),
      global: []
    };
    
    for (const rule of rules) {
      if (!rule.active) continue;
      
      const terms = this.extractIndexTerms(rule.condition);
      let hasSpecificTerms = false;
      
      if (terms.actionTypes.length > 0) {
        hasSpecificTerms = true;
        terms.actionTypes.forEach(type => {
          if (!this.ruleIndex.byActionType.has(type)) {
            this.ruleIndex.byActionType.set(type, []);
          }
          this.ruleIndex.byActionType.get(type)!.push(rule);
        });
      }
      
      if (terms.fileExtensions.length > 0) {
        hasSpecificTerms = true;
        terms.fileExtensions.forEach(ext => {
          if (!this.ruleIndex.byFileExtension.has(ext)) {
            this.ruleIndex.byFileExtension.set(ext, []);
          }
          this.ruleIndex.byFileExtension.get(ext)!.push(rule);
        });
      }
      
      if (rule.category) {
        if (!this.ruleIndex.byCategory.has(rule.category)) {
          this.ruleIndex.byCategory.set(rule.category, []);
        }
        this.ruleIndex.byCategory.get(rule.category)!.push(rule);
      }
      
      if (!hasSpecificTerms) {
        this.ruleIndex.global.push(rule);
      }
    }
    
    this.cachedRules = rules;
    this.indexDirty = false;
  }

  private getCandidateRules(context: DecisionContext): Rule[] {
    if (this.indexDirty && this.cachedRules.length > 0) {
      this.rebuildIndex(this.cachedRules);
    }
    
    const candidates = new Set<Rule>();
    
    if (context.action?.type) {
      const byAction = this.ruleIndex.byActionType.get(String(context.action.type));
      if (byAction) {
        byAction.forEach(r => candidates.add(r));
      }
    }
    
    if (context.file?.extension) {
      const byExt = this.ruleIndex.byFileExtension.get(String(context.file.extension));
      if (byExt) {
        byExt.forEach(r => candidates.add(r));
      }
    }
    
    this.ruleIndex.global.forEach(r => candidates.add(r));
    
    return Array.from(candidates);
  }

  invalidateIndex(): void {
    this.indexDirty = true;
  }

  private recordMetrics(ruleId: string, executionTime: number, matched: boolean): void {
    let m = this.metrics.get(ruleId);
    if (!m) {
      m = {
        ruleId,
        evaluations: 0,
        matches: 0,
        executionTimes: [],
        lastUsed: Date.now()
      };
      this.metrics.set(ruleId, m);
    }
    
    m.evaluations++;
    if (matched) m.matches++;
    m.lastUsed = Date.now();
    
    m.executionTimes.push(executionTime);
    if (m.executionTimes.length > 100) {
      m.executionTimes.shift();
    }
  }

  getRuleMetrics(ruleId: string): RuleMetrics | null {
    return this.metrics.get(ruleId) || null;
  }

  getSystemMetrics() {
    const allMetrics = Array.from(this.metrics.values());
    
    if (allMetrics.length === 0) {
      return {
        totalRules: 0,
        totalEvaluations: 0,
        totalMatches: 0,
        avgMatchRate: 0,
        avgExecutionTime: 0,
        p50ExecutionTime: 0,
        p95ExecutionTime: 0,
        p99ExecutionTime: 0
      };
    }
    
    const totalEvaluations = allMetrics.reduce((sum, m) => sum + m.evaluations, 0);
    const totalMatches = allMetrics.reduce((sum, m) => sum + m.matches, 0);
    
    const allTimes = allMetrics.flatMap(m => m.executionTimes);
    const sortedTimes = allTimes.sort((a, b) => a - b);
    
    const percentile = (p: number) => {
      const index = Math.floor(sortedTimes.length * p);
      return sortedTimes[index] || 0;
    };
    
    return {
      totalRules: allMetrics.length,
      totalEvaluations,
      totalMatches,
      avgMatchRate: totalMatches / totalEvaluations,
      avgExecutionTime: allTimes.reduce((sum, t) => sum + t, 0) / allTimes.length,
      p50ExecutionTime: percentile(0.50),
      p95ExecutionTime: percentile(0.95),
      p99ExecutionTime: percentile(0.99)
    };
  }

  evaluateRule(rule: Rule, context: DecisionContext): DecisionResult {
    const startTime = performance.now();

    try {
      const tokenizer = new Tokenizer(rule.condition);
      const tokens = tokenizer.tokenize();
      const parser = new Parser(tokens);
      const ast = parser.parse();
      const matched = this.evaluator.evaluate(ast, context);

      const executionTime = performance.now() - startTime;
      
      this.recordMetrics(rule.id, executionTime, matched);

      return {
        ruleId: rule.id,
        ruleName: rule.name,
        matched,
        confidence: typeof rule.confidence === 'string' ? parseFloat(rule.confidence) : (rule.confidence || 0),
        behavior: rule.behavior,
        reasoning: `Regla evaluada: ${rule.name}. Condición: ${rule.condition}. Resultado: ${matched ? 'COINCIDE' : 'NO COINCIDE'}`,
        timestamp: new Date(),
        executionTime,
      };
    } catch (error) {
      const executionTime = performance.now() - startTime;
      return {
        ruleId: rule.id,
        ruleName: rule.name,
        matched: false,
        confidence: 0,
        behavior: rule.behavior,
        reasoning: `Error al evaluar regla: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        timestamp: new Date(),
        executionTime,
      };
    }
  }

  evaluateRules(rules: Rule[], context: DecisionContext) {
    const startTime = performance.now();
    
    // Obtener solo reglas candidatas (indexación O(k))
    const candidates = this.getCandidateRules(context);
    
    const results = candidates
      .filter(r => r.active)
      .map(rule => this.evaluateRule(rule, context))
      .filter(r => r.matched)
      .sort((a, b) => b.confidence - a.confidence);

    const executionTime = performance.now() - startTime;

    return {
      results,
      stats: {
        totalRules: rules.length,
        activeRules: rules.filter(r => r.active).length,
        candidateRules: candidates.length,
        matchedRules: results.length,
        evaluationTime: executionTime,
        indexEfficiency: ((1 - candidates.length / rules.length) * 100).toFixed(1) + '%',
        topMatches: results.slice(0, 5),
      },
    };
  }

  validateCondition(condition: string): { valid: boolean; error?: string } {
    try {
      const tokenizer = new Tokenizer(condition);
      const tokens = tokenizer.tokenize();
      const parser = new Parser(tokens);
      parser.parse();
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }

  clearOldMetrics(maxAge: number): void {
    const now = Date.now();
    const toDelete: string[] = [];
    
    this.metrics.forEach((m, id) => {
      if (now - m.lastUsed > maxAge) {
        toDelete.push(id);
      }
    });
    
    toDelete.forEach(id => this.metrics.delete(id));
  }
}
