import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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

const PARTIES_PRENANTES_OPTIONS = [
  'Clients', 'Partenaires', 'Fournisseurs', 'Prestataires',
  'Utilisateurs finaux', 'Autorités réglementaires'
];

type UserOption = { id: string; nom: string; prenom: string; };

export default function ProjetDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const printRef = useRef<HTMLDivElement>(null);

  const [projet, setProjet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [users, setUsers] = useState<UserOption[]>([]);

  // Form state
  const [form, setForm] = useState<any>({});
  // Stakeholders with names
  const [partiesPrenantes, setPartiesPrenantes] = useState<{ type: string; nom: string }[]>([]);
  const [newPartie, setNewPartie] = useState({ type: 'Clients', nom: '' });
  // KPIs
  const [kpis, setKpis] = useState<string[]>([]);
  const [newKpi, setNewKpi] = useState('');
  // Objectifs
  const [objectifsStrategiques, setObjectifsStrategiques] = useState<string[]>([]);
  const [newObjStrat, setNewObjStrat] = useState('');
  const [objectifsOperationnels, setObjectifsOperationnels] = useState<string[]>([]);
  const [newObjOp, setNewObjOp] = useState('');

  useEffect(() => {
    loadProjet();
    loadUsers();
  }, [id]);

  const loadProjet = async () => {
    try {
      const response = await api.get(`/projets/${id}`);
      const p = response.data;
      setProjet(p);
      setForm({
        nom: p.nom || '',
        type: p.type || 'interne',
        nomClient: p.nomClient || '',
        dateDebut: p.dateDebut ? p.dateDebut.substring(0, 10) : '',
        dateFinPrevue: p.dateFinPrevue ? p.dateFinPrevue.substring(0, 10) : '',
        statut: p.statut || 'en_preparation',
        priorite: p.priorite || 'moyenne',
        sponsorIds: p.sponsors?.map((u: any) => u.id) || [],
        chefProjetIds: p.chefsProjet?.map((u: any) => u.id) || [],
        techLeadIds: p.techLeads?.map((u: any) => u.id) || [],
        equipeIds: p.equipe?.map((u: any) => u.id) || [],
        contexte: p.contexte || '',
        mission: p.mission || '',
        vision: p.vision || '',
        scopeInclus: p.scopeInclus || '',
        scopeExclus: p.scopeExclus || '',
      });
      setPartiesPrenantes(p.partiesPrenantes || []);
      setKpis(p.kpis || []);
      setObjectifsStrategiques(p.objectifsStrategiques || []);
      setObjectifsOperationnels(p.objectifsOperationnels || []);
    } catch (err) {
      console.error('Erreur:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await api.get('/users');
      setUsers(response.data.map((u: any) => ({ id: u.id, nom: u.nom, prenom: u.prenom })));
    } catch (err) {
      console.error('Erreur chargement users:', err);
    }
  };

  const handleSave = async () => {
    setError('');
    if (!form.nom || !form.dateDebut) {
      setError('Nom et date de début sont obligatoires');
      return;
    }
    setSaving(true);
    try {
      await api.put(`/projets/${id}`, {
        ...form,
        partiesPrenantes,
        kpis,
        objectifsStrategiques,
        objectifsOperationnels,
      });
      await loadProjet();
      setEditing(false);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Supprimer ce projet ?')) return;
    try {
      await api.delete(`/projets/${id}`);
      navigate('/projets');
    } catch (err) {
      console.error('Erreur suppression:', err);
    }
  };

  const handlePrint = () => { window.print(); };

  const toggleUser = (field: string, userId: string) => {
    const current: string[] = form[field] || [];
    if (current.includes(userId)) {
      setForm({ ...form, [field]: current.filter((id: string) => id !== userId) });
    } else {
      setForm({ ...form, [field]: [...current, userId] });
    }
  };

  const getUserName = (userId: string) => {
    const u = users.find(u => u.id === userId);
    return u ? `${u.prenom} ${u.nom}` : userId;
  };

  const addPartie = () => {
    if (!newPartie.nom.trim()) return;
    setPartiesPrenantes([...partiesPrenantes, { ...newPartie }]);
    setNewPartie({ type: 'Clients', nom: '' });
  };

  const removePartie = (idx: number) => setPartiesPrenantes(partiesPrenantes.filter((_, i) => i !== idx));

  const addKpi = () => {
    if (!newKpi.trim()) return;
    setKpis([...kpis, newKpi.trim()]);
    setNewKpi('');
  };

  const addObjStrat = () => {
    if (!newObjStrat.trim()) return;
    setObjectifsStrategiques([...objectifsStrategiques, newObjStrat.trim()]);
    setNewObjStrat('');
  };

  const addObjOp = () => {
    if (!newObjOp.trim()) return;
    setObjectifsOperationnels([...objectifsOperationnels, newObjOp.trim()]);
    setNewObjOp('');
  };

  // Multi-select user component
  const UserMultiSelect = ({ field, label }: { field: string; label: string }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {editing ? (
        <div className="border border-gray-300 rounded-md max-h-32 overflow-y-auto p-2">
          {users.map(u => (
            <label key={u.id} className="flex items-center gap-2 py-1 cursor-pointer hover:bg-gray-50 px-1 rounded">
              <input
                type="checkbox"
                checked={(form[field] || []).includes(u.id)}
                onChange={() => toggleUser(field, u.id)}
                className="rounded"
              />
              <span className="text-sm">{u.prenom} {u.nom}</span>
            </label>
          ))}
          {users.length === 0 && <p className="text-sm text-gray-400 italic">Aucun utilisateur</p>}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 min-h-[32px]">
          {(projet[field === 'sponsorIds' ? 'sponsors' : field === 'chefProjetIds' ? 'chefsProjet' : field === 'techLeadIds' ? 'techLeads' : 'equipe'] || []).length === 0
            ? <span className="text-sm text-gray-400 italic">—</span>
            : (projet[field === 'sponsorIds' ? 'sponsors' : field === 'chefProjetIds' ? 'chefsProjet' : field === 'techLeadIds' ? 'techLeads' : 'equipe'] || []).map((u: any) => (
              <span key={u.id} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">{u.prenom} {u.nom}</span>
            ))
          }
        </div>
      )}
    </div>
  );

  const Field = ({ label, value, editComponent }: { label: string; value: any; editComponent?: React.ReactNode }) => (
    <div>
      <label className="block text-sm font-medium text-gray-500 mb-1">{label}</label>
      {editing && editComponent ? editComponent : (
        <p className="text-sm text-gray-900">{value || <span className="italic text-gray-400">—</span>}</p>
      )}
    </div>
  );

  if (loading) return <div className="p-6">Chargement...</div>;
  if (!projet) return <div className="p-6 text-red-600">Projet introuvable</div>;

  return (
    <>
      {/* Style d'impression */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #print-zone, #print-zone * { visibility: visible !important; }
          #print-zone { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="p-6 max-w-5xl mx-auto">
        {/* En-tête */}
        <div className="flex justify-between items-start mb-6 no-print">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/projets')} className="text-gray-500 hover:text-gray-700 text-sm flex items-center gap-1">
              ← Retour
            </button>
            <h1 className="text-2xl font-bold">{projet.nom}</h1>
            <span className={`px-2 py-1 text-xs rounded ${STATUS_COLORS[projet.statut] || ''}`}>
              {STATUS_LABELS[projet.statut] || projet.statut}
            </span>
            <span className={`px-2 py-1 text-xs rounded capitalize ${PRIORITY_COLORS[projet.priorite] || ''}`}>
              {projet.priorite}
            </span>
          </div>
          <div className="flex gap-2">
            <button onClick={handlePrint} className="px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 flex items-center gap-1">
              🖨️ Imprimer
            </button>
            {editing ? (
              <>
                <button onClick={() => { setEditing(false); loadProjet(); }} className="px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">Annuler</button>
                <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm disabled:opacity-50">{saving ? 'Enregistrement...' : 'Enregistrer'}</button>
              </>
            ) : (
              <>
                <button onClick={() => setEditing(true)} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm">Modifier</button>
                <button onClick={handleDelete} className="px-3 py-2 text-sm border border-red-300 rounded-md text-red-600 hover:bg-red-50">Supprimer</button>
              </>
            )}
          </div>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm no-print">{error}</div>}

        {/* Zone imprimable */}
        <div id="print-zone" ref={printRef}>

          {/* En-tête impression */}
          <div className="hidden print:block mb-6 border-b pb-4">
            <h1 className="text-3xl font-bold">{projet.nom}</h1>
            <div className="flex gap-3 mt-2">
              <span className={`px-2 py-1 text-xs rounded ${STATUS_COLORS[projet.statut] || ''}`}>{STATUS_LABELS[projet.statut]}</span>
              <span className={`px-2 py-1 text-xs rounded capitalize ${PRIORITY_COLORS[projet.priorite] || ''}`}>{projet.priorite}</span>
            </div>
            <p className="text-sm text-gray-500 mt-1">Fiche générée le {new Date().toLocaleDateString('fr-FR')}</p>
          </div>

          {/* ① Informations générales */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span className="w-7 h-7 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-bold">1</span>
              Informations générales
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              <Field
                label="Nom du projet"
                value={projet.nom}
                editComponent={<input type="text" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />}
              />
              <Field
                label="Type de projet"
                value={projet.type}
                editComponent={
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                    <option value="interne">Interne</option>
                    <option value="client">Client</option>
                    <option value="communautaire">Communautaire</option>
                  </select>
                }
              />
              {(editing ? form.type === 'client' : projet.type === 'client') && (
                <Field
                  label="Nom du client"
                  value={projet.nomClient}
                  editComponent={<input type="text" value={form.nomClient} onChange={(e) => setForm({ ...form, nomClient: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder="Nom de l'entreprise" />}
                />
              )}
              <Field
                label="Date de début"
                value={projet.dateDebut ? new Date(projet.dateDebut).toLocaleDateString('fr-FR') : '—'}
                editComponent={<input type="date" value={form.dateDebut} onChange={(e) => setForm({ ...form, dateDebut: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />}
              />
              <Field
                label="Date de fin prévue"
                value={projet.dateFinPrevue ? new Date(projet.dateFinPrevue).toLocaleDateString('fr-FR') : '—'}
                editComponent={<input type="date" value={form.dateFinPrevue} onChange={(e) => setForm({ ...form, dateFinPrevue: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />}
              />
              <Field
                label="Statut"
                value={STATUS_LABELS[projet.statut] || projet.statut}
                editComponent={
                  <select value={form.statut} onChange={(e) => setForm({ ...form, statut: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                    <option value="en_preparation">En préparation</option>
                    <option value="en_cours">En cours</option>
                    <option value="termine">Terminé</option>
                    <option value="en_pause">En pause</option>
                  </select>
                }
              />
              <Field
                label="Priorité"
                value={projet.priorite}
                editComponent={
                  <select value={form.priorite} onChange={(e) => setForm({ ...form, priorite: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                    <option value="haute">Haute</option>
                    <option value="moyenne">Moyenne</option>
                    <option value="basse">Basse</option>
                  </select>
                }
              />
            </div>
          </div>

          {/* ② Gouvernance */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span className="w-7 h-7 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-sm font-bold">2</span>
              Gouvernance du projet
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <UserMultiSelect field="sponsorIds" label="Sponsor / Superviseur" />
              <UserMultiSelect field="chefProjetIds" label="Chef de projet / PMO" />
              <UserMultiSelect field="techLeadIds" label="Tech Lead" />
              <UserMultiSelect field="equipeIds" label="Équipe projet / Intervenants" />
            </div>

            {/* Parties prenantes */}
            <div className="mt-5">
              <label className="block text-sm font-medium text-gray-700 mb-2">Parties prenantes (Stakeholders)</label>
              {partiesPrenantes.length > 0 ? (
                <div className="space-y-2 mb-3">
                  {partiesPrenantes.map((pp, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded text-xs">{pp.type}</span>
                      <span className="text-sm text-gray-700">{pp.nom}</span>
                      {editing && (
                        <button onClick={() => removePartie(idx)} className="text-red-400 hover:text-red-600 text-xs ml-auto">✕</button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic mb-3">Aucune partie prenante</p>
              )}
              {editing && (
                <div className="flex gap-2 mt-2">
                  <select value={newPartie.type} onChange={(e) => setNewPartie({ ...newPartie, type: e.target.value })} className="px-2 py-1 border border-gray-300 rounded text-sm">
                    {PARTIES_PRENANTES_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                  <input type="text" value={newPartie.nom} onChange={(e) => setNewPartie({ ...newPartie, nom: e.target.value })} placeholder="Nom / Description" className="flex-1 px-3 py-1 border border-gray-300 rounded text-sm" onKeyDown={(e) => e.key === 'Enter' && addPartie()} />
                  <button onClick={addPartie} className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">Ajouter</button>
                </div>
              )}
            </div>
          </div>

          {/* ③ Contexte et description */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span className="w-7 h-7 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-sm font-bold">3</span>
              Contexte et description
            </h2>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Contexte du projet</label>
                {editing ? (
                  <textarea value={form.contexte} onChange={(e) => setForm({ ...form, contexte: e.target.value })} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder="Décrivez le contexte..." />
                ) : (
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">{projet.contexte || <span className="italic text-gray-400">—</span>}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Mission — Pourquoi ce projet existe</label>
                {editing ? (
                  <textarea value={form.mission} onChange={(e) => setForm({ ...form, mission: e.target.value })} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder="Quelle est la mission de ce projet ?" />
                ) : (
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">{projet.mission || <span className="italic text-gray-400">—</span>}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Vision — Résultat ou impact attendu</label>
                {editing ? (
                  <textarea value={form.vision} onChange={(e) => setForm({ ...form, vision: e.target.value })} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder="Quel est l'impact visé ?" />
                ) : (
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">{projet.vision || <span className="italic text-gray-400">—</span>}</p>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">✅ Scope — Ce qui est inclus</label>
                  {editing ? (
                    <textarea value={form.scopeInclus} onChange={(e) => setForm({ ...form, scopeInclus: e.target.value })} rows={4} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder="Ce qui est dans le périmètre..." />
                  ) : (
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">{projet.scopeInclus || <span className="italic text-gray-400">—</span>}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">❌ Scope — Ce qui est exclu</label>
                  {editing ? (
                    <textarea value={form.scopeExclus} onChange={(e) => setForm({ ...form, scopeExclus: e.target.value })} rows={4} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder="Ce qui est hors périmètre..." />
                  ) : (
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">{projet.scopeExclus || <span className="italic text-gray-400">—</span>}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ④ Objectifs */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span className="w-7 h-7 bg-orange-100 text-orange-700 rounded-full flex items-center justify-center text-sm font-bold">4</span>
              Objectifs du projet
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Objectifs stratégiques */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Objectifs stratégiques</label>
                {objectifsStrategiques.length > 0 ? (
                  <ul className="space-y-1 mb-3">
                    {objectifsStrategiques.map((obj, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <span className="text-blue-500 mt-0.5">•</span>
                        <span className="flex-1 text-gray-700">{obj}</span>
                        {editing && <button onClick={() => setObjectifsStrategiques(objectifsStrategiques.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 text-xs">✕</button>}
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-gray-400 italic mb-3">Aucun objectif stratégique</p>}
                {editing && (
                  <div className="flex gap-2">
                    <input type="text" value={newObjStrat} onChange={(e) => setNewObjStrat(e.target.value)} placeholder="Ajouter un objectif..." className="flex-1 px-3 py-1 border border-gray-300 rounded text-sm" onKeyDown={(e) => e.key === 'Enter' && addObjStrat()} />
                    <button onClick={addObjStrat} className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">+</button>
                  </div>
                )}
              </div>

              {/* Objectifs opérationnels */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Objectifs opérationnels</label>
                {objectifsOperationnels.length > 0 ? (
                  <ul className="space-y-1 mb-3">
                    {objectifsOperationnels.map((obj, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <span className="text-green-500 mt-0.5">•</span>
                        <span className="flex-1 text-gray-700">{obj}</span>
                        {editing && <button onClick={() => setObjectifsOperationnels(objectifsOperationnels.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 text-xs">✕</button>}
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-gray-400 italic mb-3">Aucun objectif opérationnel</p>}
                {editing && (
                  <div className="flex gap-2">
                    <input type="text" value={newObjOp} onChange={(e) => setNewObjOp(e.target.value)} placeholder="Ajouter un objectif..." className="flex-1 px-3 py-1 border border-gray-300 rounded text-sm" onKeyDown={(e) => e.key === 'Enter' && addObjOp()} />
                    <button onClick={addObjOp} className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">+</button>
                  </div>
                )}
              </div>
            </div>

            {/* KPIs */}
            <div className="mt-5">
              <label className="block text-sm font-medium text-gray-700 mb-2">Indicateurs de succès (KPI)</label>
              {kpis.length > 0 ? (
                <div className="flex flex-wrap gap-2 mb-3">
                  {kpis.map((kpi, idx) => (
                    <span key={idx} className="flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                      📊 {kpi}
                      {editing && <button onClick={() => setKpis(kpis.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 ml-1 text-xs">✕</button>}
                    </span>
                  ))}
                </div>
              ) : <p className="text-sm text-gray-400 italic mb-3">Aucun KPI défini</p>}
              {editing && (
                <div className="flex gap-2">
                  <input type="text" value={newKpi} onChange={(e) => setNewKpi(e.target.value)} placeholder="Ex: Réduire le temps de traitement de 30%" className="flex-1 px-3 py-1 border border-gray-300 rounded text-sm" onKeyDown={(e) => e.key === 'Enter' && addKpi()} />
                  <button onClick={addKpi} className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">Ajouter</button>
                </div>
              )}
            </div>
          </div>

        </div>{/* fin print-zone */}
      </div>
    </>
  );
}
