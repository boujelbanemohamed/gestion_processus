import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../store/auth';
import * as XLSX from 'xlsx';

export default function Documents() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const isLecteur = currentUser?.role === 'lecteur';
  const isAdmin = currentUser?.role === 'admin';
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [showCommentsModalFor, setShowCommentsModalFor] = useState<any | null>(null);
  const [commentsModalItems, setCommentsModalItems] = useState<any[]>([]);
  const [viewingDocument, setViewingDocument] = useState<any | null>(null);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [excelData, setExcelData] = useState<any[]>([]);
  const [excelSheetNames, setExcelSheetNames] = useState<string[]>([]);
  const [currentSheet, setCurrentSheet] = useState<string>('');
  const [loadingExcel, setLoadingExcel] = useState(false);
  const [excelWorkbook, setExcelWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [fileNames, setFileNames] = useState<{ [key: string]: string }>({});
  const [uploadData, setUploadData] = useState({
    nom: '',
    description: '',
    estConfidentiel: false,
    versionMajeure: '1',
    versionMineure: '0',
    versionPatch: '0',
    processusId: '',
    typeDocument: 'general',
  });
  const [processusList, setProcessusList] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [permissionUserIds, setPermissionUserIds] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [showAccesModal, setShowAccesModal] = useState(false);
  const [acceDoc, setAcceDoc] = useState<any>(null);
  const [acceEstConfidentiel, setAcceEstConfidentiel] = useState(false);
  const [accePermissionUserIds, setAccePermissionUserIds] = useState<string[]>([]);
  const [filters, setFilters] = useState({
    search: '',
    typeDocument: '',
    statut: '',
    processusId: '',
  });
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [favorisDocuments, setFavorisDocuments] = useState<Set<string>>(new Set());
  const [loadingFavoris, setLoadingFavoris] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadDocuments();
    loadProcessus();
    loadUsers();
    loadFavorisStatus();
  }, []);

  const loadFavorisStatus = async () => {
    if (!currentUser?.id) return;
    try {
      const response = await api.get('/favoris');
      const documents = response.data.documents || [];
      const favorisIds = new Set<string>(documents.map((d: any) => String(d.id)));
      setFavorisDocuments(favorisIds);
    } catch (error) {
      console.error('Erreur chargement statut favoris:', error);
    }
  };

  const handleToggleDocumentFavori = async (documentId: string) => {
    if (loadingFavoris[documentId]) return;
    setLoadingFavoris({ ...loadingFavoris, [documentId]: true });
    try {
      const estFavori = favorisDocuments.has(documentId);
      if (estFavori) {
        await api.delete(`/favoris/documents/${documentId}`);
        setFavorisDocuments((prev) => {
          const newSet = new Set(prev);
          newSet.delete(documentId);
          return newSet;
        });
      } else {
        await api.post(`/favoris/documents/${documentId}`);
        setFavorisDocuments((prev) => new Set([...prev, documentId]));
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erreur lors de la modification des favoris');
    } finally {
      setLoadingFavoris({ ...loadingFavoris, [documentId]: false });
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

  useEffect(() => {
    loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.search, filters.typeDocument, filters.statut, filters.processusId, sortConfig]);
  useEffect(() => {
    setPage(1);
  }, [filters.search, filters.typeDocument, filters.statut, filters.processusId, sortConfig]);

  const loadProcessus = async () => {
    try {
      const response = await api.get('/processus');
      setProcessusList(response.data);
    } catch (error) {
      console.error('Erreur chargement processus:', error);
    }
  };

  useEffect(() => {
    // Nettoyer l'URL blob lors du démontage
    return () => {
      if (documentUrl) {
        window.URL.revokeObjectURL(documentUrl);
      }
    };
  }, [documentUrl]);

  const loadDocuments = async () => {
    try {
      const params: any = {};
      if (filters.search) params.search = filters.search;
      if (filters.typeDocument) params.typeDocument = filters.typeDocument;
      if (filters.statut) params.statut = filters.statut;
      if (filters.processusId) {
        params.referenceType = 'processus';
        params.referenceId = filters.processusId;
      }
      if (sortConfig) {
        params.sortBy = sortConfig.key;
        params.sortOrder = sortConfig.direction;
      }
      const response = await api.get('/documents', { params });
      let sortedDocuments = response.data;
      
      // Tri côté client pour uploadedBy (car relation Prisma)
      if (sortConfig?.key === 'uploadedBy') {
        sortedDocuments = [...response.data].sort((a, b) => {
          const aName = a.uploadedBy ? `${a.uploadedBy.prenom} ${a.uploadedBy.nom}` : '';
          const bName = b.uploadedBy ? `${b.uploadedBy.prenom} ${b.uploadedBy.nom}` : '';
          if (sortConfig.direction === 'asc') {
            return aName.localeCompare(bName, 'fr', { sensitivity: 'base' });
          } else {
            return bName.localeCompare(aName, 'fr', { sensitivity: 'base' });
          }
        });
      }
      
      setDocuments(sortedDocuments);

      // Charger les compteurs de commentaires pour chaque document (affichage conditionnel du bouton)
      // On charge les commentaires de manière silencieuse, les erreurs ne bloquent pas l'affichage
      const counts: Record<string, number> = {};
      await Promise.allSettled(
        (response.data || []).map(async (d: any) => {
          try {
            const token = localStorage.getItem('token');
            const res = await api.get(`/documents/${d.id}/comments`, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
            counts[d.id] = Array.isArray(res.data) ? res.data.length : 0;
          } catch (error) {
            // Erreur silencieuse : on met simplement le compteur à 0
            console.warn(`Impossible de charger les commentaires pour le document ${d.id}:`, error);
            counts[d.id] = 0;
          }
        })
      );
      setCommentCounts(counts);
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const resetSort = () => {
    setSortConfig(null);
  };

  const openCommentsModal = async (doc: any) => {
    try {
      const token = localStorage.getItem('token');
      const res = await api.get(`/documents/${doc.id}/comments`, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
      setCommentsModalItems(Array.isArray(res.data) ? res.data : []);
      setShowCommentsModalFor(doc);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erreur lors du chargement des commentaires');
    }
  };

  const canAccessDocument = async (doc: any): Promise<boolean> => {
    // Si le document n'est pas confidentiel, tout le monde peut y accéder
    if (!doc.estConfidentiel) return true;

    // Récupérer l'utilisateur actuel
    const user = currentUser || JSON.parse(localStorage.getItem('user') || '{}');
    if (!user.id) return false;
    
    // L'utilisateur qui a uploadé peut toujours accéder
    if (doc.uploadedById === user.id) return true;

    // Vérifier si l'utilisateur est dans la liste des permissions
    if (doc.permissionsUtilisateurs && doc.permissionsUtilisateurs.length > 0) {
      const hasPermission = doc.permissionsUtilisateurs.some((perm: any) => perm.userId === user.id || perm.user?.id === user.id);
      if (hasPermission) return true;
    }

    // Pour les documents confidentiels liés à un processus, vérifier si l'utilisateur est propriétaire/créateur
    if (doc.referenceType === 'processus' && doc.referenceId) {
      try {
        const processusResponse = await api.get(`/processus/${doc.referenceId}`);
        const processus = processusResponse.data;
        if (processus && (processus.proprietaireId === user.id || processus.createdById === user.id)) {
          return true;
        }
      } catch (error) {
        // Si on ne peut pas charger le processus, on laisse le backend décider
        // On retourne true pour permettre la requête, le backend vérifiera
        return true;
      }
    }

    return false;
  };

  const handleViewDocument = async (doc: any) => {
    // Vérifier les permissions avant de faire la requête
    const hasAccess = await canAccessDocument(doc);
    if (!hasAccess) {
      alert('Vous n\'avez pas accès à ce document confidentiel');
      return;
    }

    try {
      // Utiliser l'endpoint /view pour la visualisation (log 'lecture')
      const response = await api.get(`/documents/${doc.id}/view`, {
        responseType: 'blob',
      });
      
      const fileType = getFileType(doc.fichierType);
      
      // Si c'est un fichier Excel, parser le contenu
      if (fileType === 'excel') {
        setLoadingExcel(true);
        const arrayBuffer = await response.data.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheetNames = workbook.SheetNames;
        setExcelWorkbook(workbook);
        setExcelSheetNames(sheetNames);
        const firstSheetName = sheetNames[0] || '';
        setCurrentSheet(firstSheetName);
        
        // Convertir la première feuille en JSON
        const firstSheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });
        setExcelData(jsonData);
        setLoadingExcel(false);
      } else {
        // Créer un blob avec le type MIME correct pour une meilleure compatibilité
        const mimeType = doc.fichierType || response.headers['content-type'] || 'application/octet-stream';
        const blob = new Blob([response.data], { type: mimeType });
        const url = window.URL.createObjectURL(blob);
        setDocumentUrl(url);
      }
      
      setViewingDocument(doc);
      // Recharger les documents pour mettre à jour les statistiques
      loadDocuments();
    } catch (error: any) {
      console.error('Erreur lors du chargement du document:', error);
      if (error.response?.status === 403) {
        alert('Vous n\'avez pas accès à ce document confidentiel');
      } else if (error.response?.status === 404) {
        alert('Document non trouvé. Veuillez vérifier que l\'API est à jour.');
        console.error('Endpoint non trouvé:', error.config?.url);
      } else {
        alert(`Erreur lors du chargement du document: ${error.response?.data?.error || error.message}`);
      }
      setLoadingExcel(false);
    }
  };

  const handleDownload = async (doc: any) => {
    // Vérifier les permissions avant de faire la requête
    const hasAccess = await canAccessDocument(doc);
    if (!hasAccess) {
      alert('Vous n\'avez pas accès à ce document confidentiel');
      return;
    }

    try {
      const response = await api.get(`/documents/${doc.id}/download`, {
        responseType: 'blob',
      });
      // Créer un blob avec le type MIME correct
      const blob = new Blob([response.data], { 
        type: doc.fichierType || response.headers['content-type'] || 'application/octet-stream' 
      });
      const url = window.URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.setAttribute('download', doc.fichierNomOriginal);
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      // Nettoyer le blob URL après un court délai
      setTimeout(() => window.URL.revokeObjectURL(url), 100);
      // Recharger les documents pour mettre à jour les statistiques
      loadDocuments();
    } catch (error: any) {
      console.error('Erreur lors du téléchargement:', error);
      if (error.response?.status === 403) {
        alert('Vous n\'avez pas accès à ce document confidentiel');
      } else {
        alert('Erreur lors du téléchargement du document');
      }
    }
  };

  const closeViewer = () => {
    if (documentUrl) {
      window.URL.revokeObjectURL(documentUrl);
    }
    setViewingDocument(null);
    setDocumentUrl(null);
    setExcelData([]);
    setExcelSheetNames([]);
    setCurrentSheet('');
    setExcelWorkbook(null);
  };

  const handleSheetChange = (sheetName: string) => {
    if (!excelWorkbook) return;
    setCurrentSheet(sheetName);
    const sheet = excelWorkbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    setExcelData(jsonData);
  };

  const [editingDocument, setEditingDocument] = useState<any | null>(null);
  const [editData, setEditData] = useState({
    nom: '',
    description: '',
    statut: 'brouillon' as any,
    estConfidentiel: false,
    permissionUserIds: [] as string[],
  });

  const handleEdit = (doc: any) => {
    setEditingDocument(doc);
    setEditData({
      nom: doc.nom,
      description: doc.description || '',
      statut: doc.statut,
      estConfidentiel: doc.estConfidentiel || false,
      permissionUserIds: doc.permissionsUtilisateurs?.map((p: any) => p.userId || p.user?.id).filter(Boolean) || [],
    });
  };

  const handleSaveEdit = async () => {
    if (!editingDocument) return;
    
    try {
      const updateData: any = {
        nom: editData.nom,
        description: editData.description,
        statut: editData.statut,
        estConfidentiel: editData.estConfidentiel,
      };

      if (editData.estConfidentiel && editData.permissionUserIds.length > 0) {
        updateData.permissionUserIds = editData.permissionUserIds.join(',');
      }

      await api.put(`/documents/${editingDocument.id}`, updateData);
      setEditingDocument(null);
      loadDocuments();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erreur lors de la modification du document');
    }
  };

  const canModifierAcces = (doc: any) => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    if (doc.uploadedById === currentUser.id) return true;
    if (doc.permissionsUtilisateurs?.some((p: any) => p.userId === currentUser.id || p.user?.id === currentUser.id)) return true;
    return false;
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
      alert(err.response?.data?.error || "Erreur lors de la modification de l'accès");
    }
  };
  const handleDelete = async (doc: any) => {
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer le document "${doc.nom}" ?`)) {
      return;
    }

    try {
      await api.delete(`/documents/${doc.id}`);
      loadDocuments();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erreur lors de la suppression du document');
    }
  };

  const getFileType = (mimeType: string): string => {
    if (mimeType?.includes('pdf')) return 'pdf';
    if (mimeType?.includes('image')) return 'image';
    if (mimeType?.includes('text')) return 'text';
    if (mimeType?.includes('spreadsheet') || mimeType?.includes('excel') || 
        mimeType?.includes('vnd.ms-excel') || mimeType?.includes('vnd.openxmlformats-officedocument.spreadsheetml')) {
      return 'excel';
    }
    return 'other';
  };

  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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
        setUploadData((prev) => ({ 
          ...prev, 
          nom: selectedFiles[0].name,
        }));
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

    setError('');
    setUploading(true);

    try {
      // Uploader tous les fichiers
      const uploadPromises = files.map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('nom', fileNames[file.name] || file.name);
        formData.append('typeDocument', uploadData.processusId ? 'processus' : (uploadData.typeDocument || 'general'));
        if (uploadData.processusId) {
          formData.append('referenceType', 'processus');
          formData.append('referenceId', uploadData.processusId);
        }
        formData.append('description', uploadData.description || '');
        formData.append('estConfidentiel', uploadData.estConfidentiel.toString());
        if (uploadData.estConfidentiel && permissionUserIds.length > 0) {
          formData.append('permissionUserIds', permissionUserIds.join(','));
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
      setUploadData({ nom: '', description: '', estConfidentiel: false, versionMajeure: '1', versionMineure: '0', versionPatch: '0', processusId: '', typeDocument: 'general' });
      setPermissionUserIds([]);
      loadDocuments();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur lors de l\'upload des fichiers');
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <div className="p-6">Chargement...</div>;

  const totalPages = Math.max(1, Math.ceil(documents.length / pageSize));
  const startIdx = (page - 1) * pageSize;
  const pagedDocuments = documents.slice(startIdx, startIdx + pageSize);
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return pages;
    }
    const addRange = (start: number, end: number) => {
      for (let i = start; i <= end; i++) pages.push(i);
    };
    if (page <= 4) {
      addRange(1, 5);
      pages.push('...');
      pages.push(totalPages);
    } else if (page >= totalPages - 3) {
      pages.push(1);
      pages.push('...');
      addRange(totalPages - 4, totalPages);
    } else {
      pages.push(1);
      pages.push('...');
      addRange(page - 1, page + 1);
      pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Documents</h1>
        {!isLecteur && (
          <button
            onClick={() => {
              setShowUploadModal(true);
              setError('');
              setFiles([]);
              setFileNames({});
              setUploadData({ nom: '', description: '', estConfidentiel: false, versionMajeure: '1', versionMineure: '0', versionPatch: '0', processusId: '', typeDocument: 'general' });
              setPermissionUserIds([]);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Nouveau document
          </button>
        )}
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Recherche</label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="Nom, description"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={filters.typeDocument}
              onChange={(e) => setFilters({ ...filters, typeDocument: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">Tous</option>
              <option value="general">Général</option>
              <option value="processus">Processus</option>
              <option value="projet">Projet</option>
              <option value="contrat">Contrat</option>
              <option value="tache">Tâche</option>
              <option value="client_fournisseur">Client / Fournisseur</option>
              <option value="template">Template</option>
              <option value="autre">Autre</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
            <select
              value={filters.statut}
              onChange={(e) => setFilters({ ...filters, statut: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">Tous</option>
              <option value="brouillon">Brouillon</option>
              <option value="en_revision">En révision</option>
              <option value="valide">Validé</option>
              <option value="archive">Archivé</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Processus</label>
            <select
              value={filters.processusId}
              onChange={(e) => setFilters({ ...filters, processusId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">Tous</option>
              {processusList.map((processus) => (
                <option key={processus.id} value={processus.id}>
                  {processus.nom} ({processus.codeProcessus})
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <button
            type="button"
            onClick={() => setFilters({ search: '', typeDocument: '', statut: '', processusId: '' })}
            className="px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Réinitialiser
          </button>
        </div>
      </div>
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-semibold">Liste des documents</h2>
          {sortConfig && (
            <button
              onClick={resetSort}
              className="px-3 py-1 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              title="Réinitialiser le tri"
            >
              Réinitialiser le tri
            </button>
          )}
        </div>
        <table className="min-w-full divide-y divide-gray-200 min-w-[1100px]">
          <thead className="bg-gray-50">
            <tr>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('nom')}
              >
                <div className="flex items-center gap-1">
                  Nom
                  {sortConfig?.key === 'nom' && (
                    <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('typeDocument')}
              >
                <div className="flex items-center gap-1">
                  Type
                  {sortConfig?.key === 'typeDocument' && (
                    <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Processus / Projet / Contrat / Tâche</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Version</th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('statut')}
              >
                <div className="flex items-center gap-1">
                  Statut
                  {sortConfig?.key === 'statut' && (
                    <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Accès</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Commentaires</th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('uploadedBy')}
              >
                <div className="flex items-center gap-1">
                  Uploadé par
                  {sortConfig?.key === 'uploadedBy' && (
                    <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('createdAt')}
              >
                <div className="flex items-center gap-1">
                  Date d'upload
                  {sortConfig?.key === 'createdAt' && (
                    <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('updatedAt')}
              >
                <div className="flex items-center gap-1">
                  Date de modification
                  {sortConfig?.key === 'updatedAt' && (
                    <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Visualisations</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Téléchargements</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Favoris</th>
              {isAdmin && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {pagedDocuments.map((d) => (
              <tr key={d.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => handleViewDocument(d)}
                    className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                  >
                    {d.nom}
                  </button>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm capitalize">
                  {d.typeDocument === 'autre' && d.tacheDocuments?.length > 0 ? 'tâche' : d.typeDocument}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {d.referenceType === 'processus' && d.referenceId ? (
                    d.processus ? (
                      <button
                        onClick={() => navigate(`/processus/${d.referenceId}`)}
                        className="text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {d.processus.nom} ({d.processus.codeProcessus})
                      </button>
                    ) : (
                      <button
                        onClick={() => navigate(`/processus/${d.referenceId}`)}
                        className="text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        Voir le processus
                      </button>
                    )
                  ) : (
                    d.referenceType === 'projet' && d.referenceId ? (
                      <button onClick={() => navigate(`/projets/${d.referenceId}`)} className="text-blue-600 hover:text-blue-800 hover:underline">
                        {d.projet ? `${d.projet.nom} (${d.projet.codeProjet})` : 'Voir le projet'}
                      </button>
                    ) : d.typeDocument === 'contrat' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-xs font-medium">
                        📄 {d.contrats?.[0]?.contrat?.nom || 'Contrat lié'}
                      </span>
                    ) : d.typeDocument === 'tache' || d.typeDocument === 'autre' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-50 text-orange-700 rounded text-xs font-medium">
                        📋 {d.tacheDocuments?.[0]?.tache?.nom || 'Tâche'}
                      </span>
                    ) : (
                      <span className="text-gray-500 italic">N/A</span>
                    )
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">{d.version || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {(() => {
                    const statut = d.typeDocument === 'contrat' && d.contrats?.[0]?.contrat?.statut
                      ? d.contrats[0].contrat.statut
                      : d.statut;
                    const color = statut === 'valide' || statut === 'actif' ? 'bg-green-100 text-green-800' :
                      statut === 'en_revision' || statut === 'suspendu' ? 'bg-yellow-100 text-yellow-800' :
                      statut === 'expire' || statut === 'resilie' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800';
                    return <span className={`px-2 py-1 text-xs rounded ${color}`}>{statut}</span>;
                  })()}
                  {d.estConfidentiel && (
                    <div className="mt-2 text-xs text-gray-700 space-y-1">
                      <span className="inline-block px-2 py-0.5 bg-red-100 text-red-800 rounded">Confidentiel</span>
                      {
                        (() => {
                          const selectedUsers = (d.permissionsUtilisateurs || [])
                            .map((p: any) => p.user)
                            .filter((u: any) => !!u);
                          const viewers: string[] = [];
                          selectedUsers.forEach((u: any) => viewers.push(`${u.prenom} ${u.nom}`));
                          if (d.uploadedBy) viewers.push(`${d.uploadedBy.prenom} ${d.uploadedBy.nom}`);
                          if (d.processus?.proprietaire) viewers.push(`${d.processus.proprietaire.prenom} ${d.processus.proprietaire.nom}`);
                          if (d.processus?.createdBy) viewers.push(`${d.processus.createdBy.prenom} ${d.processus.createdBy.nom}`);
                          const editors: string[] = [];
                          selectedUsers.forEach((u: any) => editors.push(`${u.prenom} ${u.nom}`));
                          if (d.uploadedBy) editors.push(`${d.uploadedBy.prenom} ${d.uploadedBy.nom}`);
                          const uniq = (arr: string[]) => Array.from(new Set(arr.filter(Boolean)));
                          const viewersUniq = uniq(viewers);
                          const editorsUniq = uniq(editors);
                          return (
                            <div className="space-y-0.5">
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
                </td>
                <td className="px-6 py-4 text-sm">
                  {d.estConfidentiel ? (
                    <div>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">🔒 Accès restreint</span>
                      <div className="mt-1 text-xs text-gray-600 space-y-0.5">
                        {(() => {
                          const ayantsDroit: {nom: string, roles: string[]}[] = [];
                          const addPerson = (id: string, nom: string, role: string) => {
                            const existing = ayantsDroit.find(a => a.nom === nom);
                            if (existing) { if (!existing.roles.includes(role)) existing.roles.push(role); }
                            else ayantsDroit.push({ nom, roles: [role] });
                          };
                          usersList.filter(u => u.role === 'admin').forEach(u => addPerson(u.id, `${u.prenom} ${u.nom}`, 'Admin'));
                          if (d.uploadedBy) addPerson(d.uploadedBy.id, `${d.uploadedBy.prenom} ${d.uploadedBy.nom}`, 'Uploadeur');
                          (d.permissionsUtilisateurs || []).forEach((p: any) => { if (p.user) addPerson(p.user.id, `${p.user.prenom} ${p.user.nom}`, 'Accès explicite'); });
                          if (ayantsDroit.length === 0) return <span className="italic text-gray-400">Aucun utilisateur défini</span>;
                          return ayantsDroit.map((a, i) => (
                            <div key={i}><span className="font-medium">{a.nom}</span> <span className="text-gray-400">({a.roles.join(', ')})</span></div>
                          ));
                        })()}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">🌐 Accès libre</span>
                      <div className="mt-1 text-xs text-gray-400 italic">Tous les utilisateurs</div>
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <button
                    onClick={() => openCommentsModal(d)}
                    className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                    title="Voir les commentaires"
                  >
                    Voir commentaires{typeof commentCounts[d.id] === 'number' ? ` (${commentCounts[d.id]})` : ''}
                  </button>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {d.uploadedBy ? `${d.uploadedBy.prenom} ${d.uploadedBy.nom}` : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {formatDate(d.createdAt)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {formatDate(d.updatedAt)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    {d.nombreVisualisations || 0}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    {d.nombreTelechargements || 0}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <button
                    onClick={() => handleToggleDocumentFavori(d.id)}
                    disabled={loadingFavoris[d.id]}
                    className={`px-3 py-2 rounded-md transition-colors flex items-center gap-2 ${
                      favorisDocuments.has(d.id)
                        ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 border border-yellow-300'
                        : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-300'
                    } disabled:opacity-50`}
                    title={favorisDocuments.has(d.id) ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                  >
                    <svg className="w-4 h-4" fill={favorisDocuments.has(d.id) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                    <span className="text-xs font-medium hidden sm:inline">
                      {favorisDocuments.has(d.id) ? 'Retirer' : 'Ajouter'}
                    </span>
                  </button>
                </td>
                {isAdmin && (
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(d)}
                        className="px-3 py-1 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
                        title="Modifier le document"
                      >
                        Modifier
                      </button>
                      {canModifierAcces(d) && (
                        <button
                          onClick={() => handleOpenAccesModal(d)}
                          className="px-3 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
                          title="Modifier l'accès"
                        >
                          🔑 Accès
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(d)}
                        className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                        title="Supprimer le document"
                      >
                        Supprimer
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {documents.length === 0 && (
          <div className="text-center py-8 text-gray-500">Aucun document</div>
        )}
        {documents.length > pageSize && (
          <div className="mt-6 flex items-center justify-between border-t border-gray-200 pt-4">
            <div className="text-sm text-gray-700">
              Affichage {startIdx + 1}-{Math.min(startIdx + pageSize, documents.length)} sur {documents.length}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className={`px-4 py-2 rounded text-sm font-medium ${page === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
              >
                Précédent
              </button>
              <div className="flex gap-1">
                {getPageNumbers().map((p, idx) => (
                  typeof p === 'string' ? (
                    <span key={`ellipsis-${idx}`} className="px-2 text-gray-500">{p}</span>
                  ) : (
                    <button
                      key={p as number}
                      onClick={() => setPage(p as number)}
                      className={`px-3 py-2 rounded text-sm font-medium ${page === p ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    >
                      {p}
                    </button>
                  )
                ))}
              </div>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className={`px-4 py-2 rounded text-sm font-medium ${page === totalPages ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de visualisation */}
      {viewingDocument && (documentUrl || getFileType(viewingDocument.fichierType) === 'excel') && (
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
              {getFileType(viewingDocument.fichierType) === 'excel' ? (
                <div className="h-full flex flex-col">
                  {excelSheetNames.length > 1 && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Feuille de calcul:
                      </label>
                      <select
                        value={currentSheet}
                        onChange={(e) => handleSheetChange(e.target.value)}
                        className="border border-gray-300 rounded px-3 py-2"
                      >
                        {excelSheetNames.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {loadingExcel ? (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-gray-500">Chargement du fichier Excel...</p>
                    </div>
                  ) : (
                    <div className="flex-1 overflow-auto border border-gray-300 rounded">
                      <table className="min-w-full divide-y divide-gray-200">
                        <tbody className="bg-white divide-y divide-gray-200">
                          {excelData.map((row: any[], rowIndex: number) => (
                            <tr key={rowIndex}>
                              {row.map((cell: any, cellIndex: number) => (
                                <td
                                  key={cellIndex}
                                  className={`px-4 py-2 whitespace-nowrap text-sm ${
                                    rowIndex === 0 ? 'font-semibold bg-gray-50' : ''
                                  } ${cellIndex === 0 && rowIndex > 0 ? 'bg-gray-50' : ''}`}
                                >
                                  {cell !== null && cell !== undefined ? String(cell) : ''}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : getFileType(viewingDocument.fichierType) === 'pdf' ? (
                <iframe
                  src={documentUrl || undefined}
                  className="w-full h-full border border-gray-300 rounded"
                  title={viewingDocument.nom}
                />
              ) : getFileType(viewingDocument.fichierType) === 'image' ? (
                <div className="flex justify-center items-center h-full overflow-auto">
                  <img
                    src={documentUrl || undefined}
                    alt={viewingDocument.nom}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              ) : getFileType(viewingDocument.fichierType) === 'text' ? (
                <iframe
                  src={documentUrl || undefined}
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

      {/* Modal commentaires */}
      {showCommentsModalFor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4">
            <div className="p-6 max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Commentaires — {showCommentsModalFor.nom}</h2>
                <button
                  onClick={() => { setShowCommentsModalFor(null); setCommentsModalItems([]); }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              {commentsModalItems.length === 0 ? (
                <div className="text-sm text-gray-500">Aucun commentaire</div>
              ) : (
                <div className="space-y-2">
                  {commentsModalItems.map((c) => (
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
            </div>
          </div>
        </div>
      )}

      {/* Modal d'upload */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto py-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 my-auto">
            <div className="p-6 max-h-[85vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Nouveau document</h2>
                <button
                    onClick={() => {
                      setShowUploadModal(false);
                      setError('');
                      setFiles([]);
                      setFileNames({});
                      setUploadData({ nom: '', description: '', estConfidentiel: false, versionMajeure: '1', versionMineure: '0', versionPatch: '0', processusId: '', typeDocument: 'general' });
                      setPermissionUserIds([]);
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
                    Fichier(s) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="file"
                    multiple
                    onChange={handleFileChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                  {files.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {files.map((file) => (
                        <div key={file.name} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                          <div className="flex-1">
                            <input
                              type="text"
                              value={fileNames[file.name] || file.name}
                              onChange={(e) => setFileNames({ ...fileNames, [file.name]: e.target.value })}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                              placeholder="Nom du document"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFile(file.name)}
                            className="ml-2 text-red-600 hover:text-red-800"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Description du document"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type de document</label>
                  <select
                    value={uploadData.typeDocument || 'general'}
                    onChange={(e) => setUploadData({ ...uploadData, typeDocument: e.target.value, processusId: e.target.value !== 'processus' ? '' : uploadData.processusId })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="general">Général</option>
                    <option value="processus">Processus</option>
                    <option value="projet">Projet</option>
                    <option value="contrat">Contrat</option>
                    <option value="client_fournisseur">Client / Fournisseur</option>
                    <option value="template">Template</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>

                {uploadData.typeDocument === 'processus' && <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Processus (optionnel)
                  </label>
                  <select
                    value={uploadData.processusId}
                    onChange={(e) => setUploadData({ ...uploadData, processusId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Aucun processus</option>
                    {processusList.map((processus) => (
                      <option key={processus.id} value={processus.id}>
                        {processus.nom} ({processus.codeProcessus})
                      </option>
                    ))}
                  </select>
                </div>}

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
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={uploadData.estConfidentiel}
                      onChange={(e) => {
                        setUploadData({ ...uploadData, estConfidentiel: e.target.checked });
                        if (!e.target.checked) {
                          setPermissionUserIds([]);
                        }
                      }}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">Document confidentiel</span>
                  </label>
                  {uploadData.estConfidentiel && (
                    <div className="mt-2">
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        size={5}
                      >
                        {usersList.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.prenom} {user.nom} ({user.email})
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-xs text-gray-500">
                        Maintenez Ctrl (ou Cmd sur Mac) pour sélectionner plusieurs utilisateurs
                      </p>
                      {uploadData.estConfidentiel && permissionUserIds.length === 0 && (
                        <p className="mt-1 text-xs text-red-500">
                          Au moins un utilisateur doit être sélectionné pour un document confidentiel
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowUploadModal(false);
                      setError('');
                      setFiles([]);
                      setFileNames({});
                      setUploadData({ nom: '', description: '', estConfidentiel: false, versionMajeure: '1', versionMineure: '0', versionPatch: '0', processusId: '', typeDocument: 'general' });
                      setPermissionUserIds([]);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={uploading || files.length === 0 || (uploadData.estConfidentiel && permissionUserIds.length === 0)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {uploading ? 'Upload en cours...' : 'Uploader'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal de modification */}
      {editingDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto py-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 my-auto">
            <div className="p-6 max-h-[85vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Modifier le document</h2>
                <button
                  onClick={() => {
                    setEditingDocument(null);
                    setEditData({ nom: '', description: '', statut: 'brouillon', estConfidentiel: false, permissionUserIds: [] });
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); handleSaveEdit(); }} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editData.nom}
                    onChange={(e) => setEditData({ ...editData, nom: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={editData.description}
                    onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Statut
                  </label>
                  <select
                    value={editData.statut}
                    onChange={(e) => setEditData({ ...editData, statut: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="brouillon">Brouillon</option>
                    <option value="en_revision">En révision</option>
                    <option value="valide">Validé</option>
                  </select>
                </div>

                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={editData.estConfidentiel}
                      onChange={(e) => {
                        setEditData({ ...editData, estConfidentiel: e.target.checked });
                        if (!e.target.checked) {
                          setEditData({ ...editData, estConfidentiel: false, permissionUserIds: [] });
                        }
                      }}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">Document confidentiel</span>
                  </label>
                  {editData.estConfidentiel && (
                    <div className="mt-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Utilisateurs autorisés <span className="text-red-500">*</span>
                      </label>
                      <select
                        multiple
                        value={editData.permissionUserIds}
                        onChange={(e) => {
                          const selected = Array.from(e.target.selectedOptions, option => option.value);
                          setEditData({ ...editData, permissionUserIds: selected });
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        size={5}
                      >
                        {usersList.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.prenom} {user.nom} ({user.email})
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-xs text-gray-500">
                        Maintenez Ctrl (ou Cmd sur Mac) pour sélectionner plusieurs utilisateurs
                      </p>
                      {editData.estConfidentiel && editData.permissionUserIds.length === 0 && (
                        <p className="mt-1 text-xs text-red-500">
                          Au moins un utilisateur doit être sélectionné pour un document confidentiel
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingDocument(null);
                      setEditData({ nom: '', description: '', statut: 'brouillon', estConfidentiel: false, permissionUserIds: [] });
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={editData.estConfidentiel && editData.permissionUserIds.length === 0}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    Enregistrer
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {/* Modal Modifier Accès */}
      {showAccesModal && acceDoc && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">🔑 Modifier l'accès — {acceDoc.nom}</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <input type="checkbox" id="acceConfidentielDocs" checked={acceEstConfidentiel} onChange={(e) => { setAcceEstConfidentiel(e.target.checked); if (!e.target.checked) setAccePermissionUserIds([]); }} />
                <label htmlFor="acceConfidentielDocs" className="text-sm text-gray-700">Accès restreint (document confidentiel)</label>
              </div>
              {acceEstConfidentiel && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Utilisateurs autorisés :</label>
                  <select multiple value={accePermissionUserIds} onChange={(e) => setAccePermissionUserIds(Array.from(e.target.selectedOptions, o => o.value))} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm h-40">
                    {usersList.map(u => <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>)}
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
    </div>
  );
}
