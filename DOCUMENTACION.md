# Copiloto Maestro - Documentación Técnica Completa

## 🎯 Resumen Ejecutivo

**Copiloto Maestro** es un sistema de asistencia autónomo con capacidades reales de:
- ✅ Persistencia en localStorage (no simulación)
- ✅ Motor de decisiones con evaluador AST real
- ✅ Detección de patrones temporales y secuenciales
- ✅ Evolución adaptativa basada en performance
- ✅ Terminal interactiva funcional

**Stack:** React + TypeScript + Vite + Tailwind CSS + localStorage

---

## 📐 Arquitectura del Sistema

### Capa 1: Storage Engine (`storage.ts`)

**Responsabilidad:** Persistencia con localStorage, versionado y migraciones.

**Características:**
- Debouncing automático (500ms) para optimizar escrituras
- Cache en memoria para lecturas rápidas
- Versionado de schemas con migraciones automáticas
- Sistema de backups
- Gestión de cuotas con limpieza automática

**API Principal:**
```typescript
storage.save(key, data, debounceMs?)     // Guardar con debouncing opcional
storage.load(key, defaultValue)          // Cargar con fallback
storage.saveFullState(state)             // Guardar estado completo
storage.loadFullState()                  // Cargar estado completo
storage.createBackup()                   // Crear backup timestamped
storage.clear()                          // Limpiar todo
storage.getStorageStats()                // Estadísticas de uso
```

**Schema de datos:**
```typescript
interface StorageSchema {
  version: number;
  systemState: SystemState;
  rules: Rule[];
  interactions: InteractionLog[];
  evolutionEvents: EvolutionEvent[];
  userProfile: UserProfile | null;
  patterns: Pattern[];
  metadata: {
    createdAt: string;
    lastModified: string;
    totalInteractions: number;
  };
}
```

---

### Capa 2: Decision Engine (`decision-engine.ts`)

**Responsabilidad:** Evaluación de reglas con parser AST real.

**Motor de parsing:**
- Tokenizer custom que soporta:
  - Operadores: `==`, `!=`, `>`, `<`, `>=`, `<=`, `in`
  - Lógicos: `and`, `or`
  - Tipos: strings, numbers, arrays, paths
  - Unidades: `MB`, `KB`, `min`, `s`

**Ejemplo de evaluación:**
```typescript
const context: DecisionContext = {
  action: { type: 'delete', target: 'file.sql' },
  file: { size: 5 * 1024 * 1024 } // 5MB
};

const rule: Rule = {
  condition: "action.type == 'delete' or file.size > 1MB"
};

// El evaluador parsea y evalúa la condición contra el contexto
const result = decisionEngine.evaluateRule(rule, context);
// result.matched === true
```

**API Principal:**
```typescript
evaluateRules(rules, context)     // Evaluar todas las reglas
evaluateRule(rule, context)       // Evaluar una regla
validateCondition(condition)      // Validar sintaxis
```

**Retorno:**
```typescript
interface DecisionResult {
  ruleId: string;
  ruleName: string;
  matched: boolean;
  confidence: number;
  behavior: string;
  reasoning: string;
  timestamp: string;
}
```

---

### Capa 3: Pattern Detector (`pattern-detector.ts`)

**Responsabilidad:** Detección de patrones en interacciones del usuario.

**Tipos de patrones detectados:**

1. **Secuenciales** (A → B → C)
   - Ventana deslizante de últimas 100 interacciones
   - Detecta secuencias de 2-4 acciones
   - Calcula tiempo promedio entre acciones
   - Ejemplo: `file_open → edit → save → close` (4 veces)

2. **Temporales** (acciones en horarios específicos)
   - Agrupa por slots: morning, afternoon, evening, night
   - Detecta concentración > 60% en un slot
   - Ejemplo: `code_edit` ocurre 80% en la mañana

3. **Frecuencia** (acciones repetidas)
   - Calcula promedio por día
   - Detecta alta frecuencia (>1 vez/día)
   - Ejemplo: `git_commit` ocurre ~5 veces/día

4. **Contextuales** (acciones con contexto similar)
   - Extrae keywords de descripciones
   - Agrupa interacciones similares
   - Ejemplo: acciones relacionadas con "test" o "deploy"

**Filtros de calidad:**
- Mínimo 3 ocurrencias
- Confianza mínima 0.6
- Ordenamiento por confianza

**API Principal:**
```typescript
detectPatterns(interactions)     // Detectar todos los patrones
getPatternStats(patterns)         // Estadísticas de patrones
```

---

### Capa 4: Evolution Engine (`evolution-engine.ts`)

**Responsabilidad:** Evolución adaptativa del sistema.

**Componentes:**

1. **RulePerformanceAnalyzer**
   - Rastrea últimas 100 ejecuciones por regla
   - Calcula success rate y tendencia
   - Genera recomendaciones: `keep`, `tune`, `deprecate`, `promote`

2. **RuleGenerator**
   - Genera reglas desde patrones detectados
   - Crea variantes optimizadas para A/B testing
   - Asigna confianza inicial conservadora

3. **EvolutionEngine** (orquestador)
   - Evalúa performance de reglas
   - Propone acciones de evolución
   - Aplica cambios y genera eventos

**Criterios de evolución:**

| Acción | Condiciones |
|--------|-------------|
| `promote` | Success rate ≥ 85%, ejecutada ≥ 20 veces, tendencia no negativa |
| `deprecate` | Success rate < 40% y ≥ 10 ejecuciones, O success rate < 60% con tendencia negativa |
| `tune` | Success rate entre 50-75% |
| `create_rule` | Patrón con confianza ≥ 70% y ≥ 5 ocurrencias |

**API Principal:**
```typescript
evaluateEvolution(rules, patterns, interactions)  // Proponer acciones
applyEvolution(action, rules)                     // Aplicar acción
recordDecisionResult(decision, success)           // Registrar resultado
getMetrics(rules)                                 // Métricas del sistema
```

---

## 🖥️ Terminal Interactiva

**Ubicación:** `/src/components/Terminal.tsx`

**Comandos disponibles:**

```bash
# Estado y estadísticas
status                    # Estado completo del sistema
stats                     # Estadísticas detalladas
patterns                  # Patrones detectados

# Gestión de reglas
rules                     # Listar todas las reglas
rules show <id>           # Ver detalles de una regla
test <rule_id>            # Probar regla con contextos

# Operaciones
interact <type> <desc>    # Registrar interacción manual
decide <json_context>     # Evaluar decisión
evolve                    # Ejecutar ciclo de evolución

# Utilidades
backup                    # Crear backup
reset                     # Reiniciar sistema (confirma)
clear                     # Limpiar terminal
help                      # Mostrar ayuda
```

**Ejemplos de uso:**

```bash
# Registrar interacción
$ interact file_edit "Modified config.json"

# Evaluar decisión
$ decide {"action":{"type":"delete"},"file":{"size":5242880}}

# Ver patrón
$ patterns

# Ejecutar evolución
$ evolve
```

---

## 🔄 Flujo de Datos

```
Usuario
  ↓
[Interacción] → recordInteraction()
  ↓
localStorage ← storage.saveFullState()
  ↓
PatternDetector.detectPatterns()
  ↓
[Patrones detectados]
  ↓
EvolutionEngine.evaluateEvolution()
  ↓
[Acciones propuestas: create_rule, tune, deprecate]
  ↓
EvolutionEngine.applyEvolution()
  ↓
[Reglas actualizadas]
  ↓
DecisionEngine.evaluateRules()
  ↓
[Decisiones con reasoning]
```

---

## 📊 Modos de Operación

El sistema evoluciona a través de 5 modos basados en interacciones:

| Modo | Interacciones | Madurez | Características |
|------|---------------|---------|-----------------|
| Zero Knowledge | 0-99 | 0-20% | Solo observación, confirma todo |
| Learning | 100-499 | 20-50% | Detecta patrones, sugiere |
| Competent | 500-1999 | 50-80% | Ejecuta acciones simples |
| Expert | 2000-4999 | 80-95% | Alta autonomía, proactivo |
| Master | 5000+ | 95-100% | Autonomía completa |

---

## 💾 Gestión de Estado

**Hook principal:** `useAppState()` en `/src/store.ts`

**Estado expuesto:**
```typescript
{
  // Estado del sistema
  systemState: SystemState,
  rules: Rule[],
  domains: Domain[],
  interactions: InteractionLog[],
  evolutionEvents: EvolutionEvent[],
  userProfile: UserProfile | null,
  patterns: Pattern[],
  lastDecisions: DecisionResult[],
  isSimulating: boolean,

  // Acciones básicas
  simulateInteraction: () => void,
  startSimulation: () => void,
  addRule: (rule: Rule) => void,
  toggleRule: (id: string) => void,
  completeOnboarding: (profile: UserProfile) => void,

  // Acciones avanzadas (motores)
  recordInteraction: (type, description, outcome?) => InteractionLog,
  evaluateDecision: (context: DecisionContext) => { results, stats },
  runEvolutionCycle: () => { actions, events },

  // Utilidades
  resetSystem: () => void,
  createBackup: () => string,
  
  // Acceso directo a motores
  decisionEngine: DecisionEngine,
  patternDetector: PatternDetector,
  evolutionEngine: EvolutionEngine,
}
```

---

## 🧪 Testing y Debugging

### Testing de Reglas

**Desde Terminal:**
```bash
$ test safety_001
═══ PRUEBA DE REGLA: never_delete_without_confirmation ═══
Condición: action.type == 'delete' or action.type == 'remove'
Test 1: ✓ MATCH
Test 2: ✗ NO MATCH
Test 3: ✗ NO MATCH
```

**Desde UI (Decision Engine):**
1. Ir a "Motor de Decisión"
2. Seleccionar escenario predefinido o usar JSON personalizado
3. Ver resultados en tiempo real

### Simulación de Interacciones

```bash
# Terminal
$ interact file_operation "Deleted backup.sql"
$ interact code_edit "Fixed bug in auth.ts"

# Programático
recordInteraction('email_send', 'Sent weekly report', 'success');
```

### Inspección de Patrones

```bash
$ patterns
═══ PATRONES DETECTADOS (3) ═══
SEQUENTIAL: file_open → edit → save
  → Usuario realiza file_open → edit → save consistentemente (5 veces) (75% confianza)
TEMPORAL: Rutina: code_edit
  → code_edit ocurre principalmente en morning (82% confianza)
```

---

## 🚀 Casos de Uso

### 1. Crear Regla de Seguridad Personalizada

```typescript
const newRule: Rule = {
  id: 'custom_001',
  name: 'prevent_large_email_attachments',
  category: 'safety',
  condition: "action.type == 'email_send' and file.size > 10MB",
  behavior: 'show_warning_and_compress',
  confidence: 0.9,
  active: true,
  createdAt: new Date().toISOString(),
  performance: 0.5,
};

addRule(newRule);
```

### 2. Evaluar Decisión Compleja

```typescript
const context: DecisionContext = {
  action: { type: 'deploy', target: 'production' },
  file: { type: 'yaml', path: '/k8s/deployment.yaml' },
  user: { activity: 'urgent' },
  history: recentInteractions.slice(-10),
};

const { results, stats } = evaluateDecision(context);
console.log(`${stats.matchedRules} reglas activadas`);
```

### 3. Evolución Automática

```typescript
// Se ejecuta automáticamente cada N interacciones
// O manualmente desde terminal:
const { actions, events } = runEvolutionCycle();

actions.forEach(action => {
  console.log(`${action.type}: ${action.reason}`);
});
```

---

## ⚙️ Configuración y Personalización

### Ajustar Umbrales de Patrones

En `/src/pattern-detector.ts`:
```typescript
class PatternDetector {
  private minOccurrences = 3;      // Mínimo de veces que debe ocurrir
  private minConfidence = 0.6;      // Confianza mínima
```

### Ajustar Criterios de Evolución

En `/src/evolution-engine.ts`:
```typescript
// Promoción de reglas
if (successRate >= 0.85 && executions >= 20) {
  return 'promote';
}

// Deprecación
if (successRate < 0.4 && executions >= 10) {
  return 'deprecate';
}
```

### Personalizar Debouncing

En `/src/storage.ts`:
```typescript
storage.save('key', data, 1000); // 1 segundo de debounce
```

---

## 📈 Métricas y Observabilidad

### Estadísticas del Sistema

Accesibles vía:
- UI: Página "Monitoring"
- Terminal: `$ stats`
- Programático: `evolutionEngine.getMetrics(rules)`

**Métricas disponibles:**
- Total de reglas (activas, deprecadas, en shadow)
- Performance promedio de reglas
- Tasa de evolución
- Patrones detectados por tipo
- Tasa de éxito de interacciones
- Uso de almacenamiento

### Tracking de Performance

Cada regla rastrea:
- Success rate (últimas 100 ejecuciones)
- Confianza promedio
- Total de ejecuciones
- Tendencia (improving/stable/declining)
- Última ejecución

---

## 🔒 Límites y Consideraciones

### localStorage
- **Límite:** ~5-10MB (depende del navegador)
- **Solución:** Limpieza automática de backups antiguos
- **Monitoreo:** `storage.getStorageStats()`

### Performance del Evaluador
- **Complejidad:** O(n) por regla evaluada
- **Optimización:** Memoización en cache interno
- **Límite práctico:** ~1000 reglas simultáneas

### Detección de Patrones
- **Ventana:** Últimas 100 interacciones
- **CPU:** Ejecuta en cada cambio de interacciones
- **Optimización:** Debounced con el storage

---

## 🛠️ Mantenimiento y Troubleshooting

### Resetear el Sistema

```bash
# Terminal
$ reset

# O programáticamente
resetSystem();
```

### Crear Backup Manual

```bash
$ backup
✓ Backup creado: backup_1707408234567
```

### Restaurar Backup

```typescript
storage.restoreBackup('backup_1707408234567');
```

### Limpiar Cache

```typescript
storage.clear();
evolutionEngine.clear();
```

### Debugging de Reglas

1. Activar `shadowMode` para testing sin impacto
2. Usar `test <rule_id>` en terminal
3. Ver `reasoning` en resultados de decisión

---

## 📝 Próximos Pasos

**Extensiones recomendadas:**

1. **IndexedDB** para mayor capacidad
2. **WebWorkers** para procesamiento asíncrono
3. **ML real** con TensorFlow.js
4. **Sincronización en la nube**
5. **Visualizaciones avanzadas** con D3.js
6. **Testing automatizado** con Vitest

---

## 🔗 Archivos Clave

```
/src
├── storage.ts                    # Motor de persistencia
├── decision-engine.ts            # Evaluador de reglas con AST
├── pattern-detector.ts           # Detector de patrones
├── evolution-engine.ts           # Sistema de evolución
├── store.ts                      # Estado global integrado
├── types.ts                      # Definiciones TypeScript
└── components/
    ├── Terminal.tsx              # Terminal interactiva
    ├── DecisionEngine.tsx        # UI del motor de decisiones
    ├── Dashboard.tsx             # Vista principal
    ├── Evolution.tsx             # Vista de evolución
    └── ...
```

---

## ✅ Checklist de Funcionalidades Implementadas

- [x] Persistencia real con localStorage
- [x] Motor de decisiones con parser AST
- [x] Detección de patrones (4 tipos)
- [x] Sistema de evolución adaptativa
- [x] Terminal interactiva funcional
- [x] UI completa con 8 vistas
- [x] Sistema de backups
- [x] Tracking de performance
- [x] Versionado de schemas
- [x] Gestión de cuotas
- [x] Debouncing inteligente
- [x] Cache en memoria
- [x] Validación de condiciones
- [x] Generación de reglas automática
- [x] A/B testing (shadow mode)

---

**Versión:** 1.0.0  
**Autor:** Claude + Copiloto Maestro  
**Fecha:** Febrero 2026
