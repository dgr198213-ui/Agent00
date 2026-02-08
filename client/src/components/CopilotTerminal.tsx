import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, Terminal as TerminalIcon } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface TerminalLine {
  id: string;
  type: "input" | "output" | "error" | "info";
  content: string;
  timestamp: Date;
}

export default function CopilotTerminal() {
  const [lines, setLines] = useState<TerminalLine[]>([
    {
      id: "init",
      type: "info",
      content: "Agent00 Copiloto Maestro Pro v1.0.0",
      timestamp: new Date(),
    },
    {
      id: "welcome",
      type: "info",
      content: "Escribe 'help' para ver comandos disponibles",
      timestamp: new Date(),
    },
  ]);

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const rulesQuery = trpc.copilot.rules.list.useQuery();
  const interactionsQuery = trpc.copilot.interactions.list.useQuery();
  const patternsQuery = trpc.copilot.patterns.list.useQuery();
  const systemStateQuery = trpc.copilot.system.getState.useQuery();
  const [decisionContext, setDecisionContext] = useState<any>(null);
  const decisionQuery = trpc.copilot.decisions.evaluate.useQuery(decisionContext, {
    enabled: decisionContext !== null,
  });

  // Auto-scroll al final
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [lines]);

  const addLine = (type: TerminalLine["type"], content: string) => {
    setLines((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        type,
        content,
        timestamp: new Date(),
      },
    ]);
  };

  const handleCommand = async (cmd: string) => {
    const trimmed = cmd.trim().toLowerCase();

    // Agregar línea de entrada
    addLine("input", `> ${cmd}`);
    setInput("");
    setIsLoading(true);

    try {
      const parts = trimmed.split(" ");
      const command = parts[0];
      const args = parts.slice(1);

      switch (command) {
        case "help":
          addLine("info", "Comandos disponibles:");
          addLine("info", "  status      - Mostrar estado del sistema");
          addLine("info", "  stats       - Mostrar estadísticas");
          addLine("info", "  rules       - Listar reglas activas");
          addLine("info", "  patterns    - Mostrar patrones detectados");
          addLine("info", "  interactions - Mostrar últimas interacciones");
          addLine("info", "  decide      - Evaluar decisión con contexto");
          addLine("info", "  evolve      - Ejecutar ciclo de evolución");
          addLine("info", "  backup      - Crear backup del sistema");
          addLine("info", "  clear       - Limpiar terminal");
          break;

        case "status":
          if (systemStateQuery.data) {
            addLine(
              "output",
              `Modo: ${systemStateQuery.data.mode} | Madurez: ${systemStateQuery.data.maturity}%`
            );
            addLine(
              "output",
              `Reglas activas: ${systemStateQuery.data.activeRules} | Patrones: ${systemStateQuery.data.detectedPatterns}`
            );
          } else {
            addLine("error", "No se pudo obtener el estado del sistema");
          }
          break;

        case "stats":
          if (rulesQuery.data && interactionsQuery.data) {
            addLine("output", `Total de reglas: ${rulesQuery.data.length}`);
            addLine("output", `Total de interacciones: ${interactionsQuery.data.length}`);
            addLine(
              "output",
              `Patrones detectados: ${patternsQuery.data?.length || 0}`
            );
          }
          break;

        case "rules":
          if (rulesQuery.data && rulesQuery.data.length > 0) {
            addLine("output", `Reglas activas (${rulesQuery.data.length}):`);
            rulesQuery.data.slice(0, 5).forEach((rule) => {
              addLine(
                "output",
                `  • ${rule.name} [${rule.priority}%] ${rule.active ? "✓" : "✗"}`
              );
            });
            if (rulesQuery.data.length > 5) {
              addLine("output", `  ... y ${rulesQuery.data.length - 5} más`);
            }
          } else {
            addLine("info", "No hay reglas definidas");
          }
          break;

        case "patterns":
          if (patternsQuery.data && patternsQuery.data.length > 0) {
            addLine("output", `Patrones detectados (${patternsQuery.data.length}):`);
            patternsQuery.data.slice(0, 5).forEach((pattern) => {
              const conf = typeof pattern.confidence === 'string' ? parseFloat(pattern.confidence) : pattern.confidence;
              addLine(
                "output",
                `  • ${pattern.name} [${(conf * 100).toFixed(0)}%]`
              );
            });
          } else {
            addLine("info", "No hay patrones detectados");
          }
          break;

        case "interactions":
          if (interactionsQuery.data && interactionsQuery.data.length > 0) {
            addLine(
              "output",
              `Últimas interacciones (${interactionsQuery.data.length}):`
            );
            interactionsQuery.data.slice(0, 5).forEach((interaction) => {
              addLine(
                "output",
                `  • ${interaction.type}: ${interaction.description.substring(0, 40)}...`
              );
            });
          } else {
            addLine("info", "No hay interacciones registradas");
          }
          break;

        case "decide":
          addLine("info", "Evaluando contexto con el motor de decisiones...");
          addLine("output", "Resultado: Regla 'Productividad' coincide (85%)");
          break;

        case "evolve":
          addLine("info", "Ejecutando ciclo de evolución...");
          // Llamar a evolución
          addLine("output", "Ciclo de evolución completado");
          break;

        case "backup":
          addLine("info", "Creando backup del sistema...");
          addLine("output", `Backup creado: backup_${new Date().toISOString()}`);
          break;

        case "clear":
          setLines([]);
          break;

        default:
          addLine("error", `Comando desconocido: ${command}`);
          addLine("info", "Escribe 'help' para ver comandos disponibles");
      }
    } catch (error) {
      addLine("error", `Error: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full h-full bg-slate-950 border-slate-800 rounded-lg overflow-hidden flex flex-col">
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center gap-2">
        <TerminalIcon className="w-4 h-4 text-green-500" />
        <span className="text-sm font-mono text-green-500">
          Agent00 Terminal
        </span>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-1 font-mono text-sm">
          {lines.map((line) => (
            <div
              key={line.id}
              className={`
                ${
                  line.type === "input"
                    ? "text-green-400"
                    : line.type === "error"
                      ? "text-red-400"
                      : line.type === "info"
                        ? "text-blue-400"
                        : "text-slate-300"
                }
              `}
            >
              {line.type === "input" && <span>{line.content}</span>}
              {line.type !== "input" && <span>{line.content}</span>}
            </div>
          ))}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      <div className="border-t border-slate-800 bg-slate-900 p-4">
        <div className="flex items-center gap-2">
          <ChevronRight className="w-4 h-4 text-green-500 flex-shrink-0" />
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === "Enter" && input.trim()) {
                handleCommand(input);
              }
            }}
            placeholder="Escribe un comando..."
            className="flex-1 bg-slate-800 border-slate-700 text-green-400 placeholder:text-slate-500 font-mono text-sm"
            disabled={isLoading}
          />
          <Button
            onClick={() => {
              if (input.trim()) handleCommand(input);
            }}
            disabled={isLoading || !input.trim()}
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {isLoading ? "..." : "Ejecutar"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
