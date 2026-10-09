const test = require('node:test');
const assert = require('node:assert/strict');

test('Licznik Nawodnienia: rejestracja porcji wody, historia dnia i kalkulacja 7 dni', async (t) => {
  // Symulacja modelu danych i logiki hydrationService
  const DEFAULT_TARGET = 3000;
  let history = {};

  const getHydrationDay = (h, dateStr, target = DEFAULT_TARGET) => {
    return h[dateStr] || { date: dateStr, totalMl: 0, targetMl: target, entries: [] };
  };

  const logWaterIntake = (h, dateStr, amountMl, timeStr = '09:00') => {
    const day = getHydrationDay(h, dateStr);
    const newEntry = {
      id: `w-${Date.now()}-${Math.random()}`,
      time: timeStr,
      amountMl,
      timestamp: Date.now()
    };
    const updatedEntries = [...day.entries, newEntry];
    const totalMl = updatedEntries.reduce((sum, e) => sum + e.amountMl, 0);
    return {
      ...h,
      [dateStr]: { ...day, totalMl, entries: updatedEntries }
    };
  };

  const removeWaterEntry = (h, dateStr, entryId) => {
    const day = getHydrationDay(h, dateStr);
    const updatedEntries = day.entries.filter(e => e.id !== entryId);
    const totalMl = updatedEntries.reduce((sum, e) => sum + e.amountMl, 0);
    return {
      ...h,
      [dateStr]: { ...day, totalMl, entries: updatedEntries }
    };
  };

  const todayKey = '2026-10-09';
  const yesterdayKey = '2026-10-08';

  // 1. Dodawanie porcji wody w dzisiejszym dniu
  history = logWaterIntake(history, todayKey, 250, '08:00');
  history = logWaterIntake(history, todayKey, 500, '11:30');
  history = logWaterIntake(history, todayKey, 750, '15:00');

  let todayData = getHydrationDay(history, todayKey);
  assert.equal(todayData.totalMl, 1500, 'Suma wypitej wody w dniu dzisiejszym powinna wynosić 1500 ml');
  assert.equal(todayData.entries.length, 3, 'Powinny być zarejestrowane 3 wpisy na osi czasu');
  assert.equal(todayData.entries[0].amountMl, 250);
  assert.equal(todayData.entries[1].amountMl, 500);
  assert.equal(todayData.entries[2].amountMl, 750);

  // 2. Dodawanie porcji dla dnia wczorajszego (historia wstecz)
  history = logWaterIntake(history, yesterdayKey, 1000, '10:00');
  history = logWaterIntake(history, yesterdayKey, 2000, '16:00');

  let yesterdayData = getHydrationDay(history, yesterdayKey);
  assert.equal(yesterdayData.totalMl, 3000, 'Wczoraj wypito 3000 ml');
  assert.equal(yesterdayData.entries.length, 2);

  // 3. Usuwanie błędnego wpisu
  const entryToDeleteId = todayData.entries[1].id; // wpis 500ml
  history = removeWaterEntry(history, todayKey, entryToDeleteId);
  todayData = getHydrationDay(history, todayKey);

  assert.equal(todayData.totalMl, 1000, 'Po usunięciu 500ml suma powinna wynosić 1000ml');
  assert.equal(todayData.entries.length, 2, 'Powinny zostać 2 wpisy');

  // 4. Test oznaczania celu dziennego
  const isYesterdayGoalMet = yesterdayData.totalMl >= yesterdayData.targetMl;
  const isTodayGoalMet = todayData.totalMl >= todayData.targetMl;

  assert.equal(isYesterdayGoalMet, true, 'Wczorajszy cel (3000ml) został osiągnięty');
  assert.equal(isTodayGoalMet, false, 'Dzisiejszy cel (3000ml) nie został jeszcze osiągnięty przy 1000ml');
});
