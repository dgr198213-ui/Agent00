# 🚀 Sistema de Personalización para Copiloto Maestro

## Descripción

Sistema completo de personalización que permite a cada usuario crear su propia versión del agente, adaptada a sus necesidades específicas mediante:

- **✅ Panel de Credenciales Seguro** (AES-256-GCM)
- **✅ Conectores MCP** (NotebookLM, GitHub, APIs personalizadas)
- **✅ Importador de Documentación con IA** (extracción automática de reglas)
- **✅ Sistema de Plugins** (extensible y modular)
- **✅ Wizard de Configuración** (onboarding guiado)

---

## 📦 Archivos Incluidos

```
personalization-system/
├── personalization-types.ts      # Tipos TypeScript completos
├── credential-manager.ts          # Gestor de credenciales encriptado
├── mcp-connector.ts               # Conectores MCP universales
├── documentation-importer.ts      # Importador con IA (Claude API)
├── plugin-registry.ts             # Sistema de plugins
├── CredentialPanel.tsx            # UI: Panel de credenciales
├── PluginManager.tsx              # UI: Gestor de plugins
├── SetupWizard.tsx                # UI: Wizard de configuración
└── README.md                      # Este archivo
```

---

## 🔧 Instalación

### Requisitos Previos

- Node.js 18+
- React 18+
- TypeScript 5+
- Copiloto Maestro base instalado

### Paso 1: Copiar Archivos

```bash
# Copiar todos los archivos al proyecto
cp personalization-types.ts /tu-proyecto/src/
cp credential-manager.ts /tu-proyecto/src/
cp mcp-connector.ts /tu-proyecto/src/
cp documentation-importer.ts /tu-proyecto/src/
cp plugin-registry.ts /tu-proyecto/src/
cp CredentialPanel.tsx /tu-proyecto/src/components/
cp PluginManager.tsx /tu-proyecto/src/components/
cp SetupWizard.tsx /tu-proyecto/src/components/
```

### Paso 2: Instalar Dependencias

```bash
npm install @anthropic-ai/sdk  # Para importador con IA (opcional)
```

### Paso 3: Integrar en App Principal

```tsx
// App.tsx
import React, { useState, useEffect } from 'react';
import { SetupWizard } from './components/SetupWizard';
import { CredentialPanel } from './components/CredentialPanel';
import { PluginManager } from './components/PluginManager';
import { UserAgentConfig } from './personalization-types';

// Importar estilos
import { credentialPanelStyles } from './components/CredentialPanel';
import { pluginManagerStyles } from './components/PluginManager';
import { setupWizardStyles } from './components/SetupWizard';

function App() {
  const [isConfigured, setIsConfigured] = useState(false);
  const [config, setConfig] = useState<UserAgentConfig | null>(null);
  const [currentView, setCurrentView] = useState<'dashboard' | 'credentials' | 'plugins'>('dashboard');
  
  useEffect(() => {
    // Cargar configuración guardada
    const savedConfig = localStorage.getItem('user_agent_config');
    if (savedConfig) {
      setConfig(JSON.parse(savedConfig));
      setIsConfigured(true);
    }
  }, []);
  
  const handleSetupComplete = (newConfig: UserAgentConfig) => {
    setConfig(newConfig);
    setIsConfigured(true);
    localStorage.setItem('user_agent_config', JSON.stringify(newConfig));
  };
  
  // Mostrar wizard si no está configurado
  if (!isConfigured) {
    return (
      <>
        <style>{setupWizardStyles}</style>
        <SetupWizard onComplete={handleSetupComplete} />
      </>
    );
  }
  
  // UI principal
  return (
    <div className="app">
      <style>{credentialPanelStyles}</style>
      <style>{pluginManagerStyles}</style>
      
      <nav className="app-nav">
        <button onClick={() => setCurrentView('dashboard')}>🏠 Dashboard</button>
        <button onClick={() => setCurrentView('credentials')}>🔐 Credenciales</button>
        <button onClick={() => setCurrentView('plugins')}>🔌 Plugins</button>
      </nav>
      
      <main className="app-main">
        {currentView === 'dashboard' && (
          <div>
            {/* Tu dashboard del Copiloto Maestro */}
            <h1>Dashboard</h1>
            <p>Configuración de usuario: {config?.profile.role}</p>
          </div>
        )}
        
        {currentView === 'credentials' && <CredentialPanel />}
        
        {currentView === 'plugins' && <PluginManager />}
      </main>
    </div>
  );
}

export default App;
```

---

## 🎯 Guía de Uso

### 1. Primera Vez: Wizard de Configuración

Al abrir la app por primera vez, verás el wizard de 6 pasos:

1. **Selección de Rol** - Define tu rol principal (backend dev, frontend, etc)
2. **Fuentes de Conocimiento** - Selecciona de dónde aprenderá el agente
3. **Importar Documentación** - Sube PDFs/Markdown con tus guías
4. **Reglas Personalizadas** - Define reglas basadas en tu rol
5. **Conectores MCP** - Información sobre conectores disponibles
6. **Resumen** - Revisa tu configuración

### 2. Panel de Credenciales

#### Inicialización

Al abrir el panel por primera vez:

```
1. Ingresa una contraseña maestra
2. Esta contraseña encripta todas tus credenciales
3. ⚠️ NO la olvides - no es recuperable
```

#### Agregar Credencial

```
1. Click en "+ Agregar Credencial"
2. Selecciona un servicio (NotebookLM, GitHub, etc)
3. Completa los campos requeridos
4. Click en "Guardar Credencial"
```

#### Plantillas Disponibles

- **NotebookLM**: API Key + Notebook ID
- **GitHub**: Personal Access Token + Repos
- **Anthropic**: API Key (para importador con IA)
- **Notion**: Integration Token
- **API Personalizada**: Endpoint + API Key

### 3. Gestor de Plugins

#### Plugins Built-in

**Conectores:**
- 📓 **NotebookLM Connector** - Conecta tus cuadernos
- 💻 **GitHub Connector** - Aprende de commits y PRs

**Importadores:**
- 📄 **AI Documentation Importer** - Extrae reglas con Claude
- 📝 **Markdown Importer** - Importa desde Markdown estructurado

#### Habilitar Plugin

```
1. Ve al Gestor de Plugins
2. Encuentra el plugin que quieres usar
3. Activa el switch
4. Si requiere config, click en "⚙️ Configurar"
```

#### Configurar Plugin

Ejemplo: Configurar GitHub Connector

```
1. Click en "⚙️ Configurar"
2. Ingresa repos: "user/repo1, user/repo2"
3. Activa "Rastrear Commits"
4. Activa "Rastrear Pull Requests"
5. Guarda
```

### 4. Importar Documentación

#### Método 1: Con IA (Recomendado)

```typescript
// Requiere Anthropic API Key configurada

1. Ve al Wizard (paso 3) o usa directamente el importador
2. Sube tu PDF/Markdown
3. El sistema usa Claude para extraer reglas automáticamente
4. Revisa las reglas extraídas
5. Activa las que quieras usar
```

#### Método 2: Markdown Estructurado

Crea un archivo `.md` con este formato:

```markdown
## Regla: Nunca deployear sin tests

**Condición:** action.type == 'deploy'
**Comportamiento:** require_tests_first
**Categoría:** safety

## Regla: Validar env vars en producción

**Condición:** action.type == 'deploy' and target == 'production'
**Comportamiento:** check_env_completeness
**Categoría:** security
```

Luego importa el archivo.

---

## 🔌 Usar Conectores MCP

### Ejemplo: NotebookLM

```typescript
import { NotebookLMConnector } from './mcp-connector';
import { CredentialManager } from './credential-manager';

// 1. Inicializar gestor de credenciales
const credManager = CredentialManager.getInstance();
await credManager.initialize('tu-contraseña-maestra');

// 2. Crear conector
const connector = new NotebookLMConnector({
  endpoint: 'https://notebooklm.google.com/api/v1',
  requiresAuth: true,
  authType: 'api_key',
});

// 3. Conectar
await connector.connect({
  apiKey: 'nlm_tu_api_key',
  notebookId: 'tu_notebook_id',
});

// 4. Consultar conocimiento
const response = await connector.query(
  '¿Cuáles son las mejores prácticas de deploy en producción?'
);

console.log(response.data);
```

### Ejemplo: GitHub

```typescript
import { GitHubConnector } from './mcp-connector';

const github = new GitHubConnector();

await github.connect({
  token: 'ghp_tu_token',
  repos: 'user/repo1,user/repo2',
});

// Obtener commits recientes
const commits = await github.getRecentCommits(50);

// El conector puede auto-registrar interacciones
// basándose en commits, PRs, etc.
```

---

## 🛡️ Seguridad

### Encriptación

- **Algoritmo**: AES-256-GCM
- **Derivación de clave**: PBKDF2 con 100,000 iteraciones
- **Salt**: Aleatorio de 128 bits
- **IV**: Aleatorio por cada credencial

### Almacenamiento

- Las credenciales se guardan encriptadas en `localStorage`
- La contraseña maestra **NO** se almacena
- Cada sesión requiere re-ingresar la contraseña

### Buenas Prácticas

```
✅ Usa contraseñas maestras fuertes (12+ caracteres)
✅ Haz backups periódicos (exporta credenciales)
✅ No compartas tu contraseña maestra
⚠️ Si olvidas la contraseña, perderás acceso a credenciales
```

---

## 🔄 Flujo de Trabajo Típico

### Setup Inicial (Una vez)

```
1. Abrir app → Wizard de configuración
2. Seleccionar rol y experiencia
3. Importar documentación (guías, best practices)
4. Configurar credenciales en Panel
5. Habilitar plugins necesarios
6. ¡Listo para usar!
```

### Uso Diario

```
1. Abrir app (ingresa contraseña maestra)
2. Interactuar con el agente normalmente
3. El agente consulta automáticamente:
   - Reglas personalizadas
   - Conocimiento importado
   - Conectores MCP configurados
4. Obtén sugerencias contextualizadas a TU flujo
```

### Mantenimiento

```
Semanal:
  - Importar nueva documentación si hay cambios
  - Revisar y ajustar reglas que no funcionan bien

Mensual:
  - Hacer backup de credenciales
  - Actualizar plugins si hay nuevas versiones
```

---

## 📚 API Reference

### CredentialManager

```typescript
// Inicializar
await credManager.initialize('contraseña');

// Guardar credencial
await credManager.saveCredential(
  'id_unico',
  'Nombre mostrado',
  'servicio',
  'api_key',
  { apiKey: 'valor', otrosCampos: 'valores' }
);

// Obtener credencial
const creds = await credManager.getCredential('id_unico');

// Listar todas (sin datos sensibles)
const lista = credManager.listCredentials();

// Probar conexión
const valida = await credManager.testCredential('id_unico');

// Eliminar
await credManager.deleteCredential('id_unico');
```

### MCPConnector

```typescript
// Crear conector
const connector = MCPConnectorFactory.create('notebooklm', config);

// Conectar
await connector.connect(credentials);

// Consultar
const response = await connector.query('pregunta', contexto);

// Buscar
const resultados = await connector.search('query');

// Agregar contexto
await connector.addContext(datos);

// Sincronizar
await connector.sync();
```

### DocumentationImporter

```typescript
// Crear importador
const importer = new AIDocumentationImporter(apiKey);

// Importar archivo
const result = await importer.import(file);

// Resultado contiene:
result.rulesExtracted;  // Array de reglas
result.domainsCreated;  // Dominios detectados
result.patternsDetected; // Patrones encontrados
```

### PluginRegistry

```typescript
// Obtener instancia
const registry = PluginRegistry.getInstance();

// Registrar plugin
await registry.register(pluginDefinition);

// Habilitar/deshabilitar
await registry.enable('plugin-id');
await registry.disable('plugin-id');

// Obtener plugins
const todos = registry.getAll();
const habilitados = registry.getEnabled();
const porCategoria = registry.getByCategory('connector');

// Ejecutar hook
await registry.executeHook('onInteraction', interactionLog);
```

---

## 🐛 Troubleshooting

### Error: "Master key no disponible"

**Causa**: No has inicializado el CredentialManager
**Solución**:
```typescript
await credManager.initialize('tu-contraseña');
```

### Error: Credenciales inválidas

**Causa**: API key o token incorrectos
**Solución**:
1. Verifica credenciales en el servicio original
2. Re-ingresa en el Panel de Credenciales
3. Click en "Probar Conexión"

### Importador no extrae reglas

**Causa**: Falta configurar Anthropic API Key
**Solución**:
1. Ve al Gestor de Plugins
2. Configura "AI Documentation Importer"
3. Ingresa tu API Key de Anthropic

### Plugin no se habilita

**Causa**: Faltan permisos o dependencias
**Solución**:
1. Revisa los "Permisos" requeridos en la tarjeta del plugin
2. Verifica que las credenciales necesarias estén configuradas
3. Revisa consola del navegador para errores

---

## 🚀 Próximas Mejoras

- [ ] Sincronización en la nube (multi-dispositivo)
- [ ] Marketplace de plugins community
- [ ] Exportar/Importar configuración completa
- [ ] Estadísticas de uso de conectores
- [ ] Editor visual de reglas
- [ ] Templates de configuración por industria

---

## 📄 Licencia

MIT License - Úsalo libremente en tus proyectos

---

## 💬 Soporte

¿Preguntas? ¿Bugs? ¿Ideas?

- Abre un issue en GitHub
- Contacta al equipo de desarrollo
- Consulta la documentación completa

---

**¡Disfruta tu agente personalizado!** 🎉
