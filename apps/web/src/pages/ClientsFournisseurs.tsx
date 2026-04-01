import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../store/auth';

function isoToDateInput(iso: string | null | undefined): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

/** Libellés courts sur la ligne (style aperçu type Documents). */
const LABEL_PERM_ROW: Record<string, string> = {
  lecture: 'lecture',
  modification: 'modification',
  suppression: 'suppression',
  gestion: 'gestion des droits',
};

const LABEL_PERM: Record<string, string> = {
  lecture: 'Consultation',
  modification: 'Modification',
  suppression: 'Suppression (fiche)',
  gestion: 'Gestion',
};

function permSummaryLine(perms: string[]) {
  return perms.map((p) => LABEL_PERM_ROW[p] || p).join(' + ');
}

function isAccesRestreint(item: any) {
  const dels = item.accesApercu?.delegations?.length ?? 0;
  return !!item.createdById || dels > 0;
}

const LABEL_HISTO: Record<string, string> = {
  creation: 'Création de la fiche',
  modification_champs: 'Modification des champs',
  droit_ajoute: 'Droit d’accès accordé',
  droit_retire: 'Droit d’accès retiré',
  representant_ajout: 'Représentant ajouté',
  representant_modification: 'Représentant modifié',
  representant_suppression: 'Représentant supprimé',
  contrat_lie: 'Contrat lié',
  contrat_delie: 'Contrat retiré',
  projet_lie: 'Projet lié',
  projet_delie: 'Projet retiré',
  soft_delete: 'Mise en corbeille',
  restauration: 'Restauration',
};

export default function ClientsFournisseurs() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canCreate = user?.role === 'admin' || user?.role === 'contributeur';

  const capModify = (item: any) =>
    item.capabilities?.canModify ?? (user?.role === 'admin' || user?.role === 'contributeur');
  const capDelete = (item: any) =>
    item.capabilities?.canDelete ?? (user?.role === 'admin' || user?.role === 'contributeur');
  /** Gestion des droits (bouton Accès → modale complète). */
  const capManagePermissions = (item: any) => {
    if (item.capabilities?.canManagePermissions != null) return !!item.capabilities.canManagePermissions;
    return user?.role === 'admin';
  };

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
  const [accesModalItem, setAccesModalItem] = useState<any | null>(null);
  const [accesDetail, setAccesDetail] = useState<any | null>(null);
  const [accesLoading, setAccesLoading] = useState(false);
  const [newPermUserId, setNewPermUserId] = useState('');
  const [newPermType, setNewPermType] = useState('lecture');
  const [histModalItem, setHistModalItem] = useState<any | null>(null);
  const [histoList, setHistoList] = useState<any[]>([]);
  const [histoLoading, setHistoLoading] = useState(false);
  const [noAccesModalOpen, setNoAccesModalOpen] = useState(false);

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
    } catch (e: any) {
      alert(e?.response?.data?.error || e?.message || 'Erreur lors de la sauvegarde');
    }
  };

  const handleDelete = async (id: string, nom: string) => {
    if (!confirm(`Mettre « ${nom} » en corbeille ? Vous pourrez la restaurer depuis la corbeille (admin).`)) return;
    try {
      await api.delete(`/clients-fournisseurs/${id}`);
      load();
    } catch (e: any) {
      alert(e?.response?.data?.error || e?.message || 'Erreur');
    }
  };

  const onAccesButtonClick = (item: any) => {
    if (!capManagePermissions(item)) {
      setNoAccesModalOpen(true);
      return;
    }
    void openAccesModal(item);
  };

  const openAccesModal = async (item: any) => {
    setAccesModalItem(item);
    setAccesDetail(null);
    setNewPermUserId('');
    setNewPermType('lecture');
    setAccesLoading(true);
    try {
      const { data } = await api.get(`/clients-fournisseurs/${item.id}/acces`);
      setAccesDetail(data);
    } catch (e: any) {
      alert(e?.response?.data?.error || e?.message || 'Erreur chargement accès');
      setAccesModalItem(null);
    } finally {
      setAccesLoading(false);
    }
  };

  const openHistoriqueModal = async (item: any) => {
    setHistModalItem(item);
    setHistoList([]);
    setHistoLoading(true);
    try {
      const { data } = await api.get(`/clients-fournisseurs/${item.id}/historique`);
      setHistoList(Array.isArray(data) ? data : []);
    } catch (e: any) {
      alert(e?.response?.data?.error || e?.message || 'Erreur chargement historique');
      setHistModalItem(null);
    } finally {
      setHistoLoading(false);
    }
  };

  const refreshAccesDetail = async (cfId: string) => {
    const { data } = await api.get(`/clients-fournisseurs/${cfId}/acces`);
    setAccesDetail(data);
  };

  const handleAddPermission = async () => {
    if (!accesModalItem || !newPermUserId) return;
    try {
      await api.post(`/clients-fournisseurs/${accesModalItem.id}/permissions`, {
        userId: newPermUserId,
        permission: newPermType,
      });
      setNewPermUserId('');
      await refreshAccesDetail(accesModalItem.id);
      load();
    } catch (e: any) {
      alert(e?.response?.data?.error || e?.message || 'Erreur');
    }
  };

  const handleRemovePermission = async (permissionId: string) => {
    if (!accesModalItem || !confirm('Retirer ce droit ?')) return;
    try {
      await api.delete(`/clients-fournisseurs/${accesModalItem.id}/permissions/${permissionId}`);
      await refreshAccesDetail(accesModalItem.id);
      load();
    } catch (e: any) {
      alert(e?.response?.data?.error || e?.message || 'Erreur');
    }
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

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">🏢 Clients / Fournisseurs</h1>
        {canCreate && <button onClick={openCreate} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">+ Ajouter</button>}
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
              <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1 flex-wrap">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${item.type === 'client' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'}`}>
                      {item.type === 'client' ? '👤 Client' : '🏭 Fournisseur'}
                    </span>
                    <h2 className="text-lg font-semibold text-gray-900">{item.nom}</h2>
                  </div>

                  {/* Aperçu accès (comme colonne Documents) */}
                  <div className="mt-3 flex flex-wrap items-start gap-2 sm:gap-3 text-xs text-gray-700 border border-slate-100 rounded-lg px-3 py-2.5 bg-slate-50/90">
                    <span className="font-semibold text-gray-600 uppercase shrink-0 pt-0.5">Accès :</span>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 min-w-0 flex-1">
                      {isAccesRestreint(item) ? (
                        <div className="inline-flex flex-col items-center justify-center px-2 py-1 rounded-md bg-red-50 border border-red-100 text-red-900 shrink-0">
                          <span className="text-sm leading-none" aria-hidden>🔒</span>
                          <span className="text-[10px] font-semibold leading-tight mt-0.5 text-center">Accès restreint</span>
                        </div>
                      ) : (
                        <div className="inline-flex flex-col items-center justify-center px-2 py-1 rounded-md bg-green-50 border border-green-100 text-green-900 shrink-0">
                          <span className="text-[10px] font-semibold leading-tight text-center">Accès élargi</span>
                          <span className="text-[10px] text-green-800/90 text-center mt-0.5">Tous les contributeurs</span>
                        </div>
                      )}
                      {(() => {
                        const actifAdmins = usersList.filter(
                          (u: any) => u.role === 'admin' && (!u.statut || u.statut === 'actif')
                        );
                        const creatorId = item.createdById || item.createdBy?.id;
                        const droitsComplet = 'modification + suppression + gestion des droits + lecture';
                        return (
                          <>
                            {actifAdmins.map((a: any) => {
                              const isCreator = creatorId === a.id;
                              return (
                                <div key={`adm-${item.id}-${a.id}`} className="min-w-0">
                                  <span className="font-medium text-gray-900">
                                    {a.prenom} {a.nom}
                                  </span>
                                  <span className="text-gray-500 italic block sm:inline sm:ml-1">
                                    {isCreator
                                      ? `(Administrateur et créateur : ${droitsComplet})`
                                      : `(Admin : ${droitsComplet})`}
                                  </span>
                                </div>
                              );
                            })}
                            {item.createdBy &&
                              creatorId &&
                              !actifAdmins.some((a: any) => a.id === creatorId) && (
                                <div className="min-w-0">
                                  <span className="font-medium text-gray-900">
                                    {item.createdBy.prenom} {item.createdBy.nom}
                                  </span>
                                  <span className="text-gray-500 italic block sm:inline sm:ml-1">
                                    (Créateur : {droitsComplet})
                                  </span>
                                </div>
                              )}
                          </>
                        );
                      })()}
                      {(item.accesApercu?.delegations || []).map((d: any) => (
                        <div key={d.user.id} className="min-w-0">
                          <span className="font-medium text-gray-900">
                            {d.user.prenom} {d.user.nom}
                          </span>
                          <span className="text-gray-500 italic block sm:inline sm:ml-1">
                            {d.permissions?.includes('lecture') && d.permissions?.length === 1 ? (
                              <>👁 ({permSummaryLine(d.permissions)})</>
                            ) : (
                              <> ({permSummaryLine(d.permissions)})</>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
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
                            {capModify(item) && (
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
                          {capModify(item) && (
                            <button type="button" onClick={async () => { if (!confirm('Retirer ce contrat de la fiche ?')) return; await api.delete(`/clients-fournisseurs/${item.id}/contrats/${c.id}`); load(); }} className="text-red-500 hover:text-red-700 ml-1 font-bold">✕</button>
                          )}
                        </div>
                      ))}
                      {capModify(item) && showContratSelect !== item.id && (
                        <button type="button" onClick={() => setShowContratSelect(item.id)} className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded text-xs hover:bg-amber-200">+ Lier un contrat</button>
                      )}
                    </div>
                    {capModify(item) && showContratSelect === item.id && (
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
                          {capModify(item) && <button type="button" onClick={async () => { await api.delete(`/clients-fournisseurs/${item.id}/projets/${p.projet?.id}`); load(); }} className="text-red-400 hover:text-red-600 ml-1 font-bold">✕</button>}
                        </div>
                      ))}
                      {capModify(item) && showProjetSelect !== item.id && (
                        <button type="button" onClick={() => setShowProjetSelect(item.id)} className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200">+ Lier projet</button>
                      )}
                    </div>
                    {capModify(item) && showProjetSelect === item.id && (
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
                <div className="flex flex-wrap gap-2 lg:flex-col lg:items-stretch shrink-0 lg:min-w-[11rem]">
                  <button type="button" onClick={() => onAccesButtonClick(item)} className="px-3 py-1.5 text-xs bg-slate-100 text-slate-800 rounded hover:bg-slate-200">🔐 Accès</button>
                  <button type="button" onClick={() => openHistoriqueModal(item)} className="px-3 py-1.5 text-xs bg-gray-100 text-gray-800 rounded hover:bg-gray-200">📜 Historique</button>
                  {capModify(item) && (
                    <>
                      <button type="button" onClick={() => openAddRep(item)} className="px-3 py-1.5 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200">👤 + Représentant</button>
                      <button type="button" onClick={() => openEdit(item)} className="px-3 py-1.5 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200">✏️ Modifier la fiche</button>
                    </>
                  )}
                  {capDelete(item) && (
                    <button type="button" onClick={() => handleDelete(item.id, item.nom)} className="px-3 py-1.5 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200">🗑 Mettre en corbeille</button>
                  )}
                </div>
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

      {accesModalItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-6">
          <div className="bg-white rounded-lg shadow-xl p-6 sm:p-8 w-full max-w-5xl max-h-[min(94vh,960px)] overflow-y-auto">
            <h3 className="text-xl font-semibold mb-2">Accès — {accesModalItem.nom}</h3>
            <p className="text-sm text-gray-600 mb-5 leading-relaxed">
              Les comptes <span className="font-medium">administrateur</span> ont tous les droits sur toutes les fiches. Le{' '}
              <span className="font-medium">créateur</span> de la fiche dispose par défaut de la modification, de la suppression et de la gestion des droits.
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
                      <span className="text-gray-400"> — modification, suppression, octroi des droits</span>
                    </p>
                  ) : (
                    <p className="text-amber-800 text-sm leading-relaxed">
                      Aucun créateur enregistré (fiche existante avant la traçabilité). Tous les contributeurs peuvent modifier tant qu’aucun créateur n’est défini ; seuls les administrateurs peuvent attribuer des droits explicites.
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Droits explicites</p>
                  {(accesDetail.delegations || []).length === 0 ? (
                    <p className="text-gray-400 text-xs italic">Aucun droit délégué</p>
                  ) : (
                    <ul className="space-y-2">
                      {(accesDetail.delegations || []).map((d: any) => (
                        <li key={d.id} className="flex flex-wrap items-center gap-2 border border-gray-100 rounded-md px-3 py-2 bg-gray-50">
                          <span className="font-medium">{d.user.prenom} {d.user.nom}</span>
                          <span className="text-gray-500">— {LABEL_PERM[d.permission] || d.permission}</span>
                          {d.grantedBy && (
                            <span className="text-xs text-gray-400">par {d.grantedBy.prenom} {d.grantedBy.nom}</span>
                          )}
                          {accesDetail.canManagePermissions && (
                            <button
                              type="button"
                              onClick={() => handleRemovePermission(d.id)}
                              className="text-xs text-red-600 hover:underline ml-auto"
                            >
                              Retirer
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {accesDetail.canManagePermissions && (
                  <div className="border-t border-gray-200 pt-4 space-y-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Accorder un droit</p>
                    <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_auto] gap-3 items-end">
                      <select
                        value={newPermUserId}
                        onChange={(e) => setNewPermUserId(e.target.value)}
                        className="w-full min-w-0 border border-gray-300 rounded-md px-3 py-2 text-sm"
                      >
                        <option value="">— Utilisateur —</option>
                        {usersList
                          .filter((u: any) => (!u.statut || u.statut === 'actif') && u.role !== 'admin' && u.id !== accesDetail.creator?.id)
                          .map((u: any) => (
                            <option key={u.id} value={u.id}>{u.prenom} {u.nom} ({u.email})</option>
                          ))}
                      </select>
                      <select
                        value={newPermType}
                        onChange={(e) => setNewPermType(e.target.value)}
                        className="w-full lg:w-56 border border-gray-300 rounded-md px-3 py-2 text-sm"
                      >
                        <option value="lecture">Consultation</option>
                        <option value="modification">Modification</option>
                        <option value="suppression">Suppression (fiche)</option>
                        <option value="gestion">Gestion</option>
                      </select>
                      <button
                        type="button"
                        onClick={handleAddPermission}
                        disabled={!newPermUserId}
                        className="w-full lg:w-auto px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 shrink-0"
                      >
                        Ajouter
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
            <div className="flex justify-end mt-4">
              <button type="button" onClick={() => setAccesModalItem(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">Fermer</button>
            </div>
          </div>
        </div>
      )}

      {histModalItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Historique — {histModalItem.nom}</h3>
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
                    <p className="font-medium text-gray-800">{LABEL_HISTO[h.typeEvenement] || h.typeEvenement}</p>
                    {h.libelle && <p className="text-gray-600 text-xs mt-0.5">{h.libelle}</p>}
                    {h.details && typeof h.details === 'object' && (
                      <pre className="text-xs bg-gray-50 rounded p-2 mt-1 overflow-x-auto max-h-32">{JSON.stringify(h.details, null, 2)}</pre>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex justify-end mt-4">
              <button type="button" onClick={() => setHistModalItem(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">Fermer</button>
            </div>
          </div>
        </div>
      )}

      {noAccesModalOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="no-acces-title"
          onClick={() => setNoAccesModalOpen(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="no-acces-title" className="text-lg font-semibold text-gray-900 mb-2">Accès au bouton « Accès »</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              Vous n&apos;avez pas les droits nécessaires pour ouvrir la gestion des accès de cette fiche. Seuls les{' '}
              <span className="font-medium">administrateurs</span> et le <span className="font-medium">créateur</span>{' '}
              de la fiche peuvent utiliser ce bouton.
            </p>
            <div className="flex justify-end mt-5">
              <button
                type="button"
                onClick={() => setNoAccesModalOpen(false)}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
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
