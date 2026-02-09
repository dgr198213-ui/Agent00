// ============================================
// GESTOR DE CREDENCIALES SEGURO
// ============================================

import { CredentialStore, EncryptedCredentials } from './personalization-types';

/**
 * Gestor de credenciales con encriptación AES-256-GCM
 * Las credenciales se almacenan encriptadas en localStorage
 * La clave maestra se deriva de una contraseña del usuario
 */
export class CredentialManager {
  private static instance: CredentialManager;
  private masterKey: CryptoKey | null = null;
  private credentials: Map<string, CredentialStore> = new Map();
  
  private constructor() {
    this.loadCredentials();
  }
  
  static getInstance(): CredentialManager {
    if (!CredentialManager.instance) {
      CredentialManager.instance = new CredentialManager();
    }
    return CredentialManager.instance;
  }
  
  // ============================================
  // INICIALIZACIÓN
  // ============================================
  
  /**
   * Inicializa el gestor con contraseña del usuario
   */
  async initialize(password: string): Promise<void> {
    this.masterKey = await this.deriveMasterKey(password);
  }
  
  /**
   * Verifica si el gestor está inicializado
   */
  isInitialized(): boolean {
    return this.masterKey !== null;
  }
  
  // ============================================
  // GESTIÓN DE CREDENCIALES
  // ============================================
  
  /**
   * Guarda credenciales de forma segura
   */
  async saveCredential(
    id: string,
    name: string,
    service: string,
    type: CredentialStore['type'],
    plainCredentials: Record<string, string>
  ): Promise<void> {
    if (!this.masterKey) {
      throw new Error('CredentialManager no inicializado. Llama a initialize() primero.');
    }
    
    // Encriptar credenciales
    const encrypted = await this.encrypt(JSON.stringify(plainCredentials));
    
    const credential: CredentialStore = {
      id,
      name,
      service,
      type,
      credentials: encrypted,
      createdAt: new Date().toISOString(),
      valid: true,
    };
    
    this.credentials.set(id, credential);
    await this.persistCredentials();
  }
  
  /**
   * Obtiene credenciales desencriptadas
   */
  async getCredential(id: string): Promise<Record<string, string> | null> {
    if (!this.masterKey) {
      throw new Error('CredentialManager no inicializado');
    }
    
    const credential = this.credentials.get(id);
    if (!credential) return null;
    
    // Desencriptar
    const decrypted = await this.decrypt(credential.credentials);
    return JSON.parse(decrypted);
  }
  
  /**
   * Lista todas las credenciales (sin datos sensibles)
   */
  listCredentials(): Omit<CredentialStore, 'credentials'>[] {
    return Array.from(this.credentials.values()).map(({ credentials, ...rest }) => rest);
  }
  
  /**
   * Elimina credencial
   */
  async deleteCredential(id: string): Promise<void> {
    this.credentials.delete(id);
    await this.persistCredentials();
  }
  
  /**
   * Actualiza credencial
   */
  async updateCredential(id: string, plainCredentials: Record<string, string>): Promise<void> {
    const credential = this.credentials.get(id);
    if (!credential || !this.masterKey) return;
    
    const encrypted = await this.encrypt(JSON.stringify(plainCredentials));
    credential.credentials = encrypted;
    credential.updatedAt = new Date().toISOString();
    
    await this.persistCredentials();
  }
  
  /**
   * Marca última vez que se usó
   */
  async markUsed(id: string): Promise<void> {
    const credential = this.credentials.get(id);
    if (!credential) return;
    
    credential.lastUsed = new Date().toISOString();
    await this.persistCredentials();
  }
  
  /**
   * Prueba conexión con credencial
   */
  async testCredential(id: string): Promise<boolean> {
    const credential = this.credentials.get(id);
    if (!credential || !credential.testConnection) return false;
    
    try {
      const result = await credential.testConnection();
      credential.valid = result;
      await this.persistCredentials();
      return result;
    } catch (error) {
      credential.valid = false;
      await this.persistCredentials();
      return false;
    }
  }
  
  // ============================================
  // ENCRIPTACIÓN (AES-256-GCM)
  // ============================================
  
  private async encrypt(plaintext: string): Promise<EncryptedCredentials> {
    if (!this.masterKey) throw new Error('Master key no disponible');
    
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);
    
    // Generar IV aleatorio
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // Encriptar
    const encryptedData = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      this.masterKey,
      data
    );
    
    return {
      encrypted: this.arrayBufferToBase64(encryptedData),
      iv: this.arrayBufferToBase64(iv),
      salt: '', // Salt ya usado en derivación de clave
    };
  }
  
  private async decrypt(encrypted: EncryptedCredentials): Promise<string> {
    if (!this.masterKey) throw new Error('Master key no disponible');
    
    const encryptedData = this.base64ToArrayBuffer(encrypted.encrypted);
    const iv = this.base64ToArrayBuffer(encrypted.iv);
    
    const decryptedData = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      this.masterKey,
      encryptedData
    );
    
    const decoder = new TextDecoder();
    return decoder.decode(decryptedData);
  }
  
  /**
   * Deriva clave maestra desde contraseña usando PBKDF2
   */
  private async deriveMasterKey(password: string): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const passwordData = encoder.encode(password);
    
    // Obtener o generar salt
    let salt = localStorage.getItem('credential_salt');
    if (!salt) {
      const saltBuffer = crypto.getRandomValues(new Uint8Array(16));
      salt = this.arrayBufferToBase64(saltBuffer);
      localStorage.setItem('credential_salt', salt);
    }
    
    const saltBuffer = this.base64ToArrayBuffer(salt);
    
    // Importar contraseña como clave
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordData,
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );
    
    // Derivar clave con PBKDF2
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: saltBuffer,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }
  
  // ============================================
  // PERSISTENCIA
  // ============================================
  
  private async persistCredentials(): Promise<void> {
    const data = Array.from(this.credentials.entries()).map(([id, cred]) => ({
      id,
      ...cred,
    }));
    
    localStorage.setItem('encrypted_credentials', JSON.stringify(data));
  }
  
  private loadCredentials(): void {
    const stored = localStorage.getItem('encrypted_credentials');
    if (!stored) return;
    
    try {
      const data = JSON.parse(stored);
      data.forEach((cred: CredentialStore) => {
        this.credentials.set(cred.id, cred);
      });
    } catch (error) {
      console.error('Error cargando credenciales:', error);
    }
  }
  
  // ============================================
  // UTILIDADES
  // ============================================
  
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
  
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
  
  /**
   * Cambia la contraseña maestra (re-encripta todo)
   */
  async changeMasterPassword(oldPassword: string, newPassword: string): Promise<void> {
    // Verificar contraseña anterior
    const tempKey = await this.deriveMasterKey(oldPassword);
    this.masterKey = tempKey;
    
    // Desencriptar todas las credenciales
    const decryptedCreds: Array<{ id: string; data: Record<string, string> }> = [];
    for (const [id, cred] of this.credentials.entries()) {
      const decrypted = await this.decrypt(cred.credentials);
      decryptedCreds.push({ id, data: JSON.parse(decrypted) });
    }
    
    // Generar nueva clave
    this.masterKey = await this.deriveMasterKey(newPassword);
    
    // Re-encriptar todo
    for (const { id, data } of decryptedCreds) {
      const credential = this.credentials.get(id)!;
      const encrypted = await this.encrypt(JSON.stringify(data));
      credential.credentials = encrypted;
    }
    
    await this.persistCredentials();
  }
  
  /**
   * Exporta credenciales encriptadas (para backup)
   */
  async exportCredentials(): Promise<string> {
    const data = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      salt: localStorage.getItem('credential_salt'),
      credentials: Array.from(this.credentials.values()),
    };
    
    return JSON.stringify(data, null, 2);
  }
  
  /**
   * Importa credenciales desde backup
   */
  async importCredentials(backup: string, password: string): Promise<void> {
    const data = JSON.parse(backup);
    
    // Restaurar salt
    if (data.salt) {
      localStorage.setItem('credential_salt', data.salt);
    }
    
    // Inicializar con contraseña
    await this.initialize(password);
    
    // Importar credenciales
    data.credentials.forEach((cred: CredentialStore) => {
      this.credentials.set(cred.id, cred);
    });
    
    await this.persistCredentials();
  }
}

// ============================================
// PLANTILLAS DE CREDENCIALES COMUNES
// ============================================

export const CREDENTIAL_TEMPLATES = {
  notebooklm: {
    name: 'NotebookLM',
    service: 'notebooklm',
    type: 'api_key' as const,
    fields: [
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'password' as const,
        placeholder: 'nlm_xxxxxxxxxxxx',
        required: true,
        validation: (v: string) => v.startsWith('nlm_') || 'API Key debe empezar con nlm_',
      },
      {
        key: 'notebookId',
        label: 'Notebook ID',
        type: 'text' as const,
        placeholder: 'abc123xyz',
        required: true,
      },
    ],
  },
  
  github: {
    name: 'GitHub',
    service: 'github',
    type: 'bearer' as const,
    fields: [
      {
        key: 'token',
        label: 'Personal Access Token',
        type: 'password' as const,
        placeholder: 'ghp_xxxxxxxxxxxx',
        required: true,
        validation: (v: string) => v.startsWith('ghp_') || 'Token debe empezar con ghp_',
      },
    ],
  },
  
  anthropic: {
    name: 'Anthropic Claude API',
    service: 'anthropic',
    type: 'api_key' as const,
    fields: [
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'password' as const,
        placeholder: 'sk-ant-xxxxxxxxxxxx',
        required: true,
        validation: (v: string) => v.startsWith('sk-ant-') || 'API Key debe empezar con sk-ant-',
      },
    ],
  },
  
  notion: {
    name: 'Notion',
    service: 'notion',
    type: 'bearer' as const,
    fields: [
      {
        key: 'token',
        label: 'Integration Token',
        type: 'password' as const,
        placeholder: 'secret_xxxxxxxxxxxx',
        required: true,
      },
      {
        key: 'databaseId',
        label: 'Database ID (opcional)',
        type: 'text' as const,
        placeholder: '1234567890abcdef',
        required: false,
      },
    ],
  },
  
  custom: {
    name: 'API Personalizada',
    service: 'custom',
    type: 'custom' as const,
    fields: [
      {
        key: 'endpoint',
        label: 'Endpoint URL',
        type: 'url' as const,
        placeholder: 'https://api.example.com',
        required: true,
      },
      {
        key: 'apiKey',
        label: 'API Key / Token',
        type: 'password' as const,
        placeholder: 'Tu API key',
        required: true,
      },
      {
        key: 'authHeader',
        label: 'Header de Autenticación',
        type: 'text' as const,
        placeholder: 'Authorization / X-API-Key',
        required: false,
      },
    ],
  },
};
