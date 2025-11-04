import { useEffect, useState } from 'react';
import { api } from '../services/api';

type TabType = 'categories' | 'smtp';

export default function Configuration() {
  const [activeTab, setActiveTab] = useState<TabType>('categories');
  
  // Catégories
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [formData, setFormData] = useState({
    nom: '',
    description: '',
    couleur: '#3B82F6',
    icone: '',
    parentId: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // SMTP
  const [smtpConfigs, setSmtpConfigs] = useState<any[]>([]);
  const [smtpLoading, setSmtpLoading] = useState(true);
  const [showSmtpModal, setShowSmtpModal] = useState(false);
  const [editingSmtp, setEditingSmtp] = useState<any>(null);
  const [smtpFormData, setSmtpFormData] = useState({
    host: '',
    port: 587,
    secure: false,
    user: '',
    password: '',
    fromEmail: '',
    fromName: '',
    isActive: false,
  });
  const [smtpSubmitting, setSmtpSubmitting] = useState(false);
  const [smtpError, setSmtpError] = useState('');
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState('');

  useEffect(() => {
    if (activeTab === 'categories') {
      loadCategories();
    } else if (activeTab === 'smtp') {
      loadSmtpConfigs();
    }
  }, [activeTab]);

  const loadCategories = async () => {
    try {
      const response = await api.get('/categories');
      setCategories(response.data);
    } catch (error) {
      console.error('Erreur chargement catégories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      if (!formData.nom.trim()) {
        setError('Le nom est obligatoire');
        return;
      }

      const submitData = {
        ...formData,
        parentId: formData.parentId || undefined,
        description: formData.description || undefined,
        icone: formData.icone || undefined,
      };

      if (editingCategory) {
        await api.put(`/categories/${editingCategory.id}`, submitData);
      } else {
        await api.post('/categories', submitData);
      }

      setShowModal(false);
      setEditingCategory(null);
      setFormData({
        nom: '',
        description: '',
        couleur: '#3B82F6',
        icone: '',
        parentId: '',
      });
      loadCategories();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur lors de l\'opération');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (category: any) => {
    setEditingCategory(category);
    setFormData({
      nom: category.nom || '',
      description: category.description || '',
      couleur: category.couleur || '#3B82F6',
      icone: category.icone || '',
      parentId: category.parentId || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette catégorie ?')) {
      return;
    }

    setDeletingId(id);
    try {
      await api.delete(`/categories/${id}`);
      loadCategories();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erreur lors de la suppression');
    } finally {
      setDeletingId(null);
    }
  };

  const handleCancel = () => {
    setShowModal(false);
    setEditingCategory(null);
    setFormData({
      nom: '',
      description: '',
      couleur: '#3B82F6',
      icone: '',
      parentId: '',
    });
    setError('');
  };

  const loadSmtpConfigs = async () => {
    try {
      setSmtpLoading(true);
      const response = await api.get('/smtp');
      setSmtpConfigs(response.data);
    } catch (error) {
      console.error('Erreur chargement configs SMTP:', error);
    } finally {
      setSmtpLoading(false);
    }
  };

  const handleSmtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSmtpError('');
    setSmtpSubmitting(true);

    try {
      const submitData = {
        ...smtpFormData,
        port: parseInt(smtpFormData.port.toString()),
        fromName: smtpFormData.fromName || undefined,
      };

      if (editingSmtp) {
        await api.put(`/smtp/${editingSmtp.id}`, submitData);
      } else {
        await api.post('/smtp', submitData);
      }

      setShowSmtpModal(false);
      setEditingSmtp(null);
      setSmtpFormData({
        host: '',
        port: 587,
        secure: false,
        user: '',
        password: '',
        fromEmail: '',
        fromName: '',
        isActive: false,
      });
      loadSmtpConfigs();
    } catch (err: any) {
      setSmtpError(err.response?.data?.error || 'Erreur lors de l\'opération');
    } finally {
      setSmtpSubmitting(false);
    }
  };

  const handleEditSmtp = (config: any) => {
    setEditingSmtp(config);
    setSmtpFormData({
      host: config.host || '',
      port: config.port || 587,
      secure: config.secure || false,
      user: config.user || '',
      password: '', // Ne pas pré-remplir le mot de passe
      fromEmail: config.fromEmail || '',
      fromName: config.fromName || '',
      isActive: config.isActive || false,
    });
    setShowSmtpModal(true);
  };

  const handleDeleteSmtp = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette configuration SMTP ?')) {
      return;
    }

    try {
      await api.delete(`/smtp/${id}`);
      loadSmtpConfigs();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erreur lors de la suppression');
    }
  };

  const handleTestSmtp = async (id: string) => {
    if (!testEmail.trim()) {
      alert('Veuillez saisir un email de test');
      return;
    }

    setTestingId(id);
    try {
      const response = await api.post(`/smtp/${id}/test`, { testEmail });
      alert(response.data.message || 'Test réussi !');
      loadSmtpConfigs(); // Recharger pour afficher le résultat du test
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erreur lors du test');
      loadSmtpConfigs(); // Recharger même en cas d'erreur pour afficher le résultat
    } finally {
      setTestingId(null);
      setTestEmail('');
    }
  };

  if (loading && activeTab === 'categories') return <div className="p-6">Chargement...</div>;
  if (smtpLoading && activeTab === 'smtp') return <div className="p-6">Chargement...</div>;

  // Organiser les catégories en arbre (catégories racines avec leurs enfants)
  const rootCategories = categories.filter((cat) => !cat.parentId);
  const getChildren = (parentId: string) => {
    return categories.filter((cat) => cat.parentId === parentId);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Configuration</h1>

      {/* Onglets */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('categories')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'categories'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Catégories
          </button>
          <button
            onClick={() => setActiveTab('smtp')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'smtp'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Configuration SMTP
          </button>
        </nav>
      </div>

      {/* Contenu Catégories */}
      {activeTab === 'categories' && (
        <>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">Catégories de processus</h2>
            <button
              onClick={() => {
                setEditingCategory(null);
                setFormData({
                  nom: '',
                  description: '',
                  couleur: '#3B82F6',
                  icone: '',
                  parentId: '',
                });
                setShowModal(true);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Ajouter une catégorie
            </button>
          </div>

      {/* Modal de création/édition */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto py-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 my-auto">
            <div className="p-6 max-h-[85vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">
                  {editingCategory ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
                </h2>
                <button
                  onClick={handleCancel}
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
                    placeholder="Nom de la catégorie"
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
                    placeholder="Description de la catégorie"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Couleur
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={formData.couleur}
                        onChange={(e) => setFormData({ ...formData, couleur: e.target.value })}
                        className="h-10 w-20 border border-gray-300 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={formData.couleur}
                        onChange={(e) => setFormData({ ...formData, couleur: e.target.value })}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="#3B82F6"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Icône
                    </label>
                    <input
                      type="text"
                      value={formData.icone}
                      onChange={(e) => setFormData({ ...formData, icone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="ex: 📁, 📄, 📋"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Catégorie parente
                  </label>
                  <select
                    value={formData.parentId}
                    onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Aucune (catégorie racine)</option>
                    {categories
                      .filter((cat) => !editingCategory || cat.id !== editingCategory.id)
                      .map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.nom}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {submitting ? 'Enregistrement...' : editingCategory ? 'Modifier' : 'Créer'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Liste des catégories */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {categories.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Aucune catégorie. Cliquez sur "Ajouter une catégorie" pour commencer.
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {rootCategories.map((category) => (
              <div key={category.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
                      style={{ backgroundColor: category.couleur || '#3B82F6', color: 'white' }}
                    >
                      {category.icone || '📁'}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-gray-900">{category.nom}</h3>
                        {category._count && category._count.processus > 0 && (
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                            {category._count.processus} processus
                          </span>
                        )}
                      </div>
                      {category.description && (
                        <p className="text-sm text-gray-600 mt-1">{category.description}</p>
                      )}
                      {category.couleur && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-xs text-gray-500">Couleur:</span>
                          <div
                            className="w-6 h-6 rounded border border-gray-300"
                            style={{ backgroundColor: category.couleur }}
                          />
                          <span className="text-xs text-gray-500">{category.couleur}</span>
                        </div>
                      )}
                      {/* Afficher les sous-catégories */}
                      {getChildren(category.id).length > 0 && (
                        <div className="mt-3 ml-6 pl-4 border-l-2 border-gray-200">
                          <p className="text-xs text-gray-500 mb-2">Sous-catégories:</p>
                          {getChildren(category.id).map((child) => (
                            <div key={child.id} className="mb-2 flex items-center justify-between group">
                              <div className="flex items-center gap-2 flex-1">
                                <div
                                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
                                  style={{ backgroundColor: child.couleur || '#3B82F6', color: 'white' }}
                                >
                                  {child.icone || '📁'}
                                </div>
                                <div>
                                  <span className="text-sm text-gray-700">{child.nom}</span>
                                  {child.description && (
                                    <p className="text-xs text-gray-500">{child.description}</p>
                                  )}
                                </div>
                                {child._count && child._count.processus > 0 && (
                                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                    {child._count.processus} processus
                                  </span>
                                )}
                              </div>
                              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => handleEdit(child)}
                                  className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                                >
                                  Modifier
                                </button>
                                <button
                                  onClick={() => handleDelete(child.id)}
                                  disabled={deletingId === child.id}
                                  className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50"
                                >
                                  {deletingId === child.id ? '...' : 'Supprimer'}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(category)}
                      className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                    >
                      Modifier
                    </button>
                    <button
                      onClick={() => handleDelete(category.id)}
                      disabled={deletingId === category.id}
                      className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50"
                    >
                      {deletingId === category.id ? 'Suppression...' : 'Supprimer'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
        </>
      )}

      {/* Contenu SMTP */}
      {activeTab === 'smtp' && (
        <>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">Configurations SMTP</h2>
            <button
              onClick={() => {
                setEditingSmtp(null);
                setSmtpFormData({
                  host: '',
                  port: 587,
                  secure: false,
                  user: '',
                  password: '',
                  fromEmail: '',
                  fromName: '',
                  isActive: false,
                });
                setShowSmtpModal(true);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Nouvelle configuration SMTP
            </button>
          </div>

          {/* Modal de création/édition SMTP */}
          {showSmtpModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto py-4">
              <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 my-auto">
                <div className="p-6 max-h-[85vh] overflow-y-auto">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">
                      {editingSmtp ? 'Modifier la configuration SMTP' : 'Nouvelle configuration SMTP'}
                    </h2>
                    <button
                      onClick={() => {
                        setShowSmtpModal(false);
                        setEditingSmtp(null);
                        setSmtpFormData({
                          host: '',
                          port: 587,
                          secure: false,
                          user: '',
                          password: '',
                          fromEmail: '',
                          fromName: '',
                          isActive: false,
                        });
                        setSmtpError('');
                      }}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      ✕
                    </button>
                  </div>

                  {smtpError && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">
                      {smtpError}
                    </div>
                  )}

                  <form onSubmit={handleSmtpSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Serveur SMTP (host) <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={smtpFormData.host}
                          onChange={(e) => setSmtpFormData({ ...smtpFormData, host: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          placeholder="smtp.example.com"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Port <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          required
                          value={smtpFormData.port}
                          onChange={(e) => setSmtpFormData({ ...smtpFormData, port: parseInt(e.target.value) || 587 })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          placeholder="587"
                        />
                      </div>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={smtpFormData.secure}
                        onChange={(e) => setSmtpFormData({ ...smtpFormData, secure: e.target.checked })}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label className="ml-2 block text-sm text-gray-700">
                        Connexion sécurisée (SSL/TLS) - généralement pour le port 465
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Utilisateur <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={smtpFormData.user}
                          onChange={(e) => setSmtpFormData({ ...smtpFormData, user: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          placeholder="user@example.com"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Mot de passe <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="password"
                          required={!editingSmtp}
                          value={smtpFormData.password}
                          onChange={(e) => setSmtpFormData({ ...smtpFormData, password: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          placeholder={editingSmtp ? 'Laisser vide pour ne pas modifier' : 'Mot de passe'}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Email expéditeur <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="email"
                          required
                          value={smtpFormData.fromEmail}
                          onChange={(e) => setSmtpFormData({ ...smtpFormData, fromEmail: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          placeholder="noreply@example.com"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Nom expéditeur
                        </label>
                        <input
                          type="text"
                          value={smtpFormData.fromName}
                          onChange={(e) => setSmtpFormData({ ...smtpFormData, fromName: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Nom de l'expéditeur"
                        />
                      </div>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={smtpFormData.isActive}
                        onChange={(e) => setSmtpFormData({ ...smtpFormData, isActive: e.target.checked })}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label className="ml-2 block text-sm text-gray-700">
                        Activer cette configuration (désactivera automatiquement les autres)
                      </label>
                    </div>

                    <div className="flex justify-end space-x-3 pt-4">
                      <button
                        type="button"
                        onClick={() => {
                          setShowSmtpModal(false);
                          setEditingSmtp(null);
                          setSmtpFormData({
                            host: '',
                            port: 587,
                            secure: false,
                            user: '',
                            password: '',
                            fromEmail: '',
                            fromName: '',
                            isActive: false,
                          });
                          setSmtpError('');
                        }}
                        className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                      >
                        Annuler
                      </button>
                      <button
                        type="submit"
                        disabled={smtpSubmitting}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                      >
                        {smtpSubmitting ? 'Enregistrement...' : editingSmtp ? 'Modifier' : 'Créer'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* Liste des configurations SMTP */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {smtpConfigs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Aucune configuration SMTP. Cliquez sur "Nouvelle configuration SMTP" pour commencer.
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {smtpConfigs.map((config) => (
                  <div key={config.id} className="p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">{config.host}:{config.port}</h3>
                          {config.isActive && (
                            <span className="px-2 py-1 text-xs font-semibold bg-green-100 text-green-800 rounded">
                              Active
                            </span>
                          )}
                          {config.secure && (
                            <span className="px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-800 rounded">
                              SSL/TLS
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                          <div>
                            <span className="font-medium">Utilisateur:</span> {config.user}
                          </div>
                          <div>
                            <span className="font-medium">Email expéditeur:</span> {config.fromEmail}
                          </div>
                          {config.fromName && (
                            <div>
                              <span className="font-medium">Nom expéditeur:</span> {config.fromName}
                            </div>
                          )}
                          {config.updatedBy && (
                            <div>
                              <span className="font-medium">Modifié par:</span> {config.updatedBy.prenom} {config.updatedBy.nom}
                            </div>
                          )}
                        </div>
                        {config.lastTestResult && (
                          <div className="mt-2">
                            <div className={`text-sm ${
                              config.lastTestResult.success ? 'text-green-600' : 'text-red-600'
                            }`}>
                              <span className="font-medium">Dernier test:</span>{' '}
                              {config.lastTestAt ? new Date(config.lastTestAt).toLocaleString('fr-FR') : 'N/A'} -{' '}
                              {config.lastTestResult.success 
                                ? config.lastTestResult.message || 'Succès'
                                : config.lastTestResult.error || 'Échec'}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 ml-4">
                        <div className="flex flex-col gap-2">
                          <input
                            type="email"
                            value={testEmail}
                            onChange={(e) => setTestEmail(e.target.value)}
                            placeholder="Email de test"
                            className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          />
                          <button
                            onClick={() => handleTestSmtp(config.id)}
                            disabled={testingId === config.id || !testEmail.trim()}
                            className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {testingId === config.id ? 'Test en cours...' : 'Tester'}
                          </button>
                        </div>
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={() => handleEditSmtp(config)}
                            className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                          >
                            Modifier
                          </button>
                          <button
                            onClick={() => handleDeleteSmtp(config.id)}
                            className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                          >
                            Supprimer
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

