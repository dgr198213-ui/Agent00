import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import {
  Brain,
  Zap,
  TrendingUp,
  Shield,
  Code,
  BarChart3,
  ArrowRight,
  Sparkles,
} from "lucide-react";

export default function Home() {
  const { user, isAuthenticated, logout } = useAuth();
  const [, setLocation] = useLocation();

  const features = [
    {
      icon: Brain,
      title: "Motor de Decisiones",
      description:
        "Evaluador AST real que parsea y ejecuta condiciones complejas sin usar eval()",
    },
    {
      icon: Zap,
      title: "Detección de Patrones",
      description:
        "Análisis multi-dimensional: secuencial, temporal, frecuencia y contextual",
    },
    {
      icon: TrendingUp,
      title: "Evolución Adaptativa",
      description:
        "Sistema que aprende, analiza performance y propone mejoras automáticas",
    },
    {
      icon: Shield,
      title: "Reglas Categorizadas",
      description:
        "Safety, Productivity, Learning, Workflow - con modos basados en madurez",
    },
    {
      icon: Code,
      title: "API tRPC Completa",
      description: "Integración externa conectable para otros sistemas y servicios",
    },
    {
      icon: BarChart3,
      title: "Monitoreo en Tiempo Real",
      description:
        "Dashboard con 8 vistas: estado, decisiones, patrones, evolución y más",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Navigation */}
      <nav className="border-b border-slate-700 bg-slate-900/50 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-blue-500" />
            <h1 className="text-2xl font-bold text-white">Agent00</h1>
          </div>
          <div className="flex items-center gap-4">
            {isAuthenticated && user ? (
              <>
                <span className="text-slate-300">Hola, {user.name}</span>
                <Button
                  onClick={() => setLocation("/copilot")}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Ir al Copiloto
                </Button>
                <Button
                  onClick={() => logout()}
                  variant="outline"
                  className="border-slate-600 text-slate-300"
                >
                  Salir
                </Button>
              </>
            ) : (
              <Button
                onClick={() => {
                  window.location.href = getLoginUrl();
                }}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Iniciar Sesión
              </Button>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold text-white mb-4">
            Copiloto Maestro Pro
          </h2>
          <p className="text-xl text-slate-400 mb-8">
            Motor inteligente de decisiones con evolución adaptativa, detección
            de patrones y aprendizaje autónomo
          </p>
          {isAuthenticated ? (
            <Button
              onClick={() => setLocation("/copiloto")}
              size="lg"
              className="bg-blue-600 hover:bg-blue-700 text-white px-8"
            >
              Acceder al Dashboard <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          ) : (
            <Button
              onClick={() => {
                window.location.href = getLoginUrl();
              }}
              size="lg"
              className="bg-blue-600 hover:bg-blue-700 text-white px-8"
            >
              Comenzar Ahora <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          )}
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-20">
          {features.map((feature, idx) => {
            const Icon = feature.icon;
            return (
              <Card
                key={idx}
                className="bg-slate-800/50 border-slate-700 p-6 hover:border-blue-500 transition-colors"
              >
                <Icon className="w-8 h-8 text-blue-500 mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-slate-400">{feature.description}</p>
              </Card>
            );
          })}
        </div>

        {/* Capabilities Section */}
        <section className="bg-slate-800/50 border border-slate-700 rounded-lg p-12 mb-20">
          <h3 className="text-2xl font-bold text-white mb-8">
            Capacidades Principales
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h4 className="text-lg font-semibold text-blue-400 mb-4">
                🧠 Motor de Decisiones
              </h4>
              <ul className="space-y-2 text-slate-300">
                <li>✓ Parser AST real sin eval()</li>
                <li>✓ Evaluación de condiciones complejas</li>
                <li>✓ Contextos dinámicos</li>
                <li>✓ Métricas de ejecución</li>
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-semibold text-green-400 mb-4">
                ⚡ Detección de Patrones
              </h4>
              <ul className="space-y-2 text-slate-300">
                <li>✓ Patrones secuenciales</li>
                <li>✓ Análisis temporal</li>
                <li>✓ Detección de frecuencia</li>
                <li>✓ Análisis contextual</li>
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-semibold text-purple-400 mb-4">
                📈 Evolución Adaptativa
              </h4>
              <ul className="space-y-2 text-slate-300">
                <li>✓ Análisis de performance</li>
                <li>✓ Recomendaciones automáticas</li>
                <li>✓ Generación de nuevas reglas</li>
                <li>✓ Variantes en shadow mode</li>
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-semibold text-yellow-400 mb-4">
                🔧 Persistencia y API
              </h4>
              <ul className="space-y-2 text-slate-300">
                <li>✓ Base de datos MySQL/TiDB</li>
                <li>✓ API tRPC completa</li>
                <li>✓ Backups automáticos</li>
                <li>✓ Versionado de schemas</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Terminal Preview */}
        <section className="bg-slate-950 border border-slate-700 rounded-lg p-8 mb-20">
          <h3 className="text-2xl font-bold text-white mb-4">
            Terminal Interactiva
          </h3>
          <div className="bg-slate-900 rounded font-mono text-sm text-green-400 p-4 overflow-x-auto">
            <div>$ agent00 --help</div>
            <div className="text-slate-400">
              <div>Comandos disponibles:</div>
              <div>  status      - Mostrar estado del sistema</div>
              <div>  stats       - Mostrar estadísticas</div>
              <div>  rules       - Listar reglas activas</div>
              <div>  patterns    - Mostrar patrones detectados</div>
              <div>  decide      - Evaluar decisión</div>
              <div>  evolve      - Ejecutar ciclo de evolución</div>
              <div>  backup      - Crear backup</div>
              <div>  clear       - Limpiar terminal</div>
            </div>
          </div>
        </section>

        {/* Dashboard Preview */}
        <section className="mb-20">
          <h3 className="text-2xl font-bold text-white mb-8">
            Dashboard con 8 Vistas
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              "Estado",
              "Decisiones",
              "Patrones",
              "Evolución",
              "Monitoreo",
              "Historial",
              "Terminal",
              "Configuración",
            ].map((view) => (
              <Card
                key={view}
                className="bg-slate-800 border-slate-700 p-4 text-center hover:border-blue-500 transition-colors"
              >
                <p className="text-white font-medium">{view}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="text-center py-12">
          <h3 className="text-3xl font-bold text-white mb-4">
            ¿Listo para comenzar?
          </h3>
          <p className="text-slate-400 mb-8">
            Accede al dashboard y comienza a crear reglas inteligentes
          </p>
          {isAuthenticated ? (
            <Button
              onClick={() => setLocation("/copiloto")}
              size="lg"
              className="bg-blue-600 hover:bg-blue-700 text-white px-8"
            >
              Ir al Copiloto <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          ) : (
            <Button
              onClick={() => {
                window.location.href = getLoginUrl();
              }}
              size="lg"
              className="bg-blue-600 hover:bg-blue-700 text-white px-8"
            >
              Iniciar Sesión <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          )}
        </section>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-700 bg-slate-900/50 py-8">
        <div className="max-w-7xl mx-auto px-6 text-center text-slate-400">
          <p>Agent00 - Copiloto Maestro Pro v1.0.0</p>
          <p className="text-sm mt-2">
            Motor inteligente de decisiones con evolución adaptativa
          </p>
        </div>
      </footer>
    </div>
  );
}
