import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';

export default function UserDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [entitesList, setEntitesList] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({
    password: '',
    confirmPassword: '',
  });
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [editData, setEditData] = useState({
    nom: '',
    prenom: '',
    email: '',
    role: 'contributeur',
    statut: 'actif',
    entiteIds: [] as string[],
  });

  useEffect(() => {
    if (id) {
      loadUser();
      loadEntites();
    }
  }, [id]);

  useEffect(() => {
    if (user) {
      setEditData({
        nom: user.nom || '',
        prenom: user.prenom || '',
        email: user.email || '',
        role: user.role || 'contributeur',
        statut: user.statut || 'actif',
        entiteIds: user.entitesMembres?.map((ue: any) => ue.entite?.id || ue.entiteId).filter(Boolean) || [],
      });
    }
  }, [user]);

  const loadUser = async () => {
    try {
      setError('');
      if (!id) {
        setError('ID de l\'utilisateur manquant');
        setLoading(false);
        return;
      }
      const response = await api.get(`/users/${id}`);
      if (response.data) {
        setUser(response.data);
      } else {
        setError('Utilisateur non trouvé');
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        setError('Utilisateur non trouvé');
      } else {
        setError(error.response?.data?.error || error.message || 'Erreur lors du chargement de l\'utilisateur');
      }
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

  const handleSaveEdit = async () => {
    setError('');
    setSaving(true);

    try {
      const updateData: any = {};

      if (editData.nom !== (user.nom || '')) {
        updateData.nom = editData.nom;
      }
      if (editData.prenom !== (user.prenom || '')) {
        updateData.prenom = editData.prenom;
      }
      if (editData.email !== (user.email || '')) {
        updateData.email = editData.email;
      }
      if (editData.role !== (user.role || '')) {
        updateData.role = editData.role;
      }
      if (editData.statut !== (user.statut || '')) {
        updateData.statut = editData.statut;
      }

      const currentEntiteIds = (user.entitesMembres?.map((ue: any) => ue.entite?.id || ue.entiteId).filter(Boolean) || []).sort();
      const newEntiteIds = (editData.entiteIds || []).sort();
      if (JSON.stringify(currentEntiteIds) !== JSON.stringify(newEntiteIds)) {
        updateData.entiteIds = editData.entiteIds || [];
      }

      if (Object.keys(updateData).length === 0) {
        setIsEditing(false);
        setSaving(false);
        return;
      }

      await api.put(`/users/${id}`, updateData);
      await loadUser();
      setIsEditing(false);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur lors de la modification');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError('');
    
    if (!passwordData.password || passwordData.password.length < 6) {
      setPasswordError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    if (passwordData.password !== passwordData.confirmPassword) {
      setPasswordError('Les mots de passe ne correspondent pas');
      return;
    }

    setChangingPassword(true);
    try {
      await api.patch(`/users/${id}/password`, {
        password: passwordData.password,
      });
      setShowPasswordModal(false);
      setPasswordData({ password: '', confirmPassword: '' });
      setPasswordError('');
      // Optionnel: afficher un message de succès
      alert('Mot de passe modifié avec succès');
    } catch (err: any) {
      setPasswordError(err.response?.data?.error || 'Erreur lors de la modification du mot de passe');
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Chargement...</div>
        </div>
      </div>
    );
  }

  if (error && !user) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={() => navigate('/users')}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Retour à la liste
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate('/users')}
          className="text-blue-600 hover:text-blue-800 mb-4 flex items-center gap-2"
        >
          ← Retour à la liste des utilisateurs
        </button>
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">
            {user.prenom} {user.nom}
          </h1>
          {!isEditing && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowPasswordModal(true)}
                className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
              >
                Modifier le mot de passe
              </button>
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Modifier
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6">
        {isEditing ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prénom <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editData.prenom}
                  onChange={(e) => setEditData({ ...editData, prenom: e.target.value })}
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
                  value={editData.nom}
                  onChange={(e) => setEditData({ ...editData, nom: e.target.value })}
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
                  value={editData.email}
                  onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rôle <span className="text-red-500">*</span>
                </label>
                <select
                  value={editData.role}
                  onChange={(e) => setEditData({ ...editData, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="admin">Administrateur</option>
                  <option value="contributeur">Contributeur</option>
                  <option value="lecteur">Lecteur</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Statut <span className="text-red-500">*</span>
                </label>
                <select
                  value={editData.statut}
                  onChange={(e) => setEditData({ ...editData, statut: e.target.value })}
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
                value={editData.entiteIds}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, option => option.value);
                  setEditData({ ...editData, entiteIds: selected });
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
              {editData.entiteIds.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {editData.entiteIds.map((entiteId) => {
                    const entite = entitesList.find(e => e.id === entiteId);
                    return entite ? (
                      <span
                        key={entiteId}
                        className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs flex items-center gap-1"
                      >
                        {entite.nom}{entite.code ? ` (${entite.code})` : ''}
                        <button
                          type="button"
                          onClick={() => setEditData({ ...editData, entiteIds: editData.entiteIds.filter(id => id !== entiteId) })}
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

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                onClick={() => {
                  setIsEditing(false);
                  setError('');
                  if (user) {
                    setEditData({
                      nom: user.nom || '',
                      prenom: user.prenom || '',
                      email: user.email || '',
                      role: user.role || 'contributeur',
                      statut: user.statut || 'actif',
                      entiteIds: user.entitesMembres?.map((ue: any) => ue.entite?.id || ue.entiteId).filter(Boolean) || [],
                    });
                  }
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="text-sm font-medium text-gray-500">Prénom</label>
                <p className="mt-1 text-sm">{user.prenom}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Nom</label>
                <p className="mt-1 text-sm">{user.nom}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Email</label>
                <p className="mt-1 text-sm">{user.email}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Rôle</label>
                <p className="mt-1 text-sm capitalize">{user.role}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Statut</label>
                <p className="mt-1">
                  <span className={`px-2 py-1 text-xs rounded ${
                    user.statut === 'actif' ? 'bg-green-100 text-green-800' :
                    user.statut === 'inactif' ? 'bg-gray-100 text-gray-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {user.statut}
                  </span>
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Date de création</label>
                <p className="mt-1 text-sm">
                  {new Date(user.createdAt).toLocaleDateString('fr-FR')}
                </p>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-500">Entités</label>
              <div className="mt-1">
                {user.entitesMembres && user.entitesMembres.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {user.entitesMembres.map((ue: any) => (
                      <span
                        key={ue.entite?.id || ue.entiteId}
                        className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs"
                      >
                        {ue.entite?.nom || 'N/A'}{ue.entite?.code ? ` (${ue.entite.code})` : ''}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">N/A</p>
                )}
              </div>
            </div>

            {user.processusProprietaire && user.processusProprietaire.length > 0 && (
              <div>
                <label className="text-sm font-medium text-gray-500 mb-2 block">
                  Processus (propriétaire)
                </label>
                <div className="space-y-2">
                  {user.processusProprietaire.map((p: any) => (
                    <div key={p.id} className="border border-gray-200 rounded p-3">
                      <p className="font-medium text-sm">{p.nom}</p>
                      {p.codeProcessus && (
                        <p className="text-xs text-gray-500">Code: {p.codeProcessus}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {user.documentsUploaded && user.documentsUploaded.length > 0 && (
              <div>
                <label className="text-sm font-medium text-gray-500 mb-2 block">
                  Documents uploadés (10 derniers)
                </label>
                <div className="space-y-2">
                  {user.documentsUploaded.map((d: any) => (
                    <div key={d.id} className="border border-gray-200 rounded p-3">
                      <p className="font-medium text-sm">{d.nom}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(d.createdAt).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de modification du mot de passe */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">Modifier le mot de passe</h2>
              
              {passwordError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                  {passwordError}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nouveau mot de passe <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={passwordData.password}
                    onChange={(e) => setPasswordData({ ...passwordData, password: e.target.value })}
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
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="Confirmer le mot de passe"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
                <button
                  onClick={() => {
                    setShowPasswordModal(false);
                    setPasswordData({ password: '', confirmPassword: '' });
                    setPasswordError('');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  onClick={handleChangePassword}
                  disabled={changingPassword}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:opacity-50"
                >
                  {changingPassword ? 'Modification...' : 'Modifier'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

