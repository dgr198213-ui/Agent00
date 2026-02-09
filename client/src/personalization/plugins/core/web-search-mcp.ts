// ============================================
// WEB SEARCH MCP CONNECTOR
// ============================================
// Proporciona acceso a búsqueda web local y extracción de contenido
// Utiliza axios para peticiones HTTP y cheerio para parsing de HTML

import { BaseMCPConnector, MCPResponse, MCPConnectorConfig } from '../../lib/mcp-connector';
import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';

/**
 * Configuración del conector de búsqueda web
 */
export interface WebSearchConfig extends MCPConnectorConfig {
  timeout?: number;              // Timeout en ms
  maxContentLength?: number;     // Longitud máxima del contenido
  userAgent?: string;            // User-Agent para las peticiones
  followRedirects?: boolean;     // Seguir redirecciones
}

/**
 * Interfaz para los resultados de búsqueda
 */
export interface SearchResult {
  url: string;
  title: string;
  description: string;
  content?: string;
  contentLength?: number;
  fetchedAt?: string;
}

/**
 * Conector MCP para búsqueda web local
 */
export class WebSearchMCPConnector extends BaseMCPConnector {
  id = 'websearch_mcp';
  name = 'Web Search';
  type: 'custom' = 'custom';
  description = 'Búsqueda web local con extracción de contenido. Permite acceder y procesar información de URLs sin depender de APIs externas.';
  icon = '🔍';
  
  private axiosInstance: AxiosInstance;
  private timeout: number = 30000;
  private maxContentLength: number = 5 * 1024 * 1024; // 5MB
  private userAgent: string = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
  private followRedirects: boolean = true;
  
  constructor(config?: Partial<WebSearchConfig>) {
    super(config);
    
    if (config?.timeout) {
      this.timeout = config.timeout;
    }
    if (config?.maxContentLength) {
      this.maxContentLength = config.maxContentLength;
    }
    if (config?.userAgent) {
      this.userAgent = config.userAgent;
    }
    if (config?.followRedirects !== undefined) {
      this.followRedirects = config.followRedirects;
    }
    
    // Crear instancia de axios con configuración
    this.axiosInstance = axios.create({
      timeout: this.timeout,
      maxContentLength: this.maxContentLength,
      headers: {
        'User-Agent': this.userAgent,
      },
      maxRedirects: this.followRedirects ? 5 : 0,
    });
    
    this.connected = true;
    this.enabled = true;
  }
  
  /**
   * Valida que una URL sea válida
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Descarga el contenido HTML de una URL
   */
  async fetchUrl(url: string): Promise<MCPResponse> {
    try {
      if (!this.isValidUrl(url)) {
        return { success: false, error: `URL inválida: ${url}` };
      }
      
      const response = await this.axiosInstance.get(url);
      
      if (response.status !== 200) {
        return { success: false, error: `Error HTTP: ${response.status}` };
      }
      
      return {
        success: true,
        data: {
          url,
          html: response.data,
          contentType: response.headers['content-type'],
          contentLength: response.data.length,
        },
        metadata: {
          source: 'Web Search',
          confidence: 1.0,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Error descargando URL: ${error.message}`,
      };
    }
  }
  
  /**
   * Extrae el contenido principal de un HTML
   */
  private extractMainContent(html: string): string {
    try {
      const $ = cheerio.load(html);
      
      // Eliminar elementos no deseados
      $('script, style, nav, footer, .advertisement, .ads, .sidebar').remove();
      
      // Intentar encontrar el contenido principal
      let content = '';
      
      // Buscar en article, main, o div con clase content/main
      const mainSelectors = ['article', 'main', '[role="main"]', '.main-content', '.content', '.article-body'];
      
      for (const selector of mainSelectors) {
        const element = $(selector).first();
        if (element.length > 0) {
          content = element.text();
          break;
        }
      }
      
      // Si no encuentra contenido principal, usar body
      if (!content) {
        content = $('body').text();
      }
      
      // Limpiar espacios en blanco excesivos
      content = content
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 10000); // Limitar a 10k caracteres
      
      return content;
    } catch (error) {
      return '';
    }
  }
  
  /**
   * Extrae el título de una página
   */
  private extractTitle(html: string): string {
    try {
      const $ = cheerio.load(html);
      
      // Intentar diferentes selectores de título
      let title = $('title').text() || 
                  $('h1').first().text() || 
                  $('meta[property="og:title"]').attr('content') || 
                  'Sin título';
      
      return title.trim().substring(0, 200);
    } catch {
      return 'Sin título';
    }
  }
  
  /**
   * Extrae la descripción de una página
   */
  private extractDescription(html: string): string {
    try {
      const $ = cheerio.load(html);
      
      // Intentar diferentes selectores de descripción
      let description = $('meta[name="description"]').attr('content') ||
                        $('meta[property="og:description"]').attr('content') ||
                        $('p').first().text() ||
                        'Sin descripción';
      
      return description.trim().substring(0, 300);
    } catch {
      return 'Sin descripción';
    }
  }
  
  /**
   * Descarga y procesa una URL, extrayendo contenido principal
   */
  async fetchAndParse(url: string): Promise<MCPResponse> {
    try {
      // Descargar HTML
      const fetchResponse = await this.fetchUrl(url);
      if (!fetchResponse.success) {
        return fetchResponse;
      }
      
      const html = fetchResponse.data.html;
      
      // Extraer información
      const title = this.extractTitle(html);
      const description = this.extractDescription(html);
      const content = this.extractMainContent(html);
      
      return {
        success: true,
        data: {
          url,
          title,
          description,
          content,
          contentLength: content.length,
          fetchedAt: new Date().toISOString(),
        },
        metadata: {
          source: 'Web Search',
          confidence: 0.9,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Error procesando URL: ${error.message}`,
      };
    }
  }
  
  /**
   * Busca en una lista de URLs (búsqueda local)
   */
  async searchUrls(urls: string[]): Promise<MCPResponse> {
    try {
      const results: SearchResult[] = [];
      
      for (const url of urls) {
        try {
          const response = await this.fetchAndParse(url);
          if (response.success) {
            results.push({
              url: response.data.url,
              title: response.data.title,
              description: response.data.description,
              content: response.data.content,
              contentLength: response.data.contentLength,
              fetchedAt: response.data.fetchedAt,
            });
          }
        } catch (error) {
          console.error(`Error procesando ${url}:`, error);
        }
      }
      
      return {
        success: results.length > 0,
        data: {
          results,
          count: results.length,
        },
        metadata: {
          source: 'Web Search',
          confidence: results.length > 0 ? 0.9 : 0,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Error en búsqueda: ${error.message}`,
      };
    }
  }
  
  /**
   * Realiza una búsqueda simple por palabra clave en URLs locales
   */
  async searchByKeyword(keyword: string, urls: string[]): Promise<MCPResponse> {
    try {
      const results: SearchResult[] = [];
      const lowerKeyword = keyword.toLowerCase();
      
      for (const url of urls) {
        try {
          const response = await this.fetchAndParse(url);
          if (response.success) {
            const { title, description, content } = response.data;
            
            // Verificar si el keyword aparece en el contenido
            if (
              title.toLowerCase().includes(lowerKeyword) ||
              description.toLowerCase().includes(lowerKeyword) ||
              content.toLowerCase().includes(lowerKeyword)
            ) {
              results.push({
                url,
                title,
                description,
                content: content.substring(0, 500), // Limitar contenido en resultados
                contentLength: content.length,
                fetchedAt: response.data.fetchedAt,
              });
            }
          }
        } catch (error) {
          console.error(`Error procesando ${url}:`, error);
        }
      }
      
      return {
        success: results.length > 0,
        data: {
          keyword,
          results,
          count: results.length,
        },
        metadata: {
          source: 'Web Search',
          confidence: results.length > 0 ? 0.8 : 0,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Error en búsqueda por keyword: ${error.message}`,
      };
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
    if (context?.operation === 'fetchUrl') {
      return this.fetchUrl(context.url);
    } else if (context?.operation === 'fetchAndParse') {
      return this.fetchAndParse(context.url);
    } else if (context?.operation === 'searchUrls') {
      return this.searchUrls(context.urls);
    } else if (context?.operation === 'searchByKeyword') {
      return this.searchByKeyword(context.keyword, context.urls);
    }
    
    return { success: false, error: 'Operación no especificada o no soportada' };
  }
  
  async addContext(data: any): Promise<void> {
    // Guardar contexto de búsqueda
    console.log('Web Search Context:', data);
  }
  
  async search(query: string): Promise<any[]> {
    // Búsqueda simple de URLs que contengan el query
    return [];
  }
}
