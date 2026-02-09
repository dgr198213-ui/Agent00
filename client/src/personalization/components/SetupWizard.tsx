// ============================================
// COMPONENTE: WIZARD DE CONFIGURACIÓN
// ============================================

import React, { useState } from 'react';
import { UserAgentConfig } from './personalization-types';
import { CredentialManager, CREDENTIAL_TEMPLATES } from './credential-manager';
import { AIDocumentationImporter } from './documentation-importer';
import { MCPConnectorFactory } from './mcp-connector';

export function SetupWizard({ onComplete }: { onComplete: (config: UserAgentConfig) => void }) {
  const [step, setStep] = useState(1);
  const [config, setConfig] = useState<Partial<UserAgentConfig>>({
    agentId: `agent_${Date.now()}`,
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    profile: {
      role: '',
      experience: 'mid',
      focus: [],
      preferences: {},
    },
    plugins: {},
    customRules: [],
    mcpConnectors: {},
    knowledge: {
      documents: [],
      customDomains: [],
    },
  });
  
  const totalSteps = 6;
  
  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      onComplete(config as UserAgentConfig);
    }
  };
  
  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };
  
  const updateConfig = (updates: Partial<UserAgentConfig>) => {
    setConfig({ ...config, ...updates });
  };
  
  return (
    <div className="setup-wizard">
      <div className="wizard-container">
        <div className="wizard-header">
          <h1>🚀 Configura Tu Agente Personalizado</h1>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${(step / totalSteps) * 100}%` }}
            />
          </div>
          <p className="step-indicator">Paso {step} de {totalSteps}</p>
        </div>
        
        <div className="wizard-body">
          {step === 1 && (
            <Step1RoleSelection 
              config={config} 
              updateConfig={updateConfig} 
            />
          )}
          
          {step === 2 && (
            <Step2KnowledgeSources 
              config={config} 
              updateConfig={updateConfig} 
            />
          )}
          
          {step === 3 && (
            <Step3ImportDocumentation 
              config={config} 
              updateConfig={updateConfig} 
            />
          )}
          
          {step === 4 && (
            <Step4CustomRules 
              config={config} 
              updateConfig={updateConfig} 
            />
          )}
          
          {step === 5 && (
            <Step5MCPConnectors 
              config={config} 
              updateConfig={updateConfig} 
            />
          )}
          
          {step === 6 && (
            <Step6Summary 
              config={config} 
            />
          )}
        </div>
        
        <div className="wizard-footer">
          {step > 1 && (
            <button onClick={handleBack} className="btn-secondary">
              ← Atrás
            </button>
          )}
          <button onClick={handleNext} className="btn-primary">
            {step === totalSteps ? '🎉 Finalizar' : 'Siguiente →'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// PASO 1: SELECCIÓN DE ROL
// ============================================

function Step1RoleSelection({ config, updateConfig }: StepProps) {
  const roles = [
    { value: 'backend_dev', label: 'Desarrollador Backend', icon: '⚙️' },
    { value: 'frontend_dev', label: 'Desarrollador Frontend', icon: '🎨' },
    { value: 'fullstack_dev', label: 'Desarrollador Full Stack', icon: '🚀' },
    { value: 'data_scientist', label: 'Data Scientist', icon: '📊' },
    { value: 'devops', label: 'DevOps Engineer', icon: '🔧' },
    { value: 'designer', label: 'Diseñador UI/UX', icon: '✨' },
    { value: 'product_manager', label: 'Product Manager', icon: '📋' },
    { value: 'other', label: 'Otro', icon: '👤' },
  ];
  
  const experiences = ['junior', 'mid', 'senior', 'expert'];
  
  return (
    <div className="step-content">
      <h2>¿Cuál es tu rol principal?</h2>
      <p className="hint">Esto ayudará a personalizar las reglas y sugerencias del agente</p>
      
      <div className="role-grid">
        {roles.map(role => (
          <button
            key={role.value}
            className={`role-card ${config.profile?.role === role.value ? 'selected' : ''}`}
            onClick={() => updateConfig({
              profile: { ...config.profile!, role: role.value }
            })}
          >
            <span className="role-icon">{role.icon}</span>
            <span className="role-label">{role.label}</span>
          </button>
        ))}
      </div>
      
      <div className="experience-selector">
        <label>Nivel de experiencia:</label>
        <div className="experience-buttons">
          {experiences.map(exp => (
            <button
              key={exp}
              className={`exp-btn ${config.profile?.experience === exp ? 'selected' : ''}`}
              onClick={() => updateConfig({
                profile: { ...config.profile!, experience: exp as any }
              })}
            >
              {exp.charAt(0).toUpperCase() + exp.slice(1)}
            </button>
          ))}
        </div>
      </div>
      
      <div className="focus-area">
        <label>Áreas de enfoque (opcional):</label>
        <input
          type="text"
          placeholder="Ej: Node.js, React, PostgreSQL (separados por coma)"
          onChange={(e) => updateConfig({
            profile: { 
              ...config.profile!, 
              focus: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
            }
          })}
        />
      </div>
    </div>
  );
}

// ============================================
// PASO 2: FUENTES DE CONOCIMIENTO
// ============================================

function Step2KnowledgeSources({ config, updateConfig }: StepProps) {
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  
  const sources = [
    { id: 'notebooklm', name: 'NotebookLM', icon: '📓', description: 'Tus cuadernos de notas' },
    { id: 'github', name: 'GitHub', icon: '💻', description: 'Repositorios y commits' },
    { id: 'notion', name: 'Notion', icon: '📝', description: 'Wikis y documentación' },
    { id: 'confluence', name: 'Confluence', icon: '🏢', description: 'Documentación empresarial' },
    { id: 'docs', name: 'Documentos', icon: '📄', description: 'PDFs y Markdown' },
    { id: 'slack', name: 'Slack', icon: '💬', description: 'Conversaciones del equipo' },
  ];
  
  const toggleSource = (sourceId: string) => {
    setSelectedSources(prev => 
      prev.includes(sourceId) 
        ? prev.filter(s => s !== sourceId)
        : [...prev, sourceId]
    );
  };
  
  return (
    <div className="step-content">
      <h2>¿De dónde quieres que aprenda tu agente?</h2>
      <p className="hint">Selecciona las fuentes de conocimiento que deseas conectar</p>
      
      <div className="sources-grid">
        {sources.map(source => (
          <label key={source.id} className="source-card">
            <input
              type="checkbox"
              checked={selectedSources.includes(source.id)}
              onChange={() => toggleSource(source.id)}
            />
            <div className="source-content">
              <span className="source-icon">{source.icon}</span>
              <div>
                <strong>{source.name}</strong>
                <p>{source.description}</p>
              </div>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

// ============================================
// PASO 3: IMPORTAR DOCUMENTACIÓN
// ============================================

function Step3ImportDocumentation({ config, updateConfig }: StepProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };
  
  const handleImport = async () => {
    setImporting(true);
    const importer = new AIDocumentationImporter();
    const importResults = [];
    
    for (const file of files) {
      try {
        const result = await importer.import(file);
        importResults.push(result);
        
        // Agregar reglas al config
        if (result.success) {
          updateConfig({
            customRules: [...(config.customRules || []), ...result.rulesExtracted],
            knowledge: {
              ...config.knowledge!,
              documents: [
                ...(config.knowledge?.documents || []),
                {
                  source: file.name,
                  imported: new Date().toISOString(),
                  rulesExtracted: result.rulesExtracted.length,
                  hash: '', // Calcular hash si es necesario
                },
              ],
            },
          });
        }
      } catch (error) {
        console.error('Error importando:', error);
      }
    }
    
    setResults(importResults);
    setImporting(false);
  };
  
  return (
    <div className="step-content">
      <h2>Importa tu conocimiento base</h2>
      <p className="hint">Sube documentación, guías, mejores prácticas... El agente extraerá reglas automáticamente.</p>
      
      <div className="file-upload-area">
        <input
          type="file"
          multiple
          accept=".md,.txt,.pdf"
          onChange={handleFileSelect}
          id="doc-upload"
          className="file-input"
        />
        <label htmlFor="doc-upload" className="file-upload-label">
          <div className="upload-icon">📁</div>
          <div>
            <strong>Haz clic para seleccionar archivos</strong>
            <p>o arrastra y suelta aquí</p>
            <p className="file-types">Soportado: .md, .txt, .pdf</p>
          </div>
        </label>
      </div>
      
      {files.length > 0 && (
        <div className="selected-files">
          <h3>Archivos seleccionados:</h3>
          <ul>
            {files.map((file, idx) => (
              <li key={idx}>
                {file.name} ({(file.size / 1024).toFixed(2)} KB)
              </li>
            ))}
          </ul>
          <button 
            onClick={handleImport} 
            className="btn-primary"
            disabled={importing}
          >
            {importing ? 'Importando...' : 'Importar y Extraer Reglas'}
          </button>
        </div>
      )}
      
      {results.length > 0 && (
        <div className="import-results">
          <h3>Resultados:</h3>
          {results.map((result, idx) => (
            <div key={idx} className="result-item">
              <strong>{result.metadata.source}</strong>
              <p>✅ {result.rulesExtracted.length} reglas extraídas</p>
              {result.warnings?.length > 0 && (
                <p className="warning">⚠️ {result.warnings.join(', ')}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// PASO 4: REGLAS PERSONALIZADAS
// ============================================

function Step4CustomRules({ config, updateConfig }: StepProps) {
  const roleTemplates: Record<string, any[]> = {
    backend_dev: [
      { name: 'Siempre correr tests antes de deploy', condition: "action.type == 'deploy'", behavior: 'require_tests' },
      { name: 'Validar migrations en DB changes', condition: "files.includes('.sql')", behavior: 'require_migration' },
    ],
    frontend_dev: [
      { name: 'Validar accesibilidad en componentes', condition: "action.type == 'component_create'", behavior: 'check_a11y' },
      { name: 'Optimizar imágenes antes de commit', condition: "files.includes('.jpg') or files.includes('.png')", behavior: 'optimize_images' },
    ],
    devops: [
      { name: 'Validar env vars antes de deploy', condition: "action.type == 'deploy' and target == 'production'", behavior: 'check_env' },
      { name: 'Backup antes de cambios en infra', condition: "files.includes('terraform') or files.includes('k8s')", behavior: 'create_backup' },
    ],
  };
  
  const templates = roleTemplates[config.profile?.role || ''] || [];
  const [selectedTemplates, setSelectedTemplates] = useState<number[]>([]);
  
  const toggleTemplate = (idx: number) => {
    setSelectedTemplates(prev =>
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };
  
  return (
    <div className="step-content">
      <h2>Define tus reglas principales</h2>
      <p className="hint">Reglas sugeridas basadas en tu rol. Puedes agregar más después.</p>
      
      {templates.length > 0 ? (
        <div className="rules-list">
          {templates.map((template, idx) => (
            <label key={idx} className="rule-item">
              <input
                type="checkbox"
                checked={selectedTemplates.includes(idx)}
                onChange={() => toggleTemplate(idx)}
              />
              <div>
                <strong>{template.name}</strong>
                <p className="rule-condition">Condición: {template.condition}</p>
                <p className="rule-behavior">Comportamiento: {template.behavior}</p>
              </div>
            </label>
          ))}
        </div>
      ) : (
        <div className="no-templates">
          <p>No hay plantillas predefinidas para tu rol.</p>
          <p>Podrás crear reglas personalizadas después de la configuración inicial.</p>
        </div>
      )}
    </div>
  );
}

// ============================================
// PASO 5: CONECTORES MCP
// ============================================

function Step5MCPConnectors({ config, updateConfig }: StepProps) {
  return (
    <div className="step-content">
      <h2>Conecta servicios externos (MCP)</h2>
      <p className="hint">Los conectores MCP permiten al agente acceder a fuentes externas de conocimiento</p>
      
      <div className="connector-info">
        <p>📌 Podrás configurar conectores después en el Panel de Credenciales</p>
        <p>Por ahora, continuaremos con la configuración básica.</p>
      </div>
      
      <div className="mcp-preview">
        <h3>Conectores disponibles:</h3>
        <ul>
          <li>📓 NotebookLM - Cuadernos de notas</li>
          <li>💻 GitHub - Repositorios y commits</li>
          <li>📝 Notion - Wikis y bases de conocimiento</li>
          <li>🔌 API Personalizada - Cualquier API REST</li>
        </ul>
      </div>
    </div>
  );
}

// ============================================
// PASO 6: RESUMEN
// ============================================

function Step6Summary({ config }: { config: Partial<UserAgentConfig> }) {
  return (
    <div className="step-content summary">
      <h2>🎉 ¡Tu agente está listo!</h2>
      <p className="hint">Resumen de tu configuración personalizada</p>
      
      <div className="summary-card">
        <div className="summary-section">
          <h3>👤 Perfil</h3>
          <p><strong>Rol:</strong> {config.profile?.role}</p>
          <p><strong>Experiencia:</strong> {config.profile?.experience}</p>
          {config.profile?.focus && config.profile.focus.length > 0 && (
            <p><strong>Enfoque:</strong> {config.profile.focus.join(', ')}</p>
          )}
        </div>
        
        <div className="summary-section">
          <h3>📚 Conocimiento</h3>
          <p><strong>Documentos importados:</strong> {config.knowledge?.documents?.length || 0}</p>
          <p><strong>Reglas personalizadas:</strong> {config.customRules?.length || 0}</p>
        </div>
        
        <div className="summary-section">
          <h3>🔌 Integraciones</h3>
          <p><strong>Conectores MCP:</strong> {Object.keys(config.mcpConnectors || {}).length}</p>
          <p><strong>Plugins habilitados:</strong> {Object.keys(config.plugins || {}).length}</p>
        </div>
      </div>
      
      <div className="next-steps">
        <h3>Próximos pasos:</h3>
        <ol>
          <li>Empieza a interactuar con tu agente</li>
          <li>Registra tus acciones para que aprenda tus patrones</li>
          <li>Configura conectores MCP en el Panel de Credenciales</li>
          <li>Personaliza reglas según sea necesario</li>
        </ol>
      </div>
    </div>
  );
}

// ============================================
// TIPOS
// ============================================

interface StepProps {
  config: Partial<UserAgentConfig>;
  updateConfig: (updates: Partial<UserAgentConfig>) => void;
}

// ============================================
// ESTILOS CSS
// ============================================

export const setupWizardStyles = `
.setup-wizard {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 2rem;
}

.wizard-container {
  background: white;
  border-radius: 12px;
  max-width: 800px;
  width: 100%;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
}

.wizard-header {
  padding: 2rem;
  border-bottom: 1px solid #e0e0e0;
  text-align: center;
}

.wizard-header h1 {
  margin: 0 0 1rem 0;
  color: #333;
}

.progress-bar {
  height: 8px;
  background: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
  margin: 1rem 0;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #667eea, #764ba2);
  transition: width 0.3s ease;
}

.step-indicator {
  color: #666;
  font-size: 0.9rem;
  margin: 0.5rem 0 0 0;
}

.wizard-body {
  padding: 2rem;
  min-height: 400px;
}

.step-content h2 {
  margin: 0 0 0.5rem 0;
  color: #333;
}

.hint {
  color: #666;
  margin: 0 0 2rem 0;
}

.role-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 1rem;
  margin: 2rem 0;
}

.role-card {
  padding: 1.5rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
}

.role-card:hover {
  border-color: #667eea;
  transform: translateY(-2px);
}

.role-card.selected {
  border-color: #667eea;
  background: #f5f7ff;
}

.role-icon {
  font-size: 2rem;
  display: block;
  margin-bottom: 0.5rem;
}

.role-label {
  display: block;
  font-weight: 500;
  font-size: 0.9rem;
}

.experience-selector {
  margin: 2rem 0;
}

.experience-selector label {
  display: block;
  font-weight: 500;
  margin-bottom: 1rem;
}

.experience-buttons {
  display: flex;
  gap: 0.5rem;
}

.exp-btn {
  flex: 1;
  padding: 0.75rem;
  border: 2px solid #e0e0e0;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
}

.exp-btn:hover {
  border-color: #667eea;
}

.exp-btn.selected {
  border-color: #667eea;
  background: #f5f7ff;
}

.focus-area {
  margin: 2rem 0;
}

.focus-area label {
  display: block;
  font-weight: 500;
  margin-bottom: 0.5rem;
}

.focus-area input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}

.sources-grid {
  display: grid;
  gap: 1rem;
}

.source-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.source-card:hover {
  border-color: #667eea;
}

.source-card input:checked ~ .source-content {
  opacity: 1;
}

.source-card input {
  width: 20px;
  height: 20px;
}

.source-content {
  display: flex;
  align-items: center;
  gap: 1rem;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.source-icon {
  font-size: 2rem;
}

.file-upload-area {
  margin: 2rem 0;
}

.file-input {
  display: none;
}

.file-upload-label {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 3rem;
  border: 2px dashed #ddd;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
}

.file-upload-label:hover {
  border-color: #667eea;
  background: #f5f7ff;
}

.upload-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.file-types {
  font-size: 0.85rem;
  color: #999;
  margin-top: 0.5rem;
}

.selected-files {
  margin: 2rem 0;
  padding: 1rem;
  background: #f5f5f5;
  border-radius: 8px;
}

.import-results {
  margin: 2rem 0;
}

.result-item {
  padding: 1rem;
  border-left: 3px solid #4caf50;
  background: #f5f5f5;
  margin: 1rem 0;
}

.rules-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.rule-item {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.rule-item:hover {
  border-color: #667eea;
}

.rule-condition,
.rule-behavior {
  font-size: 0.85rem;
  color: #666;
  margin: 0.25rem 0;
}

.summary-card {
  display: grid;
  gap: 1.5rem;
  margin: 2rem 0;
}

.summary-section {
  padding: 1.5rem;
  background: #f5f5f5;
  border-radius: 8px;
}

.summary-section h3 {
  margin: 0 0 1rem 0;
  color: #333;
}

.summary-section p {
  margin: 0.5rem 0;
}

.next-steps {
  margin-top: 2rem;
  padding: 1.5rem;
  background: #e3f2fd;
  border-radius: 8px;
}

.next-steps ol {
  margin: 1rem 0 0 0;
  padding-left: 1.5rem;
}

.wizard-footer {
  padding: 1.5rem 2rem;
  border-top: 1px solid #e0e0e0;
  display: flex;
  justify-content: space-between;
}
`;
