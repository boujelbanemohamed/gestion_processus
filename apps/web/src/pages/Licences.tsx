import { useState, useEffect, useRef } from 'react';
import { api, API_BASE_URL } from '../services/api';
import { useAuth } from '../store/auth';
import axios from 'axios';

const uploadApi = axios.create({ baseURL: API_BASE_URL });
uploadApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const STATUTS = [
  { value: 'active', label: '✅ Active', color: 'bg-green-100 text-green-700' },
  { value: 'expiree', label: '⏰ Expirée', color: 'bg-red-100 text-red-700' },
  { value: 'suspendue', label: '⏸ Suspendue', color: 'bg-yellow-100 text-yellow-700' },
];

const NIVEAUX = [
  { value: 'lecture', label: '👁 Lecture' },
  { value: 'modification', label: '✏️ Modification' },
  { value: 'suppression', label: '🗑 Suppression' },
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

function lignesResumeAcces(l: any) {
  const lines: string[] = [];
  lines.push('Administrateurs : lecture, modification, suppression');
  if (l.createdBy) {
    lines.push(`Créateur (${l.createdBy.prenom} ${l.createdBy.nom}) : tous droits`);
  } else if (l.createdById) {
    lines.push('Créateur : (utilisateur inconnu ou supprimé)');
  }
  (l.permissions || []).forEach((p: any) => {
    const nom = p.user ? `${p.user.prenom} ${p.user.nom}` : 'Utilisateur';
    const label = NIVEAUX.find((n) => n.value === p.niveau)?.label || p.niveau;
    lines.push(`${nom} : ${label}`);
  });
  return lines;
}

function joursRestants(date: string) {
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
}

const genRef = () => `LIC-${Date.now().toString(36).toUpperCase()}`;

const getStatutAuto = (dateDebut: string, dateFin: string) => {
  const now = new Date();
  if (dateFin && new Date(dateFin) < now) return 'expiree';
  if (dateDebut && new Date(dateDebut) > now) return 'suspendue';
  return 'active';
};

const emptyForm = {
  nom: '', reference: '', typeLicence: '', cout: '', devise: '',
  statut: 'active', dateDebut: '', dateFin: '', description: '',
  nombreSieges: '', contratId: '', processusId: '', clientFournisseurId: ''
};

export default function Licences() {
  const { user } = useAuth();
  const [licences, setLicences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtreStatut, setFiltreStatut] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [users, setUsers] = useState<any[]>([]);
  const [contrats, setContrats] = useState<any[]>([]);
  const [processus, setProcessus] = useState<any[]>([]);
  const [clientsFournisseurs, setCF] = useState<any[]>([]);
  const [typesLicence, setTypesLicence] = useState<any[]>([]);
  const [devises, setDevises] = useState<any[]>([]);
  const [showPermModal, setShowPermModal] = useState<any>(null);
  const [permForm, setPermForm] = useState({ userId: '', niveau: 'lecture' });
  const [showDetailModal, setShowDetailModal] = useState<any>(null);
  const [detailTab, setDetailTab] = useState<'info'|'historique'|'docs'|'comments'|'notifs'|'acces'>('info');
  const [commentForm, setCommentForm] = useState({ contenu: '', assigneA: '' });
  const [notifForm, setNotifForm] = useState({ joursAvant: 30, destinataires: [] as string[] });
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [showCorbeilleModal, setShowCorbeilleModal] = useState(false);
  const [corbeilleLicences, setCorbeilleLicences] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const detailFileRef = useRef<HTMLInputElement>(null);
  const [detailDocUploading, setDetailDocUploading] = useState(false);

  useEffect(() => { loadAll(); }, []);

  useEffect(() => {
    if (!showDetailModal || detailTab !== 'historique') return;
    let cancelled = false;
    (async () => {
      setHistoryLoading(true);
      try {
        const r = await api.get(`/licences/${showDetailModal.id}/history`);
        if (!cancelled) setHistory(r.data || []);
      } catch {
        if (!cancelled) setHistory([]);
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [showDetailModal?.id, detailTab]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [l, u, c, p, cf, tl, dv] = await Promise.all([
        api.get('/licences'), api.get('/users'),
        api.get('/contrats'), api.get('/processus'),
        api.get('/clients-fournisseurs'), api.get('/types-licence'),
        api.get('/devises'),
      ]);
      setLicences(l.data); setUsers(u.data); setContrats(c.data);
      setProcessus(p.data); setCF(cf.data); setTypesLicence(tl.data);
      setDevises(dv.data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const isOwner = (l: any) => user?.role === 'admin' || l.createdById === user?.id;
  const canEditLicence = (l: any) => {
    if (user?.role === 'admin' || l.createdById === user?.id) return true;
    return l.permissions?.some((p: any) => p.userId === user?.id && ['modification','suppression'].includes(p.niveau));
  };
  const canSoftDelete = (l: any) => {
    if (user?.role === 'admin' || l.createdById === user?.id) return true;
    return l.permissions?.some((p: any) => p.userId === user?.id && p.niveau === 'suppression');
  };

  const openDetail = async (l: any) => {
    try {
      const res = await api.get(`/licences/${l.id}`);
      setShowDetailModal(res.data);
      setDetailTab('info');
      setHistory([]);
    } catch {
      setShowDetailModal(l);
      setDetailTab('info');
    }
  };

  const loadCorbeilleLicences = async () => {
    try {
      const r = await api.get('/licences/corbeille');
      setCorbeilleLicences(r.data || []);
    } catch {
      setCorbeilleLicences([]);
    }
  };

  const handleRestoreFromCorbeille = async (id: string) => {
    try {
      await api.post(`/licences/${id}/restaurer`);
      setShowCorbeilleModal(false);
      await loadAll();
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Erreur restauration');
    }
  };

  const openNew = () => {
    setEditing(null);
    setForm({ ...emptyForm, devise: devises[0]?.code || '' });
    setNewFiles([]);
    setShowForm(true);
  };
  const openEdit = (l: any) => {
    setEditing(l);
    setForm({
      nom: l.nom, reference: l.reference || '', typeLicence: l.typeLicence,
      cout: l.cout || '', devise: l.devise || devises[0]?.code || '', statut: l.statut,
      dateDebut: l.dateDebut ? l.dateDebut.split('T')[0] : '',
      dateFin: l.dateFin ? l.dateFin.split('T')[0] : '',
      description: l.description || '', nombreSieges: l.nombreSieges || '',
      contratId: l.contratId || '', processusId: l.processusId || '',
      clientFournisseurId: l.clientFournisseurId || ''
    });
    setNewFiles([]); setShowForm(true);
  };

  const handleSubmit = async () => {
    try {
      const statutAuto = (form.dateDebut || form.dateFin) ? getStatutAuto(form.dateDebut, form.dateFin) : form.statut;
      const data: any = {
        ...form,
        reference: form.reference || genRef(),
        statut: statutAuto,
        nombreSieges: form.nombreSieges ? parseInt(form.nombreSieges as string) : null,
        cout: form.cout ? parseFloat(form.cout as string) : null,
        dateDebut: form.dateDebut || null, dateFin: form.dateFin || null,
        contratId: form.contratId || null, processusId: form.processusId || null,
        clientFournisseurId: form.clientFournisseurId || null,
      };
      let licenceId: string;
      if (editing) {
        await api.put(`/licences/${editing.id}`, data);
        licenceId = editing.id;
      } else {
        const res = await api.post('/licences', data);
        licenceId = res.data.id;
      }
      for (const file of newFiles) {
        const fd = new FormData();
        fd.append('documents', file, file.name);
        await uploadApi.post(`/licences/${licenceId}/upload`, fd);
      }
      setShowForm(false); loadAll();
    } catch (e: any) { alert('Erreur: ' + (e?.response?.data?.error || e.message)); }
  };

  const handleDelete = async (id: string, nom: string) => {
    if (!confirm(`Mettre « ${nom} » dans la corbeille ? Vous pourrez la restaurer depuis la corbeille (ou la page Licences > Corbeille).`)) return;
    try {
      await api.delete(`/licences/${id}`);
      await loadAll();
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Erreur');
    }
  };

  const handleAddPerm = async () => {
    if (!permForm.userId) return;
    await api.post(`/licences/${showPermModal.id}/permissions`, permForm);
    setPermForm({ userId: '', niveau: 'lecture' }); loadAll();
  };

  const handleRemovePerm = async (licenceId: string, userId: string) => {
    await api.delete(`/licences/${licenceId}/permissions/${userId}`); loadAll();
  };

  const handleAddComment = async () => {
    if (!commentForm.contenu.trim()) return;
    await api.post(`/licences/${showDetailModal.id}/commentaires`, {
      contenu: commentForm.contenu, assigneA: commentForm.assigneA || null
    });
    setCommentForm({ contenu: '', assigneA: '' });
    const res = await api.get(`/licences/${showDetailModal.id}`);
    setShowDetailModal(res.data); loadAll();
  };

  const handleSetNotif = async () => {
    await api.post(`/licences/${showDetailModal.id}/notifications`, notifForm);
    const res = await api.get(`/licences/${showDetailModal.id}`);
    setShowDetailModal(res.data); loadAll();
  };

  const uploadDetailDocs = async (fileList: FileList | null) => {
    if (!showDetailModal?.id || !fileList?.length) return;
    setDetailDocUploading(true);
    try {
      for (const file of Array.from(fileList)) {
        const fd = new FormData();
        fd.append('documents', file, file.name);
        await uploadApi.post(`/licences/${showDetailModal.id}/upload`, fd);
      }
      const res = await api.get(`/licences/${showDetailModal.id}`);
      setShowDetailModal(res.data);
      await loadAll();
    } catch (e: any) {
      alert(e?.response?.data?.error || e?.message || 'Erreur upload');
    } finally {
      setDetailDocUploading(false);
      if (detailFileRef.current) detailFileRef.current.value = '';
    }
  };

  const filtered = licences.filter(l => {
    const matchSearch = l.nom.toLowerCase().includes(search.toLowerCase()) ||
      (l.reference || '').toLowerCase().includes(search.toLowerCase());
    const matchStatut = !filtreStatut || l.statut === filtreStatut;
    return matchSearch && matchStatut;
  });

  const alertes = licences.filter(l => l.dateFin && joursRestants(l.dateFin) <= 30 && joursRestants(l.dateFin) > 0);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🔑 Licences</h1>
          <p className="text-sm text-gray-500 mt-1">{licences.length} licence(s)</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={async () => { await loadCorbeilleLicences(); setShowCorbeilleModal(true); }}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
          >
            🗑 Corbeille
          </button>
          <button onClick={openNew} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">+ Nouvelle licence</button>
        </div>
      </div>

      {alertes.length > 0 && (
        <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
          <p className="text-sm font-medium text-orange-700 mb-1">⚠️ Licences expirant bientôt :</p>
          <div className="flex flex-wrap gap-2">
            {alertes.map(l => <span key={l.id} className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs">{l.nom} — dans {joursRestants(l.dateFin)} jour(s)</span>)}
          </div>
        </div>
      )}

      <div className="flex gap-3 mb-5">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Rechercher..." className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        <select value={filtreStatut} onChange={e => setFiltreStatut(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
          <option value="">Tous les statuts</option>
          {STATUTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {loading ? <div className="text-center py-10 text-gray-400">Chargement...</div> : (
        <div className="space-y-4">
          {filtered.length === 0 && <div className="text-center py-10 text-gray-400">Aucune licence</div>}
          {filtered.map(l => {
            const statut = STATUTS.find(s => s.value === l.statut);
            const jours = l.dateFin ? joursRestants(l.dateFin) : null;
            return (
              <div key={l.id} className={`bg-white border rounded-lg p-4 shadow-sm ${jours !== null && jours <= 30 && jours > 0 ? 'border-orange-300' : 'border-gray-200'}`}>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${statut?.color}`}>{statut?.label}</span>
                      <h3 className="font-semibold text-gray-900 cursor-pointer hover:text-blue-600" onClick={() => openDetail(l)}>{l.nom}</h3>
                      {l.reference && <span className="text-xs text-gray-400">#{l.reference}</span>}
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{l.typeLicence}</span>
                    </div>
                    <div className="flex flex-wrap gap-4 text-xs text-gray-500 mb-2">
                      {l.nombreSieges && <span>👥 {l.nombreSieges} utilisateurs</span>}
                      {l.cout && <span>💰 {l.cout} {l.devise}</span>}
                      {l.dateDebut && <span>📅 Début : {new Date(l.dateDebut).toLocaleDateString('fr-FR')}</span>}
                      {l.dateFin && <span className={jours !== null && jours <= 30 ? 'text-orange-600 font-medium' : ''}>
                        📅 Fin : {new Date(l.dateFin).toLocaleDateString('fr-FR')} {jours !== null && jours > 0 ? `(dans ${jours}j)` : jours !== null && jours <= 0 ? '⚠️ Expirée' : ''}
                      </span>}
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {l.contrat && <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded">📄 {l.contrat.nom}</span>}
                      {l.processus && <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded">⚙️ {l.processus.nom}</span>}
                      {l.clientFournisseur && <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded">🏢 {l.clientFournisseur.nom}</span>}
                    </div>
                    <div className="mt-2 text-xs text-gray-600 space-y-0.5 border-t border-gray-100 pt-2">
                      <p>
                        <span className="font-medium text-gray-700">Créé par : </span>
                        {l.createdBy ? (
                          <span>{l.createdBy.prenom} {l.createdBy.nom}</span>
                        ) : (
                          <span className="text-amber-600">Non renseigné</span>
                        )}
                      </p>
                      <p className="font-medium text-gray-700">Qui peut voir / modifier / supprimer :</p>
                      <ul className="list-disc list-inside text-gray-600 space-y-0.5">
                        {lignesResumeAcces(l).map((line, i) => (
                          <li key={i}>{line}</li>
                        ))}
                      </ul>
                      {l._count?.commentaires > 0 && (
                        <p className="text-gray-400">💬 {l._count.commentaires} commentaire(s)</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 ml-4">
                    <button type="button" onClick={() => openDetail(l)} className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200">👁 Détails</button>
                    {canEditLicence(l) && <button type="button" onClick={() => openEdit(l)} className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200">✏️ Modifier</button>}
                    {isOwner(l) && <button type="button" onClick={() => { setShowPermModal(l); setPermForm({ userId: '', niveau: 'lecture' }); }} className="px-3 py-1 text-xs bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200">🔑 Accès</button>}
                    {canSoftDelete(l) && <button type="button" onClick={() => handleDelete(l.id, l.nom)} className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200">🗑 Corbeille</button>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Création/Édition */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-screen overflow-y-auto">
            <div className="flex justify-between items-center px-6 py-5 border-b">
              <h2 className="text-lg font-semibold">{editing ? 'Modifier' : 'Nouvelle licence'}</h2>
              <button type="button" onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none p-1">✕</button>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nom *</label>
                  <input value={form.nom} onChange={e => setForm({...form, nom: e.target.value})} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Référence (auto si vide)</label>
                  <input value={form.reference} onChange={e => setForm({...form, reference: e.target.value})} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" placeholder="Auto-généré" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Type *</label>
                  <select value={form.typeLicence} onChange={e => setForm({...form, typeLicence: e.target.value})} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
                    <option value="">Sélectionner un type</option>
                    {typesLicence.map((t: any) => <option key={t.id} value={t.nom}>{t.nom}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nombre d'utilisateurs</label>
                  <input type="number" value={form.nombreSieges} onChange={e => setForm({...form, nombreSieges: e.target.value})} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" placeholder="Optionnel" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Montant (coût)</label>
                  <input type="number" value={form.cout} onChange={e => setForm({...form, cout: e.target.value})} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" placeholder="Optionnel" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Devise</label>
                  <select
                    value={form.devise}
                    onChange={(e) => setForm({ ...form, devise: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
                  >
                    <option value="">{devises.length ? 'Sélectionner une devise' : 'Aucune — voir Configuration'}</option>
                    {devises.map((d: any) => (
                      <option key={d.id} value={d.code}>
                        {d.libelle ? `${d.code} — ${d.libelle}` : d.code}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Date de début</label>
                  <input type="date" value={form.dateDebut} onChange={e => setForm({...form, dateDebut: e.target.value, statut: getStatutAuto(e.target.value, form.dateFin)})} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Date de fin</label>
                  <input type="date" value={form.dateFin} onChange={e => setForm({...form, dateFin: e.target.value, statut: getStatutAuto(form.dateDebut, e.target.value)})} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Statut (auto selon dates)</label>
                  <select value={form.statut} onChange={e => setForm({...form, statut: e.target.value})} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
                    {STATUTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={3} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Contrat lié</label>
                  <select value={form.contratId} onChange={e => setForm({...form, contratId: e.target.value})} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
                    <option value="">Aucun</option>
                    {contrats.map((c: any) => <option key={c.id} value={c.id}>{c.nom}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Processus lié</label>
                  <select value={form.processusId} onChange={e => setForm({...form, processusId: e.target.value})} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
                    <option value="">Aucun</option>
                    {processus.map((p: any) => <option key={p.id} value={p.id}>{p.nom}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Client/Fournisseur</label>
                  <select value={form.clientFournisseurId} onChange={e => setForm({...form, clientFournisseurId: e.target.value})} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
                    <option value="">Aucun</option>
                    {clientsFournisseurs.map((cf: any) => <option key={cf.id} value={cf.id}>{cf.nom}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <span className="block text-xs font-medium text-gray-600 mb-1">Documents</span>
                <div className="flex flex-wrap items-center gap-2">
                  <label
                    htmlFor="licence-form-files"
                    className="inline-flex px-3 py-2 text-sm font-medium rounded-md border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="file"
                      multiple
                      id="licence-form-files"
                      className="sr-only"
                      onChange={(e) => setNewFiles(Array.from(e.target.files || []))}
                    />
                    Sélectionner fichier(s)
                  </label>
                  <span className="text-xs text-gray-500">PDF, Office, images…</span>
                </div>
                {newFiles.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{newFiles.map((f, i) => <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">📎 {f.name}</span>)}</div>}
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50/80">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg">Annuler</button>
              <button onClick={handleSubmit} disabled={!form.nom || !form.typeLicence} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {editing ? 'Enregistrer' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Permissions */}
      {showPermModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 sm:p-6">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
            <div className="flex justify-between items-center gap-4 px-6 py-5 border-b">
              <h2 className="text-lg font-semibold pr-2">🔑 Accès — {showPermModal.nom}</h2>
              <button type="button" onClick={() => setShowPermModal(null)} className="shrink-0 text-gray-400 hover:text-gray-600 text-xl leading-none p-1">✕</button>
            </div>
            <div className="px-6 py-6 space-y-5">
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:gap-4">
                <select
                  value={permForm.userId}
                  onChange={e => setPermForm({...permForm, userId: e.target.value})}
                  className="flex-1 min-w-0 border border-gray-300 rounded-lg px-4 py-2.5 text-sm bg-white"
                >
                  <option value="">Sélectionner un utilisateur</option>
                  {users.filter((u: any) => u.id !== user?.id).map((u: any) => <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>)}
                </select>
                <select
                  value={permForm.niveau}
                  onChange={e => setPermForm({...permForm, niveau: e.target.value})}
                  className="w-full sm:w-44 shrink-0 border border-gray-300 rounded-lg px-4 py-2.5 text-sm bg-white"
                >
                  {NIVEAUX.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
                </select>
                <button
                  type="button"
                  onClick={handleAddPerm}
                  className="shrink-0 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 whitespace-nowrap"
                >
                  Ajouter
                </button>
              </div>
              <div className="space-y-2">
                {showPermModal.permissions?.map((p: any) => (
                  <div key={p.id} className="flex justify-between items-center px-3 py-2 bg-gray-50 rounded">
                    <span className="text-sm">{p.user?.prenom} {p.user?.nom}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">{NIVEAUX.find(n => n.value === p.niveau)?.label}</span>
                      <button onClick={() => handleRemovePerm(showPermModal.id, p.userId)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Détails */}
      {showDetailModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-screen overflow-y-auto">
            <div className="flex justify-between items-center p-5 border-b">
              <h2 className="text-lg font-semibold">🔑 {showDetailModal.nom}</h2>
              <button onClick={() => setShowDetailModal(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="flex border-b overflow-x-auto">
              {[{k:'info',l:'ℹ️ Infos'},{k:'historique',l:'📜 Historique'},{k:'docs',l:`📎 Docs (${showDetailModal.documents?.length||0})`},{k:'comments',l:`💬 (${showDetailModal.commentaires?.length||0})`},{k:'notifs',l:'🔔 Alertes'},{k:'acces',l:'🔑 Accès'}].map(t => (
                <button key={t.k} type="button" onClick={() => setDetailTab(t.k as any)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${detailTab === t.k ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                  {t.l}
                </button>
              ))}
            </div>
            <div className="p-5">
              {detailTab === 'info' && (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {[
                    ['Type', showDetailModal.typeLicence],
                    ['Référence', showDetailModal.reference],
                    ['Utilisateurs', showDetailModal.nombreSieges],
                    ['Coût', showDetailModal.cout ? `${showDetailModal.cout} ${showDetailModal.devise}` : null],
                    ['Début', showDetailModal.dateDebut ? new Date(showDetailModal.dateDebut).toLocaleDateString('fr-FR') : null],
                    ['Fin', showDetailModal.dateFin ? new Date(showDetailModal.dateFin).toLocaleDateString('fr-FR') : null],
                    ['Contrat', showDetailModal.contrat?.nom],
                    ['Processus', showDetailModal.processus?.nom],
                    ['Client/Fournisseur', showDetailModal.clientFournisseur?.nom],
                  ].filter(([,v]) => v).map(([k, v]) => (
                    <div key={k as string}><span className="text-gray-500">{k} :</span> <span className="font-medium">{v as string}</span></div>
                  ))}
                  {showDetailModal.description && <div className="col-span-2"><span className="text-gray-500">Description :</span><p className="mt-1">{showDetailModal.description}</p></div>}
                  <div className="col-span-2 border-t pt-3 mt-2">
                    <p className="text-gray-500 text-xs font-medium mb-1">Créé par</p>
                    {showDetailModal.createdBy ? (
                      <p className="text-sm">{showDetailModal.createdBy.prenom} {showDetailModal.createdBy.nom} ({showDetailModal.createdBy.email})</p>
                    ) : (
                      <p className="text-sm text-amber-600">Non renseigné</p>
                    )}
                  </div>
                </div>
              )}
              {detailTab === 'historique' && (
                <div className="space-y-3">
                  <p className="text-xs text-gray-500">Journal des lectures, modifications, suppressions et autres actions enregistrées pour cette licence.</p>
                  {historyLoading && <p className="text-sm text-gray-400">Chargement…</p>}
                  {!historyLoading && history.length === 0 && <p className="text-sm text-gray-400">Aucune entrée pour le moment.</p>}
                  <ul className="space-y-2 max-h-80 overflow-y-auto">
                    {history.map((h: any) => (
                      <li key={h.id} className="text-sm border border-gray-100 rounded-lg p-3 bg-gray-50">
                        <div className="flex justify-between gap-2 flex-wrap">
                          <span className="font-medium text-gray-800">{ACTION_JOURNAL[h.action] || h.action}</span>
                          <span className="text-xs text-gray-500">{h.timestamp ? new Date(h.timestamp).toLocaleString('fr-FR') : ''}</span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1">
                          {h.user ? `${h.user.prenom} ${h.user.nom}` : 'Utilisateur'} {h.ressourceNom ? `· ${h.ressourceNom}` : ''}
                        </p>
                        {h.details && Object.keys(h.details).length > 0 && (
                          <pre className="text-xs text-gray-500 mt-2 whitespace-pre-wrap break-all">{JSON.stringify(h.details, null, 2)}</pre>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {detailTab === 'docs' && (
                <div className="space-y-4">
                  {canEditLicence(showDetailModal) && (
                    <div className={`flex flex-wrap items-center gap-2 ${detailDocUploading ? 'pointer-events-none opacity-60' : ''}`}>
                      <label
                        htmlFor="licence-detail-files"
                        className="inline-flex px-3 py-2 text-sm font-medium rounded-md border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 cursor-pointer shrink-0"
                      >
                        <input
                          ref={detailFileRef}
                          type="file"
                          multiple
                          id="licence-detail-files"
                          className="sr-only"
                          onChange={(e) => uploadDetailDocs(e.target.files)}
                        />
                        {detailDocUploading ? 'Envoi en cours…' : 'Sélectionner fichier(s)'}
                      </label>
                      <span className="text-xs text-gray-500">Les fichiers apparaissent dans Licences et dans Documents (type Licence), avec les mêmes accès que la licence.</span>
                    </div>
                  )}
                  {!showDetailModal.documents?.length && <p className="text-gray-400 text-sm">Aucun document</p>}
                  {showDetailModal.documents?.map((d: any) => (
                    <div key={d.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <a href={`${API_BASE_URL}/documents/${d.document?.id}/view?token=${localStorage.getItem('token')}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-sm">
                        📎 {d.document?.nom}
                      </a>
                    </div>
                  ))}
                </div>
              )}
              {detailTab === 'comments' && (
                <div className="space-y-4">
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {showDetailModal.commentaires?.map((c: any) => (
                      <div key={c.id} className="bg-gray-50 rounded-lg p-3">
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-xs font-medium text-gray-700">{c.user?.prenom} {c.user?.nom}</span>
                          <span className="text-xs text-gray-400">{new Date(c.createdAt).toLocaleString('fr-FR')}</span>
                        </div>
                        {c.assigneUser && <span className="text-xs text-indigo-600 mb-1 block">👤 Assigné à : {c.assigneUser.prenom} {c.assigneUser.nom}</span>}
                        <p className="text-sm text-gray-700">{c.contenu}</p>
                      </div>
                    ))}
                  </div>
                  <div className="border-t pt-3 space-y-2">
                    <textarea value={commentForm.contenu} onChange={e => setCommentForm({...commentForm, contenu: e.target.value})} placeholder="Ajouter un commentaire..." rows={3} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
                    <div className="flex gap-2">
                      <select value={commentForm.assigneA} onChange={e => setCommentForm({...commentForm, assigneA: e.target.value})} className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm">
                        <option value="">Assigner à (optionnel)</option>
                        {users.map((u: any) => <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>)}
                      </select>
                      <button onClick={handleAddComment} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm">Envoyer</button>
                    </div>
                  </div>
                </div>
              )}
              {detailTab === 'notifs' && (
                <div className="space-y-4">
                  {showDetailModal.notifications?.map((n: any) => (
                    <div key={n.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
                      <span>🔔 {n.joursAvant} jour(s) avant expiration</span>
                      <span className="text-gray-500">{n.destinataires?.length} destinataire(s)</span>
                      <span className={`px-2 py-0.5 rounded text-xs ${n.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{n.active ? 'Actif' : 'Inactif'}</span>
                    </div>
                  ))}
                  <div className="border-t pt-3 space-y-3">
                    <p className="text-sm font-medium text-gray-700">Ajouter une alerte d'expiration</p>
                    <div className="flex gap-2 items-center">
                      <label className="text-sm text-gray-600">Alerter</label>
                      <input type="number" value={notifForm.joursAvant} onChange={e => setNotifForm({...notifForm, joursAvant: parseInt(e.target.value)})} className="w-20 border border-gray-300 rounded-md px-2 py-1 text-sm" min={1} />
                      <label className="text-sm text-gray-600">jours avant expiration</label>
                    </div>
                    <div className="border border-gray-300 rounded-md max-h-32 overflow-y-auto p-2 space-y-1">
                      {users.map((u: any) => (
                        <label key={u.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
                          <input type="checkbox" checked={notifForm.destinataires.includes(u.id)}
                            onChange={e => setNotifForm({...notifForm, destinataires: e.target.checked ? [...notifForm.destinataires, u.id] : notifForm.destinataires.filter(id => id !== u.id)})} />
                          {u.prenom} {u.nom} ({u.email})
                        </label>
                      ))}
                    </div>
                    <button onClick={handleSetNotif} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm">Enregistrer l'alerte</button>
                  </div>
                </div>
              )}
              {detailTab === 'acces' && (
                <div className="space-y-2">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium">Super Admin</p>
                    <p className="text-xs text-gray-500">Accès complet</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium">{showDetailModal.createdBy?.prenom} {showDetailModal.createdBy?.nom}</p>
                    <p className="text-xs text-gray-500">Créateur — accès complet</p>
                  </div>
                  {showDetailModal.permissions?.map((p: any) => (
                    <div key={p.id} className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm font-medium">{p.user?.prenom} {p.user?.nom}</p>
                      <p className="text-xs text-gray-500">{NIVEAUX.find(n => n.value === p.niveau)?.label}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showCorbeilleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center p-5 border-b">
              <h2 className="text-lg font-semibold">🗑 Licences en corbeille</h2>
              <button type="button" onClick={() => setShowCorbeilleModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="p-5 space-y-3">
              {corbeilleLicences.length === 0 && <p className="text-sm text-gray-500">Aucune licence supprimée.</p>}
              {corbeilleLicences.map((cl: any) => (
                <div key={cl.id} className="flex justify-between items-center gap-3 p-3 border rounded-lg bg-gray-50">
                  <div>
                    <p className="font-medium text-gray-900">{cl.nom}</p>
                    <p className="text-xs text-gray-500">
                      Supprimée le {cl.deletedAt ? new Date(cl.deletedAt).toLocaleString('fr-FR') : '—'}
                      {cl.createdBy && ` · Créée par ${cl.createdBy.prenom} ${cl.createdBy.nom}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRestoreFromCorbeille(cl.id)}
                    className="shrink-0 px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700"
                  >
                    Restaurer
                  </button>
                </div>
              ))}
              <p className="text-xs text-gray-400 pt-2">
                La suppression définitive est réservée aux administrateurs (menu Corbeille global).
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
