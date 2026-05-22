# 🧠 Memoria Permanente de Cline — Proyecto Aquatech

> **Propósito:** Este archivo guarda el contexto completo del proyecto para que Cline retome sin perder información entre sesiones.
> **Creado:** 4 de mayo de 2026

---

## 📋 Contexto del Proyecto

**Cliente:** Aquatech
**Problemas reportados:**
- Lentitud general
- Footer no carga bien
- Desincronización de datos

**Objetivo:** Auditoría completa para determinar si:
- **Opción A:** Reparar el repo existente
- **Opción B:** Reconstruir desde cero aprovechando la experiencia

---

## 🛠️ Stack de Herramientas Instalado

### 1. Matt Pocock Skills (personalizado para Cline)
- **Repo:** `npx skills@latest add mattpocock/skills` (50.2k ⭐)
- **Skills que uso adaptados a mi flujo como Cline:**

| Skill Original | Cómo lo aplico en Cline |
|---|---|
| **Grill Me** 🎤 | Antes de empezar cualquier tarea, hago preguntas para definir alcance exacto. No empiezo a codear sin tener claro qué construir. |
| **Caveman** 🪨 | Respondo conciso, sin floreos ni recomendaciones no pedidas. Ahorro tokens. |
| **Diagnose** 🩺 | Debug paso a paso: reproducir → aislar → hipotetizar → instrumentar → arreglar → test de regresión. |
| **TDD** 📚 | Escribo test antes del código. Rojo → Verde → Refactor. |
| **PRD** 📄 | Convierto conversaciones en documentos formales antes de construir. |
| **Architecture** 🏗️ | Analizo y propongo mejoras de arquitectura basadas en el código existente. |
| **Git Guardrails** 🛡️ | Verifico antes de commits destructivos. |

### 2. El Arquitecto (Hainrixz/the-architect)
- **Repo:** `git clone https://github.com/Hainrixz/the-architect.git`
- **Propósito:** Generar blueprint de 16 secciones para construir sin ambigüedad
- **Las 4 fases:** Discovery → Deep Dive → Architecture → Generate
- **Los 6 archetypes:** SaaS App, Marketing Site, Mobile App, API/Backend, Internal Tool, Content Platform
- **Las 16 secciones del blueprint:**
  1. Vision & Success Metrics
  2. Tech Stack + Rationale
  3. Directory Structure
  4. Data Models / SQL Schemas
  5. API Endpoints
  6. Frontend Components
  7. Design System (colors, fonts, spacing)
  8. Auth & Permissions
  9. Environment Variables
  10. Deployment
  11. Testing Strategy
  12. Build Order (paso a paso) ← **la más importante**
  13. Edge Cases & Errors
  14. Performance Considerations
  15. Future Improvements
  16. Glossary

### 3. Karpathy Skills
- **Repo:** forrestchang/andrej-karpathy-skills (65.5k ⭐)
- **Principios que aplico como Cline:**
  - Pensar antes de codear — no me apuro
  - Mantener las cosas simples — no meto complicaciones innecesarias
  - Cambios quirúrgicos — solo toco lo que me pidieron
  - Enfocado en la meta — no me desvío "mejorando de paso"

### 4. Agent Skills (Addy Osmani)
- **Repo:** addyosmani/agent-skills (18.2k ⭐)
- **Playbooks que uso:** TDD, Security Hardening, Code Review, Deploy
- **Modo ingeniero senior:** criterio de alguien que ha lanzado código en producción

### 5. Claude MEM (claude-mem)
- **Repo:** thedotmack/claude-mem (64.1k ⭐)
- **Propósito:** Memoria persistente entre sesiones
- **Equivalente en mi flujo:** Este archivo CLINE_MEMORY.md + mantener contexto en el proyecto

### 6. Archon
- **Repo:** coleam00/Archon (19k ⭐)
- **Propósito:** Workflows repetibles en YAML
- **Equivalente en mi flujo:** Checklists de tareas repetitivas documentadas

### 7. Multica
- **Repo:** multica-ai/multica (17.5k ⭐)
- **Propósito:** Múltiples agentes en paralelo
- **Equivalente en mi flujo:** Uso de subagentes (use_subagents) para tareas paralelas

---

## 📐 Metodología: "Platica, Luego Construye"

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   FASE 1        │     │   FASE 2        │     │   FASE 3        │
│   SETUP         │ ──► │   PLATICA       │ ──► │   CONSTRUCCIÓN  │
│   (instalar     │     │   (modelo chico) │     │   (modelo grande)│
│    herramientas)│     │   explorar ideas │     │   ejecutar plan │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                         Folder: /platica        Folder: /proyecto
```

**Regla de oro:** No construir y planear en la misma sesión.
- Plática = explorar → folder "platica" + modelos chicos
- Construcción = ejecutar → folder limpio + sin ruido de la conversación previa

---

## 📝 Plan de Auditoría (5 Fases)

### FASE 0 — Setup ✅ (Completado)
- [x] Proyecto clonado localmente en `aquatech-render/`
- [x] Skills instaladas en `.agents/skills/`
- [x] The Architect clonado en `the-architect/`
- [x] Carpetas de agentes innecesarias eliminadas (37 carpetas ocultas)
- [x] `skills/` duplicada eliminada (se conserva `.agents/skills/`)
- [x] `Nueva carpeta/` eliminada

### FASE 1 — Discovery del estado actual ✅ (Completado)

**Stack Tecnológico:**
| Componente | Tecnología | Versión |
|---|---|---|
| Framework | Next.js (App Router) | 16.2.1 |
| UI | React + Tailwind CSS | 19.2.4 / 4.2.2 |
| Lenguaje | TypeScript (strict) | ~5.x |
| BD | MySQL + Prisma ORM | 6.19.2 |
| Auth | NextAuth | 4.24.13 |
| PWA | next-pwa + custom-sw.js | 10.2.9 |
| Offline | Dexie.js (IndexedDB) | 4.3.0 |
| CDN | Bunny.net | — |
| Hosting | VPS (Docker) / Cloudflare Pages | — |
| Contenedor | Docker (ghcr.io) | — |

**Estructura del Proyecto:**
```
aquatech-render/
├── src/
│   ├── app/           # App Router (público + admin)
│   │   ├── admin/     # CRM: dashboard, projects, quotes, inventory, blog, marketing, calendar, team, reports, whatsapp
│   │   ├── api/       # ~25 endpoints REST
│   │   └── (páginas públicas) # accesorios, agencias, agua-potable, blog, hidromasajes, piletas, riego, saunas, tuberias, turcos
│   ├── components/    # Componentes React (BudgetBuilder, Sidebar, Calendar, chat, camera, etc.)
│   ├── lib/           # Utilidades (auth, db, pdf, push, whatsapp, offline, etc.)
│   ├── actions/       # Server Actions (marketing)
│   ├── hooks/         # Custom hooks (camera, localStorage, outbox, push)
│   ├── data/          # Datos (agencies, catalog)
│   ├── types/         # TypeScript types
│   └── scripts/       # Scripts de utilidad
├── prisma/
│   ├── schema.prisma  # ~25 modelos
│   └── seed.ts
└── public/            # Static assets + SW
```

**Modelos Principales (Prisma):** User, Client, Project, ProjectPhase, Quote, BudgetItem, Material, Expense, DayRecord, ChatMessage, MediaFile, Appointment, BlogPost, ContentPipeline, SocialPost, PushSubscription, etc.

**Problemas Reportados:**
1. 🐌 Lentitud general
2. 🔻 Footer no carga bien
3. 🔄 Desincronización de datos

### FASE 2 — Deep Dive Técnico (En proceso — Plática completada)

**Diagnóstico inicial (de conversación con el usuario):**

1. 🛑 **Reloads que interrumpen** — Al crear proyecto la página se recarga 2 veces, interrumpe el flujo. Coincide con la introducción de la capa offline.
2. 🚫 **"Proyecto no disponible offline"** — La app bloquea acceso si el proyecto no está en IndexedDB local. Castiga al usuario en vez de hacer fallback al servidor.
3. 🐌 **Lentitud en listas** (Proyectos, Cotizaciones) — Calendario y Recursos van bien. 31 proyectos activos.
4. ❌ **Sin herramientas de diagnóstico** — No hay logs de servidor, dashboard Cloudflare, ni métricas de VPS.

**Prioridades acordadas:**
1. Eliminar reloads que interrumpen
2. Offline que funcione sin trabas (no castigar al usuario)
3. Velocidad de listas al final

**Plan de acción definido:**

| Paso | Acción | Detalle |
|---|---|---|
| **0** | Clon seguro | Clonar repo a `aquatech-render-dev/` para experimentar sin tocar producción |
| **1** | Trazas quirúrgicas | `console.log` con timestamps en: router.refresh, SW messages, outbox state changes |
| **2** | Offline sin castigo | Siempre mostrar lo que haya: Dexie → servidor → "sin conexión". Precaching automático al abrir app. |
| **3** | Listas rápidas | Revisar consultas N+1, serialización de datos pesados en listas de proyectos |
| **4** | Ideas fuera de caja | Modo capataz, precaching nocturno, simplificar arquitectura offline |

**Contexto del usuario:**
- 12 personas probando (operadores de campo)
- No son programadores, tienen la idea de negocio
- El proyecto se desplegó para testeo mientras está en desarrollo
- El offline es crítico: los operadores salen a obra sin internet

### FASE 3 — Diagnóstico de Arquitectura
- [ ] Documentar lo que funciona
- [ ] Documentar lo que no funciona
- [ ] Identificar deuda técnica y patrones problemáticos
- [ ] **Decisión: ¿reparar o reconstruir?**

### FASE 4 — Blueprint (si aplica reconstrucción)
- [ ] Usar El Arquitecto para generar blueprint de 16 secciones
- [ ] Priorizar Build Order correcto

### FASE 5 — Reporte Final
- [ ] Entregar análisis completo con hallazgos, causas raíz y recomendación

---

## 🧰 Orden de Importancia de Skills

Siguiendo la recomendación de la comunidad:

1. **Karpathy Skills** — Base: pensar antes de actuar
2. **Matt Pocock Skills** — Grill Me, Diagnose, Caveman
3. **Agent Skills** — Criterio de ingeniero senior
4. **El Arquitecto** — Blueprints formales
5. **Archon** — Procesos repetibles

---

## ⚡ Atajos y Comandos Útiles

```bash
# Clonar repo del cliente
git clone https://github.com/activaqrnegocio-crypto/aquatech-render.git

# Instalar Matt Pocock Skills
npx skills@latest add mattpocock/skills

# Clonar El Arquitecto
git clone https://github.com/Hainrixz/the-architect.git

# Crear folder de plática
mkdir platica
```

---

## 🔄 Recordatorio para mí (Cline)

- **Siempre leer CLINE_MEMORY.md al inicio de cada sesión**
- **Usar caveman mode:** respuestas cortas, sin floreos
- **No empezar a construir sin plan** — aplicar Grill Me primero
- **Si algo se rompe, aplicar Diagnose** antes de adivinar
- **Documentar decisiones** en este archivo
- **Separar plática de construcción** en folders distintos
