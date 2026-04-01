import { useEffect, useState } from 'react';
import { api } from '../services/api';

export default function Corbeille() {
  const [processus, setProcessus] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [licences, setLicences] = useState<any[]>([]);
  const [clientsFournisseurs, setClientsFournisseurs] = useState<any[]>([]);
  const [contrats, setContrats] = useState<any[]>([]);
  const [entites, setEntites] = useState<any[]>([]);
  const [projets, setProjets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    'processus' | 'documents' | 'licences' | 'clientsFournisseurs' | 'contrats' | 'entites' | 'projets'
  >('processus');

  useEffect(() => {
    loadCorbeille();
  }, []);

  const loadCorbeille = async () => {
    try {
      const response = await api.get('/corbeille');
      setProcessus(response.data.processus || []);
      setDocuments(response.data.documents || []);
      setLicences(response.data.licences || []);
      setClientsFournisseurs(response.data.clientsFournisseurs || []);
      setContrats(response.data.contrats || []);
      setEntites(response.data.entites || []);
      setProjets(response.data.projets || []);
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

  const handleRestaurerLicence = async (id: string) => {
    if (!window.confirm('Restaurer cette licence ?')) return;
    try {
      await api.post(`/corbeille/licences/${id}/restaurer`);
      await loadCorbeille();
    } catch (error) {
      console.error('Erreur restauration:', error);
    }
  };

  const handleSupprimerLicence = async (id: string) => {
    if (!window.confirm('Supprimer définitivement cette licence et ses pièces jointes ? Irréversible.')) return;
    try {
      await api.delete(`/corbeille/licences/${id}`);
      await loadCorbeille();
    } catch (error) {
      console.error('Erreur suppression:', error);
    }
  };

  const handleRestaurerClientFournisseur = async (id: string) => {
    if (!window.confirm('Restaurer cette fiche client / fournisseur ?')) return;
    try {
      await api.post(`/corbeille/clients-fournisseurs/${id}/restaurer`);
      await loadCorbeille();
    } catch (error) {
      console.error('Erreur restauration:', error);
    }
  };

  const handleSupprimerClientFournisseur = async (id: string) => {
    if (!window.confirm('Supprimer définitivement cette fiche ? Irréversible.')) return;
    try {
      await api.delete(`/corbeille/clients-fournisseurs/${id}`);
      await loadCorbeille();
    } catch (error) {
      console.error('Erreur suppression:', error);
    }
  };

  const handleRestaurerContrat = async (id: string) => {
    if (!window.confirm('Restaurer ce contrat ?')) return;
    try {
      await api.post(`/corbeille/contrats/${id}/restaurer`);
      await loadCorbeille();
    } catch (error) {
      console.error('Erreur restauration:', error);
    }
  };

  const handleSupprimerContrat = async (id: string) => {
    if (!window.confirm('Supprimer définitivement ce contrat ? Irréversible.')) return;
    try {
      await api.delete(`/corbeille/contrats/${id}`);
      await loadCorbeille();
    } catch (error) {
      console.error('Erreur suppression:', error);
    }
  };

  const handleRestaurerEntite = async (id: string) => {
    if (!window.confirm('Restaurer cette entité ?')) return;
    try {
      await api.post(`/corbeille/entites/${id}/restaurer`);
      await loadCorbeille();
    } catch (error) {
      console.error('Erreur restauration:', error);
    }
  };

  const handleSupprimerEntite = async (id: string) => {
    if (!window.confirm('Supprimer définitivement cette entité ? Irréversible.')) return;
    try {
      await api.delete(`/corbeille/entites/${id}`);
      await loadCorbeille();
    } catch (error) {
      console.error('Erreur suppression:', error);
    }
  };

  const handleRestaurerProjet = async (id: string) => {
    if (!window.confirm('Restaurer ce projet ?')) return;
    try {
      await api.post(`/corbeille/projets/${id}/restaurer`);
      await loadCorbeille();
    } catch (error) {
      console.error('Erreur restauration:', error);
    }
  };

  const handleSupprimerProjet = async (id: string) => {
    if (!window.confirm('Supprimer définitivement ce projet ? Irréversible.')) return;
    try {
      await api.delete(`/corbeille/projets/${id}`);
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
        <button
          onClick={() => setActiveTab('licences')}
          className={`pb-2 px-1 text-sm font-medium border-b-2 ${
            activeTab === 'licences'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Licences ({licences.length})
        </button>
        <button
          onClick={() => setActiveTab('clientsFournisseurs')}
          className={`pb-2 px-1 text-sm font-medium border-b-2 ${
            activeTab === 'clientsFournisseurs'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Clients / Fournisseurs ({clientsFournisseurs.length})
        </button>
        <button
          onClick={() => setActiveTab('contrats')}
          className={`pb-2 px-1 text-sm font-medium border-b-2 ${
            activeTab === 'contrats'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Contrats ({contrats.length})
        </button>
        <button
          onClick={() => setActiveTab('entites')}
          className={`pb-2 px-1 text-sm font-medium border-b-2 ${
            activeTab === 'entites'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Entités ({entites.length})
        </button>
        <button
          onClick={() => setActiveTab('projets')}
          className={`pb-2 px-1 text-sm font-medium border-b-2 ${
            activeTab === 'projets'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Projets ({projets.length})
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

      {activeTab === 'licences' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nom</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Référence</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supprimée le</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {licences.map((lic) => (
                <tr key={lic.id}>
                  <td className="px-6 py-4 text-sm text-gray-900">{lic.nom}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{lic.reference}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {lic.deletedAt ? new Date(lic.deletedAt).toLocaleDateString('fr-FR') : '—'}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleRestaurerLicence(lic.id)}
                        className="px-3 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200"
                      >
                        Restaurer
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSupprimerLicence(lic.id)}
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
          {licences.length === 0 && (
            <div className="text-center py-8 text-gray-500">Aucune licence en corbeille</div>
          )}
        </div>
      )}

      {activeTab === 'clientsFournisseurs' && (
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
              {clientsFournisseurs.map((cf) => (
                <tr key={cf.id}>
                  <td className="px-6 py-4 text-sm text-gray-900">{cf.nom}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {cf.type === 'client' ? 'Client' : 'Fournisseur'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {cf.deletedAt ? new Date(cf.deletedAt).toLocaleDateString('fr-FR') : '—'}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleRestaurerClientFournisseur(cf.id)}
                        className="px-3 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200"
                      >
                        Restaurer
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSupprimerClientFournisseur(cf.id)}
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
          {clientsFournisseurs.length === 0 && (
            <div className="text-center py-8 text-gray-500">Aucune fiche client / fournisseur en corbeille</div>
          )}
        </div>
      )}

      {activeTab === 'contrats' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nom</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supprimé le</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {contrats.map((c) => (
                <tr key={c.id}>
                  <td className="px-6 py-4 text-sm text-gray-900">{c.nom}</td>
                  <td className="px-6 py-4 text-sm text-gray-500 capitalize">{c.statut || '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {c.deletedAt ? new Date(c.deletedAt).toLocaleDateString('fr-FR') : '—'}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleRestaurerContrat(c.id)}
                        className="px-3 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200"
                      >
                        Restaurer
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSupprimerContrat(c.id)}
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
          {contrats.length === 0 && (
            <div className="text-center py-8 text-gray-500">Aucun contrat en corbeille</div>
          )}
        </div>
      )}

      {activeTab === 'entites' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nom</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entité parente</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supprimé le</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {entites.map((e) => (
                <tr key={e.id}>
                  <td className="px-6 py-4 text-sm text-gray-900">{e.nom}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{e.code || '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{e.parent?.nom || '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {e.deletedAt ? new Date(e.deletedAt).toLocaleDateString('fr-FR') : '—'}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleRestaurerEntite(e.id)}
                        className="px-3 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200"
                      >
                        Restaurer
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSupprimerEntite(e.id)}
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
          {entites.length === 0 && (
            <div className="text-center py-8 text-gray-500">Aucune entité en corbeille</div>
          )}
        </div>
      )}

      {activeTab === 'projets' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nom</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supprimé le</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {projets.map((pr) => (
                <tr key={pr.id}>
                  <td className="px-6 py-4 text-sm text-gray-900">{pr.nom}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{pr.codeProjet || '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500 capitalize">{pr.statut || '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {pr.deletedAt ? new Date(pr.deletedAt).toLocaleDateString('fr-FR') : '—'}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleRestaurerProjet(pr.id)}
                        className="px-3 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200"
                      >
                        Restaurer
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSupprimerProjet(pr.id)}
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
          {projets.length === 0 && (
            <div className="text-center py-8 text-gray-500">Aucun projet en corbeille</div>
          )}
        </div>
      )}
    </div>
  );
}
