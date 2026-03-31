import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../store/auth';
import axios from 'axios';

const uploadApi = axios.create({ baseURL: 'http://172.17.5.198:4000/api/v1' });
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
  nom: '', reference: '', typeLicence: '', cout: '', devise: 'TND',
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
  const [showPermModal, setShowPermModal] = useState<any>(null);
  const [permForm, setPermForm] = useState({ userId: '', niveau: 'lecture' });
  const [showDetailModal, setShowDetailModal] = useState<any>(null);
  const [detailTab, setDetailTab] = useState<'info'|'docs'|'comments'|'notifs'|'acces'>('info');
  const [commentForm, setCommentForm] = useState({ contenu: '', assigneA: '' });
  const [notifForm, setNotifForm] = useState({ joursAvant: 30, destinataires: [] as string[] });
  const [newFiles, setNewFiles] = useState<File[]>([]);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [l, u, c, p, cf, tl] = await Promise.all([
        api.get('/licences'), api.get('/users'),
        api.get('/contrats'), api.get('/processus'),
        api.get('/clients-fournisseurs'), api.get('/types-licence')
      ]);
      setLicences(l.data); setUsers(u.data); setContrats(c.data);
      setProcessus(p.data); setCF(cf.data); setTypesLicence(tl.data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const isOwner = (l: any) => user?.role === 'admin' || l.createdById === user?.id;
  const canEditLicence = (l: any) => {
    if (user?.role === 'admin' || l.createdById === user?.id) return true;
    return l.permissions?.some((p: any) => p.userId === user?.id && ['modification','suppression'].includes(p.niveau));
  };

  const openNew = () => { setEditing(null); setForm({ ...emptyForm }); setNewFiles([]); setShowForm(true); };
  const openEdit = (l: any) => {
    setEditing(l);
    setForm({
      nom: l.nom, reference: l.reference || '', typeLicence: l.typeLicence,
      cout: l.cout || '', devise: l.devise || 'TND', statut: l.statut,
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
    if (!confirm(`Supprimer "${nom}" ?`)) return;
    await api.delete(`/licences/${id}`); loadAll();
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
        <button onClick={openNew} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">+ Nouvelle licence</button>
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
                      <h3 className="font-semibold text-gray-900 cursor-pointer hover:text-blue-600" onClick={() => { setShowDetailModal(l); setDetailTab('info'); }}>{l.nom}</h3>
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
                    <div className="mt-1 text-xs text-gray-400">
                      Créé par : {l.createdBy?.prenom} {l.createdBy?.nom}
                      {l.permissions?.length > 0 && <span className="ml-2">• {l.permissions.length} accès</span>}
                      {l._count?.commentaires > 0 && <span className="ml-2">• {l._count.commentaires} commentaire(s)</span>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 ml-4">
                    <button onClick={() => { setShowDetailModal(l); setDetailTab('info'); }} className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200">👁 Détails</button>
                    {canEditLicence(l) && <button onClick={() => openEdit(l)} className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200">✏️ Modifier</button>}
                    {isOwner(l) && <button onClick={() => { setShowPermModal(l); setPermForm({ userId: '', niveau: 'lecture' }); }} className="px-3 py-1 text-xs bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200">🔑 Accès</button>}
                    {isOwner(l) && <button onClick={() => handleDelete(l.id, l.nom)} className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200">🗑 Supprimer</button>}
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-screen overflow-y-auto">
            <div className="flex justify-between items-center p-5 border-b">
              <h2 className="text-lg font-semibold">{editing ? 'Modifier' : 'Nouvelle licence'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
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
                  <label className="block text-xs font-medium text-gray-600 mb-1">Coût</label>
                  <div className="flex gap-2">
                    <input type="number" value={form.cout} onChange={e => setForm({...form, cout: e.target.value})} className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm" />
                    <select value={form.devise} onChange={e => setForm({...form, devise: e.target.value})} className="w-24 border border-gray-300 rounded-md px-2 py-2 text-sm">
                      <option>TND</option><option>EUR</option><option>USD</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Statut (auto selon dates)</label>
                  <select value={form.statut} onChange={e => setForm({...form, statut: e.target.value})} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
                    {STATUTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
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
                <label className="block text-xs font-medium text-gray-600 mb-1">Documents</label>
                <input type="file" multiple onChange={e => setNewFiles(Array.from(e.target.files || []))} className="w-full text-sm" />
                {newFiles.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{newFiles.map((f, i) => <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">📎 {f.name}</span>)}</div>}
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg">Annuler</button>
              <button onClick={handleSubmit} disabled={!form.nom || !form.typeLicence} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {editing ? 'Enregistrer' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Permissions */}
      {showPermModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex justify-between items-center p-5 border-b">
              <h2 className="text-lg font-semibold">🔑 Accès — {showPermModal.nom}</h2>
              <button onClick={() => setShowPermModal(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex gap-2">
                <select value={permForm.userId} onChange={e => setPermForm({...permForm, userId: e.target.value})} className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm">
                  <option value="">Sélectionner un utilisateur</option>
                  {users.filter((u: any) => u.id !== user?.id).map((u: any) => <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>)}
                </select>
                <select value={permForm.niveau} onChange={e => setPermForm({...permForm, niveau: e.target.value})} className="border border-gray-300 rounded-md px-3 py-2 text-sm">
                  {NIVEAUX.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
                </select>
                <button onClick={handleAddPerm} className="px-3 py-2 bg-blue-600 text-white rounded-md text-sm">Ajouter</button>
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
              {[{k:'info',l:'ℹ️ Infos'},{k:'docs',l:`📎 Docs (${showDetailModal.documents?.length||0})`},{k:'comments',l:`💬 (${showDetailModal.commentaires?.length||0})`},{k:'notifs',l:'🔔 Alertes'},{k:'acces',l:'🔑 Accès'}].map(t => (
                <button key={t.k} onClick={() => setDetailTab(t.k as any)}
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
                </div>
              )}
              {detailTab === 'docs' && (
                <div className="space-y-2">
                  {showDetailModal.documents?.length === 0 && <p className="text-gray-400 text-sm">Aucun document</p>}
                  {showDetailModal.documents?.map((d: any) => (
                    <div key={d.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <a href={`http://172.17.5.198:4000/api/v1/documents/${d.document?.id}/view?token=${localStorage.getItem('token')}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-sm">
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
    </div>
  );
}
