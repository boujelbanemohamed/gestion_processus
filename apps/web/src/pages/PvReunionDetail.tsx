import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { api, API_BASE_URL } from '../services/api';
import axios from 'axios';
import { useAuth } from '../store/auth';
import { canModifyModule } from '../utils/uiModuleRoute';
import { PvReunionAccesModal, type PvReunionAccesDetail } from '../components/PvReunionAccesModal';

const PV_STATUTS = [
  { value: 'brouillon', label: 'Brouillon', color: 'bg-gray-100 text-gray-800' },
  { value: 'en_revision', label: 'En révision', color: 'bg-amber-100 text-amber-900' },
  { value: 'valide', label: 'Validé', color: 'bg-green-100 text-green-800' },
  { value: 'archive', label: 'Archivé', color: 'bg-slate-200 text-slate-700' },
];

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
  disabled,
}: {
  label: string;
  options: { id: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
  renderLabel: (x: any) => string;
  disabled?: boolean;
}) {
  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 max-h-44 overflow-y-auto">
      <p className="text-xs font-semibold text-gray-600 mb-2">{label}</p>
      <div className="space-y-1">
        {options.map((x: any) => (
          <label
            key={x.id}
            className={`flex items-start gap-2 text-sm rounded px-1 ${disabled ? 'opacity-60' : 'cursor-pointer hover:bg-white/80'}`}
          >
            <input
              type="checkbox"
              className="mt-1"
              disabled={disabled}
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

export default function PvReunionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [pv, setPv] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
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
  const [statutPv, setStatutPv] = useState('brouillon');
  const [dateReunion, setDateReunion] = useState('');
  const [presentUserIds, setPresentUserIds] = useState<string[]>([]);
  const [presentCfIds, setPresentCfIds] = useState<string[]>([]);
  const [projetIds, setProjetIds] = useState<string[]>([]);
  const [tacheIds, setTacheIds] = useState<string[]>([]);
  const [userStoryIds, setUserStoryIds] = useState<string[]>([]);
  const [epicIds, setEpicIds] = useState<string[]>([]);
  const [contratIds, setContratIds] = useState<string[]>([]);
  const [processusIds, setProcessusIds] = useState<string[]>([]);
  const [modificationDelegueIds, setModificationDelegueIds] = useState<string[]>([]);

  const [commentContenu, setCommentContenu] = useState('');
  const [commentAssigne, setCommentAssigne] = useState('');
  const [commentFile, setCommentFile] = useState<File | null>(null);
  const [commentSending, setCommentSending] = useState(false);

  const [showAccesModal, setShowAccesModal] = useState(false);
  const [accesSynth, setAccesSynth] = useState<PvReunionAccesDetail | null>(null);
  const [accesSynthLoading, setAccesSynthLoading] = useState(false);
  const [histOpen, setHistOpen] = useState(false);
  const [histoList, setHistoList] = useState<any[]>([]);
  const [histoLoading, setHistoLoading] = useState(false);

  const canModule = canModifyModule(user?.uiModules, 'pv_reunion');
  const canEdit = !!(pv?.capabilities?.canModify && canModule);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const r = await api.get(`/pv-reunions/${id}`);
      setPv(r.data);
    } catch {
      setPv(null);
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
      /* */
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setAccesSynthLoading(true);
    api
      .get(`/pv-reunions/${id}/acces`)
      .then((r) => setAccesSynth(r.data))
      .catch(() => setAccesSynth(null))
      .finally(() => setAccesSynthLoading(false));
  }, [id]);

  useEffect(() => {
    const st = location.state as { openEdit?: boolean } | null;
    if (st?.openEdit) {
      setEditMode(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [id]);

  useEffect(() => {
    if (!pv) return;
    setTitre(pv.titre || '');
    setStatutPv(pv.statut || 'brouillon');
    setDateReunion(pv.dateReunion ? pv.dateReunion.slice(0, 10) : '');
    setPresentUserIds(pv.presentsUser?.map((x: any) => x.userId || x.user?.id) || []);
    setPresentCfIds(
      pv.presentsClientFournisseur?.map((x: any) => x.clientFournisseurId || x.clientFournisseur?.id) || []
    );
    const le = pv.liensExplicites || {};
    setProjetIds(le.projetIds || []);
    setTacheIds(le.tacheIds || []);
    setUserStoryIds(le.userStoryIds || []);
    setEpicIds(le.epicIds || []);
    setContratIds(le.contratIds || []);
    setProcessusIds(le.processusIds || []);
    setModificationDelegueIds(pv.modificationDelegues?.map((x: any) => x.userId || x.user?.id) || []);
  }, [pv]);

  useEffect(() => {
    if (editMode) loadRefs();
  }, [editMode]);

  useEffect(() => {
    if (pv && !editMode) {
      api.get('/users').then((r) => setUsers(r.data || [])).catch(() => {});
    }
  }, [pv?.id, editMode]);

  const saveEdit = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await api.put(`/pv-reunions/${id}`, {
        titre: titre.trim(),
        statut: statutPv,
        dateReunion: dateReunion ? new Date(dateReunion).toISOString() : null,
        presentUserIds,
        presentClientFournisseurIds: presentCfIds,
        projetIds,
        tacheIds,
        userStoryIds,
        epicIds,
        contratIds,
        processusIds,
        modificationDelegueIds,
      });
      setEditMode(false);
      await load();
      try {
        const { data } = await api.get(`/pv-reunions/${id}/acces`);
        setAccesSynth(data);
      } catch {
        /* garde l’ancienne synthèse */
      }
    } catch (err: any) {
      alert(err?.response?.data?.error || err?.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id || !window.confirm('Mettre ce PV en corbeille ? Vous pourrez le restaurer depuis la liste (bouton Corbeille).'))
      return;
    try {
      await api.delete(`/pv-reunions/${id}`);
      navigate('/pv-reunion');
    } catch (err: any) {
      alert(err?.response?.data?.error || err?.message);
    }
  };

  const sendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !commentContenu.trim()) return;
    setCommentSending(true);
    try {
      const fd = new FormData();
      fd.append('contenu', commentContenu.trim());
      if (commentAssigne) fd.append('assigneAId', commentAssigne);
      if (commentFile) fd.append('fichier', commentFile);
      await uploadApi.post(`/pv-reunions/${id}/commentaires`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setCommentContenu('');
      setCommentAssigne('');
      setCommentFile(null);
      await load();
    } catch (err: any) {
      alert(err?.response?.data?.error || err?.message);
    } finally {
      setCommentSending(false);
    }
  };

  const downloadCommentPiece = async (commentId: string, filename: string) => {
    if (!id) return;
    try {
      const res = await api.get(`/pv-reunions/${id}/commentaires/${commentId}/piece`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'piece-jointe';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      alert('Téléchargement impossible.');
    }
  };

  const openHistorique = async () => {
    if (!id) return;
    setHistOpen(true);
    setHistoList([]);
    setHistoLoading(true);
    try {
      const { data } = await api.get(`/pv-reunions/${id}/history?page=1&limit=200`);
      setHistoList(data?.data || []);
    } catch {
      setHistoList([]);
      alert("Impossible de charger l'historique.");
    } finally {
      setHistoLoading(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-center text-gray-500">Chargement…</div>;
  }

  if (!pv) {
    return (
      <div className="p-6">
        <p className="text-gray-600">PV introuvable.</p>
        <button
          type="button"
          onClick={() => navigate('/pv-reunion')}
          className="text-blue-600 hover:underline mt-4 text-sm"
        >
          ← Retour à la liste
        </button>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => navigate('/pv-reunion')}
            className="text-gray-500 hover:text-gray-700 text-sm flex items-center gap-1 w-fit"
          >
            ← Retour aux PV de réunion
          </button>
          <h1 className="text-2xl font-bold text-gray-900">PV de réunion</h1>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-5 mb-6">
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h2 className="text-lg font-semibold text-gray-900">{pv.titre}</h2>
              {(() => {
                const st = PV_STATUTS.find((s) => s.value === pv.statut) || PV_STATUTS[0];
                return (
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${st.color}`}>{st.label}</span>
                );
              })()}
            </div>
            <p className="text-[11px] font-mono text-gray-400 break-all mb-3" title={pv.id}>
              ID : {pv.id}
            </p>

        {!editMode ? (
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Commentaires : </span>
              <span className="font-semibold text-blue-700">{pv.nombreCommentaires ?? 0}</span>
            </div>
            <div>
              <span className="text-gray-500">Vues (journal) : </span>
              <span className="font-semibold text-blue-700">{pv.nombreVues ?? 0}</span>
            </div>
            <div>
              <span className="text-gray-500">Date de réunion : </span>
              <span className="font-medium">
                {pv.dateReunion ? new Date(pv.dateReunion).toLocaleDateString('fr-FR') : '—'}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Créé par : </span>
              <span className="font-medium">
                {pv.createdBy ? `${pv.createdBy.prenom} ${pv.createdBy.nom}` : '—'}
              </span>
            </div>
            <div className="md:col-span-2">
              <span className="text-gray-500">Document principal : </span>
              {pv.document?.id ? (
                <a
                  href={`${API_BASE_URL}/documents/${pv.document.id}/view?token=${localStorage.getItem('token')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline font-medium"
                >
                  {pv.document.nom || pv.document.fichierNomOriginal}
                </a>
              ) : (
                '—'
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Titre</label>
              <input
                className="w-full border border-gray-200 rounded-md px-3 py-2"
                value={titre}
                onChange={(e) => setTitre(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Statut</label>
              <select
                className="w-full border border-gray-200 rounded-md px-3 py-2"
                value={statutPv}
                onChange={(e) => setStatutPv(e.target.value)}
              >
                {PV_STATUTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date de réunion</label>
              <input
                type="date"
                className="w-full border border-gray-200 rounded-md px-3 py-2"
                value={dateReunion}
                onChange={(e) => setDateReunion(e.target.value)}
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
              Règles de propagation : user stories → tâches ; epics → user stories et tâches.
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
                  (x.description || '').length > 60
                    ? `${(x.description || '').slice(0, 60)}…`
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
              label="Délégués modification"
              options={users}
              selected={modificationDelegueIds}
              onChange={setModificationDelegueIds}
              renderLabel={(x) => `${x.prenom} ${x.nom}`}
            />
          </div>
        )}
          </div>

          <div className="flex flex-wrap gap-2 lg:flex-col lg:items-stretch shrink-0 lg:min-w-[11rem]">
            {pv.document?.id && (
              <a
                href={`${API_BASE_URL}/documents/${pv.document.id}/view?token=${localStorage.getItem('token')}`}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 text-xs text-center bg-gray-100 text-gray-800 rounded hover:bg-gray-200"
              >
                👁 Consulter le document
              </a>
            )}
            {!editMode && (
              <>
                <button
                  type="button"
                  onClick={() => setShowAccesModal(true)}
                  className="px-3 py-1.5 text-xs bg-slate-100 text-slate-800 rounded hover:bg-slate-200"
                >
                  🔐 Accès
                </button>
                <button
                  type="button"
                  onClick={() => void openHistorique()}
                  className="px-3 py-1.5 text-xs bg-gray-100 text-gray-800 rounded hover:bg-gray-200"
                >
                  📜 Historique
                </button>
              </>
            )}
            {canEdit && !editMode && (
              <button
                type="button"
                onClick={() => setEditMode(true)}
                className="px-3 py-1.5 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              >
                ✏️ Modifier
              </button>
            )}
            {canEdit && editMode && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setEditMode(false);
                    void load();
                  }}
                  className="px-3 py-1.5 text-xs bg-gray-100 text-gray-800 rounded hover:bg-gray-200"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={() => void saveEdit()}
                  disabled={saving}
                  className="px-3 py-1.5 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50"
                >
                  {saving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </>
            )}
            {canEdit && !editMode && (
              <button
                type="button"
                onClick={() => void handleDelete()}
                className="px-3 py-1.5 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
              >
                🗑 Mettre en corbeille
              </button>
            )}
          </div>
        </div>
      </div>

      {!editMode && (
        <>
          <section className="bg-white rounded-lg shadow border border-gray-100 p-6 mb-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Accès et personnes concernées</h2>
              <button
                type="button"
                onClick={() => setShowAccesModal(true)}
                className="px-3 py-1.5 text-xs bg-slate-100 text-slate-800 rounded hover:bg-slate-200 shrink-0"
              >
                🔐 Détail des accès (modale)
              </button>
            </div>
            {accesSynthLoading && <p className="text-sm text-gray-500">Chargement…</p>}
            {!accesSynthLoading && accesSynth && (
              <div className="space-y-4 text-sm text-gray-700">
                <p className="text-gray-600 leading-relaxed">{accesSynth.visibilityNote}</p>
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Administrateurs actifs</h3>
                  <div className="flex flex-wrap gap-2">
                    {(accesSynth.admins || []).map((a) => (
                      <span key={a.id} className="px-2 py-1 bg-slate-100 rounded text-xs">
                        {a.prenom} {a.nom}
                      </span>
                    ))}
                    {(accesSynth.admins || []).length === 0 && (
                      <span className="text-gray-400 italic">Aucun</span>
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Créateur</h3>
                  <p>
                    {accesSynth.creator ? (
                      <>
                        <span className="font-medium">
                          {accesSynth.creator.prenom} {accesSynth.creator.nom}
                        </span>
                        {accesSynth.creator.email && (
                          <span className="text-gray-500 ml-1">({accesSynth.creator.email})</span>
                        )}
                      </>
                    ) : (
                      '—'
                    )}
                  </p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Accès partagés</h3>
                  <div className="flex flex-wrap gap-2">
                    {(accesSynth.delegations || []).length === 0 && (
                      <span className="text-gray-400 italic">Aucune délégation explicite</span>
                    )}
                    {(accesSynth.delegations || []).map((d: any) => (
                      <span
                        key={d.id}
                        className="px-2 py-1 bg-indigo-50 text-indigo-900 rounded text-xs"
                        title={d.permission}
                      >
                        {d.user?.prenom} {d.user?.nom}
                        <span className="text-indigo-600 ml-1">
                          ({d.permission === 'lecture' ? 'lecture' : d.permission === 'modification' ? 'modif.' : d.permission === 'suppression' ? 'suppr.' : d.permission})
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Délégués modification</h3>
                  <div className="flex flex-wrap gap-2">
                    {(accesSynth.modificationDelegues || []).map((d, i) => (
                      <span key={d.user?.id || d.userId || i} className="px-2 py-1 bg-blue-50 text-blue-900 rounded text-xs">
                        {d.user ? `${d.user.prenom} ${d.user.nom}` : d.userId}
                      </span>
                    ))}
                    {(accesSynth.modificationDelegues || []).length === 0 && (
                      <span className="text-gray-400 italic">Aucun</span>
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Présents (utilisateurs)</h3>
                  <div className="flex flex-wrap gap-2">
                    {(accesSynth.presentsUser || []).map((p, i) => (
                      <span key={p.user?.id || i} className="px-2 py-1 bg-gray-100 rounded text-xs">
                        {p.user ? `${p.user.prenom} ${p.user.nom}` : '—'}
                      </span>
                    ))}
                    {(accesSynth.presentsUser || []).length === 0 && (
                      <span className="text-gray-400 italic">Aucun</span>
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                    Présents (clients / fournisseurs)
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {(accesSynth.presentsClientFournisseur || []).map((p, i) => (
                      <span key={p.clientFournisseur?.id || i} className="px-2 py-1 bg-amber-50 rounded text-xs">
                        {clientFournisseurLabel(p.clientFournisseur)}
                      </span>
                    ))}
                    {(accesSynth.presentsClientFournisseur || []).length === 0 && (
                      <span className="text-gray-400 italic">Aucun</span>
                    )}
                  </div>
                </div>
              </div>
            )}
            {!accesSynthLoading && !accesSynth && (
              <p className="text-sm text-gray-500">Synthèse des accès indisponible.</p>
            )}
          </section>

          <section className="bg-white rounded-lg shadow border border-gray-100 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Rattachements effectifs</h2>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <h3 className="font-medium text-gray-700 mb-2">Projets</h3>
                <ul className="list-disc list-inside text-gray-600 space-y-1">
                  {pv.projets?.length
                    ? pv.projets.map((x: any) => (
                        <li key={x.projetId}>{x.projet?.nom || x.projetId}</li>
                      ))
                    : '—'}
                </ul>
              </div>
              <div>
                <h3 className="font-medium text-gray-700 mb-2">Tâches</h3>
                <ul className="list-disc list-inside text-gray-600 space-y-1 max-h-40 overflow-y-auto">
                  {pv.taches?.length
                    ? pv.taches.map((x: any) => (
                        <li key={x.tacheId}>{x.tache?.nom || x.tacheId}</li>
                      ))
                    : '—'}
                </ul>
              </div>
              <div>
                <h3 className="font-medium text-gray-700 mb-2">User stories</h3>
                <ul className="list-disc list-inside text-gray-600 space-y-1 max-h-40 overflow-y-auto">
                  {pv.userStories?.length
                    ? pv.userStories.map((x: any) => (
                        <li key={x.userStoryId}>
                          {(x.userStory?.description || '').slice(0, 80)}
                          {(x.userStory?.description || '').length > 80 ? '…' : ''}
                        </li>
                      ))
                    : '—'}
                </ul>
              </div>
              <div>
                <h3 className="font-medium text-gray-700 mb-2">Epics</h3>
                <ul className="list-disc list-inside text-gray-600 space-y-1">
                  {pv.epics?.length
                    ? pv.epics.map((x: any) => (
                        <li key={x.epicId}>{x.epic?.nom || x.epicId}</li>
                      ))
                    : '—'}
                </ul>
              </div>
              <div>
                <h3 className="font-medium text-gray-700 mb-2">Contrats</h3>
                <ul className="list-disc list-inside text-gray-600 space-y-1">
                  {pv.contrats?.length
                    ? pv.contrats.map((x: any) => (
                        <li key={x.contratId}>{x.contrat?.nom || x.contratId}</li>
                      ))
                    : '—'}
                </ul>
              </div>
              <div>
                <h3 className="font-medium text-gray-700 mb-2">Processus</h3>
                <ul className="list-disc list-inside text-gray-600 space-y-1">
                  {pv.processus?.length
                    ? pv.processus.map((x: any) => (
                        <li key={x.processusId}>{x.processus?.nom || x.processusId}</li>
                      ))
                    : '—'}
                </ul>
              </div>
            </div>
          </section>

          <section className="bg-white rounded-lg shadow border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Commentaires</h2>
            <div className="space-y-4 mb-6">
              {(pv.commentaires || []).map((c: any) => (
                <div key={c.id} className="border border-gray-100 rounded-lg p-4 bg-gray-50/50">
                  <div className="flex justify-between text-xs text-gray-500 mb-2">
                    <span>
                      {c.user ? `${c.user.prenom} ${c.user.nom}` : '—'} ·{' '}
                      {new Date(c.createdAt).toLocaleString('fr-FR')}
                    </span>
                    {c.assigneUser && (
                      <span className="text-blue-700">
                        Assigné à {c.assigneUser.prenom} {c.assigneUser.nom}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-800 whitespace-pre-wrap">{c.contenu}</p>
                  {c.pieceJointe && (
                    <button
                      type="button"
                      onClick={() =>
                        downloadCommentPiece(
                          c.id,
                          c.pieceJointe.fichierNomOriginal || c.pieceJointe.nom
                        )
                      }
                      className="mt-2 text-sm text-blue-600 hover:underline"
                    >
                      📎 {c.pieceJointe.fichierNomOriginal || c.pieceJointe.nom}
                    </button>
                  )}
                </div>
              ))}
              {!(pv.commentaires || []).length && (
                <p className="text-sm text-gray-500">Aucun commentaire.</p>
              )}
            </div>

            <form onSubmit={sendComment} className="border-t border-gray-100 pt-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-800">Ajouter un commentaire</h3>
              <textarea
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm min-h-[100px]"
                placeholder="Votre message…"
                value={commentContenu}
                onChange={(e) => setCommentContenu(e.target.value)}
                required
              />
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Assigner à (optionnel)</label>
                  <select
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                    value={commentAssigne}
                    onChange={(e) => setCommentAssigne(e.target.value)}
                  >
                    <option value="">—</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.prenom} {u.nom}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Pièce jointe (annexe)</label>
                  <input
                    type="file"
                    className="text-sm w-full"
                    onChange={(e) => setCommentFile(e.target.files?.[0] || null)}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={commentSending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50"
              >
                {commentSending ? 'Envoi…' : 'Publier'}
              </button>
            </form>
          </section>
        </>
      )}

      <PvReunionAccesModal
        open={showAccesModal}
        onClose={() => setShowAccesModal(false)}
        pvId={id ?? null}
        titreFallback={pv.titre || ''}
        onPermissionsChanged={() => {
          void load();
          if (id) {
            api
              .get(`/pv-reunions/${id}/acces`)
              .then((r) => setAccesSynth(r.data))
              .catch(() => {});
          }
        }}
      />

      {histOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Historique — {pv.titre}</h3>
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
                onClick={() => setHistOpen(false)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
