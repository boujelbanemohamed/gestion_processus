import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../store/auth';

export default function Processus() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user: currentUser } = useAuth();
  const isLecteur = currentUser?.role === 'lecteur';
  const [processus, setProcessus] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [entites, setEntites] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [filters, setFilters] = useState({
    search: '',
    statut: '',
    entiteId: '',
    categorieId: '',
  });
  const [formData, setFormData] = useState({
    nom: '',
    codeProcessus: '',
    description: '',
    entiteId: '',
    categorieId: '',
    proprietaireId: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    // Pré-remplir le filtre statut depuis la query (ex: ?statut=brouillon)
    const params = new URLSearchParams(location.search);
    const qStatut = params.get('statut');
    if (qStatut) {
      setFilters((prev) => ({ ...prev, statut: qStatut }));
    }
    loadProcessus();
    loadEntites();
    loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // recharger les processus à chaque changement de filtre
    loadProcessus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.search, filters.statut, filters.entiteId, filters.categorieId]);
  useEffect(() => {
    setPage(1);
  }, [filters.search, filters.statut, filters.entiteId, filters.categorieId]);

  const loadProcessus = async () => {
    try {
      const params: any = {};
      if (filters.search) params.search = filters.search;
      if (filters.statut) params.statut = filters.statut;
      if (filters.entiteId) params.entiteId = filters.entiteId;
      if (filters.categorieId) params.categorieId = filters.categorieId;
      const response = await api.get('/processus', { params });
      setProcessus(response.data);
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEntites = async () => {
    try {
      const response = await api.get('/entites');
      setEntites(response.data);
    } catch (error) {
      console.error('Erreur chargement entités:', error);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await api.get('/categories');
      setCategories(response.data);
    } catch (error) {
      console.error('Erreur chargement catégories:', error);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      if (!formData.nom || !formData.codeProcessus) {
        setError('Le nom et le code sont obligatoires');
        return;
      }

      await api.post('/processus', {
        nom: formData.nom,
        codeProcessus: formData.codeProcessus,
        description: formData.description || undefined,
        entiteIds: formData.entiteId ? [formData.entiteId] : [],
        categorieIds: formData.categorieId ? [formData.categorieId] : [],
        proprietaireId: formData.proprietaireId || undefined,
      });

      setShowModal(false);
      setFormData({
        nom: '',
        codeProcessus: '',
        description: '',
        entiteId: '',
        categorieId: '',
        proprietaireId: '',
      });
      loadProcessus();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur lors de la création');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-6">Chargement...</div>;

  const totalPages = Math.max(1, Math.ceil(processus.length / pageSize));
  const startIdx = (page - 1) * pageSize;
  const pagedProcessus = processus.slice(startIdx, startIdx + pageSize);
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
        <h1 className="text-2xl font-bold">Processus</h1>
        {!isLecteur && (
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Nouveau processus
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
              placeholder="Nom, code, description"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
            <select
              value={filters.statut}
              onChange={(e) => setFilters({ ...filters, statut: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">Tous</option>
              {statuts.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Entité</label>
            <select
              value={filters.entiteId}
              onChange={(e) => setFilters({ ...filters, entiteId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">Toutes</option>
              {entites.map((entite) => (
                <option key={entite.id} value={entite.id}>
                  {entite.nom}{entite.code ? ` (${entite.code})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
            <select
              value={filters.categorieId}
              onChange={(e) => setFilters({ ...filters, categorieId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">Toutes</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.nom}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <button
            type="button"
            onClick={() => setFilters({ search: '', statut: '', entiteId: '', categorieId: '' })}
            className="px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Réinitialiser
          </button>
        </div>
      </div>

      {/* Modal de création */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto py-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 my-auto">
            <div className="p-6 max-h-[85vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Nouveau processus</h2>
                <button
                  onClick={() => {
                    setShowModal(false);
                    setError('');
                    setFormData({
                      nom: '',
                      codeProcessus: '',
                      description: '',
                      entiteId: '',
                      categorieId: '',
                      proprietaireId: '',
                    });
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

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom * <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.nom}
                    onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Nom du processus"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Code processus <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.codeProcessus}
                    onChange={(e) => setFormData({ ...formData, codeProcessus: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="PROC-001"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Description du processus"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Entité
                  </label>
                  <select
                    value={formData.entiteId}
                    onChange={(e) => setFormData({ ...formData, entiteId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Sélectionner une entité</option>
                    {entites.map((entite) => (
                      <option key={entite.id} value={entite.id}>
                        {entite.nom} ({entite.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Catégorie
                  </label>
                  <select
                    value={formData.categorieId}
                    onChange={(e) => setFormData({ ...formData, categorieId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Sélectionner une catégorie</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.nom}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setError('');
                      setFormData({
                        nom: '',
                        codeProcessus: '',
                        description: '',
                        entiteId: '',
                        categorieId: '',
                        proprietaireId: '',
                      });
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {submitting ? 'Création...' : 'Créer'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nom</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Catégorie</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entité</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {pagedProcessus.map((p) => {
              const currentStatut = statuts.find(s => s.value === p.statut);
              return (
                <tr key={p.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{p.codeProcessus}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => navigate(`/processus/${p.id}`)}
                      className="text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {p.nom}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded ${
                      currentStatut?.color || 'bg-gray-100 text-gray-800'
                    }`}>
                      {currentStatut?.label || p.statut}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {p.categories && p.categories.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {p.categories.slice(0, 2).map((pc: any) => (
                          <span
                            key={pc.categorie?.id || pc.categorieId}
                            className="px-2 py-1 text-xs rounded flex items-center gap-1"
                            style={{ 
                              backgroundColor: pc.categorie?.couleur ? `${pc.categorie.couleur}20` : '#E5E7EB',
                              color: pc.categorie?.couleur || '#374151',
                            }}
                          >
                            {pc.categorie?.icone && <span>{pc.categorie.icone}</span>}
                            <span>{pc.categorie?.nom || '-'}</span>
                          </span>
                        ))}
                        {p.categories.length > 2 && (
                          <span className="text-xs text-gray-500">+{p.categories.length - 2}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400 italic">N/A</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {p.entites && p.entites.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {p.entites.slice(0, 2).map((pe: any) => (
                          <span key={pe.entite?.id || pe.entiteId} className="text-xs">
                            {pe.entite?.nom || '-'}
                          </span>
                        ))}
                        {p.entites.length > 2 && (
                          <span className="text-xs text-gray-500">+{p.entites.length - 2}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400 italic">N/A</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {processus.length === 0 && (
          <div className="text-center py-8 text-gray-500">Aucun processus</div>
        )}
        {processus.length > pageSize && (
          <div className="mt-6 flex items-center justify-between border-t border-gray-200 pt-4">
            <div className="text-sm text-gray-700">
              Affichage {startIdx + 1}-{Math.min(startIdx + pageSize, processus.length)} sur {processus.length}
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
    </div>
  );
}
