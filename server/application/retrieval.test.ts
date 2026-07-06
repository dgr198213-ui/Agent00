import { describe, expect, it } from "vitest";
import type { KnowledgeChunk } from "../domain";
import {
  CHUNK_OVERLAP,
  CHUNK_SIZE,
  chunkText,
  cosineSimilarity,
  lexicalScore,
  rankChunks,
  selectContext,
  tokenize,
} from "./retrieval";

function makeChunk(content: string, embedding: number[] | null = null): KnowledgeChunk {
  return {
    id: Math.random().toString(36).slice(2),
    knowledgeId: "k1",
    agentId: "a1",
    chunkIndex: 0,
    content,
    embedding,
    createdAt: new Date(),
  } as KnowledgeChunk;
}

describe("retrieval", () => {
  describe("chunkText", () => {
    it("devuelve el texto entero si cabe en un chunk", () => {
      expect(chunkText("hola mundo")).toEqual(["hola mundo"]);
    });

    it("trocea textos largos con solape y sin perder contenido", () => {
      const sentence = "Los artistas independientes necesitan visibilidad. ";
      const text = sentence.repeat(100); // ~5.200 caracteres
      const chunks = chunkText(text);

      expect(chunks.length).toBeGreaterThan(2);
      for (const chunk of chunks) {
        expect(chunk.length).toBeLessThanOrEqual(CHUNK_SIZE + CHUNK_OVERLAP);
      }
      // El primer y último fragmento del original están representados.
      expect(chunks[0].startsWith("Los artistas")).toBe(true);
      expect(chunks[chunks.length - 1].includes("visibilidad")).toBe(true);
    });

    it("devuelve vacío para texto vacío", () => {
      expect(chunkText("   ")).toEqual([]);
    });
  });

  describe("cosineSimilarity", () => {
    it("es 1 para vectores idénticos y 0 para ortogonales", () => {
      expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
      expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
    });

    it("devuelve 0 si las dimensiones no coinciden", () => {
      expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
    });
  });

  describe("lexicalScore + tokenize", () => {
    it("ignora stopwords y tildes", () => {
      expect(tokenize("el envío de la música")).toEqual(["envio", "musica"]);
    });

    it("puntúa más el chunk que contiene los términos de la consulta", () => {
      const query = tokenize("precio del plan Beta");
      const relevant = lexicalScore(query, "El plan Beta tiene un precio de 0€ durante la beta abierta.");
      const irrelevant = lexicalScore(query, "Los gatos duermen dieciséis horas al día.");
      expect(relevant).toBeGreaterThan(irrelevant);
      expect(irrelevant).toBe(0);
    });
  });

  describe("rankChunks", () => {
    it("usa coseno cuando hay embeddings de consulta y chunk", () => {
      const close = makeChunk("a", [1, 0]);
      const far = makeChunk("b", [0, 1]);
      const ranked = rankChunks([far, close], "cualquier consulta", [1, 0]);
      expect(ranked[0].chunk.id).toBe(close.id);
    });

    it("degrada a léxico cuando no hay embeddings", () => {
      const relevant = makeChunk("Los eventos se aprueban con el flujo pending a approved.");
      const irrelevant = makeChunk("Texto sin relación alguna con nada.");
      const ranked = rankChunks([irrelevant, relevant], "flujo de aprobación de eventos", null);
      expect(ranked[0].chunk.id).toBe(relevant.id);
    });
  });

  describe("selectContext", () => {
    it("respeta el presupuesto de caracteres", () => {
      const ranked = [
        { chunk: makeChunk("x".repeat(400)), score: 0.9 },
        { chunk: makeChunk("y".repeat(400)), score: 0.8 },
        { chunk: makeChunk("z".repeat(400)), score: 0.7 },
      ];
      const context = selectContext(ranked, 900);
      expect(context).toContain("x");
      expect(context).toContain("y");
      expect(context).not.toContain("z");
    });

    it("descarta chunks con score 0 si hay relevantes", () => {
      const ranked = [
        { chunk: makeChunk("relevante"), score: 0.5 },
        { chunk: makeChunk("ruido"), score: 0 },
      ];
      expect(selectContext(ranked, 10_000)).toBe("relevante");
    });
  });
});
