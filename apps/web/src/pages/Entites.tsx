import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../store/auth';

export default function Entites() {
  const { user: currentUser } = useAuth();
  const isLecteur = currentUser?.role === 'lecteur';
  const [entites, setEntites] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nom: '',
    code: '',
    type: 'service',
    parentId: '',
    responsableId: '',
    description: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    search: '',
    type: '',
    parentId: '',
    responsableId: '',
  });
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    loadEntites();
    loadUsers();
  }, []);

  useEffect(() => {
    loadEntites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.search, filters.type, filters.parentId, filters.responsableId]);
  useEffect(() => {
    setPage(1);
  }, [filters.search, filters.type, filters.parentId, filters.responsableId]);

  const loadEntites = async () => {
    try {
      const params: any = {};
      if (filters.search) params.search = filters.search;
      if (filters.type) params.type = filters.type;
      if (filters.parentId) params.parentId = filters.parentId;
      if (filters.responsableId) params.responsableId = filters.responsableId;
      const response = await api.get('/entites', { params });
      setEntites(response.data);
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await api.get('/users');
      setUsers(response.data);
    } catch (error) {
      console.error('Erreur chargement utilisateurs:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      if (!formData.nom || !formData.code) {
        setError('Le nom et le code sont obligatoires');
        return;
      }

      if (isEditing && editingId) {
        // Mode édition
        await api.put(`/entites/${editingId}`, {
          nom: formData.nom,
          code: formData.code.toUpperCase(),
          type: formData.type,
          parentId: formData.parentId || undefined,
          responsableId: formData.responsableId || undefined,
          description: formData.description || undefined,
        });
      } else {
        // Mode création
      await api.post('/entites', {
        nom: formData.nom,
        code: formData.code.toUpperCase(),
        type: formData.type,
        parentId: formData.parentId || undefined,
        responsableId: formData.responsableId || undefined,
        description: formData.description || undefined,
        membreIds: [],
      });
      }

      setShowModal(false);
      setIsEditing(false);
      setEditingId(null);
      setFormData({
        nom: '',
        code: '',
        type: 'service',
        parentId: '',
        responsableId: '',
        description: '',
      });
      loadEntites();
    } catch (err: any) {
      setError(err.response?.data?.error || `Erreur lors de ${isEditing ? 'la modification' : 'la création'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (entiteId: string) => {
    try {
      const response = await api.get(`/entites/${entiteId}`);
      const entite = response.data;
      
      setFormData({
        nom: entite.nom || '',
        code: entite.code || '',
        type: entite.type || 'service',
        parentId: entite.parentId || '',
        responsableId: entite.responsableId || '',
        description: entite.description || '',
      });
      
      setIsEditing(true);
      setEditingId(entiteId);
      setShowModal(true);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur lors du chargement de l\'entité');
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setIsEditing(false);
    setEditingId(null);
    setError('');
    setFormData({
      nom: '',
      code: '',
      type: 'service',
      parentId: '',
      responsableId: '',
      description: '',
    });
  };

  if (loading) return <div className="p-6">Chargement...</div>;
  const totalPages = Math.max(1, Math.ceil(entites.length / pageSize));
  const startIdx = (page - 1) * pageSize;
  const pagedEntites = entites.slice(startIdx, startIdx + pageSize);
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

  const entiteTypes = [
    { value: 'direction', label: 'Direction' },
    { value: 'departement', label: 'Département' },
    { value: 'service', label: 'Service' },
    { value: 'cellule', label: 'Cellule' },
    { value: 'division', label: 'Division' },
    { value: 'equipe', label: 'Équipe' },
  ];

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Entités</h1>
        {!isLecteur && (
          <button
            onClick={() => {
              setIsEditing(false);
              setEditingId(null);
              setFormData({
                nom: '',
                code: '',
                type: 'service',
                parentId: '',
                responsableId: '',
                description: '',
              });
              setShowModal(true);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Nouvelle entité
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={filters.type}
              onChange={(e) => setFilters({ ...filters, type: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">Tous</option>
              {entiteTypes.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Entité parente</label>
            <select
              value={filters.parentId}
              onChange={(e) => setFilters({ ...filters, parentId: e.target.value })}
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Responsable</label>
            <select
              value={filters.responsableId}
              onChange={(e) => setFilters({ ...filters, responsableId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">Tous</option>
              {users
                .filter((u) => u.role === 'admin' || u.role === 'contributeur')
                .map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.prenom} {user.nom}
                  </option>
                ))}
            </select>
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <button
            type="button"
            onClick={() => setFilters({ search: '', type: '', parentId: '', responsableId: '' })}
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
                <h2 className="text-xl font-bold">{isEditing ? 'Modifier l\'entité' : 'Nouvelle entité'}</h2>
                <button
                  onClick={handleCloseModal}
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
                    Nom <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.nom}
                    onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Nom de l'entité"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="ENT-001"
                    disabled={isEditing}
                  />
                  {isEditing && (
                    <p className="text-xs text-gray-500 mt-1">Le code ne peut pas être modifié</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    {entiteTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Entité parente
                  </label>
                  <select
                    value={formData.parentId}
                    onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Aucune (entité racine)</option>
                    {entites
                      .filter((entite) => !isEditing || entite.id !== editingId)
                      .map((entite) => (
                        <option key={entite.id} value={entite.id}>
                          {entite.nom} ({entite.code}) - {entite.type}
                        </option>
                      ))}
                  </select>
                  {isEditing && (
                    <p className="text-xs text-gray-500 mt-1">Une entité ne peut pas être sa propre parente</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Responsable
                  </label>
                  <select
                    value={formData.responsableId}
                    onChange={(e) => setFormData({ ...formData, responsableId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Sélectionner un responsable</option>
                    {users
                      .filter((u) => u.role === 'admin' || u.role === 'contributeur')
                      .map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.prenom} {user.nom} ({user.email})
                        </option>
                      ))}
                  </select>
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
                    placeholder="Description de l'entité"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {submitting ? (isEditing ? 'Modification...' : 'Création...') : (isEditing ? 'Modifier' : 'Créer')}
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
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Responsable</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entité parente</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {pagedEntites.map((e) => (
              <tr key={e.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{e.code}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <Link
                    to={`/entites/${e.id}`}
                    className="text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    {e.nom}
                  </Link>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm capitalize">{e.type}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {e.responsable ? `${e.responsable.prenom} ${e.responsable.nom}` : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {e.parent ? `${e.parent.nom}${e.parent.code ? ` (${e.parent.code})` : ''}` : <span className="text-gray-500 italic">N/A</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {entites.length === 0 && (
          <div className="text-center py-8 text-gray-500">Aucune entité</div>
        )}
        {entites.length > pageSize && (
          <div className="mt-6 flex items-center justify-between border-t border-gray-200 pt-4">
            <div className="text-sm text-gray-700">
              Affichage {startIdx + 1}-{Math.min(startIdx + pageSize, entites.length)} sur {entites.length}
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
