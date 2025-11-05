import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../store/auth';

export default function ProcessusDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const isLecteur = currentUser?.role === 'lecteur';
  const [processus, setProcessus] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [historyPagination, setHistoryPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [updatingDocStatus, setUpdatingDocStatus] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showVersionModal, setShowVersionModal] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState<string | null>(null);
  const [editingDocument, setEditingDocument] = useState<any>(null);
  const [editDocumentData, setEditDocumentData] = useState({
    nom: '',
    description: '',
    estConfidentiel: false,
  });
  const [editPermissionUserIds, setEditPermissionUserIds] = useState<string[]>([]);
  const [uploadData, setUploadData] = useState({
    nom: '',
    description: '',
    estConfidentiel: false,
    versionMajeure: '1',
    versionMineure: '0',
    versionPatch: '0',
  });
  const [permissionUserIds, setPermissionUserIds] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [fileNames, setFileNames] = useState<{ [key: string]: string }>({});
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [entitesList, setEntitesList] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [categoriesList, setCategoriesList] = useState<any[]>([]);
  const [canSetConfidentiel, setCanSetConfidentiel] = useState(false);
  const [editData, setEditData] = useState({
    statut: '',
    proprietaireId: '',
    entiteIds: [] as string[],
    categorieIds: [] as string[],
  });
  const [viewingDocument, setViewingDocument] = useState<any | null>(null);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [docComments, setDocComments] = useState<Record<string, any[]>>({});
  const [newComment, setNewComment] = useState<Record<string, string>>({});

  useEffect(() => {
    if (id) {
      loadProcessus();
      loadDocuments();
      loadEntites();
      loadUsers();
      loadCategories();
      loadHistory(1);
    }
  }, [id]);

  useEffect(() => {
    if (processus) {
      setEditData({
        statut: processus.statut || 'brouillon',
        proprietaireId: processus.proprietaireId || '',
        entiteIds: processus.entites?.map((pe: any) => pe.entite?.id || pe.entiteId).filter(Boolean) || [],
        categorieIds: processus.categories?.map((pc: any) => pc.categorie?.id || pc.categorieId).filter(Boolean) || [],
      });
      
      // Vérifier si l'utilisateur peut définir confidentiel (propriétaire ou créateur)
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      const canSet = processus.proprietaireId === currentUser.id || processus.createdById === currentUser.id;
      setCanSetConfidentiel(canSet);
    }
  }, [processus]);

  useEffect(() => {
    // Nettoyer l'URL blob lors du démontage
    return () => {
      if (documentUrl) {
        window.URL.revokeObjectURL(documentUrl);
      }
    };
  }, [documentUrl]);

  const loadProcessus = async () => {
    try {
      const response = await api.get(`/processus/${id}`);
      setProcessus(response.data);
    } catch (error: any) {
      console.error('Erreur:', error);
      if (error.response?.status === 404) {
        setError('Processus non trouvé');
      } else {
        setError('Erreur lors du chargement du processus');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadDocuments = async () => {
    try {
      const response = await api.get(`/documents?referenceType=processus&referenceId=${id}`);
      setDocuments(response.data);
      // Charger les commentaires pour chaque document
      const commentsByDoc: Record<string, any[]> = {};
      await Promise.all(
        (response.data || []).map(async (d: any) => {
          try {
            const token = localStorage.getItem('token');
            const res = await api.get(`/documents/${d.id}/comments`, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
            commentsByDoc[d.id] = res.data || [];
          } catch {
            commentsByDoc[d.id] = [];
          }
        })
      );
      setDocComments(commentsByDoc);
    } catch (error) {
      console.error('Erreur chargement documents:', error);
    }
  };

  const handleAddComment = async (documentId: string) => {
    const content = (newComment[documentId] || '').trim();
    if (!content) return;
    try {
      const token = localStorage.getItem('token');
      const res = await api.post(
        `/documents/${documentId}/comments`,
        { contenu: content },
        token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
      );
      setDocComments({
        ...docComments,
        [documentId]: [...(docComments[documentId] || []), res.data],
      });
      setNewComment({ ...newComment, [documentId]: '' });
      loadHistory(1);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erreur ajout commentaire');
    }
  };

  const loadEntites = async () => {
    try {
      const response = await api.get('/entites');
      setEntitesList(response.data);
    } catch (error) {
      console.error('Erreur chargement entités:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await api.get('/users');
      setUsersList(response.data);
    } catch (error) {
      console.error('Erreur chargement utilisateurs:', error);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await api.get('/categories');
      setCategoriesList(response.data);
    } catch (error) {
      console.error('Erreur chargement catégories:', error);
    }
  };

  const loadHistory = async (page: number = 1) => {
    try {
      const response = await api.get(`/processus/${id}/history?page=${page}&limit=10`);
      setHistory(response.data.data);
      setHistoryPagination(response.data.pagination);
    } catch (error) {
      console.error('Erreur chargement historique:', error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files);
      setFiles(selectedFiles);
      
      // Initialiser les noms de fichiers avec leurs noms originaux
      const names: { [key: string]: string } = {};
      selectedFiles.forEach((file) => {
        names[file.name] = file.name;
      });
      setFileNames(names);
      
      // Si un seul fichier et que le nom n'est pas défini, utiliser le nom du fichier
      if (selectedFiles.length === 1 && !uploadData.nom) {
        setUploadData({ ...uploadData, nom: selectedFiles[0].name });
      }
    }
  };

  const removeFile = (fileName: string) => {
    setFiles(files.filter(f => f.name !== fileName));
    const newNames = { ...fileNames };
    delete newNames[fileName];
    setFileNames(newNames);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0) {
      setError('Veuillez sélectionner au moins un fichier');
      return;
    }

    // Validation : si confidentiel est coché, au moins un utilisateur doit être sélectionné
    if (uploadData.estConfidentiel && permissionUserIds.length === 0) {
      setError('Au moins un utilisateur doit être sélectionné pour un document confidentiel');
      return;
    }

    setError('');
    setUploading(true);

    try {
      // Uploader tous les fichiers
      const uploadPromises = files.map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('nom', fileNames[file.name] || file.name);
        formData.append('typeDocument', 'processus');
        formData.append('referenceType', 'processus');
        formData.append('referenceId', id!);
        formData.append('description', uploadData.description || '');
        formData.append('estConfidentiel', uploadData.estConfidentiel.toString());
        if (uploadData.estConfidentiel && permissionUserIds.length > 0) {
          permissionUserIds.forEach(userId => {
            formData.append('permissionUserIds', userId);
          });
        }
        formData.append('versionMajeure', uploadData.versionMajeure);
        formData.append('versionMineure', uploadData.versionMineure);
        formData.append('versionPatch', uploadData.versionPatch);

        return api.post('/documents', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
      });

      await Promise.all(uploadPromises);

      setShowUploadModal(false);
      setFiles([]);
      setFileNames({});
      setPermissionUserIds([]);
      setUploadData({ nom: '', description: '', estConfidentiel: false, versionMajeure: '1', versionMineure: '0', versionPatch: '0' });
      loadDocuments();
      loadHistory(1);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur lors de l\'upload des fichiers');
    } finally {
      setUploading(false);
    }
  };

  const handleVersionUpload = async (documentId: string, e: React.FormEvent) => {
    e.preventDefault();
    const versionFile = (e.target as HTMLFormElement).querySelector('input[type="file"]') as HTMLInputElement;
    const commentaire = (e.target as HTMLFormElement).querySelector('textarea') as HTMLTextAreaElement;

    if (!versionFile?.files?.[0]) {
      alert('Veuillez sélectionner un fichier');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('file', versionFile.files[0]);
      if (commentaire?.value) {
        formData.append('commentaireVersion', commentaire.value);
      }

      await api.post(`/documents/${documentId}/versions`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setShowVersionModal(null);
      loadDocuments();
      loadHistory(1);
    } catch (err: any) {
      if (err.response?.status === 403) {
        alert('Vous n\'avez pas accès à ce document confidentiel');
      } else {
        alert(err.response?.data?.error || 'Erreur lors de l\'ajout de version');
      }
    }
  };

  const handleViewDocument = async (doc: any) => {
    // Vérifier les permissions avant de faire la requête
    if (!canAccessDocument(doc)) {
      alert('Vous n\'avez pas accès à ce document confidentiel');
      return;
    }

    try {
      const response = await api.get(`/documents/${doc.id}/download`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      setDocumentUrl(url);
      setViewingDocument(doc);
    } catch (error: any) {
      console.error('Erreur lors du chargement du document:', error);
      alert('Erreur lors du chargement du document');
    }
  };

  const handleDownload = async (document: any) => {
    // Vérifier les permissions avant de faire la requête
    if (!canAccessDocument(document)) {
      alert('Vous n\'avez pas accès à ce document confidentiel');
      return;
    }

    try {
      const response = await api.get(`/documents/${document.id}/download`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = window.document.createElement('a');
      link.href = url;
      link.setAttribute('download', document.fichierNomOriginal);
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Erreur lors du téléchargement:', error);
      alert('Erreur lors du téléchargement');
    }
  };

  const closeViewer = () => {
    if (documentUrl) {
      window.URL.revokeObjectURL(documentUrl);
    }
    setViewingDocument(null);
    setDocumentUrl(null);
  };

  const getFileType = (mimeType: string): string => {
    if (mimeType?.includes('pdf')) return 'pdf';
    if (mimeType?.includes('image')) return 'image';
    if (mimeType?.includes('text')) return 'text';
    return 'other';
  };

  const handleDownloadVersion = async (documentId: string, versionId: string, version: string, originalName: string) => {
    try {
      const response = await api.get(`/documents/${documentId}/versions/${versionId}/download`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${originalName}_v${version}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      alert('Erreur lors du téléchargement de la version');
    }
  };

  const handleDocumentStatusChange = async (documentId: string, newStatus: string) => {
    setUpdatingDocStatus(documentId);
    try {
      await api.put(`/documents/${documentId}`, { statut: newStatus });
      loadDocuments();
      loadHistory(1);
    } catch (err: any) {
      if (err.response?.status === 403) {
        alert('Vous n\'avez pas accès à ce document confidentiel');
      } else {
        alert(err.response?.data?.error || 'Erreur lors de la mise à jour du statut');
      }
    } finally {
      setUpdatingDocStatus(null);
    }
  };

  const canAccessDocument = (doc: any): boolean => {
    // Si le document n'est pas confidentiel, tout le monde peut y accéder
    if (!doc.estConfidentiel) return true;

    // Récupérer l'utilisateur actuel
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    
    // L'utilisateur qui a uploadé peut toujours accéder
    if (doc.uploadedById === currentUser.id) return true;

    // Vérifier si l'utilisateur est propriétaire ou créateur du processus
    if (processus && (processus.proprietaireId === currentUser.id || processus.createdById === currentUser.id)) {
      return true;
    }

    // Vérifier si l'utilisateur est dans la liste des permissions
    if (doc.permissionsUtilisateurs && doc.permissionsUtilisateurs.length > 0) {
      return doc.permissionsUtilisateurs.some((perm: any) => perm.userId === currentUser.id || perm.user?.id === currentUser.id);
    }

    return false;
  };

  const canModifyDocument = (doc: any): boolean => {
    // Si le document n'est pas confidentiel, tout le monde peut le modifier
    if (!doc.estConfidentiel) return true;

    // Récupérer l'utilisateur actuel
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    
    // L'utilisateur qui a uploadé peut toujours modifier
    if (doc.uploadedById === currentUser.id) return true;

    // Pour les documents confidentiels, seuls les utilisateurs explicitement dans la liste des permissions peuvent modifier
    // (le propriétaire/créateur du processus n'a pas automatiquement ce droit, sauf s'il est dans la liste)
    if (doc.permissionsUtilisateurs && doc.permissionsUtilisateurs.length > 0) {
      return doc.permissionsUtilisateurs.some((perm: any) => perm.userId === currentUser.id || perm.user?.id === currentUser.id);
    }

    return false;
  };

  const canDeleteOrAddVersion = (doc: any): boolean => {
    // Si le document n'est pas confidentiel, tout le monde peut supprimer/ajouter version
    if (!doc.estConfidentiel) return true;

    // Récupérer l'utilisateur actuel
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    
    // L'utilisateur qui a uploadé peut toujours supprimer/ajouter version
    if (doc.uploadedById === currentUser.id) return true;

    // Pour les documents confidentiels, seuls les utilisateurs explicitement dans la liste des permissions peuvent supprimer/ajouter version
    // (le propriétaire/créateur du processus n'a pas automatiquement ce droit, sauf s'il est dans la liste)
    if (doc.permissionsUtilisateurs && doc.permissionsUtilisateurs.length > 0) {
      return doc.permissionsUtilisateurs.some((perm: any) => perm.userId === currentUser.id || perm.user?.id === currentUser.id);
    }

    return false;
  };

  const documentStatuts = [
    { value: 'brouillon', label: 'Brouillon', color: 'bg-gray-100 text-gray-800' },
    { value: 'en_revision', label: 'En révision', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'valide', label: 'Validé', color: 'bg-green-100 text-green-800' },
    { value: 'archive', label: 'Archivé', color: 'bg-purple-100 text-purple-800' },
  ];

  const handleEditDocument = (doc: any) => {
    setEditingDocument(doc);
    setEditDocumentData({
      nom: doc.nom,
      description: doc.description || '',
      estConfidentiel: doc.estConfidentiel || false,
    });
    // Initialiser les utilisateurs autorisés depuis le document
    const initialPermissionIds = doc.permissionsUtilisateurs 
      ? doc.permissionsUtilisateurs.map((perm: any) => perm.userId || perm.user?.id).filter(Boolean)
      : [];
    setEditPermissionUserIds(initialPermissionIds);
    setShowEditModal(doc.id);
  };

  const handleSaveDocumentEdit = async () => {
    if (!editingDocument) return;

    // Validation : si confidentiel est coché, au moins un utilisateur doit être sélectionné
    if (editDocumentData.estConfidentiel && editPermissionUserIds.length === 0) {
      alert('Au moins un utilisateur doit être sélectionné pour un document confidentiel');
      return;
    }

    try {
      await api.put(`/documents/${editingDocument.id}`, {
        nom: editDocumentData.nom,
        description: editDocumentData.description,
        estConfidentiel: editDocumentData.estConfidentiel,
        permissionUserIds: editDocumentData.estConfidentiel ? editPermissionUserIds : [],
      });

      setShowEditModal(null);
      setEditingDocument(null);
      setEditDocumentData({ nom: '', description: '', estConfidentiel: false });
      setEditPermissionUserIds([]);
      loadDocuments();
      loadHistory(1);
    } catch (err: any) {
      if (err.response?.status === 403) {
        alert('Vous n\'avez pas accès à ce document confidentiel');
      } else {
        alert(err.response?.data?.error || 'Erreur lors de la modification');
      }
    }
  };

  const handleDeleteDocument = async (documentId: string, documentName: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le document "${documentName}" ?`)) {
      return;
    }

    try {
      await api.delete(`/documents/${documentId}`);
      loadDocuments();
      loadHistory(1);
    } catch (err: any) {
      if (err.response?.status === 403) {
        alert('Vous n\'avez pas accès à ce document confidentiel');
      } else {
        alert(err.response?.data?.error || 'Erreur lors de la suppression');
      }
    }
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      const updateData: any = {};
      
      // Mettre à jour le statut séparément si nécessaire
      if (editData.statut !== processus.statut) {
        await api.patch(`/processus/${id}/status`, { statut: editData.statut });
      }
      
      // Préparer les données à mettre à jour
      if (editData.proprietaireId !== (processus.proprietaireId || '')) {
        updateData.proprietaireId = editData.proprietaireId || null;
      }
      const currentEntiteIds = processus.entites?.map((pe: any) => pe.entite?.id || pe.entiteId).filter(Boolean).sort() || [];
      const newEntiteIds = (editData.entiteIds || []).sort();
      if (JSON.stringify(currentEntiteIds) !== JSON.stringify(newEntiteIds)) {
        updateData.entiteIds = editData.entiteIds || [];
      }
      const currentCategorieIds = processus.categories?.map((pc: any) => pc.categorie?.id || pc.categorieId).filter(Boolean).sort() || [];
      const newCategorieIds = (editData.categorieIds || []).sort();
      if (JSON.stringify(currentCategorieIds) !== JSON.stringify(newCategorieIds)) {
        updateData.categorieIds = editData.categorieIds || [];
      }
      
      // Mettre à jour les autres champs seulement s'il y a des changements
      if (Object.keys(updateData).length > 0) {
        await api.put(`/processus/${id}`, updateData);
      }

      setIsEditing(false);
      loadProcessus();
      loadHistory(1);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  const statuts = [
    { value: 'brouillon', label: 'Brouillon', color: 'bg-gray-100 text-gray-800' },
    { value: 'en_revision', label: 'En révision', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'valide', label: 'Validé', color: 'bg-blue-100 text-blue-800' },
    { value: 'actif', label: 'Actif', color: 'bg-green-100 text-green-800' },
    { value: 'archive', label: 'Archivé', color: 'bg-purple-100 text-purple-800' },
    { value: 'obsolete', label: 'Obsolète', color: 'bg-red-100 text-red-800' },
  ];

  if (loading) return <div className="p-6">Chargement...</div>;
  if (error && !processus) {
    return (
      <div className="p-6">
        <button
          onClick={() => navigate('/processus')}
          className="text-blue-600 hover:text-blue-800 mb-4"
        >
          ← Retour à la liste
        </button>
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded">
          {error}
        </div>
      </div>
    );
  }
  if (!processus) return <div className="p-6">Processus non trouvé</div>;

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate('/processus')}
          className="text-blue-600 hover:text-blue-800 mb-4"
        >
          ← Retour à la liste
        </button>
        <h1 className="text-2xl font-bold">{processus.nom}</h1>
        <p className="text-gray-600 mt-2">Code: {processus.codeProcessus}</p>
      </div>

      {/* Informations générales */}
      <div className="bg-white rounded-lg shadow mb-6 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Informations générales</h2>
          {!isEditing ? (
            !isLecteur && (
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
              >
                Modifier
              </button>
            )
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setIsEditing(false);
                  if (processus) {
                    setEditData({
                      statut: processus.statut || 'brouillon',
                      proprietaireId: processus.proprietaireId || '',
                      entiteIds: processus.entites?.map((pe: any) => pe.entite?.id || pe.entiteId).filter(Boolean) || [],
                      categorieIds: processus.categories?.map((pc: any) => pc.categorie?.id || pc.categorieId).filter(Boolean) || [],
                    });
                  }
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
              >
                Annuler
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm disabled:opacity-50"
              >
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          )}
        </div>

        {isEditing ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
              <select
                value={editData.statut}
                onChange={(e) => setEditData({ ...editData, statut: e.target.value })}
                disabled={isLecteur}
                className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                  isLecteur ? 'opacity-50 cursor-not-allowed bg-gray-100' : ''
                }`}
                title={isLecteur ? 'Les lecteurs ne peuvent pas modifier le statut' : ''}
              >
                {statuts.map((statut) => (
                  <option key={statut.value} value={statut.value}>
                    {statut.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Propriétaire</label>
              <select
                value={editData.proprietaireId}
                onChange={(e) => setEditData({ ...editData, proprietaireId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Sélectionner un propriétaire</option>
                {usersList
                  .filter((u) => u.role === 'admin' || u.role === 'contributeur')
                  .map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.prenom} {user.nom} ({user.email})
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Entités</label>
              <select
                multiple
                value={editData.entiteIds}
                onChange={(e) => {
                  const selectedIds = Array.from(e.target.selectedOptions, option => option.value);
                  setEditData({ ...editData, entiteIds: selectedIds });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 min-h-[100px]"
                size={5}
              >
                {entitesList.map((entite) => (
                  <option key={entite.id} value={entite.id}>
                    {entite.nom} ({entite.code})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">Maintenez Ctrl (ou Cmd sur Mac) pour sélectionner plusieurs entités</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Catégories</label>
              <select
                multiple
                value={editData.categorieIds}
                onChange={(e) => {
                  const selectedIds = Array.from(e.target.selectedOptions, option => option.value);
                  setEditData({ ...editData, categorieIds: selectedIds });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 min-h-[100px]"
                size={5}
              >
                {categoriesList.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.nom}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">Maintenez Ctrl (ou Cmd sur Mac) pour sélectionner plusieurs catégories</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Statut</label>
              <div className="mt-1">
                <span className={`px-3 py-1 text-sm rounded ${
                  processus.statut === 'actif' ? 'bg-green-100 text-green-800' :
                  processus.statut === 'valide' ? 'bg-blue-100 text-blue-800' :
                  processus.statut === 'en_revision' ? 'bg-yellow-100 text-yellow-800' :
                  processus.statut === 'archive' ? 'bg-purple-100 text-purple-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {statuts.find(s => s.value === processus.statut)?.label || processus.statut}
                </span>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Entités</label>
              <div className="mt-1">
                {processus.entites && processus.entites.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {processus.entites.map((pe: any) => (
                      <span
                        key={pe.entite?.id || pe.entiteId}
                        className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded"
                      >
                        {pe.entite?.nom || pe.entite?.code || 'N/A'}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">N/A</p>
                )}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Propriétaire</label>
              <p className="mt-1 text-sm">
                {processus.proprietaire ? `${processus.proprietaire.prenom} ${processus.proprietaire.nom}` : 'Non assigné'}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Catégories</label>
              <div className="mt-1">
                {processus.categories && processus.categories.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {processus.categories.map((pc: any) => (
                      <span
                        key={pc.categorie?.id || pc.categorieId}
                        className="px-2 py-1 text-xs rounded flex items-center gap-1"
                        style={{ 
                          backgroundColor: pc.categorie?.couleur ? `${pc.categorie.couleur}20` : '#E5E7EB',
                          color: pc.categorie?.couleur || '#374151',
                        }}
                      >
                        {pc.categorie?.icone && <span>{pc.categorie.icone}</span>}
                        <span>{pc.categorie?.nom || 'N/A'}</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">N/A</p>
                )}
              </div>
            </div>
            {processus.createdBy && (
              <div>
                <label className="text-sm font-medium text-gray-500">Créé par</label>
                <p className="mt-1 text-sm">
                  {processus.createdBy.prenom} {processus.createdBy.nom}
                </p>
              </div>
            )}
            {processus.dateValidation && (
              <div>
                <label className="text-sm font-medium text-gray-500">Date de validation</label>
                <p className="mt-1 text-sm">
                  {new Date(processus.dateValidation).toLocaleDateString('fr-FR')}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Zone Description */}
        <div className="mt-6">
          <label className="text-sm font-medium text-gray-500 block mb-2">Description</label>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 min-h-[100px]">
            {processus.description ? (
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{processus.description}</p>
            ) : (
              <p className="text-sm text-gray-400 italic">Aucune description</p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow mb-6">
        <div className="border-b border-gray-200">
          <div className="flex">
            <button className="px-6 py-3 border-b-2 border-blue-500 text-blue-600 font-medium">
              Documents
            </button>
          </div>
        </div>
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Documents du processus</h2>
            {!isLecteur && (
              <button
                onClick={() => setShowUploadModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                + Ajouter un document
              </button>
            )}
          </div>

          {documents.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Aucun document pour ce processus</p>
          ) : (
            <div className="space-y-4">
              {documents.map((doc) => (
                <div key={doc.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-medium">{doc.nom}</h3>
                      <p className="text-sm text-gray-600 mt-1">{doc.description || 'Pas de description'}</p>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                        <span>Version: {doc.version || '1.0.0'}</span>
                        <span>Taille: {(doc.fichierTaille / 1024).toFixed(2)} Ko</span>
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-gray-600">Statut:</label>
                          <select
                            value={doc.statut || 'brouillon'}
                            onChange={(e) => handleDocumentStatusChange(doc.id, e.target.value)}
                            disabled={isLecteur || updatingDocStatus === doc.id || !canModifyDocument(doc)}
                            className={`px-2 py-1 rounded text-xs border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                              doc.statut === 'valide' ? 'bg-green-100 text-green-800' :
                              doc.statut === 'en_revision' ? 'bg-yellow-100 text-yellow-800' :
                              doc.statut === 'archive' ? 'bg-purple-100 text-purple-800' :
                              'bg-gray-100 text-gray-800'
                            } ${(isLecteur || updatingDocStatus === doc.id || !canModifyDocument(doc)) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                            title={isLecteur ? 'Les lecteurs ne peuvent pas modifier le statut' : (!canModifyDocument(doc) && doc.estConfidentiel ? 'Vous n\'avez pas accès à ce document confidentiel' : '')}
                          >
                            {documentStatuts.map((statut) => (
                              <option key={statut.value} value={statut.value}>
                                {statut.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        {doc.estConfidentiel && (
                          <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs">
                            Confidentiel
                          </span>
                        )}
                      </div>
                      {doc.estConfidentiel && (
                        <div className="mt-3 text-xs text-gray-700 space-y-1 bg-red-50 border border-red-100 rounded p-2">
                          {
                            (() => {
                              const selected = (doc.permissionsUtilisateurs || []).map((p: any) => p.user || p.userId).filter(Boolean);
                              const selectedUsers = (doc.permissionsUtilisateurs || [])
                                .map((p: any) => p.user)
                                .filter((u: any) => !!u);
                              const viewers: string[] = [];
                              // Utilisateurs sélectionnés
                              selectedUsers.forEach((u: any) => viewers.push(`${u.prenom} ${u.nom}`));
                              // Propriétaire du processus
                              if (processus?.proprietaire) viewers.push(`${processus.proprietaire.prenom} ${processus.proprietaire.nom}`);
                              // Créateur du processus
                              if (processus?.createdBy) viewers.push(`${processus.createdBy.prenom} ${processus.createdBy.nom}`);
                              // Uploadeur du document
                              if (doc.uploadedBy) viewers.push(`${doc.uploadedBy.prenom} ${doc.uploadedBy.nom}`);
                              const editors: string[] = [];
                              // Seuls les utilisateurs sélectionnés + uploadeur peuvent modifier
                              selectedUsers.forEach((u: any) => editors.push(`${u.prenom} ${u.nom}`));
                              if (doc.uploadedBy) editors.push(`${doc.uploadedBy.prenom} ${doc.uploadedBy.nom}`);
                              // Dédupliquer
                              const uniq = (arr: string[]) => Array.from(new Set(arr.filter(Boolean)));
                              const viewersUniq = uniq(viewers);
                              const editorsUniq = uniq(editors);
                              return (
                                <div className="space-y-1">
                                  <div>
                                    <span className="font-medium">Peuvent consulter:</span>{' '}
                                    {viewersUniq.length > 0 ? viewersUniq.join(', ') : 'N/A'}
                                  </div>
                                  <div>
                                    <span className="font-medium">Peuvent modifier:</span>{' '}
                                    {editorsUniq.length > 0 ? editorsUniq.join(', ') : 'N/A'}
                                  </div>
                                </div>
                              );
                            })()
                          }
                        </div>
                      )}
                      <div className="mt-4 border-t border-gray-200 pt-3">
                        <p className="text-sm font-medium text-gray-700 mb-3">Historique des versions:</p>
                        <div className="space-y-2">
                          {/* Version actuelle */}
                          <div className="flex items-center justify-between bg-blue-50 p-2 rounded border border-blue-200">
                            <div className="flex-1">
                              <span className="text-sm font-medium text-blue-800">
                                Version actuelle: {doc.version || '1.0.0'}
                              </span>
                              <span className="text-xs text-gray-500 ml-2">
                                ({new Date(doc.createdAt).toLocaleDateString('fr-FR')})
                              </span>
                              <p className="text-xs text-gray-500 mt-1">
                                Par {doc.uploadedBy?.prenom} {doc.uploadedBy?.nom}
                              </p>
                            </div>
                            <button
                              onClick={() => handleDownload(doc)}
                              className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                              Télécharger
                            </button>
                          </div>
                          {/* Anciennes versions */}
                          {doc.versions && doc.versions.length > 0 && doc.versions.map((version: any) => (
                            <div key={version.id} className="flex items-center justify-between bg-gray-50 p-2 rounded border border-gray-200">
                              <div className="flex-1">
                                <span className="text-sm font-medium text-gray-700">
                                  Version {version.version}
                                </span>
                                <span className="text-xs text-gray-500 ml-2">
                                  ({new Date(version.createdAt).toLocaleDateString('fr-FR')})
                                </span>
                                {version.commentaireVersion && (
                                  <p className="text-xs text-gray-600 mt-1 italic">
                                    {version.commentaireVersion}
                                  </p>
                                )}
                                <p className="text-xs text-gray-500 mt-1">
                                  Par {version.uploadedBy?.prenom} {version.uploadedBy?.nom}
                                </p>
                              </div>
                              <button
                                onClick={() => handleDownloadVersion(doc.id, version.id, version.version, doc.fichierNomOriginal)}
                                className="px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
                              >
                                Télécharger
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleViewDocument(doc)}
                        className="px-3 py-1 text-sm bg-blue-100 hover:bg-blue-200 rounded text-blue-700"
                        title="Visualiser le document"
                      >
                        Visualiser
                      </button>
                      <button
                        onClick={() => handleDownload(doc)}
                        className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
                        title="Télécharger la version actuelle"
                      >
                        Télécharger
                      </button>
                      {!isLecteur && (
                        <button
                          onClick={() => handleEditDocument(doc)}
                          disabled={!canModifyDocument(doc)}
                          className={`px-3 py-1 text-sm rounded ${
                            canModifyDocument(doc)
                              ? 'bg-yellow-100 hover:bg-yellow-200'
                              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          }`}
                          title={canModifyDocument(doc) ? 'Modifier le document' : 'Vous n\'avez pas accès à ce document confidentiel'}
                        >
                          Modifier
                        </button>
                      )}
                      {!isLecteur && (
                        <button
                          onClick={() => setShowVersionModal(doc.id)}
                          disabled={!canDeleteOrAddVersion(doc)}
                          className={`px-3 py-1 text-sm rounded ${
                            canDeleteOrAddVersion(doc)
                              ? 'bg-blue-100 hover:bg-blue-200'
                              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          }`}
                          title={canDeleteOrAddVersion(doc) ? 'Ajouter une nouvelle version' : 'Seuls les utilisateurs autorisés peuvent ajouter une version à ce document confidentiel'}
                        >
                          Nouvelle version
                        </button>
                      )}
                      {!isLecteur && (
                        <button
                          onClick={() => handleDeleteDocument(doc.id, doc.nom)}
                          disabled={!canDeleteOrAddVersion(doc)}
                          className={`px-3 py-1 text-sm rounded ${
                            canDeleteOrAddVersion(doc)
                              ? 'bg-red-100 hover:bg-red-200'
                              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          }`}
                          title={canDeleteOrAddVersion(doc) ? 'Supprimer le document' : 'Seuls les utilisateurs autorisés peuvent supprimer ce document confidentiel'}
                        >
                          Supprimer
                        </button>
                      )}
                    </div>
                  </div>
              {/* Commentaires */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm font-semibold mb-2">Commentaires</p>
                {(docComments[doc.id] || []).length === 0 ? (
                  <p className="text-sm text-gray-500">Aucun commentaire</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {(docComments[doc.id] || []).map((c) => (
                      <div key={c.id} className="text-sm bg-gray-50 border border-gray-200 rounded p-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{c.user?.prenom} {c.user?.nom}</span>
                          <span className="text-xs text-gray-500">{new Date(c.createdAt).toLocaleString('fr-FR')}</span>
                        </div>
                        <p className="mt-1 text-gray-700 whitespace-pre-wrap">{c.contenu}</p>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-3 flex gap-2">
                  <input
                    type="text"
                    value={newComment[doc.id] || ''}
                    onChange={(e) => setNewComment({ ...newComment, [doc.id]: e.target.value })}
                    placeholder="Écrire un commentaire..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded"
                  />
                  <button
                    onClick={() => handleAddComment(doc.id)}
                    className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Publier
                  </button>
                </div>
              </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal upload document */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto py-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 my-auto">
            <div className="p-6 max-h-[85vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Ajouter des documents</h2>
                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    setError('');
                    setFiles([]);
                    setFileNames({});
                    setUploadData({ nom: '', description: '', estConfidentiel: false, versionMajeure: '1', versionMineure: '0', versionPatch: '0' });
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">
                  {error}
                </div>
              )}

              <form onSubmit={handleUpload} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fichiers <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="file"
                    required
                    multiple
                    onChange={handleFileChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                  <p className="text-xs text-gray-500 mt-1">Vous pouvez sélectionner plusieurs fichiers</p>
                  
                  {files.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <p className="text-sm font-medium text-gray-700">Fichiers sélectionnés ({files.length})</p>
                      {files.map((file) => (
                        <div key={file.name} className="flex items-center justify-between bg-gray-50 p-2 rounded border border-gray-200">
                          <div className="flex-1">
                            <input
                              type="text"
                              value={fileNames[file.name] || file.name}
                              onChange={(e) => setFileNames({ ...fileNames, [file.name]: e.target.value })}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                              placeholder="Nom du document"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              {(file.size / 1024).toFixed(2)} Ko - {file.type || 'Type inconnu'}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFile(file.name)}
                            className="ml-2 text-red-600 hover:text-red-800"
                            title="Retirer ce fichier"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={uploadData.description}
                    onChange={(e) => setUploadData({ ...uploadData, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Version majeure
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={uploadData.versionMajeure}
                      onChange={(e) => setUploadData({ ...uploadData, versionMajeure: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Version mineure
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={uploadData.versionMineure}
                      onChange={(e) => setUploadData({ ...uploadData, versionMineure: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Version patch
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={uploadData.versionPatch}
                      onChange={(e) => setUploadData({ ...uploadData, versionPatch: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  Version complète: {uploadData.versionMajeure}.{uploadData.versionMineure}.{uploadData.versionPatch}
                </div>

                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={uploadData.estConfidentiel}
                      disabled={!canSetConfidentiel}
                      onChange={(e) => {
                        setUploadData({ ...uploadData, estConfidentiel: e.target.checked });
                        if (!e.target.checked) {
                          setPermissionUserIds([]);
                        }
                      }}
                      className="mr-2"
                    />
                    <span className={`text-sm ${!canSetConfidentiel ? 'text-gray-400' : 'text-gray-700'}`}>
                      Document confidentiel
                      {!canSetConfidentiel && ' (Seul le propriétaire ou le créateur du processus peut définir un document comme confidentiel)'}
                    </span>
                  </label>
                </div>

                {uploadData.estConfidentiel && canSetConfidentiel && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Utilisateurs autorisés <span className="text-red-500">*</span>
                    </label>
                    <select
                      multiple
                      value={permissionUserIds}
                      onChange={(e) => {
                        const selected = Array.from(e.target.selectedOptions, option => option.value);
                        setPermissionUserIds(selected);
                      }}
                      required={uploadData.estConfidentiel}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md min-h-[120px]"
                      size={5}
                    >
                      {usersList.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.prenom} {user.nom} ({user.email})
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Sélectionnez un ou plusieurs utilisateurs autorisés à visualiser ce document. Utilisez Ctrl (Cmd sur Mac) pour sélectionner plusieurs utilisateurs.
                    </p>
                    {permissionUserIds.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {permissionUserIds.map((userId) => {
                          const user = usersList.find(u => u.id === userId);
                          return user ? (
                            <span
                              key={userId}
                              className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs flex items-center gap-1"
                            >
                              {user.prenom} {user.nom}
                              <button
                                type="button"
                                onClick={() => setPermissionUserIds(permissionUserIds.filter(id => id !== userId))}
                                className="text-blue-600 hover:text-blue-800"
                              >
                                ×
                              </button>
                            </span>
                          ) : null;
                        })}
                      </div>
                    )}
                    {uploadData.estConfidentiel && permissionUserIds.length === 0 && (
                      <p className="text-xs text-red-500 mt-1">
                        Au moins un utilisateur doit être sélectionné pour un document confidentiel
                      </p>
                    )}
                  </div>
                )}

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowUploadModal(false);
                      setError('');
                      setFiles([]);
                      setFileNames({});
                      setPermissionUserIds([]);
                      setUploadData({ nom: '', description: '', estConfidentiel: false, versionMajeure: '1', versionMineure: '0', versionPatch: '0' });
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={uploading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {uploading ? `Upload en cours... (${files.length} fichier${files.length > 1 ? 's' : ''})` : `Ajouter ${files.length > 0 ? `${files.length} document${files.length > 1 ? 's' : ''}` : 'document'}`}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal nouvelle version */}
      {showVersionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Nouvelle version</h2>
                <button
                  onClick={() => setShowVersionModal(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={(e) => handleVersionUpload(showVersionModal, e)} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nouveau fichier <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="file"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Commentaire de version
                  </label>
                  <textarea
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="Décrivez les changements de cette version..."
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowVersionModal(null)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Ajouter version
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal modification document */}
      {showEditModal && editingDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto py-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 my-auto">
            <div className="p-6 max-h-[85vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Modifier le document</h2>
                <button
                  onClick={() => {
                    setShowEditModal(null);
                    setEditingDocument(null);
                    setEditDocumentData({ nom: '', description: '', estConfidentiel: false });
                    setEditPermissionUserIds([]);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); handleSaveDocumentEdit(); }} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editDocumentData.nom}
                    onChange={(e) => setEditDocumentData({ ...editDocumentData, nom: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={editDocumentData.description}
                    onChange={(e) => setEditDocumentData({ ...editDocumentData, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>

                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={editDocumentData.estConfidentiel}
                      disabled={!canSetConfidentiel}
                      onChange={(e) => {
                        setEditDocumentData({ ...editDocumentData, estConfidentiel: e.target.checked });
                        if (!e.target.checked) {
                          setEditPermissionUserIds([]);
                        }
                      }}
                      className="mr-2"
                    />
                    <span className={`text-sm ${!canSetConfidentiel ? 'text-gray-400' : 'text-gray-700'}`}>
                      Document confidentiel
                      {!canSetConfidentiel && ' (Seul le propriétaire ou le créateur du processus peut définir un document comme confidentiel)'}
                    </span>
                  </label>
                </div>

                {editDocumentData.estConfidentiel && canSetConfidentiel && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Utilisateurs autorisés <span className="text-red-500">*</span>
                    </label>
                    <select
                      multiple
                      value={editPermissionUserIds}
                      onChange={(e) => {
                        const selected = Array.from(e.target.selectedOptions, option => option.value);
                        setEditPermissionUserIds(selected);
                      }}
                      required={editDocumentData.estConfidentiel}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md min-h-[120px]"
                      size={5}
                    >
                      {usersList.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.prenom} {user.nom} ({user.email})
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Sélectionnez un ou plusieurs utilisateurs autorisés à visualiser ce document. Utilisez Ctrl (Cmd sur Mac) pour sélectionner plusieurs utilisateurs.
                    </p>
                    {editPermissionUserIds.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {editPermissionUserIds.map((userId) => {
                          const user = usersList.find(u => u.id === userId);
                          return user ? (
                            <span
                              key={userId}
                              className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs flex items-center gap-1"
                            >
                              {user.prenom} {user.nom}
                              <button
                                type="button"
                                onClick={() => setEditPermissionUserIds(editPermissionUserIds.filter(id => id !== userId))}
                                className="text-blue-600 hover:text-blue-800"
                              >
                                ×
                              </button>
                            </span>
                          ) : null;
                        })}
                      </div>
                    )}
                    {editDocumentData.estConfidentiel && editPermissionUserIds.length === 0 && (
                      <p className="text-xs text-red-500 mt-1">
                        Au moins un utilisateur doit être sélectionné pour un document confidentiel
                      </p>
                    )}
                  </div>
                )}

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                  onClick={() => {
                    setShowEditModal(null);
                    setEditingDocument(null);
                    setEditDocumentData({ nom: '', description: '', estConfidentiel: false });
                    setEditPermissionUserIds([]);
                  }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Enregistrer
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Historique */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4">Historique des modifications</h2>
          {history.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Aucun historique disponible</p>
          ) : (
            <div className="space-y-4">
              {history.map((entry) => {
                const getActionLabel = (action: string) => {
                  const labels: { [key: string]: string } = {
                    creation: 'Création',
                    modification: 'Modification',
                    suppression: 'Suppression',
                    consultation: 'Consultation',
                    lecture: 'Consultation',
                    telechargement: 'Téléchargement',
                  };
                  return labels[action] || action;
                };

                const getActionIcon = (action: string) => {
                  if (action === 'creation') return '➕';
                  if (action === 'modification') return '✏️';
                  if (action === 'suppression') return '🗑️';
                  if (action === 'telechargement') return '⬇️';
                  if (action === 'consultation' || action === 'lecture') return '👁️';
                  return '📝';
                };

                const getActionColor = (action: string) => {
                  if (action === 'creation') return 'bg-green-100 text-green-800';
                  if (action === 'modification') return 'bg-blue-100 text-blue-800';
                  if (action === 'suppression') return 'bg-red-100 text-red-800';
                  if (action === 'telechargement') return 'bg-purple-100 text-purple-800';
                  if (action === 'consultation' || action === 'lecture') return 'bg-indigo-100 text-indigo-800';
                  return 'bg-gray-100 text-gray-800';
                };

                return (
                  <div key={entry.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div className={`text-2xl ${getActionColor(entry.action)} rounded-full w-10 h-10 flex items-center justify-center`}>
                          {getActionIcon(entry.action)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-1 text-xs rounded ${getActionColor(entry.action)}`}>
                              {getActionLabel(entry.action)}
                            </span>
                          </div>
                          {entry.details && typeof entry.details === 'object' && (
                            <div className="text-xs text-gray-600 mt-1 space-y-0.5">
                              {entry.details.changementStatut && (
                                <div>Statut: {entry.details.changementStatut}</div>
                              )}
                              {entry.details.changementNom && (
                                <div>Nom: {entry.details.changementNom}</div>
                              )}
                              {entry.details.changementProprietaire && (
                                <div>Propriétaire modifié</div>
                              )}
                              {entry.details.changementEntite && (
                                <div>Entité modifiée</div>
                              )}
                              {entry.details.changementCategorie && (
                                <div>Catégorie modifiée</div>
                              )}
                              {entry.details.changementCategories && (
                                <div>Catégories modifiées</div>
                              )}
                              {entry.details.version && (
                                <div>Version: {entry.details.version}</div>
                              )}
                              {entry.details.ancienneVersion && entry.details.nouvelleVersion && (
                                <div>Version: {entry.details.ancienneVersion} → {entry.details.nouvelleVersion}</div>
                              )}
                              {entry.details.commentaire && (
                                <div className="italic">Commentaire: {entry.details.commentaire}</div>
                              )}
                              {entry.details.action === 'nouvelle_version' && (
                                <div className="text-blue-600">Nouvelle version ajoutée</div>
                              )}
                            </div>
                          )}
                          <p className="text-sm text-gray-700 mt-2">
                            {entry.user?.prenom} {entry.user?.nom}
                            {entry.ressourceNom && (
                              <span className="text-gray-500"> - {entry.ressourceNom}</span>
                            )}
                            {entry.ressourceType === 'document' && (
                              <span className="text-xs text-gray-400 ml-2">(Document)</span>
                            )}
                            {entry.ressourceType === 'processus' && (
                              <span className="text-xs text-gray-400 ml-2">(Processus)</span>
                            )}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(entry.timestamp).toLocaleString('fr-FR', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          {/* Pagination */}
          {historyPagination.totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between border-t border-gray-200 pt-4">
              <div className="text-sm text-gray-700">
                Affichage de {(historyPagination.page - 1) * historyPagination.limit + 1} à{' '}
                {Math.min(historyPagination.page * historyPagination.limit, historyPagination.total)} sur{' '}
                {historyPagination.total} entrées
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => loadHistory(historyPagination.page - 1)}
                  disabled={historyPagination.page === 1}
                  className={`px-4 py-2 rounded text-sm font-medium ${
                    historyPagination.page === 1
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  Précédent
                </button>
                <div className="flex gap-1">
                  {Array.from({ length: historyPagination.totalPages }, (_, i) => i + 1)
                    .filter((pageNum) => {
                      // Afficher la première page, la dernière page, la page actuelle et les pages adjacentes
                      return (
                        pageNum === 1 ||
                        pageNum === historyPagination.totalPages ||
                        (pageNum >= historyPagination.page - 1 && pageNum <= historyPagination.page + 1)
                      );
                    })
                    .map((pageNum, index, array) => {
                      // Ajouter des ellipses si nécessaire
                      const showEllipsisBefore = index > 0 && pageNum - array[index - 1] > 1;
                      return (
                        <div key={pageNum} className="flex items-center gap-1">
                          {showEllipsisBefore && (
                            <span className="px-2 text-gray-500">...</span>
                          )}
                          <button
                            onClick={() => loadHistory(pageNum)}
                            className={`px-3 py-2 rounded text-sm font-medium ${
                              historyPagination.page === pageNum
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {pageNum}
                          </button>
                        </div>
                      );
                    })}
                </div>
                <button
                  onClick={() => loadHistory(historyPagination.page + 1)}
                  disabled={historyPagination.page === historyPagination.totalPages}
                  className={`px-4 py-2 rounded text-sm font-medium ${
                    historyPagination.page === historyPagination.totalPages
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  Suivant
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de visualisation */}
      {viewingDocument && documentUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[90vw] h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b">
              <div>
                <h2 className="text-xl font-bold">{viewingDocument.nom}</h2>
                <p className="text-sm text-gray-500">
                  Version: {viewingDocument.version || 'N/A'} | 
                  Taille: {(viewingDocument.fichierTaille / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleDownload(viewingDocument)}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Télécharger
                </button>
                <button
                  onClick={closeViewer}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                >
                  Fermer
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden p-4">
              {getFileType(viewingDocument.fichierType) === 'pdf' ? (
                <iframe
                  src={documentUrl}
                  className="w-full h-full border border-gray-300 rounded"
                  title={viewingDocument.nom}
                />
              ) : getFileType(viewingDocument.fichierType) === 'image' ? (
                <div className="flex justify-center items-center h-full overflow-auto">
                  <img
                    src={documentUrl}
                    alt={viewingDocument.nom}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              ) : getFileType(viewingDocument.fichierType) === 'text' ? (
                <iframe
                  src={documentUrl}
                  className="w-full h-full border border-gray-300 rounded"
                  title={viewingDocument.nom}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full">
                  <p className="text-gray-500 mb-4">
                    Aperçu non disponible pour ce type de fichier ({viewingDocument.fichierType})
                  </p>
                  <button
                    onClick={() => handleDownload(viewingDocument)}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Télécharger pour visualiser
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
