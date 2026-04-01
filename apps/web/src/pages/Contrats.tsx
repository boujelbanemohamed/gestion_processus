import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, API_BASE_URL } from '../services/api';
import axios from 'axios';
import { useAuth } from '../store/auth';
import { getPaginationPageNumbers } from '../utils/pagination';

const uploadApi = axios.create({ baseURL: API_BASE_URL });
uploadApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const PAGE_SIZE = 15;

const STATUTS = [
  { value: 'actif', label: '✅ Actif', color: 'bg-green-100 text-green-700' },
  { value: 'expire', label: '⏰ Expiré', color: 'bg-red-100 text-red-700' },
  { value: 'resilie', label: '❌ Résilié', color: 'bg-gray-100 text-gray-600' },
  { value: 'suspendu', label: '⏸ Suspendu', color: 'bg-yellow-100 text-yellow-700' },
];

const NIVEAUX = [
  { value: 'lecture', label: '👁 Lecture' },
  { value: 'modification', label: '✏️ Modification' },
  { value: 'suppression', label: '🗑 Suppression' },
];

const LABEL_PERM_MODAL: Record<string, string> = {
  lecture: 'Consultation',
  modification: 'Modification',
  suppression: 'Suppression',
};

const LABEL_NIVEAU_ROW: Record<string, string> = {
  lecture: 'lecture',
  modification: 'modification',
  suppression: 'suppression',
};

const LABEL_HISTO_CONTRAT: Record<string, string> = {
  creation: 'Création du contrat',
  modification_champs: 'Modification des champs',
  droit_ajoute: 'Droit d’accès accordé',
  droit_retire: 'Droit d’accès retiré',
  document_lie: 'Document lié',
  document_delie: 'Document retiré',
  soft_delete: 'Mise en corbeille',
  restauration: 'Restauration',
};

function joursRestants(date: string) {
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
}

function niveauSummary(niveau: string) {
  if (niveau === 'lecture') return 'lecture';
  if (niveau === 'modification') return 'modification + lecture';
  if (niveau === 'suppression') return 'suppression + modification + lecture';
  return niveau;
}

function isAccesRestreintContrat(c: any) {
  const dels = c.accesApercu?.delegations?.length ?? c.permissions?.length ?? 0;
  const conf = c.documents?.some((d: any) => d.document?.estConfidentiel);
  return dels > 0 || conf || !!c.createdById;
}

function delegationsRows(c: any) {
  if (c.accesApercu?.delegations?.length) return c.accesApercu.delegations;
  return (c.permissions || []).map((p: any) => ({ id: p.id, user: p.user, niveau: p.niveau }));
}

export default function Contrats() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [contrats, setContrats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filtreStatut, setFiltreStatut] = useState('');
  const [filtreProjetIds, setFiltreProjetIds] = useState<string[]>([]);
  const [filtreParties, setFiltreParties] = useState<string[]>([]);
  const [filtreDateSignatureDebut, setFiltreDateSignatureDebut] = useState('');
  const [filtreDateSignatureFin, setFiltreDateSignatureFin] = useState('');
  const [filtreDateEnregDebut, setFiltreDateEnregDebut] = useState('');
  const [filtreDateEnregFin, setFiltreDateEnregFin] = useState('');
  const [filtreDateExpDebut, setFiltreDateExpDebut] = useState('');
  const [filtreDateExpFin, setFiltreDateExpFin] = useState('');
  const [showFiltres, setShowFiltres] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [projets, setProjets] = useState<any[]>([]);
  const [clientsFournisseurs, setClientsFournisseurs] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [tagInput, setTagInput] = useState('');

  const [accesModalContrat, setAccesModalContrat] = useState<any | null>(null);
  const [accesDetail, setAccesDetail] = useState<any | null>(null);
  const [accesLoading, setAccesLoading] = useState(false);
  const [newPermUserId, setNewPermUserId] = useState('');
  const [newPermNiveau, setNewPermNiveau] = useState('lecture');
  const [noAccesModalOpen, setNoAccesModalOpen] = useState(false);
  const [histModalContrat, setHistModalContrat] = useState<any | null>(null);
  const [histoList, setHistoList] = useState<any[]>([]);
  const [histoLoading, setHistoLoading] = useState(false);

  const emptyForm = {
    nom: '', dateSignature: '', dateEnregistrement: '', dateExpiration: '',
    statut: 'actif', tags: [] as string[], projetIds: [] as string[],
    partiesPrenantes: [] as { nom: string; clientFournisseurId?: string }[],
  };
  const [form, setForm] = useState(emptyForm);
  const [ppInput, setPpInput] = useState('');
  const [ppCFId, setPpCFId] = useState('');
  const [files, setFiles] = useState<File[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const [c, u, p, cf] = await Promise.all([
        api.get('/contrats'),
        api.get('/users'),
        api.get('/projets'),
        api.get('/clients-fournisseurs'),
      ]);
      setContrats(c.data);
      setUsers(u.data);
      setProjets(p.data);
      setClientsFournisseurs(cf.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    setPage(1);
  }, [search, filtreStatut, filtreProjetIds, filtreParties, filtreDateSignatureDebut, filtreDateSignatureFin, filtreDateEnregDebut, filtreDateEnregFin, filtreDateExpDebut, filtreDateExpFin]);

  const capModify = (c: any) =>
    c.capabilities?.canModify ??
    (user?.role === 'admin' || c.createdById === user?.id || c.permissions?.some((p: any) => p.userId === user?.id && ['modification', 'suppression'].includes(p.niveau)));
  const capDelete = (c: any) =>
    c.capabilities?.canDelete ??
    (user?.role === 'admin' || c.createdById === user?.id || c.permissions?.some((p: any) => p.userId === user?.id && p.niveau === 'suppression'));
  const capManagePermissions = (c: any) => {
    if (c.capabilities?.canManagePermissions != null) return !!c.capabilities.canManagePermissions;
    return user?.role === 'admin' || c.createdById === user?.id;
  };

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setFiles([]);
    setTagInput('');
    setPpInput('');
    setPpCFId('');
    setShowForm(true);
  };

  const openEdit = (c: any) => {
    setEditing(c);
    setForm({
      nom: c.nom,
      statut: c.statut,
      dateSignature: c.dateSignature ? c.dateSignature.split('T')[0] : '',
      dateEnregistrement: c.dateEnregistrement ? c.dateEnregistrement.split('T')[0] : '',
      dateExpiration: c.dateExpiration ? c.dateExpiration.split('T')[0] : '',
      tags: c.tags ? JSON.parse(c.tags) : [],
      projetIds: c.projets?.map((p: any) => p.projetId) || [],
      partiesPrenantes: c.partiesPrenantes || [],
    });
    setFiles([]);
    setTagInput('');
    setPpInput('');
    setPpCFId('');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.nom.trim()) return alert('Le nom est obligatoire');
    const payload = {
      nom: form.nom,
      statut: form.statut,
      dateSignature: form.dateSignature || null,
      dateEnregistrement: form.dateEnregistrement || null,
      dateExpiration: form.dateExpiration || null,
      tags: form.tags,
      projetIds: form.projetIds,
      partiesPrenantes: form.partiesPrenantes,
    };
    try {
      let contratId: string;
      if (editing) {
        await api.put(`/contrats/${editing.id}`, payload);
        contratId = editing.id;
      } else {
        const res = await api.post('/contrats', payload);
        contratId = res.data.id;
      }
      if (files.length > 0) {
        for (const file of files) {
          try {
            const fd = new FormData();
            fd.append('documents', file, file.name);
            await uploadApi.post(`/contrats/${contratId}/upload`, fd);
          } catch (uploadErr: any) {
            console.warn('Upload échoué pour', file.name, uploadErr?.response?.data);
          }
        }
      }
      setShowForm(false);
      load();
    } catch (e: any) {
      alert(e.response?.data?.error || 'Erreur');
    }
  };

  const handleDelete = async (id: string, nom: string) => {
    if (!confirm(`Mettre le contrat « ${nom} » en corbeille ? (restauration possible par un administrateur)`)) return;
    try {
      await api.delete(`/contrats/${id}`);
      load();
    } catch (e: any) {
      alert(e?.response?.data?.error || e?.message || 'Erreur');
    }
  };

  const onAccesButtonClick = (c: any) => {
    if (!capManagePermissions(c)) {
      setNoAccesModalOpen(true);
      return;
    }
    void openAccesModal(c);
  };

  const openAccesModal = async (c: any) => {
    setAccesModalContrat(c);
    setAccesDetail(null);
    setNewPermUserId('');
    setNewPermNiveau('lecture');
    setAccesLoading(true);
    try {
      const { data } = await api.get(`/contrats/${c.id}/acces`);
      setAccesDetail(data);
    } catch (e: any) {
      alert(e?.response?.data?.error || e?.message || 'Erreur chargement accès');
      setAccesModalContrat(null);
    } finally {
      setAccesLoading(false);
    }
  };

  const refreshAccesDetail = async (contratId: string) => {
    const { data } = await api.get(`/contrats/${contratId}/acces`);
    setAccesDetail(data);
  };

  const handleAddPermission = async () => {
    if (!accesModalContrat || !newPermUserId) return;
    try {
      await api.post(`/contrats/${accesModalContrat.id}/permissions`, {
        userId: newPermUserId,
        niveau: newPermNiveau,
      });
      setNewPermUserId('');
      await refreshAccesDetail(accesModalContrat.id);
      load();
    } catch (e: any) {
      alert(e?.response?.data?.error || e?.message || 'Erreur');
    }
  };

  const handleRemovePermissionEntry = async (permissionEntryId: string) => {
    if (!accesModalContrat || !confirm('Retirer ce droit ?')) return;
    try {
      await api.delete(`/contrats/${accesModalContrat.id}/permissions/entry/${permissionEntryId}`);
      await refreshAccesDetail(accesModalContrat.id);
      load();
    } catch (e: any) {
      alert(e?.response?.data?.error || e?.message || 'Erreur');
    }
  };

  const openHistoriqueModal = async (c: any) => {
    setHistModalContrat(c);
    setHistoList([]);
    setHistoLoading(true);
    try {
      const { data } = await api.get(`/contrats/${c.id}/historique`);
      setHistoList(Array.isArray(data) ? data : []);
    } catch (e: any) {
      alert(e?.response?.data?.error || e?.message || 'Erreur chargement historique');
      setHistModalContrat(null);
    } finally {
      setHistoLoading(false);
    }
  };

  const handleRemoveDoc = async (contratId: string, documentId: string) => {
    try {
      await api.delete(`/contrats/${contratId}/documents/${documentId}`);
      load();
    } catch (e: any) {
      alert(e?.response?.data?.error || e?.message || 'Erreur');
    }
  };

  const filtered = contrats.filter((c) => {
    const matchSearch = c.nom.toLowerCase().includes(search.toLowerCase());
    const matchStatut = !filtreStatut || c.statut === filtreStatut;
    const matchProjets = filtreProjetIds.length === 0 || c.projets?.some((p: any) => filtreProjetIds.includes(p.projetId || p.id));
    const matchParties = filtreParties.length === 0 || filtreParties.some((fp) =>
      c.partiesPrenantes?.some((p: any) => p.clientFournisseurId === fp || p.id === fp)
    );
    const dateSign = c.dateSignature ? new Date(c.dateSignature) : null;
    const matchSignDebut = !filtreDateSignatureDebut || (dateSign && dateSign >= new Date(filtreDateSignatureDebut));
    const matchSignFin = !filtreDateSignatureFin || (dateSign && dateSign <= new Date(filtreDateSignatureFin));
    const dateEnreg = c.dateEnregistrement ? new Date(c.dateEnregistrement) : null;
    const matchEnregDebut = !filtreDateEnregDebut || (dateEnreg && dateEnreg >= new Date(filtreDateEnregDebut));
    const matchEnregFin = !filtreDateEnregFin || (dateEnreg && dateEnreg <= new Date(filtreDateEnregFin));
    const dateExp = c.dateExpiration ? new Date(c.dateExpiration) : null;
    const matchExpDebut = !filtreDateExpDebut || (dateExp && dateExp >= new Date(filtreDateExpDebut));
    const matchExpFin = !filtreDateExpFin || (dateExp && dateExp <= new Date(filtreDateExpFin));
    return matchSearch && matchStatut && matchProjets && matchParties &&
      matchSignDebut && matchSignFin && matchEnregDebut && matchEnregFin && matchExpDebut && matchExpFin;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * PAGE_SIZE;
  const pageSlice = filtered.slice(startIdx, startIdx + PAGE_SIZE);

  const alertes = contrats.filter((c) => c.dateExpiration && joursRestants(c.dateExpiration) <= 30 && joursRestants(c.dateExpiration) > 0);

  const droitsAdminLigne = 'modification statut + accès + lecture';

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📄 Contrats</h1>
          <p className="text-sm text-gray-500 mt-1">
            {filtered.length} contrat(s) sur {contrats.length} accessible(s)
          </p>
        </div>
        <button onClick={openNew} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">+ Nouveau contrat</button>
      </div>

      {alertes.length > 0 && (
        <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
          <p className="text-sm font-medium text-orange-700 mb-1">⚠️ Contrats expirant bientôt :</p>
          <div className="flex flex-wrap gap-2">
            {alertes.map((c) => (
              <span key={c.id} className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs">
                {c.nom} — dans {joursRestants(c.dateExpiration)} jour(s)
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mb-5">
        <div className="flex gap-3 mb-2">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="🔍 Rechercher..." className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <button type="button" onClick={() => setShowFiltres(!showFiltres)} className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${showFiltres ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>
            🔧 Filtres {(filtreStatut || filtreProjetIds.length > 0 || filtreParties.length > 0 || filtreDateSignatureDebut || filtreDateSignatureFin || filtreDateEnregDebut || filtreDateEnregFin || filtreDateExpDebut || filtreDateExpFin) ? '●' : ''}
          </button>
          <button type="button" onClick={() => { setFiltreStatut(''); setFiltreProjetIds([]); setFiltreParties([]); setFiltreDateSignatureDebut(''); setFiltreDateSignatureFin(''); setFiltreDateEnregDebut(''); setFiltreDateEnregFin(''); setFiltreDateExpDebut(''); setFiltreDateExpFin(''); }} className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg bg-white">
            ✕ Réinitialiser
          </button>
        </div>
        {showFiltres && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Statut</label>
              <select value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white">
                <option value="">Tous les statuts</option>
                {STATUTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Projets liés</label>
              <div className="border border-gray-300 rounded-md bg-white max-h-28 overflow-y-auto p-2 space-y-1">
                {projets.length === 0 && <span className="text-xs text-gray-400">Aucun projet</span>}
                {projets.map((p: any) => (
                  <label key={p.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
                    <input type="checkbox" checked={filtreProjetIds.includes(p.id)} onChange={(e) => setFiltreProjetIds(e.target.checked ? [...filtreProjetIds, p.id] : filtreProjetIds.filter((id) => id !== p.id))} className="rounded" />
                    {p.nom}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Parties prenantes</label>
              <div className="border border-gray-300 rounded-md bg-white max-h-28 overflow-y-auto p-2 space-y-1">
                {clientsFournisseurs.length === 0 && <span className="text-xs text-gray-400">Aucune partie</span>}
                {clientsFournisseurs.map((cf: any) => (
                  <label key={cf.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
                    <input type="checkbox" checked={filtreParties.includes(cf.id)} onChange={(e) => setFiltreParties(e.target.checked ? [...filtreParties, cf.id] : filtreParties.filter((id) => id !== cf.id))} className="rounded" />
                    {cf.nom}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date de signature</label>
              <div className="flex gap-2">
                <input type="date" value={filtreDateSignatureDebut} onChange={(e) => setFiltreDateSignatureDebut(e.target.value)} className="flex-1 px-2 py-1.5 border border-gray-300 rounded-md text-xs bg-white" />
                <input type="date" value={filtreDateSignatureFin} onChange={(e) => setFiltreDateSignatureFin(e.target.value)} className="flex-1 px-2 py-1.5 border border-gray-300 rounded-md text-xs bg-white" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date d&apos;enregistrement</label>
              <div className="flex gap-2">
                <input type="date" value={filtreDateEnregDebut} onChange={(e) => setFiltreDateEnregDebut(e.target.value)} className="flex-1 px-2 py-1.5 border border-gray-300 rounded-md text-xs bg-white" />
                <input type="date" value={filtreDateEnregFin} onChange={(e) => setFiltreDateEnregFin(e.target.value)} className="flex-1 px-2 py-1.5 border border-gray-300 rounded-md text-xs bg-white" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date d&apos;expiration</label>
              <div className="flex gap-2">
                <input type="date" value={filtreDateExpDebut} onChange={(e) => setFiltreDateExpDebut(e.target.value)} className="flex-1 px-2 py-1.5 border border-gray-300 rounded-md text-xs bg-white" />
                <input type="date" value={filtreDateExpFin} onChange={(e) => setFiltreDateExpFin(e.target.value)} className="flex-1 px-2 py-1.5 border border-gray-300 rounded-md text-xs bg-white" />
              </div>
            </div>
          </div>
        )}
      </div>

      {loading ? <div className="text-center py-10 text-gray-400">Chargement...</div> : (
        <>
          <div className="space-y-4">
            {filtered.length === 0 && <div className="text-center py-10 text-gray-400">Aucun contrat trouvé</div>}
            {pageSlice.map((c) => {
              const statut = STATUTS.find((s) => s.value === c.statut);
              const jours = c.dateExpiration ? joursRestants(c.dateExpiration) : null;
              const tags = c.tags ? JSON.parse(c.tags) : [];
              const rows = delegationsRows(c);
              return (
                <div key={c.id} className="bg-white rounded-lg shadow p-5">
                  <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${statut?.color}`}>{statut?.label}</span>
                        <h2 className="text-lg font-semibold text-gray-900">{c.nom}</h2>
                        {jours !== null && jours <= 30 && jours > 0 && <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs">⚠️ Expire dans {jours}j</span>}
                        {jours !== null && jours <= 0 && <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">🔴 Expiré</span>}
                      </div>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-sm text-gray-600">
                        {c.dateSignature && <div><span className="font-medium">Signature : </span>{new Date(c.dateSignature).toLocaleDateString('fr-FR')}</div>}
                        {c.dateEnregistrement && <div><span className="font-medium">Enregistrement : </span>{new Date(c.dateEnregistrement).toLocaleDateString('fr-FR')}</div>}
                        {c.dateExpiration && <div><span className="font-medium">Expiration : </span>{new Date(c.dateExpiration).toLocaleDateString('fr-FR')}</div>}
                        <div><span className="font-medium">Créé par : </span>{c.createdBy?.prenom} {c.createdBy?.nom}</div>
                      </div>
                      {tags.length > 0 && <div className="flex flex-wrap gap-1 mt-2">{tags.map((t: string) => <span key={t} className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs">🏷 {t}</span>)}</div>}
                      {c.partiesPrenantes?.length > 0 && (
                        <div className="mt-2">
                          <span className="text-xs font-medium text-gray-500 uppercase">Parties prenantes : </span>
                          <span className="text-sm text-gray-700">{c.partiesPrenantes.map((p: any) => p.nom).join(', ')}</span>
                        </div>
                      )}
                      {c.projets?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {c.projets.map((p: any) => (
                            <span key={p.id} role="button" tabIndex={0} onClick={() => navigate(`/projets/${p.projet?.id}`)} onKeyDown={(e) => e.key === 'Enter' && navigate(`/projets/${p.projet?.id}`)} className="cursor-pointer px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs hover:bg-purple-200">📁 {p.projet?.nom}</span>
                          ))}
                        </div>
                      )}
                      {c.documents?.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-medium text-gray-500 uppercase mb-1">Documents :</p>
                          <div className="flex flex-wrap gap-1">
                            {c.documents.map((d: any) => (
                              <div key={d.id} className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded text-xs">
                                <a href={`${API_BASE_URL}/documents/${d.document?.id}/view?token=${localStorage.getItem('token')}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">📎 {d.document?.nom}</a>
                                {capModify(c) && <button type="button" onClick={() => handleRemoveDoc(c.id, d.documentId)} className="text-red-400 hover:text-red-600 ml-1">✕</button>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="mt-3 flex flex-wrap items-start gap-2 sm:gap-3 text-xs text-gray-700 border border-slate-100 rounded-lg px-3 py-2.5 bg-slate-50/90">
                        <span className="font-semibold text-gray-600 uppercase shrink-0 pt-0.5">Accès :</span>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 min-w-0 flex-1">
                          {isAccesRestreintContrat(c) ? (
                            <div className="inline-flex flex-col items-center justify-center px-2 py-1 rounded-md bg-red-50 border border-red-100 text-red-900 shrink-0">
                              <span className="text-sm leading-none" aria-hidden>🔒</span>
                              <span className="text-[10px] font-semibold leading-tight mt-0.5 text-center">Accès restreint</span>
                            </div>
                          ) : (
                            <div className="inline-flex flex-col items-center justify-center px-2 py-1 rounded-md bg-green-50 border border-green-100 text-green-900 shrink-0">
                              <span className="text-[10px] font-semibold leading-tight text-center">Accès élargi</span>
                            </div>
                          )}
                          {(() => {
                            const actifAdmins = users.filter((u: any) => u.role === 'admin' && (!u.statut || u.statut === 'actif'));
                            const creatorId = c.createdById || c.createdBy?.id;
                            return (
                              <>
                                {actifAdmins.map((a: any) => {
                                  const isCreator = creatorId === a.id;
                                  return (
                                    <div key={`adm-${c.id}-${a.id}`} className="min-w-0">
                                      <span className="font-medium text-gray-900">{a.prenom} {a.nom}</span>
                                      <span className="text-gray-500 italic block sm:inline sm:ml-1">
                                        {isCreator
                                          ? `(Administrateur et créateur : ${droitsAdminLigne})`
                                          : `(Admin : ${droitsAdminLigne})`}
                                      </span>
                                    </div>
                                  );
                                })}
                                {c.createdBy && creatorId && !actifAdmins.some((a: any) => a.id === creatorId) && (
                                  <div className="min-w-0">
                                    <span className="font-medium text-gray-900">{c.createdBy.prenom} {c.createdBy.nom}</span>
                                    <span className="text-gray-500 italic block sm:inline sm:ml-1">(Créateur : {droitsAdminLigne})</span>
                                  </div>
                                )}
                              </>
                            );
                          })()}
                          {rows.map((d: any) => (
                            <div key={d.id} className="min-w-0">
                              <span className="font-medium text-gray-900">{d.user.prenom} {d.user.nom}</span>
                              <span className="text-gray-500 italic block sm:inline sm:ml-1">
                                {d.niveau === 'lecture' ? (
                                  <>👁 ({NIVEAUX.find((n) => n.value === d.niveau)?.label} : {LABEL_NIVEAU_ROW[d.niveau] || d.niveau})</>
                                ) : (
                                  <> ({NIVEAUX.find((n) => n.value === d.niveau)?.label} : {niveauSummary(d.niveau)})</>
                                )}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 lg:flex-col lg:items-stretch shrink-0 lg:min-w-[11rem]">
                      {capModify(c) && <button type="button" onClick={() => openEdit(c)} className="px-3 py-1.5 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200">✏️ Modifier Contrat</button>}
                      <button type="button" onClick={() => onAccesButtonClick(c)} className="px-3 py-1.5 text-xs bg-slate-100 text-slate-800 rounded hover:bg-slate-200">🔐 Accès</button>
                      <button type="button" onClick={() => openHistoriqueModal(c)} className="px-3 py-1.5 text-xs bg-gray-100 text-gray-800 rounded hover:bg-gray-200">📜 Historique</button>
                      {capDelete(c) && <button type="button" onClick={() => handleDelete(c.id, c.nom)} className="px-3 py-1.5 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200">🗑 Mettre en corbeille</button>}
                    </div>
                  </div>
                </div>
              );
            })}
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
                  className={`px-4 py-2 rounded text-sm font-medium ${safePage === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
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
                        className={`px-3 py-2 rounded text-sm font-medium ${safePage === p ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
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
                  className={`px-4 py-2 rounded text-sm font-medium ${safePage === totalPages ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                >
                  Suivant
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">{editing ? '✏️ Modifier le contrat' : '+ Nouveau contrat'}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom du contrat *</label>
                <input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" placeholder="Ex: Contrat de prestation ABC" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
                  <select value={form.statut} onChange={(e) => setForm({ ...form, statut: e.target.value })} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
                    {STATUTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date de signature</label>
                  <input type="date" value={form.dateSignature} onChange={(e) => setForm({ ...form, dateSignature: e.target.value })} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date d&apos;enregistrement</label>
                  <input type="date" value={form.dateEnregistrement} onChange={(e) => setForm({ ...form, dateEnregistrement: e.target.value })} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date d&apos;expiration</label>
                  <input type="date" value={form.dateExpiration} onChange={(e) => setForm({ ...form, dateExpiration: e.target.value })} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Parties prenantes</label>
                {form.partiesPrenantes.map((pp, i) => (
                  <div key={i} className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 bg-teal-100 text-teal-700 rounded text-xs">{pp.nom}</span>
                    <button type="button" onClick={() => setForm({ ...form, partiesPrenantes: form.partiesPrenantes.filter((_, j) => j !== i) })} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                  </div>
                ))}
                <div className="flex gap-2 mt-1">
                  <select value={ppCFId} onChange={(e) => { setPpCFId(e.target.value); if (e.target.value) { const cf = clientsFournisseurs.find((x: any) => x.id === e.target.value); if (cf) setPpInput(cf.nom); } }} className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm">
                    <option value="">— Depuis la liste CF —</option>
                    {clientsFournisseurs.map((cf: any) => <option key={cf.id} value={cf.id}>{cf.nom}</option>)}
                  </select>
                  <input value={ppInput} onChange={(e) => { setPpInput(e.target.value); setPpCFId(''); }} placeholder="ou saisir manuellement" className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm" />
                  <button type="button" onClick={() => { if (!ppInput.trim()) return; setForm({ ...form, partiesPrenantes: [...form.partiesPrenantes, { nom: ppInput.trim(), clientFournisseurId: ppCFId || undefined }] }); setPpInput(''); setPpCFId(''); }} className="px-3 py-1 bg-teal-600 text-white rounded text-sm">+</button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tags / Mots-clés</label>
                <div className="flex flex-wrap gap-1 mb-1">
                  {form.tags.map((t, i) => (
                    <span key={i} className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                      {t} <button type="button" onClick={() => setForm({ ...form, tags: form.tags.filter((_, j) => j !== i) })} className="text-red-400 hover:text-red-600">✕</button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && tagInput.trim()) { setForm({ ...form, tags: [...form.tags, tagInput.trim()] }); setTagInput(''); e.preventDefault(); } }} placeholder="Ajouter un tag et appuyer Entrée" className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm" />
                  <button type="button" onClick={() => { if (tagInput.trim()) { setForm({ ...form, tags: [...form.tags, tagInput.trim()] }); setTagInput(''); } }} className="px-3 py-1 bg-blue-600 text-white rounded text-sm">+</button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Projets liés</label>
                {form.projetIds.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {form.projetIds.map((pid) => {
                      const p = projets.find((pr: any) => pr.id === pid);
                      return p ? (
                        <div key={pid} className="flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                          📁 {p.nom} <button type="button" onClick={() => setForm({ ...form, projetIds: form.projetIds.filter((id) => id !== pid) })} className="text-red-400 hover:text-red-600">✕</button>
                        </div>
                      ) : null;
                    })}
                  </div>
                )}
                <select onChange={(e) => { if (e.target.value && !form.projetIds.includes(e.target.value)) setForm({ ...form, projetIds: [...form.projetIds, e.target.value] }); e.target.value = ''; }} className="w-full border border-gray-300 rounded px-2 py-1 text-sm">
                  <option value="">— Ajouter un projet —</option>
                  {projets.filter((p: any) => !form.projetIds.includes(p.id)).map((p: any) => <option key={p.id} value={p.id}>{p.nom}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Documents joints</label>
                {editing && editing.documents?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {editing.documents.map((d: any) => (
                      <div key={d.id} className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded text-xs">
                        <a href={`${API_BASE_URL}/documents/${d.document?.id}/view?token=${localStorage.getItem('token')}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">📎 {d.document?.nom}</a>
                        <button type="button" onClick={async () => { try { await api.delete(`/contrats/${editing.id}/documents/${d.documentId}`); setEditing({ ...editing, documents: editing.documents.filter((x: any) => x.id !== d.id) }); } catch (err: any) { alert(err?.response?.data?.error || err?.message); } }} className="text-red-400 hover:text-red-600 ml-1">✕</button>
                      </div>
                    ))}
                  </div>
                )}
                <input type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))} className="w-full text-sm text-gray-600 border border-gray-200 rounded p-1" />
                {files.length > 0 && <p className="text-xs text-gray-500 mt-1">📎 {files.length} fichier(s) sélectionné(s)</p>}
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">Annuler</button>
              <button type="button" onClick={handleSave} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {accesModalContrat && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-6">
          <div className="bg-white rounded-lg shadow-xl p-6 sm:p-8 w-full max-w-5xl max-h-[min(94vh,960px)] overflow-y-auto">
            <h3 className="text-xl font-semibold mb-2">Accès — {accesModalContrat.nom}</h3>
            <p className="text-sm text-gray-600 mb-5 leading-relaxed">
              Les comptes <span className="font-medium">administrateur</span> ont tous les droits sur tous les contrats. Le{' '}
              <span className="font-medium">créateur</span> du contrat peut modifier, supprimer (mettre en corbeille) et gérer les accès.
            </p>
            {accesLoading ? (
              <p className="text-sm text-gray-500">Chargement…</p>
            ) : accesDetail ? (
              <div className="space-y-5 text-sm">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Administrateurs</p>
                  <ul className="space-y-1.5 text-gray-700 text-base">
                    {(accesDetail.admins || []).map((a: any) => (
                      <li key={a.id}>
                        <span className="font-medium">{a.prenom} {a.nom}</span>
                        <span className="text-gray-400"> (accès complet)</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Créateur</p>
                  {accesDetail.creator ? (
                    <p>
                      <span className="font-medium">{accesDetail.creator.prenom} {accesDetail.creator.nom}</span>
                      <span className="text-gray-400"> — modification, mise en corbeille, gestion des accès</span>
                    </p>
                  ) : (
                    <p className="text-amber-800 text-sm">Créateur non résolu.</p>
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Accès partagés</p>
                  {(accesDetail.delegations || []).length === 0 ? (
                    <p className="text-gray-400 text-xs italic">Aucun accès délégué</p>
                  ) : (
                    <ul className="space-y-2">
                      {(accesDetail.delegations || []).map((d: any) => (
                        <li key={d.id} className="flex flex-wrap items-center gap-2 border border-gray-100 rounded-md px-3 py-2 bg-gray-50">
                          <span className="font-medium">{d.user.prenom} {d.user.nom}</span>
                          <span className="text-gray-500">— {LABEL_PERM_MODAL[d.permission] || d.permission}</span>
                          {accesDetail.canManagePermissions && (
                            <button type="button" onClick={() => handleRemovePermissionEntry(d.id)} className="text-xs text-red-600 hover:underline ml-auto">Retirer</button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {accesDetail.canManagePermissions && (
                  <div className="border-t border-gray-200 pt-4 space-y-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Accorder un accès</p>
                    <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_auto] gap-3 items-end">
                      <select value={newPermUserId} onChange={(e) => setNewPermUserId(e.target.value)} className="w-full min-w-0 border border-gray-300 rounded-md px-3 py-2 text-sm">
                        <option value="">— Utilisateur —</option>
                        {users
                          .filter((u: any) => (!u.statut || u.statut === 'actif') && u.role !== 'admin' && u.id !== accesDetail.creator?.id)
                          .map((u: any) => (
                            <option key={u.id} value={u.id}>{u.prenom} {u.nom} ({u.email})</option>
                          ))}
                      </select>
                      <select value={newPermNiveau} onChange={(e) => setNewPermNiveau(e.target.value)} className="w-full lg:w-56 border border-gray-300 rounded-md px-3 py-2 text-sm">
                        {NIVEAUX.map((n) => <option key={n.value} value={n.value}>{n.label}</option>)}
                      </select>
                      <button type="button" onClick={handleAddPermission} disabled={!newPermUserId} className="w-full lg:w-auto px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 shrink-0">Ajouter</button>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
            <div className="flex justify-end mt-4">
              <button type="button" onClick={() => setAccesModalContrat(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">Fermer</button>
            </div>
          </div>
        </div>
      )}

      {histModalContrat && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Historique — {histModalContrat.nom}</h3>
            {histoLoading ? (
              <p className="text-sm text-gray-500">Chargement…</p>
            ) : histoList.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Aucun événement enregistré</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {histoList.map((h: any) => (
                  <li key={h.id} className="border-b border-gray-100 pb-2">
                    <div className="flex flex-wrap justify-between gap-1 text-xs text-gray-500">
                      <span>{new Date(h.createdAt).toLocaleString('fr-FR')}</span>
                      <span>{h.user?.prenom} {h.user?.nom}</span>
                    </div>
                    <p className="font-medium text-gray-800">{LABEL_HISTO_CONTRAT[h.typeEvenement] || h.typeEvenement}</p>
                    {h.libelle && <p className="text-gray-600 text-xs mt-0.5">{h.libelle}</p>}
                    {h.details && typeof h.details === 'object' && (
                      <pre className="text-xs bg-gray-50 rounded p-2 mt-1 overflow-x-auto max-h-32">{JSON.stringify(h.details, null, 2)}</pre>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex justify-end mt-4">
              <button type="button" onClick={() => setHistModalContrat(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">Fermer</button>
            </div>
          </div>
        </div>
      )}

      {noAccesModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4" role="dialog" aria-modal="true" aria-labelledby="no-acces-contrat-title" onClick={() => setNoAccesModalOpen(false)}>
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h3 id="no-acces-contrat-title" className="text-lg font-semibold text-gray-900 mb-2">Accès au bouton « Accès »</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              Vous n&apos;avez pas les droits nécessaires pour gérer les accès de ce contrat. Seuls les{' '}
              <span className="font-medium">administrateurs</span> et le <span className="font-medium">créateur</span> du contrat peuvent utiliser ce bouton.
            </p>
            <div className="flex justify-end mt-5">
              <button type="button" onClick={() => setNoAccesModalOpen(false)} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
