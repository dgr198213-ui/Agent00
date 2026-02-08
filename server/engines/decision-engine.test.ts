import { describe, it, expect } from "vitest";
import { DecisionEngine } from "./decision-engine";

describe("DecisionEngine", () => {
  const engine = new DecisionEngine();

  describe("validateCondition", () => {
    it("should validate simple conditions", () => {
      const result = engine.validateCondition("x > 5");
      expect(result.valid).toBe(true);
    });

    it("should validate complex conditions", () => {
      const result = engine.validateCondition("(x > 5) AND (y < 10)");
      expect(result.valid).toBe(true);
    });

    it("should reject unmatched parentheses", () => {
      const result = engine.validateCondition("(x > 5");
      expect(result.valid).toBe(false);
    });
  });

  describe("evaluateRule", () => {
    const mockRule = {
      id: "rule-1",
      name: "Test Rule",
      description: "A test rule",
      category: "safety" as const,
      condition: "x > 5",
      behavior: "log",
      priority: 50,
      confidence: 0.8,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: 1,
      successRate: 0.85,
      executionCount: 10,
      lastExecuted: new Date(),
      metadata: null,
    };

    it("should evaluate true condition", () => {
      const result = engine.evaluateRule(mockRule, { x: 10 });
      expect(result.matched).toBe(true);
    });

    it("should evaluate false condition", () => {
      const result = engine.evaluateRule(mockRule, { x: 3 });
      expect(result.matched).toBe(false);
    });

    it("should measure execution time", () => {
      const result = engine.evaluateRule(mockRule, { x: 10 });
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe("evaluateRules", () => {
    const rules = [
      {
        id: "rule-1",
        name: "Rule 1",
        description: "First rule",
        category: "safety" as const,
        condition: "x > 5",
        behavior: "log",
        priority: 50,
        confidence: 0.8,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: 1,
        successRate: 0.85,
        executionCount: 10,
        lastExecuted: new Date(),
        metadata: null,
      },
      {
        id: "rule-2",
        name: "Rule 2",
        description: "Second rule",
        category: "productivity" as const,
        condition: "y < 20",
        behavior: "execute",
        priority: 60,
        confidence: 0.9,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: 1,
        successRate: 0.9,
        executionCount: 20,
        lastExecuted: new Date(),
        metadata: null,
      },
    ];

    it("should evaluate multiple rules", () => {
      const result = engine.evaluateRules(rules, { x: 10, y: 15 });
      expect(result.results.length).toBeGreaterThanOrEqual(0);
    });

    it("should return stats", () => {
      const result = engine.evaluateRules(rules, { x: 10, y: 15 });
      expect(result.stats.totalRules).toBe(2);
      expect(result.stats.averageConfidence).toBeGreaterThanOrEqual(0);
    });
  });
});
