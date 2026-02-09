# Sistema de Personalización del Agente

Este módulo proporciona capacidades de personalización avanzadas para el Copiloto Maestro, permitiendo a los usuarios adaptar el comportamiento del agente a sus necesidades específicas.

## Estructura

```
personalization/
├── lib/                          # Lógica de negocio
│   ├── personalization-types.ts  # Tipos TypeScript
│   ├── credential-manager.ts     # Gestión de credenciales
│   ├── plugin-registry.ts        # Sistema de plugins
│   ├── mcp-connector.ts          # Conectores MCP
│   ├── documentation-importer.ts # Importador de documentación
│   └── examples.ts               # Ejemplos de uso
├── components/                   # Componentes UI
│   ├── SetupWizard.tsx          # Wizard de configuración inicial
│   ├── CredentialPanel.tsx      # Panel de gestión de credenciales
│   └── PluginManager.tsx        # Gestor de plugins
├── PersonalizedCopilot.tsx      # Componente principal integrado
└── index.ts                     # Exports públicos
```

## Características Principales

### 1. Gestión de Credenciales
- Almacenamiento seguro de credenciales
- Plantillas para servicios comunes (GitHub, Notion, Slack, etc.)
- Encriptación local

### 2. Sistema de Plugins
- Arquitectura extensible de plugins
- Hooks para eventos del sistema
- Contribución de reglas personalizadas

### 3. Conectores MCP (Model Context Protocol)
- Integración con NotebookLM, GitHub, Notion
- Enriquecimiento de contexto de decisiones
- Sincronización automática

### 4. Importador de Documentación
- Extracción automática de reglas desde documentación
- Soporte para Markdown, PDF, texto plano
- Procesamiento con IA (opcional)

### 5. Wizard de Configuración
- Configuración guiada paso a paso
- Selección de rol y experiencia
- Importación de conocimiento base

## Uso

### Configuración Inicial

```tsx
import { PersonalizedCopilot } from '@/personalization';

function App() {
  return <PersonalizedCopilot />;
}
```

### Hook de Personalización

```tsx
import { usePersonalization } from '@/personalization';

function MyComponent() {
  const {
    config,
    isConfigured,
    evaluateDecision,
    recordInteraction,
    importDocumentation,
    connectMCP,
  } = usePersonalization();

  // Usar las funciones...
}
```

### Crear un Plugin Personalizado

```typescript
import { CopilotPlugin } from '@/personalization';

const myPlugin: CopilotPlugin = {
  id: 'my-plugin',
  name: 'Mi Plugin',
  version: '1.0.0',
  description: 'Plugin personalizado',
  
  hooks: {
    onDecision: async (context) => {
      console.log('Decisión:', context);
    },
    onInteraction: async (interaction) => {
      console.log('Interacción:', interaction);
    },
  },
  
  contributeRules: () => [
    {
      id: 'my-rule',
      name: 'Mi Regla',
      description: 'Regla personalizada',
      conditions: [
        { field: 'action.type', operator: 'equals', value: 'deploy' }
      ],
      actions: [
        { type: 'notify', message: 'Desplegando...' }
      ],
      priority: 50,
      active: true,
    }
  ],
};
```

### Conectar un Servicio MCP

```typescript
const result = await connectMCP('notebooklm', {
  apiKey: 'your-api-key',
}, {
  options: {
    autoSync: true,
    syncInterval: 300000, // 5 minutos
  }
});

if (result.success) {
  console.log('Conectado:', result.connector);
}
```

### Importar Documentación

```typescript
const result = await importDocumentation(file, anthropicApiKey);

if (result.success) {
  console.log(`Se agregaron ${result.rulesAdded} reglas`);
}
```

## Integración con el Copiloto Base

El sistema de personalización se integra con el Copiloto Maestro existente mediante:

1. **Hook `usePersonalization`**: Extiende el estado base del copiloto
2. **Enriquecimiento de contexto**: Agrega información de conectores MCP
3. **Reglas combinadas**: Base + personalizadas + plugins
4. **Sincronización**: Interacciones se sincronizan con servicios externos

## Rutas

- `/personalized` - Dashboard personalizado con wizard de configuración

## Dependencias

- React 18+
- TypeScript 4.5+
- Copiloto Maestro base (decision-engine, pattern-detector, evolution-engine)

## Próximos Pasos

1. Implementar encriptación de credenciales
2. Agregar más conectores MCP (Confluence, Slack, Linear)
3. Mejorar el importador de documentación con más formatos
4. Crear marketplace de plugins
5. Agregar tests unitarios y de integración

## Licencia

Mismo que el proyecto principal Agent00
