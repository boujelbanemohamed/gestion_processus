import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';

export default function Users() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [entitesList, setEntitesList] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    search: '',
    role: '',
    statut: '',
    entiteId: '',
  });
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'contributeur',
    statut: 'actif',
    entiteIds: [] as string[],
  });

  useEffect(() => {
    loadUsers();
    loadEntites();
  }, []);

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.search, filters.role, filters.statut, filters.entiteId]);
  useEffect(() => {
    setPage(1);
  }, [filters.search, filters.role, filters.statut, filters.entiteId]);

  const loadUsers = async () => {
    try {
      const params: any = {};
      if (filters.search) params.search = filters.search;
      if (filters.role) params.role = filters.role;
      if (filters.statut) params.statut = filters.statut;
      if (filters.entiteId) params.entiteId = filters.entiteId;
      const response = await api.get('/users', { params });
      setUsers(response.data);
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
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

  const handleCreate = async () => {
    setError('');
    
    if (!formData.nom || !formData.prenom || !formData.email || !formData.password) {
      setError('Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (formData.password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    setCreating(true);
    try {
      const createData: any = {
        nom: formData.nom,
        prenom: formData.prenom,
        email: formData.email,
        password: formData.password,
        role: formData.role,
        statut: formData.statut,
      };

      if (formData.entiteIds && formData.entiteIds.length > 0) {
        createData.entiteIds = formData.entiteIds;
      }

      await api.post('/users', createData);
      await loadUsers();
      setShowCreateModal(false);
      setFormData({
        nom: '',
        prenom: '',
        email: '',
        password: '',
        confirmPassword: '',
        role: 'contributeur',
        statut: 'actif',
        entiteIds: [],
      });
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur lors de la création de l\'utilisateur');
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <div className="p-6">Chargement...</div>;

  const totalPages = Math.max(1, Math.ceil(users.length / pageSize));
  const startIdx = (page - 1) * pageSize;
  const pagedUsers = users.slice(startIdx, startIdx + pageSize);
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
        <h1 className="text-2xl font-bold">Utilisateurs</h1>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Nouvel utilisateur
        </button>
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
              placeholder="Nom, prénom, email"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rôle</label>
            <select
              value={filters.role}
              onChange={(e) => setFilters({ ...filters, role: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">Tous</option>
              <option value="admin">Administrateur</option>
              <option value="contributeur">Contributeur</option>
              <option value="lecteur">Lecteur</option>
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
              <option value="actif">Actif</option>
              <option value="inactif">Inactif</option>
              <option value="suspendu">Suspendu</option>
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
              {entitesList.map((entite) => (
                <option key={entite.id} value={entite.id}>
                  {entite.nom}{entite.code ? ` (${entite.code})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <button
            type="button"
            onClick={() => setFilters({ search: '', role: '', statut: '', entiteId: '' })}
            className="px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Réinitialiser
          </button>
        </div>
      </div>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nom</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rôle</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entités</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {pagedUsers.map((u) => (
              <tr key={u.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <Link 
                    to={`/users/${u.id}`}
                    className="text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    {u.prenom} {u.nom}
                  </Link>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">{u.email}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm capitalize">{u.role}</td>
                <td className="px-6 py-4 text-sm">
                  {u.entitesMembres && Array.isArray(u.entitesMembres) && u.entitesMembres.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {u.entitesMembres.map((ue: any) => (
                        <span
                          key={ue.entite?.id || ue.entiteId || Math.random()}
                          className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs"
                        >
                          {ue.entite?.nom || 'N/A'}{ue.entite?.code ? ` (${ue.entite.code})` : ''}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-gray-500 italic">N/A</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs rounded ${
                    u.statut === 'actif' ? 'bg-green-100 text-green-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {u.statut}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && (
          <div className="text-center py-8 text-gray-500">Aucun utilisateur</div>
        )}
        {users.length > pageSize && (
          <div className="mt-6 flex items-center justify-between border-t border-gray-200 pt-4">
            <div className="text-sm text-gray-700">
              Affichage {startIdx + 1}-{Math.min(startIdx + pageSize, users.length)} sur {users.length}
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

      {/* Modal de création d'utilisateur */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto relative">
            <button
              type="button"
              aria-label="Fermer"
              onClick={() => setShowCreateModal(false)}
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 text-xl leading-none"
            >
              ×
            </button>
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">Nouvel utilisateur</h2>
              
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Prénom <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.prenom}
                      onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nom <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.nom}
                      onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Rôle <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="admin">Administrateur</option>
                      <option value="contributeur">Contributeur</option>
                      <option value="lecteur">Lecteur</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Mot de passe <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="Au moins 6 caractères"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Confirmer le mot de passe <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="Confirmer le mot de passe"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Statut <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.statut}
                      onChange={(e) => setFormData({ ...formData, statut: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="actif">Actif</option>
                      <option value="inactif">Inactif</option>
                      <option value="suspendu">Suspendu</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Entités
                  </label>
                  <select
                    multiple
                    value={formData.entiteIds}
                    onChange={(e) => {
                      const selected = Array.from(e.target.selectedOptions, option => option.value);
                      setFormData({ ...formData, entiteIds: selected });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md min-h-[120px]"
                    size={5}
                  >
                    {entitesList.map((entite) => (
                      <option key={entite.id} value={entite.id}>
                        {entite.nom}{entite.code ? ` (${entite.code})` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Sélectionnez une ou plusieurs entités. Utilisez Ctrl (Cmd sur Mac) pour sélectionner plusieurs entités.
                  </p>
                  {formData.entiteIds.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {formData.entiteIds.map((entiteId) => {
                        const entite = entitesList.find(e => e.id === entiteId);
                        return entite ? (
                          <span
                            key={entiteId}
                            className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs flex items-center gap-1"
                          >
                            {entite.nom}{entite.code ? ` (${entite.code})` : ''}
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, entiteIds: formData.entiteIds.filter(id => id !== entiteId) })}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              ×
                            </button>
                          </span>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setFormData({
                      nom: '',
                      prenom: '',
                      email: '',
                      password: '',
                      confirmPassword: '',
                      role: 'contributeur',
                      statut: 'actif',
                      entiteIds: [],
                    });
                    setError('');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {creating ? 'Création...' : 'Créer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
