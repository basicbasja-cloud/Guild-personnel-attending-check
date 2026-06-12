import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  format,
  startOfMonth,
  startOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  getDay,
  isToday,
} from 'date-fns';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { useGuildEvents } from '../../hooks/useGuildEvents';
import { TrainingAttendanceModal } from '../attendance/TrainingAttendanceModal';
import { TrainingSetupModal } from '../attendance/TrainingSetupModal';
import type { GuildEvent, GuildEventColor, EventType } from '../../types';

// ─── Constants ───────────────────────────────────────────────────────────────
const COLOR_MAP: Record<GuildEventColor, { bg: string; text: string; border: string; btn: string }> = {
  indigo:  { bg: 'bg-indigo-600',  text: 'text-indigo-100',  border: 'border-indigo-500',  btn: 'bg-indigo-600 hover:bg-indigo-500' },
  amber:   { bg: 'bg-amber-600',   text: 'text-amber-100',   border: 'border-amber-500',   btn: 'bg-amber-600 hover:bg-amber-500' },
  rose:    { bg: 'bg-rose-600',    text: 'text-rose-100',    border: 'border-rose-500',    btn: 'bg-rose-600 hover:bg-rose-500' },
  emerald: { bg: 'bg-emerald-600', text: 'text-emerald-100', border: 'border-emerald-500', btn: 'bg-emerald-600 hover:bg-emerald-500' },
  sky:     { bg: 'bg-sky-600',     text: 'text-sky-100',     border: 'border-sky-500',     btn: 'bg-sky-600 hover:bg-sky-500' },
};
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// ─── EventChip (draggable) ────────────────────────────────────────────────────
const EVENT_TYPE_ICONS: Record<string, string> = {
  war: '⚔️',
  training: '🏋️',
};
function getEventIcon(eventType: string): string {
  return EVENT_TYPE_ICONS[eventType] ?? '📅';
}

function EventChip({
  event, isDragging = false, compact = false, onClick,
}: {
  event: GuildEvent;
  isDragging?: boolean;
  compact?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const { bg, text } = COLOR_MAP[event.color] ?? COLOR_MAP.indigo;
  const icon = getEventIcon(event.event_type);
  return (
    <div
      className={`${bg} ${text} rounded px-1.5 py-0.5 text-xs font-medium truncate cursor-pointer select-none
        ${isDragging ? 'shadow-2xl ring-2 ring-white/40 opacity-90' : 'hover:brightness-110 hover:shadow-md'}
        ${compact ? 'max-w-[90%]' : 'w-full'} transition-all`}
      onClick={onClick}
      title={`[${event.event_type}] ${event.title}${event.start_time ? ` — ${event.start_time}` : ''}`}
    >
      {event.start_time && <span className="opacity-70 mr-1">{event.start_time}</span>}
      <span className="mr-0.5">{icon}</span>
      {event.title}
    </div>
  );
}

function DraggableEventChip({ event, onClick }: { event: GuildEvent; onClick: (e: GuildEvent) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: event.id, data: { event } });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} style={{ opacity: isDragging ? 0.3 : 1 }}>
      <EventChip event={event} onClick={(e) => { e.stopPropagation(); onClick(event); }} />
    </div>
  );
}

// ─── DroppableDayCell ─────────────────────────────────────────────────────────
function DroppableDayCell({
  date, isCurrentMonth, isManagement, events, onAddClick, onEventClick,
}: {
  date: Date;
  isCurrentMonth: boolean;
  isManagement: boolean;
  events: GuildEvent[];
  onAddClick: (date: Date) => void;
  onEventClick: (event: GuildEvent) => void;
}) {
  const isSat = getDay(date) === 6;
  const dateStr = format(date, 'yyyy-MM-dd');
  const { setNodeRef, isOver } = useDroppable({ id: `day_${dateStr}`, data: { date: dateStr } });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-20 p-1 border border-slate-700/50 flex flex-col transition-colors
        ${isCurrentMonth ? 'bg-slate-800/40' : 'bg-slate-900/60 opacity-50'}
        ${isOver ? 'bg-indigo-900/30 ring-1 ring-inset ring-indigo-500' : ''}
        ${isToday(date) ? 'ring-1 ring-inset ring-indigo-400' : ''}`}
    >
      {/* Date number */}
      <div className="flex items-center justify-between mb-1">
        <span className={`text-xs font-semibold leading-none px-1
          ${isToday(date) ? 'text-indigo-300' : isCurrentMonth ? 'text-slate-300' : 'text-slate-600'}`}>
          {format(date, 'd')}
        </span>
        {isManagement && isCurrentMonth && (
          <button
            onClick={() => onAddClick(date)}
            className="text-slate-600 hover:text-indigo-400 text-sm leading-none px-0.5 transition-colors"
            title="Add event"
          >+</button>
        )}
      </div>
      {/* War badge every Saturday */}
      {isSat && (
        <div className="text-[10px] bg-amber-900/60 text-amber-300 border border-amber-700/50 rounded px-1 py-0.5 mb-0.5 truncate">
          ⚔️ War 20:00
        </div>
      )}
      {/* Events */}
      <div className="space-y-0.5 flex-1 overflow-hidden">
        {events.map((ev) => (
          <DraggableEventChip key={ev.id} event={ev} onClick={onEventClick} />
        ))}
      </div>
    </div>
  );
}

// ─── Sidebar unscheduled item ─────────────────────────────────────────────────
function DroppableSidebar({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'sidebar_unscheduled', data: { date: null } });
  return (
    <div
      ref={setNodeRef}
      className={`min-h-20 rounded-xl border ${isOver ? 'border-indigo-500 bg-indigo-900/20' : 'border-slate-700 bg-slate-800/50'} transition-colors p-2 space-y-1.5`}
    >
      {children}
    </div>
  );
}

// ─── Event Create/Edit Modal ─────────────────────────────────────────────────
interface EventModalProps {
  initial?: Partial<GuildEvent>;
  defaultDate?: string | null;
  userId: string;
  isManagement?: boolean;
  onSave: (payload: Omit<GuildEvent, 'id' | 'created_at' | 'updated_at'>) => void;
  onDelete?: () => void;
  onClose: () => void;
}

const EVENT_TYPE_PRESETS = ['war', 'training', 'internal_event', 'meeting', 'social'];

function EventModal({ initial, defaultDate, userId, isManagement, onSave, onDelete, onClose }: EventModalProps) {
  const [title, setTitle]       = useState(initial?.title ?? '');
  const [description, setDesc]  = useState(initial?.description ?? '');
  const [date, setDate]         = useState(initial?.event_date ?? defaultDate ?? '');
  const [time, setTime]         = useState(initial?.start_time ?? '');
  const [color, setColor]       = useState<GuildEventColor>(initial?.color ?? 'indigo');
  const [eventType, setEventType] = useState<EventType>(initial?.event_type ?? 'war');
  const [customType, setCustomType] = useState(
    initial?.event_type && !EVENT_TYPE_PRESETS.includes(initial.event_type) ? initial.event_type : ''
  );
  const isEdit = !!initial?.id;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSave = () => {
    if (!title.trim()) return;
    const resolvedType = (customType || eventType).trim().toLowerCase().replace(/\s+/g, '_') || 'war';
    onSave({
      title: title.trim(),
      description: description.trim() || null,
      event_date: date || null,
      start_time: time || null,
      color,
      event_type: resolvedType,
      created_by: userId,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-5 pt-5 pb-4 border-b border-slate-700 flex items-center justify-between">
          <h2 className="font-bold text-white text-lg">{isEdit ? 'Edit Event' : 'New Event'}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 text-xl leading-none">✕</button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wider block mb-1">Title *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
              placeholder="Event title" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider block mb-1">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-400 scheme-dark" />
            </div>
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider block mb-1">Start Time</label>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-400 scheme-dark" />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wider block mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDesc(e.target.value)} rows={3}
              placeholder="Optional description…"
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white resize-none focus:outline-none focus:ring-1 focus:ring-indigo-400" />
          </div>
          {isManagement && (
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider block mb-2">Event Type</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {EVENT_TYPE_PRESETS.map((preset) => {
                  const isActive = eventType === preset && !customType;
                  const icon = getEventIcon(preset);
                  return (
                    <button
                      key={preset}
                      onClick={() => { setEventType(preset); setCustomType(''); }}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                        isActive
                          ? 'bg-indigo-900/40 border-indigo-500 text-indigo-300'
                          : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500'
                      }`}
                    >
                      {icon} {preset.replace(/_/g, ' ')}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">or custom:</span>
                <input
                  type="text"
                  value={customType}
                  onChange={(e) => {
                    setCustomType(e.target.value);
                    if (e.target.value) setEventType('');
                  }}
                  placeholder="e.g. internal_event"
                  className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          )}
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wider block mb-2">Colour</label>
            <div className="flex gap-2">
              {(Object.keys(COLOR_MAP) as GuildEventColor[]).map((c) => (
                <button key={c}
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full ${COLOR_MAP[c].bg} transition-transform ${color === c ? 'ring-2 ring-white ring-offset-1 ring-offset-slate-900 scale-110' : 'hover:scale-105'}`}
                  title={c}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="px-5 pb-5 flex gap-3 justify-between">
          {isEdit && onDelete ? (
            <button onClick={() => { onDelete(); onClose(); }}
              className="px-3 py-1.5 rounded-lg text-sm bg-rose-900/50 hover:bg-rose-800 text-rose-300 border border-rose-700 transition-colors">
              Delete
            </button>
          ) : <div />}
          <div className="flex gap-2">
            <button onClick={onClose}
              className="px-4 py-1.5 rounded-lg text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 transition-colors">
              Cancel
            </button>
            <button onClick={handleSave} disabled={!title.trim()}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-40 ${COLOR_MAP[color].btn}`}>
              {isEdit ? 'Save' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main GuildCalendarPage ───────────────────────────────────────────────────
export interface GuildCalendarPageProps {
  isManagement: boolean;
  userId?: string;
}

export function GuildCalendarPage({ isManagement, userId = '' }: GuildCalendarPageProps) {
  const { events, loading, createEvent, updateEvent, updateEventDate, deleteEvent } = useGuildEvents();
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [modalOpen, setModalOpen]       = useState(false);
  const [editingEvent, setEditingEvent] = useState<GuildEvent | null>(null);
  const [createDate, setCreateDate]     = useState<string | null>(null);
  const [draggedEvent, setDraggedEvent] = useState<GuildEvent | null>(null);
  const [trainingAttModalOpen, setTrainingAttModalOpen] = useState(false);
  const [trainingSetupModalOpen, setTrainingSetupModalOpen] = useState(false);
  const [trainingEvent, setTrainingEvent] = useState<GuildEvent | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // Build the calendar grid: 6 rows × 7 columns starting from Monday
  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [currentMonth]);

  // Map events to day strings
  const eventsByDate = useMemo(() => {
    const map = new Map<string, GuildEvent[]>();
    for (const ev of events) {
      if (!ev.event_date) continue;
      const key = ev.event_date;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }
    // Sort by start_time within each day
    map.forEach((evs) => evs.sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? '')));
    return map;
  }, [events]);

  const unscheduledEvents = useMemo(() => events.filter((e) => !e.event_date), [events]);

  // Month picker years: current year ± 2
  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1, currentYear + 2];
  const selectedYear = currentMonth.getFullYear();
  const selectedMonthIdx = currentMonth.getMonth();

  const jumpToYearMonth = useCallback((year: number, month: number) => {
    setCurrentMonth(startOfMonth(new Date(year, month, 1)));
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedEvent(null);
    if (!over) return;
    const droppedDate: string | null = over.data.current?.date ?? null;
    const evId = String(active.id);
    const ev = events.find((e) => e.id === evId);
    if (!ev) return;
    if (ev.event_date === droppedDate) return;
    updateEventDate(evId, droppedDate);
  }, [events, updateEventDate]);

  const openCreate = useCallback((date?: Date) => {
    setCreateDate(date ? format(date, 'yyyy-MM-dd') : null);
    setEditingEvent(null);
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((ev: GuildEvent) => {
    if (ev.event_type === 'training' && isManagement) {
      // Training events: open attendance + war setup view
      setTrainingEvent(ev);
      setTrainingAttModalOpen(true);
      return;
    }
    setEditingEvent(ev);
    setCreateDate(null);
    setModalOpen(true);
  }, [isManagement]);

  const handleSave = useCallback((payload: Omit<GuildEvent, 'id' | 'created_at' | 'updated_at'>) => {
    if (editingEvent) {
      updateEvent(editingEvent.id, payload);
    } else {
      createEvent({ ...payload, created_by: userId });
    }
  }, [editingEvent, updateEvent, createEvent, userId]);

  const handleTrainingClose = useCallback(() => {
    setTrainingAttModalOpen(false);
    setTrainingSetupModalOpen(false);
    setTrainingEvent(null);
  }, []);

  const handleDelete = useCallback(() => {
    if (editingEvent) deleteEvent(editingEvent.id);
  }, [editingEvent, deleteEvent]);

  // Week day header labels (Mon–Sun)
  const weekDayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <>
      <DndContext
        sensors={sensors}
        onDragStart={(e) => {
          const ev = events.find((x) => x.id === String(e.active.id));
          if (ev) setDraggedEvent(ev);
        }}
        onDragEnd={handleDragEnd}
      >
      <div className="flex h-full min-h-0 overflow-hidden">
        {/* ── Left sidebar (unscheduled) — managers only ── */}
        {isManagement && (
          <aside className="w-52 shrink-0 border-r border-slate-700 bg-slate-900 flex flex-col p-3 gap-3 overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Unscheduled</h3>
              <button
                onClick={() => openCreate()}
                className="text-xs px-2 py-0.5 rounded bg-indigo-700 hover:bg-indigo-600 text-white font-semibold transition-colors"
              >+ New</button>
            </div>
            <DroppableSidebar>
              {unscheduledEvents.length === 0 ? (
                <p className="text-xs text-slate-600 italic">Drag events here to unschedule</p>
              ) : (
                unscheduledEvents.map((ev) => (
                  <DraggableEventChip key={ev.id} event={ev} onClick={openEdit} />
                ))
              )}
            </DroppableSidebar>
          </aside>
        )}

        {/* ── Main calendar area ── */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-900 shrink-0 gap-2">
            <button
              onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
              className="p-1.5 rounded hover:bg-slate-700 text-slate-300 transition-colors"
            >◀</button>

            {/* Month + year pickers */}
            <div className="flex items-center gap-2">
              <select
                value={selectedMonthIdx}
                onChange={(e) => jumpToYearMonth(selectedYear, Number(e.target.value))}
                className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-white focus:outline-none cursor-pointer"
              >
                {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => jumpToYearMonth(Number(e.target.value), selectedMonthIdx)}
                className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-white focus:outline-none cursor-pointer"
              >
                {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentMonth(startOfMonth(new Date()))}
                className="text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 transition-colors"
              >Today</button>
              {isManagement && (
                <button
                  onClick={() => openCreate()}
                  className="text-xs px-2.5 py-1 rounded bg-indigo-700 hover:bg-indigo-600 text-white font-semibold transition-colors"
                >+ Event</button>
              )}
              <button
                onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
                className="p-1.5 rounded hover:bg-slate-700 text-slate-300 transition-colors"
              >▶</button>
            </div>
          </div>

          {/* Day-of-week header row */}
          <div className="grid grid-cols-7 border-b border-slate-700 bg-slate-900 shrink-0">
            {weekDayLabels.map((d) => (
              <div key={d} className={`text-center text-xs font-semibold py-1.5 text-slate-400 ${d === 'Sat' ? 'text-amber-400' : ''}`}>
                {d}
              </div>
            ))}
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center text-slate-400">Loading…</div>
          ) : (
            /* Calendar grid — 6 rows */
            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-7 auto-rows-[minmax(80px,1fr)]">
                {calendarDays.map((day) => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  return (
                    <DroppableDayCell
                      key={dateStr}
                      date={day}
                      isCurrentMonth={isSameMonth(day, currentMonth)}
                      isManagement={isManagement}
                      events={eventsByDate.get(dateStr) ?? []}
                      onAddClick={openCreate}
                      onEventClick={openEdit}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay dropAnimation={null}>
        {draggedEvent ? <EventChip event={draggedEvent} isDragging compact /> : null}
      </DragOverlay>

      {/* Create / Edit modal */}
      {modalOpen && (
        <EventModal
          initial={editingEvent ?? undefined}
          defaultDate={createDate}
          userId={userId}
          isManagement={isManagement}
          onSave={handleSave}
          onDelete={editingEvent ? handleDelete : undefined}
          onClose={() => setModalOpen(false)}
        />
      )}

      {/* Training Attendance Modal */}
      {trainingAttModalOpen && trainingEvent && (
        <TrainingAttendanceModal
          event={trainingEvent}
          currentUserId={userId}
          isManagement={isManagement}
          onClose={handleTrainingClose}
          onManageSetup={() => {
            setTrainingAttModalOpen(false);
            setTrainingSetupModalOpen(true);
          }}
        />
      )}
    </DndContext>

      {/* Training Setup — full page, outside calendar DndContext to avoid nested DnD conflicts */}
      {trainingSetupModalOpen && trainingEvent && (
        <TrainingSetupModal
          event={trainingEvent}
          currentUserId={userId}
          isManagement={isManagement}
          onClose={handleTrainingClose}
        />
      )}
    </>
  );
}
