// ============================================
// COMPONENTE: PANEL DE CREDENCIALES
// ============================================

import React, { useState, useEffect } from 'react';
import { CredentialManager, CREDENTIAL_TEMPLATES } from '../lib/credential-manager';
import { CredentialStore, CredentialField } from '../lib/personalization-types';

export function CredentialPanel() {
  const [credentialManager] = useState(() => CredentialManager.getInstance());
  const [isInitialized, setIsInitialized] = useState(false);
  const [masterPassword, setMasterPassword] = useState('');
  const [credentials, setCredentials] = useState<Omit<CredentialStore, 'credentials'>[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  
  useEffect(() => {
    setIsInitialized(credentialManager.isInitialized());
    if (credentialManager.isInitialized()) {
      loadCredentials();
    }
  }, []);
  
  const loadCredentials = () => {
    setCredentials(credentialManager.listCredentials());
  };
  
  const handleInitialize = async () => {
    if (!masterPassword) {
      alert('Ingresa una contraseña maestra');
      return;
    }
    
    try {
      await credentialManager.initialize(masterPassword);
      setIsInitialized(true);
      loadCredentials();
    } catch (error) {
      alert('Error inicializando gestor de credenciales');
    }
  };
  
  const handleAddCredential = () => {
    setShowAddModal(true);
  };
  
  const handleDeleteCredential = async (id: string) => {
    if (!confirm('¿Eliminar esta credencial?')) return;
    
    await credentialManager.deleteCredential(id);
    loadCredentials();
  };
  
  const handleTestCredential = async (id: string) => {
    const result = await credentialManager.testCredential(id);
    alert(result ? '✅ Conexión exitosa' : '❌ Error en conexión');
    loadCredentials();
  };
  
  // ============================================
  // RENDERIZADO
  // ============================================
  
  if (!isInitialized) {
    return (
      <div className="credential-panel-init">
        <div className="init-container">
          <h2>🔐 Inicializa el Gestor de Credenciales</h2>
          <p>Para guardar credenciales de forma segura, necesitas establecer una contraseña maestra.</p>
          
          <div className="init-form">
            <input
              type="password"
              placeholder="Contraseña maestra"
              value={masterPassword}
              onChange={(e) => setMasterPassword(e.target.value)}
              className="master-password-input"
            />
            <button onClick={handleInitialize} className="btn-primary">
              Inicializar
            </button>
          </div>
          
          <div className="security-info">
            <h3>ℹ️ Información de Seguridad</h3>
            <ul>
              <li>Tus credenciales se encriptan con AES-256-GCM</li>
              <li>La contraseña maestra NO se almacena</li>
              <li>Necesitarás esta contraseña cada vez que abras la app</li>
              <li>Si olvidas la contraseña, perderás acceso a las credenciales</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="credential-panel">
      <div className="panel-header">
        <h2>🔐 Gestión de Credenciales</h2>
        <button onClick={handleAddCredential} className="btn-primary">
          + Agregar Credencial
        </button>
      </div>
      
      {credentials.length === 0 ? (
        <div className="empty-state">
          <p>No hay credenciales configuradas</p>
          <p className="hint">Agrega credenciales para conectar con servicios externos</p>
        </div>
      ) : (
        <div className="credentials-grid">
          {credentials.map(cred => (
            <CredentialCard
              key={cred.id}
              credential={cred}
              onTest={() => handleTestCredential(cred.id)}
              onDelete={() => handleDeleteCredential(cred.id)}
            />
          ))}
        </div>
      )}
      
      {showAddModal && (
        <AddCredentialModal
          templates={CREDENTIAL_TEMPLATES}
          onClose={() => setShowAddModal(false)}
          onSave={async (id, name, service, type, values) => {
            await credentialManager.saveCredential(id, name, service, type, values);
            loadCredentials();
            setShowAddModal(false);
          }}
        />
      )}
    </div>
  );
}

// ============================================
// COMPONENTE: TARJETA DE CREDENCIAL
// ============================================

function CredentialCard({ 
  credential, 
  onTest, 
  onDelete 
}: { 
  credential: Omit<CredentialStore, 'credentials'>;
  onTest: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={`credential-card ${credential.valid ? 'valid' : 'invalid'}`}>
      <div className="card-header">
        <h3>{credential.name}</h3>
        <span className={`status-badge ${credential.valid ? 'valid' : 'invalid'}`}>
          {credential.valid ? '✅ Válida' : '⚠️ Inválida'}
        </span>
      </div>
      
      <div className="card-body">
        <div className="info-row">
          <span className="label">Servicio:</span>
          <span className="value">{credential.service}</span>
        </div>
        <div className="info-row">
          <span className="label">Tipo:</span>
          <span className="value">{credential.type}</span>
        </div>
        <div className="info-row">
          <span className="label">Creada:</span>
          <span className="value">{new Date(credential.createdAt).toLocaleDateString()}</span>
        </div>
        {credential.lastUsed && (
          <div className="info-row">
            <span className="label">Último uso:</span>
            <span className="value">{new Date(credential.lastUsed).toLocaleDateString()}</span>
          </div>
        )}
      </div>
      
      <div className="card-actions">
        <button onClick={onTest} className="btn-secondary">
          Probar Conexión
        </button>
        <button onClick={onDelete} className="btn-danger">
          Eliminar
        </button>
      </div>
    </div>
  );
}

// ============================================
// COMPONENTE: MODAL AGREGAR CREDENCIAL
// ============================================

function AddCredentialModal({ 
  templates, 
  onClose, 
  onSave 
}: {
  templates: typeof CREDENTIAL_TEMPLATES;
  onClose: () => void;
  onSave: (id: string, name: string, service: string, type: any, values: Record<string, string>) => Promise<void>;
}) {
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const template = selectedTemplate ? templates[selectedTemplate as keyof typeof templates] : null;
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!template) return;
    
    // Validar campos
    const newErrors: Record<string, string> = {};
    template.fields.forEach(field => {
      if (field.required && !formValues[field.key]) {
        newErrors[field.key] = 'Campo requerido';
      }
      if (field.validation && formValues[field.key]) {
        const result = field.validation(formValues[field.key]);
        if (result !== true) {
          newErrors[field.key] = typeof result === 'string' ? result : 'Valor inválido';
        }
      }
    });
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    // Guardar
    const id = `${template.service}_${Date.now()}`;
    await onSave(id, template.name, template.service, template.type, formValues);
  };
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Agregar Credencial</h2>
          <button onClick={onClose} className="btn-close">×</button>
        </div>
        
        <div className="modal-body">
          {!selectedTemplate ? (
            <div className="template-selector">
              <h3>Selecciona un servicio:</h3>
              <div className="template-grid">
                {Object.entries(templates).map(([key, tmpl]) => (
                  <button
                    key={key}
                    className="template-card"
                    onClick={() => setSelectedTemplate(key)}
                  >
                    <div className="template-name">{tmpl.name}</div>
                    <div className="template-service">{tmpl.service}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="credential-form">
              <h3>{template!.name}</h3>
              
              {template!.fields.map(field => (
                <div key={field.key} className="form-group">
                  <label>
                    {field.label}
                    {field.required && <span className="required">*</span>}
                  </label>
                  <input
                    type={field.type}
                    placeholder={field.placeholder}
                    value={formValues[field.key] || ''}
                    onChange={(e) => setFormValues({
                      ...formValues,
                      [field.key]: e.target.value
                    })}
                    className={errors[field.key] ? 'error' : ''}
                  />
                  {errors[field.key] && (
                    <span className="error-message">{errors[field.key]}</span>
                  )}
                </div>
              ))}
              
              <div className="form-actions">
                <button type="button" onClick={() => setSelectedTemplate('')} className="btn-secondary">
                  Atrás
                </button>
                <button type="submit" className="btn-primary">
                  Guardar Credencial
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// ESTILOS CSS
// ============================================

export const credentialPanelStyles = `
.credential-panel {
  padding: 2rem;
}

.credential-panel-init {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 60vh;
}

.init-container {
  max-width: 500px;
  padding: 2rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  background: white;
}

.init-form {
  display: flex;
  gap: 1rem;
  margin: 2rem 0;
}

.master-password-input {
  flex: 1;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}

.security-info {
  margin-top: 2rem;
  padding: 1rem;
  background: #f5f5f5;
  border-radius: 4px;
}

.security-info h3 {
  margin-top: 0;
}

.security-info ul {
  font-size: 0.9rem;
  color: #666;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.credentials-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
}

.credential-card {
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  padding: 1.5rem;
  background: white;
}

.credential-card.valid {
  border-color: #4caf50;
}

.credential-card.invalid {
  border-color: #f44336;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 500;
}

.status-badge.valid {
  background: #e8f5e9;
  color: #2e7d32;
}

.status-badge.invalid {
  background: #ffebee;
  color: #c62828;
}

.info-row {
  display: flex;
  justify-content: space-between;
  margin: 0.5rem 0;
  font-size: 0.9rem;
}

.info-row .label {
  color: #666;
}

.info-row .value {
  font-weight: 500;
}

.card-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
}

.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  color: #999;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  max-width: 600px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e0e0e0;
}

.modal-body {
  padding: 1.5rem;
}

.btn-close {
  background: none;
  border: none;
  font-size: 2rem;
  cursor: pointer;
  color: #999;
}

.template-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.template-card {
  padding: 1.5rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  cursor: pointer;
  background: white;
  transition: all 0.2s;
}

.template-card:hover {
  border-color: #2196f3;
  transform: translateY(-2px);
}

.template-name {
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.template-service {
  font-size: 0.85rem;
  color: #666;
}

.credential-form {
  max-width: 400px;
  margin: 0 auto;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.required {
  color: #f44336;
  margin-left: 0.25rem;
}

.form-group input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}

.form-group input.error {
  border-color: #f44336;
}

.error-message {
  display: block;
  margin-top: 0.25rem;
  color: #f44336;
  font-size: 0.85rem;
}

.form-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 2rem;
}

.btn-primary {
  padding: 0.75rem 1.5rem;
  background: #2196f3;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
}

.btn-primary:hover {
  background: #1976d2;
}

.btn-secondary {
  padding: 0.75rem 1.5rem;
  background: #e0e0e0;
  color: #333;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
}

.btn-secondary:hover {
  background: #d0d0d0;
}

.btn-danger {
  padding: 0.75rem 1.5rem;
  background: #f44336;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
}

.btn-danger:hover {
  background: #d32f2f;
}
`;
