// ============================================
// SUPER SHELL MCP CONNECTOR
// ============================================
// Proporciona acceso controlado a comandos de shell
// Incluye validación mediante whitelist y prevención de inyección de comandos

import { BaseMCPConnector, MCPResponse, MCPConnectorConfig } from '../../lib/mcp-connector';
import { execSync, spawn } from 'child_process';
import * as path from 'path';

/**
 * Configuración del conector de shell
 */
export interface ShellConfig extends MCPConnectorConfig {
  allowedCommands?: string[];  // Comandos permitidos (ej. ['ls', 'grep', 'find'])
  workingDirectory?: string;   // Directorio de trabajo
  timeout?: number;            // Timeout en ms
  maxOutput?: number;          // Máximo de caracteres de salida
}

/**
 * Conector MCP para ejecución segura de comandos shell
 */
export class ShellMCPConnector extends BaseMCPConnector {
  id = 'shell_mcp';
  name = 'Super Shell';
  type: 'custom' = 'custom';
  description = 'Ejecución controlada de comandos shell con validación de seguridad';
  icon = '⚡';
  
  private allowedCommands: Set<string> = new Set([
    'ls', 'cat', 'grep', 'find', 'pwd', 'echo', 'date',
    'wc', 'head', 'tail', 'sort', 'uniq', 'cut',
    'mkdir', 'touch', 'rm', 'cp', 'mv', 'chmod',
    'npm', 'node', 'git', 'curl', 'wget',
  ]);
  
  private workingDirectory: string = process.cwd();
  private timeout: number = 30000; // 30 segundos por defecto
  private maxOutput: number = 1024 * 1024; // 1MB por defecto
  
  constructor(config?: Partial<ShellConfig>) {
    super(config);
    
    if (config?.allowedCommands) {
      this.allowedCommands = new Set(config.allowedCommands);
    }
    if (config?.workingDirectory) {
      this.workingDirectory = config.workingDirectory;
    }
    if (config?.timeout) {
      this.timeout = config.timeout;
    }
    if (config?.maxOutput) {
      this.maxOutput = config.maxOutput;
    }
    
    this.connected = true;
    this.enabled = true;
  }
  
  /**
   * Valida que un comando esté en la whitelist
   */
  private validateCommand(command: string): { valid: boolean; error?: string; baseCommand?: string } {
    // Extraer el comando base (primer token)
    const tokens = command.trim().split(/\s+/);
    if (tokens.length === 0) {
      return { valid: false, error: 'Comando vacío' };
    }
    
    const baseCommand = path.basename(tokens[0]).toLowerCase();
    
    if (!this.allowedCommands.has(baseCommand)) {
      return { 
        valid: false, 
        error: `Comando no permitido: ${baseCommand}. Comandos permitidos: ${Array.from(this.allowedCommands).join(', ')}` 
      };
    }
    
    return { valid: true, baseCommand };
  }
  
  /**
   * Previene inyección de comandos validando caracteres peligrosos
   */
  private validateArguments(args: string[]): { valid: boolean; error?: string } {
    const dangerousPatterns = [
      /[;&|`$()]/,  // Caracteres de shell peligrosos
      /\.\.\//,     // Path traversal
      /\x00/,       // Null byte injection
    ];
    
    for (const arg of args) {
      for (const pattern of dangerousPatterns) {
        if (pattern.test(arg)) {
          return { 
            valid: false, 
            error: `Argumento contiene caracteres peligrosos: ${arg}` 
          };
        }
      }
    }
    
    return { valid: true };
  }
  
  /**
   * Ejecuta un comando de forma segura
   */
  async executeCommand(command: string, args: string[] = []): Promise<MCPResponse> {
    try {
      // Validar comando base
      const cmdValidation = this.validateCommand(command);
      if (!cmdValidation.valid) {
        return { success: false, error: cmdValidation.error };
      }
      
      // Validar argumentos
      const argsValidation = this.validateArguments(args);
      if (!argsValidation.valid) {
        return { success: false, error: argsValidation.error };
      }
      
      // Ejecutar comando con timeout
      let output = '';
      let error = '';
      let exitCode = 0;
      
      try {
        output = execSync(`${command} ${args.join(' ')}`, {
          cwd: this.workingDirectory,
          timeout: this.timeout,
          encoding: 'utf-8',
          maxBuffer: this.maxOutput,
        });
      } catch (err: any) {
        output = err.stdout || '';
        error = err.stderr || err.message || '';
        exitCode = err.status || 1;
      }
      
      // Limitar tamaño de salida
      if (output.length > this.maxOutput) {
        output = output.substring(0, this.maxOutput) + '\n... (salida truncada)';
      }
      
      return {
        success: exitCode === 0,
        data: {
          command: `${command} ${args.join(' ')}`,
          output: output.trim(),
          error: error.trim(),
          exitCode,
          workingDirectory: this.workingDirectory,
        },
        metadata: {
          source: 'Shell',
          confidence: 1.0,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      return { 
        success: false, 
        error: `Error ejecutando comando: ${error.message}` 
      };
    }
  }
  
  /**
   * Ejecuta un script desde un archivo
   */
  async executeScript(scriptPath: string, args: string[] = []): Promise<MCPResponse> {
    try {
      // Validar que el archivo existe
      const fs = await import('fs');
      if (!fs.existsSync(scriptPath)) {
        return { success: false, error: `Script no encontrado: ${scriptPath}` };
      }
      
      // Validar extensión
      const ext = path.extname(scriptPath).toLowerCase();
      if (!['.sh', '.js', '.ts'].includes(ext)) {
        return { success: false, error: `Tipo de script no permitido: ${ext}` };
      }
      
      // Determinar intérprete
      let interpreter = 'bash';
      if (ext === '.js') interpreter = 'node';
      if (ext === '.ts') interpreter = 'ts-node';
      
      return this.executeCommand(interpreter, [scriptPath, ...args]);
    } catch (error: any) {
      return { success: false, error: `Error ejecutando script: ${error.message}` };
    }
  }
  
  /**
   * Lista comandos permitidos
   */
  async listAllowedCommands(): Promise<MCPResponse> {
    return {
      success: true,
      data: {
        commands: Array.from(this.allowedCommands).sort(),
        count: this.allowedCommands.size,
        workingDirectory: this.workingDirectory,
        timeout: this.timeout,
        maxOutput: this.maxOutput,
      },
      metadata: {
        source: 'Shell',
        confidence: 1.0,
        timestamp: new Date().toISOString(),
      },
    };
  }
  
  /**
   * Agrega un comando a la whitelist (requiere validación adicional)
   */
  async addAllowedCommand(command: string): Promise<MCPResponse> {
    try {
      // Validar que es un comando válido
      if (!/^[a-zA-Z0-9_-]+$/.test(command)) {
        return { success: false, error: 'Nombre de comando inválido' };
      }
      
      this.allowedCommands.add(command.toLowerCase());
      
      return {
        success: true,
        data: { command, added: true },
        metadata: {
          source: 'Shell',
          confidence: 1.0,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      return { success: false, error: `Error agregando comando: ${error.message}` };
    }
  }
  
  // Implementación de métodos abstractos requeridos
  async connect(): Promise<void> {
    this.connected = true;
  }
  
  async disconnect(): Promise<void> {
    this.connected = false;
  }
  
  async query(prompt: string, context?: any): Promise<MCPResponse> {
    // El query se mapea a operaciones específicas según el contexto
    if (context?.operation === 'execute') {
      return this.executeCommand(context.command, context.args);
    } else if (context?.operation === 'executeScript') {
      return this.executeScript(context.scriptPath, context.args);
    } else if (context?.operation === 'listCommands') {
      return this.listAllowedCommands();
    }
    
    return { success: false, error: 'Operación no especificada o no soportada' };
  }
  
  async addContext(data: any): Promise<void> {
    // Guardar contexto de ejecución
    console.log('Shell Context:', data);
  }
  
  async search(query: string): Promise<any[]> {
    // Buscar comandos que coincidan con el query
    const results = Array.from(this.allowedCommands)
      .filter(cmd => cmd.toLowerCase().includes(query.toLowerCase()))
      .map(cmd => ({ command: cmd, type: 'allowed_command' }));
    
    return results;
  }
}
