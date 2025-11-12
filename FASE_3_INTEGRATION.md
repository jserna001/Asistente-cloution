# Fase 3: Smart Scheduling - Guía de Integración

## ✅ Archivos Creados

1. **app/api/user/schedule-suggestions/route.ts** - Endpoint de análisis de patrones
2. **app/api/user/optimize-summary-schedule/route.ts** - Endpoint de optimización automática
3. **components/ScheduleOptimization.tsx** - Componente React de UI

---

## 🔧 Integración en Settings

### Opción 1: Agregar al tab de "Preferencias" (Recomendado)

Editar `app/settings/page.tsx` aproximadamente en la línea **700** (después de la sección de "Resumen Diario"):

```tsx
// 1. Importar el componente (agregar al inicio del archivo)
import ScheduleOptimization from '../../components/ScheduleOptimization';

// 2. Agregar después de la sección "Resumen Diario" (después del botón "Guardar")
{/* Optimización de Horario - FASE 3 */}
<div style={{ marginTop: 'var(--space-8)' }}>
  <ScheduleOptimization />
</div>
```

**Ubicación exacta:**
Después del botón "Guardar preferencias" en el tab de `preferences`, aproximadamente línea 730.

---

### Opción 2: Crear tab dedicado "Optimización"

Si prefieres un tab separado, editar `app/settings/page.tsx`:

```tsx
// 1. Modificar el tipo de tabs (línea ~31)
type Tab = 'general' | 'connections' | 'preferences' | 'optimization' | 'account';

// 2. Agregar el nuevo tab al array (línea ~215)
const tabs = [
  { id: 'general' as Tab, label: 'General', icon: <UserIcon size={18} /> },
  { id: 'connections' as Tab, label: 'Conexiones', icon: <SettingsIcon size={18} /> },
  { id: 'preferences' as Tab, label: 'Preferencias', icon: <ClockIcon size={18} /> },
  { id: 'optimization' as Tab, label: 'Optimización', icon: <AnimatedIcon size={18} /> }, // NUEVO
  { id: 'account' as Tab, label: 'Cuenta', icon: <LogOutIcon size={18} /> },
];

// 3. Agregar el panel del tab (en la sección de panels, aproximadamente línea 780)
{/* Optimization Tab */}
<div className="tab-panel" data-tab="optimization">
  <h2 style={{
    fontSize: 'var(--text-xl)',
    fontWeight: 'var(--font-bold)',
    marginBottom: 'var(--space-2)',
    color: 'var(--text-primary)',
  }}>
    Optimización Inteligente
  </h2>
  <p style={{
    fontSize: 'var(--text-sm)',
    color: 'var(--text-secondary)',
    marginBottom: 'var(--space-6)',
  }}>
    Optimiza automáticamente el horario de tus resúmenes basándose en tus patrones de uso
  </p>

  <ScheduleOptimization />
</div>
```

---

## 🧪 Testing

### 1. Verificar que los endpoints funcionan

```bash
# Terminal 1: Iniciar dev server
npm run dev

# Terminal 2: Probar el endpoint de sugerencias
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/user/schedule-suggestions
```

### 2. Generar datos de prueba

Para que el análisis funcione, necesitas:
- ✅ Al menos 7 resúmenes generados (table: `daily_summaries`)
- ✅ Interacciones con esos resúmenes (table: `summary_interactions`)
- ✅ Opcionalmente feedback (table: `summary_feedback`)

**Script de prueba rápida:**
```sql
-- Verificar datos disponibles
SELECT COUNT(*) FROM daily_summaries
WHERE user_id = 'YOUR_USER_ID'
AND created_at >= NOW() - INTERVAL '30 days';

SELECT COUNT(*) FROM summary_interactions
WHERE user_id = 'YOUR_USER_ID';
```

### 3. Probar en UI

1. Ve a `/settings`
2. Click en tab "Preferencias" (o "Optimización" si creaste tab nuevo)
3. Verás el componente `ScheduleOptimization`
4. Si tienes suficientes datos (>7 días), verás:
   - Horario actual vs sugerido
   - CTR actual vs potencial
   - Insights de tus patrones
   - Botón "Optimizar Horario" si hay mejora >15%

---

## 📊 Cómo Funciona

### Análisis de Patrones

El sistema analiza los últimos 30 días de resúmenes y calcula para cada hora del día:

1. **Click-Through Rate (CTR):** % de resúmenes en los que el usuario hizo clic en algún link
2. **Tiempo de Respuesta:** Minutos promedio entre envío y primera interacción
3. **Helpful Rate:** % de resúmenes marcados como útiles (feedback positivo)

### Score de Optimización

```typescript
score = (CTR × 0.7) + (rapidez_de_respuesta × 0.3)
```

- **70% peso:** CTR (más importante - mide engagement real)
- **30% peso:** Rapidez (cuanto más rápido interactúas, mejor)

### Criterio de Sugerencia

Solo sugiere cambio si:
- ✅ Mejora potencial > 15%
- ✅ Al menos 7 días de datos
- ✅ El horario sugerido tiene al menos 3 resúmenes de muestra

---

## 🎯 Ejemplo de Uso

```
📊 Análisis Actual:
   - Horario actual: 07:00
   - CTR: 45%
   - Tiempo promedio de respuesta: 120 minutos

⚡ Horario Sugerido:
   - Horario: 09:00
   - CTR: 78% (+73% mejora)
   - Tiempo promedio de respuesta: 15 minutos

💡 Insights:
   - Tu mejor horario es 9:00 - 10:00 basado en engagement histórico
   - Tus 3 mejores horarios son: 9:00 (78% CTR), 10:00 (65% CTR), 14:00 (52% CTR)
   - Evita estas horas: 7:00 (45% CTR), 22:00 (12% CTR)
   - Respondes rápido a tus resúmenes (promedio: 15 minutos)

[Botón: ⚡ Optimizar Horario (+73%)]
```

Al hacer clic, actualiza automáticamente `user_preferences.daily_summary_time`.

---

## 🚀 Despliegue

El componente está listo para producción. Solo necesitas:

1. ✅ Merge del PR
2. ✅ Deploy a Vercel (endpoints ya funcionan)
3. ✅ Integrar componente en settings (seguir Opción 1 o 2 arriba)

No requiere migraciones adicionales de DB.

---

## 📈 Mejoras Futuras (Opcionales)

Si quieres expandir esta fase:

1. **Multi-horario:** Permitir diferentes horarios por día de la semana
2. **A/B Testing:** Probar automáticamente diferentes horarios y medir resultados
3. **Notificaciones:** Enviar notificación cuando se detecte un mejor horario
4. **Dashboard:** Gráficos visuales de engagement por hora

---

## ❓ Troubleshooting

### "No hay suficientes datos"
- **Causa:** Menos de 7 resúmenes con interacciones
- **Solución:** Esperar más días o generar resúmenes de prueba manualmente

### "Error cargando sugerencias"
- **Causa:** Token de sesión inválido
- **Solución:** Verificar que `Authorization: Bearer` header sea correcto

### "Potencial mejora es 0%"
- **Causa:** Tu horario actual ya es el mejor según tus patrones
- **Solución:** ¡Nada que hacer! Ya estás optimizado 🎉

---

**Fecha:** 2025-11-12
**Fase:** 3/10 - Smart Scheduling
**Estado:** ✅ Implementada y lista para integración
