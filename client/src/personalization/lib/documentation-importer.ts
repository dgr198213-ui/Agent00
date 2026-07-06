// ============================================
// IMPORTADOR DE DOCUMENTACIÓN CON IA
// ============================================

import { DocumentImporter, ImportResult, ValidationResult } from './personalization-types';
import { Rule, Pattern } from './types';

/**
 * Importador que usa Claude API para extraer reglas de documentación
 */
export class AIDocumentationImporter implements DocumentImporter {
  id = 'ai_doc_importer';
  name = 'Importador de Documentación con IA';
  supportedFormats = ['.md', '.txt', '.pdf'];
  
  private anthropicApiKey: string = '';
  
  constructor(apiKey?: string) {
    if (apiKey) {
      this.anthropicApiKey = apiKey;
    }
  }
  
  async import(file: File | string): Promise<ImportResult> {
    const startTime = Date.now();
    let content: string;
    let source: string;
    let fileSize: number;
    
    // Leer contenido
    if (typeof file === 'string') {
      content = file;
      source = 'string';
      fileSize = content.length;
    } else {
      content = await this.readFile(file);
      source = file.name;
      fileSize = file.size;
    }
    
    // Validar contenido
    const validation = await this.validate(content);
    if (!validation.valid) {
      return {
        success: false,
        rulesExtracted: [],
        domainsCreated: [],
        patternsDetected: [],
        errors: validation.errors,
        warnings: validation.warnings,
        metadata: {
          source,
          importedAt: new Date().toISOString(),
          fileSize,
          processingTime: Date.now() - startTime,
        },
      };
    }
    
    // Extraer reglas usando IA
    const rules = await this.extractRules(content);
    
    // Detectar patrones en el contenido
    const patterns = await this.detectPatterns(content);
    
    // Identificar dominios
    const domains = this.identifyDomains(rules);
    
    return {
      success: true,
      rulesExtracted: rules,
      domainsCreated: domains,
      patternsDetected: patterns,
      warnings: validation.warnings,
      metadata: {
        source,
        importedAt: new Date().toISOString(),
        fileSize,
        processingTime: Date.now() - startTime,
      },
    };
  }
  
  async extractRules(content: string): Promise<Rule[]> {
    if (!this.anthropicApiKey) {
      // Fallback: extracción básica sin IA
      return this.basicRuleExtraction(content);
    }
    
    // Usar Claude para extraer reglas
    const prompt = `
Analiza este documento y extrae todas las reglas, mejores prácticas, y recomendaciones.

Para cada regla identifica:
1. Nombre descriptivo
2. Condición (expresión evaluable, usa sintaxis: "campo.subcampo operador valor")
3. Comportamiento recomendado
4. Categoría (safety, efficiency, quality, security, other)
5. Nivel de criticidad (low, medium, high, critical)

Operadores válidos: ==, !=, >, <, >=, <=, and, or, in
Ejemplos de condiciones:
- "action.type == 'deploy' and target == 'production'"
- "file.size > 10MB"
- "action.type in ['delete', 'remove']"

Documento:
${content.substring(0, 15000)} ${content.length > 15000 ? '...(truncado)' : ''}

Responde SOLO con un array JSON, sin texto adicional:
[
  {
    "name": "Nombre de la regla",
    "condition": "expresión evaluable",
    "behavior": "acción recomendada",
    "category": "safety|efficiency|quality|security|other",
    "priority": "low|medium|high|critical",
    "description": "explicación breve"
  }
]
`;
    
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.anthropicApiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Claude API error: ${response.status}`);
      }
      
      const data = await response.json();
      const textContent = data.content[0].text;
      
      // Extraer JSON (puede venir con markdown code blocks)
      let jsonText = textContent.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\n?/g, '');
      }
      
      const extractedRules = JSON.parse(jsonText);
      
      // Convertir a formato Rule
      return extractedRules.map((r: any, index: number) => ({
        id: `doc_${Date.now()}_${index}`,
        name: r.name,
        category: r.category || 'other',
        condition: r.condition,
        behavior: r.behavior,
        confidence: this.calculateConfidence(r.priority || 'medium'),
        active: true,
        createdAt: new Date().toISOString(),
        source: 'documentation',
        description: r.description,
        performance: 0.5,
      }));
    } catch (error) {
      console.error('Error usando Claude API:', error);
      // Fallback a extracción básica
      return this.basicRuleExtraction(content);
    }
  }
  
  /**
   * Extracción básica sin IA (regex patterns)
   */
  private basicRuleExtraction(content: string): Rule[] {
    const rules: Rule[] = [];
    const lines = content.split('\n');
    
    // Patrones comunes en documentación
    const patterns = [
      /(?:regla|rule|must|should|always|never):\s*(.+)/gi,
      /(?:⚠️|⚡|🔒|✅)\s*(.+)/g,
      /(?:importante|important|critical|crucial):\s*(.+)/gi,
    ];
    
    lines.forEach((line, index) => {
      patterns.forEach(pattern => {
        const matches = line.match(pattern);
        if (matches) {
          rules.push({
            id: `basic_${Date.now()}_${index}`,
            name: matches[0].substring(0, 50),
            category: 'other',
            condition: 'true', // Requiere revisión manual
            behavior: line.trim(),
            confidence: 0.5,
            active: false, // Deshabilitada por defecto para revisión
            priority: 50,
            createdAt: new Date(),
            updatedAt: new Date(),
            description: 'Extraída automáticamente. Requiere revisión.',
            metadata: { source: 'basic_extraction', performance: 0.5 },
          });
        }
      });
    });
    
    return rules;
  }
  
  /**
   * Detecta patrones mencionados en la documentación
   */
  private async detectPatterns(content: string): Promise<Pattern[]> {
    const patterns: Pattern[] = [];
    
    // Buscar secciones sobre workflows
    const workflowMatches = content.match(/(?:workflow|flujo|proceso):\s*(.+?)(?:\n\n|\n#)/gis);
    if (workflowMatches) {
      workflowMatches.forEach((match, index) => {
        patterns.push({
          id: `pattern_${Date.now()}_${index}`,
          type: 'sequential',
          name: `workflow_${index}`,
          description: match.trim(),
          confidence: 0.7,
          occurrences: 0,
          lastDetected: new Date(),
          suggestedRule: { name: `workflow_${index}` },
        });
      });
    }
    
    return patterns;
  }
  
  /**
   * Identifica dominios de conocimiento
   */
  private identifyDomains(rules: Rule[]): string[] {
    const domains = new Set<string>();
    
    rules.forEach(rule => {
      // Extraer dominios de las categorías
      if (rule.category) {
        domains.add(rule.category);
      }
      
      // Extraer dominios de palabras clave en el nombre
      const keywords = ['deploy', 'test', 'security', 'database', 'api', 'frontend', 'backend'];
      keywords.forEach(keyword => {
        if (rule.name.toLowerCase().includes(keyword)) {
          domains.add(keyword);
        }
      });
    });
    
    return Array.from(domains);
  }
  
  async validate(content: string): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];
    
    // Validaciones básicas
    if (content.length < 100) {
      errors.push('Documento muy corto (menos de 100 caracteres)');
    }
    
    if (content.length > 100000) {
      warnings.push('Documento muy largo. Se procesarán solo los primeros 100KB.');
    }
    
    // Detectar si es código en lugar de documentación
    const codePatterns = [
      /function\s+\w+\s*\(/g,
      /class\s+\w+\s*{/g,
      /const\s+\w+\s*=/g,
      /import\s+.+from/g,
    ];
    
    let codeMatches = 0;
    codePatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) codeMatches += matches.length;
    });
    
    if (codeMatches > 10) {
      warnings.push('Parece contener mucho código. Las reglas pueden no extraerse correctamente.');
      suggestions.push('Considera usar documentación en formato Markdown con secciones claras.');
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }
  
  /**
   * Lee archivo
   */
  private async readFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const content = e.target?.result as string;
        resolve(content);
      };
      
      reader.onerror = () => {
        reject(new Error('Error leyendo archivo'));
      };
      
      reader.readAsText(file);
    });
  }
  
  /**
   * Calcula confianza basándose en prioridad
   */
  private calculateConfidence(priority: string): number {
    switch (priority) {
      case 'critical': return 0.95;
      case 'high': return 0.85;
      case 'medium': return 0.7;
      case 'low': return 0.6;
      default: return 0.5;
    }
  }
}

// ============================================
// IMPORTADOR DE MARKDOWN ESTRUCTURADO
// ============================================

export class MarkdownImporter implements DocumentImporter {
  id = 'markdown_importer';
  name = 'Importador Markdown';
  supportedFormats = ['.md'];
  
  async import(file: File | string): Promise<ImportResult> {
    const startTime = Date.now();
    let content: string;
    let source: string;
    
    if (typeof file === 'string') {
      content = file;
      source = 'string';
    } else {
      content = await this.readFile(file);
      source = file.name;
    }
    
    const rules = await this.extractRules(content);
    const domains = this.extractDomains(content);
    
    return {
      success: true,
      rulesExtracted: rules,
      domainsCreated: domains,
      patternsDetected: [],
      metadata: {
        source,
        importedAt: new Date().toISOString(),
        fileSize: content.length,
        processingTime: Date.now() - startTime,
      },
    };
  }
  
  async extractRules(content: string): Promise<Rule[]> {
    const rules: Rule[] = [];
    
    // Buscar bloques con formato específico
    // Ejemplo:
    // ## Regla: Nombre
    // **Condición:** expresión
    // **Comportamiento:** acción
    
    const ruleBlocks = content.split(/##\s+Regla:/i);
    
    ruleBlocks.slice(1).forEach((block, index) => {
      const lines = block.split('\n');
      const name = lines[0].trim();
      
      let condition = 'true';
      let behavior = '';
      let category = 'other';
      
      lines.forEach(line => {
        if (line.match(/\*\*Condición:\*\*/i)) {
          condition = line.replace(/\*\*Condición:\*\*/i, '').trim();
        }
        if (line.match(/\*\*Comportamiento:\*\*/i)) {
          behavior = line.replace(/\*\*Comportamiento:\*\*/i, '').trim();
        }
        if (line.match(/\*\*Categoría:\*\*/i)) {
          category = line.replace(/\*\*Categoría:\*\*/i, '').trim();
        }
      });
      
      if (condition && behavior) {
        rules.push({
          id: `md_${Date.now()}_${index}`,
          name,
          category,
          condition,
          behavior,
          description: null,
          confidence: 0.8,
          active: true,
          priority: 50,
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: { source: 'markdown', performance: 0.5 },
        });
      }
    });
    
    return rules;
  }
  
  async validate(content: string): Promise<ValidationResult> {
    return {
      valid: content.length > 0,
      errors: [],
      warnings: [],
      suggestions: [],
    };
  }
  
  private extractDomains(content: string): string[] {
    const domains = new Set<string>();
    const headers = content.match(/^#+\s+(.+)$/gm);
    
    if (headers) {
      headers.forEach(header => {
        const text = header.replace(/^#+\s+/, '').toLowerCase();
        domains.add(text);
      });
    }
    
    return Array.from(domains);
  }
  
  private async readFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = () => reject(new Error('Error leyendo archivo'));
      reader.readAsText(file);
    });
  }
}
