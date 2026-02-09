// ============================================
// FILE SYSTEM MCP CONNECTOR
// ============================================
// Proporciona acceso seguro al sistema de archivos local
// Incluye validación de rutas y permisos para prevenir acceso no autorizado

import { BaseMCPConnector, MCPResponse, MCPConnectorConfig } from '../../lib/mcp-connector';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Configuración del conector de sistema de archivos
 */
export interface FileSystemConfig extends MCPConnectorConfig {
  basePath?: string;           // Ruta base permitida (ej. /home/user/agent-data)
  allowedExtensions?: string[]; // Extensiones permitidas (ej. ['.md', '.txt', '.json'])
  maxFileSize?: number;         // Tamaño máximo en bytes
  readOnly?: boolean;           // Si es true, solo lectura
}

/**
 * Conector MCP para operaciones del sistema de archivos local
 */
export class FileSystemMCPConnector extends BaseMCPConnector {
  id = 'filesystem_mcp';
  name = 'Local File System';
  type: 'custom' = 'custom';
  description = 'Acceso seguro al sistema de archivos local para lectura, escritura y gestión de archivos';
  icon = '📁';
  
  private basePath: string = process.cwd();
  private allowedExtensions: Set<string> = new Set(['.md', '.txt', '.json', '.csv', '.log']);
  private maxFileSize: number = 10 * 1024 * 1024; // 10MB por defecto
  private readOnly: boolean = false;
  
  constructor(config?: Partial<FileSystemConfig>) {
    super(config);
    
    if (config?.basePath) {
      this.basePath = path.resolve(config.basePath);
    }
    if (config?.allowedExtensions) {
      this.allowedExtensions = new Set(config.allowedExtensions);
    }
    if (config?.maxFileSize) {
      this.maxFileSize = config.maxFileSize;
    }
    if (config?.readOnly !== undefined) {
      this.readOnly = config.readOnly;
    }
    
    this.connected = true;
    this.enabled = true;
  }
  
  /**
   * Valida que una ruta esté dentro del directorio permitido
   */
  private validatePath(filePath: string): { valid: boolean; error?: string; resolvedPath?: string } {
    try {
      const resolvedPath = path.resolve(this.basePath, filePath);
      
      // Prevenir path traversal attacks
      if (!resolvedPath.startsWith(this.basePath)) {
        return { valid: false, error: 'Acceso denegado: ruta fuera del directorio permitido' };
      }
      
      return { valid: true, resolvedPath };
    } catch (error) {
      return { valid: false, error: `Error validando ruta: ${error.message}` };
    }
  }
  
  /**
   * Valida extensión de archivo
   */
  private validateExtension(filePath: string): { valid: boolean; error?: string } {
    const ext = path.extname(filePath).toLowerCase();
    
    if (!this.allowedExtensions.has(ext)) {
      return { 
        valid: false, 
        error: `Extensión no permitida: ${ext}. Permitidas: ${Array.from(this.allowedExtensions).join(', ')}` 
      };
    }
    
    return { valid: true };
  }
  
  /**
   * Lee el contenido de un archivo
   */
  async readFile(filePath: string): Promise<MCPResponse> {
    try {
      const pathValidation = this.validatePath(filePath);
      if (!pathValidation.valid) {
        return { success: false, error: pathValidation.error };
      }
      
      const extValidation = this.validateExtension(filePath);
      if (!extValidation.valid) {
        return { success: false, error: extValidation.error };
      }
      
      const resolvedPath = pathValidation.resolvedPath!;
      
      // Verificar que el archivo existe
      if (!fs.existsSync(resolvedPath)) {
        return { success: false, error: `Archivo no encontrado: ${filePath}` };
      }
      
      // Verificar tamaño
      const stats = fs.statSync(resolvedPath);
      if (stats.size > this.maxFileSize) {
        return { 
          success: false, 
          error: `Archivo demasiado grande: ${stats.size} bytes (máximo: ${this.maxFileSize})` 
        };
      }
      
      const content = fs.readFileSync(resolvedPath, 'utf-8');
      
      return {
        success: true,
        data: {
          path: filePath,
          content,
          size: stats.size,
          modified: stats.mtime.toISOString(),
        },
        metadata: {
          source: 'File System',
          confidence: 1.0,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return { success: false, error: `Error leyendo archivo: ${error.message}` };
    }
  }
  
  /**
   * Escribe contenido en un archivo
   */
  async writeFile(filePath: string, content: string): Promise<MCPResponse> {
    try {
      if (this.readOnly) {
        return { success: false, error: 'Sistema de archivos en modo solo lectura' };
      }
      
      const pathValidation = this.validatePath(filePath);
      if (!pathValidation.valid) {
        return { success: false, error: pathValidation.error };
      }
      
      const extValidation = this.validateExtension(filePath);
      if (!extValidation.valid) {
        return { success: false, error: extValidation.error };
      }
      
      const resolvedPath = pathValidation.resolvedPath!;
      
      // Validar tamaño del contenido
      if (Buffer.byteLength(content, 'utf-8') > this.maxFileSize) {
        return { 
          success: false, 
          error: `Contenido demasiado grande (máximo: ${this.maxFileSize} bytes)` 
        };
      }
      
      // Crear directorio si no existe
      const dir = path.dirname(resolvedPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(resolvedPath, content, 'utf-8');
      
      return {
        success: true,
        data: {
          path: filePath,
          size: Buffer.byteLength(content, 'utf-8'),
          written: true,
        },
        metadata: {
          source: 'File System',
          confidence: 1.0,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return { success: false, error: `Error escribiendo archivo: ${error.message}` };
    }
  }
  
  /**
   * Lista archivos en un directorio
   */
  async listFiles(dirPath: string = '.'): Promise<MCPResponse> {
    try {
      const pathValidation = this.validatePath(dirPath);
      if (!pathValidation.valid) {
        return { success: false, error: pathValidation.error };
      }
      
      const resolvedPath = pathValidation.resolvedPath!;
      
      if (!fs.existsSync(resolvedPath)) {
        return { success: false, error: `Directorio no encontrado: ${dirPath}` };
      }
      
      const stats = fs.statSync(resolvedPath);
      if (!stats.isDirectory()) {
        return { success: false, error: `No es un directorio: ${dirPath}` };
      }
      
      const files = fs.readdirSync(resolvedPath, { withFileTypes: true });
      
      const fileList = files.map(file => ({
        name: file.name,
        type: file.isDirectory() ? 'directory' : 'file',
        path: path.join(dirPath, file.name),
      }));
      
      return {
        success: true,
        data: {
          path: dirPath,
          files: fileList,
          count: fileList.length,
        },
        metadata: {
          source: 'File System',
          confidence: 1.0,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return { success: false, error: `Error listando directorio: ${error.message}` };
    }
  }
  
  /**
   * Elimina un archivo
   */
  async deleteFile(filePath: string): Promise<MCPResponse> {
    try {
      if (this.readOnly) {
        return { success: false, error: 'Sistema de archivos en modo solo lectura' };
      }
      
      const pathValidation = this.validatePath(filePath);
      if (!pathValidation.valid) {
        return { success: false, error: pathValidation.error };
      }
      
      const resolvedPath = pathValidation.resolvedPath!;
      
      if (!fs.existsSync(resolvedPath)) {
        return { success: false, error: `Archivo no encontrado: ${filePath}` };
      }
      
      fs.unlinkSync(resolvedPath);
      
      return {
        success: true,
        data: { path: filePath, deleted: true },
        metadata: {
          source: 'File System',
          confidence: 1.0,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return { success: false, error: `Error eliminando archivo: ${error.message}` };
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
    // El query general se mapea a operaciones específicas según el contexto
    if (context?.operation === 'read') {
      return this.readFile(context.filePath);
    } else if (context?.operation === 'write') {
      return this.writeFile(context.filePath, context.content);
    } else if (context?.operation === 'list') {
      return this.listFiles(context.dirPath);
    } else if (context?.operation === 'delete') {
      return this.deleteFile(context.filePath);
    }
    
    return { success: false, error: 'Operación no especificada o no soportada' };
  }
  
  async addContext(data: any): Promise<void> {
    // Guardar contexto en un archivo de log
    const logEntry = {
      timestamp: new Date().toISOString(),
      data,
    };
    
    try {
      await this.writeFile('.agent-logs/context.json', JSON.stringify(logEntry, null, 2));
    } catch (error) {
      console.error('Error guardando contexto:', error);
    }
  }
  
  async search(query: string): Promise<any[]> {
    // Búsqueda simple de archivos que contengan el query en el nombre
    const results: any[] = [];
    
    try {
      const searchInDir = (dir: string) => {
        if (!fs.existsSync(dir)) return;
        
        const files = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const file of files) {
          if (file.name.toLowerCase().includes(query.toLowerCase())) {
            results.push({
              name: file.name,
              path: path.join(dir, file.name),
              type: file.isDirectory() ? 'directory' : 'file',
            });
          }
          
          if (file.isDirectory() && results.length < 50) {
            searchInDir(path.join(dir, file.name));
          }
        }
      };
      
      searchInDir(this.basePath);
    } catch (error) {
      console.error('Error en búsqueda:', error);
    }
    
    return results;
  }
}
