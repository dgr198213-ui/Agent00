/**
 * Selector de agente activo compartido por Knowledge, Tools, Playground y Deploy.
 * El agente seleccionado viaja en la URL (?agent=<id>) para que el flujo lineal
 * Crear → Conocimiento → Herramientas → Playground → Publicar sea navegable.
 */

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Bot } from "lucide-react";
import { useLocation, useSearch } from "wouter";

export function useAgentParam(): [string | null, (agentId: string) => void] {
  const search = useSearch();
  const [location, setLocation] = useLocation();
  const agentId = new URLSearchParams(search).get("agent");

  const setAgentId = (id: string) => {
    setLocation(`${location.split("?")[0]}?agent=${encodeURIComponent(id)}`);
  };

  return [agentId, setAgentId];
}

export function goToStep(setLocation: (path: string) => void, step: string, agentId: string) {
  setLocation(`${step}?agent=${encodeURIComponent(agentId)}`);
}

export function AgentPicker() {
  const [agentId, setAgentId] = useAgentParam();
  const { data: agents, isLoading } = trpc.agents.list.useQuery();

  if (isLoading) return <div className="text-sm text-muted-foreground">Cargando agentes…</div>;

  if (!agents || agents.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Bot className="h-4 w-4" />
        No tienes agentes todavía. Crea uno en la sección Agents.
      </div>
    );
  }

  return (
    <Select value={agentId ?? undefined} onValueChange={setAgentId}>
      <SelectTrigger className="w-72">
        <SelectValue placeholder="Selecciona un agente" />
      </SelectTrigger>
      <SelectContent>
        {agents.map(agent => (
          <SelectItem key={agent.id} value={agent.id}>
            {agent.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
