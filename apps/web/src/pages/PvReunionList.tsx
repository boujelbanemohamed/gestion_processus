import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, API_BASE_URL } from '../services/api';
import axios from 'axios';
import { useAuth } from '../store/auth';
import { canModifyModule } from '../utils/uiModuleRoute';

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
    if (showForm) loadRefs();
  }, [showForm]);

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

  const filtered = rows.filter(
    (r) =>
      !search.trim() ||
      r.titre?.toLowerCase().includes(search.toLowerCase()) ||
      r.createdBy?.nom?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">PV de réunion</h1>
          <p className="text-sm text-gray-500 mt-1">
            Procès-verbaux, rattachements aux projets, tâches, epics, contrats et processus.
          </p>
        </div>
        {canUseModule && (
          <button
            type="button"
            onClick={openForm}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            + Nouveau PV
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-100 p-4 mb-4">
        <input
          type="search"
          placeholder="Rechercher par titre ou créateur…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
        />
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-100 overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-gray-500">Chargement…</p>
        ) : filtered.length === 0 ? (
          <p className="p-8 text-center text-gray-500">Aucun PV pour le moment.</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Titre</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Date réunion</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Créé par</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Document</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700"> </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50/80">
                  <td className="px-4 py-3 font-medium text-gray-900">{r.titre}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {r.dateReunion ? new Date(r.dateReunion).toLocaleDateString('fr-FR') : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {r.createdBy ? `${r.createdBy.prenom} ${r.createdBy.nom}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {r.document?.id ? (
                      <a
                        href={`${API_BASE_URL}/documents/${r.document.id}/view?token=${localStorage.getItem('token')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {r.document.nom || r.document.fichierNomOriginal}
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => navigate(`/pv-reunion/${r.id}`)}
                      className="text-blue-600 hover:underline font-medium"
                    >
                      Ouvrir →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

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
                  renderLabel={(x) => x.raisonSociale || x.id}
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
