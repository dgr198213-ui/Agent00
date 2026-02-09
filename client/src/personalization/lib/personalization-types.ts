// ============================================
// TIPOS PARA SISTEMA DE PERSONALIZACIÓN
// ============================================

import { Rule, InteractionLog, DecisionContext, Pattern } from './types';

// ============================================
// A) CONECTORES MCP
// ============================================

export interface MCPConnector {
  id: string;
  name: string;
  type: 'notebooklm' | 'github' | 'notion' | 'confluence' | 'custom';
  description: string;
  icon: string;
  
  // Configuración
  config: MCPConnectorConfig;
  
  // Estado
  enabled: boolean;
  connected: boolean;
  lastSync?: string;
  
  // Métodos
  connect(credentials: Record<string, string>): Promise<void>;
  disconnect(): Promise<void>;
  query(prompt: string, context?: any): Promise<MCPResponse>;
  addContext(data: any): Promise<void>;
  search(query: string): Promise<any[]>;
  sync(): Promise<void>;
}

export interface MCPConnectorConfig {
  endpoint?: string;
  requiresAuth: boolean;
  authType: 'api_key' | 'oauth' | 'bearer' | 'basic' | 'none';
  credentials?: {
    [key: string]: string; // Encriptadas
  };
  options?: {
    autoSync?: boolean;
    syncInterval?: number; // en minutos
    maxResults?: number;
  };
}

export interface MCPResponse {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    source: string;
    confidence: number;
    timestamp: string;
  };
}

// ============================================
// B) IMPORTADOR DE DOCUMENTACIÓN
// ============================================

export interface DocumentImporter {
  id: string;
  name: string;
  supportedFormats: string[];
  
  import(file: File | string): Promise<ImportResult>;
  extractRules(content: string): Promise<Rule[]>;
  validate(content: string): Promise<ValidationResult>;
}

export interface ImportResult {
  success: boolean;
  rulesExtracted: Rule[];
  domainsCreated: string[];
  patternsDetected: Pattern[];
  errors?: string[];
  warnings?: string[];
  metadata: {
    source: string;
    importedAt: string;
    fileSize: number;
    processingTime: number;
  };
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

// ============================================
// C) SISTEMA DE PLUGINS
// ============================================

export interface CopilotPlugin {
  // Metadata
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  icon: string;
  category: 'connector' | 'importer' | 'analyzer' | 'automation' | 'integration';
  
  // Requerimientos
  requires?: {
    minVersion?: string;
    dependencies?: string[];
    permissions?: PluginPermission[];
  };
  
  // Estado
  enabled: boolean;
  installed: boolean;
  installedAt?: string;
  
  // Configuración
  config?: Record<string, any>;
  settings?: PluginSetting[];
  
  // Hooks del ciclo de vida
  hooks?: {
    onInstall?: () => Promise<void>;
    onUninstall?: () => Promise<void>;
    onEnable?: () => Promise<void>;
    onDisable?: () => Promise<void>;
    onInteraction?: (interaction: InteractionLog) => Promise<void>;
    onDecision?: (context: DecisionContext) => Promise<PluginDecisionInput>;
    onPatternDetected?: (pattern: Pattern) => Promise<void>;
    onRuleCreated?: (rule: Rule) => Promise<void>;
  };
  
  // Contribuciones
  contributes?: {
    rules?: Rule[];
    domains?: string[];
    commands?: PluginCommand[];
    ui?: PluginUIContribution[];
  };
  
  // Conectores
  connector?: MCPConnector;
  importer?: DocumentImporter;
}

export type PluginPermission = 
  | 'read:interactions'
  | 'write:interactions'
  | 'read:rules'
  | 'write:rules'
  | 'read:patterns'
  | 'network:external'
  | 'storage:local'
  | 'credentials:manage';

export interface PluginSetting {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'password' | 'url';
  default?: any;
  required?: boolean;
  description?: string;
  options?: { label: string; value: any }[];
}

export interface PluginCommand {
  id: string;
  name: string;
  description: string;
  execute: (args?: any) => Promise<any>;
}

export interface PluginUIContribution {
  location: 'sidebar' | 'toolbar' | 'panel' | 'modal';
  component: React.ComponentType<any>;
  props?: Record<string, any>;
}

export interface PluginDecisionInput {
  additionalRules?: Rule[];
  contextEnrichment?: Record<string, any>;
  suggestions?: string[];
}

// ============================================
// D) PANEL DE CREDENCIALES
// ============================================

export interface CredentialStore {
  id: string;
  name: string;
  service: string;
  type: 'api_key' | 'oauth' | 'bearer' | 'basic' | 'custom';
  
  // Datos encriptados
  credentials: EncryptedCredentials;
  
  // Metadata
  createdAt: string;
  updatedAt?: string;
  expiresAt?: string;
  lastUsed?: string;
  
  // Estado
  valid: boolean;
  testConnection?: () => Promise<boolean>;
}

export interface EncryptedCredentials {
  encrypted: string; // Datos encriptados con AES-256
  iv: string;        // Vector de inicialización
  salt: string;      // Salt para derivar clave
}

export interface CredentialInput {
  name: string;
  service: string;
  type: 'api_key' | 'oauth' | 'bearer' | 'basic' | 'custom';
  fields: CredentialField[];
}

export interface CredentialField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'url' | 'textarea';
  placeholder?: string;
  required: boolean;
  validation?: (value: string) => boolean | string;
}

// ============================================
// CONFIGURACIÓN DE USUARIO
// ============================================

export interface UserAgentConfig {
  agentId: string;
  version: string;
  createdAt: string;
  updatedAt: string;
  
  // Perfil
  profile: {
    role: string;
    experience: 'junior' | 'mid' | 'senior' | 'expert';
    focus: string[];
    preferences: Record<string, any>;
  };
  
  // Plugins instalados
  plugins: {
    [pluginId: string]: {
      enabled: boolean;
      config: Record<string, any>;
      installedAt: string;
    };
  };
  
  // Reglas personalizadas
  customRules: Rule[];
  
  // Conectores MCP
  mcpConnectors: {
    [connectorId: string]: {
      enabled: boolean;
      credentialId: string;
      config: MCPConnectorConfig;
    };
  };
  
  // Conocimiento importado
  knowledge: {
    documents: {
      source: string;
      imported: string;
      rulesExtracted: number;
      hash: string; // Para detectar cambios
    }[];
    customDomains: {
      name: string;
      rules: string[];
    }[];
  };
}

// ============================================
// PLUGIN REGISTRY
// ============================================

export interface PluginRegistry {
  plugins: Map<string, CopilotPlugin>;
  
  register(plugin: CopilotPlugin): Promise<void>;
  unregister(pluginId: string): Promise<void>;
  get(pluginId: string): CopilotPlugin | undefined;
  getAll(): CopilotPlugin[];
  getEnabled(): CopilotPlugin[];
  getByCategory(category: string): CopilotPlugin[];
  
  enable(pluginId: string): Promise<void>;
  disable(pluginId: string): Promise<void>;
  
  executeHook(hookName: string, ...args: any[]): Promise<void>;
}
