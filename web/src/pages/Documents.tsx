import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../store/auth';

export default function Documents() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const isLecteur = currentUser?.role === 'lecteur';
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [showCommentsModalFor, setShowCommentsModalFor] = useState<any | null>(null);
  const [commentsModalItems, setCommentsModalItems] = useState<any[]>([]);
  const [viewingDocument, setViewingDocument] = useState<any | null>(null);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
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
  });
  const [processusList, setProcessusList] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    search: '',
    typeDocument: '',
    statut: '',
    processusId: '',
  });
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    loadDocuments();
    loadProcessus();
  }, []);

  useEffect(() => {
    loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.search, filters.typeDocument, filters.statut, filters.processusId]);
  useEffect(() => {
    setPage(1);
  }, [filters.search, filters.typeDocument, filters.statut, filters.processusId]);

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
      const response = await api.get('/documents', { params });
      setDocuments(response.data);

      // Charger les compteurs de commentaires pour chaque document (affichage conditionnel du bouton)
      const counts: Record<string, number> = {};
      await Promise.all(
        (response.data || []).map(async (d: any) => {
          try {
            const token = localStorage.getItem('token');
            const res = await api.get(`/documents/${d.id}/comments`, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
            counts[d.id] = Array.isArray(res.data) ? res.data.length : 0;
          } catch {
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
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = window.document.createElement('a');
      link.href = url;
      link.setAttribute('download', doc.fichierNomOriginal);
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Erreur lors du téléchargement:', error);
      alert('Erreur lors du téléchargement du document');
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

    setError('');
    setUploading(true);

    try {
      // Uploader tous les fichiers
      const uploadPromises = files.map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('nom', fileNames[file.name] || file.name);
        formData.append('typeDocument', uploadData.processusId ? 'processus' : 'general');
        if (uploadData.processusId) {
          formData.append('referenceType', 'processus');
          formData.append('referenceId', uploadData.processusId);
        }
        formData.append('description', uploadData.description || '');
        formData.append('estConfidentiel', uploadData.estConfidentiel.toString());
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
      setUploadData({ nom: '', description: '', estConfidentiel: false, versionMajeure: '1', versionMineure: '0', versionPatch: '0', processusId: '' });
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
              setUploadData({ nom: '', description: '', estConfidentiel: false, versionMajeure: '1', versionMineure: '0', versionPatch: '0', processusId: '' });
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
        <table className="min-w-full divide-y divide-gray-200 min-w-[1100px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nom</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Processus</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Version</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Commentaires</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Uploadé par</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date d'upload</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date de modification</th>
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
                <td className="px-6 py-4 whitespace-nowrap text-sm">{d.typeDocument}</td>
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
                    <span className="text-gray-500 italic">N/A</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">{d.version || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs rounded ${
                    d.statut === 'valide' ? 'bg-green-100 text-green-800' :
                    d.statut === 'en_revision' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {d.statut}
                  </span>
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
                      onChange={(e) => setUploadData({ ...uploadData, estConfidentiel: e.target.checked })}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">Document confidentiel</span>
                  </label>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowUploadModal(false);
                      setError('');
                      setFiles([]);
                      setFileNames({});
                      setUploadData({ nom: '', description: '', estConfidentiel: false, versionMajeure: '1', versionMineure: '0', versionPatch: '0', processusId: '' });
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={uploading || files.length === 0}
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
    </div>
  );
}
