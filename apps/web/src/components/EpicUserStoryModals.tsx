import { useEffect, useState, type FormEvent } from 'react';
import { api, API_BASE_URL } from '../services/api';
import type { ProjetOption, EntiteOption, DocTache } from '../pages/Taches';

export type EpicRow = {
  id: string;
  nom: string;
  description?: string | null;
  projetId: string;
  projet?: { id: string; nom: string };
  entite?: { id: string; nom: string } | null;
  userStories?: { id: string; description: string; taches?: { id: string; nom: string; statut: string }[] }[];
  documents?: { document: DocTache }[];
};

export type UserStoryRow = {
  id: string;
  description: string;
  epicId?: string | null;
  epic?: EpicRow | null;
  taches?: { id: string; nom: string; statut: string; projetId?: string | null }[];
};

function truncate(s: string, n: number) {
  const t = s.trim();
  return t.length <= n ? t : `${t.slice(0, n)}…`;
}

export function EpicCreateModal({
  onClose,
  onSaved,
  projets,
  entites,
}: {
  onClose: () => void;
  onSaved: () => void;
  projets: ProjetOption[];
  entites: EntiteOption[];
}) {
  const [nom, setNom] = useState('');
  const [description, setDescription] = useState('');
  const [projetId, setProjetId] = useState('');
  const [entiteId, setEntiteId] = useState('');
  const [docIds, setDocIds] = useState<string[]>([]);
  const [orphanStories, setOrphanStories] = useState<UserStoryRow[]>([]);
  const [selectedUsIds, setSelectedUsIds] = useState<string[]>([]);
  const [docsLiables, setDocsLiables] = useState<DocTache[]>([]);
  const [searchDoc, setSearchDoc] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadNom, setUploadNom] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!projetId) {
      setOrphanStories([]);
      return;
    }
    let cancel = false;
    api
      .get('/user-stories', { params: { orphelines: true, projetId } })
      .then((r) => {
        if (!cancel) setOrphanStories(Array.isArray(r.data) ? r.data : []);
      })
      .catch(() => {
        if (!cancel) setOrphanStories([]);
      });
    return () => {
      cancel = true;
    };
  }, [projetId]);

  const loadDocs = async () => {
    try {
      const r = await api.get('/taches/documents-liables', { params: { search: searchDoc } });
      setDocsLiables(Array.isArray(r.data) ? r.data : []);
    } catch {
      setDocsLiables([]);
    }
  };

  useEffect(() => {
    void loadDocs();
  }, [searchDoc]);

  const toggleDoc = (id: string) =>
    setDocIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleUs = (id: string) =>
    setSelectedUsIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr('');
    if (!nom.trim() || !projetId) {
      setErr('Nom et projet sont obligatoires.');
      return;
    }
    setSaving(true);
    try {
      const { data: epic } = await api.post('/epics', {
        nom: nom.trim(),
        description: description.trim() || null,
        projetId,
        entiteId: entiteId || null,
        documentIds: docIds,
        userStoryIdsToAttach: selectedUsIds,
      });
      if (uploadFile && epic?.id) {
        const fd = new FormData();
        fd.append('fichier', uploadFile);
        fd.append('nom', uploadNom || uploadFile.name);
        await api.post(`/epics/${epic.id}/documents`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      onSaved();
      onClose();
    } catch (ex: any) {
      setErr(ex?.response?.data?.error || ex?.message || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-5 py-3 flex justify-between items-center">
          <h2 className="text-lg font-semibold">Nouvel Epic</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">
            ×
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          {err && <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{err}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom de l&apos;Epic *</label>
            <input
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Projet associé *</label>
            <select
              value={projetId}
              onChange={(e) => setProjetId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              required
            >
              <option value="">— Choisir —</option>
              {projets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nom}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Entité assignée</label>
            <select
              value={entiteId}
              onChange={(e) => setEntiteId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">— Aucune —</option>
              {entites.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nom}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sélectionner un ou plusieurs documents</label>
            <input
              type="text"
              value={searchDoc}
              onChange={(e) => setSearchDoc(e.target.value)}
              placeholder="Rechercher…"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mb-2"
            />
            <div className="border rounded-md max-h-40 overflow-y-auto p-2 space-y-1">
              {docsLiables.map((d) => (
                <label key={d.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-1 rounded">
                  <input type="checkbox" checked={docIds.includes(d.id)} onChange={() => toggleDoc(d.id)} />
                  {d.nom}
                </label>
              ))}
              {docsLiables.length === 0 && <p className="text-xs text-gray-400">Aucun document</p>}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rattacher des user stories orphelines (projet)</label>
            <p className="text-xs text-gray-500 mb-2">Choisissez d&apos;abord un projet.</p>
            <div className="border rounded-md max-h-36 overflow-y-auto p-2 space-y-1">
              {orphanStories.map((us) => (
                <label key={us.id} className="flex items-start gap-2 text-sm cursor-pointer hover:bg-gray-50 p-1 rounded">
                  <input type="checkbox" checked={selectedUsIds.includes(us.id)} onChange={() => toggleUs(us.id)} />
                  <span>{truncate(us.description, 120)}</span>
                </label>
              ))}
              {projetId && orphanStories.length === 0 && (
                <p className="text-xs text-gray-400">Aucune user story orpheline pour ce projet</p>
              )}
            </div>
          </div>
          <div className="border-t pt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Ajouter un document (upload)</label>
            <input type="file" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} className="text-sm w-full" />
            <input
              type="text"
              value={uploadNom}
              onChange={(e) => setUploadNom(e.target.value)}
              placeholder="Nom affiché (optionnel)"
              className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-md text-gray-700">
              Annuler
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-md disabled:opacity-50">
              {saving ? 'Création…' : 'Créer l&apos;Epic'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function EpicDetailModal({ epicId, onClose }: { epicId: string; onClose: () => void }) {
  const [epic, setEpic] = useState<EpicRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    api
      .get(`/epics/${epicId}`)
      .then((r) => {
        if (!cancel) setEpic(r.data);
      })
      .catch(() => {
        if (!cancel) setEpic(null);
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [epicId]);

  if (loading || !epic) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[80] p-4" onClick={onClose}>
        <div className="bg-white rounded-xl p-8" onClick={(e) => e.stopPropagation()}>
          <p className="text-gray-600">{loading ? 'Chargement…' : 'Epic introuvable'}</p>
          <button type="button" onClick={onClose} className="mt-4 text-sm text-blue-600">
            Fermer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[80] p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b px-5 py-3 flex justify-between items-center">
          <h2 className="text-lg font-semibold">Epic : {epic.nom}</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">
            ×
          </button>
        </div>
        <div className="p-5 space-y-4 text-sm">
          {epic.description && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">Description</p>
              <p className="text-gray-800 whitespace-pre-wrap">{epic.description}</p>
            </div>
          )}
          <p>
            <span className="text-gray-500">Projet :</span>{' '}
            <span className="font-medium">{epic.projet?.nom || '—'}</span>
          </p>
          {epic.entite && (
            <p>
              <span className="text-gray-500">Entité :</span> <span className="font-medium">{epic.entite.nom}</span>
            </p>
          )}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">User stories</p>
            <ul className="space-y-2">
              {(epic.userStories || []).map((us) => (
                <li key={us.id} className="border rounded-lg p-3 bg-gray-50">
                  <p className="font-medium text-gray-900">{truncate(us.description, 200)}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {(us.taches || []).length} tâche(s){' '}
                    {(us.taches || []).map((t) => t.nom).join(', ')}
                  </p>
                </li>
              ))}
              {(epic.userStories || []).length === 0 && <p className="text-gray-400">Aucune</p>}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Documents</p>
            <ul className="space-y-1">
              {(epic.documents || []).map((ed) => (
                <li key={ed.document.id}>
                  <a
                    href={`${API_BASE_URL}/documents/${ed.document.id}/view?token=${localStorage.getItem('token')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {ed.document.nom}
                  </a>
                </li>
              ))}
              {(epic.documents || []).length === 0 && <p className="text-gray-400">Aucun</p>}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export function UserStoryDetailModal({
  userStoryId,
  onClose,
  onOpenEpicId,
}: {
  userStoryId: string;
  onClose: () => void;
  onOpenEpicId?: (epicId: string) => void;
}) {
  const [us, setUs] = useState<UserStoryRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    api
      .get(`/user-stories/${userStoryId}`)
      .then((r) => {
        if (!cancel) setUs(r.data);
      })
      .catch(() => {
        if (!cancel) setUs(null);
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [userStoryId]);

  if (loading || !us) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[80] p-4" onClick={onClose}>
        <div className="bg-white rounded-xl p-8" onClick={(e) => e.stopPropagation()}>
          <p className="text-gray-600">{loading ? 'Chargement…' : 'User story introuvable'}</p>
          <button type="button" onClick={onClose} className="mt-4 text-sm text-blue-600">
            Fermer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[80] p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b px-5 py-3 flex justify-between items-center">
          <h2 className="text-lg font-semibold">User story</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">
            ×
          </button>
        </div>
        <div className="p-5 space-y-4 text-sm">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase">Description</p>
            <p className="text-gray-800 whitespace-pre-wrap">{us.description}</p>
          </div>
          {us.epic && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">Epic</p>
              <button
                type="button"
                onClick={() => {
                  if (us.epic?.id && onOpenEpicId) {
                    onClose();
                    onOpenEpicId(us.epic.id);
                  }
                }}
                className="text-left text-blue-600 hover:underline font-medium"
              >
                {us.epic.nom}
              </button>
              {us.epic.projet && <p className="text-xs text-gray-500 mt-1">Projet : {us.epic.projet.nom}</p>}
            </div>
          )}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase">Tâches</p>
            <ul className="list-disc pl-5 mt-1">
              {(us.taches || []).map((t) => (
                <li key={t.id}>
                  {t.nom} <span className="text-gray-400">({t.statut})</span>
                </li>
              ))}
              {(us.taches || []).length === 0 && <li className="text-gray-400 list-none">Aucune</li>}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
