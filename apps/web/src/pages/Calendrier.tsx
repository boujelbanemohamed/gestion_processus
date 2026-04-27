import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../store/auth';

type CalendarView = 'month' | 'week' | 'day';
type CalendarTypeFilter = 'all' | 'task' | 'notification';

type TacheItem = {
  id: string;
  nom: string;
  statut: string;
  dateDebut?: string | null;
  dateFinApprox?: string | null;
  createdAt?: string;
  projetId?: string | null;
  projet?: { id: string; nom: string } | null;
  assignesUtilisateurs?: Array<{ id: string; nom: string; prenom: string }>;
  assignesEntites?: Array<{ id: string; nom: string }>;
  assignesClientsFournisseurs?: Array<{ id: string; nom: string; type?: string }>;
  userStory?: {
    id: string;
    epic?: {
      id: string;
      nom: string;
    } | null;
  } | null;
};

type NotificationItem = {
  id: string;
  type: string;
  titre: string;
  contenu: string;
  lienType?: string | null;
  lienId?: string | null;
  createdAt: string;
};

type CalendarEvent = {
  id: string;
  sourceId: string;
  type: 'task' | 'notification';
  subType?: string;
  title: string;
  date: Date;
  endDate?: Date | null;
  projectId?: string | null;
  projectName?: string;
  assigneesUsers?: string[];
  assigneesEntites?: string[];
  assigneesClientsFournisseurs?: string[];
  epicName?: string;
  durationLabel?: string;
  status?: string;
  tooltip: string;
};

const STATUS_LABEL: Record<string, string> = {
  cree: 'Créée',
  a_faire: 'À faire / Non démarré',
  en_cours: 'En cours (Active)',
  en_attente: 'En attente / Suspendu',
  bloque: 'Bloqué / En retard',
  termine: 'Terminé / Finalisé',
  archive: 'Archivée',
};

function dayKey(d: Date) {
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}-${`${d.getDate()}`.padStart(2, '0')}`;
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function sameDay(a: Date, b: Date) {
  return dayKey(a) === dayKey(b);
}

function diffDays(a: Date, b: Date) {
  const ms = startOfDay(a).getTime() - startOfDay(b).getTime();
  return Math.round(ms / (24 * 3600 * 1000));
}

function computeDurationLabel(dateDebut?: string | null, dateFinApprox?: string | null) {
  if (!dateDebut || !dateFinApprox) return '';
  const start = startOfDay(new Date(dateDebut));
  const end = startOfDay(new Date(dateFinApprox));
  const days = Math.max(0, Math.round((end.getTime() - start.getTime()) / (24 * 3600 * 1000))) + 1;
  return `${days} j`;
}

export default function Calendrier() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [view, setView] = useState<CalendarView>('month');
  const [anchor, setAnchor] = useState<Date>(startOfDay(new Date()));
  const [tasks, setTasks] = useState<TacheItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<CalendarTypeFilter>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [adminUserFilter, setAdminUserFilter] = useState<string>('all');

  const canFilterByAssignment = useMemo(() => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    const u = user as any;
    return Boolean(
      u?.isEntiteResponsable ||
      u?.isResponsableEntite ||
      (Array.isArray(u?.entitesResponsables) && u.entitesResponsables.length > 0) ||
      (Array.isArray(u?.entiteResponsableIds) && u.entiteResponsableIds.length > 0) ||
      user.role === 'contributeur'
    );
  }, [user]);

  const load = async () => {
    setLoading(true);
    try {
      const [tRes, nRes] = await Promise.all([api.get('/taches'), api.get('/notifications')]);
      setTasks(Array.isArray(tRes.data) ? tRes.data : []);
      setNotifications(Array.isArray(nRes.data) ? nRes.data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 60000);
    return () => clearInterval(timer);
  }, []);

  const projects = useMemo(() => {
    const m = new Map<string, string>();
    tasks.forEach((t) => {
      if (t.projet?.id) m.set(t.projet.id, t.projet.nom || t.projet.id);
    });
    return [...m.entries()].map(([id, nom]) => ({ id, nom })).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  }, [tasks]);

  const users = useMemo(() => {
    const m = new Map<string, string>();
    tasks.forEach((t) => {
      (t.assignesUtilisateurs || []).forEach((u) => m.set(u.id, `${u.prenom} ${u.nom}`));
      if (t as any && (t as any).createur?.id) {
        const c = (t as any).createur;
        m.set(c.id, `${c.prenom} ${c.nom}`);
      }
    });
    return [...m.entries()].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label, 'fr'));
  }, [tasks]);

  const events = useMemo<CalendarEvent[]>(() => {
    const out: CalendarEvent[] = [];
    for (const t of tasks) {
      if (projectFilter !== 'all' && t.projetId !== projectFilter) continue;
      if (statusFilter !== 'all' && t.statut !== statusFilter) continue;
      if (adminUserFilter !== 'all') {
        const assigned = (t.assignesUtilisateurs || []).some((u) => u.id === adminUserFilter);
        const created = (t as any).createur?.id === adminUserFilter;
        if (!assigned && !created) continue;
      }
      const start = t.dateDebut ? startOfDay(new Date(t.dateDebut)) : startOfDay(new Date(t.createdAt || Date.now()));
      const end = t.dateFinApprox ? endOfDay(new Date(t.dateFinApprox)) : start;
      const assigneesUsers = (t.assignesUtilisateurs || []).map((u) => `${u.prenom} ${u.nom}`.trim()).filter(Boolean);
      const assigneesEntites = (t.assignesEntites || []).map((e) => e.nom).filter(Boolean);
      const assigneesClientsFournisseurs = (t.assignesClientsFournisseurs || []).map((cf) => cf.nom).filter(Boolean);
      const epicName = t.userStory?.epic?.nom?.trim() || '';
      const durationLabel = computeDurationLabel(t.dateDebut, t.dateFinApprox);
      let cursor = startOfDay(start);
      const limit = startOfDay(end);
      while (cursor.getTime() <= limit.getTime()) {
        out.push({
          id: `${t.id}-${dayKey(cursor)}`,
          sourceId: t.id,
          type: 'task',
          title: t.nom,
          date: new Date(cursor),
          endDate: end,
          projectId: t.projetId || null,
          projectName: t.projet?.nom,
          assigneesUsers,
          assigneesEntites,
          assigneesClientsFournisseurs,
          epicName: epicName || undefined,
          durationLabel,
          status: t.statut,
          tooltip:
            `${t.nom}\nProjet: ${t.projet?.nom || '—'}\nStatut: ${STATUS_LABEL[t.statut] || t.statut}` +
            `${epicName ? `\nEPIC: ${epicName}` : ''}` +
            `${assigneesUsers.length ? `\nUtilisateurs: ${assigneesUsers.join(', ')}` : ''}` +
            `${assigneesEntites.length ? `\nEntités: ${assigneesEntites.join(', ')}` : ''}` +
            `${assigneesClientsFournisseurs.length ? `\nClients/Fournisseurs: ${assigneesClientsFournisseurs.join(', ')}` : ''}` +
            `${durationLabel ? `\nTemps de réalisation: ${durationLabel}` : ''}`,
        });
        cursor = addDays(cursor, 1);
      }
    }
    for (const n of notifications) {
      out.push({
        id: `n-${n.id}`,
        sourceId: n.id,
        type: 'notification',
        subType: n.type,
        title: n.titre,
        date: startOfDay(new Date(n.createdAt)),
        tooltip: `${n.titre}\n${n.contenu}`,
      });
    }
    if (typeFilter === 'task') return out.filter((e) => e.type === 'task');
    if (typeFilter === 'notification') return out.filter((e) => e.type === 'notification');
    return out;
  }, [tasks, notifications, typeFilter, projectFilter, statusFilter, adminUserFilter]);

  const [rangeStart, rangeEnd] = useMemo(() => {
    const a = startOfDay(anchor);
    if (view === 'day') return [a, endOfDay(a)] as const;
    if (view === 'week') {
      const d = a.getDay() === 0 ? 7 : a.getDay();
      const monday = addDays(a, 1 - d);
      return [monday, endOfDay(addDays(monday, 6))] as const;
    }
    const first = new Date(a.getFullYear(), a.getMonth(), 1);
    const last = new Date(a.getFullYear(), a.getMonth() + 1, 0);
    return [startOfDay(first), endOfDay(last)] as const;
  }, [anchor, view]);

  const daysInRange = useMemo(() => {
    const arr: Date[] = [];
    let cur = startOfDay(rangeStart);
    while (cur.getTime() <= rangeEnd.getTime()) {
      arr.push(new Date(cur));
      cur = addDays(cur, 1);
    }
    return arr;
  }, [rangeStart, rangeEnd]);

  const eventsByDay = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>();
    events.forEach((e) => {
      const k = dayKey(e.date);
      const arr = m.get(k) || [];
      arr.push(e);
      m.set(k, arr);
    });
    return m;
  }, [events]);

  const navigatePeriod = (dir: -1 | 1) => {
    if (view === 'day') setAnchor(addDays(anchor, dir));
    else if (view === 'week') setAnchor(addDays(anchor, 7 * dir));
    else setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + dir, anchor.getDate()));
  };

  const goToday = () => setAnchor(startOfDay(new Date()));

  const resetFilters = () => {
    setTypeFilter('all');
    setProjectFilter('all');
    setStatusFilter('all');
    setAdminUserFilter('all');
  };

  const openEvent = (e: CalendarEvent) => {
    if (e.type === 'task') {
      navigate(`/taches?focusTaskId=${encodeURIComponent(e.sourceId)}`);
      return;
    }
    const notif = notifications.find((n) => n.id === e.sourceId);
    if (!notif) return;
    if (notif.lienType === 'document' && notif.lienId) navigate('/documents');
    else if (notif.lienType === 'projet' && notif.lienId) navigate(`/projets/${notif.lienId}`);
    else if (notif.lienType === 'tache' && notif.lienId) navigate('/taches');
    else navigate('/dashboard');
  };

  const onTaskDropToDay = async (taskId: string, targetDay: Date) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const oldStart = task.dateDebut ? startOfDay(new Date(task.dateDebut)) : startOfDay(new Date());
    const delta = diffDays(targetDay, oldStart);
    if (delta === 0) return;
    const newStart = addDays(oldStart, delta);
    const payload: any = { dateDebut: dayKey(newStart) };
    if (task.dateFinApprox) {
      const oldEnd = startOfDay(new Date(task.dateFinApprox));
      payload.dateFinApprox = dayKey(addDays(oldEnd, delta));
    }
    try {
      await api.put(`/taches/${task.id}`, payload);
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Déplacement impossible');
    }
  };

  const monthGridDays = useMemo(() => {
    if (view !== 'month') return [] as Date[];
    const first = new Date(rangeStart);
    const firstDow = first.getDay() === 0 ? 7 : first.getDay();
    const gridStart = addDays(first, 1 - firstDow);
    return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  }, [view, rangeStart]);

  const renderTaskMeta = (ev: CalendarEvent) => (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {!!ev.epicName && (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-100 text-violet-800 font-semibold tracking-wide">
          EPIC: {ev.epicName}
        </span>
      )}
      {!!ev.assigneesUsers?.length && (
        <span className="text-[10px] px-1 py-0.5 rounded bg-indigo-50 text-indigo-700">
          U: {ev.assigneesUsers.join(', ')}
        </span>
      )}
      {!!ev.assigneesEntites?.length && (
        <span className="text-[10px] px-1 py-0.5 rounded bg-teal-50 text-teal-700">
          E: {ev.assigneesEntites.join(', ')}
        </span>
      )}
      {!!ev.assigneesClientsFournisseurs?.length && (
        <span className="text-[10px] px-1 py-0.5 rounded bg-fuchsia-50 text-fuchsia-700">
          C/F: {ev.assigneesClientsFournisseurs.join(', ')}
        </span>
      )}
      {!!ev.durationLabel && (
        <span className="text-[10px] px-1 py-0.5 rounded bg-gray-100 text-gray-700">
          Durée: {ev.durationLabel}
        </span>
      )}
      {ev.status === 'bloque' && (
        <span className="text-[10px] px-1 py-0.5 rounded bg-red-100 text-red-700 font-semibold">
          En retard
        </span>
      )}
    </div>
  );

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Calendrier</h1>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => navigatePeriod(-1)} className="px-3 py-2 border rounded text-sm">Précédent</button>
          <button onClick={goToday} className="px-3 py-2 border rounded text-sm">Aujourd’hui</button>
          <button onClick={() => navigatePeriod(1)} className="px-3 py-2 border rounded text-sm">Suivant</button>
          <button onClick={() => void load()} className="px-3 py-2 border rounded text-sm">Rafraîchir</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => setView('month')} className={`px-3 py-1.5 rounded text-sm ${view === 'month' ? 'bg-blue-600 text-white' : 'bg-white border'}`}>Mois</button>
        <button onClick={() => setView('week')} className={`px-3 py-1.5 rounded text-sm ${view === 'week' ? 'bg-blue-600 text-white' : 'bg-white border'}`}>Semaine</button>
        <button onClick={() => setView('day')} className={`px-3 py-1.5 rounded text-sm ${view === 'day' ? 'bg-blue-600 text-white' : 'bg-white border'}`}>Jour</button>

        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as CalendarTypeFilter)} className="px-2 py-1.5 border rounded text-sm">
          <option value="all">Type: Tous</option>
          <option value="task">Type: Tâches</option>
          <option value="notification">Type: Notifications</option>
        </select>
        <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className="px-2 py-1.5 border rounded text-sm">
          <option value="all">Projet: Tous</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-2 py-1.5 border rounded text-sm">
          <option value="all">Statut: Tous</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {canFilterByAssignment && (
          <select value={adminUserFilter} onChange={(e) => setAdminUserFilter(e.target.value)} className="px-2 py-1.5 border rounded text-sm">
            <option value="all">Assignation: Tous</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
          </select>
        )}
        <button
          type="button"
          onClick={resetFilters}
          className="px-3 py-1.5 border rounded text-sm bg-white hover:bg-gray-50"
        >
          Réinitialiser filtres
        </button>
      </div>

      <div className="text-xs text-gray-600 mb-3 flex flex-wrap gap-4">
        <span className="inline-flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-blue-500" /> Tâche planifiée (créée/à faire/autre)</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-green-500" /> Tâche active (en cours)</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-orange-400" /> Notification</span>
      </div>

      {loading ? (
        <div className="bg-white border rounded p-6 text-gray-500">Chargement…</div>
      ) : view === 'month' ? (
        <div className="grid grid-cols-7 gap-2">
          {monthGridDays.map((d) => {
            const dayEvents = eventsByDay.get(dayKey(d)) || [];
            const inMonth = d.getMonth() === rangeStart.getMonth();
            return (
              <div
                key={dayKey(d)}
                className={`min-h-[120px] border rounded bg-white p-2 ${inMonth ? '' : 'opacity-50'}`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const taskId = e.dataTransfer.getData('task-id');
                  if (taskId) void onTaskDropToDay(taskId, d);
                }}
              >
                <div className="text-xs font-semibold mb-1">{d.toLocaleDateString('fr-FR')}</div>
                <div className="space-y-1">
                  {dayEvents.map((ev) => {
                    const isTask = ev.type === 'task';
                    const status = ev.status || '';
                    const lineClass = isTask
                      ? status === 'termine'
                        ? 'bg-blue-100 line-through text-gray-500'
                        : status === 'bloque'
                          ? 'bg-red-100 text-red-800'
                          : status === 'en_attente'
                            ? 'bg-yellow-100 text-yellow-800'
                            : status === 'en_cours'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-blue-100 text-blue-900'
                      : 'bg-orange-100 text-orange-900';
                    return (
                      <button
                        key={ev.id}
                        title={ev.tooltip}
                        draggable={isTask}
                        onDragStart={(e) => {
                          if (isTask) e.dataTransfer.setData('task-id', ev.sourceId);
                        }}
                        onClick={() => openEvent(ev)}
                        className={`w-full text-left px-1.5 py-1 rounded text-[11px] ${lineClass}`}
                      >
                        {isTask && ev.status === 'bloque' ? 'Retard · ' : ''}
                        {isTask && ev.status === 'en_attente' ? 'En pause · ' : ''}
                        <span className="font-medium">{ev.title}</span>
                        {ev.projectName ? <span className="text-[10px] text-gray-700"> ({ev.projectName})</span> : null}
                        {isTask && renderTaskMeta(ev)}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white border rounded p-3">
          <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
            {(view === 'day' ? [anchor] : daysInRange).map((d) => {
              const dayEvents = eventsByDay.get(dayKey(d)) || [];
              return (
                <div
                  key={dayKey(d)}
                  className="border rounded p-2 min-h-[280px]"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    const taskId = e.dataTransfer.getData('task-id');
                    if (taskId) void onTaskDropToDay(taskId, d);
                  }}
                >
                  <div className="text-xs font-semibold mb-2">{d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' })}</div>
                  <div className="space-y-1">
                    {dayEvents.map((ev) => (
                      <button
                        key={ev.id}
                        title={ev.tooltip}
                        draggable={ev.type === 'task'}
                        onDragStart={(e) => {
                          if (ev.type === 'task') e.dataTransfer.setData('task-id', ev.sourceId);
                        }}
                        onClick={() => openEvent(ev)}
                        className={`w-full text-left px-2 py-1 rounded text-xs ${ev.type === 'task' ? 'bg-blue-100 text-blue-900' : 'bg-orange-100 text-orange-900'} ${ev.type === 'task' && ev.status === 'termine' ? 'line-through text-gray-500' : ''}`}
                      >
                        <span className="font-medium">{ev.title}</span>
                        {ev.projectName ? <span className="text-[11px] text-gray-700"> ({ev.projectName})</span> : null}
                        {ev.type === 'task' && renderTaskMeta(ev)}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

