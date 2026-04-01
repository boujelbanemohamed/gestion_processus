import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../store/auth';

function isoToDateInput(iso: string | null | undefined): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

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
  const [showProjetSelect, setShowProjetSelect] = useState<string | null>(null);
  const [showContratSelect, setShowContratSelect] = useState<string | null>(null);
  const [typesSociete, setTypesSociete] = useState<any[]>([]);
  const [projets, setProjets] = useState<any[]>([]);
  const [contrats, setContrats] = useState<any[]>([]);
  const [showRepModal, setShowRepModal] = useState(false);
  const [repTarget, setRepTarget] = useState<any>(null);
  const [repEditingRep, setRepEditingRep] = useState<any | null>(null);
  const [repForm, setRepForm] = useState({ nom: '', prenom: '', fonction: '', statut: 'en_exercice', dateDebut: '', dateFin: '' });
  const [usersList, setUsersList] = useState<any[]>([]);

  const emptyForm = { type: 'client', nom: '', typeSocieteId: '', matriculeFiscale: '', adresse: '', pays: '', projetIds: [] as string[] };
  const [form, setForm] = useState<any>(emptyForm);

  const load = async () => {
    setLoading(true);
    try {
      const [r1, r2, r3, r4] = await Promise.all([
        api.get('/clients-fournisseurs', { params: { type: typeFilter || undefined, search: search || undefined } }),
        api.get('/types-societe'),
        api.get('/projets'),
        api.get('/contrats').catch(() => ({ data: [] })),
      ]);
      setItems(r1.data);
      setTypesSociete(r2.data);
      setProjets(r3.data);
      setContrats(Array.isArray(r4.data) ? r4.data : []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [typeFilter, search]);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get('/users');
        setUsersList(Array.isArray(r.data) ? r.data : []);
      } catch {
        setUsersList([]);
      }
    })();
  }, []);

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

  const openAddRep = (item: any) => {
    setRepTarget(item);
    setRepEditingRep(null);
    setRepForm({ nom: '', prenom: '', fonction: '', statut: 'en_exercice', dateDebut: '', dateFin: '' });
    setShowRepModal(true);
  };

  const openEditRep = (item: any, rep: any) => {
    setRepTarget(item);
    setRepEditingRep(rep);
    setRepForm({
      nom: rep.nom || '',
      prenom: rep.prenom || '',
      fonction: rep.fonction || '',
      statut: rep.statut === 'fin_exercice' ? 'fin_exercice' : 'en_exercice',
      dateDebut: isoToDateInput(rep.dateDebut),
      dateFin: isoToDateInput(rep.dateFin),
    });
    setShowRepModal(true);
  };

  const handleSaveRep = async () => {
    if (!repTarget) return;
    try {
      if (repEditingRep) {
        await api.put(`/clients-fournisseurs/${repTarget.id}/representants/${repEditingRep.id}`, repForm);
      } else {
        await api.post(`/clients-fournisseurs/${repTarget.id}/representants`, repForm);
      }
      setShowRepModal(false);
      setRepEditingRep(null);
      load();
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || 'Erreur lors de l’enregistrement du représentant';
      alert(msg);
    }
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

  const roleOrdre = (r: string) => (r === 'admin' ? 0 : r === 'contributeur' ? 1 : 2);
  const libelleRoleAcces = (r: string) =>
    r === 'admin' ? 'Admin' : r === 'contributeur' ? 'Contributeur' : 'Lecteur — consultation seule';

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

      <div className="mb-6 text-xs text-gray-600 bg-slate-50 border border-slate-100 rounded-md px-3 py-2.5">
        <p className="font-semibold text-slate-700 mb-1.5">Accès</p>
        <div className="space-y-0.5">
          {(() => {
            const actifs = usersList.filter((u: any) => !u.statut || u.statut === 'actif');
            if (actifs.length === 0) {
              return <span className="italic text-gray-400">Liste des utilisateurs non disponible</span>;
            }
            const sorted = [...actifs].sort((a, b) => {
              const d = roleOrdre(a.role) - roleOrdre(b.role);
              if (d !== 0) return d;
              const na = `${a.prenom || ''} ${a.nom || ''}`.trim().toLowerCase();
              const nb = `${b.prenom || ''} ${b.nom || ''}`.trim().toLowerCase();
              return na.localeCompare(nb, 'fr');
            });
            return sorted.map((u: any) => (
              <div key={u.id}>
                <span className="font-medium">{u.prenom} {u.nom}</span>{' '}
                <span className="text-gray-400">({libelleRoleAcces(u.role)})</span>
              </div>
            ));
          })()}
        </div>
      </div>

      {/* Liste */}
      {loading ? <div className="text-center py-10 text-gray-400">Chargement...</div> : (
        <div className="space-y-4">
          {items.length === 0 && <div className="text-center py-10 text-gray-400">Aucune fiche trouvée</div>}
          {items.map(item => (
            <div key={item.id} className="bg-white rounded-lg shadow p-5">
              <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1 flex-wrap">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${item.type === 'client' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'}`}>
                      {item.type === 'client' ? '👤 Client' : '🏭 Fournisseur'}
                    </span>
                    <h2 className="text-lg font-semibold text-gray-900">{item.nom}</h2>
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm text-gray-600 mt-3">
                    {item.typeSociete && <div><span className="font-medium">Type : </span>{item.typeSociete.nom}</div>}
                    {item.matriculeFiscale && <div><span className="font-medium">MF/ID : </span>{item.matriculeFiscale}</div>}
                    {item.pays && <div><span className="font-medium">Pays : </span>{item.pays}</div>}
                    {item.adresse && <div><span className="font-medium">Adresse : </span>{item.adresse}</div>}
                  </div>
                  {/* Représentants légaux */}
                  <div className="mt-3">
                    <p className="text-xs font-medium text-gray-500 uppercase mb-1">Représentants légaux</p>
                    {item.representants?.length > 0 ? (
                      <div className="space-y-2">
                        {item.representants.map((rep: any) => (
                          <div key={rep.id} className="flex flex-wrap items-center gap-2 text-sm border border-gray-100 rounded-md px-2 py-1.5 bg-gray-50/80">
                            <span className={`px-1.5 py-0.5 rounded text-xs shrink-0 ${rep.statut === 'en_exercice' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                              {rep.statut === 'en_exercice' ? '✅ En exercice' : '⛔ Fin d\'exercice'}
                            </span>
                            <span className="font-medium">{rep.prenom} {rep.nom}</span>
                            {rep.fonction && <span className="text-gray-400">— {rep.fonction}</span>}
                            {canEdit && (
                              <div className="flex flex-wrap gap-1 ml-auto">
                                <button type="button" onClick={() => openEditRep(item, rep)} className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded hover:bg-blue-200">✏️ Modifier</button>
                                {rep.statut === 'en_exercice' && (
                                  <button type="button" onClick={() => handleUpdateRepStatut(item.id, rep.id, 'fin_exercice')} className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200">Fin d&apos;exercice</button>
                                )}
                                <button type="button" onClick={() => handleDeleteRep(item.id, rep.id)} className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded hover:bg-red-200">🗑 Supprimer</button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400">Aucun représentant enregistré</p>
                    )}
                  </div>
                  {/* Contrats liés */}
                  <div className="mt-3">
                    <p className="text-xs font-medium text-gray-500 uppercase mb-1">Contrats liés</p>
                    <div className="flex flex-wrap gap-1 mb-1">
                      {(item.contratsLies || []).map((c: any) => (
                        <div key={c.id} className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-900 border border-amber-100 rounded text-xs">
                          <button type="button" className="hover:underline text-left" onClick={() => navigate('/contrats')}>📄 {c.nom}</button>
                          <span className="text-amber-600/80">({c.statut})</span>
                          {canEdit && (
                            <button type="button" onClick={async () => { if (!confirm('Retirer ce contrat de la fiche ?')) return; await api.delete(`/clients-fournisseurs/${item.id}/contrats/${c.id}`); load(); }} className="text-red-500 hover:text-red-700 ml-1 font-bold">✕</button>
                          )}
                        </div>
                      ))}
                      {canEdit && showContratSelect !== item.id && (
                        <button type="button" onClick={() => setShowContratSelect(item.id)} className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded text-xs hover:bg-amber-200">+ Lier un contrat</button>
                      )}
                    </div>
                    {canEdit && showContratSelect === item.id && (
                      <div className="flex flex-wrap gap-2 mt-1">
                        <select id={`contratSel-${item.id}`} className="flex-1 min-w-[12rem] border border-gray-300 rounded px-2 py-1 text-xs">
                          <option value="">— Sélectionner un contrat —</option>
                          {contrats.filter((ct: any) => !(item.contratsLies || []).some((cl: any) => cl.id === ct.id)).map((ct: any) => (
                            <option key={ct.id} value={ct.id}>{ct.nom}</option>
                          ))}
                        </select>
                        <button type="button" onClick={async () => {
                          const sel = document.getElementById(`contratSel-${item.id}`) as HTMLSelectElement;
                          if (!sel?.value) return;
                          try {
                            await api.post(`/clients-fournisseurs/${item.id}/contrats`, { contratId: sel.value });
                            setShowContratSelect(null);
                            load();
                          } catch (err: any) {
                            alert(err?.response?.data?.error || err?.message || 'Erreur');
                          }
                        }} className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">Lier</button>
                        <button type="button" onClick={() => setShowContratSelect(null)} className="px-2 py-1 border border-gray-300 rounded text-xs hover:bg-gray-50">✕</button>
                      </div>
                    )}
                  </div>
                  {/* Projets liés */}
                  <div className="mt-3">
                    <p className="text-xs font-medium text-gray-500 uppercase mb-1">Projets liés</p>
                    <div className="flex flex-wrap gap-1 mb-1">
                      {item.projets?.map((p: any) => (
                        <div key={p.id} className="flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                          <span className="cursor-pointer hover:underline" onClick={() => navigate(`/projets/${p.projet?.id}`)}>📁 {p.projet?.nom}</span>
                          {canEdit && <button type="button" onClick={async () => { await api.delete(`/clients-fournisseurs/${item.id}/projets/${p.projet?.id}`); load(); }} className="text-red-400 hover:text-red-600 ml-1 font-bold">✕</button>}
                        </div>
                      ))}
                      {canEdit && showProjetSelect !== item.id && (
                        <button type="button" onClick={() => setShowProjetSelect(item.id)} className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200">+ Lier projet</button>
                      )}
                    </div>
                    {canEdit && showProjetSelect === item.id && (
                      <div className="flex flex-wrap gap-2 mt-1">
                        <select id={`projetSel-${item.id}`} className="flex-1 min-w-[12rem] border border-gray-300 rounded px-2 py-1 text-xs">
                          <option value="">— Sélectionner —</option>
                          {projets.filter((pr: any) => !item.projets?.some((p: any) => p.projet?.id === pr.id)).map((pr: any) => (
                            <option key={pr.id} value={pr.id}>{pr.nom} ({pr.codeProjet})</option>
                          ))}
                        </select>
                        <button type="button" onClick={async () => { const sel = document.getElementById(`projetSel-${item.id}`) as HTMLSelectElement; if (!sel?.value) return; await api.post(`/clients-fournisseurs/${item.id}/projets`, { projetId: sel.value }); setShowProjetSelect(null); load(); }} className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">Lier</button>
                        <button type="button" onClick={() => setShowProjetSelect(null)} className="px-2 py-1 border border-gray-300 rounded text-xs hover:bg-gray-50">✕</button>
                      </div>
                    )}
                  </div>
                </div>
                {canEdit && (
                  <div className="flex flex-wrap gap-2 lg:flex-col lg:items-stretch shrink-0 lg:min-w-[11rem]">
                    <button type="button" onClick={() => openAddRep(item)} className="px-3 py-1.5 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200">👤 + Représentant</button>
                    <button type="button" onClick={() => openEdit(item)} className="px-3 py-1.5 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200">✏️ Modifier la fiche</button>
                    <button type="button" onClick={() => handleDelete(item.id, item.nom)} className="px-3 py-1.5 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200">🗑 Supprimer la fiche</button>
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
              <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">Annuler</button>
              <button type="button" onClick={handleSave} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Représentant */}
      {showRepModal && repTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">
              {repEditingRep ? '✏️ Modifier le représentant légal' : '👤 Ajouter un représentant légal'} — {repTarget.nom}
            </h3>
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
              <button type="button" onClick={() => { setShowRepModal(false); setRepEditingRep(null); }} className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">Annuler</button>
              <button type="button" onClick={handleSaveRep} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">{repEditingRep ? 'Enregistrer' : 'Ajouter'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
