/**
 * Agents — núcleo del producto.
 * Paso 1 del flujo: Crear Agente → Definir identidad.
 */

import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Bot, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function AgentsPage() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { data: agents, isLoading } = trpc.agents.list.useQuery();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const createAgent = trpc.agents.create.useMutation({
    onSuccess: agent => {
      utils.agents.list.invalidate();
      setOpen(false);
      setName("");
      setDescription("");
      toast.success("Agente creado");
      setLocation(`/agents/${agent.id}`);
    },
    onError: e => toast.error(e.message),
  });

  const deleteAgent = trpc.agents.delete.useMutation({
    onSuccess: () => {
      utils.agents.list.invalidate();
      toast.success("Agente eliminado");
    },
    onError: e => toast.error(e.message),
  });

  return (
    <DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
            <p className="text-sm text-muted-foreground">
              Crea, configura y gestiona tus agentes de IA.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Crear agente
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nuevo agente</DialogTitle>
                <DialogDescription>
                  Empieza con lo esencial. Después definirás su identidad, conocimiento y herramientas.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="agent-name">Nombre</Label>
                  <Input
                    id="agent-name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Asistente de soporte"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="agent-desc">Descripción</Label>
                  <Textarea
                    id="agent-desc"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Responde dudas de clientes sobre el producto…"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  disabled={!name.trim() || createAgent.isPending}
                  onClick={() => createAgent.mutate({ name, description: description || undefined })}
                >
                  {createAgent.isPending ? "Creando…" : "Crear"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : !agents || agents.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
              <Bot className="h-10 w-10 text-muted-foreground" />
              <p className="text-muted-foreground">
                Todavía no tienes agentes. Crea el primero y sigue el flujo:
                <br />
                <span className="font-medium text-foreground">
                  Identidad → Conocimiento → Herramientas → Playground → Publicar
                </span>
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {agents.map(agent => (
              <Card
                key={agent.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => setLocation(`/agents/${agent.id}`)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Bot className="h-4 w-4 text-primary" />
                      {agent.name}
                    </CardTitle>
                    <Badge variant={agent.status === "published" ? "default" : "secondary"}>
                      {agent.status === "published" ? "Publicado" : "Borrador"}
                    </Badge>
                  </div>
                  <CardDescription className="line-clamp-2">
                    {agent.description || "Sin descripción"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between pt-0">
                  <span className="text-xs text-muted-foreground">
                    {agent.visibility === "public" ? "Público" : "Privado"} · temp {agent.temperature}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={e => {
                      e.stopPropagation();
                      if (confirm(`¿Eliminar el agente "${agent.name}" y todos sus datos?`)) {
                        deleteAgent.mutate({ agentId: agent.id });
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
