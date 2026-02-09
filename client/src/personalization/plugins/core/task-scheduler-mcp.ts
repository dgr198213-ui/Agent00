// ============================================
// TASK SCHEDULER MCP CONNECTOR
// ============================================
// Proporciona programación de tareas proactivas con persistencia local
// Utiliza node-schedule para la gestión de tareas cron

import { BaseMCPConnector, MCPResponse, MCPConnectorConfig } from '../../lib/mcp-connector';
import * as schedule from 'node-schedule';

/**
 * Configuración del conector de programación de tareas
 */
export interface TaskSchedulerConfig extends MCPConnectorConfig {
  persistenceFilePath?: string;  // Ruta para guardar tareas programadas
  maxConcurrentTasks?: number;   // Máximo de tareas simultáneas
}

/**
 * Interfaz para una tarea programada
 */
export interface ScheduledTask {
  id: string;
  name: string;
  description?: string;
  cronExpression?: string;      // Expresión cron (ej. '0 0 * * *')
  intervalMs?: number;          // Intervalo en milisegundos
  command: string;              // Comando a ejecutar (ej. 'shell.execute')
  args?: Record<string, any>;   // Argumentos para el comando
  enabled: boolean;
  createdAt: string;
  lastExecuted?: string;
  nextExecution?: string;
  executionCount?: number;
}

/**
 * Conector MCP para programación de tareas
 */
export class TaskSchedulerMCPConnector extends BaseMCPConnector {
  id = 'taskscheduler_mcp';
  name = 'Task Scheduler';
  type: 'custom' = 'custom';
  description = 'Programación proactiva de tareas con expresiones cron e intervalos. Permite al agente ejecutar acciones de forma automática y periódica.';
  icon = '⏰';
  
  private tasks: Map<string, ScheduledTask> = new Map();
  private jobs: Map<string, schedule.Job> = new Map();
  private persistenceFilePath: string = './.agent-tasks.json';
  private maxConcurrentTasks: number = 5;
  private runningTasks: number = 0;
  private taskCallbacks: Map<string, (task: ScheduledTask) => Promise<void>> = new Map();
  
  constructor(config?: Partial<TaskSchedulerConfig>) {
    super(config);
    
    if (config?.persistenceFilePath) {
      this.persistenceFilePath = config.persistenceFilePath;
    }
    if (config?.maxConcurrentTasks) {
      this.maxConcurrentTasks = config.maxConcurrentTasks;
    }
    
    this.connected = true;
    this.enabled = true;
  }
  
  /**
   * Registra un callback para ejecutar cuando una tarea se dispara
   */
  registerTaskCallback(taskId: string, callback: (task: ScheduledTask) => Promise<void>): void {
    this.taskCallbacks.set(taskId, callback);
  }
  
  /**
   * Carga tareas persistidas desde el archivo local
   */
  async loadPersistedTasks(): Promise<void> {
    try {
      const fs = await import('fs');
      if (fs.existsSync(this.persistenceFilePath)) {
        const content = fs.readFileSync(this.persistenceFilePath, 'utf-8');
        const persistedTasks = JSON.parse(content);
        
        for (const task of persistedTasks) {
          this.tasks.set(task.id, task);
          if (task.enabled) {
            await this.enableTask(task.id);
          }
        }
        
        console.log(`✅ ${persistedTasks.length} tareas cargadas desde persistencia`);
      }
    } catch (error) {
      console.warn('Advertencia: No se pudieron cargar tareas persistidas:', error);
    }
  }
  
  /**
   * Guarda las tareas actuales en el archivo local
   */
  async persistTasks(): Promise<void> {
    try {
      const fs = await import('fs');
      const tasksArray = Array.from(this.tasks.values());
      fs.writeFileSync(this.persistenceFilePath, JSON.stringify(tasksArray, null, 2), 'utf-8');
    } catch (error) {
      console.error('Error persistiendo tareas:', error);
    }
  }
  
  /**
   * Valida una expresión cron
   */
  private isValidCronExpression(cron: string): boolean {
    try {
      const job = schedule.scheduleJob(cron, () => {});
      if (job) {
        job.cancel();
      }
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Programa una nueva tarea
   */
  async scheduleTask(task: Partial<ScheduledTask>): Promise<MCPResponse> {
    try {
      // Validar datos requeridos
      if (!task.id || !task.name || !task.command) {
        return { 
          success: false, 
          error: 'Faltan campos requeridos: id, name, command' 
        };
      }
      
      // Validar que hay cron o intervalo
      if (!task.cronExpression && !task.intervalMs) {
        return { 
          success: false, 
          error: 'Se requiere cronExpression o intervalMs' 
        };
      }
      
      // Validar expresión cron si se proporciona
      if (task.cronExpression && !this.isValidCronExpression(task.cronExpression)) {
        return { 
          success: false, 
          error: `Expresión cron inválida: ${task.cronExpression}` 
        };
      }
      
      // Crear tarea
      const newTask: ScheduledTask = {
        id: task.id,
        name: task.name,
        description: task.description,
        cronExpression: task.cronExpression,
        intervalMs: task.intervalMs,
        command: task.command,
        args: task.args || {},
        enabled: task.enabled !== false,
        createdAt: new Date().toISOString(),
        executionCount: 0,
      };
      
      // Guardar tarea
      this.tasks.set(task.id, newTask);
      
      // Programar si está habilitada
      if (newTask.enabled) {
        await this.enableTask(task.id);
      }
      
      // Persistir tareas
      await this.persistTasks();
      
      return {
        success: true,
        data: newTask,
        metadata: {
          source: 'Task Scheduler',
          confidence: 1.0,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      return { 
        success: false, 
        error: `Error programando tarea: ${error.message}` 
      };
    }
  }
  
  /**
   * Habilita una tarea programada
   */
  async enableTask(taskId: string): Promise<MCPResponse> {
    try {
      const task = this.tasks.get(taskId);
      if (!task) {
        return { success: false, error: `Tarea no encontrada: ${taskId}` };
      }
      
      // Si ya está programada, cancelar
      if (this.jobs.has(taskId)) {
        const job = this.jobs.get(taskId)!;
        job.cancel();
      }
      
      // Programar nueva tarea
      let job: schedule.Job;
      
      if (task.cronExpression) {
        job = schedule.scheduleJob(task.cronExpression, async () => {
          await this.executeTask(taskId);
        });
      } else if (task.intervalMs) {
        job = schedule.scheduleJob(`*/${Math.floor(task.intervalMs / 1000)} * * * * *`, async () => {
          await this.executeTask(taskId);
        });
      } else {
        return { success: false, error: 'Configuración de programación inválida' };
      }
      
      this.jobs.set(taskId, job);
      task.enabled = true;
      
      return {
        success: true,
        data: { taskId, enabled: true },
        metadata: {
          source: 'Task Scheduler',
          confidence: 1.0,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      return { 
        success: false, 
        error: `Error habilitando tarea: ${error.message}` 
      };
    }
  }
  
  /**
   * Desactiva una tarea programada
   */
  async disableTask(taskId: string): Promise<MCPResponse> {
    try {
      const task = this.tasks.get(taskId);
      if (!task) {
        return { success: false, error: `Tarea no encontrada: ${taskId}` };
      }
      
      // Cancelar job
      if (this.jobs.has(taskId)) {
        const job = this.jobs.get(taskId)!;
        job.cancel();
        this.jobs.delete(taskId);
      }
      
      task.enabled = false;
      
      return {
        success: true,
        data: { taskId, enabled: false },
        metadata: {
          source: 'Task Scheduler',
          confidence: 1.0,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      return { 
        success: false, 
        error: `Error deshabilitando tarea: ${error.message}` 
      };
    }
  }
  
  /**
   * Ejecuta una tarea manualmente
   */
  async executeTask(taskId: string): Promise<MCPResponse> {
    try {
      // Verificar límite de tareas concurrentes
      if (this.runningTasks >= this.maxConcurrentTasks) {
        return { 
          success: false, 
          error: `Límite de tareas concurrentes alcanzado (${this.maxConcurrentTasks})` 
        };
      }
      
      const task = this.tasks.get(taskId);
      if (!task) {
        return { success: false, error: `Tarea no encontrada: ${taskId}` };
      }
      
      this.runningTasks++;
      
      try {
        // Actualizar información de ejecución
        task.lastExecuted = new Date().toISOString();
        task.executionCount = (task.executionCount || 0) + 1;
        
        // Ejecutar callback si está registrado
        const callback = this.taskCallbacks.get(taskId);
        if (callback) {
          await callback(task);
        }
        
        return {
          success: true,
          data: {
            taskId,
            taskName: task.name,
            executedAt: task.lastExecuted,
            executionCount: task.executionCount,
          },
          metadata: {
            source: 'Task Scheduler',
            confidence: 1.0,
            timestamp: new Date().toISOString(),
          },
        };
      } finally {
        this.runningTasks--;
      }
    } catch (error: any) {
      return { 
        success: false, 
        error: `Error ejecutando tarea: ${error.message}` 
      };
    }
  }
  
  /**
   * Cancela una tarea programada
   */
  async cancelTask(taskId: string): Promise<MCPResponse> {
    try {
      const task = this.tasks.get(taskId);
      if (!task) {
        return { success: false, error: `Tarea no encontrada: ${taskId}` };
      }
      
      // Cancelar job
      if (this.jobs.has(taskId)) {
        const job = this.jobs.get(taskId)!;
        job.cancel();
        this.jobs.delete(taskId);
      }
      
      // Eliminar tarea
      this.tasks.delete(taskId);
      this.taskCallbacks.delete(taskId);
      
      // Persistir cambios
      await this.persistTasks();
      
      return {
        success: true,
        data: { taskId, cancelled: true },
        metadata: {
          source: 'Task Scheduler',
          confidence: 1.0,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      return { 
        success: false, 
        error: `Error cancelando tarea: ${error.message}` 
      };
    }
  }
  
  /**
   * Lista todas las tareas
   */
  async listTasks(filter?: { enabled?: boolean }): Promise<MCPResponse> {
    try {
      let taskList = Array.from(this.tasks.values());
      
      if (filter?.enabled !== undefined) {
        taskList = taskList.filter(t => t.enabled === filter.enabled);
      }
      
      return {
        success: true,
        data: {
          tasks: taskList,
          total: taskList.length,
          running: this.runningTasks,
          maxConcurrent: this.maxConcurrentTasks,
        },
        metadata: {
          source: 'Task Scheduler',
          confidence: 1.0,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      return { 
        success: false, 
        error: `Error listando tareas: ${error.message}` 
      };
    }
  }
  
  /**
   * Obtiene información de una tarea específica
   */
  async getTask(taskId: string): Promise<MCPResponse> {
    try {
      const task = this.tasks.get(taskId);
      if (!task) {
        return { success: false, error: `Tarea no encontrada: ${taskId}` };
      }
      
      return {
        success: true,
        data: task,
        metadata: {
          source: 'Task Scheduler',
          confidence: 1.0,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      return { 
        success: false, 
        error: `Error obteniendo tarea: ${error.message}` 
      };
    }
  }
  
  // Implementación de métodos abstractos requeridos
  async connect(): Promise<void> {
    this.connected = true;
  }
  
  async disconnect(): Promise<void> {
    // Cancelar todos los jobs
    for (const job of this.jobs.values()) {
      job.cancel();
    }
    this.jobs.clear();
    this.connected = false;
  }
  
  async query(prompt: string, context?: any): Promise<MCPResponse> {
    // El query se mapea a operaciones específicas según el contexto
    if (context?.operation === 'scheduleTask') {
      return this.scheduleTask(context.task);
    } else if (context?.operation === 'executeTask') {
      return this.executeTask(context.taskId);
    } else if (context?.operation === 'cancelTask') {
      return this.cancelTask(context.taskId);
    } else if (context?.operation === 'listTasks') {
      return this.listTasks(context.filter);
    } else if (context?.operation === 'getTask') {
      return this.getTask(context.taskId);
    } else if (context?.operation === 'enableTask') {
      return this.enableTask(context.taskId);
    } else if (context?.operation === 'disableTask') {
      return this.disableTask(context.taskId);
    }
    
    return { success: false, error: 'Operación no especificada o no soportada' };
  }
  
  async addContext(data: any): Promise<void> {
    // Guardar contexto de programación
    console.log('Task Scheduler Context:', data);
  }
  
  async search(query: string): Promise<any[]> {
    // Búsqueda de tareas por nombre
    const results = Array.from(this.tasks.values())
      .filter(task => task.name.toLowerCase().includes(query.toLowerCase()))
      .map(task => ({
        id: task.id,
        name: task.name,
        enabled: task.enabled,
        type: 'scheduled_task',
      }));
    
    return results;
  }
}
