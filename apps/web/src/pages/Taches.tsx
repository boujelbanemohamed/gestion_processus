import { useEffect, useState, useRef } from 'react';
import TachesGanttView from '../components/TachesGanttView';
import TachesKanbanView from '../components/TachesKanbanView';
import TachesEnRetardBloc, { type TacheEnRetardItem } from '../components/TachesEnRetardBloc';
import { api, API_BASE_URL } from '../services/api';
import { useAuth } from '../store/auth';

export const STATUT_OPTIONS = [
  { value: 'cree', label: 'Créée', color: 'bg-gray-100 text-gray-700' },
  { value: 'a_faire', label: 'À faire / Non démarré', color: 'bg-slate-100 text-slate-700' },
  { value: 'en_cours', label: 'En cours (Active)', color: 'bg-blue-100 text-blue-700' },
  { value: 'en_attente', label: 'En attente / Suspendu', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'bloque', label: 'Bloqué / En retard', color: 'bg-red-100 text-red-700' },
  { value: 'termine', label: 'Terminé / Finalisé', color: 'bg-green-100 text-green-700' },
  { value: 'archive', label: 'Archivée', color: 'bg-purple-100 text-purple-700' },
];

const LIAISON_TYPES = [
  { value: 'concatenation', label: 'Concaténation (bloquante)' },
  { value: 'simple', label: 'Liaison simple (informative)' },
];

export type Tache = {
  id: string;
  nom: string;
  statut: string;
  dateDebut?: string;
  dateFinApprox?: string;
  createdAt?: string;
  description?: string;
  scenarioExecution?: string;
  critereAcceptation?: string;
  projetId?: string;
  projet?: { id: string; nom: string };
  assignesUtilisateurs?: { id: string; nom: string; prenom: string }[];
  assignesEntites?: { id: string; nom: string }[];
  liaisons?: { id: string; tacheId: string; tacheLieeId: string; type: string; tacheLiee?: { id: string; nom: string; statut: string } }[];
  commentaires?: Commentaire[];
  documents?: DocTache[];
  createurId?: string;
  createur?: { id: string; nom: string; prenom: string };
};

export type DocTache = {
  id: string;
  nom: string;
  typeDocument: string;
  fichierType: string;
  statut: string;
  estConfidentiel: boolean;
  uploadedBy?: { id: string; nom: string; prenom: string };
  permissionsUtilisateurs?: { user: { id: string; nom: string; prenom: string } }[];
};

type Commentaire = {
  id: string;
  contenu: string;
  auteur?: { id: string; nom: string; prenom: string };
  createdAt: string;
  pieceJointe?: string;
  pieceJointeNom?: string;
};

export type UserOption = { id: string; nom: string; prenom: string; role?: string };
export type EntiteOption = { id: string; nom: string };
export type ProjetOption = { id: string; nom: string };

export function StatutBadge({ statut }: { statut: string }) {
  const opt = STATUT_OPTIONS.find(s => s.value === statut);
  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${opt?.color || 'bg-gray-100 text-gray-700'}`}>
      {opt?.label || statut}
    </span>
  );
}

// ─── Avancement (tâches terminées / total) ───────────────────────────────────
/** Pourcentage basé sur le statut « termine », aligné sur le KPI « Terminées » du tableau de bord. */
export function TachesAvancementBlock({ taches }: { taches: Tache[] }) {
  const total = taches.length;
  if (total === 0) return null;
  const terminees = taches.filter((t) => t.statut === 'termine').length;
  const pct = Math.round((terminees / total) * 100);
  return (
    <div
      className="mb-4 rounded-lg border border-teal-100 bg-gradient-to-r from-teal-50/90 to-emerald-50/80 p-4 shadow-sm"
      aria-label="Avancement des tâches"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <span className="text-sm font-semibold text-gray-800">Avancement / réalisation</span>
        <span className="text-xl font-bold text-teal-700 tabular-nums">{pct}%</span>
      </div>
      <div className="h-3 bg-gray-200/90 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      <p className="text-xs text-gray-600 mt-2">
        <span className="tabular-nums font-medium text-gray-800">{terminees}</span> tâche
        {terminees !== 1 ? 's' : ''} terminée{terminees !== 1 ? 's' : ''} sur{' '}
        <span className="tabular-nums font-medium text-gray-800">{total}</span> (statut « Terminé / Finalisé »)
      </p>
    </div>
  );
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────
type AggRow = { nom: string; total: number; terminees: number; retard: number; retardDetails: { nom: string; jours: number }[] };

function accumulateTaskForAgg(
  row: AggRow,
  t: Tache,
  now: Date,
) {
  row.total++;
  if (t.statut === 'termine') row.terminees++;
  if (t.statut === 'bloque' || (t.dateFinApprox && new Date(t.dateFinApprox) < now && t.statut !== 'termine' && t.statut !== 'archive')) {
    row.retard++;
    if (t.dateFinApprox) {
      const jours = Math.floor((now.getTime() - new Date(t.dateFinApprox).getTime()) / (1000 * 3600 * 24));
      row.retardDetails.push({ nom: t.nom, jours });
    }
  }
}

export function TachesDashboard({
  taches,
  showStatutBreakdown,
  showParPersonne,
  hideAvancement,
}: {
  taches: Tache[];
  showStatutBreakdown?: boolean;
  /** Tableau KPI « par personne assignée » (ex. fiche projet) */
  showParPersonne?: boolean;
  /** Si true, ne pas afficher la barre d’avancement (déjà affichée au-dessus, ex. fiche projet) */
  hideAvancement?: boolean;
}) {
  const now = new Date();

  // Tâches par entité
  const byEntite: Record<string, AggRow> = {};

  taches.forEach(t => {
    const entites = t.assignesEntites || [];
    if (entites.length === 0) {
      const key = '__aucune__';
      if (!byEntite[key]) byEntite[key] = { nom: 'Sans entité', total: 0, terminees: 0, retard: 0, retardDetails: [] };
      accumulateTaskForAgg(byEntite[key], t, now);
    } else {
      entites.forEach(e => {
        if (!byEntite[e.id]) byEntite[e.id] = { nom: e.nom, total: 0, terminees: 0, retard: 0, retardDetails: [] };
        accumulateTaskForAgg(byEntite[e.id], t, now);
      });
    }
  });

  // Tâches par personne assignée (même logique KPI que par entité)
  const byPerson: Record<string, AggRow> = {};
  taches.forEach((t) => {
    const assignes = t.assignesUtilisateurs || [];
    if (assignes.length === 0) {
      const key = '__aucun_assigne__';
      if (!byPerson[key]) byPerson[key] = { nom: 'Sans assigné', total: 0, terminees: 0, retard: 0, retardDetails: [] };
      accumulateTaskForAgg(byPerson[key], t, now);
    } else {
      assignes.forEach((u) => {
        if (!byPerson[u.id]) {
          byPerson[u.id] = {
            nom: `${u.prenom} ${u.nom}`.trim() || u.id,
            total: 0,
            terminees: 0,
            retard: 0,
            retardDetails: [],
          };
        }
        accumulateTaskForAgg(byPerson[u.id], t, now);
      });
    }
  });

  const totalTaches = taches.length;
  const terminees = taches.filter(t => t.statut === 'termine').length;
  const enCours = taches.filter(t => t.statut === 'en_cours').length;
  const bloquees = taches.filter(t => t.statut === 'bloque' || (t.dateFinApprox && new Date(t.dateFinApprox) < now && t.statut !== 'termine' && t.statut !== 'archive')).length;

  return (
    <div className="mb-6">
      {!hideAvancement && <TachesAvancementBlock taches={taches} />}
      {/* KPIs globaux */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-3xl font-bold text-gray-800">{totalTaches}</div>
          <div className="text-sm text-gray-500 mt-1">Total tâches</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-3xl font-bold text-green-600">{terminees}</div>
          <div className="text-sm text-gray-500 mt-1">Terminées</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-3xl font-bold text-blue-600">{enCours}</div>
          <div className="text-sm text-gray-500 mt-1">En cours</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-3xl font-bold text-red-600">{bloquees}</div>
          <div className="text-sm text-gray-500 mt-1">En retard / Bloquées</div>
        </div>
      </div>

      {showStatutBreakdown && (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Répartition par statut</h3>
          <div className="flex flex-wrap gap-2">
            {STATUT_OPTIONS.map((s) => {
              const n = taches.filter((t) => t.statut === s.value).length;
              return (
                <div
                  key={s.value}
                  className={`px-3 py-2 rounded-lg text-sm font-medium ${s.color} border border-gray-100`}
                >
                  {s.label}: <span className="tabular-nums">{n}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tableau par entité */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b bg-gray-50">
          <h2 className="text-base font-semibold text-gray-700">📊 Tâches par entité</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entité</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Total</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Terminées</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">En retard</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Détail retard</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {Object.values(byEntite).sort((a, b) => b.total - a.total).map((e, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{e.nom}</td>
                  <td className="px-4 py-3 text-center">{e.total}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-green-600 font-medium">{e.terminees}</span>
                    <span className="text-gray-400 text-xs ml-1">({e.total > 0 ? Math.round(e.terminees / e.total * 100) : 0}%)</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {e.retard > 0 ? <span className="text-red-600 font-medium">{e.retard}</span> : <span className="text-gray-400">0</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {e.retardDetails.length > 0
                      ? e.retardDetails.map((d, j) => (
                          <div key={j}><span className="font-medium">{d.nom}</span> — <span className="text-red-500">{d.jours}j de retard</span></div>
                        ))
                      : '—'}
                  </td>
                </tr>
              ))}
              {Object.keys(byEntite).length === 0 && (
                <tr><td colSpan={5} className="text-center py-6 text-gray-400">Aucune donnée</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showParPersonne && (
        <div className="bg-white rounded-lg shadow overflow-hidden mt-6">
          <div className="p-4 border-b bg-gray-50">
            <h2 className="text-base font-semibold text-gray-700">👤 Tâches par personne (assignés)</h2>
            <p className="text-xs text-gray-500 mt-1">
              Une même tâche avec plusieurs assignés est comptée pour chacun, comme pour les entités.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Personne</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Terminées</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">En retard</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Détail retard</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {Object.values(byPerson)
                  .sort((a, b) => b.total - a.total)
                  .map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{row.nom}</td>
                      <td className="px-4 py-3 text-center">{row.total}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-green-600 font-medium">{row.terminees}</span>
                        <span className="text-gray-400 text-xs ml-1">
                          ({row.total > 0 ? Math.round((row.terminees / row.total) * 100) : 0}%)
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.retard > 0 ? (
                          <span className="text-red-600 font-medium">{row.retard}</span>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {row.retardDetails.length > 0
                          ? row.retardDetails.map((d, j) => (
                              <div key={j}>
                                <span className="font-medium">{d.nom}</span> —{' '}
                                <span className="text-red-500">{d.jours}j de retard</span>
                              </div>
                            ))
                          : '—'}
                      </td>
                    </tr>
                  ))}
                {Object.keys(byPerson).length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-gray-400">
                      Aucune donnée
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Modal Création / Édition ─────────────────────────────────────────────────
export function TacheModal({
  onClose, onSave, projets, users, entites, taches, editTache, lockProjetId,
}: {
  onClose: () => void;
  onSave: () => void;
  projets: ProjetOption[];
  users: UserOption[];
  entites: EntiteOption[];
  taches: Tache[];
  editTache?: Tache;
  /** Si défini, le projet de la tâche est fixé (ex. création depuis la fiche projet). */
  lockProjetId?: string;
}) {
  const { user: currentUser } = useAuth();
  const [form, setForm] = useState({
    nom: editTache?.nom || '',
    statut: editTache?.statut || 'cree',
    dateDebut: editTache?.dateDebut ? editTache.dateDebut.split('T')[0] : '',
    dateFinApprox: editTache?.dateFinApprox ? editTache.dateFinApprox.split('T')[0] : '',
    description: editTache?.description || '',
    scenarioExecution: editTache?.scenarioExecution || '',
    critereAcceptation: editTache?.critereAcceptation || '',
    projetId: editTache?.projetId || lockProjetId || '',
  });
  const [selectedUsers, setSelectedUsers] = useState<string[]>(
    editTache?.assignesUtilisateurs?.map(u => u.id) || []
  );
  const [selectedEntites, setSelectedEntites] = useState<string[]>(
    editTache?.assignesEntites?.map(e => e.id) || []
  );
  const [liaisons, setLiaisons] = useState<{ tacheLieeId: string; type: string }[]>(
    editTache?.liaisons?.map(l => ({ tacheLieeId: l.tacheLieeId, type: l.type })) || []
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggleUser = (id: string) =>
    setSelectedUsers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleEntite = (id: string) =>
    setSelectedEntites(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const addLiaison = () => setLiaisons(prev => [...prev, { tacheLieeId: '', type: 'simple' }]);
  const removeLiaison = (i: number) => setLiaisons(prev => prev.filter((_, j) => j !== i));
  const updateLiaison = (i: number, field: string, value: string) =>
    setLiaisons(prev => prev.map((l, j) => j === i ? { ...l, [field]: value } : l));

  const handleSave = async () => {
    setError('');
    if (!form.nom.trim()) { setError('Le nom de la tâche est obligatoire'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        assignesUtilisateurIds: selectedUsers,
        assignesEntiteIds: selectedEntites,
        liaisons: liaisons.filter(l => l.tacheLieeId),
      };
      if (editTache) {
        await api.put(`/taches/${editTache.id}`, payload);
      } else {
        await api.post('/taches', payload);
      }
      onSave();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const autresTaches = taches.filter(t => t.id !== editTache?.id);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">
        <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
        <div className="p-6">
          <h2 className="text-xl font-bold mb-5">{editTache ? 'Modifier la tâche' : 'Nouvelle tâche'}</h2>
          {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}

          <div className="space-y-4">
            {/* Nom */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom de la tâche <span className="text-red-500">*</span></label>
              <input type="text" value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />
            </div>

            {/* Statut */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
              <select value={form.statut} onChange={e => setForm({ ...form, statut: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md">
                {STATUT_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>

            {/* Projet */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Projet associé</label>
              <select
                value={form.projetId}
                onChange={e => setForm({ ...form, projetId: e.target.value })}
                disabled={!!lockProjetId}
                className="w-full px-3 py-2 border border-gray-300 rounded-md disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="">— Aucun projet —</option>
                {projets.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
              </select>
              {lockProjetId && (
                <p className="text-xs text-gray-500 mt-1">Projet imposé par le contexte (fiche projet).</p>
              )}
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date de début</label>
                <input type="date" value={form.dateDebut} onChange={e => setForm({ ...form, dateDebut: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date de fin approximative</label>
                <input type="date" value={form.dateFinApprox} onChange={e => setForm({ ...form, dateFinApprox: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
            </div>

            {/* Utilisateurs assignés */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Utilisateurs assignés</label>
              <div className="border border-gray-300 rounded-md max-h-36 overflow-y-auto p-2 space-y-1">
                {users.map(u => (
                  <label key={u.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-2 py-1 rounded">
                    <input type="checkbox" checked={selectedUsers.includes(u.id)} onChange={() => toggleUser(u.id)} className="rounded" />
                    <span className="text-sm">{u.prenom} {u.nom}</span>
                  </label>
                ))}
                {users.length === 0 && <p className="text-sm text-gray-400 px-2">Aucun utilisateur disponible</p>}
              </div>
            </div>

            {/* Entités assignées */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Entités assignées</label>
              <div className="border border-gray-300 rounded-md max-h-36 overflow-y-auto p-2 space-y-1">
                {entites.map(e => (
                  <label key={e.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-2 py-1 rounded">
                    <input type="checkbox" checked={selectedEntites.includes(e.id)} onChange={() => toggleEntite(e.id)} className="rounded" />
                    <span className="text-sm">{e.nom}</span>
                  </label>
                ))}
                {entites.length === 0 && <p className="text-sm text-gray-400 px-2">Aucune entité disponible</p>}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md resize-y" placeholder="Description de la tâche..." />
            </div>

            {/* Scénario d'exécution */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Scénario d'exécution</label>
              <textarea rows={3} value={form.scenarioExecution} onChange={e => setForm({ ...form, scenarioExecution: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md resize-y" placeholder="Étapes d'exécution..." />
            </div>

            {/* Critère d'acceptation */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Critère d'acceptation</label>
              <textarea rows={3} value={form.critereAcceptation} onChange={e => setForm({ ...form, critereAcceptation: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md resize-y" placeholder="Conditions pour considérer la tâche terminée..." />
            </div>

            {/* Liaisons avec d'autres tâches */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">Liaisons avec d'autres tâches</label>
                <button type="button" onClick={addLiaison}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium">+ Ajouter</button>
              </div>
              {liaisons.map((l, i) => (
                <div key={i} className="flex gap-2 mb-2 items-center">
                  <select value={l.tacheLieeId} onChange={e => updateLiaison(i, 'tacheLieeId', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm">
                    <option value="">— Sélectionner une tâche —</option>
                    {autresTaches.map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}
                  </select>
                  <select value={l.type} onChange={e => updateLiaison(i, 'type', e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm">
                    {LIAISON_TYPES.map(lt => <option key={lt.value} value={lt.value}>{lt.label}</option>)}
                  </select>
                  <button type="button" onClick={() => removeLiaison(i)}
                    className="text-red-500 hover:text-red-700 font-bold text-lg leading-none">×</button>
                </div>
              ))}
              {liaisons.length === 0 && <p className="text-sm text-gray-400">Aucune liaison définie</p>}
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
            <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">
              Annuler
            </button>
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Enregistrement...' : (editTache ? 'Mettre à jour' : 'Créer')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Zone Commentaires ────────────────────────────────────────────────────────
function CommentairesSection({ tacheId, users }: { tacheId: string; users: UserOption[] }) {
  const { user: currentUser } = useAuth();
  const [commentaires, setCommentaires] = useState<Commentaire[]>([]);
  const [texte, setTexte] = useState('');
  const [sending, setSending] = useState(false);
  const [fichier, setFichier] = useState<File | null>(null);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadCommentaires(); }, [tacheId]);

  const loadCommentaires = async () => {
    try {
      const res = await api.get(`/taches/${tacheId}/commentaires`);
      setCommentaires(res.data);
    } catch {
      // silencieux
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setTexte(val);
    const lastAt = val.lastIndexOf('@');
    if (lastAt !== -1 && lastAt === val.length - 1) {
      setShowMentions(true);
      setMentionSearch('');
    } else if (lastAt !== -1 && val.slice(lastAt + 1).match(/^\w*$/)) {
      setShowMentions(true);
      setMentionSearch(val.slice(lastAt + 1));
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (u: UserOption) => {
    const lastAt = texte.lastIndexOf('@');
    const newTexte = texte.slice(0, lastAt) + `@${u.prenom} ${u.nom} `;
    setTexte(newTexte);
    setShowMentions(false);
    textareaRef.current?.focus();
  };

  const filteredMentions = users.filter(u =>
    `${u.prenom} ${u.nom}`.toLowerCase().includes(mentionSearch.toLowerCase())
  );

  const handleSend = async () => {
    if (!texte.trim() && !fichier) return;
    setSending(true);
    try {
      const formData = new FormData();
      formData.append('contenu', texte.trim());
      if (fichier) formData.append('fichier', fichier);
      await api.post(`/taches/${tacheId}/commentaires`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setTexte('');
      setFichier(null);
      if (fileRef.current) fileRef.current.value = '';
      await loadCommentaires();
    } catch {
      // silencieux
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-3">💬 Commentaires</h3>
      <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
        {commentaires.length === 0 && <p className="text-sm text-gray-400">Aucun commentaire</p>}
        {commentaires.map(c => (
          <div key={c.id} className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">
                {c.auteur?.prenom?.[0]}{c.auteur?.nom?.[0]}
              </div>
              <span className="text-xs font-medium text-gray-700">{c.auteur?.prenom} {c.auteur?.nom}</span>
              <span className="text-xs text-gray-400">{new Date(c.createdAt).toLocaleString('fr-FR')}</span>
            </div>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.contenu}</p>
            {c.pieceJointeNom && (
              <a href={`${API_BASE_URL}/taches/${tacheId}/commentaires/${c.id}/fichier?token=${localStorage.getItem('token')}`}
                target="_blank" rel="noreferrer"
                className="text-xs text-blue-600 hover:underline mt-1 block">
                📎 {c.pieceJointeNom}
              </a>
            )}
          </div>
        ))}
      </div>
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={texte}
          onChange={handleTextChange}
          rows={2}
          placeholder="Ajouter un commentaire... (utilisez @ pour mentionner)"
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm resize-none focus:ring-blue-500 focus:border-blue-500"
        />
        {showMentions && filteredMentions.length > 0 && (
          <div className="absolute bottom-full left-0 bg-white border border-gray-200 rounded-md shadow-lg z-10 max-h-40 overflow-y-auto w-64">
            {filteredMentions.map(u => (
              <button key={u.id} onClick={() => insertMention(u)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 hover:text-blue-700">
                {u.prenom} {u.nom}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" className="hidden" onChange={e => setFichier(e.target.files?.[0] || null)} />
          <button onClick={() => fileRef.current?.click()}
            className="text-xs text-gray-500 hover:text-blue-600 border border-gray-300 rounded px-2 py-1">
            📎 {fichier ? fichier.name : 'Pièce jointe'}
          </button>
          {fichier && (
            <button onClick={() => { setFichier(null); if (fileRef.current) fileRef.current.value = ''; }}
              className="text-xs text-red-500 hover:text-red-700">✕</button>
          )}
        </div>
        <button onClick={handleSend} disabled={sending || (!texte.trim() && !fichier)}
          className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50">
          {sending ? 'Envoi...' : 'Envoyer'}
        </button>
      </div>
    </div>
  );
}


// ── Calcul des personnes ayant accès à une tâche ─────────────────────────────
// ── Calcul des personnes ayant accès à une tâche ─────────────────────────────
function getNiveauAcces(droit: string): number {
  if (droit.includes('modification + acces') || droit.includes('modification + accès')) return 3;
  if (droit.includes('modification')) return 2;
  return 1;
}

function getAccesPersonnes(tache: Tache, allUsers: UserOption[]) {
  const personnesMap = new Map<string, { id: string; nom: string; roles: string[]; meilleurAcces: string }>();

  const add = (id: string, nom: string, role: string, acces: string) => {
    if (personnesMap.has(id)) {
      const p = personnesMap.get(id)!;
      if (!p.roles.includes(role)) p.roles.push(role);
      if (getNiveauAcces(acces) > getNiveauAcces(p.meilleurAcces)) {
        p.meilleurAcces = acces;
      }
    } else {
      personnesMap.set(id, { id, nom, roles: [role], meilleurAcces: acces });
    }
  };

  // 1. Admins
  allUsers.filter(u => (u as any).role === 'admin').forEach(u =>
    add(u.id, `${(u as any).prenom} ${u.nom}`, 'Admin', 'modification + accès + lecture')
  );

  // 2. Assignés à la tâche
  (tache.assignesUtilisateurs || []).forEach(u =>
    add(u.id, `${u.prenom} ${u.nom}`, 'Assigné à la tâche', 'modification + lecture')
  );

  // 3. Membres du projet
  if ((tache as any).projet) {
    const projet = (tache as any).projet;
    (projet.equipe || []).forEach((m: any) => {
      const u = m.user || m;
      if (u?.id) add(u.id, `${u.prenom} ${u.nom}`, 'Équipe projet', 'lecture');
    });
    (projet.chefsProjet || []).forEach((m: any) => {
      const u = m.user || m;
      if (u?.id) add(u.id, `${u.prenom} ${u.nom}`, 'Chef de projet / PMO', 'lecture');
    });
    (projet.sponsors || []).forEach((m: any) => {
      const u = m.user || m;
      if (u?.id) add(u.id, `${u.prenom} ${u.nom}`, 'Sponsor / Superviseur', 'lecture');
    });
    (projet.techLeads || []).forEach((m: any) => {
      const u = m.user || m;
      if (u?.id) add(u.id, `${u.prenom} ${u.nom}`, 'Tech Lead', 'lecture');
    });
  }

  // 4. Membres des entités assignées
  (tache.assignesEntites || []).forEach((e: any) => {
    (e.membres || []).forEach((m: any) => {
      const u = m.user || m;
      if (u?.id) add(u.id, `${u.prenom} ${u.nom}`, `Membre de ${e.nom}`, 'lecture');
    });
  });

  return Array.from(personnesMap.values()).map(p => ({
    id: p.id,
    nom: p.nom,
    roles: p.roles,
    droit: p.meilleurAcces,
  }));
}




// ── Calcul des accès d'un document lié ───────────────────────────────────────
function getAccesDocument(doc: DocTache) {
  const personnes: { nom: string; droit: string }[] = [];
  const seen = new Set<string>();

  const add = (id: string, nom: string, droit: string) => {
    if (!seen.has(id)) { seen.add(id); personnes.push({ nom, droit }); }
  };

  if (doc.uploadedBy) {
    add(doc.uploadedBy.id, `${doc.uploadedBy.prenom} ${doc.uploadedBy.nom}`, 'Créateur : modification statut + accès + lecture');
  }

  if (doc.estConfidentiel) {
    (doc.permissionsUtilisateurs || []).forEach(p => {
      add(p.user.id, `${p.user.prenom} ${p.user.nom}`, 'Lecture : lecture');
    });
  }

  return personnes;
}

// ── Section Documents d'une Tâche ─────────────────────────────────────────────
function DocumentsTache({ tacheId, documents, canEdit }: {
  tacheId: string;
  documents: DocTache[];
  canEdit: boolean;
}) {
  const [docs, setDocs] = useState<DocTache[]>(documents);
  const [showUpload, setShowUpload] = useState(false);
  const [showLier, setShowLier] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadNom, setUploadNom] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [searchDoc, setSearchDoc] = useState('');
  const [docsLiables, setDocsLiables] = useState<DocTache[]>([]);
  const [selectedDocId, setSelectedDocId] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDocs(documents); }, [documents]);

  const loadDocsLiables = async () => {
    try {
      const res = await api.get(`/taches/documents-liables?search=${searchDoc}`);
      setDocsLiables(res.data);
    } catch { /* silencieux */ }
  };

  useEffect(() => { if (showLier) loadDocsLiables(); }, [showLier, searchDoc]);

  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('fichier', uploadFile);
      formData.append('nom', uploadNom || uploadFile.name);
      formData.append('description', uploadDesc);
      const res = await api.post(`/taches/${tacheId}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setDocs(prev => [...prev, res.data]);
      setShowUpload(false); setUploadFile(null); setUploadNom(''); setUploadDesc('');
    } catch (e: any) { alert(e.response?.data?.error || 'Erreur upload'); }
    finally { setUploading(false); }
  };

  const handleLier = async () => {
    if (!selectedDocId) return;
    try {
      await api.post(`/taches/${tacheId}/documents/lier`, { documentId: selectedDocId });
      const doc = docsLiables.find(d => d.id === selectedDocId);
      if (doc) setDocs(prev => [...prev, doc]);
      setShowLier(false); setSelectedDocId('');
    } catch (e: any) { alert(e.response?.data?.error || 'Erreur liaison'); }
  };

  const handleDelier = async (documentId: string) => {
    if (!confirm('Délier ce document ?')) return;
    try {
      await api.delete(`/taches/${tacheId}/documents/${documentId}`);
      setDocs(prev => prev.filter(d => d.id !== documentId));
    } catch (e: any) { alert(e.response?.data?.error || 'Erreur'); }
  };

  const getFileIcon = (type: string) => {
    if (type?.includes('pdf')) return '📄';
    if (type?.includes('image')) return '🖼️';
    if (type?.includes('word') || type?.includes('doc')) return '📝';
    if (type?.includes('excel') || type?.includes('sheet')) return '📊';
    return '📎';
  };

  const getAccesDoc = (doc: DocTache) => {
    if (!doc.estConfidentiel) return null;
    const membres: string[] = [];
    if (doc.uploadedBy) membres.push(`${doc.uploadedBy.prenom} ${doc.uploadedBy.nom} (Uploadeur)`);
    (doc.permissionsUtilisateurs || []).forEach(p => membres.push(`${p.user.prenom} ${p.user.nom}`));
    return membres;
  };

  return (
    <div className="border-t border-gray-100 pt-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-gray-500 uppercase">📎 Documents ({docs.length})</h4>
        {canEdit && (
          <div className="flex gap-2">
            <button onClick={() => { setShowUpload(!showUpload); setShowLier(false); }}
              className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 border border-blue-200">
              ⬆ Uploader
            </button>
            <button onClick={() => { setShowLier(!showLier); setShowUpload(false); }}
              className="text-xs px-2 py-1 bg-purple-50 text-purple-600 rounded hover:bg-purple-100 border border-purple-200">
              🔗 Lier
            </button>
          </div>
        )}
      </div>

      {showUpload && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3 space-y-2">
          <input type="text" value={uploadNom} onChange={e => setUploadNom(e.target.value)}
            placeholder="Nom du document" className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm" />
          <input type="text" value={uploadDesc} onChange={e => setUploadDesc(e.target.value)}
            placeholder="Description (optionnel)" className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm" />
          <div className="flex items-center gap-2 flex-wrap">
            <input ref={fileRef} type="file" className="hidden" onChange={e => setUploadFile(e.target.files?.[0] || null)} />
            <button onClick={() => fileRef.current?.click()}
              className="text-xs px-3 py-1.5 border border-gray-300 rounded bg-white hover:bg-gray-50">
              {uploadFile ? uploadFile.name : '📎 Choisir un fichier'}
            </button>
            <button onClick={handleUpload} disabled={!uploadFile || uploading}
              className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
              {uploading ? 'Upload...' : 'Uploader'}
            </button>
            <button onClick={() => setShowUpload(false)} className="text-xs text-gray-500">Annuler</button>
          </div>
        </div>
      )}

      {showLier && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-3 space-y-2">
          <input type="text" value={searchDoc} onChange={e => setSearchDoc(e.target.value)}
            placeholder="Rechercher (projet, processus, contrat)..."
            className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm" />
          <div className="max-h-40 overflow-y-auto space-y-1">
            {docsLiables.map(d => (
              <div key={d.id} onClick={() => setSelectedDocId(d.id)}
                className={`flex items-center justify-between p-2 rounded cursor-pointer border ${selectedDocId === d.id ? 'bg-purple-100 border-purple-400' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                <div className="flex items-center gap-2">
                  <span>{getFileIcon(d.fichierType)}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{d.nom}</p>
                    <p className="text-xs text-gray-500 capitalize">{d.typeDocument} {d.estConfidentiel && '🔒'}</p>
                  </div>
                </div>
              </div>
            ))}
            {docsLiables.length === 0 && <p className="text-sm text-gray-400 text-center py-2">Aucun document</p>}
          </div>
          {selectedDocId && (() => {
            const doc = docsLiables.find(d => d.id === selectedDocId);
            const acces = doc ? getAccesDoc(doc) : null;
            if (!acces) return null;
            return (
              <div className="bg-red-50 border border-red-200 rounded p-2">
                <p className="text-xs font-medium text-red-700 mb-1">🔒 Accès restreint :</p>
                {acces.map((m, i) => <p key={i} className="text-xs text-red-600">• {m}</p>)}
              </div>
            );
          })()}
          <div className="flex gap-2">
            <button onClick={handleLier} disabled={!selectedDocId}
              className="text-xs px-3 py-1.5 bg-purple-600 text-white rounded disabled:opacity-50">Lier</button>
            <button onClick={() => setShowLier(false)} className="text-xs text-gray-500">Annuler</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {docs.length === 0 && <p className="text-sm text-gray-400">Aucun document lié</p>}
        {docs.map(doc => {
          const accesPersonnes = getAccesDocument(doc);
          return (
            <div key={doc.id} className="bg-white border border-gray-200 rounded-lg p-3">
              {/* En-tête document */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <span className="text-lg">{getFileIcon(doc.fichierType)}</span>
                  <div className="min-w-0">
                    <a href={`${API_BASE_URL}/documents/${doc.id}/view?token=${localStorage.getItem('token')}`}
                      target="_blank" rel="noreferrer"
                      className="text-sm font-medium text-blue-600 hover:underline truncate block">{doc.nom}</a>
                    <div className="flex gap-2 flex-wrap mt-0.5">
                      <span className="text-xs text-gray-500 capitalize">{doc.typeDocument}</span>
                      <span className="text-xs bg-green-100 text-green-700 px-1.5 rounded">{doc.statut}</span>
                    </div>
                  </div>
                </div>
                {canEdit && (
                  <button onClick={() => handleDelier(doc.id)} className="text-xs text-red-500 hover:text-red-700 shrink-0">Délier</button>
                )}
              </div>

              {/* Section Accès du document */}
              <div className="border-t border-gray-100 pt-2 mt-2">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Accès :</p>
                <div className="flex items-start gap-3 flex-wrap">
                  {/* Badge accès restreint ou libre */}
                  {doc.estConfidentiel ? (
                    <div className="flex flex-col items-center">
                      <div className="w-14 h-14 bg-red-100 border border-red-300 rounded-lg flex flex-col items-center justify-center">
                        <span className="text-xl">🔒</span>
                      </div>
                      <span className="text-xs text-red-600 font-medium mt-1">Accès restreint</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <div className="w-14 h-14 bg-green-100 border border-green-300 rounded-lg flex flex-col items-center justify-center">
                        <span className="text-xl">🌐</span>
                      </div>
                      <span className="text-xs text-green-600 font-medium mt-1">Accès libre</span>
                    </div>
                  )}
                  {/* Personnes avec accès */}
                  {accesPersonnes.map((p, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                        {p.nom.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-800">{p.nom}</p>
                        <p className="text-xs text-gray-500 italic">({p.droit})</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Carte Tâche ─────────────────────────────────────────────────────────────
export function TacheCard({
  tache, onEdit, canEdit, users, currentUserRole, allUsers
}: {
  tache: Tache;
  onEdit: () => void;
  canEdit: boolean;
  users: UserOption[];
  currentUserRole: string;
  allUsers: UserOption[];
}) {
  const [expanded, setExpanded] = useState(false);
  const now = new Date();
  const isLate = tache.dateFinApprox && new Date(tache.dateFinApprox) < now && tache.statut !== 'termine' && tache.statut !== 'archive';

  return (
    <div className={`bg-white border rounded-lg shadow-sm overflow-hidden ${isLate ? 'border-red-300' : 'border-gray-200'}`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-semibold text-gray-800 truncate">{tache.nom}</span>
              <StatutBadge statut={tache.statut} />
              {isLate && <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">⚠ En retard</span>}
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-gray-500">
              {tache.projet && <span>📁 {tache.projet.nom}</span>}
              {tache.dateDebut && <span>🗓 {new Date(tache.dateDebut).toLocaleDateString('fr-FR')}</span>}
              {tache.dateFinApprox && <span>⏰ {new Date(tache.dateFinApprox).toLocaleDateString('fr-FR')}</span>}
              {tache.createur && <span>👤 {tache.createur.prenom} {tache.createur.nom}</span>}
            </div>
            {(tache.assignesUtilisateurs?.length || 0) > 0 && (
              <div className="flex gap-1 mt-2 flex-wrap">
                {tache.assignesUtilisateurs?.map(u => (
                  <span key={u.id} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs">{u.prenom} {u.nom}</span>
                ))}
              </div>
            )}
            {(tache.assignesEntites?.length || 0) > 0 && (
              <div className="flex gap-1 mt-1 flex-wrap">
                {tache.assignesEntites?.map(e => (
                  <span key={e.id} className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full text-xs">🏢 {e.nom}</span>
                ))}
              </div>
            )}
            {/* Liaisons */}
            {(tache.liaisons?.length || 0) > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {tache.liaisons?.map(l => (
                  <span key={l.id} className={`text-xs px-2 py-0.5 rounded-full ${l.type === 'concatenation' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>
                    {l.type === 'concatenation' ? '🔗' : '↔'} {l.tacheLiee?.nom}
                    {l.type === 'concatenation' && l.tacheLiee?.statut !== 'termine' && (
                      <span className="ml-1 text-red-500">(non terminée)</span>
                    )}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-2 shrink-0 items-start flex-wrap justify-end">
            {/* Badge droits */}
            {canEdit ? (
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium" title="Vous pouvez modifier cette tâche">
                ✏️ Modification
              </span>
            ) : (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium" title="Vous avez uniquement accès en lecture">
                👁 Lecture seule
              </span>
            )}
            {canEdit && (
              <button onClick={onEdit} className="text-xs px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50 text-gray-600">
                ✏️ Modifier
              </button>
            )}
            <button onClick={() => setExpanded(!expanded)}
              className="text-xs px-3 py-1.5 border border-blue-300 rounded hover:bg-blue-50 text-blue-600">
              {expanded ? '▲ Réduire' : '▼ Détails'}
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-4">
          {tache.description && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Description</h4>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{tache.description}</p>
            </div>
          )}
          {tache.scenarioExecution && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Scénario d'exécution</h4>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{tache.scenarioExecution}</p>
            </div>
          )}
          {tache.critereAcceptation && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Critère d'acceptation</h4>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{tache.critereAcceptation}</p>
            </div>
          )}
          {/* Section Documents */}
          <DocumentsTache tacheId={tache.id} documents={tache.documents || []} canEdit={canEdit} />

          {/* Section Accès */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Accès</h4>
            <div className="flex flex-wrap gap-3">
              {getAccesPersonnes(tache, allUsers).map((p: {id: string; nom: string; roles: string[]; droit: string}) => (
                <div key={p.id} className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full text-white flex items-center justify-center text-xs font-bold shrink-0 ${p.droit.includes('modification + accès') ? 'bg-blue-600' : p.droit.includes('modification') ? 'bg-green-600' : 'bg-gray-400'}`}>
                    {p.nom.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-800">{p.nom}</p>
                    <p className="text-xs text-gray-400">{p.roles.join(' · ')}</p>
                    <p className={`text-xs font-medium ${p.droit.includes('modification + accès') ? 'text-blue-600' : p.droit.includes('modification') ? 'text-green-600' : 'text-gray-500'}`}>
                      {p.droit}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <CommentairesSection tacheId={tache.id} users={users} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page Principale ──────────────────────────────────────────────────────────
export default function Taches() {
  const { user: currentUser } = useAuth();
  const [taches, setTaches] = useState<Tache[]>([]);
  const [tachesEnRetard, setTachesEnRetard] = useState<TacheEnRetardItem[]>([]);
  const [projets, setProjets] = useState<ProjetOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [entites, setEntites] = useState<EntiteOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTache, setEditTache] = useState<Tache | undefined>();
  const [showDashboard, setShowDashboard] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'gantt' | 'kanban'>('list');
  const [filters, setFilters] = useState({ nom: '', statut: '', projetId: '', assigneIds: [] as string[], entiteIds: [] as string[], dateDebutFrom: '', dateDebutTo: '', dateFinFrom: '', dateFinTo: '' });
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const isAdmin = currentUser?.role === 'admin';
  const isContributeur = currentUser?.role === 'contributeur';
  const isLecteur = currentUser?.role === 'lecteur';

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [filters]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [tRes, pRes, uRes, eRes, retardRes] = await Promise.all([
        api.get('/taches'),
        api.get('/projets'),
        api.get('/users'),
        api.get('/entites'),
        api.get('/dashboard/taches-en-retard').catch(() => ({ data: [] as TacheEnRetardItem[] })),
      ]);
      setTaches(tRes.data);
      setProjets(pRes.data);
      setUsers(uRes.data);
      setEntites(eRes.data);
      setTachesEnRetard(Array.isArray(retardRes.data) ? retardRes.data : []);
    } catch (err) {
      console.error('Erreur chargement:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleKanbanMove = async (tacheId: string, newStatut: string) => {
    try {
      await api.put(`/taches/${tacheId}`, { statut: newStatut });
      const tRes = await api.get('/taches');
      setTaches(tRes.data);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Impossible de mettre à jour le statut');
      throw err;
    }
  };

  const canEdit = (tache: Tache) => {
    if (isAdmin || isContributeur) return true;
    return false;
  };

  const canCreate = isAdmin || isContributeur || !!currentUser;

  // Filtrage selon rôle + filtres UI
  const visibleTaches = taches.filter(t => {
    // Filtre rôle
    if (isAdmin) {
      // voit tout
    } else if (isLecteur) {
      if (t.createurId !== currentUser?.id &&
        !(t.assignesUtilisateurs?.some(u => u.id === currentUser?.id))) return false;
    } else if (isContributeur) {
      // voit ses tâches + tâches des projets dont il est membre
      const isSien = t.createurId === currentUser?.id ||
        t.assignesUtilisateurs?.some(u => u.id === currentUser?.id);
      if (!isSien) return false;
    }

    // Filtres UI
    if (filters.projetId && t.projetId !== filters.projetId) return false;
    if (filters.assigneIds.length > 0 && !filters.assigneIds.every(id => t.assignesUtilisateurs?.some(u => u.id === id))) return false;
    if (filters.entiteIds.length > 0 && !filters.entiteIds.every(id => t.assignesEntites?.some(e => e.id === id))) return false;
    if (filters.nom && !t.nom.toLowerCase().includes(filters.nom.toLowerCase())) return false;
    if (filters.statut && t.statut !== filters.statut) return false;
    if (filters.dateDebutFrom && t.dateDebut && new Date(t.dateDebut) < new Date(filters.dateDebutFrom)) return false;
    if (filters.dateDebutTo && t.dateDebut && new Date(t.dateDebut) > new Date(filters.dateDebutTo)) return false;
    if (filters.dateFinFrom && t.dateFinApprox && new Date(t.dateFinApprox) < new Date(filters.dateFinFrom)) return false;
    if (filters.dateFinTo && t.dateFinApprox && new Date(t.dateFinApprox) > new Date(filters.dateFinTo)) return false;

    return true;
  });

  const totalPages = Math.max(1, Math.ceil(visibleTaches.length / pageSize));
  const pagedTaches = visibleTaches.slice((page - 1) * pageSize, page * pageSize);

  if (loading) return <div className="p-6 text-gray-500">Chargement des tâches...</div>;

  return (
    <div className="p-6">
      {/* En-tête */}
      <div className="flex flex-wrap justify-between items-center mb-6 gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Tâches</h1>
          <p className="text-xs text-gray-500 mt-1">
            Vues : <span className="font-medium text-gray-700">Liste</span>,{' '}
            <span className="font-medium text-gray-700">Kanban</span> (glisser-déposer du statut),{' '}
            <span className="font-medium text-gray-700">Gantt</span>.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex rounded-lg border border-gray-300 overflow-hidden shadow-sm">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`px-3 py-2 text-sm font-medium ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
            >
              Liste
            </button>
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-2 text-sm font-medium border-l border-gray-300 ${viewMode === 'kanban' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
            >
              Kanban
            </button>
            <button
              type="button"
              onClick={() => setViewMode('gantt')}
              className={`px-3 py-2 text-sm font-medium border-l border-gray-300 ${viewMode === 'gantt' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
            >
              Gantt
            </button>
          </div>
          <button onClick={() => setShowDashboard(!showDashboard)}
            className={`px-4 py-2 rounded border text-sm font-medium transition-colors ${showDashboard ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
            {showDashboard ? '📊 Masquer dashboard' : '📊 Dashboard'}
          </button>
          {canCreate && (
            <button onClick={() => { setEditTache(undefined); setShowModal(true); }}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium">
              + Nouvelle tâche
            </button>
          )}
        </div>
      </div>

      {/* Dashboard */}
      {showDashboard && <TachesDashboard taches={visibleTaches} />}

      {/* Filtres */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

          {/* Projet */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Projet</label>
            <select value={filters.projetId} onChange={e => setFilters({ ...filters, projetId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
              <option value="">Tous les projets</option>
              {projets.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
            </select>
          </div>

          {/* Assigné à (multi) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Assigné à {filters.assigneIds.length > 0 && <span className="text-blue-600">({filters.assigneIds.length})</span>}
            </label>
            <div className="border border-gray-300 rounded-md max-h-28 overflow-y-auto p-1">
              {users.map(u => (
                <label key={u.id} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 cursor-pointer rounded text-sm">
                  <input type="checkbox"
                    checked={filters.assigneIds.includes(u.id)}
                    onChange={e => setFilters({ ...filters, assigneIds: e.target.checked ? [...filters.assigneIds, u.id] : filters.assigneIds.filter(id => id !== u.id) })}
                    className="rounded" />
                  {u.prenom} {u.nom}
                </label>
              ))}
            </div>
          </div>

          {/* Entités assignées (multi) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Entités assignées {filters.entiteIds.length > 0 && <span className="text-blue-600">({filters.entiteIds.length})</span>}
            </label>
            <div className="border border-gray-300 rounded-md max-h-28 overflow-y-auto p-1">
              {entites.map(e => (
                <label key={e.id} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 cursor-pointer rounded text-sm">
                  <input type="checkbox"
                    checked={filters.entiteIds.includes(e.id)}
                    onChange={ev => setFilters({ ...filters, entiteIds: ev.target.checked ? [...filters.entiteIds, e.id] : filters.entiteIds.filter(id => id !== e.id) })}
                    className="rounded" />
                  {e.nom}
                </label>
              ))}
            </div>
          </div>

          {/* Nom tâche */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom de la tâche</label>
            <input type="text" value={filters.nom} onChange={e => setFilters({ ...filters, nom: e.target.value })}
              placeholder="Rechercher..." className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
          </div>

          {/* Plage date début */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date de début</label>
            <div className="flex gap-2">
              <input type="date" value={filters.dateDebutFrom} onChange={e => setFilters({ ...filters, dateDebutFrom: e.target.value })}
                className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm" title="Du" />
              <input type="date" value={filters.dateDebutTo} onChange={e => setFilters({ ...filters, dateDebutTo: e.target.value })}
                className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm" title="Au" />
            </div>
          </div>

          {/* Plage date fin */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date de fin approximative</label>
            <div className="flex gap-2">
              <input type="date" value={filters.dateFinFrom} onChange={e => setFilters({ ...filters, dateFinFrom: e.target.value })}
                className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm" title="Du" />
              <input type="date" value={filters.dateFinTo} onChange={e => setFilters({ ...filters, dateFinTo: e.target.value })}
                className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm" title="Au" />
            </div>
          </div>

        </div>
        <div className="flex justify-end mt-3">
          <button onClick={() => setFilters({ nom: '', statut: '', projetId: '', assigneIds: [], entiteIds: [], dateDebutFrom: '', dateDebutTo: '', dateFinFrom: '', dateFinTo: '' })}
            className="text-sm text-gray-500 hover:text-gray-700 border border-gray-300 rounded px-3 py-1.5">
            Réinitialiser
          </button>
        </div>
      </div>

      <TachesEnRetardBloc
        items={tachesEnRetard}
        hideFooterLink
        onTacheClick={(id) => {
          const t = taches.find((x) => x.id === id);
          if (t) {
            setEditTache(t);
            setShowModal(true);
          }
        }}
      />

      {/* Liste, Kanban ou Gantt */}
      {viewMode === 'gantt' ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm text-gray-500">
              {visibleTaches.length} tâche(s) sur le diagramme (mêmes filtres que la liste)
            </p>
            {visibleTaches.length > 80 && (
              <p className="text-xs text-amber-700">Beaucoup de tâches : faites défiler horizontalement ou affinez les filtres.</p>
            )}
          </div>
          <TachesGanttView
            taches={visibleTaches}
            getCanEdit={canEdit}
            onBarClick={(t) => {
              setEditTache(t as Tache);
              setShowModal(true);
            }}
          />
        </div>
      ) : viewMode === 'kanban' ? (
        <TachesKanbanView
          taches={visibleTaches}
          columns={STATUT_OPTIONS}
          getCanEdit={canEdit}
          onMoveTache={handleKanbanMove}
          onCardClick={(t) => {
            setEditTache(t as Tache);
            setShowModal(true);
          }}
        />
      ) : (
        <>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">{visibleTaches.length} tâche(s) trouvée(s)</p>
            </div>
            {pagedTaches.length === 0 && (
              <div className="bg-white rounded-lg shadow p-8 text-center text-gray-400">
                Aucune tâche trouvée
              </div>
            )}
            {pagedTaches.map(t => (
              <TacheCard
                key={t.id}
                tache={t}
                onEdit={() => { setEditTache(t); setShowModal(true); }}
                canEdit={canEdit(t)}
                users={users}
                currentUserRole={currentUser?.role || ''}
                allUsers={users}
              />
            ))}
          </div>

          {visibleTaches.length > pageSize && (
            <div className="mt-6 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, visibleTaches.length)} sur {visibleTaches.length}
              </p>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className={`px-4 py-2 rounded text-sm font-medium ${page === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                  Précédent
                </button>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className={`px-4 py-2 rounded text-sm font-medium ${page === totalPages ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                  Suivant
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal */}
      {showModal && (
        <TacheModal
          onClose={() => { setShowModal(false); setEditTache(undefined); }}
          onSave={loadAll}
          projets={projets}
          users={users}
          entites={entites}
          taches={taches}
          editTache={editTache}
        />
      )}
    </div>
  );
}
