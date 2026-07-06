/**
 * Tools — paso "Conectar herramientas" del flujo lineal.
 * Cada herramienta implementa la interfaz única Tool { id, name, execute(), schema() }.
 */

import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { ArrowRight, Plug, Unplug } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { AgentPicker, useAgentParam } from "../shared/AgentPicker";

export default function ToolsPage() {
  const [agentId] = useAgentParam();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const { data: available } = trpc.tools.available.useQuery();
  const { data: connected } = trpc.tools.listForAgent.useQuery(
    { agentId: agentId! },
    { enabled: !!agentId }
  );

  const [configDrafts, setConfigDrafts] = useState<Record<string, Record<string, string>>>({});

  const connect = trpc.tools.connect.useMutation({
    onSuccess: () => {
      utils.tools.listForAgent.invalidate({ agentId: agentId! });
      toast.success("Herramienta conectada");
    },
    onError: e => toast.error(e.message),
  });

  const disconnect = trpc.tools.disconnect.useMutation({
    onSuccess: () => utils.tools.listForAgent.invalidate({ agentId: agentId! }),
    onError: e => toast.error(e.message),
  });

  const connectedByKey = new Map((connected ?? []).map(t => [t.toolKey, t]));

  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Tools</h1>
            <p className="text-sm text-muted-foreground">
              Conecta las herramientas que tu agente podrá usar durante las conversaciones.
            </p>
          </div>
          <AgentPicker />
        </div>

        {agentId && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              {(available ?? []).map(tool => {
                const existing = connectedByKey.get(tool.id);
                const draft = configDrafts[tool.id] ?? {};
                const missingRequired = tool.configFields.some(
                  f => f.required && !draft[f.key]?.trim()
                );

                return (
                  <Card key={tool.id} className={existing ? "border-primary/40" : undefined}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{tool.name}</CardTitle>
                        {existing && <Badge>Conectada</Badge>}
                      </div>
                      <CardDescription>{tool.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {!existing &&
                        tool.configFields.map(field => (
                          <div key={field.key} className="space-y-1">
                            <Label className="text-xs">
                              {field.label}
                              {field.required ? " *" : ""}
                            </Label>
                            <Input
                              className="h-8 text-sm"
                              placeholder={field.placeholder}
                              value={draft[field.key] ?? ""}
                              onChange={e =>
                                setConfigDrafts(prev => ({
                                  ...prev,
                                  [tool.id]: { ...prev[tool.id], [field.key]: e.target.value },
                                }))
                              }
                            />
                          </div>
                        ))}

                      {existing ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            disconnect.mutate({ agentId: agentId!, toolId: existing.id })
                          }
                        >
                          <Unplug className="h-4 w-4 mr-2" />
                          Desconectar
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          disabled={connect.isPending || missingRequired}
                          onClick={() =>
                            connect.mutate({
                              agentId: agentId!,
                              toolKey: tool.id,
                              config: draft,
                            })
                          }
                        >
                          <Plug className="h-4 w-4 mr-2" />
                          Conectar
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="flex justify-end">
              <Button onClick={() => setLocation(`/playground?agent=${agentId}`)}>
                Siguiente: Probar en el Playground
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
