import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../store/auth';

export default function ProjetDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const isLecteur = currentUser?.role === 'lecteur';
  const [projet, setProjet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [entitesList, setEntitesList] = useState<any[]>([]);
  const [editData, setEditData] = useState({
    nom: '',
    codeProjet: '',
    description: '',
    type: '',
    statut: '',
    responsableId: '',
    gestionnaireId: '',
    entiteIds: [] as string[],
    tags: [] as string[],
  });

  useEffect(() => {
    if (id) {
      loadProjet();
      loadEntites();
    }
  }, [id]);

  useEffect(() => {
    if (projet) {
      setEditData({
        nom: projet.nom || '',
        codeProjet: projet.codeProjet || '',
        description: projet.description || '',
        type: projet.type || 'interne',
        statut: projet.statut || 'planifie',
        responsableId: projet.responsableId || '',
        gestionnaireId: projet.gestionnaireId || '',
        entiteIds: projet.entites?.map((pe: any) => pe.entite?.id || pe.entiteId).filter(Boolean) || [],
        tags: projet.tags || [],
      });
    }
  }, [projet]);

  const loadProjet = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/projets/${id}`);
      setProjet(response.data);
      setError('');
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError(err.response.data.error || 'Accès refusé à ce projet');
      } else {
        setError('Erreur lors du chargement du projet');
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

  const canModifyTags = () => {
    if (!projet || !currentUser) return false;
    return (
      currentUser.role === 'admin' ||
      projet.responsableId === currentUser.id ||
      projet.gestionnaireId === currentUser.id
    );
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      const updateData: any = {};
      
      if (editData.nom !== projet.nom) {
        updateData.nom = editData.nom;
      }
      if (editData.codeProjet !== projet.codeProjet) {
        updateData.codeProjet = editData.codeProjet;
      }
      if (editData.description !== (projet.description || '')) {
        updateData.description = editData.description || null;
      }
      if (editData.type !== projet.type) {
        updateData.type = editData.type;
      }
      if (editData.statut !== projet.statut) {
        updateData.statut = editData.statut;
      }
      if (editData.responsableId !== (projet.responsableId || '')) {
        updateData.responsableId = editData.responsableId || null;
      }
      if (editData.gestionnaireId !== (projet.gestionnaireId || '')) {
        updateData.gestionnaireId = editData.gestionnaireId || null;
      }
      
      const currentEntiteIds = projet.entites?.map((pe: any) => pe.entite?.id || pe.entiteId).filter(Boolean).sort() || [];
      const newEntiteIds = (editData.entiteIds || []).sort();
      if (JSON.stringify(currentEntiteIds) !== JSON.stringify(newEntiteIds)) {
        updateData.entiteIds = editData.entiteIds || [];
      }
      
      const currentTags = (projet.tags || []).sort();
      const newTags = (editData.tags || []).sort();
      if (JSON.stringify(currentTags) !== JSON.stringify(newTags)) {
        updateData.tags = editData.tags || [];
      }
      
      if (Object.keys(updateData).length > 0) {
        await api.put(`/projets/${id}`, updateData);
      }

      setIsEditing(false);
      loadProjet();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  const statuts = [
    { value: 'planifie', label: 'Planifié', color: 'bg-gray-100 text-gray-800' },
    { value: 'en_cours', label: 'En cours', color: 'bg-blue-100 text-blue-800' },
    { value: 'en_pause', label: 'En pause', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'termine', label: 'Terminé', color: 'bg-green-100 text-green-800' },
    { value: 'annule', label: 'Annulé', color: 'bg-red-100 text-red-800' },
  ];

  const types = [
    { value: 'interne', label: 'Interne' },
    { value: 'externe', label: 'Externe' },
    { value: 'mixte', label: 'Mixte' },
  ];

  if (loading) return <div className="p-6">Chargement...</div>;
  
  if (error && !projet) {
    return (
      <div className="p-6">
        <button
          onClick={() => navigate('/projets')}
          className="text-blue-600 hover:text-blue-800 mb-4"
        >
          ← Retour à la liste
        </button>
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-lg">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800 mb-2">
                Accès refusé
              </h3>
              <p className="text-sm text-yellow-700 whitespace-pre-line">
                {error}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  if (!projet) return <div className="p-6">Projet non trouvé</div>;

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate('/projets')}
          className="text-blue-600 hover:text-blue-800 mb-4"
        >
          ← Retour à la liste
        </button>
        <h1 className="text-2xl font-bold">{projet.nom}</h1>
        <div className="text-gray-600 mt-2 space-y-1">
          <p>Code: {projet.codeProjet}</p>
          {projet.nombreConsultations !== undefined && (
            <p className="text-sm">
              Nombre de consultations: <span className="font-semibold text-blue-600">{projet.nombreConsultations || 0}</span>
            </p>
          )}
        </div>
      </div>

      {/* Informations générales */}
      <div className="bg-white rounded-lg shadow mb-6 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Informations générales</h2>
          {!isEditing ? (
            !isLecteur && (
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
              >
                Modifier
              </button>
            )
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setIsEditing(false);
                  if (projet) {
                    setEditData({
                      nom: projet.nom || '',
                      codeProjet: projet.codeProjet || '',
                      description: projet.description || '',
                      type: projet.type || 'interne',
                      statut: projet.statut || 'planifie',
                      responsableId: projet.responsableId || '',
                      gestionnaireId: projet.gestionnaireId || '',
                      entiteIds: projet.entites?.map((pe: any) => pe.entite?.id || pe.entiteId).filter(Boolean) || [],
                      tags: projet.tags || [],
                    });
                  }
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
              >
                Annuler
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm disabled:opacity-50"
              >
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          )}
        </div>

        {isEditing ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
              <input
                type="text"
                value={editData.nom}
                onChange={(e) => setEditData({ ...editData, nom: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Code projet</label>
              <input
                type="text"
                value={editData.codeProjet}
                onChange={(e) => setEditData({ ...editData, codeProjet: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={editData.type}
                onChange={(e) => setEditData({ ...editData, type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                {types.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
              <select
                value={editData.statut}
                onChange={(e) => setEditData({ ...editData, statut: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                {statuts.map((statut) => (
                  <option key={statut.value} value={statut.value}>
                    {statut.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Entités</label>
              <select
                multiple
                value={editData.entiteIds}
                onChange={(e) => {
                  const selectedIds = Array.from(e.target.selectedOptions, option => option.value);
                  setEditData({ ...editData, entiteIds: selectedIds });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 min-h-[100px]"
                size={5}
              >
                {entitesList.map((entite) => (
                  <option key={entite.id} value={entite.id}>
                    {entite.nom} ({entite.code})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">Maintenez Ctrl (ou Cmd sur Mac) pour sélectionner plusieurs entités</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Type</label>
              <div className="mt-1">
                <span className="px-3 py-1 text-sm rounded bg-gray-100 text-gray-800">
                  {types.find(t => t.value === projet.type)?.label || projet.type}
                </span>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Statut</label>
              <div className="mt-1">
                <span className={`px-3 py-1 text-sm rounded ${
                  statuts.find(s => s.value === projet.statut)?.color || 'bg-gray-100 text-gray-800'
                }`}>
                  {statuts.find(s => s.value === projet.statut)?.label || projet.statut}
                </span>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Entités</label>
              <div className="mt-1">
                {projet.entites && projet.entites.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {projet.entites.map((pe: any) => (
                      <span
                        key={pe.entite?.id || pe.entiteId}
                        className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded"
                      >
                        {pe.entite?.nom || 'N/A'} ({pe.entite?.code || 'N/A'})
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-gray-500 italic">N/A</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Zone Description */}
        <div className="mt-6">
          <label className="text-sm font-medium text-gray-500 block mb-2">Description</label>
          {isEditing ? (
            <textarea
              value={editData.description}
              onChange={(e) => setEditData({ ...editData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 min-h-[100px]"
              placeholder="Description du projet"
            />
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 min-h-[100px]">
              {projet.description ? (
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{projet.description}</p>
              ) : (
                <p className="text-sm text-gray-400 italic">Aucune description</p>
              )}
            </div>
          )}
        </div>

        {/* Zone Tags */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-500">Tags (mots-clés)</label>
            {canModifyTags() && !isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Modifier
              </button>
            )}
          </div>
          {isEditing && canModifyTags() ? (
            <div>
              <input
                type="text"
                value={editData.tags.join(', ')}
                onChange={(e) => {
                  const tagsArray = e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
                  setEditData({ ...editData, tags: tagsArray });
                }}
                placeholder="Saisir les tags séparés par des virgules (ex: qualité, ISO, sécurité)"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">Séparez les tags par des virgules</p>
              {editData.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {editData.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded flex items-center gap-1"
                    >
                      {tag}
                      <button
                        onClick={() => {
                          const newTags = editData.tags.filter((_, i) => i !== index);
                          setEditData({ ...editData, tags: newTags });
                        }}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              {projet.tags && projet.tags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {projet.tags.map((tag: string, index: number) => (
                    <span
                      key={index}
                      className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">Aucun tag</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

