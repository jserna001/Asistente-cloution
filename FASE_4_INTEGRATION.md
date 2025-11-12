# Fase 4: Análisis de Tendencias - Guía de Integración

## ✅ Archivos Creados/Modificados

1. **app/api/analytics/productivity-trends/route.ts** (NUEVO) - Endpoint de análisis
2. **components/ProductivityTrends.tsx** (NUEVO) - Componente React de visualización
3. **scripts/generate-summary.ts** (MODIFICADO) - Agregado análisis semanal automático
4. **FASE_4_INTEGRATION.md** (NUEVO) - Esta guía

---

## 🎯 Objetivo

Proporcionar insights automáticos sobre patrones de productividad del usuario:
- Tendencias semanales/mensuales
- Días más productivos
- Horarios de mayor actividad
- Insights automáticos generados por IA

---

## 🔧 Integración en Settings

### Paso 1: Importar el Componente

Editar `app/settings/page.tsx`:

```tsx
// 1. Agregar import al inicio del archivo
import ProductivityTrends from '../../components/ProductivityTrends';

// 2. Agregar el componente en el tab de "Preferencias" o crear tab nuevo
// Opción A: En tab "Preferencias" (después del componente ScheduleOptimization)
<div style={{ marginTop: 'var(--space-8)' }}>
  <ProductivityTrends period="week" />
</div>

// Opción B: Crear nuevo tab "Analíticas"
{activeTab === 'analytics' && (
  <div>
    <h2>Análisis de Productividad</h2>

    <div style={{ marginTop: 'var(--space-6)' }}>
      <ProductivityTrends period="week" />
    </div>

    <div style={{ marginTop: 'var(--space-6)' }}>
      <ProductivityTrends period="month" />
    </div>
  </div>
)}
```

---

## 📊 Cómo Funciona

### 1. Endpoint de Análisis (`/api/analytics/productivity-trends`)

Analiza datos históricos de los últimos 7 o 30 días:

**Query Parameters:**
- `period`: `"week"` o `"month"` (default: week)

**Métricas Calculadas:**
- Total de tareas del período
- Tareas completadas vs pendientes
- Tasa de completación (%)
- Comparación con período anterior (+X%)
- Día más productivo
- Horas más productivas (top 3)
- Desglose diario de actividad
- Insights automáticos

**Ejemplo de Request:**

```bash
GET /api/analytics/productivity-trends?period=week
Headers: Authorization: Bearer {token}
```

**Ejemplo de Response:**

```json
{
  "success": true,
  "analysis": {
    "period": "week",
    "totalTasks": 42,
    "completedTasks": 38,
    "urgentTasks": 5,
    "completionRate": 90.48,
    "vsLastPeriod": {
      "tasksChange": 15.2,
      "completionRateChange": 5.3
    },
    "mostProductiveDay": {
      "day": "Martes",
      "date": "2025-11-10",
      "taskCount": 15
    },
    "busiestHours": [
      { "hour": "9:00-10:00", "taskCount": 18 },
      { "hour": "14:00-15:00", "taskCount": 12 },
      { "hour": "10:00-11:00", "taskCount": 8 }
    ],
    "dailyBreakdown": [
      { "dayOfWeek": "Lunes", "date": "2025-11-09", "taskCount": 8, "urgentCount": 1 },
      { "dayOfWeek": "Martes", "date": "2025-11-10", "taskCount": 15, "urgentCount": 2 },
      ...
    ],
    "insights": [
      "¡Excelente trabajo! Completaste 15% más tareas que la semana pasada.",
      "Martes es tu día más productivo - considera agendar tareas difíciles ese día.",
      "Tus mejores horarios son 9-10 AM (18 interacciones) y 2-3 PM (12 interacciones)."
    ]
  }
}
```

### 2. Componente de Visualización (`ProductivityTrends.tsx`)

**Props:**
- `period?: 'week' | 'month'` - Período a analizar (default: week)

**Features:**
- Selector de período (Semana/Mes)
- Estadísticas principales (total tareas, completadas, urgentes)
- Gráfico de barras de actividad diaria
- Día más productivo destacado
- Top 3 mejores horarios
- Insights automáticos con fondo verde

**Estados:**
- **Loading:** Muestra "Analizando tu productividad..."
- **Error:** Muestra mensaje de error
- **Success:** Muestra análisis completo con visualizaciones

### 3. Integración en Resúmenes Diarios

El script `generate-summary.ts` ahora incluye automáticamente insights semanales:

**Función Agregada:**
```typescript
async function getProductivityInsights(userId: string): Promise<string>
```

**Qué Hace:**
1. Obtiene resúmenes de últimos 7 días
2. Obtiene interacciones del usuario
3. Calcula:
   - Total de interacciones
   - Promedio por día
   - Día más activo
   - Tipo de interacción favorito
4. Retorna insights formateados para incluir en el resumen

**Ejemplo de Output en Resumen:**
```
Tendencias de la Semana:
---
📊 Esta semana tuviste 85 interacciones en 7 días (promedio: 12/día).
🔥 Martes fue tu día más activo (23 interacciones).
🎯 Interactúas más con: Tareas de Notion.
---
```

---

## 🧪 Testing

### Requisitos de Datos
- Mínimo 3 días de resúmenes
- Al menos algunas interacciones registradas

### Testing con Datos Reales

```bash
# 1. Generar datos de prueba (si es necesario)
# Ejecutar en Supabase SQL Editor el script de datos de prueba de FASE_3_INTEGRATION.md

# 2. Probar endpoint directamente
curl -H "Authorization: Bearer {token}" \
  "https://tu-app.vercel.app/api/analytics/productivity-trends?period=week"

# 3. Probar componente en Settings
# Ir a /settings y verificar que el componente carga correctamente
```

### Generar Resumen con Tendencias

```bash
# Generar resumen diario (incluirá tendencias automáticamente)
npx tsx scripts/generate-summary.ts
```

**Output Esperado:**
```
Iniciando la generación del resumen matutino...
Buscando eventos del calendario para hoy...
Eventos encontrados: 2
Buscando tareas en Notion...
Buscando correos importantes...
Obteniendo insights de productividad...
Generando resumen diario...

--- RESUMEN DEL DÍA ---

📅 Eventos de Hoy:
- 09:00 - Reunión de equipo
- 14:00 - Presentación proyecto

✅ Tareas Pendientes:
- [Alta prioridad] Revisar propuesta
- Responder correos urgentes

📊 Esta semana tuviste 85 interacciones en 7 días (promedio: 12/día).
🔥 Martes fue tu día más activo (23 interacciones).

¡Sigue así! Esta semana has sido más productivo que la anterior.

-----------------------
Resumen guardado en Supabase exitosamente.
```

---

## 📈 Algoritmo de Detección de Insights

El endpoint genera insights automáticos basados en:

1. **Comparación con Período Anterior:**
   - Si cambio > +10%: "¡Excelente! Completaste X% más tareas"
   - Si cambio < -10%: "Tuviste X% menos actividad - considera revisar tus prioridades"

2. **Día Más Productivo:**
   - Si un día tiene >30% más actividad: "Martes es tu día más productivo"

3. **Horas Productivas:**
   - Identifica top 3 horarios
   - "Tus mejores horarios son 9-10 AM (X interacciones)"

4. **Tendencia de Urgencia:**
   - Si >20% son urgentes: "Muchas tareas urgentes - considera mejor planificación"
   - Si <10% son urgentes: "¡Bien! Pocas tareas urgentes = buena planificación"

---

## 🎨 Personalización

### Cambiar Colores del Gráfico

En `ProductivityTrends.tsx`, editar:

```tsx
backgroundColor: day.taskCount === data.mostProductiveDay.taskCount
  ? 'var(--color-primary)'   // Día destacado
  : 'var(--color-primary)',  // Días normales
opacity: day.taskCount === data.mostProductiveDay.taskCount ? 1 : 0.5,
```

### Ajustar Período de Análisis

Modificar el endpoint:

```typescript
// En app/api/analytics/productivity-trends/route.ts
const daysToAnalyze = period === 'month' ? 30 : 7; // Cambiar a 14 para 2 semanas
```

---

## 🔗 Relacionado

- **Requiere:** Fase 2 (summary_interactions tabla)
- **Mejora:** Fase 3 (usa los mismos datos para optimización de horario)
- **Integra con:** Resúmenes diarios automáticos

---

## 🚀 Próximos Pasos

1. Integrar componente en Settings (ver instrucciones arriba)
2. Generar suficientes datos de prueba (>7 días)
3. Probar endpoint y componente
4. Ajustar umbrales de insights según preferencias
5. Considerar agregar exportación de datos (CSV, JSON)

---

**Última Actualización:** 2025-11-12
**Versión:** 1.0
**Autor:** Claude (Fase 4 - Análisis de Tendencias)
