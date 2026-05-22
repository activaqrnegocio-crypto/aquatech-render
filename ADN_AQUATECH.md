# 🧬 ADN del Proyecto: AQUATECH Ecosystem

Este documento define la identidad, arquitectura técnica y estrategia de crecimiento de **AQUATECH**, una plataforma integral que fusiona un sitio web corporativo de alto impacto con un CRM a medida para la gestión operativa y de marketing.

---

## 🕒 Integridad de Datos: Estandarización Horaria
Para garantizar la precisión en reportes de obra, agendamiento de personal y notificaciones automáticas, el ecosistema **AQUATECH** opera bajo una única fuente de verdad temporal:

*   **Zona Horaria Oficial**: `America/Guayaquil` (GMT-5).
*   **Implementación**: Todas las fechas mostradas en UI, generadas en PDFs o disparadas por Crons utilizan las utilidades centralizadas en `@/lib/date-utils.ts`.
*   **Propósito**: Eliminar disparidades entre el servidor (UTC) y la operación real en Loja y Zamora, asegurando que un reporte de las 6:00 AM sea siempre un reporte de las 6:00 AM.

---

## 1. Identidad de Negocio
*   **Empresa**: AQUATECH (RUC 1105048852001)
*   **Propietario**: Pablo José Castillo Castillo
*   **Sede Central**: 18 de Noviembre y Celica, Loja, Ecuador.
*   **Presencia**: Loja y Zamora (3 sucursales operativas).
*   **Propuesta de Valor**: *"Expertos en crear y mantener el paraíso en tu hogar"*. Especialistas en diseño, construcción de piscinas residenciales/comerciales, remodelación y mantenimiento técnico de alta gama.

---

## 2. Ecosistema Digital (Web DNA)
El sitio web [www.aquatech.com](http://www.aquatech.com) está diseñado como una máquina de ventas de 20 páginas con intención de búsqueda (Search Intent) y SEO On-Page.

### Estrategia de Posicionamiento SEO
*   **Keywords Core**: "Venta de piscinas en Loja", "Reparación de piscinas en Zamora", "Construcción de piscinas residenciales", "Mantenimiento de piscinas Ecuador".
*   **Blog Orgánico**: Centro de educación al cliente para generar confianza y mejorar el ranking en Google.
*   **Tienda de Accesorios**: E-commerce integrado para bombas, filtros y químicos, convirtiendo visitas en ingresos directos.

---

## 3. Arquitectura del CRM Aquatech (El Motor)
Software desarrollado a medida para cubrir el ciclo de vida completo del cliente, desde el prospecto hasta el reporte de campo.

### 📊 Módulo de Cotizaciones (Ventas)
*   **Generación Dinámica**: Creación de propuestas en PDF con hoja membretada profesional.
*   **Lógica de Costos**: Gestión de materiales individuales y "productos compuestos" (Material + Mano de Obra).
*   **Modo Campo**: Funcionalidad para generar borradores offline y sincronizar al recuperar conexión.

### 🏗️ Módulo de Proyectos & Operaciones
*   **Gestión de Fases**: División técnica (Obra Civil, Instalación, Acabados) para control de avance real vs. planeado.
*   **Bitácora Multimedia**: Muro de actividad donde los operarios suben fotos, videos y reportes diarios desde la obra.
*   **Control de Viáticos**: Registro de gastos por proyecto para asegurar la rentabilidad.

### 📱 Módulo de Marketing & IA
*   **Generador de Contenido**: IA integrada para crear artículos de blog, guiones para Reels y copys para redes sociales.
*   **Programador Social**: Sistema de agendamiento para Facebook e Instagram.
*   **Gestión de Conversión**: Respuestas automáticas a comentarios dirigiendo el tráfico hacia WhatsApp.

### 🕒 Módulo de Agendamiento Automático
*   **Hojas de Ruta**: Asignación 100% automatizada de tareas según la disponibilidad del personal.
*   **Alertas Proactivas**: Notificaciones automáticas por WhatsApp a los operadores (Recordatorios de 60, 30 y 10 minutos).

---

## 4. Automatización & IA: WhatsApp Bot
El sistema centraliza las consultas de las 3 sucursales de AQUATECH a través de un canal de WhatsApp inteligente que:
1.  **Filtra Prospectos**: Identifica necesidades (Venta, Reparación, Mantenimiento).
2.  **Construye Base de Datos**: Almacena contactos automáticamente en el CRM.
3.  **Chatbot 24/7**: Atención inmediata para consultas básicas y derivación a asesores humanos.

---

## 5. Entregables de Éxito
*   ✅ Sitio Web Corporativo (20 páginas) + Blog + E-commerce.
*   ✅ CRM Personalizado (Admin / Operadores).
*   ✅ 10 Contactos Digitales **ActivaQR** para el equipo comercial.
*   ✅ Google Business Profile optimizado para búsqueda local.
*   ✅ Capacitación y manuales de uso para el equipo AQUATECH.

---

**Desarrollado por**: Ing. César Augusto Reyes Jaramillo  
**Contrato**: 18 de Marzo de 2026.
