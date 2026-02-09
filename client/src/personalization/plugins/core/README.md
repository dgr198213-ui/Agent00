# Core Plugins - Agent00

Este directorio contiene los plugins core que proporcionan autonomía fundamental al agente Agent00.

## Plugins Incluidos

### 1. File System MCP (`file-system-mcp.ts`)

Proporciona acceso seguro al sistema de archivos local.

**Características:**
- Lectura de archivos con validación de rutas
- Escritura de archivos con protección contra path traversal
- Listado de directorios
- Eliminación de archivos
- Búsqueda de archivos

**Seguridad:**
- Validación de rutas para prevenir path traversal
- Whitelist de extensiones permitidas
- Límite de tamaño de archivo
- Modo solo lectura opcional

**Uso:**
```typescript
const connector = new FileSystemMCPConnector({
  basePath: '/home/user/agent-data',
  allowedExtensions: ['.md', '.txt', '.json'],
  maxFileSize: 10 * 1024 * 1024,
  readOnly: false
});

const result = await connector.readFile('documents/guide.md');
```

### 2. Super Shell MCP (`shell-mcp.ts`)

Proporciona ejecución controlada de comandos shell.

**Características:**
- Ejecución de comandos con whitelist
- Ejecución de scripts
- Listado de comandos permitidos
- Adición dinámica de comandos permitidos

**Seguridad:**
- Whitelist de comandos permitidos
- Validación de argumentos
- Prevención de inyección de comandos
- Timeout configurable
- Límite de salida

**Uso:**
```typescript
const connector = new ShellMCPConnector({
  allowedCommands: ['ls', 'grep', 'find', 'npm'],
  workingDirectory: process.cwd(),
  timeout: 30000
});

const result = await connector.executeCommand('ls', ['-la']);
```

## Integración

Los plugins core se registran automáticamente cuando se llama a `registerBuiltInPlugins()` en el PluginRegistry.

```typescript
import { PluginRegistry } from '../lib/plugin-registry';

const registry = PluginRegistry.getInstance();
registerBuiltInPlugins(registry);
```

## Seguridad

Ambos plugins implementan medidas de seguridad robustas:

1. **File System MCP:**
   - Validación de rutas con `path.resolve()` y verificación de límites
   - Whitelist de extensiones
   - Límite de tamaño de archivo

2. **Super Shell MCP:**
   - Whitelist de comandos
   - Validación de argumentos
   - Prevención de caracteres peligrosos (`;&|$()`)
   - Prevención de path traversal (`../`)

## Configuración

Ambos plugins se pueden configurar a través del panel de usuario en la interfaz de personalización.

## Próximas Fases

- **Fase 2:** Web Search MCP, Task Scheduler MCP
- **Fase 3:** VectorDB-in-memory, LocalAI/Ollama Connector

### 3. Web Search MCP (`web-search-mcp.ts`)

Proporciona búsqueda web local y extracción de contenido.

**Características:**
- Descarga de URLs con manejo de errores
- Extracción automática de contenido principal
- Búsqueda por palabra clave en múltiples URLs
- Parsing de HTML con cheerio

**Seguridad:**
- Validación de URLs para prevenir SSRF
- Límite de tamaño de contenido
- Timeout configurable
- User-Agent personalizado

**Uso:**
```typescript
const connector = new WebSearchMCPConnector({
  timeout: 30000,
  maxContentLength: 5 * 1024 * 1024
});

const result = await connector.fetchAndParse('https://example.com');
```

### 4. Task Scheduler MCP (`task-scheduler-mcp.ts`)

Proporciona programación proactiva de tareas.

**Características:**
- Programación con expresiones cron
- Programación con intervalos
- Ejecución manual de tareas
- Listado y gestión de tareas
- Persistencia local de tareas

**Seguridad:**
- Validación de expresiones cron
- Límite de tareas concurrentes
- Manejo de errores en ejecución

**Uso:**
```typescript
const connector = new TaskSchedulerMCPConnector({
  persistenceFilePath: './.agent-tasks.json',
  maxConcurrentTasks: 5
});

await connector.scheduleTask({
  id: 'daily-check',
  name: 'Verificación Diaria',
  cronExpression: '0 0 * * *',
  command: 'shell.execute',
  args: { command: 'npm test' }
});
```

## Fase 2 Completada

Los plugins de la Fase 2 (Web Search MCP y Task Scheduler MCP) han sido integrados exitosamente en el sistema core de Agent00.

## Próximas Fases

- **Fase 3:** VectorDB-in-memory, LocalAI/Ollama Connector
