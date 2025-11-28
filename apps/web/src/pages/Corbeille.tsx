import { useEffect, useState } from 'react';
import { useAuth } from '../store/auth';
import { api } from '../services/api';
import { useNavigate } from 'react-router-dom';

interface ProcessusSupprime {
  id: string;
  nom: string;
  codeProcessus: string;
  statut: string;
  deletedAt: string;
  proprietaire?: { nom: string; prenom: string };
  createdBy?: { nom: string; prenom: string };
  entites: Array<{ entite: { nom: string; code: string } }>;
  categories: Array<{ categorie: { nom: string; couleur?: string } }>;
}

interface DocumentSupprime {
  id: string;
  nom: string;
  typeDocument: string;
  version?: string;
  deletedAt: string;
  uploadedBy?: { nom: string; prenom: string };
  processus?: { nom: string; codeProcessus: string } | null;
}

export default function Corbeille() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [processus, setProcessus] = useState<ProcessusSupprime[]>([]);
  const [documents, setDocuments] = useState<DocumentSupprime[]>([]);
  const [activeTab, setActiveTab] = useState<'processus' | 'documents'>('processus');
  const [restoring, setRestoring] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    // Vérifier que l'utilisateur est admin
    if (user?.role !== 'admin') {
      navigate('/dashboard');
      return;
    }
    loadCorbeille();
  }, [user, navigate]);

  const loadCorbeille = async () => {
    try {
      const response = await api.get('/corbeille');
      setProcessus(response.data.processus || []);
      setDocuments(response.data.documents || []);
    } catch (error) {
      console.error('Erreur chargement corbeille:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRestaurerProcessus = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir restaurer ce processus ?')) {
      return;
    }
    setRestoring(id);
    try {
      await api.post(`/corbeille/processus/${id}/restaurer`);
      await loadCorbeille();
      alert('Processus restauré avec succès');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erreur lors de la restauration');
    } finally {
      setRestoring(null);
    }
  };

  const handleRestaurerDocument = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir restaurer ce document ?')) {
      return;
    }
    setRestoring(id);
    try {
      await api.post(`/corbeille/documents/${id}/restaurer`);
      await loadCorbeille();
      alert('Document restauré avec succès');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erreur lors de la restauration');
    } finally {
      setRestoring(null);
    }
  };

  const handleSupprimerDefinitivementProcessus = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer définitivement ce processus ? Cette action est irréversible.')) {
      return;
    }
    setDeleting(id);
    try {
      await api.delete(`/corbeille/processus/${id}`);
      await loadCorbeille();
      alert('Processus supprimé définitivement');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erreur lors de la suppression');
    } finally {
      setDeleting(null);
    }
  };

  const handleSupprimerDefinitivementDocument = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer définitivement ce document ? Cette action est irréversible.')) {
      return;
    }
    setDeleting(id);
    try {
      await api.delete(`/corbeille/documents/${id}`);
      await loadCorbeille();
      alert('Document supprimé définitivement');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erreur lors de la suppression');
    } finally {
      setDeleting(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return <div className="p-6">Chargement...</div>;
  }

  if (user?.role !== 'admin') {
    return null;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Corbeille</h1>

      {/* Onglets */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('processus')}
            className={`${
              activeTab === 'processus'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Processus ({processus.length})
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`${
              activeTab === 'documents'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Documents ({documents.length})
          </button>
        </nav>
      </div>

      {/* Contenu des onglets */}
      {activeTab === 'processus' && (
        <div>
          {processus.length === 0 ? (
            <div className="bg-white p-8 rounded-lg shadow text-center text-gray-500">
              Aucun processus supprimé
            </div>
          ) : (
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <ul className="divide-y divide-gray-200">
                {processus.map((p) => (
                  <li key={p.id} className="p-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-medium text-gray-900">{p.nom}</h3>
                          <span className="text-sm text-gray-500">({p.codeProcessus})</span>
                        </div>
                        <div className="mt-2 text-sm text-gray-500">
                          <p>Statut: <span className="font-medium capitalize">{p.statut}</span></p>
                          {p.proprietaire && (
                            <p>Propriétaire: {p.proprietaire.prenom} {p.proprietaire.nom}</p>
                          )}
                          {p.createdBy && (
                            <p>Créé par: {p.createdBy.prenom} {p.createdBy.nom}</p>
                          )}
                          {p.entites.length > 0 && (
                            <p>Entités: {p.entites.map((e) => e.entite.nom).join(', ')}</p>
                          )}
                          {p.categories.length > 0 && (
                            <p>Catégories: {p.categories.map((c) => c.categorie.nom).join(', ')}</p>
                          )}
                          <p className="text-red-600 font-medium">
                            Supprimé le: {formatDate(p.deletedAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => handleRestaurerProcessus(p.id)}
                          disabled={restoring === p.id || deleting === p.id}
                          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                        >
                          {restoring === p.id ? 'Restauration...' : 'Restaurer'}
                        </button>
                        <button
                          onClick={() => handleSupprimerDefinitivementProcessus(p.id)}
                          disabled={restoring === p.id || deleting === p.id}
                          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                        >
                          {deleting === p.id ? 'Suppression...' : 'Supprimer définitivement'}
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {activeTab === 'documents' && (
        <div>
          {documents.length === 0 ? (
            <div className="bg-white p-8 rounded-lg shadow text-center text-gray-500">
              Aucun document supprimé
            </div>
          ) : (
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <ul className="divide-y divide-gray-200">
                {documents.map((d) => (
                  <li key={d.id} className="p-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-medium text-gray-900">{d.nom}</h3>
                          {d.version && (
                            <span className="text-sm text-gray-500">Version {d.version}</span>
                          )}
                        </div>
                        <div className="mt-2 text-sm text-gray-500">
                          <p>Type: <span className="font-medium capitalize">{d.typeDocument}</span></p>
                          {d.processus && (
                            <p>Processus: {d.processus.nom} ({d.processus.codeProcessus})</p>
                          )}
                          {d.uploadedBy && (
                            <p>Uploadé par: {d.uploadedBy.prenom} {d.uploadedBy.nom}</p>
                          )}
                          <p className="text-red-600 font-medium">
                            Supprimé le: {formatDate(d.deletedAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => handleRestaurerDocument(d.id)}
                          disabled={restoring === d.id || deleting === d.id}
                          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                        >
                          {restoring === d.id ? 'Restauration...' : 'Restaurer'}
                        </button>
                        <button
                          onClick={() => handleSupprimerDefinitivementDocument(d.id)}
                          disabled={restoring === d.id || deleting === d.id}
                          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                        >
                          {deleting === d.id ? 'Suppression...' : 'Supprimer définitivement'}
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

