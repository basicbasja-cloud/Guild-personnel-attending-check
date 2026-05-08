import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useLeagueBoard } from '../../hooks/useLeagueBoard';
import type { LeagueZoneAssignment, LeagueDrawing } from '../../hooks/useLeagueBoard';
import { PARTY_ICONS, ICON_GLYPHS, PHASE_COLORS } from '../../lib/leagueMapLayout';
import type { PartyIcon } from '../../lib/leagueMapLayout';

const MAP_W = 1209;
const MAP_H = 634;

// ── Data types ──────────────────────────────────────────────────────────────

export interface MemberInfo {
  id: string;
  username: string;
  characterName: string | null;
  characterClass: string | null;
  mainSkillName: string | null;
  mainSkillLevel: number | null;
  subSkillName: string | null;
  subSkillLevel: number | null;
  avatarUrl: string | null;
}

export interface PartySummaryWithMembers {
  id: string;
  groupName: string;
  partyNumber: number;
  icon: string | null;
  members: MemberInfo[];
}

// ── SVG helpers ──────────────────────────────────────────────────────────────

/** Convert an array of % points into a smooth SVG path string */
function pointsToPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = ((pts[i].x + pts[i + 1].x) / 2).toFixed(2);
    const my = ((pts[i].y + pts[i + 1].y) / 2).toFixed(2);
    d += ` Q ${pts[i].x.toFixed(2)} ${pts[i].y.toFixed(2)} ${mx} ${my}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${last.x.toFixed(2)} ${last.y.toFixed(2)}`;
  return d;
}

/** Arrowhead polygon at the end of a path */
function arrowHeadPath(pts: { x: number; y: number }[], size = 2.2): string {
  if (pts.length < 2) return '';
  const n = pts.length;
  const from = pts[Math.max(0, n - 5)];
  const to   = pts[n - 1];
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const { x, y } = to;
  const a1x = x - size * Math.cos(angle - Math.PI / 6);
  const a1y = y - size * Math.sin(angle - Math.PI / 6);
  const a2x = x - size * Math.cos(angle + Math.PI / 6);
  const a2y = y - size * Math.sin(angle + Math.PI / 6);
  return `M ${x.toFixed(2)} ${y.toFixed(2)} L ${a1x.toFixed(2)} ${a1y.toFixed(2)} L ${a2x.toFixed(2)} ${a2y.toFixed(2)} Z`;
}

// ── Icon picker modal ────────────────────────────────────────────────────────

function IconPickerModal({ current, onSelect, onClose }: {
  current: string | null;
  onSelect: (icon: PartyIcon | null) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-72 shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <h3 className="text-white font-semibold text-sm">Pick Party Icon</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-lg leading-none">x</button>
        </div>
        <div className="p-4 grid grid-cols-6 gap-2">
          {PARTY_ICONS.map((icon) => (
            <button
              key={icon}
              title={icon}
              onClick={() => onSelect(icon)}
              className={`h-10 w-10 rounded-lg text-xl flex items-center justify-center transition-all
                ${current === icon ? 'bg-indigo-600 ring-2 ring-indigo-400 scale-110' : 'bg-slate-800 hover:bg-slate-700'}`}
            >
              {ICON_GLYPHS[icon]}
            </button>
          ))}
        </div>
        <div className="px-4 pb-4 flex justify-end">
          <button onClick={() => onSelect(null)} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
            Remove icon
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Freehand drawing layer ───────────────────────────────────────────────────
// Uses viewBox="0 0 100 100" + preserveAspectRatio="none" so % coordinates
// align exactly with CSS-% positioned markers at every screen size.

interface FreehandLayerProps {
  drawings: LeagueDrawing[];
  drawMode: boolean;
  onDelete: (id: string) => void;
  livePathRef: React.RefObject<SVGPathElement | null>;
  liveHeadRef: React.RefObject<SVGPathElement | null>;
  liveColor: string;
}

function FreehandLayer({ drawings, drawMode, onDelete, livePathRef, liveHeadRef, liveColor }: FreehandLayerProps) {
  return (
    <svg
      className="absolute inset-0 w-full h-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ zIndex: 16, pointerEvents: 'none' }}
    >
      {drawings.map((d) => {
        const color = PHASE_COLORS[d.phase];
        const pathD  = pointsToPath(d.points);
        const headD  = arrowHeadPath(d.points);
        return (
          <g
            key={d.id}
            style={{ pointerEvents: drawMode ? 'auto' : 'none', cursor: drawMode ? 'pointer' : 'default' }}
            onClick={drawMode ? () => onDelete(d.id) : undefined}
          >
            {/* Main stroke */}
            <path
              d={pathD}
              fill="none"
              stroke={color}
              strokeWidth="0.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeOpacity="0.9"
            />
            {/* Arrowhead */}
            <path d={headD} fill={color} fillOpacity="0.9" style={{ pointerEvents: 'none' }} />
            {/* Phase label dot */}
            {d.points.length > 4 && (() => {
              const mid = d.points[Math.floor(d.points.length / 2)];
              return (
                <g style={{ pointerEvents: 'none' }}>
                  <circle cx={mid.x} cy={mid.y} r="2.2" fill={color} fillOpacity="0.9" />
                  <text
                    x={mid.x} y={mid.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="white"
                    fontSize="2.1"
                    fontWeight="bold"
                  >
                    {d.phase}
                  </text>
                </g>
              );
            })()}
            {/* Wider invisible hit area for easier deletion */}
            {drawMode && (
              <path
                d={pathD}
                fill="none"
                stroke="transparent"
                strokeWidth="4"
                style={{ pointerEvents: 'auto' }}
              />
            )}
          </g>
        );
      })}
      {/* Live drawing preview – updated directly via refs, no React re-render */}
      <path
        ref={livePathRef}
        d=""
        fill="none"
        stroke={liveColor}
        strokeWidth="0.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity="0.85"
        strokeDasharray="none"
      />
      <path ref={liveHeadRef} d="" fill={liveColor} fillOpacity="0.85" />
    </svg>
  );
}

// ── Arrow layer (existing party-to-party arrows, read-only display) ──────────

function ArrowLayer({ arrows, assignmentByPartyId }: {
  arrows: { id: string; from_party_id: string | null; to_party_id: string | null; phase: 1 | 2 | 3 }[];
  assignmentByPartyId: Map<string, LeagueZoneAssignment>;
}) {
  if (arrows.length === 0) return null;
  return (
    <svg
      className="absolute inset-0 w-full h-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ zIndex: 15, pointerEvents: 'none' }}
    >
      {arrows.map((arrow) => {
        if (!arrow.from_party_id || !arrow.to_party_id) return null;
        const from = assignmentByPartyId.get(arrow.from_party_id);
        const to   = assignmentByPartyId.get(arrow.to_party_id);
        if (!from || !to) return null;
        const color = PHASE_COLORS[arrow.phase];
        const x1 = from.pos_x, y1 = from.pos_y;
        const x2 = to.pos_x,   y2 = to.pos_y;
        const mx = (x1 + x2) / 2 - (y2 - y1) * 0.18;
        const my = (y1 + y2) / 2 + (x2 - x1) * 0.18;
        return (
          <g key={arrow.id}>
            <path
              d={`M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`}
              fill="none" stroke={color} strokeWidth="0.6" strokeOpacity="0.9"
            />
            <circle cx={mx} cy={my} r="1.5" fill={color} fillOpacity="0.9" />
            <text x={mx} y={my} textAnchor="middle" dominantBaseline="middle"
              fill="white" fontSize="1.6" fontWeight="bold">P{arrow.phase}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

interface LeagueBoardPageProps {
  userId: string;
  isManagement: boolean;
  parties: PartySummaryWithMembers[];
  onUpdatePartyIcon: (partyId: string, icon: PartyIcon | null) => Promise<void>;
}

export function LeagueBoardPage({ userId: _userId, isManagement, parties, onUpdatePartyIcon }: LeagueBoardPageProps) {
  const board = useLeagueBoard();

  // UI state
  const [popoverPartyId, setPopoverPartyId]       = useState<string | null>(null);
  const [selectedEnemyId, setSelectedEnemyId]     = useState<string | null>(null);
  const [iconPickerPartyId, setIconPickerPartyId] = useState<string | null>(null);
  const [drawMode, setDrawMode]                   = useState(false);
  const [drawPhase, setDrawPhase]                 = useState<1 | 2 | 3>(1);
  const [showNewSeason, setShowNewSeason]         = useState(false);
  const [showNewPlan, setShowNewPlan]             = useState(false);
  const [newSeasonName, setNewSeasonName]         = useState('');
  const [newPlanName, setNewPlanName]             = useState('');

  // Refs
  const mapRef          = useRef<HTMLDivElement>(null);
  const livePathRef     = useRef<SVGPathElement | null>(null);
  const liveHeadRef     = useRef<SVGPathElement | null>(null);
  const isDrawingRef    = useRef(false);
  const currentPtsRef   = useRef<{ x: number; y: number }[]>([]);
  const dragRef = useRef<{
    assignmentId: string | null;
    partyId: string | null;
    isNew: boolean;
    startClientX: number;
    startClientY: number;
    moved: boolean;
  } | null>(null);
  const [ghostPos, setGhostPos] = useState<{ x: number; y: number } | null>(null);

  // Derived data
  const activeSeason = board.seasons[0] ?? null;
  const seasonPlans  = useMemo(() => board.plans.filter((p) => p.season_id === activeSeason?.id), [board.plans, activeSeason]);
  const planAssignments   = useMemo(() => board.assignments.filter((a) => a.plan_id === board.activePlanId), [board.assignments, board.activePlanId]);
  const planArrows        = useMemo(() => board.arrows.filter((a) => a.plan_id === board.activePlanId),  [board.arrows, board.activePlanId]);
  const planDrawings      = useMemo(() => board.drawings.filter((d) => d.plan_id === board.activePlanId), [board.drawings, board.activePlanId]);
  const assignmentByPartyId = useMemo(() => new Map(planAssignments.filter((a) => a.party_id).map((a) => [a.party_id!, a])), [planAssignments]);
  const enemyAssignments    = useMemo(() => planAssignments.filter((a) => !a.party_id), [planAssignments]);
  const partyById           = useMemo(() => new Map(parties.map((p) => [p.id, p])), [parties]);
  const placedPartyIds      = useMemo(() => new Set(assignmentByPartyId.keys()), [assignmentByPartyId]);
  const unplacedParties     = useMemo(() => parties.filter((p) => !placedPartyIds.has(p.id)), [parties, placedPartyIds]);
  const placedParties       = useMemo(() => parties.filter((p) =>  placedPartyIds.has(p.id)), [parties, placedPartyIds]);
  const unplacedByGroup     = useMemo(() => {
    const m = new Map<string, PartySummaryWithMembers[]>();
    for (const p of unplacedParties) { const a = m.get(p.groupName) ?? []; a.push(p); m.set(p.groupName, a); }
    return m;
  }, [unplacedParties]);
  const placedByGroup = useMemo(() => {
    const m = new Map<string, PartySummaryWithMembers[]>();
    for (const p of placedParties) { const a = m.get(p.groupName) ?? []; a.push(p); m.set(p.groupName, a); }
    return m;
  }, [placedParties]);

  // Map % coordinates from client position
  const getMapPercent = useCallback((clientX: number, clientY: number) => {
    const el = mapRef.current;
    if (!el) return { x: 50, y: 50 };
    const r = el.getBoundingClientRect();
    return {
      x: Math.max(1, Math.min(99, ((clientX - r.left)  / r.width)  * 100)),
      y: Math.max(1, Math.min(99, ((clientY - r.top)   / r.height) * 100)),
    };
  }, []);

  // Document-level pointer events (drag markers + freehand drawing)
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      // ── Freehand drawing ──
      if (isDrawingRef.current) {
        const { x, y } = getMapPercent(e.clientX, e.clientY);
        const pts = currentPtsRef.current;
        const last = pts[pts.length - 1];
        // Only append if moved at least 0.35% away (prevents oversampling)
        if (!last || Math.hypot(x - last.x, y - last.y) >= 0.35) {
          pts.push({ x, y });
          // Update live SVG directly – no React re-render
          livePathRef.current?.setAttribute('d', pointsToPath(pts));
          if (pts.length >= 2) {
            liveHeadRef.current?.setAttribute('d', arrowHeadPath(pts));
          }
        }
        return;
      }

      // ── Marker drag ──
      const drag = dragRef.current;
      if (!drag) return;
      if (!drag.moved && (
        Math.abs(e.clientX - drag.startClientX) > 5 ||
        Math.abs(e.clientY - drag.startClientY) > 5
      )) {
        drag.moved = true;
        setPopoverPartyId(null);
        setSelectedEnemyId(null);
      }
      if (drag.moved) {
        setGhostPos(getMapPercent(e.clientX, e.clientY));
      }
    };

    const onUp = (e: PointerEvent) => {
      // ── Finish drawing ──
      if (isDrawingRef.current) {
        isDrawingRef.current = false;
        const pts = [...currentPtsRef.current];
        currentPtsRef.current = [];
        livePathRef.current?.setAttribute('d', '');
        liveHeadRef.current?.setAttribute('d', '');
        if (pts.length >= 5 && board.activePlanId) {
          board.addDrawing(board.activePlanId, drawPhase, pts);
        }
        return;
      }

      // ── Finish marker drag ──
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      setGhostPos(null);

      if (drag.moved) {
        if (!board.activePlanId) return;
        const { x, y } = getMapPercent(e.clientX, e.clientY);
        const el = mapRef.current;
        if (el) {
          const r = el.getBoundingClientRect();
          const inBounds = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
          if (inBounds) {
            if (drag.isNew && drag.partyId) {
              board.upsertAssignment(board.activePlanId, drag.partyId, x, y, 'neutral');
            } else if (!drag.isNew && drag.partyId) {
              const existing = assignmentByPartyId.get(drag.partyId);
              board.upsertAssignment(board.activePlanId, drag.partyId, x, y, existing?.status ?? 'neutral');
            } else if (!drag.isNew && drag.assignmentId && !drag.partyId) {
              board.moveAssignment(drag.assignmentId, x, y);
            }
          }
        }
      } else {
        // Tap: show info panel
        if (drag.isNew) return;
        if (drag.partyId) {
          setPopoverPartyId((p) => p === drag.partyId ? null : drag.partyId);
          setSelectedEnemyId(null);
        } else if (drag.assignmentId) {
          setSelectedEnemyId((p) => p === drag.assignmentId ? null : drag.assignmentId);
          setPopoverPartyId(null);
        }
      }
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };
  }, [board, getMapPercent, drawPhase, assignmentByPartyId]);

  // ── Pointer handlers ─────────────────────────────────────────────────────

  /** Pointer down on the MAP DIV — starts freehand drawing in draw mode */
  const handleMapPointerDown = useCallback((e: React.PointerEvent) => {
    if (!drawMode || !isManagement || !board.activePlanId) return;
    // Only start drawing if not clicking on an interactive child (markers call stopPropagation when not in drawMode)
    e.preventDefault();
    const { x, y } = getMapPercent(e.clientX, e.clientY);
    isDrawingRef.current = true;
    currentPtsRef.current = [{ x, y }];
  }, [drawMode, isManagement, board.activePlanId, getMapPercent]);

  /** Pointer down on a placed marker — drag it (only when NOT in draw mode) */
  const handleMarkerPointerDown = useCallback((e: React.PointerEvent, assignment: LeagueZoneAssignment) => {
    if (drawMode) return; // in draw mode, let map handle it for drawing
    if (!isManagement) return;
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      partyId: assignment.party_id,
      assignmentId: assignment.id,
      isNew: false,
      startClientX: e.clientX, startClientY: e.clientY, moved: false,
    };
  }, [drawMode, isManagement]);

  /** Pointer down on sidebar party — drag to place */
  const handleSidebarPointerDown = useCallback((e: React.PointerEvent, partyId: string) => {
    if (!board.activePlanId || !isManagement) return;
    e.preventDefault();
    dragRef.current = {
      partyId, assignmentId: null, isNew: true,
      startClientX: e.clientX, startClientY: e.clientY, moved: false,
    };
  }, [board.activePlanId, isManagement]);

  const handleViewOnlyMarkerClick = useCallback((assignment: LeagueZoneAssignment) => {
    if (isManagement) return;
    if (assignment.party_id) {
      setPopoverPartyId((p) => p === assignment.party_id ? null : assignment.party_id);
      setSelectedEnemyId(null);
    } else {
      setSelectedEnemyId((p) => p === assignment.id ? null : assignment.id);
      setPopoverPartyId(null);
    }
  }, [isManagement]);

  const handleMapClick = useCallback(() => {
    if (!isDrawingRef.current) {
      setPopoverPartyId(null);
      setSelectedEnemyId(null);
    }
  }, []);

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleSetStatus = useCallback((partyId: string, status: LeagueZoneAssignment['status']) => {
    if (!board.activePlanId || !isManagement) return;
    const a = assignmentByPartyId.get(partyId);
    if (!a) return;
    board.upsertAssignment(board.activePlanId, partyId, a.pos_x, a.pos_y, status, a.note);
  }, [board, assignmentByPartyId, isManagement]);

  const handleRemoveParty = useCallback((partyId: string) => {
    if (!isManagement) return;
    const a = assignmentByPartyId.get(partyId);
    if (!a) return;
    board.removeAssignment(a.id);
    setPopoverPartyId(null);
  }, [board, assignmentByPartyId, isManagement]);

  const handleRemoveEnemy = useCallback((id: string) => {
    if (!isManagement) return;
    board.removeAssignment(id);
    setSelectedEnemyId(null);
  }, [board, isManagement]);

  const handleCreateSeason = useCallback(async () => {
    const name = newSeasonName.trim();
    if (!name) return;
    await board.createSeason(name);
    setNewSeasonName(''); setShowNewSeason(false);
  }, [board, newSeasonName]);

  const handleCreatePlan = useCallback(async () => {
    const name = newPlanName.trim();
    if (!name || !activeSeason) return;
    await board.createPlan(activeSeason.id, name);
    setNewPlanName(''); setShowNewPlan(false);
  }, [board, newPlanName, activeSeason]);

  // ── Render ───────────────────────────────────────────────────────────────

  if (board.loading) {
    return <div className="flex items-center justify-center h-64 text-slate-500">Loading league board...</div>;
  }

  const statusRing = (s: LeagueZoneAssignment['status']) =>
    s === 'friendly' ? 'border-cyan-400 shadow-cyan-500/40' :
    s === 'enemy'    ? 'border-red-500 shadow-red-600/40'   :
                       'border-slate-500 shadow-slate-600/20';

  const selectedEnemy = selectedEnemyId ? enemyAssignments.find((a) => a.id === selectedEnemyId) ?? null : null;
  const liveColor     = PHASE_COLORS[drawPhase];

  return (
    <div className="flex flex-col gap-3 px-4 py-4 max-w-screen-2xl mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-white font-bold text-xl">League Strategic Board</h2>
          {activeSeason && <p className="text-slate-400 text-xs mt-0.5">Season: {activeSeason.name}</p>}
          {!isManagement && <p className="text-slate-500 text-xs mt-0.5">View-only mode</p>}
        </div>
        {isManagement && (
          <button
            onClick={() => setShowNewSeason(true)}
            className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs transition-colors"
          >
            + Season
          </button>
        )}
      </div>

      {isManagement && showNewSeason && (
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg bg-slate-800 border border-slate-700 text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Season name (e.g. Season 12)"
            value={newSeasonName}
            onChange={(e) => setNewSeasonName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreateSeason(); if (e.key === 'Escape') setShowNewSeason(false); }}
            autoFocus
          />
          <button onClick={handleCreateSeason} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm">Create</button>
          <button onClick={() => setShowNewSeason(false)} className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 text-sm">Cancel</button>
        </div>
      )}

      {activeSeason ? (
        <>
          {/* ── Plan tabs ── */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {seasonPlans.map((plan) => (
              <button
                key={plan.id}
                onClick={() => board.setActivePlanId(plan.id)}
                className={`shrink-0 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors
                  ${board.activePlanId === plan.id ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
              >
                {plan.name}
              </button>
            ))}
            {isManagement && (
              showNewPlan ? (
                <div className="flex gap-2 shrink-0">
                  <input
                    className="rounded-lg bg-slate-800 border border-slate-700 text-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-36"
                    placeholder="Plan name"
                    value={newPlanName}
                    onChange={(e) => setNewPlanName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCreatePlan(); if (e.key === 'Escape') setShowNewPlan(false); }}
                    autoFocus
                  />
                  <button onClick={handleCreatePlan} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs">Add</button>
                  <button onClick={() => setShowNewPlan(false)} className="px-3 py-1.5 rounded-lg bg-slate-700 text-slate-300 text-xs">x</button>
                </div>
              ) : (
                <button
                  onClick={() => setShowNewPlan(true)}
                  className="shrink-0 px-3 py-1.5 rounded-lg border border-dashed border-slate-600 text-slate-400 hover:text-slate-200 text-sm transition-colors"
                >
                  + Plan
                </button>
              )
            )}
          </div>

          <div className="flex gap-3" style={{ minHeight: '520px' }}>
            {/* ── Left sidebar ── */}
            <aside className="w-44 shrink-0 flex flex-col gap-2 bg-slate-900 rounded-xl border border-slate-700 p-3 overflow-y-auto">
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide shrink-0">Parties</p>
              {isManagement && <p className="text-slate-600 text-[10px] shrink-0">Drag onto map to place</p>}

              {unplacedParties.length === 0 && placedParties.length === 0 && (
                <p className="text-slate-600 text-xs">No parties in war setup</p>
              )}

              {/* Unplaced parties by group */}
              {Array.from(unplacedByGroup.entries()).map(([gName, gParties]) => (
                <div key={gName} className="flex flex-col gap-1">
                  <p className="text-slate-500 text-[10px] font-semibold uppercase tracking-wide px-1 mt-1">{gName}</p>
                  {gParties.map((p) => (
                    <div
                      key={p.id}
                      onPointerDown={isManagement ? (e) => handleSidebarPointerDown(e, p.id) : undefined}
                      className={`flex items-center gap-2 bg-slate-800 rounded-lg px-2 py-2 select-none transition-colors
                        ${isManagement ? 'cursor-grab active:cursor-grabbing hover:bg-slate-700' : 'cursor-default'}`}
                    >
                      <span className="text-lg leading-none shrink-0">
                        {p.icon ? (ICON_GLYPHS[p.icon as PartyIcon] ?? '?') : '?'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-white text-xs font-medium truncate leading-tight">P{p.partyNumber}</p>
                        <p className="text-slate-500 text-[10px] leading-tight">{p.members.length}m</p>
                      </div>
                      {isManagement && (
                        <button
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={() => setIconPickerPartyId(p.id)}
                          className="text-slate-600 hover:text-slate-300 text-xs shrink-0 transition-colors"
                        >ico</button>
                      )}
                    </div>
                  ))}
                </div>
              ))}

              {placedParties.length > 0 && <div className="border-t border-slate-700 my-1" />}

              {/* Placed parties by group */}
              {Array.from(placedByGroup.entries()).map(([gName, gParties]) => (
                <div key={gName} className="flex flex-col gap-1">
                  <p className="text-slate-500 text-[10px] font-semibold uppercase tracking-wide px-1 mt-1">{gName} (placed)</p>
                  {gParties.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => { setPopoverPartyId((prev) => prev === p.id ? null : p.id); setSelectedEnemyId(null); }}
                      className={`flex items-center gap-2 rounded-lg px-2 py-2 select-none transition-colors cursor-pointer
                        ${popoverPartyId === p.id ? 'bg-indigo-800/60 border border-indigo-600' : 'bg-slate-800/50 opacity-60 hover:opacity-90'}`}
                    >
                      <span className="text-lg leading-none shrink-0">
                        {p.icon ? (ICON_GLYPHS[p.icon as PartyIcon] ?? '?') : '?'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-slate-300 text-xs font-medium truncate leading-tight">P{p.partyNumber}</p>
                        <p className="text-slate-500 text-[10px] leading-tight">on map</p>
                      </div>
                      {isManagement && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setIconPickerPartyId(p.id); }}
                          className="text-slate-600 hover:text-slate-300 text-xs shrink-0 transition-colors"
                        >ico</button>
                      )}
                    </div>
                  ))}
                </div>
              ))}

              {/* Enemy units section */}
              {(isManagement || enemyAssignments.length > 0) && (
                <>
                  <div className="border-t border-slate-700 my-1" />
                  <div className="flex items-center justify-between shrink-0">
                    <p className="text-red-400 text-xs font-semibold uppercase tracking-wide">Enemy</p>
                    {isManagement && board.activePlanId && (
                      <button
                        onClick={() => board.addEnemyMarker(board.activePlanId!, 50, 50)}
                        className="text-red-400 hover:text-red-300 text-xs leading-none transition-colors"
                      >+ Add</button>
                    )}
                  </div>
                  {enemyAssignments.map((ea, i) => (
                    <div
                      key={ea.id}
                      onClick={() => { setSelectedEnemyId((p) => p === ea.id ? null : ea.id); setPopoverPartyId(null); }}
                      className={`flex items-center gap-2 rounded-lg px-2 py-2 select-none transition-colors cursor-pointer
                        ${selectedEnemyId === ea.id ? 'bg-red-900/50 border border-red-600' : 'bg-slate-800/50 hover:bg-slate-800'}`}
                    >
                      <span className="text-red-400 font-bold text-sm leading-none">E</span>
                      <p className="text-red-300 text-xs font-medium flex-1">Enemy {i + 1}</p>
                    </div>
                  ))}
                  {enemyAssignments.length === 0 && isManagement && (
                    <p className="text-slate-600 text-[10px]">No enemies placed</p>
                  )}
                </>
              )}
            </aside>

            {/* ── Map area ── */}
            <div className="flex-1 flex flex-col gap-2 min-w-0">
              {/* Draw toolbar */}
              {isManagement && (
                <div className="flex items-center gap-3 flex-wrap">
                  {/* Draw mode toggle */}
                  <button
                    onClick={() => { setDrawMode((d) => !d); }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                      ${drawMode
                        ? 'bg-amber-600 text-white ring-2 ring-amber-400 shadow-lg shadow-amber-500/30'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                  >
                    {drawMode ? 'Drawing...' : 'Draw Arrow'}
                  </button>

                  {/* Phase picker */}
                  {drawMode && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500 text-xs">Phase:</span>
                      {([1, 2, 3] as const).map((ph) => (
                        <button
                          key={ph}
                          onClick={() => setDrawPhase(ph)}
                          className={`w-8 h-8 rounded-full text-xs font-bold transition-all border-2
                            ${drawPhase === ph ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-60 hover:opacity-90'}`}
                          style={{ backgroundColor: PHASE_COLORS[ph], color: 'white' }}
                        >
                          {ph}
                        </button>
                      ))}
                      <span className="text-slate-500 text-xs ml-1 hidden sm:inline">
                        Hold &amp; drag to draw &bull; click drawing to delete
                      </span>
                    </div>
                  )}

                  {/* Hint when draw mode off */}
                  {!drawMode && planDrawings.length > 0 && isManagement && (
                    <span className="text-slate-500 text-xs">{planDrawings.length} stroke{planDrawings.length !== 1 ? 's' : ''} on map</span>
                  )}
                </div>
              )}

              {/* Map canvas */}
              <div
                ref={mapRef}
                onClick={handleMapClick}
                onPointerDown={handleMapPointerDown}
                className="relative rounded-xl border border-slate-700 overflow-hidden bg-slate-950 flex-1"
                style={{
                  aspectRatio: `${MAP_W} / ${MAP_H}`,
                  cursor: drawMode ? 'crosshair' : 'default',
                  userSelect: 'none',
                  touchAction: 'none',
                }}
              >
                {/* Map background */}
                <img
                  src="/league-map.jpg"
                  alt="League Map"
                  className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
                  draggable={false}
                />

                {/* Legacy party-to-party arrows */}
                <ArrowLayer arrows={planArrows} assignmentByPartyId={assignmentByPartyId} />

                {/* Freehand drawings (saved + live preview) */}
                <FreehandLayer
                  drawings={planDrawings}
                  drawMode={drawMode}
                  onDelete={board.deleteDrawing}
                  livePathRef={livePathRef}
                  liveHeadRef={liveHeadRef}
                  liveColor={liveColor}
                />

                {/* Placed party markers */}
                {planAssignments.filter((a) => a.party_id).map((a) => {
                  const party = partyById.get(a.party_id!);
                  if (!party) return null;
                  const glyph     = party.icon ? (ICON_GLYPHS[party.icon as PartyIcon] ?? '?') : '?';
                  const isSelected = popoverPartyId === a.party_id;
                  const isDragging = dragRef.current?.partyId === a.party_id && dragRef.current?.moved;
                  const posX = isDragging && ghostPos ? ghostPos.x : a.pos_x;
                  const posY = isDragging && ghostPos ? ghostPos.y : a.pos_y;

                  return (
                    <div
                      key={a.id}
                      className="absolute transform -translate-x-1/2 -translate-y-1/2 select-none"
                      style={{ left: `${posX}%`, top: `${posY}%`, zIndex: isSelected ? 35 : isDragging ? 40 : 20 }}
                    >
                      <div
                        onPointerDown={isManagement ? (e) => handleMarkerPointerDown(e, a) : undefined}
                        onClick={!isManagement ? () => handleViewOnlyMarkerClick(a) : undefined}
                        className={`w-12 h-12 rounded-full border-2 shadow-lg flex items-center justify-center
                          text-2xl bg-slate-900/80 backdrop-blur-sm transition-all ${statusRing(a.status)}
                          ${isSelected ? 'ring-2 ring-indigo-400 scale-110' : ''}
                          ${isManagement && !drawMode ? 'cursor-grab active:cursor-grabbing hover:scale-105' : 'cursor-pointer'}`}
                      >
                        {glyph}
                      </div>
                      <div className="text-center mt-0.5 pointer-events-none">
                        <span className="text-[9px] text-white bg-black/60 px-1 rounded leading-tight whitespace-nowrap">
                          {party.groupName} P{party.partyNumber}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {/* Enemy markers */}
                {enemyAssignments.map((a, i) => {
                  const isSelected = selectedEnemyId === a.id;
                  const isDragging = dragRef.current?.assignmentId === a.id && dragRef.current?.moved;
                  const posX = isDragging && ghostPos ? ghostPos.x : a.pos_x;
                  const posY = isDragging && ghostPos ? ghostPos.y : a.pos_y;
                  return (
                    <div
                      key={a.id}
                      className="absolute transform -translate-x-1/2 -translate-y-1/2 select-none"
                      style={{ left: `${posX}%`, top: `${posY}%`, zIndex: isSelected ? 35 : isDragging ? 40 : 20 }}
                    >
                      <div
                        onPointerDown={isManagement ? (e) => handleMarkerPointerDown(e, a) : undefined}
                        onClick={!isManagement ? () => handleViewOnlyMarkerClick(a) : undefined}
                        className={`w-12 h-12 rounded-full border-2 border-red-500 shadow-lg shadow-red-600/40
                          flex items-center justify-center bg-red-950/80 backdrop-blur-sm transition-all
                          ${isSelected ? 'ring-2 ring-red-400 scale-110' : ''}
                          ${isManagement && !drawMode ? 'cursor-grab active:cursor-grabbing hover:scale-105' : 'cursor-pointer'}`}
                      >
                        <span className="text-red-300 font-bold text-sm">E</span>
                      </div>
                      <div className="text-center mt-0.5 pointer-events-none">
                        <span className="text-[9px] text-white bg-red-900/70 px-1 rounded leading-tight whitespace-nowrap">
                          Enemy {i + 1}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {/* Sidebar drag ghost */}
                {ghostPos && dragRef.current?.isNew && (
                  <div
                    className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ left: `${ghostPos.x}%`, top: `${ghostPos.y}%`, zIndex: 50 }}
                  >
                    <div className="w-12 h-12 rounded-full border-2 border-indigo-400 bg-indigo-600/70 flex items-center justify-center text-2xl shadow-xl opacity-80">
                      {(() => {
                        const p = dragRef.current ? partyById.get(dragRef.current.partyId ?? '') : null;
                        return p?.icon ? (ICON_GLYPHS[p.icon as PartyIcon] ?? '?') : '?';
                      })()}
                    </div>
                  </div>
                )}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full border-2 border-cyan-400 inline-block" /> Friendly</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full border-2 border-red-500 inline-block" /> Enemy</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full border-2 border-slate-500 inline-block" /> Neutral</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: PHASE_COLORS[1] }} /> Phase 1</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: PHASE_COLORS[2] }} /> Phase 2</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: PHASE_COLORS[3] }} /> Phase 3</span>
              </div>
            </div>

            {/* ── Right info panel ── */}
            <aside className="w-56 shrink-0 flex flex-col bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
              {(() => {
                if (selectedEnemy) {
                  const idx = enemyAssignments.findIndex((a) => a.id === selectedEnemy.id);
                  return (
                    <>
                      <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-700 shrink-0">
                        <span className="text-white font-semibold text-sm">Enemy Unit {idx + 1}</span>
                        <button onClick={() => setSelectedEnemyId(null)} className="text-slate-400 hover:text-white text-sm leading-none">x</button>
                      </div>
                      <div className="flex-1 flex flex-col items-center justify-center gap-2 p-4 text-center">
                        <div className="w-16 h-16 rounded-full border-2 border-red-500 bg-red-950/50 flex items-center justify-center">
                          <span className="text-red-300 font-bold text-2xl">E</span>
                        </div>
                        <p className="text-slate-400 text-xs">Enemy position on map</p>
                        {isManagement && <p className="text-slate-600 text-[10px]">Drag to reposition</p>}
                      </div>
                      {isManagement && (
                        <div className="px-3 py-2 border-t border-slate-700 shrink-0">
                          <button
                            onClick={() => handleRemoveEnemy(selectedEnemy.id)}
                            className="w-full py-1.5 rounded text-xs text-red-400 hover:text-red-300 border border-red-800/50 hover:border-red-600 transition-colors"
                          >
                            Remove from map
                          </button>
                        </div>
                      )}
                    </>
                  );
                }

                const selParty  = popoverPartyId ? partyById.get(popoverPartyId) : null;
                const selAssign = popoverPartyId ? assignmentByPartyId.get(popoverPartyId) : null;
                if (!selParty || !selAssign) {
                  return (
                    <div className="flex-1 flex flex-col items-center justify-center gap-2 p-4 text-center">
                      <p className="text-slate-500 text-xs">Click a party on the map to view members</p>
                      {isManagement && drawMode && (
                        <p className="text-amber-500/70 text-xs mt-2">
                          Hold &amp; drag on the map to draw. Click a stroke to delete it.
                        </p>
                      )}
                    </div>
                  );
                }

                const glyph = selParty.icon ? (ICON_GLYPHS[selParty.icon as PartyIcon] ?? '?') : '?';
                return (
                  <>
                    <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-700 shrink-0">
                      <span className="text-white font-semibold text-sm flex items-center gap-2">
                        <span className="text-base">{glyph}</span>
                        {selParty.groupName} P{selParty.partyNumber}
                      </span>
                      <button onClick={() => setPopoverPartyId(null)} className="text-slate-400 hover:text-white text-sm leading-none">x</button>
                    </div>

                    {/* Status toggle (management) */}
                    {isManagement && (
                      <div className="px-3 py-2 border-b border-slate-700 shrink-0">
                        <div className="flex gap-1">
                          {(['friendly', 'neutral', 'enemy'] as const).map((s) => (
                            <button
                              key={s}
                              onClick={() => handleSetStatus(selParty.id, s)}
                              className={`flex-1 py-1 rounded text-[10px] font-medium transition-colors border
                                ${selAssign.status === s
                                  ? s === 'friendly' ? 'bg-cyan-600 border-cyan-400 text-white'
                                    : s === 'enemy' ? 'bg-red-700 border-red-500 text-white'
                                    : 'bg-slate-600 border-slate-400 text-white'
                                  : 'bg-transparent border-slate-700 text-slate-400 hover:text-slate-200'
                                }`}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Status badge (view) */}
                    {!isManagement && (
                      <div className="px-3 py-2 border-b border-slate-700 shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded font-medium
                          ${selAssign.status === 'friendly' ? 'bg-cyan-900/50 text-cyan-300' :
                            selAssign.status === 'enemy' ? 'bg-red-900/50 text-red-300' :
                            'bg-slate-700 text-slate-300'}`}>
                          {selAssign.status}
                        </span>
                      </div>
                    )}

                    {/* Members */}
                    <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
                      {selParty.members.length === 0 && <p className="text-slate-500 text-xs">No members assigned</p>}
                      {selParty.members.map((m) => (
                        <div key={m.id} className="flex items-start gap-2">
                          {m.avatarUrl ? (
                            <img src={m.avatarUrl} className="w-7 h-7 rounded-full shrink-0 mt-0.5" alt="" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-slate-700 shrink-0 flex items-center justify-center text-xs font-bold text-white mt-0.5">
                              {m.username.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-white text-xs font-medium leading-tight truncate">{m.characterName ?? m.username}</p>
                            {m.characterName && <p className="text-slate-500 text-[10px] leading-tight truncate">{m.username}</p>}
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {m.characterClass && (
                                <span className="text-[9px] px-1 py-0.5 rounded bg-slate-700 text-slate-300">{m.characterClass}</span>
                              )}
                              {m.mainSkillName && (
                                <span className="text-[9px] px-1 py-0.5 rounded bg-violet-700/50 text-violet-200 border border-violet-600/30">
                                  {m.mainSkillName}{m.mainSkillLevel != null ? ` ${m.mainSkillLevel}` : ''}
                                </span>
                              )}
                              {m.subSkillName && (
                                <span className="text-[9px] px-1 py-0.5 rounded bg-sky-700/50 text-sky-200 border border-sky-600/30">
                                  {m.subSkillName}{m.subSkillLevel != null ? ` ${m.subSkillLevel}` : ''}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Remove */}
                    {isManagement && (
                      <div className="px-3 py-2 border-t border-slate-700 shrink-0">
                        <button
                          onClick={() => handleRemoveParty(selParty.id)}
                          className="w-full py-1.5 rounded text-xs text-red-400 hover:text-red-300 border border-red-800/50 hover:border-red-600 transition-colors"
                        >
                          Remove from map
                        </button>
                      </div>
                    )}
                  </>
                );
              })()}
            </aside>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          {isManagement
            ? <p className="text-slate-400 text-sm">No season yet. Create one to start planning.</p>
            : <p className="text-slate-500 text-sm">No league board data yet.</p>
          }
        </div>
      )}

      {/* Icon picker modal */}
      {iconPickerPartyId && (
        <IconPickerModal
          current={partyById.get(iconPickerPartyId)?.icon ?? null}
          onSelect={async (icon) => {
            await onUpdatePartyIcon(iconPickerPartyId, icon);
            setIconPickerPartyId(null);
          }}
          onClose={() => setIconPickerPartyId(null)}
        />
      )}
    </div>
  );
}
