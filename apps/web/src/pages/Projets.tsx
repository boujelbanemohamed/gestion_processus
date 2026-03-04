import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';

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

export default function Projets() {
  const [projets, setProjets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ nom: '', statut: '', priorite: '', type: '' });
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [formData, setFormData] = useState({
    nom: '',
    codeProjet: '',
    type: 'interne',
    nomClient: '',
    dateDebut: '',
    dateFinPrevue: '',
    statut: 'en_preparation',
    priorite: 'moyenne',
  });

  useEffect(() => { loadProjets(); }, [filters]);
  useEffect(() => { setPage(1); }, [filters]);

  const loadProjets = async () => {
    try {
      const params: any = {};
      if (filters.nom) params.nom = filters.nom;
      if (filters.statut) params.statut = filters.statut;
      if (filters.priorite) params.priorite = filters.priorite;
      if (filters.type) params.type = filters.type;
      const response = await api.get('/projets', { params });
      setProjets(response.data);
    } catch (err) {
      console.error('Erreur chargement projets:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    setError('');
    if (!formData.nom || !formData.codeProjet || !formData.dateDebut) {
      setError('Veuillez remplir les champs obligatoires (Nom, Date de début)');
      return;
    }
    if (formData.type === 'client' && !formData.nomClient) {
      setError('Veuillez indiquer le nom du client');
      return;
    }
    setCreating(true);
    try {
      await api.post('/projets', formData);
      await loadProjets();
      setShowCreateModal(false);
      resetForm();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur lors de la création');
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setFormData({ nom: '', codeProjet: '', type: 'interne', nomClient: '', dateDebut: '', dateFinPrevue: '', statut: 'en_preparation', priorite: 'moyenne' });
    setError('');
  };

  const totalPages = Math.max(1, Math.ceil(projets.length / pageSize));
  const pagedProjets = projets.slice((page - 1) * pageSize, page * pageSize);

  if (loading) return <div className="p-6">Chargement...</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Projets</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Nouveau projet
        </button>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
            <input
              type="text"
              value={filters.nom}
              onChange={(e) => setFilters({ ...filters, nom: e.target.value })}
              placeholder="Nom du projet"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
            <select value={filters.statut} onChange={(e) => setFilters({ ...filters, statut: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md">
              <option value="">Tous</option>
              <option value="en_preparation">En préparation</option>
              <option value="en_cours">En cours</option>
              <option value="termine">Terminé</option>
              <option value="en_pause">En pause</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Priorité</label>
            <select value={filters.priorite} onChange={(e) => setFilters({ ...filters, priorite: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md">
              <option value="">Toutes</option>
              <option value="haute">Haute</option>
              <option value="moyenne">Moyenne</option>
              <option value="basse">Basse</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md">
              <option value="">Tous</option>
              <option value="interne">Interne</option>
              <option value="client">Client</option>
              <option value="communautaire">Communautaire</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <button onClick={() => setFilters({ nom: '', statut: '', priorite: '', type: '' })} className="px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">
            Réinitialiser
          </button>
        </div>
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Liste des projets ({projets.length})</h2>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nom du projet</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date début</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date fin prévue</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priorité</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {pagedProjets.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <Link to={`/projets/${p.id}`} className="text-blue-600 hover:text-blue-800 hover:underline font-medium">
                    {p.nom}
                  </Link>
                  {p.nomClient && <div className="text-xs text-gray-500 mt-0.5">Client : {p.nomClient}</div>}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm capitalize">{p.type}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">{p.dateDebut ? new Date(p.dateDebut).toLocaleDateString('fr-FR') : '—'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">{p.dateFinPrevue ? new Date(p.dateFinPrevue).toLocaleDateString('fr-FR') : '—'}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs rounded ${STATUS_COLORS[p.statut] || 'bg-gray-100 text-gray-700'}`}>
                    {STATUS_LABELS[p.statut] || p.statut}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs rounded capitalize ${PRIORITY_COLORS[p.priorite] || 'bg-gray-100 text-gray-700'}`}>
                    {p.priorite}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {projets.length === 0 && <div className="text-center py-8 text-gray-500">Aucun projet</div>}

        {/* Pagination */}
        {projets.length > pageSize && (
          <div className="mt-4 flex items-center justify-between border-t border-gray-200 p-4">
            <div className="text-sm text-gray-700">
              Affichage {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, projets.length)} sur {projets.length}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className={`px-4 py-2 rounded text-sm font-medium ${page === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>Précédent</button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className={`px-4 py-2 rounded text-sm font-medium ${page === totalPages ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>Suivant</button>
            </div>
          </div>
        )}
      </div>

      {/* Modal création */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[85vh] overflow-y-auto relative">
            <button onClick={() => { setShowCreateModal(false); resetForm(); }} className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 text-xl">×</button>
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">Nouveau projet</h2>
              {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nom du projet <span className="text-red-500">*</span></label>
                  <input type="text" value={formData.nom} onChange={(e) => setFormData({ ...formData, nom: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Code projet <span className="text-red-500">*</span></label>
                  <input type="text" value={formData.codeProjet} onChange={(e) => setFormData({ ...formData, codeProjet: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="Ex: PROJ-2025-001" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type <span className="text-red-500">*</span></label>
                  <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md">
                    <option value="interne">Interne</option>
                    <option value="client">Client</option>
                    <option value="communautaire">Communautaire</option>
                  </select>
                </div>
                {formData.type === 'client' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nom du client <span className="text-red-500">*</span></label>
                    <input type="text" value={formData.nomClient} onChange={(e) => setFormData({ ...formData, nomClient: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="Nom de l'entreprise cliente" />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date de début <span className="text-red-500">*</span></label>
                    <input type="date" value={formData.dateDebut} onChange={(e) => setFormData({ ...formData, dateDebut: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date de fin prévue</label>
                    <input type="date" value={formData.dateFinPrevue} onChange={(e) => setFormData({ ...formData, dateFinPrevue: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
                    <select value={formData.statut} onChange={(e) => setFormData({ ...formData, statut: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md">
                      <option value="en_preparation">En préparation</option>
                      <option value="en_cours">En cours</option>
                      <option value="termine">Terminé</option>
                      <option value="en_pause">En pause</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Priorité</label>
                    <select value={formData.priorite} onChange={(e) => setFormData({ ...formData, priorite: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md">
                      <option value="haute">Haute</option>
                      <option value="moyenne">Moyenne</option>
                      <option value="basse">Basse</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
                <button onClick={() => { setShowCreateModal(false); resetForm(); }} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">Annuler</button>
                <button onClick={handleCreate} disabled={creating} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">{creating ? 'Création...' : 'Créer'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
