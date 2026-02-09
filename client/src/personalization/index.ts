// ============================================
// EXPORTS DEL SISTEMA DE PERSONALIZACIÓN
// ============================================

// Tipos
export * from './lib/personalization-types';

// Gestores
export { CredentialManager, CREDENTIAL_TEMPLATES } from './lib/credential-manager';
export { PluginRegistry, registerBuiltInPlugins } from './lib/plugin-registry';
export { MCPConnectorFactory } from './lib/mcp-connector';
export { AIDocumentationImporter } from './lib/documentation-importer';

// Componentes
export { SetupWizard } from './components/SetupWizard';
export { CredentialPanel } from './components/CredentialPanel';
export { PluginManager } from './components/PluginManager';

// Hook principal y componente integrado
export { usePersonalization, PersonalizedCopilot } from './PersonalizedCopilot';
