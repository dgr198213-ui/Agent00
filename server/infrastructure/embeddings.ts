/**
 * Capa de Infraestructura — cliente de embeddings.
 *
 * Usa el endpoint OpenAI-compatible `/v1/embeddings` del mismo proveedor
 * que el LLM (BUILT_IN_FORGE_API_URL). Si el proveedor no soporta
 * embeddings, el sistema degrada a retrieval léxico sin romper la ingesta:
 * `embedTexts` devuelve `null` y los chunks se guardan sin vector.
 */

import { ENV } from "../_core/env";

const EMBEDDINGS_MODEL = process.env.EMBEDDINGS_MODEL ?? "text-embedding-3-small";
const EMBEDDINGS_TIMEOUT_MS = 30_000;
const MAX_BATCH = 64;

/** Se recuerda entre llamadas para no reintentar contra un proveedor sin soporte. */
let providerUnavailable = false;

function resolveEmbeddingsUrl(): string {
  const base =
    ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0
      ? ENV.forgeApiUrl.replace(/\/$/, "")
      : "https://forge.manus.im";
  return `${base}/v1/embeddings`;
}

async function embedBatch(texts: string[]): Promise<number[][] | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EMBEDDINGS_TIMEOUT_MS);
  try {
    const response = await fetch(resolveEmbeddingsUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ENV.forgeApiKey}`,
      },
      body: JSON.stringify({ model: EMBEDDINGS_MODEL, input: texts }),
      signal: controller.signal,
    });

    if (!response.ok) {
      // 404/405/501… → el proveedor no expone embeddings. No insistir.
      if ([404, 405, 501].includes(response.status)) providerUnavailable = true;
      return null;
    }

    const payload = (await response.json()) as {
      data?: Array<{ index: number; embedding: number[] }>;
    };
    if (!payload.data || payload.data.length !== texts.length) return null;

    return payload.data
      .slice()
      .sort((a, b) => a.index - b.index)
      .map(item => item.embedding);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Genera embeddings para una lista de textos (por lotes).
 * Devuelve `null` si el proveedor no está disponible: el llamador debe
 * degradar a retrieval léxico, nunca fallar la ingesta por esto.
 */
export async function embedTexts(texts: string[]): Promise<number[][] | null> {
  if (texts.length === 0) return [];
  if (providerUnavailable || !ENV.forgeApiKey) return null;

  const vectors: number[][] = [];
  for (let i = 0; i < texts.length; i += MAX_BATCH) {
    const batch = await embedBatch(texts.slice(i, i + MAX_BATCH));
    if (batch === null) return null;
    vectors.push(...batch);
  }
  return vectors;
}

/** Embedding de una consulta individual (para retrieval). */
export async function embedQuery(text: string): Promise<number[] | null> {
  const result = await embedTexts([text]);
  return result?.[0] ?? null;
}

/** Solo para tests: restablece el estado del proveedor. */
export function __resetEmbeddingsProviderState(): void {
  providerUnavailable = false;
}
