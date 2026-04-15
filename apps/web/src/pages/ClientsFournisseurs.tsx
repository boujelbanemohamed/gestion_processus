import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AccessContratLikeAdminLines } from '../components/AccessContratLikeAdminLines';
import { api } from '../services/api';
import { useAuth } from '../store/auth';
import { getPaginationPageNumbers } from '../utils/pagination';

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

const CF_PERM_LEVELS = [
  { value: 'lecture', label: '👁 Consultation' },
  { value: 'modification', label: '✏️ Modification' },
  { value: 'suppression', label: '🗑 Suppression (fiche)' },
  { value: 'gestion', label: '🔐 Gestion des droits' },
];

const droitsAdminCfLigne = 'modification + suppression + gestion des droits + lecture';

function permSummaryLine(perms: string[]) {
  return perms.map((p) => LABEL_PERM_ROW[p] || p).join(' + ');
}

function cfPermissionsForAdminLines(delegations: any[]) {
  return (delegations || []).map((d: any) => ({
    userId: d.user?.id,
    niveau: permSummaryLine(d.permissions || []),
    user: d.user,
  }));
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

  const [items, setItems] = useState<any[]>([]);
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [searchIdCf, setSearchIdCf] = useState('');
  const [showFiltres, setShowFiltres] = useState(false);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 10;
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
  const [repForm, setRepForm] = useState({
    nom: '',
    prenom: '',
    fonction: '',
    email: '',
    telephone: '',
    statut: 'en_exercice',
    dateDebut: '',
    dateFin: '',
  });
  const [usersList, setUsersList] = useState<any[]>([]);
  const [accesModalItem, setAccesModalItem] = useState<any | null>(null);
  const [accesDetail, setAccesDetail] = useState<any | null>(null);
  const [accesLoading, setAccesLoading] = useState(false);
  const [adminLimitPerm, setAdminLimitPerm] = useState<Record<string, string>>({});
  const [newPermUserId, setNewPermUserId] = useState('');
  const [newPermType, setNewPermType] = useState('lecture');
  const [histModalItem, setHistModalItem] = useState<any | null>(null);
  const [histoList, setHistoList] = useState<any[]>([]);
  const [histoLoading, setHistoLoading] = useState(false);
  const [expandedCfIds, setExpandedCfIds] = useState<Set<string>>(() => new Set());
  const [showCorbeilleModal, setShowCorbeilleModal] = useState(false);
  const [corbeilleItems, setCorbeilleItems] = useState<any[]>([]);

  const toggleCfRow = (id: string) => {
    setExpandedCfIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isCfRowExpanded = (id: string) => expandedCfIds.has(id);

  const emptyForm = {
    type: 'client',
    nom: '',
    typeSocieteId: '',
    matriculeFiscale: '',
    adresse: '',
    pays: '',
    projetIds: [] as string[],
    contratIds: [] as string[],
  };
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
    setPage(1);
  }, [typeFilter, search, searchIdCf]);

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

  const loadCorbeilleClientsFournisseurs = async () => {
    try {
      const r = await api.get('/clients-fournisseurs/corbeille');
      setCorbeilleItems(Array.isArray(r.data) ? r.data : []);
    } catch {
      setCorbeilleItems([]);
    }
  };

  const handleRestoreCfFromCorbeille = async (id: string) => {
    try {
      await api.post(`/corbeille/clients-fournisseurs/${id}/restaurer`);
      setShowCorbeilleModal(false);
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Erreur lors de la restauration');
    }
  };

  const canRestoreCfCorbeille = (row: any) =>
    user?.role === 'admin' || row.createdById === user?.id || row.createdBy?.id === user?.id;

  const openCreate = () => { setForm(emptyForm); setEditing(null); setShowModal(true); };
  const openEdit = (item: any) => {
    setForm({
      type: item.type,
      nom: item.nom,
      typeSocieteId: item.typeSocieteId || '',
      matriculeFiscale: item.matriculeFiscale || '',
      adresse: item.adresse || '',
      pays: item.pays || '',
      projetIds: item.projets?.map((p: any) => p.projetId || p.projet?.id) || [],
      contratIds: (item.contratsLies || []).map((c: any) => c.id),
    });
    setEditing(item);
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      const { contratIds, ...cfPayload } = form;
      if (editing) {
        await api.put(`/clients-fournisseurs/${editing.id}`, cfPayload);
        const prevIds = new Set((editing.contratsLies || []).map((c: any) => c.id));
        const nextIds = new Set(contratIds || []);
        for (const cid of nextIds) {
          if (!prevIds.has(cid)) {
            await api.post(`/clients-fournisseurs/${editing.id}/contrats`, { contratId: cid });
          }
        }
        for (const cid of prevIds) {
          if (!nextIds.has(cid)) {
            await api.delete(`/clients-fournisseurs/${editing.id}/contrats/${cid}`);
          }
        }
      } else {
        const res = await api.post('/clients-fournisseurs', cfPayload);
        const newId = res.data?.id as string | undefined;
        if (newId && contratIds?.length) {
          for (const cid of contratIds) {
            await api.post(`/clients-fournisseurs/${newId}/contrats`, { contratId: cid });
          }
        }
      }
      setShowModal(false);
      load();
    } catch (e: any) {
      alert(e?.response?.data?.error || e?.message || 'Erreur lors de la sauvegarde');
    }
  };

  const handleDelete = async (id: string, nom: string) => {
    if (!confirm(`Mettre « ${nom} » en corbeille ? Vous pourrez la restaurer depuis la corbeille (admin ou créateur).`)) return;
    try {
      await api.delete(`/clients-fournisseurs/${id}`);
      load();
    } catch (e: any) {
      alert(e?.response?.data?.error || e?.message || 'Erreur');
    }
  };

  const onAccesButtonClick = (item: any) => {
    void openAccesModal(item);
  };

  const openAccesModal = async (item: any) => {
    setAccesModalItem(item);
    setAccesDetail(null);
    setNewPermUserId('');
    setNewPermType('lecture');
    setAdminLimitPerm({});
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

  const handleRemovePermission = async (permissionId: string, targetIsAdmin?: boolean) => {
    const msg = targetIsAdmin
      ? "Révoquer cet accès ? L'administrateur n'aura plus aucun droit explicite sur cette fiche. Vous pourrez lui accorder à nouveau un accès via « Accorder un accès »."
      : 'Retirer ce droit ?';
    if (!accesModalItem || !window.confirm(msg)) return;
    try {
      await api.delete(`/clients-fournisseurs/${accesModalItem.id}/permissions/${permissionId}`);
      await refreshAccesDetail(accesModalItem.id);
      load();
    } catch (e: any) {
      alert(e?.response?.data?.error || e?.message || 'Erreur');
    }
  };

  const revokeAllCfDelegationsForUser = async (userId: string) => {
    if (!accesModalItem || !accesDetail) return;
    const rows = (accesDetail.delegations || []).filter((d: any) => d.user?.id === userId);
    if (rows.length === 0) return;
    if (!window.confirm('Révoquer tous les droits explicites pour cet utilisateur sur cette fiche ?')) return;
    try {
      for (const r of rows) {
        await api.delete(`/clients-fournisseurs/${accesModalItem.id}/permissions/${r.id}`);
      }
      await refreshAccesDetail(accesModalItem.id);
      load();
    } catch (e: any) {
      alert(e?.response?.data?.error || e?.message || 'Erreur');
    }
  };

  const handleRestoreAdminDefaultCf = async (userId: string) => {
    if (!accesModalItem) return;
    if (!window.confirm("Rétablir l'accès administrateur par défaut (complet) pour cet utilisateur ?")) return;
    try {
      await api.delete(`/clients-fournisseurs/${accesModalItem.id}/admin-sans-acces/${userId}`);
      await refreshAccesDetail(accesModalItem.id);
      load();
    } catch (e: any) {
      alert(e?.response?.data?.error || e?.message || 'Erreur');
    }
  };

  const handleRevokeAdminImplicitCf = async (userId: string) => {
    if (!accesModalItem) return;
    if (
      !window.confirm(
        "Retirer tout accès à cet administrateur ? Il ne verra plus la fiche tant que vous ne lui aurez pas accordé un accès via la liste ci-dessous."
      )
    ) {
      return;
    }
    try {
      await api.post(`/clients-fournisseurs/${accesModalItem.id}/admin-sans-acces`, { userId });
      await refreshAccesDetail(accesModalItem.id);
      load();
    } catch (e: any) {
      alert(e?.response?.data?.error || e?.message || 'Erreur');
    }
  };

  const quickLimitAdminCf = async (userId: string) => {
    if (!accesModalItem) return;
    const permission = adminLimitPerm[userId] || 'lecture';
    try {
      await api.post(`/clients-fournisseurs/${accesModalItem.id}/permissions`, { userId, permission });
      await refreshAccesDetail(accesModalItem.id);
      load();
    } catch (e: any) {
      alert(e?.response?.data?.error || e?.message || 'Erreur');
    }
  };

  const replaceAdminCfPermissionLevel = async (userId: string, permission: string) => {
    if (!accesModalItem || !accesDetail) return;
    const rows = (accesDetail.delegations || []).filter((d: any) => d.user?.id === userId);
    try {
      for (const r of rows) {
        await api.delete(`/clients-fournisseurs/${accesModalItem.id}/permissions/${r.id}`);
      }
      await api.post(`/clients-fournisseurs/${accesModalItem.id}/permissions`, { userId, permission });
      await refreshAccesDetail(accesModalItem.id);
      load();
    } catch (e: any) {
      alert(e?.response?.data?.error || e?.message || 'Erreur');
    }
  };

  const openAddRep = (item: any) => {
    setRepTarget(item);
    setRepEditingRep(null);
    setRepForm({
      nom: '',
      prenom: '',
      fonction: '',
      email: '',
      telephone: '',
      statut: 'en_exercice',
      dateDebut: '',
      dateFin: '',
    });
    setShowRepModal(true);
  };

  const openEditRep = (item: any, rep: any) => {
    setRepTarget(item);
    setRepEditingRep(rep);
    setRepForm({
      nom: rep.nom || '',
      prenom: rep.prenom || '',
      fonction: rep.fonction || '',
      email: rep.email || '',
      telephone: rep.telephone || '',
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

  const filteredItems = useMemo(() => {
    const needle = searchIdCf.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((it) => String(it.id).toLowerCase().includes(needle));
  }, [items, searchIdCf]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * pageSize;
  const pagedItems = filteredItems.slice(startIdx, startIdx + pageSize);

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Clients / Fournisseurs</h1>
        <div className="flex flex-wrap gap-2 justify-end">
          <button
            type="button"
            onClick={async () => {
              await loadCorbeilleClientsFournisseurs();
              setShowCorbeilleModal(true);
            }}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
          >
            🗑 Corbeille
          </button>
          {canCreate && (
            <button
              type="button"
              onClick={openCreate}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium shadow-sm"
            >
              + Ajouter
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow mb-6">
        <button
          type="button"
          onClick={() => setShowFiltres(!showFiltres)}
          className="w-full px-4 py-3 flex justify-between items-center text-left text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-t-lg"
        >
          <span>
            Filtres
            {(search || typeFilter || searchIdCf.trim()) ? ' ●' : ''}
          </span>
          <span className="text-gray-400">{showFiltres ? '▼' : '▶'}</span>
        </button>
        {showFiltres && (
          <div className="px-4 pb-4 pt-0 border-t border-gray-100">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nom / recherche</label>
                <input
                  type="text"
                  placeholder="Rechercher…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">ID client / fournisseur</label>
                <input
                  type="text"
                  placeholder="Extrait d’UUID…"
                  value={searchIdCf}
                  onChange={(e) => setSearchIdCf(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="">Tous</option>
                  <option value="client">Clients</option>
                  <option value="fournisseur">Fournisseurs</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end mt-3">
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setSearchIdCf('');
                  setTypeFilter('');
                }}
                className="px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Réinitialiser
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Liste */}
      {loading ? <div className="text-center py-10 text-gray-400">Chargement...</div> : (
        <div className="space-y-4">
          {filteredItems.length === 0 && <div className="text-center py-10 text-gray-400">Aucune fiche trouvée</div>}
          {pagedItems.map((item) => {
            const rowOpen = isCfRowExpanded(item.id);
            return (
            <div key={item.id} className="bg-white rounded-lg shadow overflow-hidden">
              <button
                type="button"
                onClick={() => toggleCfRow(item.id)}
                className="w-full flex flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                aria-expanded={rowOpen}
                aria-label={
                  rowOpen
                    ? 'Replier le détail de la fiche'
                    : 'Afficher le détail et les actions de la fiche'
                }
              >
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 ${item.type === 'client' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'}`}
                >
                  {item.type === 'client' ? '👤 Client' : '🏭 Fournisseur'}
                </span>
                <h2 className="text-base sm:text-lg font-semibold text-gray-900 min-w-0 flex-1 truncate">{item.nom}</h2>
                <span
                  className="text-[11px] text-gray-400 font-mono shrink-0 max-w-[7rem] sm:max-w-[10rem] truncate"
                  title={item.id}
                >
                  {item.id}
                </span>
                <span className="text-sm text-gray-500 font-mono shrink-0 hidden md:inline">{item.matriculeFiscale || '—'}</span>
                {rowOpen && (
                  <span className="text-gray-400 shrink-0 ml-auto" aria-hidden>
                    ▼
                  </span>
                )}
              </button>

              {rowOpen && (
                <div className="px-4 sm:px-5 pb-4 pt-0 border-t border-gray-100">
                  <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4 pt-3">
                    <div className="min-w-0 flex-1 space-y-2">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm text-gray-600">
                    <div className="col-span-2 lg:col-span-4">
                      <span className="font-medium">ID : </span>
                      <span className="font-mono text-xs break-all">{item.id}</span>
                    </div>
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
                            {(rep.email || rep.telephone) && (
                              <span className="text-gray-500 text-xs w-full basis-full flex flex-wrap gap-x-3 gap-y-0.5">
                                {rep.email && (
                                  <span>
                                    E-mail :{" "}
                                    <a href={`mailto:${rep.email}`} className="text-blue-700 hover:underline break-all">
                                      {rep.email}
                                    </a>
                                  </span>
                                )}
                                {rep.telephone && (
                                  <span>
                                    Tél. :{" "}
                                    <a
                                      href={`tel:${String(rep.telephone).replace(/\s/g, "")}`}
                                      className="tabular-nums text-gray-700 hover:underline"
                                    >
                                      {rep.telephone}
                                    </a>
                                  </span>
                                )}
                              </span>
                            )}
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

                  {/* Aperçu accès — après projets liés */}
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
                      <AccessContratLikeAdminLines
                        users={usersList}
                        createdById={item.createdById}
                        createdBy={item.createdBy}
                        adminSansAccesUserIds={item.adminSansAccesUserIds}
                        permissions={cfPermissionsForAdminLines(item.accesApercu?.delegations || [])}
                        droitsAdminCompletLabel={droitsAdminCfLigne}
                        niveauLabel={(n) => n}
                        keyPrefix={`liste-cf-${item.id}`}
                        creatorRightsLabel={droitsAdminCfLigne}
                      />
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
                      <p className="text-[10px] text-gray-500 w-full basis-full">
                        Aligné sur les contrats : exclusion ou droits explicites pour les administrateurs sont visibles ici
                        et gérés dans la modale « Accès » (créateur ou habilitation gestion sur la fiche).
                      </p>
                    </div>
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
                  )}
            </div>
            );
          })}
          {filteredItems.length > pageSize && (
            <div className="mt-6 flex items-center justify-between border-t border-gray-200 pt-4 flex-wrap gap-3">
              <div className="text-sm text-gray-700">
                Affichage {startIdx + 1}-{Math.min(startIdx + pageSize, filteredItems.length)} sur {filteredItems.length}
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contrats liés</label>
                <p className="text-xs text-gray-500 mb-2">Optionnel — contrats déjà enregistrés dans l’application.</p>
                {form.contratIds?.length > 0 && (
                  <div className="space-y-1 mb-2">
                    {form.contratIds.map((cid: string) => {
                      const c = contrats.find((ct: any) => ct.id === cid);
                      return c ? (
                        <div key={cid} className="flex items-center gap-2 text-sm">
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded">📄 {c.nom}</span>
                          <button
                            type="button"
                            onClick={() => setForm({ ...form, contratIds: form.contratIds.filter((id: string) => id !== cid) })}
                            className="text-red-400 hover:text-red-600 text-xs"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div key={cid} className="text-xs text-gray-500">Contrat {cid.slice(0, 8)}…</div>
                      );
                    })}
                  </div>
                )}
                <div className="flex gap-2">
                  <select id="modalContratSelect" className="flex-1 border border-gray-300 rounded-md px-3 py-1.5 text-sm">
                    <option value="">— Ajouter un contrat —</option>
                    {contrats
                      .filter((ct: any) => !form.contratIds?.includes(ct.id))
                      .map((ct: any) => (
                        <option key={ct.id} value={ct.id}>
                          {ct.nom}
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      const sel = document.getElementById('modalContratSelect') as HTMLSelectElement;
                      if (sel?.value) {
                        setForm({ ...form, contratIds: [...(form.contratIds || []), sel.value] });
                        sel.value = '';
                      }
                    }}
                    className="px-3 py-1.5 bg-amber-600 text-white rounded text-sm hover:bg-amber-700"
                  >
                    +
                  </button>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                <input
                  type="email"
                  autoComplete="off"
                  placeholder="Facultatif"
                  value={repForm.email}
                  onChange={(e) => setRepForm({ ...repForm, email: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                <input
                  type="tel"
                  autoComplete="off"
                  placeholder="Facultatif"
                  value={repForm.telephone}
                  onChange={(e) => setRepForm({ ...repForm, telephone: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
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
              Le <span className="font-medium">créateur</span> de la fiche et les utilisateurs habilités (selon les règles
              métier) peuvent gérer les accès. Pour un administrateur : sans ligne dans « Accès partagés » et sans exclusion,
              accès complet ; une ligne limite les droits ; « Retirer l&apos;accès » retire tout accès jusqu&apos;à octroi via
              « Accorder un accès » ; « Rétablir l&apos;accès admin par défaut » annule une exclusion.
            </p>
            {accesDetail && !accesDetail.canManagePermissions && (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-md px-3 py-2 mb-4">
                Vous consultez la liste en lecture seule. Pour modifier les droits, connectez-vous avec un compte autorisé à
                gérer cette fiche (créateur ou droits de gestion).
              </p>
            )}
            {accesLoading ? (
              <p className="text-sm text-gray-500">Chargement…</p>
            ) : accesDetail ? (
              <div className="space-y-5 text-sm">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Administrateurs</p>
                  <p className="text-xs text-gray-500 mb-2">
                    Limitez un admin avec « Limiter l&apos;accès », retirez-le entièrement avec « Retirer l&apos;accès », ou
                    rétablissez l&apos;accès complet implicite s&apos;il était exclu.
                  </p>
                  <ul className="space-y-3 text-gray-700 text-sm">
                    {(accesDetail.admins || []).map((a: any) => {
                      const userDelegations = (accesDetail.delegations || []).filter((d: any) => d.user?.id === a.id);
                      const primaryDelegation = userDelegations[0];
                      const explicite = userDelegations.length > 0;
                      const isCreatorAdmin = accesDetail.creator?.id === a.id;
                      const refuse = (accesDetail.adminSansAccesUserIds || []).includes(a.id);
                      return (
                        <li
                          key={a.id}
                          className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 border border-gray-100 rounded-lg px-3 py-2 bg-white"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="font-medium text-base">
                              {a.prenom} {a.nom}
                            </span>
                            <span className="text-gray-500 ml-1">({a.email})</span>
                            {refuse && !explicite && (
                              <span className="text-red-700 block sm:inline sm:ml-1 text-xs font-medium">
                                — aucun accès (exclu ; accorder un accès via la liste ci-dessous pour le réintégrer)
                              </span>
                            )}
                            {!refuse && !explicite && (
                              <span className="text-gray-400 block sm:inline sm:ml-1">
                                — accès complet (défaut administrateur)
                              </span>
                            )}
                            {explicite && (
                              <span className="text-amber-800 block sm:inline sm:ml-1 text-xs font-medium">
                                — accès limité (ligne « Accès partagés »)
                              </span>
                            )}
                          </div>
                          {accesDetail.canManagePermissions && !isCreatorAdmin && (
                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                              {refuse && !explicite ? (
                                <button
                                  type="button"
                                  onClick={() => void handleRestoreAdminDefaultCf(a.id)}
                                  className="text-xs px-3 py-1.5 bg-green-100 text-green-800 rounded-md hover:bg-green-200"
                                >
                                  Rétablir l&apos;accès admin par défaut
                                </button>
                              ) : !explicite ? (
                                <>
                                  <select
                                    value={adminLimitPerm[a.id] ?? 'lecture'}
                                    onChange={(e) =>
                                      setAdminLimitPerm((prev) => ({ ...prev, [a.id]: e.target.value }))
                                    }
                                    className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-white"
                                  >
                                    {CF_PERM_LEVELS.map((n) => (
                                      <option key={n.value} value={n.value}>
                                        {n.label}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    onClick={() => void quickLimitAdminCf(a.id)}
                                    className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                  >
                                    Limiter l&apos;accès
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void handleRevokeAdminImplicitCf(a.id)}
                                    className="text-xs px-3 py-1.5 bg-red-100 text-red-800 rounded-md hover:bg-red-200"
                                  >
                                    Retirer l&apos;accès
                                  </button>
                                </>
                              ) : (
                                <>
                                  <select
                                    value={primaryDelegation?.permission ?? 'lecture'}
                                    onChange={(e) => {
                                      const permission = e.target.value;
                                      if (!accesModalItem || permission === primaryDelegation?.permission) return;
                                      void replaceAdminCfPermissionLevel(a.id, permission);
                                    }}
                                    className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-white"
                                  >
                                    {CF_PERM_LEVELS.map((n) => (
                                      <option key={n.value} value={n.value}>
                                        {n.label}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    onClick={() => void revokeAllCfDelegationsForUser(a.id)}
                                    className="text-xs px-3 py-1.5 bg-red-100 text-red-800 rounded-md hover:bg-red-200"
                                  >
                                    Révoquer l&apos;accès
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                          {accesDetail.canManagePermissions && isCreatorAdmin && (
                            <span className="text-xs text-gray-500">Créateur : accès complet, non modérable ici.</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Créateur</p>
                  {accesDetail.creator ? (
                    <p>
                      <span className="font-medium">
                        {accesDetail.creator.prenom} {accesDetail.creator.nom}
                      </span>
                      <span className="text-gray-400"> — modification, suppression, octroi des droits</span>
                    </p>
                  ) : (
                    <p className="text-amber-800 text-sm leading-relaxed">
                      Aucun créateur enregistré (fiche existante avant la traçabilité). Les règles de modification et de
                      gestion des accès suivent la configuration métier en vigueur.
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Accès partagés</p>
                  {(accesDetail.delegations || []).length === 0 ? (
                    <p className="text-gray-400 text-xs italic">Aucun accès délégué</p>
                  ) : (
                    <ul className="space-y-2">
                      {(accesDetail.delegations || []).map((d: any) => (
                        <li
                          key={d.id}
                          className="flex flex-wrap items-center gap-2 border border-gray-100 rounded-md px-3 py-2 bg-gray-50"
                        >
                          <span className="font-medium">
                            {d.user.prenom} {d.user.nom}
                            {d.user.role === 'admin' && (
                              <span className="text-xs font-normal text-gray-500 ml-1">(admin)</span>
                            )}
                          </span>
                          {d.grantedBy && (
                            <span className="text-xs text-gray-400">
                              par {d.grantedBy.prenom} {d.grantedBy.nom}
                            </span>
                          )}
                          {accesDetail.canManagePermissions ? (
                            <>
                              <select
                                value={d.permission}
                                onChange={(e) => {
                                  const permission = e.target.value;
                                  if (!accesModalItem || permission === d.permission) return;
                                  void replaceAdminCfPermissionLevel(d.user.id, permission);
                                }}
                                className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-white"
                              >
                                {CF_PERM_LEVELS.map((n) => (
                                  <option key={n.value} value={n.value}>
                                    {n.label}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => void handleRemovePermission(d.id, d.user?.role === 'admin')}
                                className="text-xs text-red-600 hover:underline ml-auto"
                              >
                                {d.user?.role === 'admin' ? 'Révoquer' : 'Retirer'}
                              </button>
                            </>
                          ) : (
                            <span className="text-gray-500">— {LABEL_PERM[d.permission] || d.permission}</span>
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
                      <select
                        value={newPermUserId}
                        onChange={(e) => setNewPermUserId(e.target.value)}
                        className="w-full min-w-0 border border-gray-300 rounded-md px-3 py-2 text-sm"
                      >
                        <option value="">— Utilisateur —</option>
                        {(() => {
                          const actifs = usersList.filter(
                            (u: any) => (!u.statut || u.statut === 'actif') && u.id !== accesDetail.creator?.id
                          );
                          const adminsPick = actifs.filter((u: any) => u.role === 'admin');
                          const autresPick = actifs.filter((u: any) => u.role !== 'admin');
                          return (
                            <>
                              {adminsPick.length > 0 && (
                                <optgroup label="Administrateurs">
                                  {adminsPick.map((u: any) => (
                                    <option key={u.id} value={u.id}>
                                      {u.prenom} {u.nom} — {u.email}
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                              {autresPick.length > 0 && (
                                <optgroup label="Autres utilisateurs">
                                  {autresPick.map((u: any) => (
                                    <option key={u.id} value={u.id}>
                                      {u.prenom} {u.nom} — {u.email}
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                            </>
                          );
                        })()}
                      </select>
                      <select
                        value={newPermType}
                        onChange={(e) => setNewPermType(e.target.value)}
                        className="w-full lg:w-56 border border-gray-300 rounded-md px-3 py-2 text-sm"
                      >
                        {CF_PERM_LEVELS.map((n) => (
                          <option key={n.value} value={n.value}>
                            {n.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => void handleAddPermission()}
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

      {showCorbeilleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center p-5 border-b">
              <h2 className="text-lg font-semibold">🗑 Clients / fournisseurs en corbeille</h2>
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
              {corbeilleItems.length === 0 && (
                <p className="text-sm text-gray-500">Aucune fiche en corbeille.</p>
              )}
              {corbeilleItems.map((cp: any) => (
                <div
                  key={cp.id}
                  className="flex flex-wrap justify-between items-center gap-3 p-3 border rounded-lg bg-gray-50"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900">{cp.nom}</p>
                    <p className="text-xs text-gray-500">
                      {cp.type === 'fournisseur' ? 'Fournisseur' : 'Client'}
                      {cp.deletedAt ? ` · Supprimé le ${new Date(cp.deletedAt).toLocaleString('fr-FR')}` : ''}
                      {cp.createdBy && ` · Créé par ${cp.createdBy.prenom} ${cp.createdBy.nom}`}
                    </p>
                  </div>
                  {canRestoreCfCorbeille(cp) ? (
                    <button
                      type="button"
                      onClick={() => handleRestoreCfFromCorbeille(cp.id)}
                      className="shrink-0 px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700"
                    >
                      Restaurer
                    </button>
                  ) : (
                    <span className="text-xs text-gray-400 shrink-0">Restauration : admin ou créateur</span>
                  )}
                </div>
              ))}
              <p className="text-xs text-gray-400 pt-2">
                La suppression définitive reste réservée aux administrateurs (corbeille globale).
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
