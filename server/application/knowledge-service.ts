/**
 * Capa de Aplicación — casos de uso de Knowledge.
 *
 * Independientemente del origen (texto, markdown, website, CSV, JSON…),
 * todo el conocimiento termina indexado igual: texto plano en `content`.
 */

import axios from "axios";
import * as cheerio from "cheerio";
import { nanoid } from "nanoid";
import type { AgentKnowledge } from "../domain";
import { chunkRepository, knowledgeRepository } from "../infrastructure/repositories";
import { embedQuery, embedTexts } from "../infrastructure/embeddings";
import { agentService } from "./agent-service";
import { chunkText, rankChunks, selectContext } from "./retrieval";

const MAX_CONTENT_CHARS = 60_000;
const FETCH_TIMEOUT_MS = 20_000;

export type KnowledgeSourceType = AgentKnowledge["sourceType"];

export interface AddKnowledgeInput {
  agentId: string;
  name: string;
  sourceType: KnowledgeSourceType;
  /** Contenido en texto plano (para text/markdown/csv/json pegados o subidos) */
  content?: string;
  /** URL de origen (para website/github/notion/gdocs/confluence) */
  sourceUrl?: string;
}

function normalizeContent(raw: string): string {
  const text = raw.replace(/\r\n/g, "\n").trim();
  return text.length > MAX_CONTENT_CHARS ? text.slice(0, MAX_CONTENT_CHARS) : text;
}

async function fetchUrlAsText(url: string): Promise<string> {
  if (!/^https?:\/\//.test(url)) throw new Error("URL inválida");
  const res = await axios.get(url, {
    timeout: FETCH_TIMEOUT_MS,
    maxContentLength: 4_000_000,
    headers: { "User-Agent": "Agent00-Knowledge/1.0" },
  });
  const data = res.data;
  if (typeof data === "object") return JSON.stringify(data, null, 2);
  const html = String(data);
  const contentType = String(res.headers["content-type"] ?? "");
  if (contentType.includes("html") || /<html/i.test(html)) {
    const $ = cheerio.load(html);
    $("script, style, noscript, iframe, nav, footer").remove();
    return $("body").text().replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  }
  return html;
}

export const knowledgeService = {
  async list(userId: number, agentId: string): Promise<AgentKnowledge[]> {
    await agentService.getOwned(userId, agentId);
    return knowledgeRepository.listByAgent(agentId);
  },

  async add(userId: number, input: AddKnowledgeInput): Promise<AgentKnowledge[]> {
    await agentService.getOwned(userId, input.agentId);

    const id = nanoid();
    const isUrlSource = ["website", "github", "notion", "gdocs", "confluence"].includes(input.sourceType);

    if (isUrlSource && !input.sourceUrl) {
      throw new Error("Este tipo de fuente requiere una URL");
    }
    if (!isUrlSource && !input.content?.trim()) {
      throw new Error("Este tipo de fuente requiere contenido");
    }

    await knowledgeRepository.create({
      id,
      agentId: input.agentId,
      userId,
      name: input.name.trim(),
      sourceType: input.sourceType,
      sourceUrl: input.sourceUrl || null,
      content: null,
      status: "pending",
      size: 0,
    });

    // Ingesta: sin importar el origen, todo termina indexado igual.
    try {
      const raw = isUrlSource ? await fetchUrlAsText(input.sourceUrl!) : input.content!;
      const content = normalizeContent(raw);
      if (!content) throw new Error("La fuente no contiene texto");

      // Chunking + embeddings (best-effort: si el proveedor de embeddings
      // no está disponible, los chunks se guardan sin vector y el retrieval
      // degrada a scoring léxico).
      const pieces = chunkText(content);
      const vectors = await embedTexts(pieces);
      await chunkRepository.deleteByKnowledgeId(id);
      await chunkRepository.createMany(
        pieces.map((piece, index) => ({
          id: nanoid(),
          knowledgeId: id,
          agentId: input.agentId,
          chunkIndex: index,
          content: piece,
          embedding: vectors ? vectors[index] : null,
        }))
      );

      await knowledgeRepository.update(id, {
        content,
        size: content.length,
        status: "indexed",
        errorMessage: null,
      });
    } catch (error) {
      await knowledgeRepository.update(id, {
        status: "error",
        errorMessage: (error as Error).message,
      });
    }

    return knowledgeRepository.listByAgent(input.agentId);
  },

  async remove(userId: number, knowledgeId: string): Promise<void> {
    const item = await knowledgeRepository.findById(knowledgeId);
    if (!item || item.userId !== userId) throw new Error("Fuente no encontrada");
    await chunkRepository.deleteByKnowledgeId(knowledgeId);
    await knowledgeRepository.delete(knowledgeId);
  },

  /**
   * Construye el contexto de conocimiento que se inyecta en el prompt del agente.
   *
   * Con `query` hace retrieval: puntúa los chunks frente a la consulta
   * (coseno si hay embeddings, léxico si no) y devuelve solo los relevantes.
   * Sin `query` (p. ej. invocación stateless por API) concatena truncado.
   */
  async buildContext(agentId: string, maxChars = 12_000, query?: string): Promise<string> {
    if (query?.trim()) {
      const chunks = await chunkRepository.listByAgent(agentId);
      if (chunks.length > 0) {
        const queryEmbedding = await embedQuery(query);
        return selectContext(rankChunks(chunks, query, queryEmbedding), maxChars);
      }
      // Fuentes antiguas sin chunks → caer al modo concatenación.
    }

    const items = await knowledgeRepository.listByAgent(agentId);
    const indexed = items.filter(item => item.status === "indexed" && item.content);
    if (indexed.length === 0) return "";

    const budget = Math.floor(maxChars / indexed.length);
    return indexed
      .map(item => `### ${item.name}\n${item.content!.slice(0, Math.max(budget, 500))}`)
      .join("\n\n");
  },
};
