# Agent00 — Agent Builder Platform

> La forma más rápida de construir, probar y desplegar agentes de IA.

Agent00 ha dejado de ser una aplicación de IA generalista para convertirse en una **plataforma de construcción de agentes**: todo el producto gira alrededor del ciclo de vida de un `Agent`.

## Flujo del producto

```
Crear Agente → Definir identidad → Añadir conocimiento → Conectar herramientas → Probar (Playground) → Publicar
```

No existe ninguna otra complejidad obligatoria.

## Conceptos

| Entidad | Descripción |
|---|---|
| **Agent** | Núcleo del producto: `id, name, description, model, temperature, systemPrompt, icon, visibility, status` |
| **Knowledge** | Fuentes de conocimiento (texto, Markdown, CSV, JSON, website, GitHub, Notion, Google Docs, Confluence). Todo se trocea en chunks y se indexa igual: retrieval semántico con embeddings cuando el proveedor está disponible, con degradación automática a scoring léxico |
| **Tool** | Herramientas con interfaz única `Tool { id, name, schema(), execute() }`: navegador web, API HTTP, webhook, memoria persistente, Slack, Discord, Email (Resend), Base de datos (MySQL solo lectura) y Stripe (solo lectura) |
| **Memory** | Dos tipos claramente separados: *Conversation Memory* (temporal, `conversations`/`messages`) y *Agent Memory* (persistente, `agentMemories`). Nunca se mezclan |
| **Playground** | Donde se prueba el agente: chat en streaming (SSE) con su identidad, conocimiento relevante (retrieval por consulta) y herramientas |
| **Deployment** | Publicación del agente: `private`, `public`, `api`, `widget` o `webhook` |

## Modelo de datos

```
User
 └─ Workspace (preparado para equipos)
     └─ Agent
         ├─ Knowledge
         ├─ Tool
         ├─ Memory (persistente)
         ├─ Conversation → Message (temporal)
         └─ Deployment
```

## Arquitectura backend

Separación estricta por capas — nada de lógica en Express:

```
server/
├── api/              # Capa API (tRPC): validación y delegación
│   ├── agent-platform.ts
│   └── playground-stream.ts  # SSE: POST /api/playground/stream
├── application/      # Casos de uso
│   ├── agent-service.ts
│   ├── knowledge-service.ts
│   ├── playground-service.ts
│   ├── deployment-service.ts
│   └── retrieval.ts         # chunking + coseno + fallback léxico
├── domain/           # Entidades y contratos (sin dependencias de framework)
│   └── index.ts
├── infrastructure/   # Implementaciones Drizzle + clientes externos
│   ├── repositories.ts
│   ├── embeddings.ts       # /v1/embeddings con degradación a léxico
│   └── llm-stream.ts       # streaming SSE del LLM con tool-calling
├── tools/            # Registro de herramientas (interfaz única Tool)
│   └── registry.ts
├── engines/          # [Legado] Motor de reglas del Copiloto Maestro
└── _core/            # Framework: Express, tRPC, auth, LLM
```

## Frontend por funcionalidades

```
client/src/features/
├── agents/        # Listado, creación y editor de identidad
├── knowledge/     # Ingesta de fuentes de conocimiento
├── tools/         # Conexión de herramientas
├── playground/    # Chat de pruebas
├── deployment/    # Publicación (Publish Agent)
├── settings/      # Cuenta y módulos legados
└── shared/        # AgentPicker y utilidades comunes
```

El menú lateral se reduce a: **Agents · Knowledge · Tools · Playground · Deploy · Settings**.

## API pública

Los deployments de tipo `api`, `widget` y `webhook` generan una API key para invocar al agente desde fuera:

```bash
curl -X POST https://tu-dominio/api/v1/agents/invoke \
  -H "Authorization: Bearer agk_..." \
  -H "Content-Type: application/json" \
  -d '{"message": "Hola"}'
```

Respuesta:

```json
{ "agent": "Mi agente", "reply": "..." }
```

## Stack

- **Frontend:** React 19, Vite 7, Tailwind CSS 4, wouter, TanStack Query, shadcn/ui
- **Backend:** Express, tRPC 11, Zod
- **Base de datos:** MySQL vía Drizzle ORM
- **LLM:** integración vía `server/_core/llm.ts` con soporte de tool-calling

## Desarrollo

```bash
pnpm install
pnpm dev          # servidor de desarrollo
pnpm check        # verificación de tipos (0 errores)
pnpm test         # suite de tests (51/51): unitarios + integración de Application
pnpm build        # build de producción
pnpm db:push      # generar y aplicar migraciones (requiere DATABASE_URL)
```

Variables de entorno necesarias: `DATABASE_URL`, `JWT_SECRET`, `VITE_APP_ID`, `OAUTH_SERVER_URL`, `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY`. Opcional: `EMBEDDINGS_MODEL` (por defecto `text-embedding-3-small`; si el proveedor no expone `/v1/embeddings`, el retrieval degrada a léxico sin intervención).

## Módulos legados

El motor de reglas/patrones del **Copiloto Maestro** (`server/engines`, `/copilot`) y el **Copiloto personalizado** (`/personalized`) se mantienen accesibles desde *Settings → Módulos legados*, fuera del flujo principal.

## Roadmap

- **Hecho — Fase 1 (Simplificación):** código muerto eliminado (`copilot-master.html`, `ComponentShowcase`, `examples.ts`), 36 errores de TypeScript corregidos, 2 tests rotos arreglados.
- **Hecho — Fase 2 (Arquitectura):** capas API / Application / Domain / Infrastructure introducidas.
- **Hecho — Fase 3 (Modelo de dominio):** entidades `Agent`, `Knowledge`, `Tool`, `Memory` y `Deployment` con interfaz estándar de herramientas.
- **Hecho — Fase 4 (UX):** navegación lineal Crear → Conocimiento → Herramientas → Playground → Publicar.
- **Hecho — Fase 5 (Optimización):** retrieval con embeddings + fallback léxico (tabla `knowledgeChunks`), streaming SSE en el Playground con eventos de herramienta, 5 herramientas nuevas (Slack, Discord, Email vía Resend, MySQL solo lectura, Stripe solo lectura), 36 tests nuevos (unitarios de retrieval, integración de Application con repositorios en memoria, validaciones de seguridad de herramientas) y 8 dependencias sin uso eliminadas.

### Ideas futuras

Reranking con cross-encoder, ingesta con refresco programado de fuentes URL, herramientas de escritura en Stripe/DB tras un sistema de aprobaciones, y widget embebible real para deployments tipo `widget`.
