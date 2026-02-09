// ============================================
// INTEGRACIÓN COMPLETA DEL SISTEMA
// ============================================

/**
 * Este archivo demuestra cómo integrar todo el sistema de personalización
 * con el Copiloto Maestro existente.
 */

import React, { useState, useEffect } from 'react';

// Importar tipos
import { UserAgentConfig, CopilotPlugin, MCPConnector } from './lib/personalization-types';

// Importar gestores
import { CredentialManager } from './lib/credential-manager';
import { PluginRegistry, registerBuiltInPlugins } from './lib/plugin-registry';
import { MCPConnectorFactory } from './lib/mcp-connector';
import { AIDocumentationImporter } from './lib/documentation-importer';

// Importar componentes UI
import { SetupWizard } from './components/SetupWizard';
import { CredentialPanel } from './components/CredentialPanel';
import { PluginManager } from './components/PluginManager';

// Importar del Copiloto Maestro base
import { trpc } from '@/lib/trpc';

/**
 * Hook que conecta con el estado real del sistema Agent00 mediante tRPC
 */
function useAppState() {
  const rulesQuery = trpc.copilot.rules.list.useQuery();
  const utils = trpc.useUtils();
  const recordMutation = trpc.copilot.interactions.record.useMutation();

  return {
    rules: rulesQuery.data || [],
    decisionEngine: {
      evaluateRules: (rules: any[], context: any) => {
        // Lógica de evaluación local simplificada para feedback inmediato
        return rules.filter(r => {
          try {
            // Evaluación básica de condiciones (ejemplo simple)
            if (r.condition === 'true') return true;
            return context.action?.type === r.condition.split('==')[1]?.trim().replace(/'/g, '');
          } catch {
            return false;
          }
        });
      }
    },
    recordInteraction: async (type: string, description: string, outcome: any) => {
      const result = await recordMutation.mutateAsync({ type, description, outcome });
      utils.copilot.interactions.list.invalidate();
      return result;
    },
    isLoading: rulesQuery.isLoading
  };
}

// ============================================
// HOOK PERSONALIZADO: usePersonalization
// ============================================

/**
 * Hook que integra el sistema de personalización con el copiloto base
 */
export function usePersonalization() {
  const baseState = useAppState(); // Estado del copiloto base
  const [config, setConfig] = useState<UserAgentConfig | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [registry] = useState(() => {
    const reg = PluginRegistry.getInstance();
    registerBuiltInPlugins(reg);
    return reg;
  });
  
  // Cargar configuración guardada
  useEffect(() => {
    const savedConfig = localStorage.getItem('user_agent_config');
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        setConfig(parsed);
        setIsConfigured(true);
      } catch (error) {
        console.error('Error cargando configuración:', error);
      }
    }
  }, []);
  
  // Guardar configuración cuando cambia
  const saveConfig = (newConfig: UserAgentConfig) => {
    setConfig(newConfig);
    setIsConfigured(true);
    localStorage.setItem('user_agent_config', JSON.stringify(newConfig));
  };
  
  // ============================================
  // ENRIQUECER DECISIONES CON MCP
  // ============================================
  
  /**
   * Enriquece el contexto de decisión con conocimiento de conectores MCP
   */
  const enrichDecisionContext = async (context: any) => {
    const enrichedContext = { ...context };
    
    // Obtener conectores habilitados
    const connectors = MCPConnectorFactory.getConnected();
    
    // Consultar cada conector
    for (const connector of connectors) {
      try {
        const prompt = `
          Contexto de decisión:
          Acción: ${JSON.stringify(context.action)}
          
          ¿Qué información relevante tienes sobre esta acción?
        `;
        
        const response = await connector.query(prompt, context);
        
        if (response.success) {
          enrichedContext[`mcp_${connector.id}`] = response.data;
        }
      } catch (error) {
        console.error(`Error consultando ${connector.name}:`, error);
      }
    }
    
    return enrichedContext;
  };
  
  // ============================================
  // EVALUAR DECISIÓN MEJORADA
  // ============================================
  
  /**
   * Evalúa decisión usando reglas base + personalizadas + conocimiento MCP
   */
  const evaluateDecisionEnhanced = async (context: any) => {
    // 1. Enriquecer contexto con MCP
    const enrichedContext = await enrichDecisionContext(context);
    
    // 2. Obtener reglas base
    const baseRules = baseState.rules;
    
    // 3. Agregar reglas personalizadas del usuario
    const customRules = config?.customRules || [];
    
    // 4. Agregar reglas contribuidas por plugins
    const pluginRules = registry.getContributedRules();
    
    // 5. Combinar todas las reglas
    const allRules = [...baseRules, ...customRules, ...pluginRules];
    
    // 6. Evaluar con el motor de decisiones
    const results = baseState.decisionEngine.evaluateRules(allRules, enrichedContext);
    
    // 7. Ejecutar hooks de plugins
    await registry.executeHook('onDecision', enrichedContext);
    
    return {
      results,
      enrichedContext,
      rulesUsed: {
        base: baseRules.length,
        custom: customRules.length,
        plugins: pluginRules.length,
      },
    };
  };
  
  // ============================================
  // REGISTRAR INTERACCIÓN MEJORADA
  // ============================================
  
  /**
   * Registra interacción y sincroniza con conectores MCP
   */
  const recordInteractionEnhanced = async (
    type: string,
    description: string,
    outcome?: string
  ) => {
    // 1. Registrar en el copiloto base
    const interaction = baseState.recordInteraction(type, description, outcome);
    
    // 2. Ejecutar hooks de plugins
    await registry.executeHook('onInteraction', interaction);
    
    // 3. Sincronizar con conectores MCP (si configurado)
    const connectors = MCPConnectorFactory.getConnected();
    for (const connector of connectors) {
      if (connector.config.options?.autoSync) {
        try {
          await connector.addContext({
            type: 'interaction',
            data: interaction,
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          console.error(`Error sincronizando con ${connector.name}:`, error);
        }
      }
    }
    
    return interaction;
  };
  
  // ============================================
  // IMPORTAR DOCUMENTACIÓN
  // ============================================
  
  /**
   * Importa documentación y actualiza configuración
   */
  const importDocumentation = async (file: File, anthropicApiKey?: string) => {
    const importer = new AIDocumentationImporter(anthropicApiKey);
    
    try {
      const result = await importer.import(file);
      
      if (result.success && config) {
        // Agregar reglas extraídas a la configuración
        const updatedConfig = {
          ...config,
          customRules: [...config.customRules, ...result.rulesExtracted],
          knowledge: {
            ...config.knowledge,
            documents: [
              ...config.knowledge.documents,
              {
                source: file.name,
                imported: new Date().toISOString(),
                rulesExtracted: result.rulesExtracted.length,
                hash: '', // TODO: Calcular hash del archivo
              },
            ],
          },
        };
        
        saveConfig(updatedConfig);
        
        return {
          success: true,
          rulesAdded: result.rulesExtracted.length,
          result,
        };
      }
      
      return { success: false, error: 'No se pudieron extraer reglas' };
    } catch (error) {
      console.error('Error importando documentación:', error);
      return { success: false, error: error.message };
    }
  };
  
  // ============================================
  // CONECTAR MCP
  // ============================================
  
  /**
   * Conecta un servicio MCP
   */
  const connectMCP = async (
    type: MCPConnector['type'],
    credentials: Record<string, string>,
    connectorConfig?: any
  ) => {
    try {
      const connector = MCPConnectorFactory.create(type, connectorConfig);
      await connector.connect(credentials);
      
      // Actualizar configuración
      if (config) {
        const updatedConfig = {
          ...config,
          mcpConnectors: {
            ...config.mcpConnectors,
            [connector.id]: {
              enabled: true,
              credentialId: connector.id,
              config: connector.config,
            },
          },
        };
        
        saveConfig(updatedConfig);
      }
      
      return { success: true, connector };
    } catch (error) {
      console.error('Error conectando MCP:', error);
      return { success: false, error: error.message };
    }
  };
  
  // ============================================
  // RETORNAR API
  // ============================================
  
  return {
    // Estado
    config,
    isConfigured,
    registry,
    
    // Acciones base (del copiloto original)
    ...baseState,
    
    // Acciones mejoradas
    evaluateDecision: evaluateDecisionEnhanced,
    recordInteraction: recordInteractionEnhanced,
    
    // Nuevas acciones
    saveConfig,
    importDocumentation,
    connectMCP,
    enrichDecisionContext,
  };
}

// ============================================
// COMPONENTE PRINCIPAL INTEGRADO
// ============================================

export function PersonalizedCopilot() {
  // Inyectar estilos dinámicamente
  useEffect(() => {
    const styleId = 'personalized-copilot-styles';
    if (!document.getElementById(styleId)) {
      const styleElement = document.createElement('style');
      styleElement.id = styleId;
      styleElement.innerHTML = personalizedCopilotStyles;
      document.head.appendChild(styleElement);
    }
  }, []);

  const {
    isConfigured,
    config,
    saveConfig,
    evaluateDecision,
    recordInteraction,
    importDocumentation,
    connectMCP,
    // ... resto del estado
  } = usePersonalization();
  
  const [currentView, setCurrentView] = useState<
    'dashboard' | 'credentials' | 'plugins' | 'terminal' | 'evolution' | 'settings'
  >('dashboard');
  
  // Mostrar wizard si no está configurado
  if (!isConfigured) {
    return <SetupWizard onComplete={saveConfig} />;
  }
  
  return (
    <div className="personalized-copilot">
      <nav className="main-nav">
        <div className="nav-brand">
          <h1>🤖 {config?.profile.role || 'Mi Agente'}</h1>
          <span className="config-badge">{config?.version}</span>
        </div>
        
        <div className="nav-links">
          <button
            className={currentView === 'dashboard' ? 'active' : ''}
            onClick={() => setCurrentView('dashboard')}
          >
            🏠 Dashboard
          </button>
          <button
            className={currentView === 'terminal' ? 'active' : ''}
            onClick={() => setCurrentView('terminal')}
          >
            💻 Terminal
          </button>
          <button
            className={currentView === 'evolution' ? 'active' : ''}
            onClick={() => setCurrentView('evolution')}
          >
            🧬 Evolución
          </button>
          <button
            className={currentView === 'credentials' ? 'active' : ''}
            onClick={() => setCurrentView('credentials')}
          >
            🔐 Credenciales
          </button>
          <button
            className={currentView === 'plugins' ? 'active' : ''}
            onClick={() => setCurrentView('plugins')}
          >
            🔌 Plugins
          </button>
          <button
            className={currentView === 'settings' ? 'active' : ''}
            onClick={() => setCurrentView('settings')}
          >
            ⚙️ Ajustes
          </button>
        </div>
      </nav>
      
      <main className="main-content">
        {currentView === 'dashboard' && (
          <Dashboard
            config={config}
            onEvaluate={evaluateDecision}
            onRecord={recordInteraction}
          />
        )}
        
        {currentView === 'terminal' && (
          <Terminal
            onCommand={(cmd, args) => {
              // Manejar comandos de terminal
              // Integrar con el terminal existente
            }}
          />
        )}
        
        {currentView === 'evolution' && (
          <Evolution
            // Componente de evolución del copiloto base
          />
        )}
        
        {currentView === 'credentials' && <CredentialPanel />}
        
        {currentView === 'plugins' && <PluginManager />}
        
        {currentView === 'settings' && (
          <div className="settings-view">
            <h2>Configuración del Agente</h2>
            <div className="settings-grid">
              <div className="settings-card">
                <h3>Perfil</h3>
                <p>Modifica tu rol y nivel de experiencia para ajustar las sugerencias.</p>
                <button onClick={() => {
                  if(confirm('¿Quieres reiniciar el asistente de configuración?')) {
                    localStorage.removeItem('user_agent_config');
                    window.location.reload();
                  }
                }} className="btn-danger">Reiniciar Configuración</button>
              </div>
              <div className="settings-card">
                <h3>Exportar Datos</h3>
                <p>Descarga un backup de tus reglas y configuraciones.</p>
                <button className="btn-secondary">Exportar JSON</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ============================================
// COMPONENTE: DASHBOARD PERSONALIZADO
// ============================================

function Dashboard({
  config,
  onEvaluate,
  onRecord,
}: {
  config: UserAgentConfig | null;
  onEvaluate: (context: any) => Promise<any>;
  onRecord: (type: string, desc: string, outcome?: string) => Promise<any>;
}) {
  const [testContext, setTestContext] = useState('');
  const [results, setResults] = useState<any>(null);
  
  const handleTest = async () => {
    try {
      const context = JSON.parse(testContext);
      const result = await onEvaluate(context);
      setResults(result);
    } catch (error) {
      alert('Error evaluando: ' + error.message);
    }
  };
  
  return (
    <div className="dashboard">
      <h2>Dashboard Personalizado</h2>
      
      <div className="profile-summary">
        <h3>Tu Perfil</h3>
        <p><strong>Rol:</strong> {config?.profile.role}</p>
        <p><strong>Experiencia:</strong> {config?.profile.experience}</p>
        <p><strong>Reglas activas:</strong> {config?.customRules.length}</p>
        <p><strong>Documentos importados:</strong> {config?.knowledge.documents.length}</p>
      </div>
      
      <div className="test-decision">
        <h3>Probar Decisión</h3>
        <textarea
          value={testContext}
          onChange={(e) => setTestContext(e.target.value)}
          placeholder='{"action":{"type":"deploy"},"target":"production"}'
          rows={5}
        />
        <button onClick={handleTest}>Evaluar</button>
        
        {results && (
          <div className="results">
            <h4>Resultados:</h4>
            <pre>{JSON.stringify(results, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

// Placeholder para otros componentes
function Terminal({ onCommand }: any) {
  return <div>Terminal Component (usar el existente)</div>;
}

function Evolution() {
  return <div>Evolution Component (usar el existente)</div>;
}

// ============================================
// ESTILOS
// ============================================

export const personalizedCopilotStyles = `
.personalized-copilot {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #0f172a;
  color: #f8fafc;
  font-family: 'Inter', system-ui, sans-serif;
}

.main-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  background: rgba(30, 41, 59, 0.8);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  position: sticky;
  top: 0;
  z-index: 100;
}

.nav-brand h1 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  background: linear-gradient(90deg, #60a5fa, #a78bfa);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.config-badge {
  font-size: 0.7rem;
  background: rgba(96, 165, 250, 0.1);
  color: #60a5fa;
  padding: 0.2rem 0.5rem;
  border-radius: 9999px;
  margin-left: 0.5rem;
  border: 1px solid rgba(96, 165, 250, 0.2);
}

.nav-links {
  display: flex;
  gap: 0.25rem;
  background: rgba(15, 23, 42, 0.5);
  padding: 0.25rem;
  border-radius: 8px;
}

.nav-links button {
  padding: 0.5rem 1rem;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  font-size: 0.9rem;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.nav-links button:hover {
  color: #f8fafc;
  background: rgba(255, 255, 255, 0.05);
}

.nav-links button.active {
  background: #3b82f6;
  color: white;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.main-content {
  flex: 1;
  overflow-y: auto;
  padding: 2rem;
  background: radial-gradient(circle at top right, rgba(59, 130, 246, 0.05), transparent);
}

.dashboard {
  max-width: 1000px;
  margin: 0 auto;
  display: grid;
  gap: 2rem;
}

.profile-summary, .test-decision, .settings-card {
  padding: 2rem;
  background: rgba(30, 41, 59, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 16px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
}

.profile-summary h3, .test-decision h3 {
  margin-top: 0;
  color: #60a5fa;
  font-size: 1.1rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.test-decision textarea {
  width: 100%;
  background: #0f172a;
  color: #e2e8f0;
  padding: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  font-family: 'Fira Code', monospace;
  margin-bottom: 1rem;
  resize: vertical;
}

.results {
  margin-top: 1.5rem;
  padding: 1.5rem;
  background: #020617;
  border-radius: 12px;
  border: 1px solid rgba(96, 165, 250, 0.2);
}

.results pre {
  margin: 0;
  font-size: 0.85rem;
  color: #93c5fd;
}

.btn-primary {
  background: #3b82f6;
  color: white;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  border: none;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary:hover {
  background: #2563eb;
  transform: translateY(-1px);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.05);
  color: #e2e8f0;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  font-weight: 600;
  cursor: pointer;
}

.btn-danger {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  border: 1px solid rgba(239, 68, 68, 0.2);
  font-weight: 600;
  cursor: pointer;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
}
`;
