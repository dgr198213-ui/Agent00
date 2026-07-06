/**
 * Deploy — el objetivo final: un botón "Publish Agent".
 * Opciones: privado, público, API, widget, webhook.
 */

import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Check, Copy, Globe, Lock, Rocket, Webhook, Code2, MonitorSmartphone } from "lucide-react";
import { toast } from "sonner";
import { AgentPicker, useAgentParam } from "../shared/AgentPicker";

const DEPLOY_OPTIONS = [
  {
    type: "private" as const,
    icon: Lock,
    title: "Privado",
    description: "El agente queda publicado solo para ti dentro de la plataforma.",
  },
  {
    type: "public" as const,
    icon: Globe,
    title: "Público",
    description: "El agente se marca como público y visible para otros usuarios.",
  },
  {
    type: "api" as const,
    icon: Code2,
    title: "API",
    description: "Genera una API key para invocar el agente vía REST desde cualquier sistema.",
  },
  {
    type: "widget" as const,
    icon: MonitorSmartphone,
    title: "Widget",
    description: "Snippet embebible para integrar el agente en tu web (usa la API).",
  },
  {
    type: "webhook" as const,
    icon: Webhook,
    title: "Webhook",
    description: "Endpoint + API key pensado para integraciones entrantes automatizadas.",
  },
];

function copy(text: string) {
  navigator.clipboard.writeText(text);
  toast.success("Copiado al portapapeles");
}

export default function DeployPage() {
  const [agentId] = useAgentParam();
  const utils = trpc.useUtils();

  const { data: agent } = trpc.agents.get.useQuery({ agentId: agentId! }, { enabled: !!agentId });
  const { data: deployments } = trpc.deployments.list.useQuery(
    { agentId: agentId! },
    { enabled: !!agentId }
  );

  const publish = trpc.deployments.publish.useMutation({
    onSuccess: () => {
      utils.deployments.list.invalidate({ agentId: agentId! });
      utils.agents.get.invalidate({ agentId: agentId! });
      utils.agents.list.invalidate();
      toast.success("Agente publicado");
    },
    onError: e => toast.error(e.message),
  });

  const revoke = trpc.deployments.revoke.useMutation({
    onSuccess: () => {
      utils.deployments.list.invalidate({ agentId: agentId! });
      utils.agents.get.invalidate({ agentId: agentId! });
      utils.agents.list.invalidate();
      toast.success("Deployment revocado");
    },
    onError: e => toast.error(e.message),
  });

  const activeByType = new Map(
    (deployments ?? []).filter(d => d.status === "active").map(d => [d.type, d])
  );

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const curlSnippet = (apiKey: string) =>
    `curl -X POST ${origin}/api/v1/agents/invoke \\\n  -H "Authorization: Bearer ${apiKey}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"message": "Hola"}'`;

  const widgetSnippet = (apiKey: string) =>
    `<script>\n  // Widget mínimo: envía mensajes al agente vía la API pública\n  async function askAgent(message) {\n    const res = await fetch("${origin}/api/v1/agents/invoke", {\n      method: "POST",\n      headers: {\n        "Authorization": "Bearer ${apiKey}",\n        "Content-Type": "application/json"\n      },\n      body: JSON.stringify({ message })\n    });\n    return (await res.json()).reply;\n  }\n</script>`;

  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Deploy</h1>
            <p className="text-sm text-muted-foreground">
              Publica tu agente y elige cómo quieres que el mundo lo use.
            </p>
          </div>
          <AgentPicker />
        </div>

        {agentId && agent && (
          <>
            <Card className="border-primary/30">
              <CardContent className="py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Rocket className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">{agent.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Estado: {agent.status === "published" ? "Publicado" : "Borrador"}
                    </p>
                  </div>
                </div>
                <Badge variant={agent.status === "published" ? "default" : "secondary"}>
                  {agent.status === "published" ? "Publicado" : "Borrador"}
                </Badge>
              </CardContent>
            </Card>

            <div className="grid gap-4 sm:grid-cols-2">
              {DEPLOY_OPTIONS.map(option => {
                const active = activeByType.get(option.type);
                return (
                  <Card key={option.type} className={active ? "border-primary/40" : undefined}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          <option.icon className="h-4 w-4 text-primary" />
                          {option.title}
                        </CardTitle>
                        {active && (
                          <Badge className="gap-1">
                            <Check className="h-3 w-3" />
                            Activo
                          </Badge>
                        )}
                      </div>
                      <CardDescription>{option.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {active?.apiKey && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-muted rounded px-2 py-1 truncate flex-1">
                              {active.apiKey}
                            </code>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copy(active.apiKey!)}>
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              copy(option.type === "widget" ? widgetSnippet(active.apiKey!) : curlSnippet(active.apiKey!))
                            }
                          >
                            <Copy className="h-3.5 w-3.5 mr-2" />
                            Copiar snippet {option.type === "widget" ? "widget" : "cURL"}
                          </Button>
                        </div>
                      )}
                      {active ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => revoke.mutate({ deploymentId: active.id })}
                        >
                          Revocar
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          disabled={publish.isPending}
                          onClick={() => publish.mutate({ agentId: agentId!, type: option.type })}
                        >
                          <Rocket className="h-4 w-4 mr-2" />
                          Publish Agent
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
