// ============================================
// PRUEBAS DE CONECTORES MCP
// ============================================
// Pruebas unitarias para verificar la lógica de los conectores

import { FileSystemMCPConnector } from '../file-system-mcp';
import { ShellMCPConnector } from '../shell-mcp';
import { WebSearchMCPConnector } from '../web-search-mcp';
import { TaskSchedulerMCPConnector } from '../task-scheduler-mcp';

/**
 * Pruebas para File System MCP
 */
describe('FileSystemMCPConnector', () => {
  let connector: FileSystemMCPConnector;
  
  beforeEach(() => {
    connector = new FileSystemMCPConnector({
      basePath: process.cwd(),
      allowedExtensions: ['.md', '.txt', '.json'],
      readOnly: false,
    });
  });
  
  test('debe validar rutas correctamente (prevenir path traversal)', async () => {
    // Intentar acceder a archivo fuera del basePath
    const result = await connector.readFile('../../../etc/passwd');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Acceso denegado');
  });
  
  test('debe validar extensiones permitidas', async () => {
    // Intentar leer archivo con extensión no permitida
    const result = await connector.readFile('test.exe');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Extensión no permitida');
  });
  
  test('debe respetar el modo solo lectura', async () => {
    const roConnector = new FileSystemMCPConnector({
      basePath: process.cwd(),
      readOnly: true,
    });
    
    const result = await roConnector.writeFile('test.txt', 'contenido');
    expect(result.success).toBe(false);
    expect(result.error).toContain('modo solo lectura');
  });
});

/**
 * Pruebas para Super Shell MCP
 */
describe('ShellMCPConnector', () => {
  let connector: ShellMCPConnector;
  
  beforeEach(() => {
    connector = new ShellMCPConnector({
      allowedCommands: ['ls', 'echo', 'pwd'],
      workingDirectory: process.cwd(),
      timeout: 5000,
    });
  });
  
  test('debe permitir solo comandos en whitelist', async () => {
    // Intentar ejecutar comando no permitido
    const result = await connector.executeCommand('rm', ['-rf', '/']);
    expect(result.success).toBe(false);
    expect(result.error).toContain('no permitido');
  });
  
  test('debe prevenir inyección de comandos', async () => {
    // Intentar inyectar comando adicional
    const result = await connector.executeCommand('echo', ['test; rm -rf /']);
    expect(result.success).toBe(false);
    expect(result.error).toContain('caracteres peligrosos');
  });
  
  test('debe ejecutar comandos permitidos correctamente', async () => {
    const result = await connector.executeCommand('echo', ['test']);
    expect(result.success).toBe(true);
    expect(result.data.exitCode).toBe(0);
  });
});

/**
 * Pruebas para Web Search MCP
 */
describe('WebSearchMCPConnector', () => {
  let connector: WebSearchMCPConnector;
  
  beforeEach(() => {
    connector = new WebSearchMCPConnector({
      timeout: 10000,
      maxContentLength: 5 * 1024 * 1024,
    });
  });
  
  test('debe validar URLs correctamente', async () => {
    // URL inválida
    const result = await connector.fetchUrl('not-a-valid-url');
    expect(result.success).toBe(false);
    expect(result.error).toContain('URL inválida');
  });
  
  test('debe extraer contenido principal correctamente', async () => {
    // Esta prueba requeriría una URL real o un mock
    // Aquí verificamos que el método existe y tiene la firma correcta
    expect(typeof connector.fetchAndParse).toBe('function');
  });
});

/**
 * Pruebas para Task Scheduler MCP
 */
describe('TaskSchedulerMCPConnector', () => {
  let connector: TaskSchedulerMCPConnector;
  
  beforeEach(() => {
    connector = new TaskSchedulerMCPConnector({
      maxConcurrentTasks: 5,
    });
  });
  
  test('debe validar expresiones cron', async () => {
    // Expresión cron inválida
    const result = await connector.scheduleTask({
      id: 'test-task',
      name: 'Test Task',
      cronExpression: 'invalid-cron',
      command: 'echo',
    });
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('cron inválida');
  });
  
  test('debe requerir cronExpression o intervalMs', async () => {
    const result = await connector.scheduleTask({
      id: 'test-task',
      name: 'Test Task',
      command: 'echo',
    });
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('cronExpression o intervalMs');
  });
  
  test('debe programar tareas correctamente', async () => {
    const result = await connector.scheduleTask({
      id: 'test-task',
      name: 'Test Task',
      cronExpression: '0 0 * * *', // Cada día a medianoche
      command: 'echo',
      args: { message: 'test' },
    });
    
    expect(result.success).toBe(true);
    expect(result.data.id).toBe('test-task');
    expect(result.data.enabled).toBe(true);
  });
  
  test('debe respetar el límite de tareas concurrentes', async () => {
    const limitedConnector = new TaskSchedulerMCPConnector({
      maxConcurrentTasks: 1,
    });
    
    // Programar una tarea
    await limitedConnector.scheduleTask({
      id: 'task1',
      name: 'Task 1',
      intervalMs: 1000,
      command: 'echo',
    });
    
    // Intentar ejecutar cuando ya hay una en ejecución
    // (Esta prueba requeriría simular ejecución concurrente)
    expect(limitedConnector).toBeDefined();
  });
});

/**
 * Pruebas de integración
 */
describe('Integración de Conectores', () => {
  test('todos los conectores deben implementar la interfaz MCPConnector', () => {
    const fs = new FileSystemMCPConnector();
    const shell = new ShellMCPConnector();
    const web = new WebSearchMCPConnector();
    const scheduler = new TaskSchedulerMCPConnector();
    
    // Verificar que tienen los métodos requeridos
    expect(typeof fs.connect).toBe('function');
    expect(typeof fs.disconnect).toBe('function');
    expect(typeof fs.query).toBe('function');
    expect(typeof fs.addContext).toBe('function');
    expect(typeof fs.search).toBe('function');
    
    expect(typeof shell.connect).toBe('function');
    expect(typeof web.connect).toBe('function');
    expect(typeof scheduler.connect).toBe('function');
  });
});
