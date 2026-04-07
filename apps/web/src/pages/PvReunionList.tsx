import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, API_BASE_URL } from '../services/api';
import axios from 'axios';
import { useAuth } from '../store/auth';
import { canModifyModule } from '../utils/uiModuleRoute';
import { getPaginationPageNumbers } from '../utils/pagination';
import { PvReunionAccesModal } from '../components/PvReunionAccesModal';

const PAGE_SIZE = 15;

const ACTION_JOURNAL: Record<string, string> = {
  connexion: 'Connexion',
  deconnexion: 'Déconnexion',
  lecture: 'Lecture / consultation',
  creation: 'Création',
  modification: 'Modification',
  suppression: 'Suppression',
  telechargement: 'Téléchargement',
  export: 'Export',
};

function clientFournisseurLabel(x: any) {
  const n = String(x?.nom || x?.raisonSociale || '').trim();
  return n || x?.id || '—';
}

const uploadApi = axios.create({ baseURL: API_BASE_URL });
uploadApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

function IdChips({
  label,
  options,
  selected,
  onChange,
  renderLabel,
}: {
  label: string;
  options: { id: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
  renderLabel: (x: any) => string;
}) {
  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 max-h-44 overflow-y-auto">
      <p className="text-xs font-semibold text-gray-600 mb-2">{label}</p>
      <div className="space-y-1">
        {options.map((x: any) => (
          <label key={x.id} className="flex items-start gap-2 text-sm cursor-pointer hover:bg-white/80 rounded px-1">
            <input
              type="checkbox"
              className="mt-1"
              checked={selected.includes(x.id)}
              onChange={() =>
                onChange(
                  selected.includes(x.id) ? selected.filter((i) => i !== x.id) : [...selected, x.id]
                )
              }
            />
            <span className="text-gray-800">{renderLabel(x)}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export default function PvReunionList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [clientsFournisseurs, setClientsFournisseurs] = useState<any[]>([]);
  const [projets, setProjets] = useState<any[]>([]);
  const [taches, setTaches] = useState<any[]>([]);
  const [userStories, setUserStories] = useState<any[]>([]);
  const [epics, setEpics] = useState<any[]>([]);
  const [contrats, setContrats] = useState<any[]>([]);
  const [processusList, setProcessusList] = useState<any[]>([]);

  const [titre, setTitre] = useState('');
  const [dateReunion, setDateReunion] = useState('');
  const [fichier, setFichier] = useState<File | null>(null);
  const [presentUserIds, setPresentUserIds] = useState<string[]>([]);
  const [presentCfIds, setPresentCfIds] = useState<string[]>([]);
  const [projetIds, setProjetIds] = useState<string[]>([]);
  const [tacheIds, setTacheIds] = useState<string[]>([]);
  const [userStoryIds, setUserStoryIds] = useState<string[]>([]);
  const [epicIds, setEpicIds] = useState<string[]>([]);
  const [contratIds, setContratIds] = useState<string[]>([]);
  const [processusIds, setProcessusIds] = useState<string[]>([]);
  const [modificationDelegueIds, setModificationDelegueIds] = useState<string[]>([]);

  const [page, setPage] = useState(1);
  const [showCorbeilleModal, setShowCorbeilleModal] = useState(false);
  const [corbeilleRows, setCorbeilleRows] = useState<any[]>([]);
  const [histModalPv, setHistModalPv] = useState<any | null>(null);
  const [histoList, setHistoList] = useState<any[]>([]);
  const [histoLoading, setHistoLoading] = useState(false);
  const [accesModalPv, setAccesModalPv] = useState<{ id: string; titre: string } | null>(null);

  const canUseModule = canModifyModule(user?.uiModules, 'pv_reunion');

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/pv-reunions');
      setRows(r.data || []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const loadRefs = async () => {
    try {
      const [u, cf, p, t, us, e, c, pr] = await Promise.all([
        api.get('/users'),
        api.get('/clients-fournisseurs'),
        api.get('/projets'),
        api.get('/taches'),
        api.get('/user-stories'),
        api.get('/epics'),
        api.get('/contrats'),
        api.get('/processus'),
      ]);
      setUsers(u.data || []);
      setClientsFournisseurs(cf.data || []);
      setProjets(p.data || []);
      setTaches((t.data || []).filter((x: any) => !x.deletedAt));
      setUserStories((us.data || []).filter((x: any) => !x.deletedAt));
      setEpics((e.data || []).filter((x: any) => !x.deletedAt));
      setContrats(c.data || []);
      setProcessusList(pr.data || []);
    } catch {
      /* silencieux */
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    if (showForm) loadRefs();
  }, [showForm]);

  const loadCorbeillePv = async () => {
    try {
      const r = await api.get('/pv-reunions/corbeille');
      setCorbeilleRows(Array.isArray(r.data) ? r.data : []);
    } catch {
      setCorbeilleRows([]);
    }
  };

  const openHistoriqueModal = async (pv: any) => {
    setHistModalPv(pv);
    setHistoList([]);
    setHistoLoading(true);
    try {
      const { data } = await api.get(`/pv-reunions/${pv.id}/history?page=1&limit=200`);
      setHistoList(data?.data || []);
    } catch {
      setHistoList([]);
      alert("Impossible de charger l'historique.");
      setHistModalPv(null);
    } finally {
      setHistoLoading(false);
    }
  };

  const handleRestorePvFromCorbeille = async (id: string) => {
    try {
      await api.post(`/corbeille/pv-reunions/${id}/restaurer`);
      setShowCorbeilleModal(false);
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Erreur lors de la restauration');
    }
  };

  const canRestorePvCorbeille = (row: any) => {
    if (user?.role === 'admin') return true;
    if (row.createdById === user?.id || row.createdBy?.id === user?.id) return true;
    return (row.modificationDelegues || []).some((d: any) => (d.userId || d.user?.id) === user?.id);
  };

  const resetForm = () => {
    setTitre('');
    setDateReunion('');
    setFichier(null);
    setPresentUserIds([]);
    setPresentCfIds([]);
    setProjetIds([]);
    setTacheIds([]);
    setUserStoryIds([]);
    setEpicIds([]);
    setContratIds([]);
    setProcessusIds([]);
    setModificationDelegueIds([]);
  };

  const openForm = () => {
    resetForm();
    setShowForm(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fichier || !titre.trim()) {
      alert('Titre et fichier du PV sont requis.');
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('titre', titre.trim());
      if (dateReunion) fd.append('dateReunion', new Date(dateReunion).toISOString());
      fd.append('fichier', fichier);
      fd.append('presentUserIds', JSON.stringify(presentUserIds));
      fd.append('presentClientFournisseurIds', JSON.stringify(presentCfIds));
      fd.append('projetIds', JSON.stringify(projetIds));
      fd.append('tacheIds', JSON.stringify(tacheIds));
      fd.append('userStoryIds', JSON.stringify(userStoryIds));
      fd.append('epicIds', JSON.stringify(epicIds));
      fd.append('contratIds', JSON.stringify(contratIds));
      fd.append('processusIds', JSON.stringify(processusIds));
      fd.append('modificationDelegueIds', JSON.stringify(modificationDelegueIds));
      const res = await uploadApi.post('/pv-reunions', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setShowForm(false);
      resetForm();
      await load();
      navigate(`/pv-reunion/${res.data.id}`);
    } catch (err: any) {
      alert(err?.response?.data?.error || err?.message || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.titre?.toLowerCase().includes(q) ||
        r.createdBy?.nom?.toLowerCase().includes(q) ||
        r.createdBy?.prenom?.toLowerCase().includes(q) ||
        String(r.id || '')
          .toLowerCase()
          .includes(q)
    );
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * PAGE_SIZE;
  const paged = filtered.slice(startIdx, startIdx + PAGE_SIZE);

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">PV de réunion</h1>
          <p className="text-sm text-gray-500 mt-1">
            {filtered.length} PV — procès-verbaux et rattachements (projets, tâches, epics, contrats, processus).
          </p>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <button
            type="button"
            onClick={async () => {
              await loadCorbeillePv();
              setShowCorbeilleModal(true);
            }}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
          >
            🗑 Corbeille
          </button>
          {canUseModule && (
            <button
              type="button"
              onClick={openForm}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium shadow-sm"
            >
              + Nouveau PV
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-100 p-4 mb-4">
        <input
          type="search"
          placeholder="Rechercher par titre, créateur ou ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-4">
        {loading ? (
          <p className="p-8 text-center text-gray-500 bg-white rounded-lg shadow border border-gray-100">Chargement…</p>
        ) : filtered.length === 0 ? (
          <p className="p-8 text-center text-gray-500 bg-white rounded-lg shadow border border-gray-100">
            Aucun PV pour le moment.
          </p>
        ) : (
          paged.map((r) => {
            const c = r.capabilities || { canModify: false };
            return (
              <div key={r.id} className="bg-white rounded-lg shadow border border-gray-100 p-5">
                <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-semibold text-gray-900 mb-1">{r.titre}</h2>
                    <p className="text-[11px] font-mono text-gray-400 break-all mb-2" title={r.id}>
                      ID : {r.id}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600">
                      <div>
                        <span className="font-medium text-gray-700">Date réunion : </span>
                        {r.dateReunion ? new Date(r.dateReunion).toLocaleDateString('fr-FR') : '—'}
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Créé par : </span>
                        {r.createdBy ? `${r.createdBy.prenom} ${r.createdBy.nom}` : '—'}
                      </div>
                      <div className="sm:col-span-2">
                        <span className="font-medium text-gray-700">Document : </span>
                        {r.document?.id ? (
                          <a
                            href={`${API_BASE_URL}/documents/${r.document.id}/view?token=${localStorage.getItem('token')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            {r.document.nom || r.document.fichierNomOriginal}
                          </a>
                        ) : (
                          '—'
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 lg:flex-col lg:items-stretch shrink-0 lg:min-w-[11rem]">
                    <button
                      type="button"
                      onClick={() => setAccesModalPv({ id: r.id, titre: r.titre || 'PV' })}
                      className="px-3 py-1.5 text-xs bg-slate-100 text-slate-800 rounded hover:bg-slate-200"
                    >
                      🔐 Accès
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(`/pv-reunion/${r.id}`)}
                      className="px-3 py-1.5 text-xs bg-gray-100 text-gray-800 rounded hover:bg-gray-200"
                    >
                      👁 Détails
                    </button>
                    <button
                      type="button"
                      onClick={() => openHistoriqueModal(r)}
                      className="px-3 py-1.5 text-xs bg-gray-100 text-gray-800 rounded hover:bg-gray-200"
                    >
                      📜 Historique
                    </button>
                    {c.canModify && canUseModule && (
                      <button
                        type="button"
                        onClick={() => navigate(`/pv-reunion/${r.id}`, { state: { openEdit: true } })}
                        className="px-3 py-1.5 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                      >
                        ✏️ Modifier
                      </button>
                    )}
                    {c.canModify && canUseModule && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (!window.confirm(`Mettre le PV « ${r.titre} » en corbeille ?`)) return;
                          try {
                            await api.delete(`/pv-reunions/${r.id}`);
                            await load();
                          } catch (e: any) {
                            alert(e?.response?.data?.error || 'Erreur');
                          }
                        }}
                        className="px-3 py-1.5 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                      >
                        🗑 Mettre en corbeille
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {filtered.length > PAGE_SIZE && (
        <div className="mt-6 flex items-center justify-between border-t border-gray-200 pt-4 flex-wrap gap-3">
          <div className="text-sm text-gray-700">
            Affichage {startIdx + 1}-{Math.min(startIdx + PAGE_SIZE, filtered.length)} sur {filtered.length}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className={`px-4 py-2 rounded text-sm font-medium ${
                safePage === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              Précédent
            </button>
            <div className="flex gap-1 flex-wrap items-center">
              {getPaginationPageNumbers(safePage, totalPages).map((p, idx) =>
                typeof p === 'string' ? (
                  <span key={`ellipsis-${idx}`} className="px-2 text-gray-500">
                    {p}
                  </span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p)}
                    className={`px-3 py-2 rounded text-sm font-medium ${
                      safePage === p ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {p}
                  </button>
                )
              )}
            </div>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className={`px-4 py-2 rounded text-sm font-medium ${
                safePage === totalPages
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              Suivant
            </button>
          </div>
        </div>
      )}

      <PvReunionAccesModal
        open={!!accesModalPv}
        onClose={() => setAccesModalPv(null)}
        pvId={accesModalPv?.id ?? null}
        titreFallback={accesModalPv?.titre ?? ''}
      />

      {histModalPv && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Historique — {histModalPv.titre}</h3>
            {histoLoading ? (
              <p className="text-sm text-gray-500">Chargement…</p>
            ) : histoList.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Aucun événement enregistré</p>
            ) : (
              <ul className="space-y-3 text-sm max-h-[60vh] overflow-y-auto">
                {histoList.map((h: any) => (
                  <li key={h.id} className="border-b border-gray-100 pb-2">
                    <div className="flex flex-wrap justify-between gap-1 text-xs text-gray-500">
                      <span>{h.timestamp ? new Date(h.timestamp).toLocaleString('fr-FR') : ''}</span>
                      <span>
                        {h.user?.prenom} {h.user?.nom}
                      </span>
                    </div>
                    <p className="font-medium text-gray-800">{ACTION_JOURNAL[h.action] || h.action}</p>
                    {h.ressourceNom && <p className="text-gray-600 text-xs mt-0.5">{h.ressourceNom}</p>}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex justify-end mt-4">
              <button
                type="button"
                onClick={() => setHistModalPv(null)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {showCorbeilleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center p-5 border-b">
              <h2 className="text-lg font-semibold">🗑 PV en corbeille</h2>
              <button
                type="button"
                onClick={() => setShowCorbeilleModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl"
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>
            <div className="p-5 space-y-3">
              {corbeilleRows.length === 0 && <p className="text-sm text-gray-500">Aucun PV en corbeille.</p>}
              {corbeilleRows.map((cp: any) => (
                <div
                  key={cp.id}
                  className="flex flex-wrap items-center justify-between gap-2 border border-gray-100 rounded-lg p-3"
                >
                  <div>
                    <p className="font-medium text-gray-900">{cp.titre}</p>
                    <p className="text-xs text-gray-500">
                      Supprimé le{' '}
                      {cp.deletedAt ? new Date(cp.deletedAt).toLocaleString('fr-FR') : '—'}
                    </p>
                  </div>
                  {canRestorePvCorbeille(cp) ? (
                    <button
                      type="button"
                      onClick={() => handleRestorePvFromCorbeille(cp.id)}
                      className="px-3 py-1.5 bg-green-100 text-green-800 rounded text-sm hover:bg-green-200"
                    >
                      Restaurer
                    </button>
                  ) : (
                    <span className="text-xs text-gray-400">Restauration : admin ou créateur</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[92vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Nouveau PV de réunion</h2>
              <button
                type="button"
                className="text-gray-500 hover:text-gray-800"
                onClick={() => setShowForm(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Titre *</label>
                <input
                  className="w-full border border-gray-200 rounded-md px-3 py-2"
                  value={titre}
                  onChange={(e) => setTitre(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Date de la réunion</label>
                <input
                  type="date"
                  className="w-full border border-gray-200 rounded-md px-3 py-2"
                  value={dateReunion}
                  onChange={(e) => setDateReunion(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Pièce jointe principale *</label>
                <input
                  type="file"
                  className="text-sm"
                  onChange={(e) => setFichier(e.target.files?.[0] || null)}
                  required
                />
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <IdChips
                  label="Présents (utilisateurs)"
                  options={users}
                  selected={presentUserIds}
                  onChange={setPresentUserIds}
                  renderLabel={(x) => `${x.prenom} ${x.nom}`}
                />
                <IdChips
                  label="Présents (clients / fournisseurs)"
                  options={clientsFournisseurs}
                  selected={presentCfIds}
                  onChange={setPresentCfIds}
                  renderLabel={clientFournisseurLabel}
                />
              </div>

              <p className="text-xs text-gray-500">
                Rattachements : les user stories impliquent leurs tâches ; les epics impliquent leurs user stories
                et leurs tâches.
              </p>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                <IdChips
                  label="Projets"
                  options={projets}
                  selected={projetIds}
                  onChange={setProjetIds}
                  renderLabel={(x) => x.nom || x.codeProjet}
                />
                <IdChips
                  label="Tâches"
                  options={taches}
                  selected={tacheIds}
                  onChange={setTacheIds}
                  renderLabel={(x) => x.nom}
                />
                <IdChips
                  label="User stories"
                  options={userStories}
                  selected={userStoryIds}
                  onChange={setUserStoryIds}
                  renderLabel={(x) =>
                    (x.description || '').length > 70
                      ? `${(x.description || '').slice(0, 70)}…`
                      : x.description || x.id
                  }
                />
                <IdChips
                  label="Epics"
                  options={epics}
                  selected={epicIds}
                  onChange={setEpicIds}
                  renderLabel={(x) => x.nom}
                />
                <IdChips
                  label="Contrats"
                  options={contrats}
                  selected={contratIds}
                  onChange={setContratIds}
                  renderLabel={(x) => x.nom}
                />
                <IdChips
                  label="Processus"
                  options={processusList}
                  selected={processusIds}
                  onChange={setProcessusIds}
                  renderLabel={(x) => x.nom}
                />
              </div>

              <IdChips
                label="Délégués modification (en plus du créateur)"
                options={users}
                selected={modificationDelegueIds}
                onChange={setModificationDelegueIds}
                renderLabel={(x) => `${x.prenom} ${x.nom}`}
              />

              <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  className="px-4 py-2 text-gray-700 border border-gray-200 rounded-lg"
                  onClick={() => setShowForm(false)}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
                >
                  {saving ? 'Enregistrement…' : 'Créer le PV'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
