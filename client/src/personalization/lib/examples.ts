// ============================================
// EJEMPLOS PRÁCTICOS DE USO
// ============================================

/**
 * Este archivo contiene ejemplos reales de cómo usar el sistema
 * de personalización en diferentes escenarios.
 */

import { usePersonalization } from './integration';
import { CredentialManager } from './credential-manager';
import { MCPConnectorFactory } from './mcp-connector';
import { AIDocumentationImporter } from './documentation-importer';

// ============================================
// EJEMPLO 1: Setup Completo Programático
// ============================================

async function ejemplo1_SetupCompleto() {
  console.log('=== EJEMPLO 1: Setup Completo ===\n');
  
  // 1. Inicializar gestor de credenciales
  const credManager = CredentialManager.getInstance();
  await credManager.initialize('mi-contraseña-segura-123');
  console.log('✅ Gestor de credenciales inicializado\n');
  
  // 2. Agregar credencial de NotebookLM
  await credManager.saveCredential(
    'notebooklm_main',
    'Mi NotebookLM Principal',
    'notebooklm',
    'api_key',
    {
      apiKey: 'nlm_abc123xyz',
      notebookId: 'cuaderno-desarrollo',
    }
  );
  console.log('✅ Credencial NotebookLM guardada\n');
  
  // 3. Conectar NotebookLM
  const nlmConnector = MCPConnectorFactory.create('notebooklm', {
    endpoint: 'https://notebooklm.google.com/api/v1',
    requiresAuth: true,
    authType: 'api_key',
  });
  
  await nlmConnector.connect({
    apiKey: 'nlm_abc123xyz',
    notebookId: 'cuaderno-desarrollo',
  });
  console.log('✅ Conectado a NotebookLM\n');
  
  // 4. Agregar credencial de GitHub
  await credManager.saveCredential(
    'github_main',
    'Mi GitHub',
    'github',
    'bearer',
    {
      token: 'ghp_xyz789abc',
      repos: 'usuario/backend-api,usuario/frontend-app',
    }
  );
  console.log('✅ Credencial GitHub guardada\n');
  
  // 5. Conectar GitHub
  const githubConnector = MCPConnectorFactory.create('github');
  await githubConnector.connect({
    token: 'ghp_xyz789abc',
    repos: 'usuario/backend-api,usuario/frontend-app',
  });
  console.log('✅ Conectado a GitHub\n');
  
  console.log('🎉 Setup completo!\n');
}

// ============================================
// EJEMPLO 2: Importar Documentación
// ============================================

async function ejemplo2_ImportarDocs() {
  console.log('=== EJEMPLO 2: Importar Documentación ===\n');
  
  // Crear contenido de ejemplo (normalmente vendría de un archivo)
  const docContent = `
# Guía de Desarrollo Backend

## Regla: Siempre correr tests antes de deploy

**Condición:** action.type == 'deploy'
**Comportamiento:** require_tests_first
**Categoría:** safety

Nunca hacer deploy sin ejecutar la suite completa de tests.

## Regla: Validar migrations en cambios de DB

**Condición:** files.includes('.sql') and action.type == 'commit'
**Comportamiento:** require_migration_file
**Categoría:** safety

Cualquier cambio en archivos SQL debe venir acompañado de una migration.

## Regla: Backup antes de deploy a producción

**Condición:** action.type == 'deploy' and target == 'production'
**Comportamiento:** create_backup_first
**Categoría:** safety

Siempre crear un backup de la base de datos antes de deployear a producción.
  `;
  
  // Importar (sin IA, usando parser de Markdown)
  const { MarkdownImporter } = await import('./documentation-importer');
  const importer = new MarkdownImporter();
  
  const result = await importer.import(docContent);
  
  console.log(`✅ Documentación importada:`);
  console.log(`   - Reglas extraídas: ${result.rulesExtracted.length}`);
  console.log(`   - Dominios creados: ${result.domainsCreated.length}\n`);
  
  // Mostrar reglas extraídas
  result.rulesExtracted.forEach((rule, idx) => {
    console.log(`Regla ${idx + 1}: ${rule.name}`);
    console.log(`  Condición: ${rule.condition}`);
    console.log(`  Comportamiento: ${rule.behavior}`);
    console.log(`  Categoría: ${rule.category}\n`);
  });
}

// ============================================
// EJEMPLO 3: Usar MCP en Decisiones
// ============================================

async function ejemplo3_MCPEnDecisiones() {
  console.log('=== EJEMPLO 3: Usar MCP en Decisiones ===\n');
  
  const { usePersonalization } = await import('./integration');
  
  // (Este ejemplo asume que ya tienes un conector configurado)
  
  // Contexto de decisión
  const context = {
    action: {
      type: 'deploy',
      target: 'production',
      timestamp: new Date().toISOString(),
    },
    file: {
      path: '/config/database.yml',
      type: 'yml',
      changed: true,
    },
    user: {
      activity: 'urgent',
    },
  };
  
  console.log('Contexto original:', JSON.stringify(context, null, 2), '\n');
  
  // Enriquecer con MCP
  // (En un componente React, usarías: const { enrichDecisionContext } = usePersonalization())
  // Aquí simulamos el resultado
  
  const enrichedContext = {
    ...context,
    mcp_notebooklm: {
      relevantNotes: [
        {
          title: 'Checklist de Deploy a Producción',
          content: 'Siempre validar: 1) Tests pasan, 2) Migrations OK, 3) Backup creado',
        },
      ],
    },
    mcp_github: {
      recentCommits: [
        {
          sha: 'abc123',
          message: 'Add migration for new user fields',
          author: 'usuario',
        },
      ],
    },
  };
  
  console.log('Contexto enriquecido con MCP:', JSON.stringify(enrichedContext, null, 2), '\n');
  
  console.log('✅ El motor de decisiones ahora tiene más contexto para evaluar\n');
}

// ============================================
// EJEMPLO 4: Flujo Completo de Usuario
// ============================================

async function ejemplo4_FlujoCompleto() {
  console.log('=== EJEMPLO 4: Flujo Completo de Usuario ===\n');
  
  // Simular día de trabajo de un desarrollador
  
  console.log('📅 Lunes, 9:00 AM - Inicio del día\n');
  
  // 1. Usuario abre VS Code, registra interacción
  console.log('Acción: Abrió VS Code');
  // await recordInteraction('app_open', 'Opened VS Code');
  
  console.log('Acción: Editó archivo auth.ts');
  // await recordInteraction('file_edit', 'Modified auth.ts - added Google OAuth');
  
  // 2. Usuario hace commit
  console.log('Acción: Hace git commit\n');
  
  // El agente evalúa:
  const commitContext = {
    action: { type: 'git_commit', message: 'Add Google OAuth' },
    files: ['src/auth.ts', 'src/config.ts'],
  };
  
  console.log('🤖 Agente evalúa contexto...');
  console.log('   Reglas activadas:');
  console.log('   ✅ commit_message_format - OK');
  console.log('   ✅ test_before_commit - ADVERTENCIA\n');
  
  console.log('💡 Sugerencia del agente:');
  console.log('   "No has corrido tests. Basándome en tu historial,');
  console.log('    siempre corres tests antes de commit.');
  console.log('    ¿Quieres correrlos ahora?"\n');
  
  // 3. Usuario corre tests
  console.log('Acción: Corre tests');
  // await recordInteraction('test_run', 'Ran test suite - 45 passing');
  
  // 4. Usuario quiere hacer deploy
  console.log('\n📅 Viernes, 4:00 PM - Quiere hacer deploy\n');
  
  const deployContext = {
    action: { type: 'deploy', target: 'production' },
    file: { path: 'database.sql', changed: true },
  };
  
  console.log('🤖 Agente evalúa deploy...');
  
  // Consulta NotebookLM
  console.log('   📓 Consultando NotebookLM...');
  console.log('   Encontrado: "Checklist de Deploy" con 8 pasos\n');
  
  // Consulta GitHub
  console.log('   💻 Consultando GitHub...');
  console.log('   Últimos 3 deploys viernes tarde tuvieron rollback\n');
  
  console.log('⚠️ Recomendación del agente:');
  console.log('   "Basándome en:');
  console.log('   - Tu checklist en NotebookLM');
  console.log('   - Historial de GitHub');
  console.log('   - Tus patrones de comportamiento');
  console.log('');
  console.log('   Sugerencias:');
  console.log('   1. Crear backup de DB (falta)');
  console.log('   2. Validar migration existe (falta)');
  console.log('   3. Considerar esperar a lunes (deploys viernes = problemas)"\n');
  
  console.log('✅ Usuario decide esperar a lunes\n');
  console.log('🎉 ¡El agente personalizado evitó un problema potencial!\n');
}

// ============================================
// EJEMPLO 5: Crear Plugin Personalizado
// ============================================

async function ejemplo5_PluginPersonalizado() {
  console.log('=== EJEMPLO 5: Plugin Personalizado ===\n');
  
  const { PluginRegistry } = await import('./plugin-registry');
  const registry = PluginRegistry.getInstance();
  
  // Definir plugin personalizado
  const slackNotifierPlugin = {
    id: 'slack-notifier',
    name: 'Slack Notifier',
    version: '1.0.0',
    author: 'Tu Nombre',
    description: 'Envía notificaciones a Slack cuando se activan reglas críticas',
    icon: '💬',
    category: 'integration' as const,
    enabled: true,
    installed: true,
    
    settings: [
      {
        key: 'webhookUrl',
        label: 'Slack Webhook URL',
        type: 'url' as const,
        required: true,
      },
      {
        key: 'channel',
        label: 'Canal',
        type: 'string' as const,
        default: '#alerts',
      },
    ],
    
    hooks: {
      onDecision: async (context: any) => {
        console.log('🔔 Plugin Slack: Revisando decisión...');
        
        // Si hay reglas críticas activadas, enviar a Slack
        // (aquí iría la lógica real de envío)
        
        return {
          suggestions: ['Notificación enviada a Slack'],
        };
      },
      
      onInteraction: async (interaction: any) => {
        // Registrar interacciones importantes en Slack
        if (interaction.type === 'deploy') {
          console.log('🔔 Plugin Slack: Deploy detectado, notificando equipo...');
        }
      },
    },
    
    requires: {
      permissions: ['network:external'],
    },
  };
  
  // Registrar plugin
  await registry.register(slackNotifierPlugin);
  console.log('✅ Plugin "Slack Notifier" registrado\n');
  
  // Listar plugins
  const plugins = registry.getAll();
  console.log(`Total de plugins: ${plugins.length}`);
  plugins.forEach(p => {
    console.log(`  - ${p.name} (${p.enabled ? 'habilitado' : 'deshabilitado'})`);
  });
}

// ============================================
// EJEMPLO 6: Backup y Restauración
// ============================================

async function ejemplo6_BackupRestauracion() {
  console.log('=== EJEMPLO 6: Backup y Restauración ===\n');
  
  const credManager = CredentialManager.getInstance();
  await credManager.initialize('mi-contraseña');
  
  // Agregar algunas credenciales
  await credManager.saveCredential(
    'test1',
    'Test Service 1',
    'github',
    'bearer',
    { token: 'xyz123' }
  );
  
  await credManager.saveCredential(
    'test2',
    'Test Service 2',
    'notebooklm',
    'api_key',
    { apiKey: 'abc456', notebookId: 'nb1' }
  );
  
  console.log('✅ 2 credenciales creadas\n');
  
  // Crear backup
  console.log('📦 Creando backup...');
  const backup = await credManager.exportCredentials();
  console.log('✅ Backup creado\n');
  
  // Simular pérdida de datos
  console.log('💥 Simulando pérdida de datos...');
  localStorage.clear();
  console.log('⚠️ localStorage limpiado\n');
  
  // Restaurar desde backup
  console.log('🔄 Restaurando desde backup...');
  await credManager.importCredentials(backup, 'mi-contraseña');
  console.log('✅ Credenciales restauradas\n');
  
  // Verificar
  const restored = credManager.listCredentials();
  console.log(`Credenciales restauradas: ${restored.length}`);
  restored.forEach(c => {
    console.log(`  - ${c.name} (${c.service})`);
  });
}

// ============================================
// EJECUTAR EJEMPLOS
// ============================================

export async function runExamples() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════╗');
  console.log('║  EJEMPLOS PRÁCTICOS - SISTEMA DE          ║');
  console.log('║  PERSONALIZACIÓN COPILOTO MAESTRO         ║');
  console.log('╚════════════════════════════════════════════╝');
  console.log('\n');
  
  try {
    // Descomentar los ejemplos que quieras ejecutar
    
    // await ejemplo1_SetupCompleto();
    // await ejemplo2_ImportarDocs();
    // await ejemplo3_MCPEnDecisiones();
    await ejemplo4_FlujoCompleto();
    // await ejemplo5_PluginPersonalizado();
    // await ejemplo6_BackupRestauracion();
    
  } catch (error) {
    console.error('❌ Error ejecutando ejemplos:', error);
  }
}

// ============================================
// QUICK START GUIDE
// ============================================

export const QUICK_START = `
╔════════════════════════════════════════════════════════════╗
║                    QUICK START GUIDE                       ║
╚════════════════════════════════════════════════════════════╝

🚀 OPCIÓN 1: Usar el Wizard (Recomendado)
──────────────────────────────────────────────────────────────
import { PersonalizedCopilot } from './integration';

function App() {
  return <PersonalizedCopilot />;
}

→ El wizard te guiará paso a paso


🛠️ OPCIÓN 2: Setup Programático
──────────────────────────────────────────────────────────────
import { usePersonalization } from './integration';

const {
  saveConfig,
  importDocumentation,
  connectMCP,
  evaluateDecision,
} = usePersonalization();

// 1. Configurar agente
saveConfig({
  agentId: 'mi_agente',
  profile: { role: 'backend_dev', experience: 'senior' },
  // ... resto de config
});

// 2. Importar docs
await importDocumentation(file, anthropicApiKey);

// 3. Conectar MCP
await connectMCP('notebooklm', { apiKey: 'xxx' });

// 4. Usar
const result = await evaluateDecision(context);


📚 PASO A PASO DETALLADO
──────────────────────────────────────────────────────────────
1. Primera vez:
   - Completa wizard (6 pasos, ~5 minutos)
   - Define rol, experiencia, áreas de enfoque
   - Importa documentación inicial

2. Configurar credenciales:
   - Ve al Panel de Credenciales
   - Crea contraseña maestra
   - Agrega servicios (NotebookLM, GitHub, etc)

3. Habilitar plugins:
   - Ve al Gestor de Plugins
   - Activa los que necesites
   - Configura cada uno

4. Empezar a usar:
   - Interactúa normalmente con el agente
   - Registra tus acciones
   - El agente aprende y sugiere basándose en:
     * Tus reglas personalizadas
     * Conocimiento importado
     * Conectores MCP
     * Patrones detectados


💡 TIPS
──────────────────────────────────────────────────────────────
• Importa tu documentación cuanto antes
• Configura NotebookLM si lo usas (máximo ROI)
• Habilita GitHub connector para aprender de commits
• Haz backups semanales de credenciales
• Revisa reglas mensuales y ajusta las que no sirven


🆘 ¿PROBLEMAS?
──────────────────────────────────────────────────────────────
Consulta el README.md para troubleshooting detallado
`;

// Para mostrar la guía rápida
console.log(QUICK_START);
