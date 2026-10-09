import { HydrationDayRecord, HydrationLogItem } from '../types';

const STORAGE_KEY = 'gymtracker_hydration_history';
const LEGACY_TODAY_KEY = 'gymtracker_water_today';
export const DEFAULT_DAILY_WATER_TARGET_ML = 3000;

export function getTodayDateKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getCurrentTimeFormatted(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

/**
 * Wczytuje pełną mapę historii nawodnienia z localStorage.
 * Zapewnia wsteczną kompatybilność z poprzednim kluczem gymtracker_water_today.
 */
export function loadHydrationHistory(): Record<string, HydrationDayRecord> {
  let history: Record<string, HydrationDayRecord> = {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      history = JSON.parse(raw);
    }
  } catch (err) {
    console.warn('[hydrationService] Błąd odczytu historii nawodnienia:', err);
  }

  // Kompatybilność wsteczna z gymtracker_water_today
  const todayKey = getTodayDateKey();
  try {
    const legacyToday = localStorage.getItem(LEGACY_TODAY_KEY);
    if (legacyToday && (!history[todayKey] || history[todayKey].totalMl === 0)) {
      const parsedLegacy = parseInt(legacyToday, 10);
      if (!isNaN(parsedLegacy) && parsedLegacy > 0) {
        history[todayKey] = {
          date: todayKey,
          totalMl: parsedLegacy,
          targetMl: DEFAULT_DAILY_WATER_TARGET_ML,
          entries: [
            {
              id: 'legacy-entry-init',
              time: '08:00',
              amountMl: parsedLegacy,
              timestamp: Date.now() - 3600000,
            }
          ]
        };
      }
    }
  } catch {}

  return history;
}

/**
 * Zapisuje całą historię nawodnienia i synchronizuje legacy klucz dla dzisiejszego dnia
 */
export function saveHydrationHistory(history: Record<string, HydrationDayRecord>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    const todayKey = getTodayDateKey();
    if (history[todayKey]) {
      localStorage.setItem(LEGACY_TODAY_KEY, String(history[todayKey].totalMl));
    }
  } catch (err) {
    console.error('[hydrationService] Błąd zapisu historii nawodnienia:', err);
  }
}

/**
 * Zwraca lub inicjalizuje rekord nawodnienia dla danego dnia
 */
export function getHydrationDay(
  history: Record<string, HydrationDayRecord>,
  dateStr: string,
  targetMl = DEFAULT_DAILY_WATER_TARGET_ML
): HydrationDayRecord {
  if (history[dateStr]) {
    return history[dateStr];
  }
  return {
    date: dateStr,
    totalMl: 0,
    targetMl,
    entries: []
  };
}

/**
 * Dodaje porcję wody do danego dnia
 */
export function logWaterIntake(
  currentHistory: Record<string, HydrationDayRecord>,
  dateStr: string,
  amountMl: number,
  customTime?: string,
  targetMl = DEFAULT_DAILY_WATER_TARGET_ML
): { updatedHistory: Record<string, HydrationDayRecord>; updatedDay: HydrationDayRecord } {
  const day = getHydrationDay(currentHistory, dateStr, targetMl);
  const time = customTime || getCurrentTimeFormatted();

  const newEntry: HydrationLogItem = {
    id: `water-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    time,
    amountMl,
    timestamp: Date.now(),
  };

  const updatedEntries = [...day.entries, newEntry];
  const updatedTotal = Math.max(0, updatedEntries.reduce((sum, item) => sum + item.amountMl, 0));

  const updatedDay: HydrationDayRecord = {
    ...day,
    totalMl: updatedTotal,
    entries: updatedEntries,
  };

  const updatedHistory = {
    ...currentHistory,
    [dateStr]: updatedDay,
  };

  saveHydrationHistory(updatedHistory);
  return { updatedHistory, updatedDay };
}

/**
 * Usuwa konkretny wpis z danego dnia
 */
export function removeWaterEntry(
  currentHistory: Record<string, HydrationDayRecord>,
  dateStr: string,
  entryId: string
): { updatedHistory: Record<string, HydrationDayRecord>; updatedDay: HydrationDayRecord } {
  const day = getHydrationDay(currentHistory, dateStr);
  const updatedEntries = day.entries.filter(e => e.id !== entryId);
  const updatedTotal = Math.max(0, updatedEntries.reduce((sum, item) => sum + item.amountMl, 0));

  const updatedDay: HydrationDayRecord = {
    ...day,
    totalMl: updatedTotal,
    entries: updatedEntries,
  };

  const updatedHistory = {
    ...currentHistory,
    [dateStr]: updatedDay,
  };

  saveHydrationHistory(updatedHistory);
  return { updatedHistory, updatedDay };
}

/**
 * Resetuje nawodnienie wybranego dnia
 */
export function resetDayHydration(
  currentHistory: Record<string, HydrationDayRecord>,
  dateStr: string
): { updatedHistory: Record<string, HydrationDayRecord>; updatedDay: HydrationDayRecord } {
  const day = getHydrationDay(currentHistory, dateStr);
  const updatedDay: HydrationDayRecord = {
    ...day,
    totalMl: 0,
    entries: [],
  };

  const updatedHistory = {
    ...currentHistory,
    [dateStr]: updatedDay,
  };

  saveHydrationHistory(updatedHistory);
  return { updatedHistory, updatedDay };
}

/**
 * Zwraca zestawienie ostatnich N dni (np. 7 dni wstecz od podanej daty)
 */
export function getRecentHydrationStats(
  history: Record<string, HydrationDayRecord>,
  daysCount = 7,
  endDateStr = getTodayDateKey()
): {
  days: { date: string; dayLabel: string; totalMl: number; targetMl: number; percent: number; isGoalMet: boolean }[];
  averageMl: number;
  totalPeriodMl: number;
  daysMetGoalCount: number;
} {
  const endDate = new Date(endDateStr);
  const daysList: { date: string; dayLabel: string; totalMl: number; targetMl: number; percent: number; isGoalMet: boolean }[] = [];
  const dayNamesShort = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So'];

  let sum = 0;
  let goalsMet = 0;

  for (let i = daysCount - 1; i >= 0; i--) {
    const cur = new Date(endDate);
    cur.setDate(endDate.getDate() - i);
    const dateKey = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
    const dayData = history[dateKey];
    const totalMl = dayData ? dayData.totalMl : 0;
    const targetMl = dayData?.targetMl || DEFAULT_DAILY_WATER_TARGET_ML;
    const percent = Math.min(100, Math.round((totalMl / targetMl) * 100));
    const isGoalMet = totalMl >= targetMl;

    if (isGoalMet) goalsMet++;
    sum += totalMl;

    daysList.push({
      date: dateKey,
      dayLabel: dayNamesShort[cur.getDay()],
      totalMl,
      targetMl,
      percent,
      isGoalMet,
    });
  }

  return {
    days: daysList,
    averageMl: Math.round(sum / (daysCount || 1)),
    totalPeriodMl: sum,
    daysMetGoalCount: goalsMet,
  };
}
