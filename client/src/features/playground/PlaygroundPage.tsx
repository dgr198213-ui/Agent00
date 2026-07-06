/**
 * Playground — donde se prueba el agente antes de publicarlo.
 * Memoria de conversación temporal (conversations/messages); la memoria
 * persistente del agente vive aparte y se gestiona con la herramienta "memory".
 */

import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { ArrowRight, Plus, Send, Wrench } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { AgentPicker, useAgentParam } from "../shared/AgentPicker";

export default function PlaygroundPage() {
  const [agentId] = useAgentParam();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const [conversationId, setConversationId] = useState<string | undefined>();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: conversations } = trpc.playground.conversations.useQuery(
    { agentId: agentId! },
    { enabled: !!agentId }
  );

  const { data: messages } = trpc.playground.messages.useQuery(
    { conversationId: conversationId! },
    { enabled: !!conversationId }
  );

  const chat = trpc.playground.chat.useMutation({
    onSuccess: result => {
      setConversationId(result.conversationId);
      utils.playground.messages.invalidate({ conversationId: result.conversationId });
      utils.playground.conversations.invalidate({ agentId: agentId! });
    },
    onError: e => toast.error(e.message),
  });

  useEffect(() => {
    setConversationId(undefined);
  }, [agentId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, chat.isPending]);

  const send = () => {
    const message = input.trim();
    if (!message || !agentId || chat.isPending) return;
    setInput("");
    chat.mutate({ agentId, message, conversationId });
  };

  return (
    <DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-4 h-full flex flex-col">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Playground</h1>
            <p className="text-sm text-muted-foreground">
              Prueba tu agente con su conocimiento y herramientas conectadas.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <AgentPicker />
            {agentId && (
              <Button variant="outline" size="icon" onClick={() => setConversationId(undefined)} title="Nueva conversación">
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {agentId && (
          <div className="grid gap-4 lg:grid-cols-[220px_1fr] flex-1 min-h-0">
            <Card className="hidden lg:block">
              <CardContent className="p-2">
                <p className="text-xs font-medium text-muted-foreground px-2 py-1">Conversaciones</p>
                <div className="space-y-1">
                  {(conversations ?? []).map(conv => (
                    <button
                      key={conv.id}
                      onClick={() => setConversationId(conv.id)}
                      className={`w-full text-left text-sm rounded-md px-2 py-1.5 truncate hover:bg-accent ${
                        conv.id === conversationId ? "bg-accent" : ""
                      }`}
                    >
                      {conv.title}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="flex flex-col min-h-[60vh]">
              <ScrollArea className="flex-1 p-4" ref={scrollRef as never}>
                <div className="space-y-4" >
                  {(messages ?? [])
                    .filter(m => m.role !== "system")
                    .map(m => (
                      <div
                        key={m.id}
                        className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        {m.role === "tool" ? (
                          <div className="text-xs text-muted-foreground bg-muted rounded-md px-3 py-2 max-w-[85%] flex items-start gap-2">
                            <Wrench className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                            <span className="whitespace-pre-wrap break-words">{m.content.slice(0, 600)}</span>
                          </div>
                        ) : (
                          <div
                            className={`rounded-lg px-3 py-2 max-w-[85%] whitespace-pre-wrap break-words text-sm ${
                              m.role === "user"
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted"
                            }`}
                          >
                            {m.content}
                          </div>
                        )}
                      </div>
                    ))}
                  {chat.isPending && (
                    <div className="text-sm text-muted-foreground animate-pulse">
                      El agente está pensando…
                    </div>
                  )}
                  {!conversationId && !chat.isPending && (
                    <p className="text-sm text-muted-foreground text-center py-10">
                      Escribe un mensaje para empezar una nueva conversación.
                    </p>
                  )}
                </div>
              </ScrollArea>
              <div className="border-t p-3 flex items-end gap-2">
                <Textarea
                  className="min-h-10 max-h-40 resize-none"
                  placeholder="Escribe tu mensaje…"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                />
                <Button size="icon" onClick={send} disabled={chat.isPending || !input.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          </div>
        )}

        {agentId && (
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setLocation(`/deploy?agent=${agentId}`)}>
              Siguiente: Publicar
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
