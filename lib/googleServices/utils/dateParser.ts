/**
 * Utilidad para parsear fechas en lenguaje natural a ISO 8601
 * Necesaria para Calendar y Tasks APIs
 */

/**
 * Parsea una fecha en lenguaje natural y la convierte a Date
 * @param naturalLanguage - Fecha en lenguaje natural (ej: "mañana a las 3pm", "next Monday at 10:00")
 * @param timeZone - Zona horaria del usuario (default: 'America/Bogota')
 * @returns Date object o null si no se puede parsear
 */
export function parseNaturalLanguageDate(
  naturalLanguage: string,
  timeZone: string = 'America/Bogota'
): Date | null {
  const now = new Date();
  const lowerStr = naturalLanguage.toLowerCase().trim();

  // --- Palabras clave temporales ---

  // Hoy
  if (lowerStr.includes('hoy') || lowerStr.includes('today')) {
    return extractTimeOrDefault(lowerStr, now);
  }

  // Mañana
  if (lowerStr.includes('mañana') || lowerStr.includes('manana') || lowerStr.includes('tomorrow')) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return extractTimeOrDefault(lowerStr, tomorrow);
  }

  // Pasado mañana
  if (lowerStr.includes('pasado mañana') || lowerStr.includes('day after tomorrow')) {
    const dayAfter = new Date(now);
    dayAfter.setDate(dayAfter.getDate() + 2);
    return extractTimeOrDefault(lowerStr, dayAfter);
  }

  // Esta semana / Esta tarde / Esta noche
  if (lowerStr.includes('esta tarde') || lowerStr.includes('this afternoon')) {
    const afternoon = new Date(now);
    afternoon.setHours(15, 0, 0, 0); // 3pm
    return afternoon;
  }

  if (lowerStr.includes('esta noche') || lowerStr.includes('tonight')) {
    const tonight = new Date(now);
    tonight.setHours(20, 0, 0, 0); // 8pm
    return tonight;
  }

  // Días de la semana (próximo lunes, next Monday, etc.)
  const weekdayMatch = lowerStr.match(/(próximo|proximo|next|este)\s+(lunes|monday|martes|tuesday|miércoles|miercoles|wednesday|jueves|thursday|viernes|friday|sábado|sabado|saturday|domingo|sunday)/);
  if (weekdayMatch) {
    const targetDay = parseWeekday(weekdayMatch[2]);
    if (targetDay !== null) {
      const nextWeekday = getNextWeekday(now, targetDay);
      return extractTimeOrDefault(lowerStr, nextWeekday);
    }
  }

  // En N días/horas (ej: "en 3 días", "in 2 hours")
  const inDaysMatch = lowerStr.match(/en\s+(\d+)\s+(día|dias|day|days)/);
  if (inDaysMatch) {
    const days = parseInt(inDaysMatch[1], 10);
    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + days);
    return extractTimeOrDefault(lowerStr, futureDate);
  }

  const inHoursMatch = lowerStr.match(/en\s+(\d+)\s+(hora|horas|hour|hours)/);
  if (inHoursMatch) {
    const hours = parseInt(inHoursMatch[1], 10);
    const futureDate = new Date(now);
    futureDate.setHours(futureDate.getHours() + hours);
    return futureDate;
  }

  // Fechas específicas (ej: "15 de noviembre", "November 15", "2025-11-15")
  const dateISOMatch = lowerStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (dateISOMatch) {
    const [, year, month, day] = dateISOMatch;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return extractTimeOrDefault(lowerStr, date);
  }

  // Fecha en español (ej: "15 de noviembre", "13 de noviembre de 2025")
  const dateSpanishMatch = lowerStr.match(/(\d{1,2})\s+de\s+(\w+)(?:\s+de\s+(\d{4}))?/);
  if (dateSpanishMatch) {
    const day = parseInt(dateSpanishMatch[1], 10);
    const monthName = dateSpanishMatch[2];
    const year = dateSpanishMatch[3] ? parseInt(dateSpanishMatch[3]) : now.getFullYear();
    const month = parseSpanishMonth(monthName);

    if (month !== null) {
      const date = new Date(year, month, day);
      return extractTimeOrDefault(lowerStr, date);
    }
  }

  // Fecha en inglés (ej: "November 15", "November 15, 2025")
  const dateEnglishMatch = lowerStr.match(/(\w+)\s+(\d{1,2})(?:,?\s+(\d{4}))?/);
  if (dateEnglishMatch) {
    const monthName = dateEnglishMatch[1];
    const day = parseInt(dateEnglishMatch[2], 10);
    const year = dateEnglishMatch[3] ? parseInt(dateEnglishMatch[3]) : now.getFullYear();
    const month = parseEnglishMonth(monthName);

    if (month !== null) {
      const date = new Date(year, month, day);
      return extractTimeOrDefault(lowerStr, date);
    }
  }

  // Si no se pudo parsear, retornar null
  console.warn(`[DATE_PARSER] No se pudo parsear la fecha: "${naturalLanguage}"`);
  return null;
}

/**
 * Extrae la hora de un string o usa la hora actual como default
 */
function extractTimeOrDefault(str: string, baseDate: Date): Date {
  const lowerStr = str.toLowerCase();

  // Formato 24 horas (ej: "14:30", "10:00")
  const time24Match = lowerStr.match(/(\d{1,2}):(\d{2})/);
  if (time24Match) {
    const hours = parseInt(time24Match[1], 10);
    const minutes = parseInt(time24Match[2], 10);
    baseDate.setHours(hours, minutes, 0, 0);
    return baseDate;
  }

  // Formato 12 horas con AM/PM (ej: "3pm", "10:30am")
  const time12Match = lowerStr.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)/);
  if (time12Match) {
    let hours = parseInt(time12Match[1], 10);
    const minutes = time12Match[2] ? parseInt(time12Match[2], 10) : 0;
    const meridiem = time12Match[3].toLowerCase();

    if (meridiem.includes('pm') && hours < 12) {
      hours += 12;
    } else if (meridiem.includes('am') && hours === 12) {
      hours = 0;
    }

    baseDate.setHours(hours, minutes, 0, 0);
    return baseDate;
  }

  // Si no se especifica hora, usar la hora actual o un default razonable
  // Si es un evento futuro sin hora, asignar 9:00 AM por defecto
  if (baseDate > new Date()) {
    baseDate.setHours(9, 0, 0, 0);
  }

  return baseDate;
}

/**
 * Parsea día de la semana en español o inglés a número (0 = Domingo, 6 = Sábado)
 */
function parseWeekday(dayName: string): number | null {
  const lowerDay = dayName.toLowerCase();

  const weekdayMap: { [key: string]: number } = {
    'domingo': 0, 'sunday': 0,
    'lunes': 1, 'monday': 1,
    'martes': 2, 'tuesday': 2,
    'miércoles': 3, 'miercoles': 3, 'wednesday': 3,
    'jueves': 4, 'thursday': 4,
    'viernes': 5, 'friday': 5,
    'sábado': 6, 'sabado': 6, 'saturday': 6,
  };

  return weekdayMap[lowerDay] ?? null;
}

/**
 * Obtiene el próximo día de la semana específico
 */
function getNextWeekday(from: Date, targetDay: number): Date {
  const result = new Date(from);
  const currentDay = result.getDay();
  const daysUntilTarget = (targetDay + 7 - currentDay) % 7 || 7; // Si es hoy, ir a la próxima semana

  result.setDate(result.getDate() + daysUntilTarget);
  return result;
}

/**
 * Parsea mes en español a número (0 = Enero, 11 = Diciembre)
 */
function parseSpanishMonth(monthName: string): number | null {
  const lowerMonth = monthName.toLowerCase();

  const monthMap: { [key: string]: number } = {
    'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3,
    'mayo': 4, 'junio': 5, 'julio': 6, 'agosto': 7,
    'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11,
  };

  return monthMap[lowerMonth] ?? null;
}

/**
 * Parsea mes en inglés a número (0 = January, 11 = December)
 */
function parseEnglishMonth(monthName: string): number | null {
  const lowerMonth = monthName.toLowerCase();

  const monthMap: { [key: string]: number } = {
    'january': 0, 'jan': 0,
    'february': 1, 'feb': 1,
    'march': 2, 'mar': 2,
    'april': 3, 'apr': 3,
    'may': 4,
    'june': 5, 'jun': 5,
    'july': 6, 'jul': 6,
    'august': 7, 'aug': 7,
    'september': 8, 'sep': 8, 'sept': 8,
    'october': 9, 'oct': 9,
    'november': 10, 'nov': 10,
    'december': 11, 'dec': 11,
  };

  return monthMap[lowerMonth] ?? null;
}

/**
 * Parsea un rango de fechas para búsquedas (ej: "last week", "this month")
 * Retorna { timeMin, timeMax }
 */
export function parseDateRangeForCalendar(rangeStr: string): { timeMin: Date; timeMax: Date } {
  const now = new Date();
  const lowerStr = rangeStr.toLowerCase().trim();

  // Hoy
  if (lowerStr.includes('hoy') || lowerStr.includes('today')) {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { timeMin: start, timeMax: end };
  }

  // Mañana
  if (lowerStr.includes('mañana') || lowerStr.includes('manana') || lowerStr.includes('tomorrow')) {
    const start = new Date(now);
    start.setDate(start.getDate() + 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    return { timeMin: start, timeMax: end };
  }

  // Esta semana (lunes a domingo)
  if (lowerStr.includes('esta semana') || lowerStr.includes('this week')) {
    const start = new Date(now);
    const dayOfWeek = start.getDay();
    const diff = start.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Ajustar al lunes
    start.setDate(diff);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 6); // Domingo
    end.setHours(23, 59, 59, 999);

    return { timeMin: start, timeMax: end };
  }

  // Próximos N días (ej: "next 7 days", "próximos 7 días")
  const nextDaysMatch = lowerStr.match(/(next|próximos?|proximos?)\s+(\d+)\s+(día|dias|day|days)/);
  if (nextDaysMatch) {
    const days = parseInt(nextDaysMatch[2], 10);
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setDate(end.getDate() + days);
    end.setHours(23, 59, 59, 999);
    return { timeMin: start, timeMax: end };
  }

  // Últimos N días (ej: "last 7 days", "últimos 7 días", "pasados 7 días")
  const lastDaysMatch = lowerStr.match(/(last|últimos?|ultimos?|pasados?)\s+(\d+)\s+(día|dias|day|days)/);
  if (lastDaysMatch) {
    const days = parseInt(lastDaysMatch[2], 10);
    const start = new Date(now);
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { timeMin: start, timeMax: end };
  }

  // Semana pasada (ej: "last week", "semana pasada")
  if (lowerStr.includes('semana pasada') || lowerStr.includes('last week')) {
    const start = new Date(now);
    const dayOfWeek = start.getDay();
    const diff = start.getDate() - dayOfWeek - 6; // Ir al lunes de la semana pasada
    start.setDate(diff);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 6); // Domingo de la semana pasada
    end.setHours(23, 59, 59, 999);

    return { timeMin: start, timeMax: end };
  }

  // Mes pasado (ej: "last month", "mes pasado")
  if (lowerStr.includes('mes pasado') || lowerStr.includes('last month')) {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    end.setHours(23, 59, 59, 999);
    return { timeMin: start, timeMax: end };
  }

  // Este mes (month)
  if (lowerStr.includes('este mes') || lowerStr.includes('this month')) {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
    return { timeMin: start, timeMax: end };
  }

  // Default: hoy (si no se puede parsear)
  console.warn(`[DATE_PARSER] No se pudo parsear el rango: "${rangeStr}". Usando "hoy" como default.`);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return { timeMin: start, timeMax: end };
}

/**
 * Parsea un rango de fechas para Gmail (retorna query string)
 * Ejemplo: "last week" → "after:2025/11/06 before:2025/11/13"
 */
export function parseDateRangeForGmail(rangeStr: string): string {
  const lowerStr = rangeStr.toLowerCase().trim();

  if (!rangeStr || lowerStr === 'any time' || lowerStr === 'todo el tiempo') {
    return '';
  }

  const { timeMin, timeMax } = parseDateRangeForCalendar(rangeStr);

  // Formatear fechas para Gmail (YYYY/MM/DD)
  const formatDateForGmail = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
  };

  return `after:${formatDateForGmail(timeMin)} before:${formatDateForGmail(timeMax)}`;
}
