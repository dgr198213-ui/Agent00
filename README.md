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
| **Knowledge** | Fuentes de conocimiento (texto, Markdown, CSV, JSON, website, GitHub, Notion, Google Docs, Confluence). Independientemente del origen, todo termina indexado igual |
| **Tool** | Herramientas con interfaz única `Tool { id, name, schema(), execute() }`: navegador web, API HTTP, webhook, memoria persistente |
| **Memory** | Dos tipos claramente separados: *Conversation Memory* (temporal, `conversations`/`messages`) y *Agent Memory* (persistente, `agentMemories`). Nunca se mezclan |
| **Playground** | Donde se prueba el agente: chat con su identidad, conocimiento y herramientas |
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
│   └── agent-platform.ts
├── application/      # Casos de uso
│   ├── agent-service.ts
│   ├── knowledge-service.ts
│   ├── playground-service.ts
│   └── deployment-service.ts
├── domain/           # Entidades y contratos (sin dependencias de framework)
│   └── index.ts
├── infrastructure/   # Implementaciones Drizzle de los repositorios
│   └── repositories.ts
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
pnpm test         # suite de tests (15/15)
pnpm build        # build de producción
pnpm db:push      # generar y aplicar migraciones (requiere DATABASE_URL)
```

Variables de entorno necesarias: `DATABASE_URL`, `JWT_SECRET`, `VITE_APP_ID`, `OAUTH_SERVER_URL`, `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY`.

## Módulos legados

El motor de reglas/patrones del **Copiloto Maestro** (`server/engines`, `/copilot`) y el **Copiloto personalizado** (`/personalized`) se mantienen accesibles desde *Settings → Módulos legados*, fuera del flujo principal.

## Roadmap

- **Hecho — Fase 1 (Simplificación):** código muerto eliminado (`copilot-master.html`, `ComponentShowcase`, `examples.ts`), 36 errores de TypeScript corregidos, 2 tests rotos arreglados.
- **Hecho — Fase 2 (Arquitectura):** capas API / Application / Domain / Infrastructure introducidas.
- **Hecho — Fase 3 (Modelo de dominio):** entidades `Agent`, `Knowledge`, `Tool`, `Memory` y `Deployment` con interfaz estándar de herramientas.
- **Hecho — Fase 4 (UX):** navegación lineal Crear → Conocimiento → Herramientas → Playground → Publicar.
- **Pendiente — Fase 5 (Optimización):** retrieval con embeddings para Knowledge, streaming de respuestas en el Playground, más herramientas (Slack, Discord, Email, Database, Stripe), tests de integración de la capa Application y reducción de dependencias de UI no usadas.
