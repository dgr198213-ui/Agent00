// ============================================
// CORE PLUGINS REGISTRY
// ============================================
// Registro e integración de los plugins core del sistema Agent00
// Incluye File System MCP y Shell MCP

import { FileSystemMCPConnector, FileSystemConfig } from './file-system-mcp';
import { ShellMCPConnector, ShellConfig } from './shell-mcp';
import { WebSearchMCPConnector, WebSearchConfig } from './web-search-mcp';
import { TaskSchedulerMCPConnector, TaskSchedulerConfig } from './task-scheduler-mcp';
import { CopilotPlugin } from '../../lib/personalization-types';
import { PluginRegistry } from '../../lib/plugin-registry';

/**
 * Registra los plugins core de autonomía en el registry
 */
export function registerCorePlugins(registry: PluginRegistry): void {
  
  // ============================================
  // PLUGIN: FILE SYSTEM MCP
  // ============================================
  
  const fileSystemConnector = new FileSystemMCPConnector({
    basePath: process.cwd(),
    allowedExtensions: ['.md', '.txt', '.json', '.csv', '.log', '.js', '.ts'],
    maxFileSize: 10 * 1024 * 1024, // 10MB
    readOnly: false,
  });
  
  const fileSystemPlugin: CopilotPlugin = {
    id: 'filesystem-core',
    name: 'File System Access',
    version: '1.0.0',
    author: 'Agent00 Core',
    description: 'Acceso seguro al sistema de archivos local. Permite lectura, escritura y gestión de archivos con validación de rutas.',
    icon: '📁',
    category: 'connector',
    enabled: true,
    installed: true,
    installedAt: new Date().toISOString(),
    
    requires: {
      permissions: ['storage:local', 'read:interactions', 'write:interactions'],
    },
    
    settings: [
      {
        key: 'basePath',
        label: 'Directorio Base',
        type: 'string',
        default: process.cwd(),
        description: 'Ruta base permitida para operaciones de archivo',
        required: true,
      },
      {
        key: 'maxFileSize',
        label: 'Tamaño Máximo de Archivo (MB)',
        type: 'number',
        default: 10,
        description: 'Tamaño máximo permitido para archivos',
        required: false,
      },
      {
        key: 'readOnly',
        label: 'Modo Solo Lectura',
        type: 'boolean',
        default: false,
        description: 'Si está activado, solo permite lectura de archivos',
        required: false,
      },
    ],
    
    connector: fileSystemConnector,
    
    contributes: {
      commands: [
        {
          id: 'fs.readFile',
          name: 'Leer Archivo',
          description: 'Lee el contenido de un archivo',
          execute: async (args: any) => fileSystemConnector.readFile(args.filePath),
        },
        {
          id: 'fs.writeFile',
          name: 'Escribir Archivo',
          description: 'Escribe contenido en un archivo',
          execute: async (args: any) => fileSystemConnector.writeFile(args.filePath, args.content),
        },
        {
          id: 'fs.listFiles',
          name: 'Listar Archivos',
          description: 'Lista archivos en un directorio',
          execute: async (args: any) => fileSystemConnector.listFiles(args.dirPath),
        },
        {
          id: 'fs.deleteFile',
          name: 'Eliminar Archivo',
          description: 'Elimina un archivo',
          execute: async (args: any) => fileSystemConnector.deleteFile(args.filePath),
        },
      ],
    },
    
    hooks: {
      onEnable: async () => {
        console.log('✅ File System MCP habilitado');
        await fileSystemConnector.connect();
      },
      onDisable: async () => {
        console.log('⏸️ File System MCP deshabilitado');
        await fileSystemConnector.disconnect();
      },
    },
  };
  
  // ============================================
  // PLUGIN: SUPER SHELL MCP
  // ============================================
  
  const shellConnector = new ShellMCPConnector({
    allowedCommands: [
      'ls', 'cat', 'grep', 'find', 'pwd', 'echo', 'date',
      'wc', 'head', 'tail', 'sort', 'uniq', 'cut',
      'mkdir', 'touch', 'rm', 'cp', 'mv', 'chmod',
      'npm', 'node', 'git', 'curl', 'wget',
    ],
    workingDirectory: process.cwd(),
    timeout: 30000,
    maxOutput: 1024 * 1024,
  });
  
  const shellPlugin: CopilotPlugin = {
    id: 'shell-core',
    name: 'Super Shell',
    version: '1.0.0',
    author: 'Agent00 Core',
    description: 'Ejecución controlada de comandos shell con validación de seguridad. Incluye whitelist de comandos permitidos.',
    icon: '⚡',
    category: 'connector',
    enabled: true,
    installed: true,
    installedAt: new Date().toISOString(),
    
    requires: {
      permissions: ['network:external', 'storage:local', 'read:interactions', 'write:interactions'],
    },
    
    settings: [
      {
        key: 'workingDirectory',
        label: 'Directorio de Trabajo',
        type: 'string',
        default: process.cwd(),
        description: 'Directorio desde el cual se ejecutarán los comandos',
        required: true,
      },
      {
        key: 'timeout',
        label: 'Timeout (ms)',
        type: 'number',
        default: 30000,
        description: 'Tiempo máximo de ejecución para cada comando',
        required: false,
      },
      {
        key: 'maxOutput',
        label: 'Salida Máxima (bytes)',
        type: 'number',
        default: 1048576,
        description: 'Tamaño máximo de la salida de comandos',
        required: false,
      },
    ],
    
    connector: shellConnector,
    
    contributes: {
      commands: [
        {
          id: 'shell.execute',
          name: 'Ejecutar Comando',
          description: 'Ejecuta un comando de shell',
          execute: async (args: any) => shellConnector.executeCommand(args.command, args.args),
        },
        {
          id: 'shell.executeScript',
          name: 'Ejecutar Script',
          description: 'Ejecuta un script desde un archivo',
          execute: async (args: any) => shellConnector.executeScript(args.scriptPath, args.args),
        },
        {
          id: 'shell.listCommands',
          name: 'Listar Comandos Permitidos',
          description: 'Lista todos los comandos permitidos',
          execute: async () => shellConnector.listAllowedCommands(),
        },
      ],
    },
    
    hooks: {
      onEnable: async () => {
        console.log('✅ Super Shell MCP habilitado');
        await shellConnector.connect();
      },
      onDisable: async () => {
        console.log('⏸️ Super Shell MCP deshabilitado');
        await shellConnector.disconnect();
      },
    },
  };
  
  // ============================================
  // PLUGIN: WEB SEARCH MCP
  // ============================================
  
  const webSearchConnector = new WebSearchMCPConnector({
    timeout: 30000,
    maxContentLength: 5 * 1024 * 1024,
  });
  
  const webSearchPlugin: CopilotPlugin = {
    id: 'websearch-core',
    name: 'Web Search',
    version: '1.0.0',
    author: 'Agent00 Core',
    description: 'Búsqueda web local con extracción de contenido. Permite al agente acceder y procesar información de URLs sin depender de APIs externas.',
    icon: '🔍',
    category: 'connector',
    enabled: true,
    installed: true,
    installedAt: new Date().toISOString(),
    
    requires: {
      permissions: ['network:external', 'read:interactions', 'write:interactions'],
    },
    
    settings: [
      {
        key: 'timeout',
        label: 'Timeout (ms)',
        type: 'number',
        default: 30000,
        description: 'Tiempo máximo para descargar una página',
        required: false,
      },
      {
        key: 'maxContentLength',
        label: 'Longitud Máxima de Contenido (MB)',
        type: 'number',
        default: 5,
        description: 'Tamaño máximo de contenido a procesar',
        required: false,
      },
    ],
    
    connector: webSearchConnector,
    
    contributes: {
      commands: [
        {
          id: 'websearch.fetchUrl',
          name: 'Descargar URL',
          description: 'Descarga el contenido HTML de una URL',
          execute: async (args: any) => webSearchConnector.fetchUrl(args.url),
        },
        {
          id: 'websearch.fetchAndParse',
          name: 'Descargar y Procesar URL',
          description: 'Descarga una URL y extrae el contenido principal',
          execute: async (args: any) => webSearchConnector.fetchAndParse(args.url),
        },
        {
          id: 'websearch.searchUrls',
          name: 'Buscar en URLs',
          description: 'Busca y procesa múltiples URLs',
          execute: async (args: any) => webSearchConnector.searchUrls(args.urls),
        },
        {
          id: 'websearch.searchByKeyword',
          name: 'Buscar por Palabra Clave',
          description: 'Busca una palabra clave en un conjunto de URLs',
          execute: async (args: any) => webSearchConnector.searchByKeyword(args.keyword, args.urls),
        },
      ],
    },
    
    hooks: {
      onEnable: async () => {
        console.log('✅ Web Search MCP habilitado');
        await webSearchConnector.connect();
      },
      onDisable: async () => {
        console.log('⏸️ Web Search MCP deshabilitado');
        await webSearchConnector.disconnect();
      },
    },
  };
  
  // ============================================
  // PLUGIN: TASK SCHEDULER MCP
  // ============================================
  
  const taskSchedulerConnector = new TaskSchedulerMCPConnector({
    persistenceFilePath: './.agent-tasks.json',
    maxConcurrentTasks: 5,
  });
  
  const taskSchedulerPlugin: CopilotPlugin = {
    id: 'taskscheduler-core',
    name: 'Task Scheduler',
    version: '1.0.0',
    author: 'Agent00 Core',
    description: 'Programación proactiva de tareas con expresiones cron e intervalos. Permite al agente ejecutar acciones de forma automática y periódica.',
    icon: '⏰',
    category: 'connector',
    enabled: true,
    installed: true,
    installedAt: new Date().toISOString(),
    
    requires: {
      permissions: ['storage:local', 'read:interactions', 'write:interactions'],
    },
    
    settings: [
      {
        key: 'maxConcurrentTasks',
        label: 'Máximo de Tareas Concurrentes',
        type: 'number',
        default: 5,
        description: 'Número máximo de tareas que pueden ejecutarse simultáneamente',
        required: false,
      },
    ],
    
    connector: taskSchedulerConnector,
    
    contributes: {
      commands: [
        {
          id: 'scheduler.scheduleTask',
          name: 'Programar Tarea',
          description: 'Programa una nueva tarea con expresión cron o intervalo',
          execute: async (args: any) => taskSchedulerConnector.scheduleTask(args.task),
        },
        {
          id: 'scheduler.executeTask',
          name: 'Ejecutar Tarea',
          description: 'Ejecuta una tarea manualmente',
          execute: async (args: any) => taskSchedulerConnector.executeTask(args.taskId),
        },
        {
          id: 'scheduler.cancelTask',
          name: 'Cancelar Tarea',
          description: 'Cancela una tarea programada',
          execute: async (args: any) => taskSchedulerConnector.cancelTask(args.taskId),
        },
        {
          id: 'scheduler.listTasks',
          name: 'Listar Tareas',
          description: 'Lista todas las tareas programadas',
          execute: async (args: any) => taskSchedulerConnector.listTasks(args.filter),
        },
        {
          id: 'scheduler.getTask',
          name: 'Obtener Tarea',
          description: 'Obtiene información de una tarea específica',
          execute: async (args: any) => taskSchedulerConnector.getTask(args.taskId),
        },
      ],
    },
    
    hooks: {
      onEnable: async () => {
        console.log('✅ Task Scheduler MCP habilitado');
        await taskSchedulerConnector.connect();
      },
      onDisable: async () => {
        console.log('⏸️ Task Scheduler MCP deshabilitado');
        await taskSchedulerConnector.disconnect();
      },
    },
  };
  
  // Registrar plugins
  try {
    registry.register(fileSystemPlugin);
    console.log('✅ Plugin File System registrado');
  } catch (error) {
    console.error('❌ Error registrando File System:', error);
  }
  
  try {
    registry.register(shellPlugin);
    console.log('✅ Plugin Super Shell registrado');
  } catch (error) {
    console.error('❌ Error registrando Super Shell:', error);
  }
  
  try {
    registry.register(webSearchPlugin);
    console.log('✅ Plugin Web Search registrado');
  } catch (error) {
    console.error('❌ Error registrando Web Search:', error);
  }
  
  try {
    registry.register(taskSchedulerPlugin);
    console.log('✅ Plugin Task Scheduler registrado');
  } catch (error) {
    console.error('❌ Error registrando Task Scheduler:', error);
  }


// Exportar conectores para uso directo si es necesario
export { FileSystemMCPConnector, ShellMCPConnector, WebSearchMCPConnector, TaskSchedulerMCPConnector };
export type { FileSystemConfig, ShellConfig, WebSearchConfig, TaskSchedulerConfig };
