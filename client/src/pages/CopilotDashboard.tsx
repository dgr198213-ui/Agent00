import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Activity,
  Brain,
  Zap,
  TrendingUp,
  Settings,
  Loader2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import CopilotTerminal from "@/components/CopilotTerminal";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

export default function CopilotDashboard() {
  const [activeTab, setActiveTab] = useState("overview");

  const rulesQuery = trpc.copilot.rules.list.useQuery();
  const interactionsQuery = trpc.copilot.interactions.list.useQuery();
  const patternsQuery = trpc.copilot.patterns.list.useQuery();
  const systemStateQuery = trpc.copilot.system.getState.useQuery();
  const metricsQuery = trpc.copilot.evolution.metrics.useQuery();

  const isLoading =
    rulesQuery.isLoading ||
    interactionsQuery.isLoading ||
    patternsQuery.isLoading ||
    systemStateQuery.isLoading;

  // Datos para gráficos
  const ruleStats = rulesQuery.data
    ? [
        { name: "Activas", value: rulesQuery.data.filter((r) => r.active).length },
        { name: "Inactivas", value: rulesQuery.data.filter((r) => !r.active).length },
      ]
    : [];

  const performanceData = rulesQuery.data
    ? rulesQuery.data.slice(0, 5).map((r) => ({
        name: r.name.substring(0, 15),
        successRate: typeof r.successRate === "number" ? r.successRate * 100 : 0,
        priority: r.priority,
      }))
    : [];

  const maturityData = metricsQuery.data
    ? [
        { name: "Madurez", value: metricsQuery.data.systemMaturity },
        { name: "Restante", value: 100 - metricsQuery.data.systemMaturity },
      ]
    : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">
                Agent00 - Copiloto Maestro Pro
              </h1>
              <p className="text-slate-400">
                Motor inteligente de decisiones con evolución adaptativa
              </p>
            </div>
            <div className="flex items-center gap-4">
              {systemStateQuery.data && (
                <Badge className="bg-blue-600 text-white px-4 py-2">
                  Modo: {systemStateQuery.data.mode}
                </Badge>
              )}
              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4 mr-2" />
                Configuración
              </Button>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-slate-800 border-slate-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Reglas Activas</p>
                <p className="text-3xl font-bold text-white">
                  {rulesQuery.data?.filter((r) => r.active).length || 0}
                </p>
              </div>
              <Brain className="w-8 h-8 text-blue-500" />
            </div>
          </Card>

          <Card className="bg-slate-800 border-slate-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Interacciones</p>
                <p className="text-3xl font-bold text-white">
                  {interactionsQuery.data?.length || 0}
                </p>
              </div>
              <Activity className="w-8 h-8 text-green-500" />
            </div>
          </Card>

          <Card className="bg-slate-800 border-slate-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Patrones</p>
                <p className="text-3xl font-bold text-white">
                  {patternsQuery.data?.length || 0}
                </p>
              </div>
              <Zap className="w-8 h-8 text-yellow-500" />
            </div>
          </Card>

          <Card className="bg-slate-800 border-slate-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Madurez</p>
                <p className="text-3xl font-bold text-white">
                  {metricsQuery.data?.systemMaturity.toFixed(0) || 0}%
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-purple-500" />
            </div>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-8 bg-slate-800 border-slate-700">
            <TabsTrigger value="overview">Estado</TabsTrigger>
            <TabsTrigger value="decisions">Decisiones</TabsTrigger>
            <TabsTrigger value="patterns">Patrones</TabsTrigger>
            <TabsTrigger value="evolution">Evolución</TabsTrigger>
            <TabsTrigger value="monitoring">Monitoreo</TabsTrigger>
            <TabsTrigger value="history">Historial</TabsTrigger>
            <TabsTrigger value="terminal">Terminal</TabsTrigger>
            <TabsTrigger value="settings">Config</TabsTrigger>
          </TabsList>

          {/* Tab 1: Overview */}
          <TabsContent value="overview" className="space-y-4 mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-slate-800 border-slate-700 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">
                  Distribución de Reglas
                </h3>
                {ruleStats.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={ruleStats}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${name}: ${value}`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {ruleStats.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-300 flex items-center justify-center text-slate-400">
                    Sin datos
                  </div>
                )}
              </Card>

              <Card className="bg-slate-800 border-slate-700 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">
                  Madurez del Sistema
                </h3>
                {maturityData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={maturityData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {maturityData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={index === 0 ? "#3b82f6" : "#1f2937"}
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-300 flex items-center justify-center text-slate-400">
                    Sin datos
                  </div>
                )}
              </Card>
            </div>
          </TabsContent>

          {/* Tab 2: Decisions */}
          <TabsContent value="decisions" className="space-y-4 mt-6">
            <Card className="bg-slate-800 border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">
                Performance de Reglas
              </h3>
              {performanceData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={performanceData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="name" stroke="#9ca3af" />
                    <YAxis stroke="#9ca3af" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1f2937",
                        border: "1px solid #374151",
                      }}
                    />
                    <Legend />
                    <Bar dataKey="successRate" fill="#3b82f6" />
                    <Bar dataKey="priority" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-300 flex items-center justify-center text-slate-400">
                  Sin datos
                </div>
              )}
            </Card>
          </TabsContent>

          {/* Tab 3: Patterns */}
          <TabsContent value="patterns" className="space-y-4 mt-6">
            <Card className="bg-slate-800 border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">
                Patrones Detectados
              </h3>
              {patternsQuery.data && patternsQuery.data.length > 0 ? (
                <div className="space-y-3">
                  {patternsQuery.data.slice(0, 5).map((pattern) => (
                    <div
                      key={pattern.id}
                      className="flex items-center justify-between p-3 bg-slate-700 rounded"
                    >
                      <div>
                        <p className="text-white font-medium">{pattern.name}</p>
                        <p className="text-slate-400 text-sm">
                          {pattern.description}
                        </p>
                      </div>
                      <Badge className="bg-blue-600">
                        {(
                          (typeof pattern.confidence === "string"
                            ? parseFloat(pattern.confidence)
                            : pattern.confidence) * 100
                        ).toFixed(0)}
                        %
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400">No hay patrones detectados</p>
              )}
            </Card>
          </TabsContent>

          {/* Tab 4: Evolution */}
          <TabsContent value="evolution" className="space-y-4 mt-6">
            <Card className="bg-slate-800 border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">
                Eventos de Evolución
              </h3>
              <p className="text-slate-400">
                Ciclos de evolución y cambios en reglas
              </p>
            </Card>
          </TabsContent>

          {/* Tab 5: Monitoring */}
          <TabsContent value="monitoring" className="space-y-4 mt-6">
            <Card className="bg-slate-800 border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">
                Monitoreo del Sistema
              </h3>
              <p className="text-slate-400">Métricas en tiempo real</p>
            </Card>
          </TabsContent>

          {/* Tab 6: History */}
          <TabsContent value="history" className="space-y-4 mt-6">
            <Card className="bg-slate-800 border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">
                Historial de Interacciones
              </h3>
              {interactionsQuery.data && interactionsQuery.data.length > 0 ? (
                <div className="space-y-2">
                  {interactionsQuery.data.slice(0, 5).map((interaction) => (
                    <div
                      key={interaction.id}
                      className="p-3 bg-slate-700 rounded text-sm"
                    >
                      <p className="text-white">
                        <span className="font-medium">{interaction.type}:</span>{" "}
                        {interaction.description}
                      </p>
                      <p className="text-slate-400 text-xs mt-1">
                        {new Date(interaction.timestamp).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400">No hay interacciones</p>
              )}
            </Card>
          </TabsContent>

          {/* Tab 7: Terminal */}
          <TabsContent value="terminal" className="space-y-4 mt-6">
            <div className="h-96">
              <CopilotTerminal />
            </div>
          </TabsContent>

          {/* Tab 8: Settings */}
          <TabsContent value="settings" className="space-y-4 mt-6">
            <Card className="bg-slate-800 border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">
                Configuración del Sistema
              </h3>
              <p className="text-slate-400">
                Opciones de configuración y preferencias
              </p>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
