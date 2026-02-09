// ============================================
// COMPONENTE: GESTOR DE PLUGINS
// ============================================

import React, { useState, useEffect } from 'react';
import { PluginRegistry, registerBuiltInPlugins } from './plugin-registry';
import { CopilotPlugin } from './personalization-types';

export function PluginManager() {
  const [registry] = useState(() => {
    const reg = PluginRegistry.getInstance();
    registerBuiltInPlugins(reg);
    return reg;
  });
  
  const [plugins, setPlugins] = useState<CopilotPlugin[]>([]);
  const [filter, setFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPlugin, setSelectedPlugin] = useState<CopilotPlugin | null>(null);
  
  useEffect(() => {
    loadPlugins();
  }, [filter, selectedCategory]);
  
  const loadPlugins = () => {
    let pluginList = registry.getAll();
    
    if (filter === 'enabled') {
      pluginList = pluginList.filter(p => p.enabled);
    } else if (filter === 'disabled') {
      pluginList = pluginList.filter(p => !p.enabled);
    }
    
    if (selectedCategory !== 'all') {
      pluginList = pluginList.filter(p => p.category === selectedCategory);
    }
    
    setPlugins(pluginList);
  };
  
  const handleTogglePlugin = async (pluginId: string, enabled: boolean) => {
    if (enabled) {
      await registry.enable(pluginId);
    } else {
      await registry.disable(pluginId);
    }
    loadPlugins();
  };
  
  const handleUninstallPlugin = async (pluginId: string) => {
    if (!confirm('¿Desinstalar este plugin?')) return;
    
    await registry.unregister(pluginId);
    loadPlugins();
  };
  
  const categories = ['all', 'connector', 'importer', 'analyzer', 'automation', 'integration'];
  
  return (
    <div className="plugin-manager">
      <div className="manager-header">
        <h2>🔌 Gestión de Plugins</h2>
        <p className="subtitle">Personaliza tu agente con plugins y extensiones</p>
      </div>
      
      <div className="manager-filters">
        <div className="filter-group">
          <label>Estado:</label>
          <div className="btn-group">
            <button
              className={filter === 'all' ? 'active' : ''}
              onClick={() => setFilter('all')}
            >
              Todos ({registry.getAll().length})
            </button>
            <button
              className={filter === 'enabled' ? 'active' : ''}
              onClick={() => setFilter('enabled')}
            >
              Habilitados ({registry.getEnabled().length})
            </button>
            <button
              className={filter === 'disabled' ? 'active' : ''}
              onClick={() => setFilter('disabled')}
            >
              Deshabilitados
            </button>
          </div>
        </div>
        
        <div className="filter-group">
          <label>Categoría:</label>
          <select 
            value={selectedCategory} 
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="category-select"
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>
                {cat === 'all' ? 'Todas' : cat}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      <div className="plugins-grid">
        {plugins.map(plugin => (
          <PluginCard
            key={plugin.id}
            plugin={plugin}
            onToggle={(enabled) => handleTogglePlugin(plugin.id, enabled)}
            onUninstall={() => handleUninstallPlugin(plugin.id)}
            onConfigure={() => setSelectedPlugin(plugin)}
          />
        ))}
      </div>
      
      {plugins.length === 0 && (
        <div className="empty-state">
          <p>No se encontraron plugins</p>
        </div>
      )}
      
      {selectedPlugin && (
        <PluginConfigModal
          plugin={selectedPlugin}
          onClose={() => setSelectedPlugin(null)}
          onSave={async (config) => {
            await registry.updatePluginConfig(selectedPlugin.id, config);
            setSelectedPlugin(null);
            loadPlugins();
          }}
        />
      )}
    </div>
  );
}

// ============================================
// COMPONENTE: TARJETA DE PLUGIN
// ============================================

function PluginCard({
  plugin,
  onToggle,
  onUninstall,
  onConfigure,
}: {
  plugin: CopilotPlugin;
  onToggle: (enabled: boolean) => void;
  onUninstall: () => void;
  onConfigure: () => void;
}) {
  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'connector': return '#2196f3';
      case 'importer': return '#4caf50';
      case 'analyzer': return '#ff9800';
      case 'automation': return '#9c27b0';
      case 'integration': return '#f44336';
      default: return '#757575';
    }
  };
  
  return (
    <div className={`plugin-card ${plugin.enabled ? 'enabled' : 'disabled'}`}>
      <div className="card-header">
        <div className="plugin-icon">{plugin.icon}</div>
        <div className="plugin-info">
          <h3>{plugin.name}</h3>
          <span 
            className="category-badge" 
            style={{ backgroundColor: getCategoryColor(plugin.category) }}
          >
            {plugin.category}
          </span>
        </div>
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={plugin.enabled}
            onChange={(e) => onToggle(e.target.checked)}
          />
          <span className="slider"></span>
        </label>
      </div>
      
      <div className="card-body">
        <p className="plugin-description">{plugin.description}</p>
        
        <div className="plugin-meta">
          <span className="meta-item">v{plugin.version}</span>
          <span className="meta-item">por {plugin.author}</span>
        </div>
        
        {plugin.requires?.permissions && (
          <div className="permissions">
            <strong>Permisos:</strong>
            <ul>
              {plugin.requires.permissions.map(perm => (
                <li key={perm}>{perm}</li>
              ))}
            </ul>
          </div>
        )}
        
        {plugin.contributes && (
          <div className="contributions">
            {plugin.contributes.rules && (
              <span className="contrib-badge">
                {plugin.contributes.rules.length} reglas
              </span>
            )}
            {plugin.contributes.commands && (
              <span className="contrib-badge">
                {plugin.contributes.commands.length} comandos
              </span>
            )}
          </div>
        )}
      </div>
      
      <div className="card-actions">
        {plugin.settings && plugin.settings.length > 0 && (
          <button onClick={onConfigure} className="btn-secondary">
            ⚙️ Configurar
          </button>
        )}
        <button onClick={onUninstall} className="btn-danger">
          Desinstalar
        </button>
      </div>
    </div>
  );
}

// ============================================
// COMPONENTE: MODAL DE CONFIGURACIÓN
// ============================================

function PluginConfigModal({
  plugin,
  onClose,
  onSave,
}: {
  plugin: CopilotPlugin;
  onClose: () => void;
  onSave: (config: Record<string, any>) => Promise<void>;
}) {
  const [config, setConfig] = useState<Record<string, any>>(plugin.config || {});
  
  useEffect(() => {
    // Inicializar con valores por defecto
    const initialConfig = { ...config };
    plugin.settings?.forEach(setting => {
      if (initialConfig[setting.key] === undefined && setting.default !== undefined) {
        initialConfig[setting.key] = setting.default;
      }
    });
    setConfig(initialConfig);
  }, []);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(config);
  };
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>⚙️ Configurar {plugin.name}</h2>
          <button onClick={onClose} className="btn-close">×</button>
        </div>
        
        <div className="modal-body">
          <form onSubmit={handleSubmit}>
            {plugin.settings?.map(setting => (
              <div key={setting.key} className="form-group">
                <label>
                  {setting.label}
                  {setting.required && <span className="required">*</span>}
                </label>
                
                {setting.description && (
                  <p className="setting-description">{setting.description}</p>
                )}
                
                {setting.type === 'boolean' ? (
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={config[setting.key] || false}
                      onChange={(e) => setConfig({
                        ...config,
                        [setting.key]: e.target.checked
                      })}
                    />
                    <span>Activado</span>
                  </label>
                ) : setting.type === 'select' ? (
                  <select
                    value={config[setting.key] || ''}
                    onChange={(e) => setConfig({
                      ...config,
                      [setting.key]: e.target.value
                    })}
                    required={setting.required}
                  >
                    <option value="">Seleccionar...</option>
                    {setting.options?.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={setting.type}
                    value={config[setting.key] || ''}
                    onChange={(e) => setConfig({
                      ...config,
                      [setting.key]: setting.type === 'number' 
                        ? Number(e.target.value) 
                        : e.target.value
                    })}
                    required={setting.required}
                  />
                )}
              </div>
            ))}
            
            <div className="form-actions">
              <button type="button" onClick={onClose} className="btn-secondary">
                Cancelar
              </button>
              <button type="submit" className="btn-primary">
                Guardar Configuración
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ============================================
// ESTILOS CSS
// ============================================

export const pluginManagerStyles = `
.plugin-manager {
  padding: 2rem;
}

.manager-header {
  margin-bottom: 2rem;
}

.subtitle {
  color: #666;
  margin-top: 0.5rem;
}

.manager-filters {
  display: flex;
  gap: 2rem;
  margin-bottom: 2rem;
  padding: 1rem;
  background: #f5f5f5;
  border-radius: 8px;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.filter-group label {
  font-weight: 500;
}

.btn-group {
  display: flex;
  gap: 0.5rem;
}

.btn-group button {
  padding: 0.5rem 1rem;
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-group button.active {
  background: #2196f3;
  color: white;
  border-color: #2196f3;
}

.category-select {
  padding: 0.5rem 1rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  cursor: pointer;
}

.plugins-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1.5rem;
}

.plugin-card {
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  padding: 1.5rem;
  background: white;
  transition: all 0.2s;
}

.plugin-card.enabled {
  border-color: #4caf50;
}

.plugin-card.disabled {
  opacity: 0.7;
}

.plugin-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.card-header {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1rem;
}

.plugin-icon {
  font-size: 2rem;
}

.plugin-info {
  flex: 1;
}

.plugin-info h3 {
  margin: 0 0 0.5rem 0;
}

.category-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
  color: white;
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 50px;
  height: 24px;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  transition: 0.4s;
  border-radius: 24px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.4s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: #4caf50;
}

input:checked + .slider:before {
  transform: translateX(26px);
}

.plugin-description {
  color: #666;
  line-height: 1.5;
  margin: 1rem 0;
}

.plugin-meta {
  display: flex;
  gap: 1rem;
  margin: 1rem 0;
  font-size: 0.85rem;
  color: #999;
}

.permissions {
  margin: 1rem 0;
  padding: 0.75rem;
  background: #f5f5f5;
  border-radius: 4px;
  font-size: 0.85rem;
}

.permissions ul {
  margin: 0.5rem 0 0 0;
  padding-left: 1.5rem;
}

.contributions {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
}

.contrib-badge {
  padding: 0.25rem 0.75rem;
  background: #e3f2fd;
  color: #1976d2;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
}

.card-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
}

.setting-description {
  font-size: 0.85rem;
  color: #666;
  margin: 0.25rem 0 0.5rem 0;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.checkbox-label input {
  width: auto;
}
`;
