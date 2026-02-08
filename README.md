# 🚀 Copiloto Maestro - Guía de Inicio Rápido

## ¿Qué es esto?

Un **sistema de copiloto completamente funcional** con:
- ✅ Motor de decisiones REAL (no simulado)
- ✅ Detección de patrones automática
- ✅ Evolución adaptativa basada en uso
- ✅ Persistencia real en localStorage
- ✅ Terminal interactiva

**Todo funciona de verdad. Sin simulacros.**

---

## 🎯 Inicio Rápido (30 segundos)

1. **Abre** `copilot-master.html` en tu navegador
2. **Explora** la interfaz - ya tiene datos de ejemplo
3. **Ve a "Terminal"** (segundo botón del menú)
4. **Escribe:** `help` y presiona Enter

¡Ya estás dentro!

---

## 💡 Primeros Comandos

```bash
# Ver estado del sistema
$ status

# Ver qué patrones detectó
$ patterns

# Probar una regla de seguridad
$ test safety_001

# Registrar una interacción
$ interact file_edit "Modified config.json"

# Evaluar una decisión
$ decide {"action":{"type":"delete"}}

# Ejecutar evolución automática
$ evolve

# Ver estadísticas
$ stats
```

---

## 🎮 Prueba el Motor de Decisiones

1. **Ve a "Motor de Decisión"** (menú lateral)
2. **Haz clic en** "Eliminar archivo"
3. **Observa** cómo las reglas de seguridad se activan automáticamente
4. **Prueba el editor JSON** personalizado

**¿Qué está pasando?**
- El motor parsea la condición de cada regla
- Evalúa contra el contexto que le diste
- Retorna las reglas que coinciden con su razonamiento

---

## 🔍 Explora los Patrones

1. **Ve a "Terminal"**
2. **Escribe:** `interact code_edit "Fixed bug in auth"`
3. **Repite** 5-10 interacciones similares
4. **Escribe:** `patterns`

**¿Qué está pasando?**
- El detector analiza las últimas 100 interacciones
- Busca secuencias, temporalidad, frecuencia
- Sugiere reglas automáticas cuando encuentra patrones fuertes

---

## 🧬 Observa la Evolución

1. **Ve a "Evolución"** (menú lateral)
2. **Observa** el historial de eventos
3. **En Terminal, escribe:** `evolve`
4. **Vuelve a "Evolución"** - verás nuevos eventos

**¿Qué está pasando?**
- El motor analiza performance de cada regla
- Propone crear, modificar o deprecar reglas
- Genera nuevas reglas desde patrones detectados
- Todo basado en datos reales de uso

---

## 📊 Monitorea el Sistema

1. **Ve a "Monitoreo"**
2. **Observa** las métricas en tiempo real
3. **Nota** cómo cambian al usar el sistema

**Métricas clave:**
- Madurez del sistema (aumenta con uso)
- Reglas activas vs deprecadas
- Tasa de éxito de interacciones
- Patrones detectados

---

## 🎯 Casos de Uso Prácticos

### 1. Testing de Reglas de Seguridad

```bash
$ rules show safety_001
$ test safety_001
```

### 2. Simulación de Workflow

```bash
$ interact file_open "Opened config.json"
$ interact file_edit "Modified settings"
$ interact file_save "Saved changes"
$ interact file_close "Closed file"
# Repetir 3-4 veces, luego:
$ patterns
# Verás una secuencia detectada!
```

### 3. Evaluación Compleja

```bash
$ decide {"action":{"type":"deploy","target":"production"},"user":{"activity":"urgent"}}
```

---

## 💾 Persistencia

**Todo se guarda automáticamente en localStorage.**

Para verificar:
1. Registra algunas interacciones
2. Cierra el navegador
3. Abre de nuevo el HTML
4. Los datos siguen ahí

**Backup manual:**
```bash
$ backup
# Guarda: backup_1707408234567
```

**Reset completo:**
```bash
$ reset
# Confirma y todo se limpia
```

---

## 🏗️ Arquitectura en 5 Capas

```
┌─────────────────────────────────────┐
│  UI Components (React + Tailwind)  │
├─────────────────────────────────────┤
│  Store (useAppState hook)          │
├─────────────────────────────────────┤
│  ┌──────────┬──────────┬──────────┐ │
│  │ Decision │ Pattern  │Evolution │ │
│  │ Engine   │ Detector │ Engine   │ │
│  └──────────┴──────────┴──────────┘ │
├─────────────────────────────────────┤
│  Storage Engine (localStorage)      │
└─────────────────────────────────────┘
```

---

## 🔧 Personalización

### Crear Regla Manual

En "Motor de Decisión", usa el editor JSON:
```json
{
  "action": {
    "type": "email_send"
  },
  "file": {
    "size": 10485760
  }
}
```

### Modificar Umbrales

Edita los archivos:
- `pattern-detector.ts` - Umbrales de detección
- `evolution-engine.ts` - Criterios de evolución
- `storage.ts` - Debouncing y cuotas

---

## 📝 Comandos de Terminal Completos

```bash
# ESTADO
status          # Estado completo del sistema
stats           # Estadísticas detalladas
patterns        # Patrones detectados

# REGLAS
rules           # Listar todas
rules show <id> # Ver detalles
test <id>       # Probar regla

# OPERACIONES
interact <type> <desc>    # Registrar interacción
decide <json>             # Evaluar decisión
evolve                    # Ciclo de evolución

# UTILIDADES
backup          # Crear backup
reset           # Reiniciar sistema
clear           # Limpiar terminal
help            # Ayuda
```

---

## 🐛 Troubleshooting

**No veo mis datos:**
- Verifica que localStorage esté habilitado
- Revisa la consola del navegador (F12)

**El sistema está lento:**
- Revisa `$ stats` - uso de storage
- Si >80% lleno, ejecuta `$ reset`

**Las reglas no se activan:**
- Verifica que estén activas: `$ rules`
- Prueba con: `$ test <rule_id>`

**Quiero empezar de cero:**
```bash
$ reset
# Confirma con "Sí"
```

---

## 📚 Documentación Completa

Ve `DOCUMENTACION.md` para:
- Detalles técnicos de cada componente
- API completa de cada motor
- Flujos de datos
- Criterios de evolución
- Configuración avanzada

---

## ✨ Features Destacados

### 1. Parser AST Real
No usa `eval()`. Parsea y evalúa condiciones de forma segura.

```typescript
// Condición compleja
"action.type == 'delete' and file.size > 1MB or action.type == 'remove'"

// Se evalúa correctamente contra cualquier contexto
```

### 2. Detección de Patrones Multi-Dimensional

- **Secuencial:** A → B → C (con timing)
- **Temporal:** Acciones en horarios específicos
- **Frecuencia:** Repeticiones por día/hora
- **Contextual:** Agrupación por keywords

### 3. Evolución Adaptativa

El sistema aprende:
- Qué reglas funcionan (success rate)
- Cuáles deprecar (baja performance)
- Cuándo crear nuevas (desde patrones)
- Cómo optimizar (A/B testing con shadow mode)

### 4. Terminal Interactiva

No es decorativa. Es funcional:
- Historial de comandos (↑↓)
- Autocompletado implícito
- Timestamps en outputs
- Color-coding por tipo

---

## 🎓 Aprende Más

**Flujo recomendado:**

1. ✅ **Explora** UI (10 min)
2. ✅ **Prueba** terminal (15 min)
3. ✅ **Genera** patrones (20 min)
4. ✅ **Ejecuta** evolución (10 min)
5. ✅ **Lee** documentación técnica
6. ✅ **Modifica** código fuente

---

## 🚀 Próximos Pasos

**Si quieres extender:**

1. **Agregar ML real:** TensorFlow.js
2. **Escalabilidad:** IndexedDB en lugar de localStorage
3. **Async:** WebWorkers para procesamiento
4. **Cloud:** Sincronización en la nube
5. **Viz:** Gráficos con D3.js
6. **Testing:** Suite completa con Vitest

---

## 📦 Estructura de Archivos

```
copilot-master/
├── copilot-master.html         # Aplicación compilada (todo-en-uno)
├── DOCUMENTACION.md            # Docs técnicas completas
├── README.md                   # Esta guía
└── src/                        # Código fuente (si quieres modificar)
    ├── storage.ts              # Motor de persistencia
    ├── decision-engine.ts      # Evaluador de reglas
    ├── pattern-detector.ts     # Detector de patrones
    ├── evolution-engine.ts     # Motor de evolución
    ├── store.ts                # Estado global
    ├── types.ts                # Tipos TypeScript
    └── components/
        ├── Terminal.tsx        # Terminal interactiva
        ├── DecisionEngine.tsx  # UI motor decisiones
        └── ...
```

---

## 💬 Tips Finales

1. **Experimenta sin miedo** - Todo persiste, puedes hacer reset
2. **Usa la terminal** - Es la forma más directa de interactuar
3. **Genera patrones** - El sistema mejora con uso
4. **Observa la evolución** - Verás cómo se adapta
5. **Lee el código** - Está limpio y bien documentado

---

**¡Disfruta tu Copiloto Maestro! 🎉**

Si encuentras bugs o tienes ideas, ¡adelante con las mejoras!
