import { useEffect, useState } from 'react';
import { api } from '../services/api';

export default function Journal() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [filters, setFilters] = useState({
    search: '',
    action: '',
    ressourceType: '',
    userId: '',
    dateFrom: '',
    dateTo: '',
  });
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    loadLogs();
    loadUsers();
  }, []);

  useEffect(() => {
    loadLogs();
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.search, filters.action, filters.ressourceType, filters.userId, filters.dateFrom, filters.dateTo]);

  const loadLogs = async () => {
    try {
      const params: any = { limit: 100 };
      if (filters.search) params.search = filters.search;
      if (filters.action) params.action = filters.action;
      if (filters.ressourceType) params.ressourceType = filters.ressourceType;
      if (filters.userId) params.userId = filters.userId;
      if (filters.dateFrom) params.dateFrom = filters.dateFrom;
      if (filters.dateTo) params.dateTo = filters.dateTo;
      const response = await api.get('/journal', { params });
      setLogs(response.data);
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
      // silencieux
    }
  };

  if (loading) return <div className="p-6">Chargement...</div>;

  const totalPages = Math.max(1, Math.ceil(logs.length / pageSize));
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
  const startIdx = (page - 1) * pageSize;
  const pagedLogs = logs.slice(startIdx, startIdx + pageSize);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Journal d'accès</h1>

      {/* Filtres */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Recherche</label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="Nom ressource, détails"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
            <select
              value={filters.action}
              onChange={(e) => setFilters({ ...filters, action: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">Toutes</option>
              <option value="lecture">Lecture</option>
              <option value="creation">Création</option>
              <option value="modification">Modification</option>
              <option value="suppression">Suppression</option>
              <option value="telechargement">Téléchargement</option>
              <option value="export">Export</option>
              <option value="connexion">Connexion</option>
              <option value="deconnexion">Déconnexion</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ressource</label>
            <select
              value={filters.ressourceType}
              onChange={(e) => setFilters({ ...filters, ressourceType: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">Toutes</option>
              <option value="processus">Processus</option>
              <option value="document">Document</option>
              <option value="entite">Entité</option>
              <option value="utilisateur">Utilisateur</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Utilisateur</label>
            <select
              value={filters.userId}
              onChange={(e) => setFilters({ ...filters, userId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">Tous</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Du</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Au</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <button
            type="button"
            onClick={() => setFilters({ search: '', action: '', ressourceType: '', userId: '', dateFrom: '', dateTo: '' })}
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
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Utilisateur</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ressource</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nom</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {pagedLogs.map((log) => (
              <tr key={log.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {new Date(log.timestamp).toLocaleString('fr-FR')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {log.user ? `${log.user.prenom} ${log.user.nom}` : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-800 capitalize">
                    {log.action}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm capitalize">{log.ressourceType}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">{log.ressourceNom || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.length === 0 && (
          <div className="text-center py-8 text-gray-500">Aucun log</div>
        )}
        {logs.length > pageSize && (
          <div className="mt-6 flex items-center justify-between border-t border-gray-200 pt-4">
            <div className="text-sm text-gray-700">
              Affichage {startIdx + 1}-{Math.min(startIdx + pageSize, logs.length)} sur {logs.length}
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
                {getPageNumbers().map((p, idx, arr) => (
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
