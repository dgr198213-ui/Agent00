/**
 * Capa de Aplicación — retrieval de conocimiento.
 *
 * Estrategia híbrida con degradación elegante:
 *  1. Si la consulta y los chunks tienen embedding → similitud coseno.
 *  2. Si no hay embeddings disponibles → scoring léxico (solape de términos
 *     con ponderación TF simple).
 *
 * El resultado siempre es el mismo shape: los N chunks más relevantes
 * concatenados hasta `maxChars`, listos para inyectar en el system prompt.
 */

import type { KnowledgeChunk } from "../domain";

// ---------------------------------------------------------------------------
// Chunking
// ---------------------------------------------------------------------------

export const CHUNK_SIZE = 1_200;
export const CHUNK_OVERLAP = 200;

/**
 * Trocea texto en fragmentos de ~CHUNK_SIZE caracteres con solape,
 * cortando preferentemente en límites de párrafo o frase.
 */
export function chunkText(text: string): string[] {
  const clean = text.trim();
  if (clean.length === 0) return [];
  if (clean.length <= CHUNK_SIZE) return [clean];

  const chunks: string[] = [];
  let start = 0;

  while (start < clean.length) {
    let end = Math.min(start + CHUNK_SIZE, clean.length);

    if (end < clean.length) {
      // Buscar un corte natural dentro del último tercio del chunk.
      const windowStart = start + Math.floor(CHUNK_SIZE * 0.66);
      const slice = clean.slice(windowStart, end);
      const lastParagraph = slice.lastIndexOf("\n\n");
      const lastSentence = Math.max(
        slice.lastIndexOf(". "),
        slice.lastIndexOf(".\n"),
        slice.lastIndexOf("? "),
        slice.lastIndexOf("! ")
      );
      const cut = lastParagraph >= 0 ? lastParagraph : lastSentence;
      if (cut >= 0) end = windowStart + cut + 1;
    }

    chunks.push(clean.slice(start, end).trim());
    if (end >= clean.length) break;
    start = Math.max(end - CHUNK_OVERLAP, start + 1);
  }

  return chunks.filter(chunk => chunk.length > 0);
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

const STOPWORDS = new Set([
  // es
  "el", "la", "los", "las", "un", "una", "unos", "unas", "de", "del", "en",
  "y", "o", "que", "es", "se", "por", "para", "con", "su", "al", "lo", "como",
  "más", "pero", "sus", "le", "ya", "este", "esta", "sí", "no", "me", "mi",
  // en
  "the", "a", "an", "of", "to", "in", "and", "or", "that", "is", "are", "it",
  "for", "on", "with", "as", "at", "by", "be", "this", "was", "were", "from",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9ñç]+/)
    .filter(token => token.length > 1 && !STOPWORDS.has(token));
}

/**
 * Score léxico: proporción de términos de la consulta presentes en el chunk,
 * ponderada por frecuencia (TF saturado) para no premiar chunks enormes.
 */
export function lexicalScore(queryTokens: string[], chunkContent: string): number {
  if (queryTokens.length === 0) return 0;
  const chunkTokens = tokenize(chunkContent);
  if (chunkTokens.length === 0) return 0;

  const frequency = new Map<string, number>();
  for (const token of chunkTokens) {
    frequency.set(token, (frequency.get(token) ?? 0) + 1);
  }

  let score = 0;
  for (const token of new Set(queryTokens)) {
    const tf = frequency.get(token) ?? 0;
    if (tf > 0) score += 1 + Math.min(tf, 3) * 0.1;
  }
  return score / new Set(queryTokens).size;
}

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------

export interface RankedChunk {
  chunk: KnowledgeChunk;
  score: number;
}

/**
 * Ordena los chunks por relevancia frente a la consulta.
 * Usa coseno si hay vectores (consulta + chunk); si no, léxico.
 */
export function rankChunks(
  chunks: KnowledgeChunk[],
  query: string,
  queryEmbedding: number[] | null
): RankedChunk[] {
  const queryTokens = tokenize(query);

  return chunks
    .map(chunk => {
      const vector = Array.isArray(chunk.embedding)
        ? (chunk.embedding as number[])
        : null;
      const score =
        queryEmbedding && vector && vector.length === queryEmbedding.length
          ? cosineSimilarity(queryEmbedding, vector)
          : lexicalScore(queryTokens, chunk.content);
      return { chunk, score };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Selecciona los chunks mejor puntuados hasta `maxChars` y los concatena.
 * Los chunks con score 0 se descartan salvo que no haya ninguno relevante,
 * en cuyo caso se devuelven los primeros por orden natural (mejor algo que nada).
 */
export function selectContext(ranked: RankedChunk[], maxChars: number): string {
  const relevant = ranked.filter(item => item.score > 0);
  const pool = relevant.length > 0 ? relevant : ranked;

  const parts: string[] = [];
  let used = 0;
  for (const { chunk } of pool) {
    if (used + chunk.content.length > maxChars) {
      if (parts.length === 0) {
        parts.push(chunk.content.slice(0, maxChars));
      }
      break;
    }
    parts.push(chunk.content);
    used += chunk.content.length;
  }
  return parts.join("\n\n---\n\n");
}
