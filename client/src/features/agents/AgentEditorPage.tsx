/**
 * Editor de agente — paso "Definir identidad" del flujo lineal.
 * Al guardar, el botón "Siguiente" lleva a Knowledge con el agente ya seleccionado.
 */

import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, ArrowRight, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";

export default function AgentEditorPage() {
  const params = useParams<{ id: string }>();
  const agentId = params.id;
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const { data: agent, isLoading } = trpc.agents.get.useQuery({ agentId }, { enabled: !!agentId });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [temperature, setTemperature] = useState(0.7);

  useEffect(() => {
    if (agent) {
      setName(agent.name);
      setDescription(agent.description ?? "");
      setSystemPrompt(agent.systemPrompt ?? "");
      setTemperature(parseFloat(agent.temperature));
    }
  }, [agent]);

  const updateAgent = trpc.agents.update.useMutation({
    onSuccess: () => {
      utils.agents.get.invalidate({ agentId });
      utils.agents.list.invalidate();
      toast.success("Identidad guardada");
    },
    onError: e => toast.error(e.message),
  });

  const save = () =>
    updateAgent.mutate({
      agentId,
      name,
      description: description || undefined,
      systemPrompt: systemPrompt || undefined,
      temperature,
    });

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-6 text-sm text-muted-foreground">Cargando…</div>
      </DashboardLayout>
    );
  }

  if (!agent) {
    return (
      <DashboardLayout>
        <div className="p-6 text-sm text-muted-foreground">Agente no encontrado.</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/agents")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{agent.name}</h1>
            <p className="text-sm text-muted-foreground">
              Paso 1 de 4 · Identidad → Conocimiento → Herramientas → Publicar
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Identidad del agente</CardTitle>
            <CardDescription>Define quién es tu agente y cómo debe comportarse.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="¿Qué hace este agente?"
              />
            </div>
            <div className="space-y-2">
              <Label>System prompt</Label>
              <Textarea
                className="min-h-40 font-mono text-sm"
                value={systemPrompt}
                onChange={e => setSystemPrompt(e.target.value)}
                placeholder={"Eres un asistente experto en…\nResponde siempre en español.\nSé conciso."}
              />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Temperatura</Label>
                <span className="text-sm text-muted-foreground">{temperature.toFixed(2)}</span>
              </div>
              <Slider
                value={[temperature]}
                min={0}
                max={2}
                step={0.05}
                onValueChange={v => setTemperature(v[0])}
              />
              <p className="text-xs text-muted-foreground">
                Baja = respuestas más deterministas · Alta = respuestas más creativas
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={save} disabled={updateAgent.isPending || !name.trim()}>
            <Save className="h-4 w-4 mr-2" />
            {updateAgent.isPending ? "Guardando…" : "Guardar"}
          </Button>
          <Button
            onClick={() => {
              save();
              setLocation(`/knowledge?agent=${agentId}`);
            }}
          >
            Siguiente: Conocimiento
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
