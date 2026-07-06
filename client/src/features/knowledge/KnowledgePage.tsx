/**
 * Knowledge — paso "Añadir conocimiento" del flujo lineal.
 * Independientemente del origen, todo termina indexado igual.
 */

import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { ArrowRight, FileText, Globe, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { AgentPicker, useAgentParam } from "../shared/AgentPicker";

const URL_SOURCES = ["website", "github", "notion", "gdocs", "confluence"] as const;
const TEXT_SOURCES = ["text", "markdown", "csv", "json"] as const;
type SourceType = (typeof URL_SOURCES)[number] | (typeof TEXT_SOURCES)[number] | "pdf";

const SOURCE_LABELS: Record<string, string> = {
  text: "Texto",
  markdown: "Markdown",
  csv: "CSV",
  json: "JSON",
  website: "Website",
  github: "GitHub",
  notion: "Notion",
  gdocs: "Google Docs",
  confluence: "Confluence",
  pdf: "PDF",
};

export default function KnowledgePage() {
  const [agentId] = useAgentParam();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const { data: items } = trpc.knowledge.list.useQuery(
    { agentId: agentId! },
    { enabled: !!agentId }
  );

  const [name, setName] = useState("");
  const [sourceType, setSourceType] = useState<SourceType>("text");
  const [content, setContent] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");

  const isUrlSource = (URL_SOURCES as readonly string[]).includes(sourceType);

  const addKnowledge = trpc.knowledge.add.useMutation({
    onSuccess: () => {
      utils.knowledge.list.invalidate({ agentId: agentId! });
      setName("");
      setContent("");
      setSourceUrl("");
      toast.success("Conocimiento añadido e indexado");
    },
    onError: e => toast.error(e.message),
  });

  const removeKnowledge = trpc.knowledge.remove.useMutation({
    onSuccess: () => utils.knowledge.list.invalidate({ agentId: agentId! }),
    onError: e => toast.error(e.message),
  });

  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Knowledge</h1>
            <p className="text-sm text-muted-foreground">
              Añade el conocimiento que tu agente usará para responder.
            </p>
          </div>
          <AgentPicker />
        </div>

        {agentId && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Añadir fuente</CardTitle>
                <CardDescription>
                  Pega texto directamente o indexa el contenido de una URL.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Nombre de la fuente</Label>
                    <Input
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Manual del producto"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={sourceType} onValueChange={v => setSourceType(v as SourceType)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[...TEXT_SOURCES, ...URL_SOURCES].map(t => (
                          <SelectItem key={t} value={t}>
                            {SOURCE_LABELS[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {isUrlSource ? (
                  <div className="space-y-2">
                    <Label>URL</Label>
                    <Input
                      value={sourceUrl}
                      onChange={e => setSourceUrl(e.target.value)}
                      placeholder="https://docs.miproducto.com/guia"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Contenido</Label>
                    <Textarea
                      className="min-h-32 font-mono text-sm"
                      value={content}
                      onChange={e => setContent(e.target.value)}
                      placeholder="Pega aquí el contenido…"
                    />
                  </div>
                )}

                <Button
                  disabled={
                    addKnowledge.isPending ||
                    !name.trim() ||
                    (isUrlSource ? !sourceUrl.trim() : !content.trim())
                  }
                  onClick={() =>
                    addKnowledge.mutate({
                      agentId: agentId!,
                      name,
                      sourceType,
                      content: isUrlSource ? undefined : content,
                      sourceUrl: isUrlSource ? sourceUrl : undefined,
                    })
                  }
                >
                  {addKnowledge.isPending ? "Indexando…" : "Añadir conocimiento"}
                </Button>
              </CardContent>
            </Card>

            <div className="space-y-3">
              {(items ?? []).map(item => (
                <Card key={item.id}>
                  <CardContent className="py-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {item.sourceUrl ? (
                        <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="font-medium truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {SOURCE_LABELS[item.sourceType] ?? item.sourceType}
                          {item.size ? ` · ${(item.size / 1000).toFixed(1)}k caracteres` : ""}
                          {item.status === "error" ? ` · ${item.errorMessage}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge
                        variant={
                          item.status === "indexed"
                            ? "default"
                            : item.status === "error"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {item.status === "indexed" ? "Indexado" : item.status === "error" ? "Error" : "Pendiente"}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => removeKnowledge.mutate({ knowledgeId: item.id })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex justify-end">
              <Button onClick={() => setLocation(`/tools?agent=${agentId}`)}>
                Siguiente: Herramientas
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
