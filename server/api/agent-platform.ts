/**
 * Capa API — routers tRPC de la Agent Builder Platform.
 * Sin lógica de negocio: solo validación y delegación a la capa Application.
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { agentService } from "../application/agent-service";
import { deploymentService } from "../application/deployment-service";
import { knowledgeService } from "../application/knowledge-service";
import { playgroundService } from "../application/playground-service";
import { toolRepository } from "../infrastructure/repositories";
import { listAvailableTools } from "../tools/registry";
import { nanoid } from "nanoid";

function toTrpcError(error: unknown): TRPCError {
  const message = error instanceof Error ? error.message : "Error inesperado";
  const code = /no encontrad/i.test(message) ? "NOT_FOUND" : "BAD_REQUEST";
  return new TRPCError({ code, message });
}

async function run<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    throw toTrpcError(error);
  }
}

// ============================================================================
// AGENTS
// ============================================================================

const agentInput = {
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  model: z.string().max(128).optional(),
  temperature: z.number().min(0).max(2).optional(),
  systemPrompt: z.string().max(20_000).optional(),
  icon: z.string().max(64).optional(),
};

export const agentsRouter = router({
  list: protectedProcedure.query(({ ctx }) => run(() => agentService.list(ctx.user.id))),

  get: protectedProcedure
    .input(z.object({ agentId: z.string() }))
    .query(({ ctx, input }) => run(() => agentService.getOwned(ctx.user.id, input.agentId))),

  create: protectedProcedure
    .input(z.object(agentInput))
    .mutation(({ ctx, input }) => run(() => agentService.create(ctx.user.id, input))),

  update: protectedProcedure
    .input(
      z.object({
        agentId: z.string(),
        name: agentInput.name.optional(),
        description: agentInput.description,
        model: agentInput.model,
        temperature: agentInput.temperature,
        systemPrompt: agentInput.systemPrompt,
        icon: agentInput.icon,
        visibility: z.enum(["private", "public"]).optional(),
      })
    )
    .mutation(({ ctx, input }) => {
      const { agentId, ...patch } = input;
      return run(() => agentService.update(ctx.user.id, agentId, patch));
    }),

  delete: protectedProcedure
    .input(z.object({ agentId: z.string() }))
    .mutation(({ ctx, input }) => run(() => agentService.delete(ctx.user.id, input.agentId))),
});

// ============================================================================
// KNOWLEDGE
// ============================================================================

export const knowledgeRouter = router({
  list: protectedProcedure
    .input(z.object({ agentId: z.string() }))
    .query(({ ctx, input }) => run(() => knowledgeService.list(ctx.user.id, input.agentId))),

  add: protectedProcedure
    .input(
      z.object({
        agentId: z.string(),
        name: z.string().min(1).max(255),
        sourceType: z.enum([
          "text", "markdown", "pdf", "csv", "json", "website", "github", "notion", "gdocs", "confluence",
        ]),
        content: z.string().max(500_000).optional(),
        sourceUrl: z.string().url().optional(),
      })
    )
    .mutation(({ ctx, input }) => run(() => knowledgeService.add(ctx.user.id, input))),

  remove: protectedProcedure
    .input(z.object({ knowledgeId: z.string() }))
    .mutation(({ ctx, input }) => run(() => knowledgeService.remove(ctx.user.id, input.knowledgeId))),
});

// ============================================================================
// TOOLS
// ============================================================================

export const toolsRouter = router({
  available: protectedProcedure.query(() => listAvailableTools()),

  listForAgent: protectedProcedure
    .input(z.object({ agentId: z.string() }))
    .query(({ ctx, input }) =>
      run(async () => {
        await agentService.getOwned(ctx.user.id, input.agentId);
        return toolRepository.listByAgent(input.agentId);
      })
    ),

  connect: protectedProcedure
    .input(
      z.object({
        agentId: z.string(),
        toolKey: z.string(),
        config: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(({ ctx, input }) =>
      run(async () => {
        await agentService.getOwned(ctx.user.id, input.agentId);
        await toolRepository.upsert({
          id: nanoid(),
          agentId: input.agentId,
          userId: ctx.user.id,
          toolKey: input.toolKey,
          config: input.config ?? null,
          enabled: true,
        });
        return toolRepository.listByAgent(input.agentId);
      })
    ),

  disconnect: protectedProcedure
    .input(z.object({ agentId: z.string(), toolId: z.string() }))
    .mutation(({ ctx, input }) =>
      run(async () => {
        await agentService.getOwned(ctx.user.id, input.agentId);
        await toolRepository.delete(input.toolId);
        return toolRepository.listByAgent(input.agentId);
      })
    ),
});

// ============================================================================
// PLAYGROUND
// ============================================================================

export const playgroundRouter = router({
  conversations: protectedProcedure
    .input(z.object({ agentId: z.string() }))
    .query(({ ctx, input }) =>
      run(async () => {
        await agentService.getOwned(ctx.user.id, input.agentId);
        return playgroundService.listConversations(ctx.user.id, input.agentId);
      })
    ),

  messages: protectedProcedure
    .input(z.object({ conversationId: z.string() }))
    .query(({ ctx, input }) => run(() => playgroundService.getMessages(ctx.user.id, input.conversationId))),

  chat: protectedProcedure
    .input(
      z.object({
        agentId: z.string(),
        message: z.string().min(1).max(20_000),
        conversationId: z.string().optional(),
      })
    )
    .mutation(({ ctx, input }) =>
      run(() => playgroundService.chat(ctx.user.id, input.agentId, input.message, input.conversationId))
    ),

  deleteConversation: protectedProcedure
    .input(z.object({ conversationId: z.string() }))
    .mutation(({ ctx, input }) =>
      run(() => playgroundService.deleteConversation(ctx.user.id, input.conversationId))
    ),
});

// ============================================================================
// DEPLOYMENTS
// ============================================================================

export const deploymentsRouter = router({
  list: protectedProcedure
    .input(z.object({ agentId: z.string() }))
    .query(({ ctx, input }) => run(() => deploymentService.list(ctx.user.id, input.agentId))),

  publish: protectedProcedure
    .input(
      z.object({
        agentId: z.string(),
        type: z.enum(["private", "public", "api", "widget", "webhook"]),
      })
    )
    .mutation(({ ctx, input }) =>
      run(() => deploymentService.publish(ctx.user.id, input.agentId, input.type))
    ),

  revoke: protectedProcedure
    .input(z.object({ deploymentId: z.string() }))
    .mutation(({ ctx, input }) => run(() => deploymentService.revoke(ctx.user.id, input.deploymentId))),
});
