import { describe, it, expect } from "vitest";
import { PatternDetector } from "./pattern-detector";
import type { Interaction } from "@shared/types";

describe("PatternDetector", () => {
  const detector = new PatternDetector();

  const mockInteractions: Interaction[] = [
    {
      id: "int-1",
      userId: 1,
      type: "write",
      description: "User wrote code",
      outcome: "success",
      context: { language: "typescript" },
      timestamp: new Date(Date.now() - 60000),
      duration: 100,
    },
    {
      id: "int-2",
      userId: 1,
      type: "write",
      description: "User wrote code",
      outcome: "success",
      context: { language: "typescript" },
      timestamp: new Date(Date.now() - 50000),
      duration: 120,
    },
    {
      id: "int-3",
      userId: 1,
      type: "write",
      description: "User wrote code",
      outcome: "success",
      context: { language: "typescript" },
      timestamp: new Date(Date.now() - 40000),
      duration: 110,
    },
    {
      id: "int-4",
      userId: 1,
      type: "test",
      description: "User ran tests",
      outcome: "success",
      context: { framework: "vitest" },
      timestamp: new Date(Date.now() - 30000),
      duration: 200,
    },
  ];

  describe("detectPatterns", () => {
    it("should detect patterns from interactions", () => {
      const patterns = detector.detectPatterns(mockInteractions);
      expect(Array.isArray(patterns)).toBe(true);
    });

    it("should calculate confidence scores", () => {
      const patterns = detector.detectPatterns(mockInteractions);
      patterns.forEach((pattern) => {
        expect(pattern.confidence).toBeGreaterThanOrEqual(0);
        expect(pattern.confidence).toBeLessThanOrEqual(1);
      });
    });
  });

  describe("detectSequentialPatterns", () => {
    it("should detect sequential patterns", () => {
      const patterns = detector.detectSequentialPatterns(mockInteractions);
      expect(Array.isArray(patterns)).toBe(true);
    });
  });

  describe("detectTemporalPatterns", () => {
    it("should detect temporal patterns", () => {
      const patterns = detector.detectTemporalPatterns(mockInteractions);
      expect(Array.isArray(patterns)).toBe(true);
    });
  });

  describe("detectFrequencyPatterns", () => {
    it("should detect frequency patterns", () => {
      const patterns = detector.detectFrequencyPatterns(mockInteractions);
      expect(Array.isArray(patterns)).toBe(true);
    });
  });

  describe("detectContextualPatterns", () => {
    it("should detect contextual patterns", () => {
      const patterns = detector.detectContextualPatterns(mockInteractions);
      expect(Array.isArray(patterns)).toBe(true);
    });
  });
});
