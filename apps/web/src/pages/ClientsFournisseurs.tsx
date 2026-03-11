import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../store/auth';

export default function ClientsFournisseurs() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canEdit = user?.role === 'admin' || user?.role === 'contributeur';

  const [items, setItems] = useState<any[]>([]);
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [typesSociete, setTypesSociete] = useState<any[]>([]);
  const [projets, setProjets] = useState<any[]>([]);
  const [showRepModal, setShowRepModal] = useState(false);
  const [repTarget, setRepTarget] = useState<any>(null);
  const [repForm, setRepForm] = useState({ nom: '', prenom: '', fonction: '', statut: 'en_exercice', dateDebut: '', dateFin: '' });

  const emptyForm = { type: 'client', nom: '', typeSocieteId: '', matriculeFiscale: '', adresse: '', pays: '', projetIds: [] as string[] };
  const [form, setForm] = useState<any>(emptyForm);

  const load = async () => {
    setLoading(true);
    try {
      const [r1, r2, r3] = await Promise.all([
        api.get('/clients-fournisseurs', { params: { type: typeFilter || undefined, search: search || undefined } }),
        api.get('/types-societe'),
        api.get('/projets'),
      ]);
      setItems(r1.data);
      setTypesSociete(r2.data);
      setProjets(r3.data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [typeFilter, search]);

  const openCreate = () => { setForm(emptyForm); setEditing(null); setShowModal(true); };
  const openEdit = (item: any) => {
    setForm({ type: item.type, nom: item.nom, typeSocieteId: item.typeSocieteId || '', matriculeFiscale: item.matriculeFiscale || '', adresse: item.adresse || '', pays: item.pays || '', projetIds: item.projets?.map((p: any) => p.projetId || p.projet?.id) || [] });
    setEditing(item);
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      if (editing) await api.put(`/clients-fournisseurs/${editing.id}`, form);
      else await api.post('/clients-fournisseurs', form);
      setShowModal(false);
      load();
    } catch (e) { alert('Erreur lors de la sauvegarde'); }
  };

  const handleDelete = async (id: string, nom: string) => {
    if (!confirm(`Supprimer "${nom}" ?`)) return;
    await api.delete(`/clients-fournisseurs/${id}`);
    load();
  };

  const openAddRep = (item: any) => { setRepTarget(item); setRepForm({ nom: '', prenom: '', fonction: '', statut: 'en_exercice', dateDebut: '', dateFin: '' }); setShowRepModal(true); };
  const handleSaveRep = async () => {
    try {
      await api.post(`/clients-fournisseurs/${repTarget.id}/representants`, repForm);
      setShowRepModal(false);
      load();
    } catch (e) { alert('Erreur'); }
  };
  const handleUpdateRepStatut = async (cfId: string, repId: string, statut: string) => {
    await api.put(`/clients-fournisseurs/${cfId}/representants/${repId}`, { statut, dateFin: statut === 'fin_exercice' ? new Date().toISOString() : null });
    load();
  };
  const handleDeleteRep = async (cfId: string, repId: string) => {
    if (!confirm('Supprimer ce représentant ?')) return;
    await api.delete(`/clients-fournisseurs/${cfId}/representants/${repId}`);
    load();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">🏢 Clients / Fournisseurs</h1>
        {canEdit && <button onClick={openCreate} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">+ Ajouter</button>}
      </div>

      {/* Filtres */}
      <div className="flex gap-3 mb-6">
        <input type="text" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm flex-1 max-w-xs" />
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm">
          <option value="">Tous</option>
          <option value="client">Clients</option>
          <option value="fournisseur">Fournisseurs</option>
        </select>
      </div>

      {/* Liste */}
      {loading ? <div className="text-center py-10 text-gray-400">Chargement...</div> : (
        <div className="space-y-4">
          {items.length === 0 && <div className="text-center py-10 text-gray-400">Aucune fiche trouvée</div>}
          {items.map(item => (
            <div key={item.id} className="bg-white rounded-lg shadow p-5">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${item.type === 'client' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'}`}>
                      {item.type === 'client' ? '👤 Client' : '🏭 Fournisseur'}
                    </span>
                    <h2 className="text-lg font-semibold text-gray-900">{item.nom}</h2>
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm text-gray-600 mt-2">
                    {item.typeSociete && <div><span className="font-medium">Type : </span>{item.typeSociete.nom}</div>}
                    {item.matriculeFiscale && <div><span className="font-medium">MF/ID : </span>{item.matriculeFiscale}</div>}
                    {item.pays && <div><span className="font-medium">Pays : </span>{item.pays}</div>}
                    {item.adresse && <div><span className="font-medium">Adresse : </span>{item.adresse}</div>}
                  </div>
                  {/* Représentants légaux */}
                  {item.representants?.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-medium text-gray-500 uppercase mb-1">Représentants légaux</p>
                      <div className="space-y-1">
                        {item.representants.map((rep: any) => (
                          <div key={rep.id} className="flex items-center gap-2 text-sm">
                            <span className={`px-1.5 py-0.5 rounded text-xs ${rep.statut === 'en_exercice' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                              {rep.statut === 'en_exercice' ? '✅ En exercice' : '⛔ Fin d\'exercice'}
                            </span>
                            <span className="font-medium">{rep.prenom} {rep.nom}</span>
                            {rep.fonction && <span className="text-gray-400">— {rep.fonction}</span>}
                            {canEdit && (
                              <div className="flex gap-1 ml-auto">
                                {rep.statut === 'en_exercice' && <button onClick={() => handleUpdateRepStatut(item.id, rep.id, 'fin_exercice')} className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200">Fin d'exercice</button>}
                                <button onClick={() => handleDeleteRep(item.id, rep.id)} className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded hover:bg-red-200">🗑</button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Projets liés */}
                  {item.projets?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {item.projets.map((p: any) => (
                        <span key={p.id} onClick={() => navigate(`/projets/${p.projet?.id}`)} className="cursor-pointer px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs hover:bg-purple-200">
                          📁 {p.projet?.nom}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {canEdit && (
                  <div className="flex gap-2 ml-4">
                    <button onClick={() => openAddRep(item)} className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200">👤 + Représentant</button>
                    <button onClick={() => openEdit(item)} className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200">✏️ Modifier</button>
                    <button onClick={() => handleDelete(item.id, item.nom)} className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200">🗑 Supprimer</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Créer/Modifier */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">{editing ? '✏️ Modifier' : '+ Ajouter'} une fiche</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
                  <option value="client">Client</option>
                  <option value="fournisseur">Fournisseur</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom de l'entité *</label>
                <input type="text" value={form.nom} onChange={e => setForm({...form, nom: e.target.value})} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type de société</label>
                <select value={form.typeSocieteId} onChange={e => setForm({...form, typeSocieteId: e.target.value})} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
                  <option value="">— Sélectionner —</option>
                  {typesSociete.map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Matricule Fiscale / Identifiant</label>
                <input type="text" value={form.matriculeFiscale} onChange={e => setForm({...form, matriculeFiscale: e.target.value})} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
                <input type="text" value={form.adresse} onChange={e => setForm({...form, adresse: e.target.value})} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pays</label>
                <input type="text" value={form.pays} onChange={e => setForm({...form, pays: e.target.value})} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Projets liés</label>
                {form.projetIds?.length > 0 && (
                  <div className="space-y-1 mb-2">
                    {form.projetIds.map((pid: string) => {
                      const p = projets.find((pr: any) => pr.id === pid);
                      return p ? (
                        <div key={pid} className="flex items-center gap-2 text-sm">
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded">📁 {p.nom}</span>
                          <button type="button" onClick={() => setForm({...form, projetIds: form.projetIds.filter((id: string) => id !== pid)})} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                        </div>
                      ) : null;
                    })}
                  </div>
                )}
                <div className="flex gap-2">
                  <select id="newProjetSelect" className="flex-1 border border-gray-300 rounded-md px-3 py-1.5 text-sm">
                    <option value="">— Ajouter un projet —</option>
                    {projets.filter((p: any) => !form.projetIds?.includes(p.id)).map((p: any) => <option key={p.id} value={p.id}>{p.nom} ({p.codeProjet})</option>)}
                  </select>
                  <button type="button" onClick={() => { const sel = document.getElementById('newProjetSelect') as HTMLSelectElement; if (sel?.value) { setForm({...form, projetIds: [...(form.projetIds||[]), sel.value]}); sel.value=''; }}} className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">+</button>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">Annuler</button>
              <button onClick={handleSave} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Représentant */}
      {showRepModal && repTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">👤 Ajouter un représentant légal — {repTarget.nom}</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prénom *</label>
                  <input type="text" value={repForm.prenom} onChange={e => setRepForm({...repForm, prenom: e.target.value})} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
                  <input type="text" value={repForm.nom} onChange={e => setRepForm({...repForm, nom: e.target.value})} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fonction</label>
                <input type="text" value={repForm.fonction} onChange={e => setRepForm({...repForm, fonction: e.target.value})} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
                <select value={repForm.statut} onChange={e => setRepForm({...repForm, statut: e.target.value})} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
                  <option value="en_exercice">✅ En cours d'exercice</option>
                  <option value="fin_exercice">⛔ N'est plus dans l'exercice de ses fonctions</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date début</label>
                  <input type="date" value={repForm.dateDebut} onChange={e => setRepForm({...repForm, dateDebut: e.target.value})} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date fin</label>
                  <input type="date" value={repForm.dateFin} onChange={e => setRepForm({...repForm, dateFin: e.target.value})} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowRepModal(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">Annuler</button>
              <button onClick={handleSaveRep} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">Ajouter</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
