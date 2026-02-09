// ============================================
// CONECTOR MCP UNIVERSAL
// ============================================

import { MCPConnector, MCPResponse, MCPConnectorConfig } from './personalization-types';
import { CredentialManager } from './credential-manager';

/**
 * Clase base para conectores MCP
 */
export abstract class BaseMCPConnector implements MCPConnector {
  id: string;
  name: string;
  type: MCPConnector['type'];
  description: string;
  icon: string;
  config: MCPConnectorConfig;
  enabled: boolean = false;
  connected: boolean = false;
  lastSync?: string;
  
  protected credentialManager: CredentialManager;
  
  constructor(config: Partial<MCPConnectorConfig> = {}) {
    this.config = {
      requiresAuth: true,
      authType: 'api_key',
      ...config,
    };
    this.credentialManager = CredentialManager.getInstance();
  }
  
  abstract connect(credentials: Record<string, string>): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract query(prompt: string, context?: any): Promise<MCPResponse>;
  abstract addContext(data: any): Promise<void>;
  abstract search(query: string): Promise<any[]>;
  
  async sync(): Promise<void> {
    this.lastSync = new Date().toISOString();
  }
  
  protected async getCredentials(): Promise<Record<string, string>> {
    const creds = await this.credentialManager.getCredential(this.id);
    if (!creds) {
      throw new Error(`No hay credenciales para ${this.name}`);
    }
    return creds;
  }
}

// ============================================
// CONECTOR NOTEBOOKLM
// ============================================

export class NotebookLMConnector extends BaseMCPConnector {
  id = 'notebooklm';
  name = 'NotebookLM';
  type: MCPConnector['type'] = 'notebooklm';
  description = 'Conecta con tus cuadernos de NotebookLM';
  icon = '📓';
  
  private notebookId: string = '';
  
  async connect(credentials: Record<string, string>): Promise<void> {
    // Guardar credenciales de forma segura
    await this.credentialManager.saveCredential(
      this.id,
      this.name,
      'notebooklm',
      'api_key',
      credentials
    );
    
    this.notebookId = credentials.notebookId;
    
    // Probar conexión
    try {
      const testResponse = await fetch(`${this.config.endpoint}/notebooks/${this.notebookId}`, {
        headers: {
          'Authorization': `Bearer ${credentials.apiKey}`,
        },
      });
      
      if (!testResponse.ok) {
        throw new Error('Credenciales inválidas');
      }
      
      this.connected = true;
      this.enabled = true;
    } catch (error) {
      this.connected = false;
      throw new Error(`Error conectando a NotebookLM: ${error.message}`);
    }
  }
  
  async disconnect(): Promise<void> {
    this.connected = false;
    this.enabled = false;
  }
  
  async query(prompt: string, context?: any): Promise<MCPResponse> {
    const creds = await this.getCredentials();
    
    try {
      const response = await fetch(`${this.config.endpoint}/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${creds.apiKey}`,
        },
        body: JSON.stringify({
          notebook_id: creds.notebookId,
          prompt,
          context,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      return {
        success: true,
        data: data.response,
        metadata: {
          source: 'NotebookLM',
          confidence: data.confidence || 0.8,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
  
  async addContext(data: any): Promise<void> {
    const creds = await this.getCredentials();
    
    await fetch(`${this.config.endpoint}/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${creds.apiKey}`,
      },
      body: JSON.stringify({
        notebook_id: creds.notebookId,
        content: typeof data === 'string' ? data : JSON.stringify(data),
      }),
    });
  }
  
  async search(query: string): Promise<any[]> {
    const creds = await this.getCredentials();
    
    const response = await fetch(`${this.config.endpoint}/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${creds.apiKey}`,
      },
      body: JSON.stringify({
        notebook_id: creds.notebookId,
        query,
        max_results: this.config.options?.maxResults || 10,
      }),
    });
    
    const data = await response.json();
    return data.results || [];
  }
}

// ============================================
// CONECTOR GITHUB
// ============================================

export class GitHubConnector extends BaseMCPConnector {
  id = 'github';
  name = 'GitHub';
  type: MCPConnector['type'] = 'github';
  description = 'Conecta con tus repositorios de GitHub';
  icon = '💻';
  
  private repos: string[] = [];
  
  async connect(credentials: Record<string, string>): Promise<void> {
    await this.credentialManager.saveCredential(
      this.id,
      this.name,
      'github',
      'bearer',
      credentials
    );
    
    // Probar conexión
    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${credentials.token}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Token inválido');
      }
      
      this.connected = true;
      this.enabled = true;
      
      // Obtener repos del usuario
      if (credentials.repos) {
        this.repos = credentials.repos.split(',').map(r => r.trim());
      }
    } catch (error) {
      this.connected = false;
      throw new Error(`Error conectando a GitHub: ${error.message}`);
    }
  }
  
  async disconnect(): Promise<void> {
    this.connected = false;
    this.enabled = false;
  }
  
  async query(prompt: string, context?: any): Promise<MCPResponse> {
    // Para GitHub, el "query" busca en commits, issues, PRs
    const results = await this.search(prompt);
    
    return {
      success: true,
      data: results,
      metadata: {
        source: 'GitHub',
        confidence: 0.9,
        timestamp: new Date().toISOString(),
      },
    };
  }
  
  async addContext(data: any): Promise<void> {
    // En GitHub, "addContext" podría crear un issue o comentario
    const creds = await this.getCredentials();
    
    // Ejemplo: Crear issue en el primer repo
    if (this.repos.length === 0) return;
    
    const [owner, repo] = this.repos[0].split('/');
    
    await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${creds.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Context from Copilot',
        body: typeof data === 'string' ? data : JSON.stringify(data, null, 2),
        labels: ['copilot-context'],
      }),
    });
  }
  
  async search(query: string): Promise<any[]> {
    const creds = await this.getCredentials();
    const results: any[] = [];
    
    // Buscar en cada repo configurado
    for (const repoPath of this.repos) {
      const [owner, repo] = repoPath.split('/');
      
      // Buscar commits
      const commitsResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/commits?per_page=10`,
        {
          headers: {
            'Authorization': `Bearer ${creds.token}`,
          },
        }
      );
      
      if (commitsResponse.ok) {
        const commits = await commitsResponse.json();
        const filtered = commits.filter((c: any) => 
          c.commit.message.toLowerCase().includes(query.toLowerCase())
        );
        results.push(...filtered.map((c: any) => ({
          type: 'commit',
          repo: repoPath,
          message: c.commit.message,
          author: c.commit.author.name,
          date: c.commit.author.date,
          sha: c.sha,
        })));
      }
    }
    
    return results;
  }
  
  /**
   * Obtiene últimos commits de los repos configurados
   */
  async getRecentCommits(limit: number = 50): Promise<any[]> {
    const creds = await this.getCredentials();
    const allCommits: any[] = [];
    
    for (const repoPath of this.repos) {
      const [owner, repo] = repoPath.split('/');
      
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/commits?per_page=${limit}`,
        {
          headers: {
            'Authorization': `Bearer ${creds.token}`,
          },
        }
      );
      
      if (response.ok) {
        const commits = await response.json();
        allCommits.push(...commits);
      }
    }
    
    return allCommits;
  }
}

// ============================================
// CONECTOR CUSTOM API
// ============================================

export class CustomAPIConnector extends BaseMCPConnector {
  id = 'custom_api';
  name = 'API Personalizada';
  type: MCPConnector['type'] = 'custom';
  description = 'Conecta con cualquier API REST';
  icon = '🔌';
  
  private endpoint: string = '';
  private authHeader: string = 'Authorization';
  
  async connect(credentials: Record<string, string>): Promise<void> {
    await this.credentialManager.saveCredential(
      this.id,
      this.name,
      'custom',
      'custom',
      credentials
    );
    
    this.endpoint = credentials.endpoint;
    this.authHeader = credentials.authHeader || 'Authorization';
    
    // Probar conexión (asume que /health o / responde)
    try {
      const response = await fetch(this.endpoint, {
        headers: {
          [this.authHeader]: credentials.apiKey,
        },
      });
      
      this.connected = response.ok;
      this.enabled = response.ok;
    } catch (error) {
      this.connected = false;
      throw new Error(`Error conectando a API: ${error.message}`);
    }
  }
  
  async disconnect(): Promise<void> {
    this.connected = false;
    this.enabled = false;
  }
  
  async query(prompt: string, context?: any): Promise<MCPResponse> {
    const creds = await this.getCredentials();
    
    try {
      const response = await fetch(`${this.endpoint}/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [this.authHeader]: creds.apiKey,
        },
        body: JSON.stringify({ prompt, context }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      return {
        success: true,
        data,
        metadata: {
          source: 'Custom API',
          confidence: 0.7,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
  
  async addContext(data: any): Promise<void> {
    const creds = await this.getCredentials();
    
    await fetch(`${this.endpoint}/context`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [this.authHeader]: creds.apiKey,
      },
      body: JSON.stringify(data),
    });
  }
  
  async search(query: string): Promise<any[]> {
    const creds = await this.getCredentials();
    
    const response = await fetch(`${this.endpoint}/search?q=${encodeURIComponent(query)}`, {
      headers: {
        [this.authHeader]: creds.apiKey,
      },
    });
    
    const data = await response.json();
    return data.results || [];
  }
}

// ============================================
// FACTORY DE CONECTORES
// ============================================

export class MCPConnectorFactory {
  private static connectors: Map<string, BaseMCPConnector> = new Map();
  
  static create(type: MCPConnector['type'], config?: Partial<MCPConnectorConfig>): BaseMCPConnector {
    let connector: BaseMCPConnector;
    
    switch (type) {
      case 'notebooklm':
        connector = new NotebookLMConnector(config);
        break;
      case 'github':
        connector = new GitHubConnector(config);
        break;
      case 'custom':
        connector = new CustomAPIConnector(config);
        break;
      default:
        throw new Error(`Tipo de conector desconocido: ${type}`);
    }
    
    this.connectors.set(connector.id, connector);
    return connector;
  }
  
  static get(id: string): BaseMCPConnector | undefined {
    return this.connectors.get(id);
  }
  
  static getAll(): BaseMCPConnector[] {
    return Array.from(this.connectors.values());
  }
  
  static getConnected(): BaseMCPConnector[] {
    return this.getAll().filter(c => c.connected);
  }
}
