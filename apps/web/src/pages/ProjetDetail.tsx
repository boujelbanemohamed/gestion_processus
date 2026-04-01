import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import ProjetTachesSection from '../components/ProjetTachesSection';
import { api } from '../services/api';
import { useAuth } from '../store/auth';

const STATUS_COLORS: Record<string, string> = {
  'en_preparation': 'bg-yellow-100 text-yellow-800',
  'en_cours': 'bg-blue-100 text-blue-800',
  'termine': 'bg-green-100 text-green-800',
  'en_pause': 'bg-gray-100 text-gray-800',
};
const STATUS_LABELS: Record<string, string> = {
  'en_preparation': 'En préparation',
  'en_cours': 'En cours',
  'termine': 'Terminé',
  'en_pause': 'En pause',
};
const PRIORITY_COLORS: Record<string, string> = {
  'haute': 'bg-red-100 text-red-800',
  'moyenne': 'bg-orange-100 text-orange-800',
  'basse': 'bg-green-100 text-green-800',
};

const PARTIES_PRENANTES_OPTIONS = [
  'Clients', 'Partenaires', 'Fournisseurs', 'Prestataires',
  'Utilisateurs finaux', 'Autorités réglementaires'
];

type UserOption = { id: string; nom: string; prenom: string; role?: string; };

function relationUserIds(rel: any[] | undefined): string[] {
  if (!rel?.length) return [];
  return rel.map((x: any) => x.userId ?? x.user?.id ?? x.id).filter(Boolean);
}

export default function ProjetDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user: currentUser } = useAuth();
  const [showAccesModal, setShowAccesModal] = useState(false);
  const [acceDoc, setAcceDoc] = useState<any>(null);
  const [acceEstConfidentiel, setAcceEstConfidentiel] = useState(false);
  const [accePermissionUserIds, setAccePermissionUserIds] = useState<string[]>([]);
  const printRef = useRef<HTMLDivElement>(null);

  const [projet, setProjet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [users, setUsers] = useState<UserOption[]>([]);

  // Form state
  const [form, setForm] = useState<any>({});
  // Stakeholders with names
  const [partiesPrenantes, setPartiesPrenantes] = useState<{ type: string; nom: string }[]>([]);
  const [clientsFournisseurs, setClientsFournisseurs] = useState<any[]>([]);
  const [newPartieCFId, setNewPartieCFId] = useState("");
  const [newPartie, setNewPartie] = useState({ type: 'Clients', nom: '' });
  // KPIs
  const [kpis, setKpis] = useState<string[]>([]);
  const [newKpi, setNewKpi] = useState('');
  // Objectifs
  const [objectifsStrategiques, setObjectifsStrategiques] = useState<string[]>([]);
  const [newObjStrat, setNewObjStrat] = useState('');
  const [objectifsOperationnels, setObjectifsOperationnels] = useState<string[]>([]);
  const [newObjOp, setNewObjOp] = useState('');
  // Documents
  const [documents, setDocuments] = useState<any[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showLierModal, setShowLierModal] = useState(false);
  const [allDocuments, setAllDocuments] = useState<any[]>([]);
  const [searchDoc, setSearchDoc] = useState('');
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadNom, setUploadNom] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadEstConfidentiel, setUploadEstConfidentiel] = useState(false);
  const [uploadPermissionUserIds, setUploadPermissionUserIds] = useState<string[]>([]);
  const [viewingDocument, setViewingDocument] = useState<any>(null);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);

  useEffect(() => {
    loadProjet();
    loadUsers();
    loadDocuments();
    loadClientsFournisseurs();
  }, [id]);

  useEffect(() => {
    const st = location.state as { openEdit?: boolean } | null;
    if (st?.openEdit) {
      setEditing(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);

  const loadProjet = async () => {
    try {
      const response = await api.get(`/projets/${id}`);
      const p = response.data;
      setProjet(p);
      setForm({
        nom: p.nom || '',
        type: p.type || 'interne',
        nomClient: p.nomClient || '',
        dateDebut: p.dateDebut ? p.dateDebut.substring(0, 10) : '',
        dateFinPrevue: p.dateFinPrevue ? p.dateFinPrevue.substring(0, 10) : '',
        statut: p.statut || 'en_preparation',
        priorite: p.priorite || 'moyenne',
        sponsorIds: relationUserIds(p.sponsors),
        chefProjetIds: relationUserIds(p.chefsProjet),
        techLeadIds: relationUserIds(p.techLeads),
        equipeIds: relationUserIds(p.equipe),
        contexte: p.contexte || '',
        mission: p.mission || '',
        vision: p.vision || '',
        scopeInclus: p.scopeInclus || '',
        scopeExclus: p.scopeExclus || '',
      });
      setPartiesPrenantes(p.partiesPrenantes || []);
      setKpis(p.kpis || []);
      setObjectifsStrategiques(p.objectifsStrategiques || []);
      setObjectifsOperationnels(p.objectifsOperationnels || []);
    } catch (err) {
      console.error('Erreur:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await api.get('/users');
      setUsers(response.data.map((u: any) => ({ id: u.id, nom: u.nom, prenom: u.prenom, role: u.role })));
    } catch (err) {
      console.error('Erreur chargement users:', err);
    }
  };
  const loadDocuments = async () => {
    try {
      const response = await api.get('/documents', { params: { referenceType: 'projet', referenceId: id } });
      setDocuments(response.data);
    } catch (err) {
      console.error('Erreur chargement documents:', err);
    }
  };
  const loadClientsFournisseurs = async () => {
    try {
      const r = await api.get("/clients-fournisseurs");
      setClientsFournisseurs(r.data);
    } catch (err) { console.error(err); }
  };
  const handleUploadDocument = async () => {
    if (uploadFiles.length === 0) { alert('Veuillez sélectionner un fichier'); return; }
    setUploading(true);
    try {
      await Promise.all(uploadFiles.map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('nom', uploadNom || file.name);
        formData.append('typeDocument', 'projet');
        formData.append('referenceType', 'projet');
        formData.append('referenceId', id!);
        formData.append('description', uploadDescription);
        formData.append('estConfidentiel', uploadEstConfidentiel.toString());
        if (uploadEstConfidentiel && uploadPermissionUserIds.length > 0) {
          uploadPermissionUserIds.forEach(uid => formData.append('permissionUserIds', uid));
        }
        formData.append('versionMajeure', '1');
        formData.append('versionMineure', '0');
        formData.append('versionPatch', '0');
        return api.post('/documents', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      }));
      setShowUploadModal(false);
      setUploadFiles([]);
      setUploadNom('');
      setUploadDescription('');
      setUploadEstConfidentiel(false);
      setUploadPermissionUserIds([]);
      await loadDocuments();
    } catch (err) {
      console.error('Erreur upload:', err);
      alert('Erreur lors de l\'upload');
    } finally {
      setUploading(false);
    }
  };
  const handleViewDocument = async (doc: any) => {
    try {
      const response = await api.get(`/documents/${doc.id}/view`, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      setDocumentUrl(url);
      setViewingDocument(doc);
    } catch (err) {
      alert('Fichier introuvable sur le serveur. Il a peut-être été supprimé ou uploadé dans un ancien environnement. Veuillez ré-uploader le document.');
    }
  };
  const closeViewer = () => {
    if (documentUrl) URL.revokeObjectURL(documentUrl);
    setDocumentUrl(null);
    setViewingDocument(null);
  };
  const handleDeleteDocument = async (docId: string, docNom: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer "${docNom}" ?`)) return;
    try {
      await api.delete(`/documents/${docId}`);
      await loadDocuments();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erreur lors de la suppression');
    }
  };
  const handleDownload = async (doc: any) => {
    try {
      const response = await api.get(`/documents/${doc.id}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', doc.fichierNomOriginal || doc.nom);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Erreur lors du téléchargement');
    }
  };
  const loadAllDocuments = async () => {
    try {
      const response = await api.get('/documents');
      setAllDocuments(response.data);
    } catch (err) {
      console.error('Erreur chargement documents:', err);
    }
  };
  const handleOpenLierModal = async () => {
    await loadAllDocuments();
    setSelectedDocIds([]);
    setSearchDoc('');
    setShowLierModal(true);
  };
  const handleToggleDoc = (docId: string) => {
    setSelectedDocIds(prev =>
      prev.includes(docId) ? prev.filter(id => id !== docId) : [...prev, docId]
    );
  };
  const handleLierDocuments = async () => {
    try {
      await Promise.all(selectedDocIds.map(docId =>
        api.put(`/documents/${docId}`, { referenceType: 'projet', referenceId: id })
      ));
      setShowLierModal(false);
      setSelectedDocIds([]);
      await loadDocuments();
    } catch (err) {
      alert('Erreur lors de la liaison des documents');
    }
  };
  const handleDelierDocument = async (docId: string, docNom: string) => {
    if (!confirm(`Délier le document "${docNom}" de ce projet ?`)) return;
    try {
      await api.put(`/documents/${docId}`, { referenceType: null, referenceId: null, typeDocument: 'general' });
      await loadDocuments();
    } catch (err) {
      alert('Erreur lors de la déliaison du document');
    }
  };
  const canModifierAcces = (doc: any) => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    if (projet && projet.createdById === currentUser.id) return true;
    if (doc.uploadedById === currentUser.id) return true;
    const chefIds = (projet?.chefsProjet || []).map((s: any) => s.user?.id || s.id);
    if (chefIds.includes(currentUser.id)) return true;
    return false;
  };
  const canModifierStatut = (doc: any) => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    if (projet && projet.createdById === currentUser.id) return true;
    if (doc.uploadedById === currentUser.id) return true;
    const chefIds = (projet?.chefsProjet || []).map((s: any) => s.user?.id || s.id);
    if (chefIds.includes(currentUser.id)) return true;
    return false;
  };
  const handleChangeStatut = async (docId: string, newStatut: string) => {
    try {
      await api.put(`/documents/${docId}`, { statut: newStatut });
      await loadDocuments();
    } catch (err) {
      alert('Erreur lors du changement de statut');
    }
  };
  const handleOpenAccesModal = (doc: any) => {
    setAcceDoc(doc);
    setAcceEstConfidentiel(doc.estConfidentiel || false);
    setAccePermissionUserIds(doc.permissionsUtilisateurs?.map((p: any) => p.userId || p.user?.id).filter(Boolean) || []);
    setShowAccesModal(true);
  };
  const handleSaveAcces = async () => {
    if (!acceDoc) return;
    try {
      await api.put(`/documents/${acceDoc.id}`, {
        estConfidentiel: acceEstConfidentiel,
        permissionUserIds: acceEstConfidentiel ? accePermissionUserIds : [],
      });
      setShowAccesModal(false);
      setAcceDoc(null);
      await loadDocuments();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erreur lors de la modification de l\'accès');
    }
  };

  const handleSave = async () => {
    setError('');
    if (!form.nom || !form.dateDebut) {
      setError('Nom et date de début sont obligatoires');
      return;
    }
    setSaving(true);
    try {
      await api.put(`/projets/${id}`, {
        ...form,
        partiesPrenantes,
        kpis,
        objectifsStrategiques,
        objectifsOperationnels,
      });
      await loadProjet();
      setEditing(false);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Mettre ce projet en corbeille ? Vous pourrez le restaurer ou le supprimer définitivement depuis la corbeille (admin).')) return;
    try {
      await api.delete(`/projets/${id}`);
      navigate('/projets');
    } catch (err) {
      console.error('Erreur suppression:', err);
    }
  };

  const handlePrint = () => { window.print(); };

  const toggleUser = (field: string, userId: string) => {
    const current: string[] = form[field] || [];
    if (current.includes(userId)) {
      setForm({ ...form, [field]: current.filter((id: string) => id !== userId) });
    } else {
      setForm({ ...form, [field]: [...current, userId] });
    }
  };

  const getUserName = (userId: string) => {
    const u = users.find(u => u.id === userId);
    return u ? `${u.prenom} ${u.nom}` : userId;
  };

  const addPartie = () => {
    if (!newPartie.nom.trim()) return;
    setPartiesPrenantes([...partiesPrenantes, { ...newPartie }]);
    setNewPartie({ type: 'Clients', nom: '' });
  };

  const removePartie = (idx: number) => setPartiesPrenantes(partiesPrenantes.filter((_, i) => i !== idx));

  const addKpi = () => {
    if (!newKpi.trim()) return;
    setKpis([...kpis, newKpi.trim()]);
    setNewKpi('');
  };

  const addObjStrat = () => {
    if (!newObjStrat.trim()) return;
    setObjectifsStrategiques([...objectifsStrategiques, newObjStrat.trim()]);
    setNewObjStrat('');
  };

  const addObjOp = () => {
    if (!newObjOp.trim()) return;
    setObjectifsOperationnels([...objectifsOperationnels, newObjOp.trim()]);
    setNewObjOp('');
  };

  // Multi-select user component
  const UserMultiSelect = ({ field, label }: { field: string; label: string }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {editing ? (
        <div className="border border-gray-300 rounded-md max-h-32 overflow-y-auto p-2">
          {users.map(u => (
            <label key={u.id} className="flex items-center gap-2 py-1 cursor-pointer hover:bg-gray-50 px-1 rounded">
              <input
                type="checkbox"
                checked={(form[field] || []).includes(u.id)}
                onChange={() => toggleUser(field, u.id)}
                className="rounded"
              />
              <span className="text-sm">{u.prenom} {u.nom}</span>
            </label>
          ))}
          {users.length === 0 && <p className="text-sm text-gray-400 italic">Aucun utilisateur</p>}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 min-h-[32px]">
          {(projet[field === 'sponsorIds' ? 'sponsors' : field === 'chefProjetIds' ? 'chefsProjet' : field === 'techLeadIds' ? 'techLeads' : 'equipe'] || []).length === 0
            ? <span className="text-sm text-gray-400 italic">—</span>
            : (projet[field === 'sponsorIds' ? 'sponsors' : field === 'chefProjetIds' ? 'chefsProjet' : field === 'techLeadIds' ? 'techLeads' : 'equipe'] || []).map((u: any) => (
              <span key={u.id} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">{u.prenom} {u.nom}</span>
            ))
          }
        </div>
      )}
    </div>
  );

  const Field = ({ label, value, editComponent }: { label: string; value: any; editComponent?: React.ReactNode }) => (
    <div>
      <label className="block text-sm font-medium text-gray-500 mb-1">{label}</label>
      {editing && editComponent ? editComponent : (
        <p className="text-sm text-gray-900">{value || <span className="italic text-gray-400">—</span>}</p>
      )}
    </div>
  );

  if (loading) return <div className="p-6">Chargement...</div>;
  if (!projet) return <div className="p-6 text-red-600">Projet introuvable</div>;

  return (
    <>
      {/* Style d'impression */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #print-zone, #print-zone * { visibility: visible !important; }
          #print-zone { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="p-6 max-w-5xl mx-auto">
        {/* En-tête */}
        <div className="flex justify-between items-start mb-6 no-print">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/projets')} className="text-gray-500 hover:text-gray-700 text-sm flex items-center gap-1">
              ← Retour
            </button>
            <h1 className="text-2xl font-bold">{projet.nom}</h1>
            <span className={`px-2 py-1 text-xs rounded ${STATUS_COLORS[projet.statut] || ''}`}>
              {STATUS_LABELS[projet.statut] || projet.statut}
            </span>
            <span className={`px-2 py-1 text-xs rounded capitalize ${PRIORITY_COLORS[projet.priorite] || ''}`}>
              {projet.priorite}
            </span>
          </div>
          <div className="flex gap-2">
            <button onClick={handlePrint} className="px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 flex items-center gap-1">
              🖨️ Imprimer
            </button>
            {editing ? (
              <>
                <button onClick={() => { setEditing(false); loadProjet(); }} className="px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">Annuler</button>
                <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm disabled:opacity-50">{saving ? 'Enregistrement...' : 'Enregistrer'}</button>
              </>
            ) : (
              <>
                <button onClick={() => setEditing(true)} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm">Modifier</button>
                <button onClick={handleDelete} className="px-3 py-2 text-sm border border-red-300 rounded-md text-red-600 hover:bg-red-50">Supprimer</button>
              </>
            )}
          </div>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm no-print">{error}</div>}

        {/* Zone imprimable */}
        <div id="print-zone" ref={printRef}>

          {/* En-tête impression */}
          <div className="hidden print:block mb-6 border-b pb-4">
            <h1 className="text-3xl font-bold">{projet.nom}</h1>
            <div className="flex gap-3 mt-2">
              <span className={`px-2 py-1 text-xs rounded ${STATUS_COLORS[projet.statut] || ''}`}>{STATUS_LABELS[projet.statut]}</span>
              <span className={`px-2 py-1 text-xs rounded capitalize ${PRIORITY_COLORS[projet.priorite] || ''}`}>{projet.priorite}</span>
            </div>
            <p className="text-sm text-gray-500 mt-1">Fiche générée le {new Date().toLocaleDateString('fr-FR')}</p>
          </div>

          {/* ① Informations générales */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span className="w-7 h-7 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-bold">1</span>
              Informations générales
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              <Field
                label="Nom du projet"
                value={projet.nom}
                editComponent={<input type="text" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />}
              />
              <Field
                label="Type de projet"
                value={projet.type}
                editComponent={
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                    <option value="interne">Interne</option>
                    <option value="client">Client</option>
                    <option value="communautaire">Communautaire</option>
                  </select>
                }
              />
              {(editing ? form.type === 'client' : projet.type === 'client') && (
                <Field
                  label="Nom du client"
                  value={projet.nomClient}
                  editComponent={<input type="text" value={form.nomClient} onChange={(e) => setForm({ ...form, nomClient: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder="Nom de l'entreprise" />}
                />
              )}
              <Field
                label="Date de début"
                value={projet.dateDebut ? new Date(projet.dateDebut).toLocaleDateString('fr-FR') : '—'}
                editComponent={<input type="date" value={form.dateDebut} onChange={(e) => setForm({ ...form, dateDebut: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />}
              />
              <Field
                label="Date de fin prévue"
                value={projet.dateFinPrevue ? new Date(projet.dateFinPrevue).toLocaleDateString('fr-FR') : '—'}
                editComponent={<input type="date" value={form.dateFinPrevue} onChange={(e) => setForm({ ...form, dateFinPrevue: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />}
              />
              <Field
                label="Statut"
                value={STATUS_LABELS[projet.statut] || projet.statut}
                editComponent={
                  <select value={form.statut} onChange={(e) => setForm({ ...form, statut: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                    <option value="en_preparation">En préparation</option>
                    <option value="en_cours">En cours</option>
                    <option value="termine">Terminé</option>
                    <option value="en_pause">En pause</option>
                  </select>
                }
              />
              <Field
                label="Priorité"
                value={projet.priorite}
                editComponent={
                  <select value={form.priorite} onChange={(e) => setForm({ ...form, priorite: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                    <option value="haute">Haute</option>
                    <option value="moyenne">Moyenne</option>
                    <option value="basse">Basse</option>
                  </select>
                }
              />
            </div>
          </div>

          {/* ② Gouvernance */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span className="w-7 h-7 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-sm font-bold">2</span>
              Gouvernance du projet
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <UserMultiSelect field="sponsorIds" label="Sponsor / Superviseur" />
              <UserMultiSelect field="chefProjetIds" label="Chef de projet / PMO" />
              <UserMultiSelect field="techLeadIds" label="Tech Lead" />
              <UserMultiSelect field="equipeIds" label="Équipe projet / Intervenants" />
            </div>

            {/* Parties prenantes */}
            <div className="mt-5">
              <label className="block text-sm font-medium text-gray-700 mb-2">Parties prenantes (Stakeholders)</label>
              {partiesPrenantes.length > 0 ? (
                <div className="space-y-2 mb-3">
                  {partiesPrenantes.map((pp, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded text-xs">{pp.type}</span>
                      <span className="text-sm text-gray-700">{pp.nom}</span>
                      {editing && (
                        <button onClick={() => removePartie(idx)} className="text-red-400 hover:text-red-600 text-xs ml-auto">✕</button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic mb-3">Aucune partie prenante</p>
              )}
              {editing && (
                <div className="flex gap-2 mt-2">
                  <select value={newPartie.type} onChange={(e) => setNewPartie({ ...newPartie, type: e.target.value })} className="px-2 py-1 border border-gray-300 rounded text-sm">
                    {PARTIES_PRENANTES_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                  <input type="text" value={newPartie.nom} onChange={(e) => setNewPartie({ ...newPartie, nom: e.target.value })} placeholder="Nom / Description" className="flex-1 px-3 py-1 border border-gray-300 rounded text-sm" onKeyDown={(e) => e.key === 'Enter' && addPartie()} />
                  <button onClick={addPartie} className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">Ajouter</button>
                </div>
              )}
            </div>
            {/* Clients / Fournisseurs liés */}
            <div className="mt-5">
              <label className="block text-sm font-medium text-gray-700 mb-2">🏢 Clients / Fournisseurs liés</label>
              {projet?.clientsFournisseurs?.length > 0 ? (
                <div className="space-y-1 mb-3">
                  {projet.clientsFournisseurs.map((cfp: any) => (
                    <div key={cfp.clientFournisseurId} className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${cfp.clientFournisseur?.type === 'client' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'}`}>
                        {cfp.clientFournisseur?.type === 'client' ? '👤 Client' : '🏭 Fournisseur'}
                      </span>
                      <span className="text-sm text-gray-700">{cfp.clientFournisseur?.nom}</span>
                      {editing && (
                        <button onClick={async () => { await api.delete(`/clients-fournisseurs/${cfp.clientFournisseurId}/projets/${id}`); loadProjet(); }} className="text-red-400 hover:text-red-600 text-xs ml-auto">✕</button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic mb-3">Aucun client/fournisseur lié</p>
              )}
              {editing && (
                <div className="flex gap-2 mt-2">
                  <select value={newPartieCFId} onChange={(e) => setNewPartieCFId(e.target.value)} className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm">
                    <option value="">— Sélectionner un client/fournisseur —</option>
                    {clientsFournisseurs.filter((cf: any) => !projet?.clientsFournisseurs?.some((cfp: any) => cfp.clientFournisseurId === cf.id)).map((cf: any) => (
                      <option key={cf.id} value={cf.id}>[{cf.type === 'client' ? 'Client' : 'Fournisseur'}] {cf.nom}</option>
                    ))}
                  </select>
                  <button onClick={async () => { if (!newPartieCFId) return; await api.post(`/clients-fournisseurs/${newPartieCFId}/projets`, { projetId: id }); setNewPartieCFId(""); loadProjet(); loadClientsFournisseurs(); }} className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">Lier</button>
                </div>
              )}
            </div>
          </div>

          {/* ③ Contexte et description */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span className="w-7 h-7 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-sm font-bold">3</span>
              Contexte et description
            </h2>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Contexte du projet</label>
                {editing ? (
                  <textarea value={form.contexte} onChange={(e) => setForm({ ...form, contexte: e.target.value })} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder="Décrivez le contexte..." />
                ) : (
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">{projet.contexte || <span className="italic text-gray-400">—</span>}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Mission — Pourquoi ce projet existe</label>
                {editing ? (
                  <textarea value={form.mission} onChange={(e) => setForm({ ...form, mission: e.target.value })} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder="Quelle est la mission de ce projet ?" />
                ) : (
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">{projet.mission || <span className="italic text-gray-400">—</span>}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Vision — Résultat ou impact attendu</label>
                {editing ? (
                  <textarea value={form.vision} onChange={(e) => setForm({ ...form, vision: e.target.value })} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder="Quel est l'impact visé ?" />
                ) : (
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">{projet.vision || <span className="italic text-gray-400">—</span>}</p>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">✅ Scope — Ce qui est inclus</label>
                  {editing ? (
                    <textarea value={form.scopeInclus} onChange={(e) => setForm({ ...form, scopeInclus: e.target.value })} rows={4} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder="Ce qui est dans le périmètre..." />
                  ) : (
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">{projet.scopeInclus || <span className="italic text-gray-400">—</span>}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">❌ Scope — Ce qui est exclu</label>
                  {editing ? (
                    <textarea value={form.scopeExclus} onChange={(e) => setForm({ ...form, scopeExclus: e.target.value })} rows={4} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder="Ce qui est hors périmètre..." />
                  ) : (
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">{projet.scopeExclus || <span className="italic text-gray-400">—</span>}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ④ Objectifs */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span className="w-7 h-7 bg-orange-100 text-orange-700 rounded-full flex items-center justify-center text-sm font-bold">4</span>
              Objectifs du projet
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Objectifs stratégiques */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Objectifs stratégiques</label>
                {objectifsStrategiques.length > 0 ? (
                  <ul className="space-y-1 mb-3">
                    {objectifsStrategiques.map((obj, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <span className="text-blue-500 mt-0.5">•</span>
                        <span className="flex-1 text-gray-700">{obj}</span>
                        {editing && <button onClick={() => setObjectifsStrategiques(objectifsStrategiques.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 text-xs">✕</button>}
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-gray-400 italic mb-3">Aucun objectif stratégique</p>}
                {editing && (
                  <div className="flex gap-2">
                    <input type="text" value={newObjStrat} onChange={(e) => setNewObjStrat(e.target.value)} placeholder="Ajouter un objectif..." className="flex-1 px-3 py-1 border border-gray-300 rounded text-sm" onKeyDown={(e) => e.key === 'Enter' && addObjStrat()} />
                    <button onClick={addObjStrat} className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">+</button>
                  </div>
                )}
              </div>

              {/* Objectifs opérationnels */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Objectifs opérationnels</label>
                {objectifsOperationnels.length > 0 ? (
                  <ul className="space-y-1 mb-3">
                    {objectifsOperationnels.map((obj, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <span className="text-green-500 mt-0.5">•</span>
                        <span className="flex-1 text-gray-700">{obj}</span>
                        {editing && <button onClick={() => setObjectifsOperationnels(objectifsOperationnels.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 text-xs">✕</button>}
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-gray-400 italic mb-3">Aucun objectif opérationnel</p>}
                {editing && (
                  <div className="flex gap-2">
                    <input type="text" value={newObjOp} onChange={(e) => setNewObjOp(e.target.value)} placeholder="Ajouter un objectif..." className="flex-1 px-3 py-1 border border-gray-300 rounded text-sm" onKeyDown={(e) => e.key === 'Enter' && addObjOp()} />
                    <button onClick={addObjOp} className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">+</button>
                  </div>
                )}
              </div>
            </div>

            {/* KPIs */}
            <div className="mt-5">
              <label className="block text-sm font-medium text-gray-700 mb-2">Indicateurs de succès (KPI)</label>
              {kpis.length > 0 ? (
                <div className="flex flex-wrap gap-2 mb-3">
                  {kpis.map((kpi, idx) => (
                    <span key={idx} className="flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                      📊 {kpi}
                      {editing && <button onClick={() => setKpis(kpis.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 ml-1 text-xs">✕</button>}
                    </span>
                  ))}
                </div>
              ) : <p className="text-sm text-gray-400 italic mb-3">Aucun KPI défini</p>}
              {editing && (
                <div className="flex gap-2">
                  <input type="text" value={newKpi} onChange={(e) => setNewKpi(e.target.value)} placeholder="Ex: Réduire le temps de traitement de 30%" className="flex-1 px-3 py-1 border border-gray-300 rounded text-sm" onKeyDown={(e) => e.key === 'Enter' && addKpi()} />
                  <button onClick={addKpi} className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">Ajouter</button>
                </div>
              )}
            </div>
          </div>

        {/* Section Documents */}
        <div className="bg-white rounded-lg shadow p-6 mt-6 print:hidden">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">📎 Documents du projet</h2>
            <div className="flex gap-2"><button onClick={() => setShowUploadModal(true)} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">+ Ajouter un document</button><button onClick={handleOpenLierModal} className="px-4 py-2 bg-gray-600 text-white rounded-md text-sm hover:bg-gray-700">🔗 Lier un document existant</button></div>
          </div>
          {documents.length === 0 ? (
            <p className="text-sm text-gray-400 italic">Aucun document attaché à ce projet</p>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nom</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Taille</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Accès</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {documents.map((doc) => (
                  <tr key={doc.id}>
                    <td className="px-4 py-2 text-sm text-gray-900">{doc.nom}</td>
                    <td className="px-4 py-2 text-sm text-gray-500">{doc.fichierType}</td>
                    <td className="px-4 py-2 text-sm text-gray-500">{doc.fichierTaille ? Math.round(doc.fichierTaille / 1024) + ' Ko' : '-'}</td>
                    <td className="px-4 py-2 text-sm text-gray-500">{new Date(doc.createdAt).toLocaleDateString('fr-FR')}</td>
                    <td className="px-4 py-2 text-sm">
                      {canModifierStatut(doc) ? (
                        <select value={doc.statut} onChange={(e) => handleChangeStatut(doc.id, e.target.value)} className="text-xs border border-gray-300 rounded px-1 py-0.5 cursor-pointer">
                          <option value="brouillon">brouillon</option>
                          <option value="en_revision">en_revision</option>
                          <option value="valide">valide</option>
                          <option value="archive">archive</option>
                        </select>
                      ) : (
                        <span className={`px-2 py-1 text-xs rounded ${
                          doc.statut === 'valide' ? 'bg-green-100 text-green-800' :
                          doc.statut === 'en_revision' ? 'bg-yellow-100 text-yellow-800' :
                          doc.statut === 'archive' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>{doc.statut}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm">
                      {doc.estConfidentiel ? (
                        <div>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">🔒 Accès restreint</span>
                          <div className="mt-1 text-xs text-gray-600 space-y-0.5">
                            {(() => {
                              const ayantsDroit: {nom: string, droits: string}[] = [];
                              const addPerson = (id: string, nom: string, droits: string) => {
                                if (!ayantsDroit.find(a => a.nom === nom)) ayantsDroit.push({ nom, droits });
                              };
                              users.filter(u => u.role === 'admin').forEach(u => addPerson(u.id, `${u.prenom} ${u.nom}`, 'Admin : modification statut + accès + lecture'));
                              if (doc.uploadedBy) addPerson(doc.uploadedBy.id, `${doc.uploadedBy.prenom} ${doc.uploadedBy.nom}`, 'Uploadeur : modification statut + accès + lecture');
                              if (projet?.createdBy) addPerson(projet.createdBy.id, `${projet.createdBy.prenom} ${projet.createdBy.nom}`, 'Créateur : modification statut + accès + lecture');
                              (doc.permissionsUtilisateurs || []).forEach((p: any) => { if (p.user) addPerson(p.user.id, `${p.user.prenom} ${p.user.nom}`, 'Accès explicite : lecture'); });
                              if (ayantsDroit.length === 0) return <span className="italic text-gray-400">Aucun utilisateur défini</span>;
                              return ayantsDroit.map((a, i) => (
                                <div key={i}><span className="font-medium">{a.nom}</span> <span className="text-gray-400">({a.droits})</span></div>
                              ));
                            })()}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">🌐 Accès libre</span>
                          <div className="mt-1 text-xs text-gray-600 space-y-0.5">
                            {(() => {
                              const ayantsDroit: {nom: string, droits: string}[] = [];
                              const addPerson = (id: string, nom: string, droits: string) => {
                                if (!ayantsDroit.find(a => a.nom === nom)) ayantsDroit.push({ nom, droits });
                              };
                              users.filter(u => u.role === 'admin').forEach(u => addPerson(u.id, `${u.prenom} ${u.nom}`, 'Admin : modification statut + accès + lecture'));
                              if (doc.uploadedBy) addPerson(doc.uploadedBy.id, `${doc.uploadedBy.prenom} ${doc.uploadedBy.nom}`, 'Uploadeur : modification statut + accès + lecture');
                              if (projet?.createdBy) addPerson(projet.createdBy.id, `${projet.createdBy.prenom} ${projet.createdBy.nom}`, 'Créateur : modification statut + accès + lecture');
                              (projet?.chefsProjet || []).forEach((s: any) => { const u = s.user || s; addPerson(u.id, `${u.prenom} ${u.nom}`, 'Chef de projet : modification statut + lecture'); });
                              if (projet?.responsable) addPerson(projet.responsable.id, `${projet.responsable.prenom} ${projet.responsable.nom}`, 'Responsable : lecture');
                              if (projet?.gestionnaire) addPerson(projet.gestionnaire.id, `${projet.gestionnaire.prenom} ${projet.gestionnaire.nom}`, 'Gestionnaire : lecture');
                              (projet?.sponsors || []).forEach((s: any) => { const u = s.user || s; addPerson(u.id, `${u.prenom} ${u.nom}`, 'Sponsor : lecture'); });
                              (projet?.techLeads || []).forEach((s: any) => { const u = s.user || s; addPerson(u.id, `${u.prenom} ${u.nom}`, 'Tech Lead : lecture'); });
                              (projet?.equipe || []).forEach((s: any) => { const u = s.user || s; addPerson(u.id, `${u.prenom} ${u.nom}`, 'Équipe : lecture'); });
                              if (ayantsDroit.length === 0) return <span className="italic text-gray-400">Aucune gouvernance définie</span>;
                              return ayantsDroit.map((a, i) => (
                                <div key={i}><span className="font-medium">{a.nom}</span> <span className="text-gray-400">({a.droits})</span></div>
                              ));
                            })()}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm">
                      <div className="flex gap-2"><button onClick={() => handleViewDocument(doc)} className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200">👁 Visualiser</button><button onClick={() => handleDownload(doc)} className="px-3 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200">⬇ Télécharger</button>{doc.typeDocument !== 'projet' && <button onClick={() => handleDelierDocument(doc.id, doc.nom)} className="px-3 py-1 bg-orange-100 text-orange-700 rounded text-xs hover:bg-orange-200">🔗 Délier</button>}{canModifierAcces(doc) && <button onClick={() => handleOpenAccesModal(doc)} className="px-3 py-1 bg-purple-100 text-purple-700 rounded text-xs hover:bg-purple-200">🔑 Accès</button>}<button onClick={() => handleDeleteDocument(doc.id, doc.nom)} className="px-3 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200">🗑 Supprimer</button></div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {id && (
          <div className="print:hidden mt-6">
            <ProjetTachesSection
              projetId={id}
              projet={projet}
              usersForTaches={users.map((u) => ({
                id: u.id,
                nom: u.nom,
                prenom: u.prenom,
                role: u.role,
              }))}
            />
          </div>
        )}
        </div>{/* fin print-zone */}
      {/* Modal Modifier Accès */}
      {showAccesModal && acceDoc && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">🔑 Modifier l'accès — {acceDoc.nom}</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <input type="checkbox" id="acceConfidentiel" checked={acceEstConfidentiel} onChange={(e) => { setAcceEstConfidentiel(e.target.checked); if (!e.target.checked) setAccePermissionUserIds([]); }} />
                <label htmlFor="acceConfidentiel" className="text-sm text-gray-700">Accès restreint (document confidentiel)</label>
              </div>
              {acceEstConfidentiel && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Utilisateurs autorisés :</label>
                  <select multiple value={accePermissionUserIds} onChange={(e) => setAccePermissionUserIds(Array.from(e.target.selectedOptions, o => o.value))} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm h-40">
                    {users.map(u => <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>)}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">Maintenez Ctrl (Cmd sur Mac) pour sélectionner plusieurs utilisateurs</p>
                  {accePermissionUserIds.length > 0 && <p className="text-xs text-blue-600 mt-1">{accePermissionUserIds.length} utilisateur(s) sélectionné(s)</p>}
                </div>
              )}
              {!acceEstConfidentiel && (
                <p className="text-sm text-green-600">🌐 Le document sera accessible à tous les utilisateurs</p>
              )}
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => { setShowAccesModal(false); setAcceDoc(null); }} className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50">Annuler</button>
              <button onClick={handleSaveAcces} className="px-4 py-2 bg-purple-600 text-white rounded-md text-sm hover:bg-purple-700">Enregistrer</button>
            </div>
          </div>
        </div>
      )}
      {/* Modal Lier Document Existant */}
      {showLierModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[80vh] flex flex-col">
            <h3 className="text-lg font-semibold mb-4">🔗 Lier un document existant</h3>
            <input
              type="text"
              value={searchDoc}
              onChange={(e) => setSearchDoc(e.target.value)}
              placeholder="Rechercher un document..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mb-4"
            />
            <div className="overflow-y-auto flex-1 border border-gray-200 rounded-md">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500"></th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nom</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Lié à</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {allDocuments
                    .filter(d => d.nom.toLowerCase().includes(searchDoc.toLowerCase()))
                    .map(d => (
                      <tr key={d.id} onClick={() => handleToggleDoc(d.id)} className="cursor-pointer hover:bg-blue-50">
                        <td className="px-3 py-2">
                          <input type="checkbox" checked={selectedDocIds.includes(d.id)} onChange={() => handleToggleDoc(d.id)} onClick={e => e.stopPropagation()} />
                        </td>
                        <td className="px-3 py-2 text-sm font-medium text-gray-900">{d.nom}</td>
                        <td className="px-3 py-2 text-sm text-gray-500">{d.typeDocument}</td>
                        <td className="px-3 py-2 text-sm text-gray-500">
                          {d.processus ? d.processus.nom : d.projet ? d.projet.nom : 'Général'}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {selectedDocIds.length > 0 && (
              <p className="text-sm text-blue-600 mt-2">{selectedDocIds.length} document(s) sélectionné(s)</p>
            )}
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setShowLierModal(false)} className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50">Annuler</button>
              <button onClick={handleLierDocuments} disabled={selectedDocIds.length === 0} className="px-4 py-2 bg-gray-600 text-white rounded-md text-sm hover:bg-gray-700 disabled:opacity-50">Lier ({selectedDocIds.length})</button>
            </div>
          </div>
        </div>
      )}
      {/* Modal Upload Document */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Ajouter un document</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fichier(s) <span className="text-red-500">*</span></label>
                <input type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.txt,.zip" onChange={(e) => { if (e.target.files) { const files = Array.from(e.target.files); setUploadFiles(files); if (files.length === 1) setUploadNom(files[0].name); } }} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                {uploadFiles.length > 0 && <p className="text-xs text-gray-500 mt-1">{uploadFiles.length} fichier(s) sélectionné(s)</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom du document</label>
                <input type="text" value={uploadNom} onChange={(e) => setUploadNom(e.target.value)} placeholder="Nom du document" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={uploadDescription} onChange={(e) => setUploadDescription(e.target.value)} placeholder="Description optionnelle" rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Accès</label>
                <div className="flex items-center gap-2 mb-2">
                  <input type="checkbox" id="estConfidentiel" checked={uploadEstConfidentiel} onChange={(e) => { setUploadEstConfidentiel(e.target.checked); if (!e.target.checked) setUploadPermissionUserIds([]); }} />
                  <label htmlFor="estConfidentiel" className="text-sm text-gray-700">Accès restreint (document confidentiel)</label>
                </div>
                {uploadEstConfidentiel && (
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Sélectionner les utilisateurs autorisés :</label>
                    <select multiple value={uploadPermissionUserIds} onChange={(e) => setUploadPermissionUserIds(Array.from(e.target.selectedOptions, o => o.value))} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm h-32">
                      {users.map(u => <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>)}
                    </select>
                    <p className="text-xs text-gray-400 mt-1">Maintenez Ctrl (Cmd sur Mac) pour sélectionner plusieurs utilisateurs</p>
                    {uploadPermissionUserIds.length > 0 && <p className="text-xs text-blue-600 mt-1">{uploadPermissionUserIds.length} utilisateur(s) sélectionné(s)</p>}
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => { setShowUploadModal(false); setUploadFiles([]); setUploadNom(''); setUploadDescription(''); }} className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50">Annuler</button>
              <button onClick={handleUploadDocument} disabled={uploading} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50">{uploading ? 'Upload en cours...' : 'Uploader'}</button>
            </div>
          </div>
        </div>
      )}
      </div>
      {/* Modal de visualisation */}
      {viewingDocument && documentUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[90vw] h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-xl font-bold">{viewingDocument.nom}</h2>
              <div className="flex gap-2">
                <button onClick={() => handleDownload(viewingDocument)} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">⬇ Télécharger</button>
                <button onClick={closeViewer} className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm">✕ Fermer</button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden p-4">
              {viewingDocument.fichierType === 'application/pdf' || viewingDocument.fichierType?.includes('pdf') ? (
                <iframe src={documentUrl} className="w-full h-full border-0" title={viewingDocument.nom} />
              ) : viewingDocument.fichierType?.includes('image') ? (
                <img src={documentUrl} alt={viewingDocument.nom} className="max-w-full max-h-full object-contain mx-auto" />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <p className="text-lg mb-4">Aperçu non disponible pour ce type de fichier</p>
                  <button onClick={() => handleDownload(viewingDocument)} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Télécharger le fichier</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
