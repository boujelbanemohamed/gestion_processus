import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, API_BASE_URL } from '../services/api';
import axios from 'axios';

// Instance axios pour uploads (sans Content-Type forcé)
const uploadApi = axios.create({ baseURL: API_BASE_URL });
uploadApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  console.log('[UPLOAD-DEBUG] headers:', config.headers);
  console.log('[UPLOAD-DEBUG] url:', config.url);
  return config;
});
import { useAuth } from '../store/auth';

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

function joursRestants(date: string) {
  const diff = Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
  return diff;
}

export default function Contrats() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [contrats, setContrats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [showPermModal, setShowPermModal] = useState<any>(null);
  const [permForm, setPermForm] = useState({ userId: '', niveau: 'lecture' });
  const [tagInput, setTagInput] = useState('');

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
        api.get('/contrats'), api.get('/users'), api.get('/projets'), api.get('/clients-fournisseurs')
      ]);
      setContrats(c.data); setUsers(u.data); setProjets(p.data); setClientsFournisseurs(cf.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(emptyForm); setFiles([]); setTagInput(''); setPpInput(''); setPpCFId(''); setShowForm(true); };
  const openEdit = (c: any) => {
    setEditing(c);
    setForm({
      nom: c.nom, statut: c.statut,
      dateSignature: c.dateSignature ? c.dateSignature.split('T')[0] : '',
      dateEnregistrement: c.dateEnregistrement ? c.dateEnregistrement.split('T')[0] : '',
      dateExpiration: c.dateExpiration ? c.dateExpiration.split('T')[0] : '',
      tags: c.tags ? JSON.parse(c.tags) : [],
      projetIds: c.projets?.map((p: any) => p.projetId) || [],
      partiesPrenantes: c.partiesPrenantes || [],
    });
    setFiles([]); setTagInput(''); setPpInput(''); setPpCFId(''); setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.nom.trim()) return alert('Le nom est obligatoire');
    const payload = {
      nom: form.nom, statut: form.statut,
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
      // Upload documents séparément si présents
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
      setShowForm(false); load();
    } catch (e: any) { alert(e.response?.data?.error || 'Erreur'); }
  };

  const handleDelete = async (id: string, nom: string) => {
    if (!confirm(`Supprimer le contrat "${nom}" ?`)) return;
    await api.delete(`/contrats/${id}`); load();
  };

  const handleAddPerm = async () => {
    if (!permForm.userId) return;
    await api.post(`/contrats/${showPermModal.id}/permissions`, permForm);
    setPermForm({ userId: '', niveau: 'lecture' }); load();
  };

  const handleRemovePerm = async (contratId: string, userId: string) => {
    await api.delete(`/contrats/${contratId}/permissions/${userId}`); load();
  };

  const handleRemoveDoc = async (contratId: string, documentId: string) => {
    await api.delete(`/contrats/${contratId}/documents/${documentId}`); load();
  };

  const canEdit = (c: any) => user?.role === 'admin' || c.createdById === user?.id || c.permissions?.some((p: any) => p.userId === user?.id && ['modification', 'suppression'].includes(p.niveau));
  const canDelete = (c: any) => user?.role === 'admin' || c.createdById === user?.id || c.permissions?.some((p: any) => p.userId === user?.id && p.niveau === 'suppression');
  const isOwner = (c: any) => user?.role === 'admin' || c.createdById === user?.id;

  const filtered = contrats.filter(c => {
    const matchSearch = c.nom.toLowerCase().includes(search.toLowerCase());
    const matchStatut = !filtreStatut || c.statut === filtreStatut;
    const matchProjets = filtreProjetIds.length === 0 || c.projets?.some((p: any) => filtreProjetIds.includes(p.projetId || p.id));
    const matchParties = filtreParties.length === 0 || filtreParties.some(fp =>
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

  const alertes = contrats.filter(c => c.dateExpiration && joursRestants(c.dateExpiration) <= 30 && joursRestants(c.dateExpiration) > 0);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📄 Contrats</h1>
          <p className="text-sm text-gray-500 mt-1">{contrats.length} contrat(s) accessible(s)</p>
        </div>
        <button onClick={openNew} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">+ Nouveau contrat</button>
      </div>

      {/* Alertes expiration */}
      {alertes.length > 0 && (
        <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
          <p className="text-sm font-medium text-orange-700 mb-1">⚠️ Contrats expirant bientôt :</p>
          <div className="flex flex-wrap gap-2">
            {alertes.map(c => (
              <span key={c.id} className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs">
                {c.nom} — dans {joursRestants(c.dateExpiration)} jour(s)
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="mb-5">
        <div className="flex gap-3 mb-2">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Rechercher..." className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <button onClick={() => setShowFiltres(!showFiltres)} className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${showFiltres ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>
            🔧 Filtres {(filtreStatut || filtreProjetIds.length > 0 || filtreParties.length > 0 || filtreDateSignatureDebut || filtreDateSignatureFin || filtreDateEnregDebut || filtreDateEnregFin || filtreDateExpDebut || filtreDateExpFin) ? '●' : ''}
          </button>
          <button onClick={() => { setFiltreStatut(''); setFiltreProjetIds([]); setFiltreParties([]); setFiltreDateSignatureDebut(''); setFiltreDateSignatureFin(''); setFiltreDateEnregDebut(''); setFiltreDateEnregFin(''); setFiltreDateExpDebut(''); setFiltreDateExpFin(''); }} className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg bg-white">
            ✕ Réinitialiser
          </button>
        </div>
        {showFiltres && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Statut */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Statut</label>
              <select value={filtreStatut} onChange={e => setFiltreStatut(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white">
                <option value="">Tous les statuts</option>
                {STATUTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            {/* Projets liés */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Projets liés</label>
              <div className="border border-gray-300 rounded-md bg-white max-h-28 overflow-y-auto p-2 space-y-1">
                {projets.length === 0 && <span className="text-xs text-gray-400">Aucun projet</span>}
                {projets.map((p: any) => (
                  <label key={p.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
                    <input type="checkbox" checked={filtreProjetIds.includes(p.id)}
                      onChange={e => setFiltreProjetIds(e.target.checked ? [...filtreProjetIds, p.id] : filtreProjetIds.filter(id => id !== p.id))}
                      className="rounded" />
                    {p.nom}
                  </label>
                ))}
              </div>
            </div>
            {/* Parties prenantes */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Parties prenantes</label>
              <div className="border border-gray-300 rounded-md bg-white max-h-28 overflow-y-auto p-2 space-y-1">
                {clientsFournisseurs.length === 0 && <span className="text-xs text-gray-400">Aucune partie</span>}
                {clientsFournisseurs.map((cf: any) => (
                  <label key={cf.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
                    <input type="checkbox" checked={filtreParties.includes(cf.id)}
                      onChange={e => setFiltreParties(e.target.checked ? [...filtreParties, cf.id] : filtreParties.filter(id => id !== cf.id))}
                      className="rounded" />
                    {cf.nom}
                  </label>
                ))}
              </div>
            </div>
            {/* Date signature */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date de signature</label>
              <div className="flex gap-2">
                <input type="date" value={filtreDateSignatureDebut} onChange={e => setFiltreDateSignatureDebut(e.target.value)} className="flex-1 px-2 py-1.5 border border-gray-300 rounded-md text-xs bg-white" placeholder="Début" />
                <input type="date" value={filtreDateSignatureFin} onChange={e => setFiltreDateSignatureFin(e.target.value)} className="flex-1 px-2 py-1.5 border border-gray-300 rounded-md text-xs bg-white" placeholder="Fin" />
              </div>
            </div>
            {/* Date enregistrement */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date d'enregistrement</label>
              <div className="flex gap-2">
                <input type="date" value={filtreDateEnregDebut} onChange={e => setFiltreDateEnregDebut(e.target.value)} className="flex-1 px-2 py-1.5 border border-gray-300 rounded-md text-xs bg-white" />
                <input type="date" value={filtreDateEnregFin} onChange={e => setFiltreDateEnregFin(e.target.value)} className="flex-1 px-2 py-1.5 border border-gray-300 rounded-md text-xs bg-white" />
              </div>
            </div>
            {/* Date expiration */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date d'expiration</label>
              <div className="flex gap-2">
                <input type="date" value={filtreDateExpDebut} onChange={e => setFiltreDateExpDebut(e.target.value)} className="flex-1 px-2 py-1.5 border border-gray-300 rounded-md text-xs bg-white" />
                <input type="date" value={filtreDateExpFin} onChange={e => setFiltreDateExpFin(e.target.value)} className="flex-1 px-2 py-1.5 border border-gray-300 rounded-md text-xs bg-white" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Liste */}
      {loading ? <div className="text-center py-10 text-gray-400">Chargement...</div> : (
        <div className="space-y-4">
          {filtered.length === 0 && <div className="text-center py-10 text-gray-400">Aucun contrat trouvé</div>}
          {filtered.map(c => {
            const statut = STATUTS.find(s => s.value === c.statut);
            const jours = c.dateExpiration ? joursRestants(c.dateExpiration) : null;
            const tags = c.tags ? JSON.parse(c.tags) : [];
            return (
              <div key={c.id} className="bg-white rounded-lg shadow p-5">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
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
                    {/* Tags */}
                    {tags.length > 0 && <div className="flex flex-wrap gap-1 mt-2">{tags.map((t: string) => <span key={t} className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs">🏷 {t}</span>)}</div>}
                    {/* Parties prenantes */}
                    {c.partiesPrenantes?.length > 0 && (
                      <div className="mt-2">
                        <span className="text-xs font-medium text-gray-500 uppercase">Parties prenantes : </span>
                        <span className="text-sm text-gray-700">{c.partiesPrenantes.map((p: any) => p.nom).join(', ')}</span>
                      </div>
                    )}
                    {/* Projets liés */}
                    {c.projets?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {c.projets.map((p: any) => (
                          <span key={p.id} onClick={() => navigate(`/projets/${p.projet?.id}`)} className="cursor-pointer px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs hover:bg-purple-200">📁 {p.projet?.nom}</span>
                        ))}
                      </div>
                    )}
                    {/* Documents */}
                    {c.documents?.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-medium text-gray-500 uppercase mb-1">Documents :</p>
                        <div className="flex flex-wrap gap-1">
                          {c.documents.map((d: any) => (
                            <div key={d.id} className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded text-xs">
                              <a href={`${API_BASE_URL}/documents/${d.document?.id}/view?token=${localStorage.getItem("token")}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">📎 {d.document?.nom}</a>
                              {isOwner(c) && <button onClick={() => handleRemoveDoc(c.id, d.documentId)} className="text-red-400 hover:text-red-600 ml-1">✕</button>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Permissions */}
                    <div className="mt-2">
                      <p className="text-xs font-medium text-gray-500 uppercase mb-1">Accès :</p>
                      <div className="flex flex-wrap gap-2 items-start">
                        {/* Badge accès libre ou restreint */}
                        {(() => {
                          const estRestreint = (c.permissions?.length > 0) || c.documents?.some((d: any) => d.document?.estConfidentiel);
                          return (
                            <div className={`flex flex-col items-center px-3 py-1 rounded text-xs font-medium ${estRestreint ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                              <span className="text-lg">{estRestreint ? '🔒' : '🌐'}</span>
                              <span>{estRestreint ? 'Accès restreint' : 'Accès libre'}</span>
                            </div>
                          );
                        })()}
                        {/* Admins système */}
                        <div className="flex flex-col gap-0.5">
                          <div className="text-xs font-semibold text-gray-700">Super Admin</div>
                          <div className="text-xs text-gray-500 italic">(Admin : modification statut + accès + lecture)</div>
                        </div>
                        {/* Créateur */}
                        {c.createdBy && (
                          <div className="flex flex-col gap-0.5">
                            <div className="text-xs font-semibold text-gray-700">{c.createdBy.prenom} {c.createdBy.nom}</div>
                            <div className="text-xs text-gray-500 italic">(Créateur : modification statut + accès + lecture)</div>
                          </div>
                        )}
                        {/* Permissions explicites */}
                        {c.permissions?.map((p: any) => (
                          <div key={p.id} className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-semibold text-gray-700">{p.user?.prenom} {p.user?.nom}</span>
                              {isOwner(c) && <button onClick={() => handleRemovePerm(c.id, p.userId)} className="text-red-400 hover:text-red-600">✕</button>}
                            </div>
                            <div className="text-xs text-gray-500 italic">
                              ({NIVEAUX.find(n => n.value === p.niveau)?.label} : {
                                p.niveau === 'lecture' ? 'lecture' :
                                p.niveau === 'modification' ? 'modification + lecture' :
                                p.niveau === 'suppression' ? 'suppression + modification + lecture' :
                                p.niveau
                              })
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 ml-4">
                    {canEdit(c) && <button onClick={() => openEdit(c)} className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200">✏️ Modifier</button>}
                    {isOwner(c) && <button onClick={() => { setShowPermModal(c); setPermForm({ userId: '', niveau: 'lecture' }); }} className="px-3 py-1 text-xs bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200">🔑 Accès</button>}
                    {canDelete(c) && <button onClick={() => handleDelete(c.id, c.nom)} className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200">🗑 Supprimer</button>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Formulaire */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">{editing ? '✏️ Modifier le contrat' : '+ Nouveau contrat'}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom du contrat *</label>
                <input value={form.nom} onChange={e => setForm({...form, nom: e.target.value})} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" placeholder="Ex: Contrat de prestation ABC" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
                  <select value={form.statut} onChange={e => setForm({...form, statut: e.target.value})} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
                    {STATUTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date de signature</label>
                  <input type="date" value={form.dateSignature} onChange={e => setForm({...form, dateSignature: e.target.value})} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date d'enregistrement</label>
                  <input type="date" value={form.dateEnregistrement} onChange={e => setForm({...form, dateEnregistrement: e.target.value})} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date d'expiration</label>
                  <input type="date" value={form.dateExpiration} onChange={e => setForm({...form, dateExpiration: e.target.value})} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
                </div>
              </div>
              {/* Parties prenantes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Parties prenantes</label>
                {form.partiesPrenantes.map((pp, i) => (
                  <div key={i} className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 bg-teal-100 text-teal-700 rounded text-xs">{pp.nom}</span>
                    <button type="button" onClick={() => setForm({...form, partiesPrenantes: form.partiesPrenantes.filter((_, j) => j !== i)})} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                  </div>
                ))}
                <div className="flex gap-2 mt-1">
                  <select value={ppCFId} onChange={e => { setPpCFId(e.target.value); if (e.target.value) { const cf = clientsFournisseurs.find((c: any) => c.id === e.target.value); if (cf) setPpInput(cf.nom); } }} className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm">
                    <option value="">— Depuis la liste CF —</option>
                    {clientsFournisseurs.map((cf: any) => <option key={cf.id} value={cf.id}>{cf.nom}</option>)}
                  </select>
                  <input value={ppInput} onChange={e => { setPpInput(e.target.value); setPpCFId(''); }} placeholder="ou saisir manuellement" className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm" />
                  <button type="button" onClick={() => { if (!ppInput.trim()) return; setForm({...form, partiesPrenantes: [...form.partiesPrenantes, { nom: ppInput.trim(), clientFournisseurId: ppCFId || undefined }]}); setPpInput(''); setPpCFId(''); }} className="px-3 py-1 bg-teal-600 text-white rounded text-sm">+</button>
                </div>
              </div>
              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tags / Mots-clés</label>
                <div className="flex flex-wrap gap-1 mb-1">
                  {form.tags.map((t, i) => (
                    <span key={i} className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                      {t} <button type="button" onClick={() => setForm({...form, tags: form.tags.filter((_, j) => j !== i)})} className="text-red-400 hover:text-red-600">✕</button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && tagInput.trim()) { setForm({...form, tags: [...form.tags, tagInput.trim()]}); setTagInput(''); e.preventDefault(); }}} placeholder="Ajouter un tag et appuyer Entrée" className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm" />
                  <button type="button" onClick={() => { if (tagInput.trim()) { setForm({...form, tags: [...form.tags, tagInput.trim()]}); setTagInput(''); }}} className="px-3 py-1 bg-blue-600 text-white rounded text-sm">+</button>
                </div>
              </div>
              {/* Projets liés */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Projets liés</label>
                {form.projetIds.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {form.projetIds.map(pid => {
                      const p = projets.find((pr: any) => pr.id === pid);
                      return p ? <div key={pid} className="flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">📁 {p.nom} <button type="button" onClick={() => setForm({...form, projetIds: form.projetIds.filter(id => id !== pid)})} className="text-red-400 hover:text-red-600">✕</button></div> : null;
                    })}
                  </div>
                )}
                <select onChange={e => { if (e.target.value && !form.projetIds.includes(e.target.value)) setForm({...form, projetIds: [...form.projetIds, e.target.value]}); e.target.value=''; }} className="w-full border border-gray-300 rounded px-2 py-1 text-sm">
                  <option value="">— Ajouter un projet —</option>
                  {projets.filter((p: any) => !form.projetIds.includes(p.id)).map((p: any) => <option key={p.id} value={p.id}>{p.nom}</option>)}
                </select>
              </div>
              {/* Documents */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Documents joints</label>
                {/* Documents existants en mode édition */}
                {editing && editing.documents?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {editing.documents.map((d: any) => (
                      <div key={d.id} className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded text-xs">
                        <a href={`${API_BASE_URL}/documents/${d.document?.id}/view?token=${localStorage.getItem("token")}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">📎 {d.document?.nom}</a>
                        <button type="button" onClick={async () => { await api.delete(`/contrats/${editing.id}/documents/${d.documentId}`); const updated = {...editing, documents: editing.documents.filter((x: any) => x.id !== d.id)}; setEditing(updated); }} className="text-red-400 hover:text-red-600 ml-1">✕</button>
                      </div>
                    ))}
                  </div>
                )}
                <input type="file" multiple onChange={e => setFiles(Array.from(e.target.files || []))} className="w-full text-sm text-gray-600 border border-gray-200 rounded p-1" />
                {files.length > 0 && <p className="text-xs text-gray-500 mt-1">📎 {files.length} fichier(s) sélectionné(s)</p>}
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">Annuler</button>
              <button onClick={handleSave} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Permissions */}
      {showPermModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">🔑 Gestion des accès — {showPermModal.nom}</h3>
            <div className="space-y-2 mb-4">
              {showPermModal.permissions?.length === 0 && <p className="text-sm text-gray-400 italic">Aucun accès partagé</p>}
              {showPermModal.permissions?.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <span>{p.user?.prenom} {p.user?.nom}</span>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs">{NIVEAUX.find(n => n.value === p.niveau)?.label}</span>
                    <button onClick={() => { handleRemovePerm(showPermModal.id, p.userId); setShowPermModal((prev: any) => ({...prev, permissions: prev.permissions.filter((x: any) => x.userId !== p.userId)})); }} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t pt-3">
              <p className="text-sm font-medium text-gray-700 mb-2">Ajouter un accès :</p>
              <div className="flex gap-2 mb-2">
                <select value={permForm.userId} onChange={e => setPermForm({...permForm, userId: e.target.value})} className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm">
                  <option value="">— Utilisateur —</option>
                  {users.filter((u: any) => u.id !== user?.id).map((u: any) => <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>)}
                </select>
                <select value={permForm.niveau} onChange={e => setPermForm({...permForm, niveau: e.target.value})} className="border border-gray-300 rounded px-2 py-1 text-sm">
                  {NIVEAUX.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
                </select>
                <button onClick={handleAddPerm} className="px-3 py-1 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700">+</button>
              </div>
            </div>
            <div className="flex justify-end mt-3">
              <button onClick={() => setShowPermModal(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
