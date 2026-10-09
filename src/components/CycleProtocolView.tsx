import React, { useState, useMemo } from 'react';
import { 
  Syringe, 
  Calendar as CalendarIcon, 
  CalendarDays, 
  Clock, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  ChevronLeft, 
  ChevronRight, 
  Activity, 
  Info,
  CalendarCheck,
  CalendarX,
  Search,
  TrendingUp,
  Scale,
  Ruler,
  Sparkles,
  Layers,
  FileText,
  Bookmark,
  Star,
  Tag,
  Palette,
  Edit2,
  Check,
  Dumbbell,
  Bot,
  Wand2,
  RefreshCw,
  Sliders,
  X,
  CalendarRange,
  CheckCheck,
  Droplet,
  Square,
  CheckSquare,
  History
} from 'lucide-react';
import { 
  ProtocolEntry, 
  CalendarDayNote, 
  TrainingWeek, 
  AppSettings, 
  BodyWeightEntry, 
  BodyPartMeasurement,
  HydrationDayRecord 
} from '../types';
import { BloodConcentrationCalculator } from './BloodConcentrationCalculator';
import { BODY_PART_CONFIG } from '../utils/bodyMeasurements';
import { analyzeCalendarCycleWithGemini, CalendarCycleAnalysisResult } from '../utils/serverApi';
import {
  loadHydrationHistory,
  logWaterIntake,
  removeWaterEntry,
  resetDayHydration,
  getHydrationDay,
  DEFAULT_DAILY_WATER_TARGET_ML
} from '../utils/hydrationService';

interface CycleProtocolViewProps {
  protocolEntries: ProtocolEntry[];
  calendarNotes?: CalendarDayNote[];
  weeks: TrainingWeek[];
  settings: AppSettings;
  bodyWeights?: BodyWeightEntry[];
  bodyPartMeasurements?: BodyPartMeasurement[];
  onAddProtocolEntry: (entry: Omit<ProtocolEntry, 'id'>) => void;
  onDeleteProtocolEntry: (id: string) => void;
  onAddCalendarNote?: (note: Omit<CalendarDayNote, 'id' | 'createdAt'>) => void;
  onUpdateCalendarNote?: (id: string, updatedFields: Partial<CalendarDayNote>) => void;
  onDeleteCalendarNote?: (id: string) => void;
  onUpdateWeekStartDate?: (weekId: string, startDate: string) => void;
  onAddWeekFromGap?: (startDate: string, weekNumber: number) => void;
  onAddBodyWeight?: (entry: Omit<BodyWeightEntry, 'id'>) => void;
  onSelectView?: (view: string) => void;
}

export const CALENDAR_COLOR_PALETTE = [
  { id: 'emerald', label: 'Szmaragdowy', hex: '#10b981', bg: 'bg-emerald-500/20', border: 'border-emerald-500/40', text: 'text-emerald-300', dot: 'bg-emerald-400', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  { id: 'cyan', label: 'Cyjan / Błękit', hex: '#06b6d4', bg: 'bg-cyan-500/20', border: 'border-cyan-500/40', text: 'text-cyan-300', dot: 'bg-cyan-400', badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
  { id: 'purple', label: 'Fiolet / Purpura', hex: '#a855f7', bg: 'bg-purple-500/20', border: 'border-purple-500/40', text: 'text-purple-300', dot: 'bg-purple-400', badge: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  { id: 'amber', label: 'Bursztyn / Złoto', hex: '#f59e0b', bg: 'bg-amber-500/20', border: 'border-amber-500/40', text: 'text-amber-300', dot: 'bg-amber-400', badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  { id: 'rose', label: 'Róż / Karmazyn', hex: '#f43f5e', bg: 'bg-rose-500/20', border: 'border-rose-500/40', text: 'text-rose-300', dot: 'bg-rose-400', badge: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
  { id: 'yellow', label: 'Żółty Słoneczny', hex: '#eab308', bg: 'bg-yellow-500/20', border: 'border-yellow-500/40', text: 'text-yellow-300', dot: 'bg-yellow-400', badge: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
  { id: 'blue', label: 'Błękit Królewski', hex: '#3b82f6', bg: 'bg-blue-500/20', border: 'border-blue-500/40', text: 'text-blue-300', dot: 'bg-blue-400', badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  { id: 'slate', label: 'Grafit / Neutralny', hex: '#64748b', bg: 'bg-slate-700/40', border: 'border-slate-600/50', text: 'text-slate-300', dot: 'bg-slate-400', badge: 'bg-slate-700/40 text-slate-300 border-slate-600/50' },
] as const;

export const NOTE_CATEGORIES = [
  { id: 'general', label: 'Ogólna', emoji: '📝', defaultColor: 'emerald' },
  { id: 'bloodwork', label: 'Badania krwi', emoji: '🩸', defaultColor: 'rose' },
  { id: 'supplement', label: 'Suplementy & Dieta', emoji: '💊', defaultColor: 'cyan' },
  { id: 'recovery', label: 'Regeneracja & Sen', emoji: '⚡', defaultColor: 'purple' },
  { id: 'goal', label: 'Cel & Priorytet', emoji: '🎯', defaultColor: 'amber' },
  { id: 'training', label: 'Trening & Cardio', emoji: '🏋️', defaultColor: 'blue' },
  { id: 'warning', label: 'Uwaga / Dyskomfort', emoji: '⚠️', defaultColor: 'yellow' },
] as const;

const PRESET_PROTOCOLS = [
  { name: 'Testosteron Enanthat', dosage: 250, unit: 'mg' as const, route: 'IM' as const, badge: 'Test 250mg', color: 'emerald' as const },
  { name: 'Testosteron Cypionat (TRT)', dosage: 125, unit: 'mg' as const, route: 'IM' as const, badge: 'TRT 125mg', color: 'emerald' as const },
  { name: 'HCG (Gonadotropina)', dosage: 500, unit: 'IU' as const, route: 'SC' as const, badge: 'HCG 500 IU', color: 'cyan' as const },
  { name: 'HCG (Dawka stała)', dosage: 250, unit: 'IU' as const, route: 'SC' as const, badge: 'HCG 250 IU', color: 'cyan' as const },
  { name: 'Masteron (Drostanolon)', dosage: 100, unit: 'mg' as const, route: 'IM' as const, badge: 'Masteron 100mg', color: 'purple' as const },
  { name: 'Primobolan (Methenolon)', dosage: 100, unit: 'mg' as const, route: 'IM' as const, badge: 'Primo 100mg', color: 'amber' as const },
  { name: 'Nandrolon NPP', dosage: 100, unit: 'mg' as const, route: 'IM' as const, badge: 'NPP 100mg', color: 'rose' as const },
  { name: 'Oxandrolon (Anavar)', dosage: 20, unit: 'mg' as const, route: 'Oral' as const, badge: 'Anavar 20mg', color: 'yellow' as const },
  { name: 'Clomifen (Clomid)', dosage: 50, unit: 'mg' as const, route: 'Oral' as const, badge: 'Clomid 50mg', color: 'blue' as const },
];

export const CycleProtocolView: React.FC<CycleProtocolViewProps> = ({
  protocolEntries = [],
  calendarNotes = [],
  weeks = [],
  settings,
  bodyWeights = [],
  bodyPartMeasurements = [],
  onAddProtocolEntry,
  onDeleteProtocolEntry,
  onAddCalendarNote,
  onUpdateCalendarNote,
  onDeleteCalendarNote,
  onUpdateWeekStartDate,
  onAddWeekFromGap,
  onAddBodyWeight,
  onSelectView
}) => {
  const isDark = settings.theme === 'dark';
  const [activeTab, setActiveTab] = useState<'calendar' | 'weeks' | 'calculator'>('calendar');

  // Calendar View Mode: Miesiąc vs Tydzień vs Agenda zdarzeń
  const [calendarViewMode, setCalendarViewMode] = useState<'month' | 'week' | 'agenda'>('month');

  // Calendar State
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDateStr, setSelectedDateStr] = useState(() => new Date().toISOString().split('T')[0]);

  // Calendar display filter: all vs workouts vs doses vs notes vs measurements vs water
  const [calendarFilter, setCalendarFilter] = useState<'all' | 'workouts' | 'doses' | 'notes' | 'measurements' | 'water'>('all');

  // Right action panel mode: 'dose' vs 'note' vs 'weight' vs 'water'
  const [rightPanelMode, setRightPanelMode] = useState<'dose' | 'note' | 'weight' | 'water'>('note');

  // Hydration state connected with date
  const [hydrationHistory, setHydrationHistory] = useState<Record<string, HydrationDayRecord>>(() => loadHydrationHistory());

  // Bottom table mode: doses log vs notes log vs combined correlation log
  const [bottomTableMode, setBottomTableMode] = useState<'doses' | 'notes' | 'correlation'>('doses');

  // Form State: Protocol Entry
  const [substance, setSubstance] = useState('Testosteron Enanthat');
  const [dosage, setDosage] = useState('250');
  const [unit, setUnit] = useState<'mg' | 'IU' | 'mcg' | 'ml' | 'tab'>('mg');
  const [route, setRoute] = useState<'IM' | 'SC' | 'Oral'>('IM');
  const [time, setTime] = useState('08:00');
  const [notes, setNotes] = useState('');
  const [doseColor, setDoseColor] = useState<typeof CALENDAR_COLOR_PALETTE[number]['id']>('emerald');

  // Form State: Calendar Note
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteCategory, setNoteCategory] = useState<typeof NOTE_CATEGORIES[number]['id']>('general');
  const [noteColor, setNoteColor] = useState<typeof CALENDAR_COLOR_PALETTE[number]['id']>('emerald');
  const [noteIsImportant, setNoteIsImportant] = useState(false);

  // Form State: Quick Body Weight in Calendar Day
  const [quickWeight, setQuickWeight] = useState('');
  const [quickWeightNotes, setQuickWeightNotes] = useState('Poranny pomiar na czczo');

  // AI Assistant Gemini 3.8 Pro / 3.1 Pro States
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<CalendarCycleAnalysisResult | null>(null);

  // Cycle Schedule Generator Modal States
  const [isSchedulerModalOpen, setIsSchedulerModalOpen] = useState(false);
  const [scheduleSubstance, setScheduleSubstance] = useState('Testosteron Enanthat');
  const [scheduleDosage, setScheduleDosage] = useState('250');
  const [scheduleUnit, setScheduleUnit] = useState<'mg' | 'IU' | 'mcg'>('mg');
  const [scheduleRoute, setScheduleRoute] = useState<'IM' | 'SC' | 'Oral'>('IM');
  const [scheduleFrequency, setScheduleFrequency] = useState<'e3d' | 'e3.5d' | 'eod' | 'daily' | 'e7d'>('e3.5d');
  const [scheduleStartDate, setScheduleStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [scheduleWeeksCount, setScheduleWeeksCount] = useState<number>(8);
  const [scheduleColor, setScheduleColor] = useState<typeof CALENDAR_COLOR_PALETTE[number]['id']>('emerald');
  const [scheduleSuccessMsg, setScheduleSuccessMsg] = useState<string | null>(null);

  // Search & Filter state
  const [searchFilter, setSearchFilter] = useState('');
  const [noteCategoryFilter, setNoteCategoryFilter] = useState<string>('all');

  // Calendar Helpers
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  const monthNames = [
    'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
    'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
  ];

  const daysOfWeek = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDateStr(today.toISOString().split('T')[0]);
  };

  // Generate calendar days for current month view
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay();
    // In Poland: Monday is 0, Sunday is 6
    const adjustedFirstDay = (firstDayIndex + 6) % 7;
    const totalDays = new Date(year, month + 1, 0).getDate();

    const days: Array<{ dayNumber: number; dateStr: string; isCurrentMonth: boolean }> = [];

    // Prev month filler
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = adjustedFirstDay - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const prevDate = new Date(year, month - 1, d);
      const str = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({ dayNumber: d, dateStr: str, isCurrentMonth: false });
    }

    // Current month days
    for (let d = 1; d <= totalDays; d++) {
      const str = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({ dayNumber: d, dateStr: str, isCurrentMonth: true });
    }

    // Next month filler to complete 35 or 42 cells
    const remaining = 42 - days.length;
    if (remaining > 0 && remaining < 7) {
      for (let d = 1; d <= remaining; d++) {
        const nextDate = new Date(year, month + 1, d);
        const str = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        days.push({ dayNumber: d, dateStr: str, isCurrentMonth: false });
      }
    }

    return days;
  }, [year, month]);

  // Entries grouped by date
  const entriesByDate = useMemo(() => {
    const map = new Map<string, ProtocolEntry[]>();
    protocolEntries.forEach(entry => {
      const list = map.get(entry.date) || [];
      list.push(entry);
      map.set(entry.date, list);
    });
    return map;
  }, [protocolEntries]);

  // Calendar Notes grouped by date
  const notesByDate = useMemo(() => {
    const map = new Map<string, CalendarDayNote[]>();
    calendarNotes.forEach(note => {
      const list = map.get(note.date) || [];
      list.push(note);
      map.set(note.date, list);
    });
    return map;
  }, [calendarNotes]);

  // Body weights grouped by date
  const weightsByDate = useMemo(() => {
    const map = new Map<string, BodyWeightEntry>();
    bodyWeights.forEach(w => map.set(w.date, w));
    return map;
  }, [bodyWeights]);

  // Body part measurements grouped by date
  const measurementsByDate = useMemo(() => {
    const map = new Map<string, BodyPartMeasurement[]>();
    bodyPartMeasurements.forEach(m => {
      const list = map.get(m.date) || [];
      list.push(m);
      map.set(m.date, list);
    });
    return map;
  }, [bodyPartMeasurements]);

  // Training workouts correlation with calendar days
  const workoutsByDate = useMemo(() => {
    const map = new Map<string, Array<{ weekName: string; dayName: string; completed: boolean; exercisesCount: number }>>();
    
    weeks.forEach(week => {
      if (!week.startDate) return;
      const start = new Date(week.startDate);
      if (isNaN(start.getTime())) return;

      week.days.forEach((day, index) => {
        const d = new Date(start);
        d.setDate(d.getDate() + index);
        const dateStr = d.toISOString().split('T')[0];
        
        const list = map.get(dateStr) || [];
        list.push({
          weekName: week.name || `Tydzień ${week.number}`,
          dayName: day.name,
          completed: !!day.completed,
          exercisesCount: day.exercises?.length || 0
        });
        map.set(dateStr, list);
      });
    });

    return map;
  }, [weeks]);

  const sortedWeights = useMemo(() => [...bodyWeights].sort((a, b) => a.date.localeCompare(b.date)), [bodyWeights]);
  const latestWeight = sortedWeights.length > 0 ? sortedWeights[sortedWeights.length - 1] : null;
  const sortedParts = useMemo(() => [...bodyPartMeasurements].sort((a, b) => a.date.localeCompare(b.date)), [bodyPartMeasurements]);
  const latestPart = sortedParts.length > 0 ? sortedParts[sortedParts.length - 1] : null;

  // Selected date elements
  const selectedDateEntries = entriesByDate.get(selectedDateStr) || [];
  const selectedDateNotes = notesByDate.get(selectedDateStr) || [];
  const selectedDateWeight = weightsByDate.get(selectedDateStr);
  const selectedDateMeasurements = measurementsByDate.get(selectedDateStr) || [];
  const selectedDateWorkouts = workoutsByDate.get(selectedDateStr) || [];
  const selectedDateHydration = getHydrationDay(hydrationHistory, selectedDateStr);

  // Hydration handlers for selected date
  const handleAddDayWater = (amountMl: number) => {
    const { updatedHistory } = logWaterIntake(hydrationHistory, selectedDateStr, amountMl);
    setHydrationHistory(updatedHistory);
  };

  const handleRemoveDayWater = (entryId: string) => {
    const { updatedHistory } = removeWaterEntry(hydrationHistory, selectedDateStr, entryId);
    setHydrationHistory(updatedHistory);
  };

  const handleResetDayWater = () => {
    const { updatedHistory } = resetDayHydration(hydrationHistory, selectedDateStr);
    setHydrationHistory(updatedHistory);
  };

  // Toggle note completion status
  const handleToggleNoteComplete = (note: CalendarDayNote) => {
    if (onUpdateCalendarNote) {
      onUpdateCalendarNote(note.id, { isCompleted: !note.isCompleted });
    }
  };

  // Week View Days (7 days from Monday to Sunday around selectedDateStr)
  const currentWeekDays = useMemo(() => {
    const base = new Date(selectedDateStr);
    const dayOfWeek = (base.getDay() + 6) % 7; // 0 = Mon, 6 = Sun
    const monday = new Date(base);
    monday.setDate(base.getDate() - dayOfWeek);

    const result: Array<{ dateStr: string; dayName: string; dayNumber: number; isToday: boolean; isSelected: boolean }> = [];
    const dayNamesFull = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela'];
    const todayStr = new Date().toISOString().split('T')[0];

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const str = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      result.push({
        dateStr: str,
        dayName: dayNamesFull[i],
        dayNumber: d.getDate(),
        isToday: str === todayStr,
        isSelected: str === selectedDateStr
      });
    }
    return result;
  }, [selectedDateStr]);

  // Agenda list (chronological items matching search and filters)
  const agendaItems = useMemo(() => {
    const map = new Map<string, {
      dateStr: string;
      doses: ProtocolEntry[];
      notes: CalendarDayNote[];
      workouts: Array<{ weekName: string; dayName: string; completed: boolean; exercisesCount: number }>;
      weight?: BodyWeightEntry;
      measurements: BodyPartMeasurement[];
      water?: HydrationDayRecord;
    }>();

    const getOrCreate = (d: string) => {
      let obj = map.get(d);
      if (!obj) {
        obj = {
          dateStr: d,
          doses: [],
          notes: [],
          workouts: workoutsByDate.get(d) || [],
          weight: weightsByDate.get(d),
          measurements: measurementsByDate.get(d) || [],
          water: hydrationHistory[d]
        };
        map.set(d, obj);
      }
      return obj;
    };

    protocolEntries.forEach(p => getOrCreate(p.date).doses.push(p));
    calendarNotes.forEach(n => getOrCreate(n.date).notes.push(n));
    bodyWeights.forEach(w => { getOrCreate(w.date).weight = w; });
    bodyPartMeasurements.forEach(m => getOrCreate(m.date).measurements.push(m));
    Object.keys(hydrationHistory).forEach(d => {
      if (hydrationHistory[d]?.totalMl > 0) {
        getOrCreate(d).water = hydrationHistory[d];
      }
    });

    return Array.from(map.values())
      .filter(item => {
        if (!searchFilter) return true;
        const q = searchFilter.toLowerCase();
        return (
          item.dateStr.includes(q) ||
          item.doses.some(d => d.substance.toLowerCase().includes(q)) ||
          item.notes.some(n => (n.title?.toLowerCase().includes(q) || n.content.toLowerCase().includes(q))) ||
          item.workouts.some(w => w.dayName.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => b.dateStr.localeCompare(a.dateStr));
  }, [protocolEntries, calendarNotes, workoutsByDate, weightsByDate, measurementsByDate, hydrationHistory, searchFilter]);

  // Combined dates for cycle correlation table
  const combinedLogDates = useMemo(() => {
    const setOfDates = new Set<string>();
    protocolEntries.forEach(p => setOfDates.add(p.date));
    calendarNotes.forEach(n => setOfDates.add(n.date));
    bodyWeights.forEach(w => setOfDates.add(w.date));
    bodyPartMeasurements.forEach(m => setOfDates.add(m.date));
    return Array.from(setOfDates).sort((a, b) => b.localeCompare(a));
  }, [protocolEntries, calendarNotes, bodyWeights, bodyPartMeasurements]);

  // Handle Preset Apply
  const applyPreset = (preset: typeof PRESET_PROTOCOLS[0]) => {
    setSubstance(preset.name);
    setDosage(String(preset.dosage));
    setUnit(preset.unit);
    setRoute(preset.route);
    setDoseColor(preset.color);
  };

  // Submit new protocol entry
  const handleAddEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!substance.trim()) return;
    const numDosage = parseFloat(dosage) || 0;
    if (numDosage <= 0) return;

    onAddProtocolEntry({
      date: selectedDateStr,
      substance: substance.trim(),
      dosage: numDosage,
      unit,
      route,
      time,
      notes: notes.trim() || undefined,
      color: doseColor
    });

    setNotes('');
  };

  // Submit new calendar note
  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim() && !noteTitle.trim()) return;

    onAddCalendarNote?.({
      date: selectedDateStr,
      title: noteTitle.trim() || undefined,
      content: noteContent.trim(),
      category: noteCategory,
      color: noteColor,
      isImportant: noteIsImportant
    });

    setNoteTitle('');
    setNoteContent('');
    setNoteIsImportant(false);
  };

  // Submit quick body weight from day panel
  const handleAddQuickWeight = (e: React.FormEvent) => {
    e.preventDefault();
    const numWeight = parseFloat(quickWeight.replace(',', '.'));
    if (!numWeight || numWeight <= 0) return;

    onAddBodyWeight?.({
      date: selectedDateStr,
      weight: numWeight,
      notes: quickWeightNotes.trim() || '',
    });

    setQuickWeight('');
  };

  // Run deep Gemini 3.8 Pro / 3.1 Pro analysis
  const handleRunGeminiAnalysis = async () => {
    setIsAiAnalyzing(true);
    setIsAiModalOpen(true);
    try {
      const result = await analyzeCalendarCycleWithGemini({
        protocolEntries,
        calendarNotes,
        bodyWeights,
        bodyPartMeasurements,
        weeks,
        currentMonth: `${monthNames[month]} ${year}`
      });
      setAiAnalysisResult(result);
    } catch (err) {
      console.error('Błąd analizy Gemini:', err);
    } finally {
      setIsAiAnalyzing(false);
    }
  };

  // Generate recurring doses schedule
  const handleConfirmSchedule = () => {
    const numDose = parseFloat(scheduleDosage) || 0;
    if (numDose <= 0 || !scheduleSubstance.trim()) return;

    const startDate = new Date(scheduleStartDate);
    if (isNaN(startDate.getTime())) return;

    const totalDays = scheduleWeeksCount * 7;
    const generatedDates: string[] = [];

    if (scheduleFrequency === 'daily') {
      for (let i = 0; i < totalDays; i++) {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + i);
        generatedDates.push(d.toISOString().slice(0, 10));
      }
    } else if (scheduleFrequency === 'eod') {
      for (let i = 0; i < totalDays; i += 2) {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + i);
        generatedDates.push(d.toISOString().slice(0, 10));
      }
    } else if (scheduleFrequency === 'e3d') {
      for (let i = 0; i < totalDays; i += 3) {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + i);
        generatedDates.push(d.toISOString().slice(0, 10));
      }
    } else if (scheduleFrequency === 'e3.5d') {
      let dayOffset = 0;
      let flip = false;
      while (dayOffset < totalDays) {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + dayOffset);
        generatedDates.push(d.toISOString().slice(0, 10));
        dayOffset += flip ? 4 : 3;
        flip = !flip;
      }
    } else if (scheduleFrequency === 'e7d') {
      for (let i = 0; i < totalDays; i += 7) {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + i);
        generatedDates.push(d.toISOString().slice(0, 10));
      }
    }

    generatedDates.forEach(dateStr => {
      onAddProtocolEntry({
        date: dateStr,
        substance: scheduleSubstance.trim(),
        dosage: numDose,
        unit: scheduleUnit,
        route: scheduleRoute,
        time: '08:00',
        color: scheduleColor,
        notes: `Harmonogram: ${scheduleWeeksCount} tyg.`
      });
    });

    setScheduleSuccessMsg(`Pomyślnie dodano ${generatedDates.length} dawek do kalendarza!`);
    setTimeout(() => {
      setScheduleSuccessMsg(null);
      setIsSchedulerModalOpen(false);
    }, 1800);
  };

  // Month Statistics (KPIs)
  const currentMonthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  const monthStats = useMemo(() => {
    const monthEntries = protocolEntries.filter(p => p.date.startsWith(currentMonthPrefix));
    const dosesSummaryMap: Record<string, { total: number; unit: string }> = {};
    monthEntries.forEach(e => {
      const key = e.substance.split(' ')[0] || e.substance;
      if (!dosesSummaryMap[key]) {
        dosesSummaryMap[key] = { total: 0, unit: e.unit };
      }
      dosesSummaryMap[key].total += e.dosage;
    });

    const monthNotesCount = calendarNotes.filter(n => n.date.startsWith(currentMonthPrefix)).length;

    let workoutsCount = 0;
    calendarDays.forEach(d => {
      if (d.isCurrentMonth) {
        const wList = workoutsByDate.get(d.dateStr) || [];
        workoutsCount += wList.length;
      }
    });

    const monthWeights = bodyWeights
      .filter(w => w.date.startsWith(currentMonthPrefix))
      .sort((a, b) => a.date.localeCompare(b.date));

    let weightDiff: number | null = null;
    if (monthWeights.length >= 2) {
      weightDiff = Math.round((monthWeights[monthWeights.length - 1].weight - monthWeights[0].weight) * 10) / 10;
    }

    return {
      totalEntries: monthEntries.length,
      dosesSummaryMap,
      monthNotesCount,
      workoutsCount,
      weightCount: monthWeights.length,
      weightDiff,
      firstWeight: monthWeights[0]?.weight,
      lastWeight: monthWeights[monthWeights.length - 1]?.weight,
    };
  }, [protocolEntries, currentMonthPrefix, calendarNotes, calendarDays, workoutsByDate, bodyWeights]);

  // Filtered entries for doses log
  const filteredEntries = useMemo(() => {
    return [...protocolEntries]
      .sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')))
      .filter(item => {
        if (!searchFilter) return true;
        const q = searchFilter.toLowerCase();
        return (
          item.substance.toLowerCase().includes(q) ||
          item.date.includes(q) ||
          (item.notes && item.notes.toLowerCase().includes(q))
        );
      });
  }, [protocolEntries, searchFilter]);

  // Filtered calendar notes
  const filteredNotes = useMemo(() => {
    return [...calendarNotes]
      .sort((a, b) => b.date.localeCompare(a.date))
      .filter(item => {
        if (noteCategoryFilter !== 'all' && item.category !== noteCategoryFilter) return false;
        if (!searchFilter) return true;
        const q = searchFilter.toLowerCase();
        return (
          (item.title && item.title.toLowerCase().includes(q)) ||
          item.content.toLowerCase().includes(q) ||
          item.date.includes(q)
        );
      });
  }, [calendarNotes, searchFilter, noteCategoryFilter]);

  // ==========================================
  // LOGIKA ANALIZY HISTORII TYGODNI I CYKLI
  // ==========================================
  interface WeekTimelineItem {
    type: 'completed' | 'in_progress' | 'gap_empty';
    weekId?: string;
    weekNumber?: number;
    weekName?: string;
    startDate: string;
    endDate: string;
    completedDays?: number;
    totalDays?: number;
    totalSets?: number;
    totalVolumeKg?: number;
  }

  const weekTimeline = useMemo(() => {
    const list: WeekTimelineItem[] = [];
    const sortedWeeks = [...weeks].sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));

    sortedWeeks.forEach((week, index) => {
      const start = week.startDate || new Date().toISOString().split('T')[0];
      const startDateObj = new Date(start);
      const endDateObj = new Date(startDateObj);
      endDateObj.setDate(startDateObj.getDate() + 6);
      const end = endDateObj.toISOString().split('T')[0];

      const completedDays = week.days.filter(d => d.completed).length;
      const totalDays = week.days.length;
      let totalSets = 0;
      let totalVolumeKg = 0;

      week.days.forEach(d => {
        d.exercises?.forEach(ex => {
          const setsCount = typeof ex.sets === 'number' ? ex.sets : 0;
          totalSets += setsCount;
          totalVolumeKg += (ex.weight || 0) * (ex.reps || 0) * (setsCount || 1);
        });
      });

      const type: 'completed' | 'in_progress' = completedDays === totalDays && totalDays > 0 ? 'completed' : 'in_progress';

      list.push({
        type,
        weekId: week.id,
        weekNumber: week.number,
        weekName: week.name || `Tydzień ${week.number}`,
        startDate: start,
        endDate: end,
        completedDays,
        totalDays,
        totalSets,
        totalVolumeKg
      });
    });

    return list;
  }, [weeks]);

  const getColorConfig = (colorId?: string) => {
    return CALENDAR_COLOR_PALETTE.find(c => c.id === colorId) || CALENDAR_COLOR_PALETTE[0];
  };

  const getCategoryConfig = (catId?: string) => {
    return NOTE_CATEGORIES.find(c => c.id === catId) || NOTE_CATEGORIES[0];
  };

  return (
    <div className="p-3 sm:p-5 md:p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto" id="cycle-protocol-view">
      {/* Clean Navigation Bar without redundant banners */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveTab('calendar')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'calendar'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
            id="tab-btn-calendar"
          >
            <CalendarDays className="w-4 h-4" />
            <span>Kalendarz</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
              {protocolEntries.length + calendarNotes.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('weeks')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'weeks'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
            id="tab-btn-weeks-history"
          >
            <Clock className="w-4 h-4" />
            <span>Historia tygodni</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
              {weekTimeline.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('calculator')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'calculator'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
            id="tab-btn-blood-concentration"
          >
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span>Kalkulator stężeń</span>
          </button>
        </div>

        {/* Quick Actions AI and Generator */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleRunGeminiAnalysis}
            className="px-3 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 border border-purple-400/40 shadow-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            title="Głęboka analiza kalendarza i cyklu Gemini Pro"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
            <span>Gemini Pro</span>
          </button>

          <button
            type="button"
            onClick={() => setIsSchedulerModalOpen(true)}
            className="px-3 py-2 rounded-xl text-xs font-bold text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            title="Zaplanuj cykliczny harmonogram iniekcji"
          >
            <CalendarRange className="w-3.5 h-3.5 text-emerald-400" />
            <span>Harmonogram</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: KALENDARZ MIESIĘCZNY, NOTATKI & DAWKOWANIE */}
      {/* ======================================================== */}
      {activeTab === 'calendar' && (
        <div className="space-y-4">
          {/* Calendar Control Bar with View Mode Switcher */}
          <div className="p-3.5 rounded-2xl border border-slate-800 bg-slate-900/90 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
            {/* Left: Month Navigator & Status */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Poprzedni miesiąc"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleToday}
                  className="px-2.5 py-1 text-xs rounded-lg font-bold text-emerald-400 hover:bg-emerald-500/15 transition-colors cursor-pointer"
                >
                  Dzisiaj
                </button>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Następny miesiąc"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-emerald-400" />
                <h3 className="font-black text-white text-base tracking-tight">
                  {monthNames[month]} {year}
                </h3>
                <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  Wybrany: {selectedDateStr}
                </span>
              </div>
            </div>

            {/* Right: View Mode Tabs (Miesiąc / Tydzień / Agenda) */}
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setCalendarViewMode('month')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    calendarViewMode === 'month'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Miesiąc
                </button>
                <button
                  type="button"
                  onClick={() => setCalendarViewMode('week')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    calendarViewMode === 'week'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Tydzień
                </button>
                <button
                  type="button"
                  onClick={() => setCalendarViewMode('agenda')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    calendarViewMode === 'agenda'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Agenda
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left / Center: Interactive Month Calendar (7 cols on lg) */}
          <div className="lg:col-span-7 bg-slate-900 rounded-2xl border border-slate-800 p-4 sm:p-5 flex flex-col shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-emerald-400" />
                <h3 className="font-extrabold text-white text-base">
                  {monthNames[month]} {year}
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Filter for Calendar Badges */}
                <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[10px] flex-wrap">
                  <button
                    type="button"
                    onClick={() => setCalendarFilter('all')}
                    className={`px-2 py-1 rounded-md font-bold transition-all cursor-pointer ${
                      calendarFilter === 'all'
                        ? 'bg-slate-800 text-white shadow-xs'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Wszystko
                  </button>
                  <button
                    type="button"
                    onClick={() => setCalendarFilter('workouts')}
                    className={`px-2 py-1 rounded-md font-bold transition-all flex items-center gap-1 cursor-pointer ${
                      calendarFilter === 'workouts'
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Dumbbell className="w-2.5 h-2.5 text-blue-400" />
                    <span>Treningi</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCalendarFilter('doses')}
                    className={`px-2 py-1 rounded-md font-bold transition-all flex items-center gap-1 cursor-pointer ${
                      calendarFilter === 'doses'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Syringe className="w-2.5 h-2.5 text-emerald-400" />
                    <span>Dawki</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCalendarFilter('notes')}
                    className={`px-2 py-1 rounded-md font-bold transition-all flex items-center gap-1 cursor-pointer ${
                      calendarFilter === 'notes'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <FileText className="w-2.5 h-2.5 text-amber-400" />
                    <span>Notatki</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCalendarFilter('measurements')}
                    className={`px-2 py-1 rounded-md font-bold transition-all flex items-center gap-1 cursor-pointer ${
                      calendarFilter === 'measurements'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Ruler className="w-2.5 h-2.5 text-purple-400" />
                    <span>Pomiary</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCalendarFilter('water')}
                    className={`px-2 py-1 rounded-md font-bold transition-all flex items-center gap-1 cursor-pointer ${
                      calendarFilter === 'water'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Droplet className="w-2.5 h-2.5 text-cyan-400" />
                    <span>Woda</span>
                  </button>
                </div>
              </div>
            </div>

            {/* VIEW MODE 1: MONTH GRID */}
            {calendarViewMode === 'month' && (
              <>
                {/* Days of Week Header */}
                <div className="grid grid-cols-7 gap-1 text-center py-2 text-xs font-mono font-bold text-slate-400">
                  {daysOfWeek.map((d, i) => (
                    <div key={d} className={i >= 5 ? 'text-emerald-500/70' : ''}>
                      {d}
                    </div>
                  ))}
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-1 flex-1 min-h-[340px]">
                  {calendarDays.map(({ dayNumber, dateStr, isCurrentMonth }) => {
                    const isSelected = dateStr === selectedDateStr;
                    const isToday = dateStr === new Date().toISOString().split('T')[0];
                    const dayEntries = entriesByDate.get(dateStr) || [];
                    const dayNotes = notesByDate.get(dateStr) || [];
                    const dayWeight = weightsByDate.get(dateStr);
                    const dayMeasurements = measurementsByDate.get(dateStr) || [];
                    const dayWorkouts = workoutsByDate.get(dateStr) || [];
                    const dayWater = hydrationHistory[dateStr];
                    const hasEntries = dayEntries.length > 0 || dayNotes.length > 0 || !!dayWeight || dayMeasurements.length > 0 || dayWorkouts.length > 0 || (dayWater && dayWater.totalMl > 0);

                    return (
                      <button
                        key={dateStr}
                        type="button"
                        onClick={() => setSelectedDateStr(dateStr)}
                        className={`min-h-[76px] p-1.5 rounded-xl text-left flex flex-col justify-between transition-all border cursor-pointer ${
                          isSelected
                            ? 'border-emerald-400 bg-emerald-500/15 shadow-sm ring-1 ring-emerald-400/40'
                            : isToday
                            ? 'border-emerald-500/40 bg-slate-950/80'
                            : isCurrentMonth
                            ? 'border-slate-800/80 bg-slate-950/40 hover:bg-slate-800/60 hover:border-slate-700'
                            : 'border-transparent bg-transparent opacity-35 hover:opacity-70'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span
                            className={`text-xs font-bold rounded-md px-1 ${
                              isSelected
                                ? 'text-emerald-300 font-black'
                                : isToday
                                ? 'text-emerald-400 font-bold'
                                : 'text-slate-300'
                            }`}
                          >
                            {dayNumber}
                          </span>
                          <div className="flex items-center gap-1">
                            {dayNotes.some(n => n.isImportant) && (
                              <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
                            )}
                            {hasEntries && (
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            )}
                          </div>
                        </div>

                        {/* Entry Badges inside cell */}
                        <div className="space-y-0.5 mt-1 overflow-hidden w-full">
                          {/* Workout Badge */}
                          {calendarFilter !== 'doses' && calendarFilter !== 'notes' && calendarFilter !== 'water' && dayWorkouts.length > 0 && (
                            <div
                              className="text-[8.5px] px-1 py-0.2 rounded truncate font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1"
                              title={`Trening: ${dayWorkouts.map(w => `${w.weekName} - ${w.dayName}`).join(', ')}`}
                            >
                              <span>🏋️</span>
                              <span className="truncate">{dayWorkouts[0].dayName.split(' ')[0]}</span>
                            </div>
                          )}

                          {/* Doses Badges */}
                          {calendarFilter !== 'notes' && calendarFilter !== 'measurements' && calendarFilter !== 'workouts' && calendarFilter !== 'water' &&
                            dayEntries.slice(0, 2).map(entry => {
                              const col = getColorConfig(entry.color);
                              return (
                                <div
                                  key={entry.id}
                                  className={`text-[8.5px] px-1 py-0.2 rounded truncate font-medium border ${col.badge}`}
                                  title={`${entry.substance} ${entry.dosage}${entry.unit} (${entry.route})`}
                                >
                                  {entry.substance.split(' ')[0]} {entry.dosage}{entry.unit}
                                </div>
                              );
                            })}

                          {/* Day Notes Badges */}
                          {calendarFilter !== 'doses' && calendarFilter !== 'measurements' && calendarFilter !== 'workouts' && calendarFilter !== 'water' &&
                            dayNotes.slice(0, 2).map(n => {
                              const col = getColorConfig(n.color);
                              const cat = getCategoryConfig(n.category);
                              return (
                                <div
                                  key={n.id}
                                  className={`text-[8.5px] px-1 py-0.2 rounded truncate font-medium border flex items-center gap-0.5 ${col.badge} ${n.isCompleted ? 'line-through opacity-70' : ''}`}
                                  title={`${cat.emoji} ${n.title ? `${n.title}: ` : ''}${n.content}`}
                                >
                                  <span>{cat.emoji}</span>
                                  <span className="truncate">{n.title || n.content}</span>
                                </div>
                              );
                            })}

                          {/* Hydration H2O Badge */}
                          {calendarFilter !== 'doses' && calendarFilter !== 'measurements' && calendarFilter !== 'notes' && dayWater && dayWater.totalMl > 0 && (
                            <div
                              className={`text-[8.5px] px-1 py-0.2 rounded truncate font-medium border flex items-center gap-0.5 ${
                                dayWater.totalMl >= (dayWater.targetMl || 3000)
                                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                                  : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                              }`}
                              title={`Woda: ${dayWater.totalMl} ml / ${dayWater.targetMl || 3000} ml`}
                            >
                              <span>💧</span>
                              <span className="truncate font-mono">{(dayWater.totalMl / 1000).toFixed(1)}L</span>
                            </div>
                          )}

                          {/* Weight Badge */}
                          {calendarFilter !== 'doses' && calendarFilter !== 'notes' && calendarFilter !== 'water' && dayWeight && (
                            <div
                              className="text-[8.5px] px-1 py-0.2 rounded truncate font-medium bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-1 font-mono"
                              title={`Waga ciała: ${dayWeight.weight} ${settings.unit}${dayWeight.notes ? ` (${dayWeight.notes})` : ''}`}
                            >
                              <span className="text-[7.5px]">⚖️</span>
                              <span className="truncate">{dayWeight.weight}{settings.unit}</span>
                            </div>
                          )}

                          {/* Muscle Circumferences Badge */}
                          {calendarFilter !== 'doses' && calendarFilter !== 'notes' && calendarFilter !== 'water' && dayMeasurements.length > 0 && (
                            <div
                              className="text-[8.5px] px-1 py-0.2 rounded truncate font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1 font-mono"
                              title={dayMeasurements.map(m => `${BODY_PART_CONFIG[m.part]?.label || m.part}: ${m.value} cm`).join(', ')}
                            >
                              <span className="text-[7.5px]">📐</span>
                              <span className="truncate">{dayMeasurements[0].value}cm</span>
                            </div>
                          )}

                          {dayEntries.length + dayNotes.length > 2 && (
                            <div className="text-[7.5px] text-slate-400 font-mono pl-0.5 leading-none">
                              +{dayEntries.length + dayNotes.length - 2} więcej
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {/* VIEW MODE 2: WEEK VIEW (7 DAYS DETAILED COLUMNS) */}
            {calendarViewMode === 'week' && (
              <div className="space-y-2.5 pt-1">
                <div className="text-xs text-slate-400 flex items-center justify-between pb-1 border-b border-slate-800">
                  <span>Tydzień obejmujący datę: <strong className="text-white font-mono">{selectedDateStr}</strong></span>
                  <span className="text-[11px] text-emerald-400">7 dni z rzędu</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
                  {currentWeekDays.map(d => {
                    const dEntries = entriesByDate.get(d.dateStr) || [];
                    const dNotes = notesByDate.get(d.dateStr) || [];
                    const dWorkouts = workoutsByDate.get(d.dateStr) || [];
                    const dWeight = weightsByDate.get(d.dateStr);
                    const dWater = hydrationHistory[d.dateStr];

                    return (
                      <div
                        key={d.dateStr}
                        onClick={() => setSelectedDateStr(d.dateStr)}
                        className={`p-2.5 rounded-xl border flex flex-col justify-between transition-all cursor-pointer ${
                          d.isSelected
                            ? 'border-emerald-400 bg-emerald-500/10 shadow-sm ring-1 ring-emerald-400/40'
                            : d.isToday
                            ? 'border-emerald-500/40 bg-slate-950/90'
                            : 'border-slate-800 bg-slate-950/40 hover:bg-slate-800/40'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5 mb-2">
                            <div>
                              <div className="text-[11px] font-bold text-slate-300">{d.dayName}</div>
                              <div className={`text-base font-black ${d.isSelected ? 'text-emerald-400' : 'text-white'}`}>
                                {d.dayNumber}
                              </div>
                            </div>
                            {d.isToday && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                                Dziś
                              </span>
                            )}
                          </div>

                          <div className="space-y-1.5 text-xs">
                            {/* Workout */}
                            {dWorkouts.map((w, idx) => (
                              <div key={idx} className="p-1 rounded bg-blue-500/15 border border-blue-500/30 text-[10px] text-blue-200 flex items-center gap-1">
                                <span>🏋️</span>
                                <span className="font-bold truncate">{w.dayName}</span>
                              </div>
                            ))}

                            {/* Water */}
                            {dWater && dWater.totalMl > 0 && (
                              <div className="p-1 rounded bg-cyan-500/15 border border-cyan-500/30 text-[10px] text-cyan-300 flex items-center justify-between font-mono">
                                <span>💧 Woda:</span>
                                <span className="font-bold">{(dWater.totalMl / 1000).toFixed(1)}L</span>
                              </div>
                            )}

                            {/* Weight */}
                            {dWeight && (
                              <div className="p-1 rounded bg-sky-500/15 border border-sky-500/30 text-[10px] text-sky-300 flex items-center justify-between font-mono">
                                <span>⚖️</span>
                                <span>{dWeight.weight} {settings.unit}</span>
                              </div>
                            )}

                            {/* Doses */}
                            {dEntries.map(e => (
                              <div key={e.id} className="p-1 rounded bg-emerald-500/15 border border-emerald-500/30 text-[9.5px] text-emerald-200 truncate">
                                💉 {e.substance.split(' ')[0]} {e.dosage}{e.unit}
                              </div>
                            ))}

                            {/* Notes */}
                            {dNotes.map(n => (
                              <div key={n.id} className={`p-1 rounded bg-amber-500/15 border border-amber-500/30 text-[9.5px] text-amber-200 truncate ${n.isCompleted ? 'line-through opacity-70' : ''}`}>
                                📝 {n.title || n.content}
                              </div>
                            ))}

                            {dWorkouts.length === 0 && !dWater && !dWeight && dEntries.length === 0 && dNotes.length === 0 && (
                              <div className="text-[10px] text-slate-600 italic py-2 text-center">
                                Brak zdarzeń
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="pt-2 mt-2 border-t border-slate-900 text-[10px] text-center text-slate-500">
                          {d.dateStr}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* VIEW MODE 3: AGENDA VIEW */}
            {calendarViewMode === 'agenda' && (
              <div className="space-y-2.5 pt-1">
                <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-950 border border-slate-800">
                  <Search className="w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={e => setSearchFilter(e.target.value)}
                    placeholder="Szukaj w kalendarzu (np. Testosteron, Badania, Klatka)..."
                    className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
                  />
                  {searchFilter && (
                    <button
                      type="button"
                      onClick={() => setSearchFilter('')}
                      className="text-slate-500 hover:text-slate-300 text-xs"
                    >
                      Wyczyść
                    </button>
                  )}
                </div>

                <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                  {agendaItems.length === 0 ? (
                    <div className="p-8 rounded-xl bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-500">
                      Brak wpisów w agendzie spełniających kryteria.
                    </div>
                  ) : (
                    agendaItems.map(item => (
                      <div
                        key={item.dateStr}
                        onClick={() => setSelectedDateStr(item.dateStr)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer ${
                          item.dateStr === selectedDateStr
                            ? 'border-emerald-400 bg-emerald-500/10'
                            : 'border-slate-800 bg-slate-950/70 hover:bg-slate-800/40'
                        }`}
                      >
                        <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-800/80">
                          <span className="font-bold font-mono text-xs text-emerald-400">
                            {item.dateStr}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {item.doses.length + item.notes.length + item.workouts.length} zdarzeń
                          </span>
                        </div>

                        <div className="space-y-1.5 text-xs">
                          {item.workouts.map((w, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-blue-300">
                              <span>🏋️ Trening:</span>
                              <span className="font-bold">{w.dayName}</span>
                              <span className="text-[10px] text-slate-500">({w.weekName})</span>
                            </div>
                          ))}

                          {item.water && (
                            <div className="flex items-center gap-2 text-cyan-300 font-mono text-[11px]">
                              <span>💧 Woda:</span>
                              <span className="font-bold">{(item.water.totalMl / 1000).toFixed(2)}L</span>
                              <span className="text-[10px] text-slate-500">z {(item.water.targetMl / 1000).toFixed(1)}L</span>
                            </div>
                          )}

                          {item.weight && (
                            <div className="flex items-center gap-2 text-sky-300 font-mono text-[11px]">
                              <span>⚖️ Waga:</span>
                              <span className="font-bold">{item.weight.weight} {settings.unit}</span>
                              {item.weight.notes && <span className="text-slate-400 italic text-[10px]">"{item.weight.notes}"</span>}
                            </div>
                          )}

                          {item.doses.map(d => (
                            <div key={d.id} className="flex items-center gap-2 text-emerald-300 text-[11px]">
                              <span>💉 Dawka:</span>
                              <span className="font-bold">{d.substance} {d.dosage}{d.unit}</span>
                              <span className="text-[10px] text-slate-400 font-mono">({d.time || '08:00'} • {d.route})</span>
                            </div>
                          ))}

                          {item.notes.map(n => (
                            <div key={n.id} className={`flex items-start gap-2 text-amber-300 text-[11px] ${n.isCompleted ? 'line-through opacity-70' : ''}`}>
                              <span>📝</span>
                              <div>
                                {n.title && <span className="font-bold">{n.title}: </span>}
                                <span>{n.content}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Legend with rich color tags */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-[11px] text-slate-400 pt-3 border-t border-slate-800 mt-2">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <span>💉 Dawki</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span>📝 Notatki / Cele</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                <span>💧 Nawodnienie H₂O</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                <span>⚖️ Waga</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                <span>🏋️ Trening z planu</span>
              </span>
            </div>
          </div>

          {/* Right: Quick Entry Form & Day Details (5 cols on lg) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Box: Action Switcher (Add Dose vs Add Note vs Weight vs Water) */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 shadow-md space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold">
                    {rightPanelMode === 'dose' ? (
                      <Syringe className="w-4 h-4" />
                    ) : rightPanelMode === 'water' ? (
                      <Droplet className="w-4 h-4 text-cyan-400" />
                    ) : rightPanelMode === 'weight' ? (
                      <Scale className="w-4 h-4 text-sky-400" />
                    ) : (
                      <FileText className="w-4 h-4 text-amber-400" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-white">
                      Zdarzenia dla: <span className="text-emerald-400 font-mono">{selectedDateStr}</span>
                    </h4>
                    <p className="text-[11px] text-slate-400">Dodaj dawkę, notatkę, wagę lub rejestruj wodę</p>
                  </div>
                </div>

                {/* Switcher Tabs */}
                <div className="flex items-center bg-slate-950 p-0.5 rounded-xl border border-slate-800 text-xs">
                  <button
                    type="button"
                    onClick={() => setRightPanelMode('dose')}
                    className={`px-2 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      rightPanelMode === 'dose'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Dawka
                  </button>
                  <button
                    type="button"
                    onClick={() => setRightPanelMode('note')}
                    className={`px-2 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      rightPanelMode === 'note'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Notatka
                  </button>
                  <button
                    type="button"
                    onClick={() => setRightPanelMode('weight')}
                    className={`px-2 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      rightPanelMode === 'weight'
                        ? 'bg-sky-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Waga
                  </button>
                  <button
                    type="button"
                    onClick={() => setRightPanelMode('water')}
                    className={`px-2 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      rightPanelMode === 'water'
                        ? 'bg-cyan-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Woda
                  </button>
                </div>
              </div>

              {/* MODE 1: ADD PROTOCOL DOSE */}
              {rightPanelMode === 'dose' && (
                <div className="space-y-3.5">
                  {/* Quick Presets */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 block mb-1.5">
                      Szybkie szablony (1-klik):
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {PRESET_PROTOCOLS.map(preset => (
                        <button
                          key={preset.badge}
                          type="button"
                          onClick={() => applyPreset(preset)}
                          className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:border-emerald-500/50 text-slate-300 hover:text-emerald-300 transition-colors cursor-pointer"
                        >
                          {preset.badge}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Form Inputs */}
                  <form onSubmit={handleAddEntry} className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-bold text-slate-400 block mb-1">Data</label>
                        <input
                          type="date"
                          value={selectedDateStr}
                          onChange={e => setSelectedDateStr(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-400 block mb-1">Godzina</label>
                        <input
                          type="time"
                          value={time}
                          onChange={e => setTime(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-400 block mb-1">Nazwa Związku / Preparatu</label>
                      <input
                        type="text"
                        value={substance}
                        onChange={e => setSubstance(e.target.value)}
                        placeholder="np. Testosteron Enanthat, HCG, Masteron..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[11px] font-bold text-slate-400 block mb-1">Dawka</label>
                        <input
                          type="number"
                          step="any"
                          value={dosage}
                          onChange={e => setDosage(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-400 block mb-1">Jednostka</label>
                        <select
                          value={unit}
                          onChange={e => setUnit(e.target.value as any)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                        >
                          <option value="mg">mg</option>
                          <option value="IU">IU</option>
                          <option value="mcg">mcg</option>
                          <option value="ml">ml</option>
                          <option value="tab">tab</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-400 block mb-1">Droga</label>
                        <select
                          value={route}
                          onChange={e => setRoute(e.target.value as any)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                        >
                          <option value="IM">IM (Domięśniowo)</option>
                          <option value="SC">SC (Podskórnie)</option>
                          <option value="Oral">Doustnie</option>
                        </select>
                      </div>
                    </div>

                    {/* Color Tag Selector */}
                    <div>
                      <label className="text-[11px] font-bold text-slate-400 block mb-1.5 flex items-center gap-1.5">
                        <Palette className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Kolor wyróżnienia w kalendarzu:</span>
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {CALENDAR_COLOR_PALETTE.map(col => (
                          <button
                            key={col.id}
                            type="button"
                            onClick={() => setDoseColor(col.id)}
                            className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all cursor-pointer ${col.dot} ${
                              doseColor === col.id
                                ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110'
                                : 'opacity-70 hover:opacity-100'
                            }`}
                            title={col.label}
                          />
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-400 block mb-1">Notatki / Miejsce iniekcji</label>
                      <input
                        type="text"
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        placeholder="np. Prawy pośladek, igła 0.6x30, rano na czczo..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-950/40 transition-all cursor-pointer active:scale-98"
                    >
                      <Check className="w-4 h-4" />
                      <span>Zapisz Podanie w Kalendarzu</span>
                    </button>
                  </form>
                </div>
              )}

              {/* MODE 2: ADD CALENDAR NOTE TO DATE */}
              {rightPanelMode === 'note' && (
                <form onSubmit={handleAddNote} className="space-y-3.5 animate-fadeIn">
                  {/* Szybkie Szablony Notatek */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 block mb-1.5">
                      Szybkie szablony wpisów dnia (1-klik):
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { title: 'Badania krwi', content: 'Pobranie krwi na czczo (morfologia, lipidogram, próby wątrobowe, estradiol, testosteron)', cat: 'bloodwork' },
                        { title: 'Mocny trening PR', content: 'Świetna dyspozycja siłowa, rekord w boju głównym, energia 10/10', cat: 'training' },
                        { title: 'Czysta miska', content: 'Dieta i makroskładniki dopięte w 100%, odpowiednie nawodnienie', cat: 'supplement' },
                        { title: 'Dzień wolny', content: 'Pełna regeneracja, spacer, sen 8h, brak zmęczenia stawów', cat: 'recovery' },
                        { title: 'Zmęczenie OUN', content: 'Uczucie znużenia, zalecany lżejszy trening lub deload', cat: 'warning' },
                      ].map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setNoteTitle(preset.title);
                            setNoteContent(preset.content);
                            setNoteCategory(preset.cat as any);
                          }}
                          className="text-[10px] px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:border-amber-500/50 text-slate-300 hover:text-amber-300 transition-colors cursor-pointer"
                        >
                          {preset.title}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-bold text-slate-400 block mb-1">Data</label>
                      <input
                        type="date"
                        value={selectedDateStr}
                        onChange={e => setSelectedDateStr(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-400 block mb-1">Kategoria</label>
                      <select
                        value={noteCategory}
                        onChange={e => {
                          const catId = e.target.value as any;
                          setNoteCategory(catId);
                          const cfg = getCategoryConfig(catId);
                          if (cfg) setNoteColor(cfg.defaultColor as any);
                        }}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                      >
                        {NOTE_CATEGORIES.map(cat => (
                          <option key={cat.id} value={cat.id}>
                            {cat.emoji} {cat.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-400 block mb-1">Tytuł notatki (opcjonalny)</label>
                    <input
                      type="text"
                      value={noteTitle}
                      onChange={e => setNoteTitle(e.target.value)}
                      placeholder="np. Badania krwi rano, Samopoczucie 10/10..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-400 block mb-1">Treść notatki / Przypomnienia</label>
                    <textarea
                      rows={3}
                      value={noteContent}
                      onChange={e => setNoteContent(e.target.value)}
                      placeholder="Wpisz treść notatki, spostrzeżenia z treningu, wyniki badań, zalecenia dietetyczne..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none"
                      required
                    />
                  </div>

                  {/* Color Palette Selector */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 block mb-1.5 flex items-center gap-1.5">
                      <Palette className="w-3.5 h-3.5 text-amber-400" />
                      <span>Kolor akcentu notatki:</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {CALENDAR_COLOR_PALETTE.map(col => (
                        <button
                          key={col.id}
                          type="button"
                          onClick={() => setNoteColor(col.id)}
                          className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all cursor-pointer ${col.dot} ${
                            noteColor === col.id
                              ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110'
                              : 'opacity-70 hover:opacity-100'
                          }`}
                          title={col.label}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Important Toggle */}
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="note-important-chk"
                      checked={noteIsImportant}
                      onChange={e => setNoteIsImportant(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 bg-slate-950 border-slate-800 cursor-pointer"
                    />
                    <label htmlFor="note-important-chk" className="text-xs text-slate-300 font-semibold cursor-pointer flex items-center gap-1.5">
                      <Star className={`w-3.5 h-3.5 ${noteIsImportant ? 'text-amber-400 fill-amber-400' : 'text-slate-500'}`} />
                      <span>Oznacz jako ważną / priorytet ⭐</span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-amber-950/40 transition-all cursor-pointer active:scale-98"
                  >
                    <Bookmark className="w-4 h-4" />
                    <span>Zapisz Notatkę dla Daty</span>
                  </button>
                </form>
              )}

              {/* MODE 3: QUICK WEIGHT INPUT FOR DATE */}
              {rightPanelMode === 'weight' && (
                <form onSubmit={handleAddQuickWeight} className="space-y-3.5 animate-fadeIn">
                  <div className="p-3 rounded-xl bg-sky-950/20 border border-sky-800/30 flex items-center justify-between text-xs">
                    <span className="text-sky-300 font-bold flex items-center gap-1.5">
                      <Scale className="w-4 h-4 text-sky-400" />
                      <span>Pomiar wagi dla: {selectedDateStr}</span>
                    </span>
                    {selectedDateWeight && (
                      <span className="font-mono font-bold text-white bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                        Zapisano: {selectedDateWeight.weight} {settings.unit}
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-400 block mb-1">
                      Waga ciała ({settings.unit})
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={quickWeight}
                      onChange={e => setQuickWeight(e.target.value)}
                      placeholder={selectedDateWeight ? `${selectedDateWeight.weight}` : "np. 84.5"}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono placeholder-slate-600 focus:outline-none focus:border-sky-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-400 block mb-1">
                      Notatka do pomiaru (opcjonalnie)
                    </label>
                    <input
                      type="text"
                      value={quickWeightNotes}
                      onChange={e => setQuickWeightNotes(e.target.value)}
                      placeholder="np. Poranny pomiar na czczo..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-sky-950/40 transition-all cursor-pointer active:scale-98"
                  >
                    <Check className="w-4 h-4" />
                    <span>Zapisz Wagę dla Wybranego Dnia</span>
                  </button>
                </form>
              )}

              {/* MODE 4: QUICK WATER HYDRATION FOR DATE */}
              {rightPanelMode === 'water' && (
                <div className="space-y-3.5 animate-fadeIn">
                  <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-800/30 flex items-center justify-between text-xs">
                    <span className="text-cyan-300 font-bold flex items-center gap-1.5">
                      <Droplet className="w-4 h-4 text-cyan-400" />
                      <span>Nawodnienie: {selectedDateStr}</span>
                    </span>
                    <span className="font-mono font-bold text-white bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                      {selectedDateHydration.totalMl} / {selectedDateHydration.targetMl || 3000} ml
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                      <div 
                        className="h-full bg-cyan-400 transition-all duration-300"
                        style={{ width: `${Math.min(100, Math.round((selectedDateHydration.totalMl / (selectedDateHydration.targetMl || 3000)) * 100))}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono">
                      <span>{(selectedDateHydration.totalMl / 1000).toFixed(2)}L</span>
                      <span>Cel: {((selectedDateHydration.targetMl || 3000) / 1000).toFixed(1)}L</span>
                    </div>
                  </div>

                  {/* Quick Add Buttons */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 block mb-1.5">
                      Dodaj porcję wody do tej daty:
                    </label>
                    <div className="grid grid-cols-4 gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleAddDayWater(250)}
                        className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/40 text-center transition-all cursor-pointer"
                      >
                        <div className="text-[10px] text-slate-500">Szklanka</div>
                        <div className="text-xs font-black font-mono text-cyan-300">+250ml</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddDayWater(500)}
                        className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/40 text-center transition-all cursor-pointer"
                      >
                        <div className="text-[10px] text-slate-500">Butelka</div>
                        <div className="text-xs font-black font-mono text-cyan-300">+500ml</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddDayWater(750)}
                        className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/40 text-center transition-all cursor-pointer"
                      >
                        <div className="text-[10px] text-slate-500">Shaker</div>
                        <div className="text-xs font-black font-mono text-cyan-300">+750ml</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddDayWater(1000)}
                        className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/40 text-center transition-all cursor-pointer"
                      >
                        <div className="text-[10px] text-slate-500">Bidon 1L</div>
                        <div className="text-xs font-black font-mono text-cyan-300">+1000ml</div>
                      </button>
                    </div>
                  </div>

                  {/* Day Intakes Timeline */}
                  <div className="space-y-1 pt-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
                      <span>Wpisy w wybranym dniu ({selectedDateHydration.entries.length}):</span>
                      {selectedDateHydration.totalMl > 0 && (
                        <button
                          type="button"
                          onClick={handleResetDayWater}
                          className="text-[10px] text-rose-400 hover:underline cursor-pointer"
                        >
                          Resetuj dzień
                        </button>
                      )}
                    </div>
                    {selectedDateHydration.entries.length === 0 ? (
                      <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-500">
                        Brak wpisów wody dla {selectedDateStr}.
                      </div>
                    ) : (
                      <div className="space-y-1 max-h-32 overflow-y-auto pr-0.5">
                        {selectedDateHydration.entries.map((item, idx) => (
                          <div
                            key={item.id || idx}
                            className="flex items-center justify-between p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs"
                          >
                            <span className="font-mono text-cyan-400 font-bold">{item.time || '08:00'}</span>
                            <span className="font-mono text-slate-200">+{item.amountMl} ml</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveDayWater(item.id)}
                              className="text-slate-500 hover:text-rose-400 cursor-pointer p-0.5"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Box: Events for Selected Date */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 shadow-md space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <h4 className="font-extrabold text-xs text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <CalendarCheck className="w-4 h-4 text-emerald-400" />
                  <span>Wszystkie zdarzenia ({selectedDateStr})</span>
                </h4>
                <span className="text-[11px] font-mono text-slate-400">
                  {selectedDateEntries.length + selectedDateNotes.length + selectedDateWorkouts.length} wpisów
                </span>
              </div>

              {selectedDateEntries.length === 0 && selectedDateNotes.length === 0 && !selectedDateWeight && selectedDateMeasurements.length === 0 && selectedDateWorkouts.length === 0 && (!selectedDateHydration || selectedDateHydration.totalMl === 0) ? (
                <div className="text-center py-6 text-slate-500 text-xs">
                  Brak wpisów dla tego dnia. Wybierz szablon powyżej, aby dodać dawkę, notatkę, wagę lub wodę.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                  {/* Workout of selected date */}
                  {selectedDateWorkouts.map((w, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/25 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <Dumbbell className="w-4 h-4 text-blue-400" />
                        <div>
                          <div className="text-xs font-bold text-blue-200 flex items-center gap-1.5">
                            <span>{w.dayName}</span>
                            {w.completed && (
                              <span className="text-[10px] text-emerald-400 font-bold">✓ Wykonany</span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400">{w.weekName} ({w.exercisesCount} ćwiczeń)</div>
                        </div>
                      </div>
                      {onSelectView && (
                        <button
                          type="button"
                          onClick={() => onSelectView('plan')}
                          className="px-2.5 py-1 rounded-lg bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 text-[10px] font-bold transition-all cursor-pointer"
                        >
                          Do planu →
                        </button>
                      )}
                    </div>
                  ))}

                  {/* Water Card for selected date */}
                  {selectedDateHydration && selectedDateHydration.totalMl > 0 && (
                    <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Droplet className="w-4 h-4 text-cyan-400" />
                        <span className="font-bold text-cyan-200">Nawodnienie:</span>
                        <span className="font-mono font-black text-white">
                          {(selectedDateHydration.totalMl / 1000).toFixed(2)}L
                        </span>
                        <span className="text-[10px] text-slate-400">
                          ({Math.round((selectedDateHydration.totalMl / (selectedDateHydration.targetMl || 3000)) * 100)}% celu)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddDayWater(250)}
                        className="px-2 py-0.5 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-[10px] font-bold font-mono transition-colors cursor-pointer"
                      >
                        +250ml
                      </button>
                    </div>
                  )}

                  {/* Notes of selected date with interactive completion */}
                  {selectedDateNotes.map(n => {
                    const col = getColorConfig(n.color);
                    const cat = getCategoryConfig(n.category);
                    return (
                      <div
                        key={n.id}
                        className={`p-3 rounded-xl border flex items-start justify-between gap-3 ${col.bg} ${col.border}`}
                      >
                        <div className="flex items-start gap-2.5 flex-1 min-w-0">
                          <button
                            type="button"
                            onClick={() => handleToggleNoteComplete(n)}
                            className="mt-0.5 text-slate-400 hover:text-emerald-400 cursor-pointer transition-colors shrink-0"
                            title={n.isCompleted ? "Oznacz jako nieukończone" : "Oznacz jako ukończone"}
                          >
                            {n.isCompleted ? (
                              <CheckSquare className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-500 hover:text-slate-300" />
                            )}
                          </button>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="text-xs">{cat.emoji}</span>
                              <span className={`text-[10px] font-bold uppercase tracking-wider ${col.text}`}>
                                {cat.label}
                              </span>
                              {n.isImportant && (
                                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1 rounded font-bold">
                                  ⭐ Ważne
                                </span>
                              )}
                              {n.isCompleted && (
                                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1 rounded font-bold">
                                  ✓ Ukończone
                                </span>
                              )}
                            </div>
                            {n.title && (
                              <h5 className={`font-extrabold text-xs text-white truncate ${n.isCompleted ? 'line-through text-slate-400' : ''}`}>
                                {n.title}
                              </h5>
                            )}
                            <p className={`text-xs text-slate-300 whitespace-pre-wrap mt-0.5 leading-relaxed ${n.isCompleted ? 'line-through text-slate-400' : ''}`}>
                              {n.content}
                            </p>
                          </div>
                        </div>

                        {onDeleteCalendarNote && (
                          <button
                            type="button"
                            onClick={() => onDeleteCalendarNote(n.id)}
                            className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0 cursor-pointer"
                            title="Usuń notatkę"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {/* Doses of selected date */}
                  {selectedDateEntries.map(entry => {
                    const col = getColorConfig(entry.color);
                    return (
                      <div
                        key={entry.id}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${col.bg} ${col.border}`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${col.dot} text-slate-950 font-bold`}>
                            <Syringe className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-white truncate">{entry.substance}</span>
                              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold ${col.text}`}>
                                {entry.dosage} {entry.unit}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                              <span>🕒 {entry.time || '08:00'}</span>
                              <span>•</span>
                              <span>{entry.route}</span>
                              {entry.notes && (
                                <>
                                  <span>•</span>
                                  <span className="truncate max-w-[140px] italic">"{entry.notes}"</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => onDeleteProtocolEntry(entry.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0 cursor-pointer"
                          title="Usuń wpis dawki"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}

                  {/* Weight of selected date */}
                  {selectedDateWeight && (
                    <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Scale className="w-4 h-4 text-sky-400" />
                        <span className="font-bold text-sky-200">Waga ciała:</span>
                        <span className="font-mono font-black text-white">{selectedDateWeight.weight} {settings.unit}</span>
                      </div>
                      {selectedDateWeight.notes && (
                        <span className="text-[10px] text-slate-400 italic max-w-[120px] truncate">
                          "{selectedDateWeight.notes}"
                        </span>
                      )}
                    </div>
                  )}

                  {/* Measurements of selected date */}
                  {selectedDateMeasurements.length > 0 && (
                    <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 space-y-1">
                      <div className="text-[10px] font-bold text-purple-300 flex items-center gap-1">
                        <Ruler className="w-3 h-3 text-purple-400" />
                        <span>Pomiary obwodów ({selectedDateMeasurements.length}):</span>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        {selectedDateMeasurements.map(m => (
                          <span key={m.id} className="px-2 py-0.5 rounded bg-slate-950 text-slate-300 font-mono text-[11px] border border-slate-800">
                            {BODY_PART_CONFIG[m.part]?.label || m.part}: <strong>{m.value} cm</strong>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Full Past Entries Log Table & Correlation Table */}
          <div className="lg:col-span-12 bg-slate-900 rounded-2xl border border-slate-800 p-5 shadow-md space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              {/* Table Mode Selector */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBottomTableMode('doses')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    bottomTableMode === 'doses'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-xs'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Syringe className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Historia Dawek</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 font-mono">
                    {protocolEntries.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setBottomTableMode('notes')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    bottomTableMode === 'notes'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-xs'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 text-amber-400" />
                  <span>Rejestr Notatek Kalendarza</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 font-mono">
                    {calendarNotes.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setBottomTableMode('correlation')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    bottomTableMode === 'correlation'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 shadow-xs'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 text-purple-400" />
                  <span>Zestawienie: Dawki vs Pomiary</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 font-mono">
                    {combinedLogDates.length}
                  </span>
                </button>
              </div>

              {/* Search filter for tables */}
              <div className="flex items-center gap-2">
                {bottomTableMode === 'notes' && (
                  <select
                    value={noteCategoryFilter}
                    onChange={e => setNoteCategoryFilter(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="all">Wszystkie kategorie</option>
                    {NOTE_CATEGORIES.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.emoji} {cat.label}
                      </option>
                    ))}
                  </select>
                )}

                <div className="relative w-full sm:w-56">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={e => setSearchFilter(e.target.value)}
                    placeholder="Filtruj wpisy..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* TAB CONTENT 1: DOSES LOG */}
            {bottomTableMode === 'doses' && (
              <>
                {filteredEntries.length === 0 ? (
                  <div className="text-center py-6 text-slate-500 text-xs">
                    Brak wpisów dawek pasujących do filtra.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                          <th className="py-2.5 px-3">Data & Godzina</th>
                          <th className="py-2.5 px-3">Substancja</th>
                          <th className="py-2.5 px-3">Dawka</th>
                          <th className="py-2.5 px-3">Droga</th>
                          <th className="py-2.5 px-3">Kolor / Tag</th>
                          <th className="py-2.5 px-3">Notatki</th>
                          <th className="py-2.5 px-3 text-right">Akcja</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-sans">
                        {filteredEntries.map(entry => {
                          const col = getColorConfig(entry.color);
                          return (
                            <tr key={entry.id} className="hover:bg-slate-800/30 transition-colors">
                              <td className="py-2.5 px-3 font-mono text-slate-300">
                                {entry.date} {entry.time ? `• ${entry.time}` : ''}
                              </td>
                              <td className="py-2.5 px-3 font-bold text-white">
                                {entry.substance}
                              </td>
                              <td className="py-2.5 px-3 font-mono font-extrabold text-emerald-400">
                                {entry.dosage} {entry.unit}
                              </td>
                              <td className="py-2.5 px-3">
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                                  entry.route === 'IM'
                                    ? 'bg-emerald-500/15 text-emerald-400'
                                    : entry.route === 'SC'
                                    ? 'bg-cyan-500/15 text-cyan-400'
                                    : 'bg-purple-500/15 text-purple-400'
                                }`}>
                                  {entry.route === 'IM' ? 'Domięśniowo (IM)' : entry.route === 'SC' ? 'Podskórnie (SC)' : 'Doustnie'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="flex items-center gap-1.5 text-xs text-slate-300">
                                  <span className={`w-2.5 h-2.5 rounded-full ${col.dot}`} />
                                  <span>{col.label}</span>
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-slate-400 max-w-xs truncate">
                                {entry.notes || '-'}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => onDeleteProtocolEntry(entry.id)}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                  title="Usuń wpis"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {/* TAB CONTENT 2: NOTES LOG */}
            {bottomTableMode === 'notes' && (
              <>
                {filteredNotes.length === 0 ? (
                  <div className="text-center py-6 text-slate-500 text-xs">
                    Brak notatek kalendarza pasujących do filtra.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                          <th className="py-2.5 px-3">Data</th>
                          <th className="py-2.5 px-3">Kategoria</th>
                          <th className="py-2.5 px-3">Tytuł</th>
                          <th className="py-2.5 px-3">Treść notatki</th>
                          <th className="py-2.5 px-3">Priorytet</th>
                          <th className="py-2.5 px-3 text-right">Akcja</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-sans">
                        {filteredNotes.map(n => {
                          const col = getColorConfig(n.color);
                          const cat = getCategoryConfig(n.category);
                          return (
                            <tr key={n.id} className="hover:bg-slate-800/30 transition-colors">
                              <td className="py-2.5 px-3 font-mono text-slate-300 font-bold">
                                {n.date}
                              </td>
                              <td className="py-2.5 px-3">
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border flex items-center gap-1 w-fit ${col.badge}`}>
                                  <span>{cat.emoji}</span>
                                  <span>{cat.label}</span>
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-bold text-white max-w-[150px] truncate">
                                {n.title || '-'}
                              </td>
                              <td className="py-2.5 px-3 text-slate-300 max-w-sm whitespace-pre-wrap">
                                {n.content}
                              </td>
                              <td className="py-2.5 px-3">
                                {n.isImportant ? (
                                  <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded font-bold">
                                    ⭐ Priorytet
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-500 font-mono">Normalny</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                {onDeleteCalendarNote && (
                                  <button
                                    type="button"
                                    onClick={() => onDeleteCalendarNote(n.id)}
                                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                    title="Usuń notatkę"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {/* TAB CONTENT 3: CORRELATION TABLE */}
            {bottomTableMode === 'correlation' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                      <th className="py-2.5 px-3">Data</th>
                      <th className="py-2.5 px-3">Dawki & Środki</th>
                      <th className="py-2.5 px-3">Notatki Dnia</th>
                      <th className="py-2.5 px-3">Waga Ciała</th>
                      <th className="py-2.5 px-3">Obwody Partii</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-sans">
                    {combinedLogDates.map(dateStr => {
                      const dEntries = entriesByDate.get(dateStr) || [];
                      const dNotes = notesByDate.get(dateStr) || [];
                      const dWeight = weightsByDate.get(dateStr);
                      const dParts = measurementsByDate.get(dateStr) || [];

                      return (
                        <tr key={dateStr} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-2.5 px-3 font-mono text-slate-300 font-bold">
                            {dateStr}
                          </td>
                          <td className="py-2.5 px-3">
                            {dEntries.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {dEntries.map(e => {
                                  const col = getColorConfig(e.color);
                                  return (
                                    <span key={e.id} className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold border ${col.badge}`}>
                                      {e.substance.split(' ')[0]} {e.dosage}{e.unit}
                                    </span>
                                  );
                                })}
                              </div>
                            ) : (
                              <span className="text-slate-600 font-mono">-</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            {dNotes.length > 0 ? (
                              <div className="space-y-0.5">
                                {dNotes.map(n => (
                                  <div key={n.id} className="text-xs text-slate-300 truncate max-w-[200px]">
                                    {getCategoryConfig(n.category).emoji} {n.title || n.content}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-600 font-mono">-</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-sky-400">
                            {dWeight ? `${dWeight.weight} ${settings.unit}` : '-'}
                          </td>
                          <td className="py-2.5 px-3">
                            {dParts.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {dParts.map(p => (
                                  <span key={p.id} className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/20 font-mono">
                                    {BODY_PART_CONFIG[p.part]?.label || p.part}: {p.value}cm
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-600 font-mono">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: HISTORIA TYGODNI (WEEK TIMELINE) */}
      {/* ======================================================== */}
      {activeTab === 'weeks' && (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 shadow-md space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="font-extrabold text-white text-base">Oś Czasu Tygodni Treningowych</h3>
              <p className="text-xs text-slate-400">Zarządzanie datami rozpoczęcia poszczególnych tygodni w mezocyklu</p>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
              {weekTimeline.length} tygodni w planie
            </span>
          </div>

          <div className="space-y-3">
            {weekTimeline.map((item, idx) => (
              <div
                key={item.weekId || idx}
                className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                    item.type === 'completed'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-slate-800 text-slate-300'
                  }`}>
                    T{item.weekNumber || idx + 1}
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-white">{item.weekName}</h4>
                    <p className="text-xs text-slate-400 font-mono">
                      {item.startDate} → {item.endDate}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <div className="text-right font-mono">
                    <div className="text-emerald-400 font-bold">{item.completedDays} / {item.totalDays} dni</div>
                    <div className="text-[11px] text-slate-500">{item.totalSets} serii • {item.totalVolumeKg?.toLocaleString()} kg</div>
                  </div>

                  {onUpdateWeekStartDate && item.weekId && (
                    <input
                      type="date"
                      value={item.startDate}
                      onChange={e => onUpdateWeekStartDate(item.weekId!, e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                      title="Zmień datę rozpoczęcia tygodnia"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: KALKULATOR STĘŻEŃ FARMAKOKINETYCZNYCH */}
      {/* ======================================================== */}
      {activeTab === 'calculator' && (
        <BloodConcentrationCalculator
          protocolEntries={protocolEntries}
          theme={isDark ? 'dark' : 'light'}
        />
      )}

      {/* ======================================================== */}
      {/* MODAL 1: INTELIGENTNA ANALIZA KALENDARZA GEMINI 3.8 PRO */}
      {/* ======================================================== */}
      {isAiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-purple-950/60 via-slate-900 to-slate-900 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-purple-900/30">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-base text-white">Ekspert Kalendarza & Cyklu AI</h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      Gemini 3.8 Pro
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">Analiza stabilności stężeń, periodyzacji, regeneracji i badań krwi</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRunGeminiAnalysis}
                  disabled={isAiAnalyzing}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer disabled:opacity-50"
                  title="Odśwież analizę"
                >
                  <RefreshCw className={`w-4 h-4 ${isAiAnalyzing ? 'animate-spin text-purple-400' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsAiModalOpen(false)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
              {isAiAnalyzing ? (
                <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 animate-pulse">
                    <Sparkles className="w-6 h-6 animate-spin" />
                  </div>
                  <h4 className="font-extrabold text-sm text-white">Analizowanie kalendarza przez Gemini Pro...</h4>
                  <p className="text-slate-400 max-w-sm text-[11px]">
                    Korelujemy historię iniekcji, objętość treningową z planu, dynamikę masy ciała oraz wpisy samopoczucia.
                  </p>
                </div>
              ) : aiAnalysisResult ? (
                <div className="space-y-4">
                  {/* Generated Analysis Report */}
                  <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-slate-200 leading-relaxed whitespace-pre-wrap font-sans text-xs">
                    {aiAnalysisResult.analysis.replace(/```json[\s\S]*?```/, '').trim()}
                  </div>

                  {/* AI Suggestions with 1-click Add */}
                  {aiAnalysisResult.suggestions && aiAnalysisResult.suggestions.length > 0 && (
                    <div className="space-y-2.5 pt-2 border-t border-slate-800">
                      <h4 className="font-extrabold text-xs text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>Sugerowane Zdarzenia do Kalendarza na Najbliższe Dni:</span>
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {aiAnalysisResult.suggestions.map((sug, idx) => (
                          <div
                            key={idx}
                            className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between gap-2.5"
                          >
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-mono font-bold text-emerald-400 text-[11px]">{sug.date}</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-medium">
                                  {sug.category}
                                </span>
                              </div>
                              <h5 className="font-bold text-white text-xs">{sug.title}</h5>
                              <p className="text-[11px] text-slate-400 mt-0.5">{sug.content}</p>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                onAddCalendarNote?.({
                                  date: sug.date,
                                  title: sug.title,
                                  content: sug.content,
                                  category: sug.category as any,
                                  color: sug.category === 'bloodwork' ? 'rose' : sug.category === 'recovery' ? 'purple' : 'emerald',
                                  isImportant: true
                                });
                              }}
                              className="w-full py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 font-bold text-[11px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Dodaj do Kalendarza ({sug.date})</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-2 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                    <span>Model: {aiAnalysisResult.model}</span>
                    <span>Wygenerowano: {new Date(aiAnalysisResult.timestamp).toLocaleTimeString('pl-PL')}</span>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setIsAiModalOpen(false)}
                className="btn-3d-secondary px-4 py-2 rounded-xl text-xs font-bold text-slate-300 cursor-pointer"
              >
                Zamknij panel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: GENERATOR CYKLICZNEGO HARMONOGRAMU DAWEK */}
      {/* ======================================================== */}
      {isSchedulerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-950/60 via-slate-900 to-slate-900 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-900/30">
                  <CalendarRange className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-white">Generator Harmonogramu Dawek</h3>
                  <p className="text-xs text-slate-400">Automatyczne rozplanowanie iniekcji na cały cykl (np. E3D / E3.5D)</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsSchedulerModalOpen(false)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4 text-xs overflow-y-auto max-h-[75vh]">
              {scheduleSuccessMsg ? (
                <div className="p-4 rounded-2xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 font-bold text-center flex items-center justify-center gap-2">
                  <CheckCheck className="w-5 h-5 text-emerald-400" />
                  <span>{scheduleSuccessMsg}</span>
                </div>
              ) : null}

              {/* Szybkie Szablony */}
              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1.5">
                  Wybierz związek lub gotowy preset:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_PROTOCOLS.slice(0, 5).map(p => (
                    <button
                      key={p.badge}
                      type="button"
                      onClick={() => {
                        setScheduleSubstance(p.name);
                        setScheduleDosage(String(p.dosage));
                        setScheduleUnit(p.unit as any);
                        setScheduleRoute(p.route);
                        setScheduleColor(p.color);
                      }}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:border-emerald-500/50 text-slate-300 hover:text-emerald-300 cursor-pointer"
                    >
                      {p.badge}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">Nazwa Związku</label>
                  <input
                    type="text"
                    value={scheduleSubstance}
                    onChange={e => setScheduleSubstance(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 block mb-1">Dawka</label>
                    <input
                      type="number"
                      value={scheduleDosage}
                      onChange={e => setScheduleDosage(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 block mb-1">Jedn.</label>
                    <select
                      value={scheduleUnit}
                      onChange={e => setScheduleUnit(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="mg">mg</option>
                      <option value="IU">IU</option>
                      <option value="mcg">mcg</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">Częstotliwość podawania</label>
                  <select
                    value={scheduleFrequency}
                    onChange={e => setScheduleFrequency(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="e3.5d">Co 3.5 dnia (np. Pon / Czw)</option>
                    <option value="e3d">Co 3 dni (E3D)</option>
                    <option value="eod">Co 2 dni (EOD)</option>
                    <option value="daily">Codziennie (ED)</option>
                    <option value="e7d">Raz w tygodniu (E7D)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">Czas trwania</label>
                  <select
                    value={scheduleWeeksCount}
                    onChange={e => setScheduleWeeksCount(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value={4}>4 tygodnie (1 miesiąc)</option>
                    <option value={8}>8 tygodni (2 miesiące)</option>
                    <option value={12}>12 tygodni (3 miesiące)</option>
                    <option value={16}>16 tygodni (4 miesiące)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">Data pierwszej dawki (Start)</label>
                <input
                  type="date"
                  value={scheduleStartDate}
                  onChange={e => setScheduleStartDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Informacja podsumowująca */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-300">
                Planujesz podanie: <strong className="text-emerald-400">{scheduleSubstance}</strong> w dawce <strong className="text-emerald-400">{scheduleDosage} {scheduleUnit}</strong> przez okres <strong className="text-white">{scheduleWeeksCount} tygodni</strong>. Wszystkie daty zostaną automatycznie oznaczone w kalendarzu.
              </div>
            </div>

            <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsSchedulerModalOpen(false)}
                className="btn-3d-secondary px-4 py-2 rounded-xl text-xs font-bold text-slate-300 cursor-pointer"
              >
                Anuluj
              </button>
              <button
                type="button"
                onClick={handleConfirmSchedule}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-950/40 cursor-pointer active:scale-95"
              >
                <Check className="w-4 h-4" />
                <span>Wygeneruj w Kalendarzu</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
