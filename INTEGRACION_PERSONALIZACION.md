# Integración del Sistema de Personalización

## Resumen

Se ha integrado exitosamente el sistema de personalización en el proyecto Agent00. Este sistema permite a los usuarios personalizar el comportamiento del Copiloto Maestro según sus necesidades específicas.

## Archivos Integrados

### Estructura de Directorios

```
client/src/personalization/
├── PersonalizedCopilot.tsx          # Componente principal integrado
├── README.md                        # Documentación del módulo
├── index.ts                         # Exports públicos
├── components/
│   ├── CredentialPanel.tsx         # Panel de gestión de credenciales
│   ├── PluginManager.tsx           # Gestor de plugins
│   └── SetupWizard.tsx             # Wizard de configuración inicial
└── lib/
    ├── credential-manager.ts        # Gestión de credenciales
    ├── documentation-importer.ts    # Importador de documentación
    ├── examples.ts                  # Ejemplos de uso
    ├── mcp-connector.ts             # Conectores MCP
    ├── personalization-types.ts     # Tipos TypeScript
    └── plugin-registry.ts           # Sistema de plugins
```

### Archivos Modificados

1. **client/src/App.tsx**
   - Se agregó import del componente `PersonalizedCopilot`
   - Se agregó ruta `/personalized` para acceder al sistema de personalización

## Características Implementadas

### 1. Sistema de Gestión de Credenciales
- Almacenamiento seguro de credenciales para servicios externos
- Plantillas predefinidas para servicios comunes (GitHub, Notion, Slack, etc.)
- Interfaz de usuario para gestionar credenciales

### 2. Sistema de Plugins
- Arquitectura extensible que permite agregar funcionalidades
- Hooks para eventos del sistema (onDecision, onInteraction, onEvolution)
- Capacidad de contribuir reglas personalizadas

### 3. Conectores MCP (Model Context Protocol)
- Integración con servicios externos (NotebookLM, GitHub, Notion, Confluence)
- Enriquecimiento de contexto de decisiones con información externa
- Sincronización automática de interacciones

### 4. Importador de Documentación
- Extracción automática de reglas desde documentación
- Soporte para Markdown, PDF y texto plano
- Procesamiento opcional con IA (Anthropic Claude)

### 5. Wizard de Configuración
- Proceso guiado de configuración inicial en 6 pasos
- Selección de rol y nivel de experiencia
- Importación de conocimiento base
- Conexión con servicios externos

## Cómo Usar

### Acceso al Sistema

1. Navegar a `http://localhost:5000/personalized` (o el puerto configurado)
2. Si es la primera vez, aparecerá el wizard de configuración
3. Completar los 6 pasos del wizard:
   - Paso 1: Selección de rol y experiencia
   - Paso 2: Fuentes de conocimiento
   - Paso 3: Importar documentación
   - Paso 4: Reglas personalizadas
   - Paso 5: Conectores MCP
   - Paso 6: Resumen y finalización

### Uso Programático

```typescript
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

  // Usar las funciones según necesidad
}
```

## Próximos Pasos de Integración

### Tareas Pendientes

1. **Conectar con el Estado Global**
   - Reemplazar el `useAppState` temporal en `PersonalizedCopilot.tsx`
   - Integrar con el store/context existente del proyecto

2. **Integrar Motores Existentes**
   - Conectar con `DecisionEngine` de `server/engines/decision-engine.ts`
   - Conectar con `PatternDetector` de `server/engines/pattern-detector.ts`
   - Conectar con `EvolutionEngine` de `server/engines/evolution-engine.ts`

3. **Implementar Encriptación**
   - Agregar encriptación real para credenciales (actualmente es simulada)
   - Usar Web Crypto API o una librería como `crypto-js`

4. **Agregar Tests**
   - Tests unitarios para cada módulo
   - Tests de integración para el flujo completo
   - Tests E2E para el wizard

5. **Mejorar UI/UX**
   - Aplicar el sistema de diseño existente (Tailwind CSS)
   - Integrar con los componentes UI de shadcn/ui
   - Agregar animaciones y transiciones

6. **Documentación Adicional**
   - Guía de creación de plugins
   - Ejemplos de conectores MCP personalizados
   - Mejores prácticas de configuración

## Notas Técnicas

### Dependencias Requeridas

El sistema utiliza las siguientes dependencias que ya están en el proyecto:
- React 18+
- TypeScript 4.5+
- Wouter (routing)

### Compatibilidad

- Compatible con la arquitectura existente de Agent00
- No rompe funcionalidad existente
- Se puede usar independientemente o junto con el dashboard principal

### Seguridad

- Las credenciales se almacenan en localStorage (temporal)
- Se recomienda implementar encriptación antes de producción
- Los conectores MCP requieren credenciales válidas

## Soporte

Para preguntas o problemas relacionados con la integración:
1. Revisar la documentación en `client/src/personalization/README.md`
2. Consultar los ejemplos en `client/src/personalization/lib/examples.ts`
3. Revisar este documento de integración

## Changelog

### v1.0.0 - Integración Inicial
- ✅ Estructura de directorios creada
- ✅ Archivos de personalización movidos
- ✅ Componentes UI integrados
- ✅ Ruta agregada en App.tsx
- ✅ Sistema de tipos completo
- ✅ Documentación básica incluida
- ⏳ Integración con motores pendiente
- ⏳ Encriptación real pendiente
- ⏳ Tests pendientes
