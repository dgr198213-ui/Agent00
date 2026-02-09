// ============================================
// PLUGIN REGISTRY - SISTEMA DE PLUGINS
// ============================================

import { CopilotPlugin, PluginRegistry as IPluginRegistry } from './personalization-types';
import { InteractionLog, DecisionContext, Pattern, Rule } from './types';

/**
 * Registry central de plugins
 */
export class PluginRegistry implements IPluginRegistry {
  private static instance: PluginRegistry;
  plugins: Map<string, CopilotPlugin> = new Map();
  
  private constructor() {
    this.loadPlugins();
  }
  
  static getInstance(): PluginRegistry {
    if (!PluginRegistry.instance) {
      PluginRegistry.instance = new PluginRegistry();
    }
    return PluginRegistry.instance;
  }
  
  // ============================================
  // GESTIÓN DE PLUGINS
  // ============================================
  
  async register(plugin: CopilotPlugin): Promise<void> {
    // Validar plugin
    if (!plugin.id || !plugin.name || !plugin.version) {
      throw new Error('Plugin inválido: falta id, name o version');
    }
    
    // Verificar permisos
    if (plugin.requires?.permissions) {
      const granted = await this.requestPermissions(plugin.requires.permissions);
      if (!granted) {
        throw new Error('Permisos denegados');
      }
    }
    
    // Ejecutar hook onInstall
    if (plugin.hooks?.onInstall) {
      await plugin.hooks.onInstall();
    }
    
    // Registrar plugin
    this.plugins.set(plugin.id, {
      ...plugin,
      installed: true,
      installedAt: new Date().toISOString(),
    });
    
    await this.savePlugins();
    
    console.log(`✅ Plugin registrado: ${plugin.name} v${plugin.version}`);
  }
  
  async unregister(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return;
    
    // Ejecutar hook onUninstall
    if (plugin.hooks?.onUninstall) {
      await plugin.hooks.onUninstall();
    }
    
    this.plugins.delete(pluginId);
    await this.savePlugins();
    
    console.log(`❌ Plugin desinstalado: ${plugin.name}`);
  }
  
  get(pluginId: string): CopilotPlugin | undefined {
    return this.plugins.get(pluginId);
  }
  
  getAll(): CopilotPlugin[] {
    return Array.from(this.plugins.values());
  }
  
  getEnabled(): CopilotPlugin[] {
    return this.getAll().filter(p => p.enabled);
  }
  
  getByCategory(category: string): CopilotPlugin[] {
    return this.getAll().filter(p => p.category === category);
  }
  
  async enable(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return;
    
    // Ejecutar hook onEnable
    if (plugin.hooks?.onEnable) {
      await plugin.hooks.onEnable();
    }
    
    plugin.enabled = true;
    await this.savePlugins();
    
    console.log(`✅ Plugin habilitado: ${plugin.name}`);
  }
  
  async disable(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return;
    
    // Ejecutar hook onDisable
    if (plugin.hooks?.onDisable) {
      await plugin.hooks.onDisable();
    }
    
    plugin.enabled = false;
    await this.savePlugins();
    
    console.log(`⏸️ Plugin deshabilitado: ${plugin.name}`);
  }
  
  // ============================================
  // HOOKS DEL CICLO DE VIDA
  // ============================================
  
  async executeHook(hookName: string, ...args: any[]): Promise<void> {
    const enabledPlugins = this.getEnabled();
    
    for (const plugin of enabledPlugins) {
      if (!plugin.hooks) continue;
      
      try {
        switch (hookName) {
          case 'onInteraction':
            if (plugin.hooks.onInteraction) {
              await plugin.hooks.onInteraction(args[0] as InteractionLog);
            }
            break;
          
          case 'onDecision':
            if (plugin.hooks.onDecision) {
              await plugin.hooks.onDecision(args[0] as DecisionContext);
            }
            break;
          
          case 'onPatternDetected':
            if (plugin.hooks.onPatternDetected) {
              await plugin.hooks.onPatternDetected(args[0] as Pattern);
            }
            break;
          
          case 'onRuleCreated':
            if (plugin.hooks.onRuleCreated) {
              await plugin.hooks.onRuleCreated(args[0] as Rule);
            }
            break;
        }
      } catch (error) {
        console.error(`Error ejecutando hook ${hookName} en plugin ${plugin.name}:`, error);
      }
    }
  }
  
  // ============================================
  // CONTRIBUCIONES DE PLUGINS
  // ============================================
  
  /**
   * Obtiene todas las reglas contribuidas por plugins
   */
  getContributedRules(): Rule[] {
    const rules: Rule[] = [];
    
    this.getEnabled().forEach(plugin => {
      if (plugin.contributes?.rules) {
        rules.push(...plugin.contributes.rules);
      }
    });
    
    return rules;
  }
  
  /**
   * Obtiene todos los dominios contribuidos
   */
  getContributedDomains(): string[] {
    const domains = new Set<string>();
    
    this.getEnabled().forEach(plugin => {
      if (plugin.contributes?.domains) {
        plugin.contributes.domains.forEach(d => domains.add(d));
      }
    });
    
    return Array.from(domains);
  }
  
  /**
   * Obtiene comandos contribuidos
   */
  getContributedCommands() {
    const commands = new Map<string, any>();
    
    this.getEnabled().forEach(plugin => {
      if (plugin.contributes?.commands) {
        plugin.contributes.commands.forEach(cmd => {
          commands.set(cmd.id, cmd);
        });
      }
    });
    
    return commands;
  }
  
  // ============================================
  // PERSISTENCIA
  // ============================================
  
  private async savePlugins(): Promise<void> {
    const data = Array.from(this.plugins.entries()).map(([id, plugin]) => ({
      id,
      enabled: plugin.enabled,
      installed: plugin.installed,
      installedAt: plugin.installedAt,
      config: plugin.config,
    }));
    
    localStorage.setItem('copilot_plugins', JSON.stringify(data));
  }
  
  private loadPlugins(): void {
    const stored = localStorage.getItem('copilot_plugins');
    if (!stored) return;
    
    try {
      const data = JSON.parse(stored);
      // Note: Esta es una carga parcial, los plugins completos
      // deben ser registrados explícitamente por el código
      data.forEach((item: any) => {
        if (this.plugins.has(item.id)) {
          const plugin = this.plugins.get(item.id)!;
          plugin.enabled = item.enabled;
          plugin.installed = item.installed;
          plugin.installedAt = item.installedAt;
          plugin.config = item.config;
        }
      });
    } catch (error) {
      console.error('Error cargando plugins:', error);
    }
  }
  
  // ============================================
  // PERMISOS
  // ============================================
  
  private async requestPermissions(permissions: string[]): Promise<boolean> {
    // En producción, esto mostraría un diálogo al usuario
    // Por ahora, auto-aprobar
    console.log('Permisos solicitados:', permissions);
    return true;
  }
  
  // ============================================
  // ACTUALIZACIÓN DE CONFIGURACIÓN
  // ============================================
  
  async updatePluginConfig(pluginId: string, config: Record<string, any>): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return;
    
    plugin.config = { ...plugin.config, ...config };
    await this.savePlugins();
  }
}

// ============================================
// PLUGINS BUILT-IN
// ============================================

import { NotebookLMConnector, GitHubConnector, CustomAPIConnector } from './mcp-connector';
import { AIDocumentationImporter, MarkdownImporter } from './documentation-importer';

/**
 * Registra plugins por defecto
 */
export function registerBuiltInPlugins(registry: PluginRegistry): void {
  // Importar y registrar plugins core
  try {
    const { registerCorePlugins } = require('../plugins/core');
    registerCorePlugins(registry);
  } catch (error) {
    console.warn('No se pudieron cargar los plugins core:', error);
  }
  
  // Plugin: Conector NotebookLM
  registry.register({
    id: 'notebooklm-connector',
    name: 'NotebookLM Connector',
    version: '1.0.0',
    author: 'Copilot Team',
    description: 'Conecta con tus cuadernos de NotebookLM para enriquecer decisiones con tu conocimiento',
    icon: '📓',
    category: 'connector',
    enabled: false,
    installed: false,
    settings: [
      {
        key: 'endpoint',
        label: 'API Endpoint',
        type: 'url',
        default: 'https://notebooklm.google.com/api/v1',
        required: true,
      },
      {
        key: 'autoSync',
        label: 'Sincronización Automática',
        type: 'boolean',
        default: true,
      },
      {
        key: 'syncInterval',
        label: 'Intervalo de Sync (minutos)',
        type: 'number',
        default: 60,
      },
    ],
    connector: new NotebookLMConnector(),
    requires: {
      permissions: ['network:external', 'credentials:manage'],
    },
  });
  
  // Plugin: Conector GitHub
  registry.register({
    id: 'github-connector',
    name: 'GitHub Connector',
    version: '1.0.0',
    author: 'Copilot Team',
    description: 'Aprende de tus commits, PRs e issues en GitHub',
    icon: '💻',
    category: 'connector',
    enabled: false,
    installed: false,
    settings: [
      {
        key: 'repos',
        label: 'Repositorios (separados por coma)',
        type: 'string',
        placeholder: 'user/repo1, user/repo2',
        required: true,
      },
      {
        key: 'trackCommits',
        label: 'Rastrear Commits',
        type: 'boolean',
        default: true,
      },
      {
        key: 'trackPRs',
        label: 'Rastrear Pull Requests',
        type: 'boolean',
        default: true,
      },
    ],
    connector: new GitHubConnector(),
    requires: {
      permissions: ['network:external', 'credentials:manage', 'write:interactions'],
    },
  });
  
  // Plugin: Importador de Documentación con IA
  registry.register({
    id: 'ai-doc-importer',
    name: 'AI Documentation Importer',
    version: '1.0.0',
    author: 'Copilot Team',
    description: 'Importa documentación y extrae reglas automáticamente usando IA',
    icon: '📄',
    category: 'importer',
    enabled: true,
    installed: true,
    settings: [
      {
        key: 'anthropicApiKey',
        label: 'Anthropic API Key (opcional)',
        type: 'password',
        description: 'Para extracción avanzada con Claude',
        required: false,
      },
      {
        key: 'autoActivateRules',
        label: 'Auto-activar reglas extraídas',
        type: 'boolean',
        default: false,
        description: 'Si está desactivado, requerirá revisión manual',
      },
    ],
    importer: new AIDocumentationImporter(),
    requires: {
      permissions: ['write:rules'],
    },
  });
  
  // Plugin: Importador Markdown
  registry.register({
    id: 'markdown-importer',
    name: 'Markdown Importer',
    version: '1.0.0',
    author: 'Copilot Team',
    description: 'Importa reglas desde archivos Markdown estructurados',
    icon: '📝',
    category: 'importer',
    enabled: true,
    installed: true,
    importer: new MarkdownImporter(),
  });
}
