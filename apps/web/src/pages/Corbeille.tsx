import { useEffect, useState } from 'react';
import { api } from '../services/api';

export default function Corbeille() {
  const [processus, setProcessus] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'processus' | 'documents'>('processus');

  useEffect(() => {
    loadCorbeille();
  }, []);

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
    if (!window.confirm('Restaurer ce processus ?')) return;
    try {
      await api.post(`/corbeille/processus/${id}/restaurer`);
      await loadCorbeille();
    } catch (error) {
      console.error('Erreur restauration:', error);
    }
  };

  const handleRestaurerDocument = async (id: string) => {
    if (!window.confirm('Restaurer ce document ?')) return;
    try {
      await api.post(`/corbeille/documents/${id}/restaurer`);
      await loadCorbeille();
    } catch (error) {
      console.error('Erreur restauration:', error);
    }
  };

  const handleSupprimerProcessus = async (id: string) => {
    if (!window.confirm('Supprimer définitivement ce processus ? Cette action est irréversible.')) return;
    try {
      await api.delete(`/corbeille/processus/${id}`);
      await loadCorbeille();
    } catch (error) {
      console.error('Erreur suppression:', error);
    }
  };

  const handleSupprimerDocument = async (id: string) => {
    if (!window.confirm('Supprimer définitivement ce document ? Cette action est irréversible.')) return;
    try {
      await api.delete(`/corbeille/documents/${id}`);
      await loadCorbeille();
    } catch (error) {
      console.error('Erreur suppression:', error);
    }
  };

  if (loading) return <div className="p-6">Chargement...</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Corbeille</h1>

      {/* Onglets */}
      <div className="flex gap-4 mb-6 border-b">
        <button
          onClick={() => setActiveTab('processus')}
          className={`pb-2 px-1 text-sm font-medium border-b-2 ${
            activeTab === 'processus'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Processus ({processus.length})
        </button>
        <button
          onClick={() => setActiveTab('documents')}
          className={`pb-2 px-1 text-sm font-medium border-b-2 ${
            activeTab === 'documents'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Documents ({documents.length})
        </button>
      </div>

      {/* Processus supprimés */}
      {activeTab === 'processus' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nom</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supprimé le</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {processus.map((p) => (
                <tr key={p.id}>
                  <td className="px-6 py-4 text-sm text-gray-900">{p.nom}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{p.codeProcessus}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {p.deletedAt ? new Date(p.deletedAt).toLocaleDateString('fr-FR') : '—'}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRestaurerProcessus(p.id)}
                        className="px-3 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200"
                      >
                        Restaurer
                      </button>
                      <button
                        onClick={() => handleSupprimerProcessus(p.id)}
                        className="px-3 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200"
                      >
                        Supprimer définitivement
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {processus.length === 0 && (
            <div className="text-center py-8 text-gray-500">La corbeille est vide</div>
          )}
        </div>
      )}

      {/* Documents supprimés */}
      {activeTab === 'documents' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nom</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supprimé le</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {documents.map((d) => (
                <tr key={d.id}>
                  <td className="px-6 py-4 text-sm text-gray-900">{d.nom}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{d.typeDocument}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {d.deletedAt ? new Date(d.deletedAt).toLocaleDateString('fr-FR') : '—'}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRestaurerDocument(d.id)}
                        className="px-3 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200"
                      >
                        Restaurer
                      </button>
                      <button
                        onClick={() => handleSupprimerDocument(d.id)}
                        className="px-3 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200"
                      >
                        Supprimer définitivement
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {documents.length === 0 && (
            <div className="text-center py-8 text-gray-500">La corbeille est vide</div>
          )}
        </div>
      )}
    </div>
  );
}
