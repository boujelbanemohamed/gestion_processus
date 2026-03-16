import { useState, useEffect } from 'react';
import { api } from '../services/api';

export default function OCR() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState<string | null>(null);
  const [scanningAll, setScanningAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<'scanner' | 'resultats' | 'recherche'>('scanner');
  const [filter, setFilter] = useState<'all' | 'traite' | 'non_traite'>('all');
  const [progress, setProgress] = useState({ done: 0, total: 0, actif: false });

  useEffect(() => { loadDocuments(); }, []);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const res = await api.get('/ocr/documents');
      setDocuments(res.data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const scanDocument = async (id: string) => {
    setScanning(id);
    try {
      await api.post(`/ocr/scan/${id}`);
      await loadDocuments();
    } catch (e: any) {
      alert('Erreur OCR: ' + (e?.response?.data?.error || e.message));
    }
    setScanning(null);
  };

  const scanAll = async () => {
    setScanningAll(true);
    try {
      const res = await api.post('/ocr/scan-all');
      const ids: string[] = res.data.ids || [];
      if (ids.length === 0) { alert('Tous les documents sont déjà traités !'); setScanningAll(false); return; }
      setProgress({ done: 0, total: ids.length, actif: true });
      for (let i = 0; i < ids.length; i++) {
        try { await api.post(`/ocr/scan/${ids[i]}`); } catch (e) { /* continuer */ }
        setProgress({ done: i + 1, total: ids.length, actif: true });
      }
      await loadDocuments();
      setProgress({ done: 0, total: 0, actif: false });
    } catch (e: any) { alert('Erreur: ' + e.message); }
    setScanningAll(false);
  };

  const search = async () => {
    if (searchQuery.trim().length < 2) return;
    setSearching(true);
    try {
      const res = await api.get(`/ocr/search?q=${encodeURIComponent(searchQuery)}`);
      setSearchResults(res.data.results || []);
      setActiveTab('resultats');
    } catch (e: any) { alert('Erreur recherche: ' + e.message); }
    setSearching(false);
  };

  const filteredDocs = documents.filter(d => {
    if (filter === 'traite') return d.ocrTraite;
    if (filter === 'non_traite') return !d.ocrTraite;
    return true;
  });

  const traites = documents.filter(d => d.ocrTraite).length;
  const nonTraites = documents.filter(d => !d.ocrTraite).length;

  const getFileIcon = (type: string) => {
    if (type?.includes('pdf')) return '📕';
    if (type?.includes('image')) return '🖼️';
    if (type?.includes('word')) return '📘';
    return '📄';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🔍 OCR — Reconnaissance de texte</h1>
          <p className="text-sm text-gray-500 mt-1">Extrayez et recherchez le contenu textuel de vos documents</p>
        </div>
        <button onClick={scanAll} disabled={scanningAll || nonTraites === 0}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium disabled:opacity-50 flex items-center gap-2">
          {scanningAll ? '⏳ Traitement en cours...' : `⚡ Tout scanner (${nonTraites} restants)`}
        </button>
      </div>

      {/* Barre de progression */}
      {progress.actif && (
        <div className="mb-4 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
          <div className="flex justify-between text-sm text-indigo-700 mb-1">
            <span>⏳ Traitement en cours...</span>
            <span>{progress.done} / {progress.total}</span>
          </div>
          <div className="w-full bg-indigo-200 rounded-full h-2">
            <div className="bg-indigo-600 h-2 rounded-full transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-gray-800">{documents.length}</div>
          <div className="text-xs text-gray-500 mt-1">Total documents</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-700">{traites}</div>
          <div className="text-xs text-green-600 mt-1">✅ Traités</div>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-orange-700">{nonTraites}</div>
          <div className="text-xs text-orange-600 mt-1">⏳ En attente</div>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex border-b border-gray-200 mb-5">
        {[{ key: 'scanner', label: '📋 Scanner' }, { key: 'resultats', label: `🔎 Résultats (${searchResults.length})` }, { key: 'recherche', label: '🔍 Recherche plein texte' }].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Onglet Scanner */}
      {activeTab === 'scanner' && (
        <div>
          <div className="flex gap-3 mb-4">
            {[{ v: 'all', l: 'Tous' }, { v: 'traite', l: '✅ Traités' }, { v: 'non_traite', l: '⏳ Non traités' }].map(f => (
              <button key={f.v} onClick={() => setFilter(f.v as any)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${filter === f.v ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {f.l}
              </button>
            ))}
          </div>
          {loading ? <div className="text-center py-10 text-gray-400">Chargement...</div> : (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Document</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut OCR</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date traitement</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aperçu</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredDocs.map(doc => (
                    <tr key={doc.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span>{getFileIcon(doc.fichierType)}</span>
                          <span className="font-medium text-gray-800 truncate max-w-48">{doc.nom}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{doc.typeDocument}</td>
                      <td className="px-4 py-3">
                        {doc.ocrTraite
                          ? <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">✅ Traité</span>
                          : <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">⏳ En attente</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {doc.ocrDate ? new Date(doc.ocrDate).toLocaleString('fr-FR') : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-48 truncate">
                        {doc.texteOcr ? doc.texteOcr.substring(0, 80) + '...' : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => scanDocument(doc.id)} disabled={scanning === doc.id}
                          className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 text-xs font-medium disabled:opacity-50">
                          {scanning === doc.id ? '⏳ Scan...' : doc.ocrTraite ? '🔄 Re-scanner' : '🔍 Scanner'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredDocs.length === 0 && <div className="text-center py-8 text-gray-400">Aucun document</div>}
            </div>
          )}
        </div>
      )}

      {/* Onglet Recherche */}
      {activeTab === 'recherche' && (
        <div>
          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">🔍 Recherche dans le contenu des documents</h2>
            <div className="flex gap-3">
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && search()}
                placeholder="Entrez un mot-clé (ex: contrat, facture, 2024...)"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />
              <button onClick={search} disabled={searching || searchQuery.trim().length < 2}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium disabled:opacity-50">
                {searching ? '⏳ Recherche...' : '🔍 Rechercher'}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">Supporte le français, l'anglais et l'arabe. Minimum 2 caractères.</p>
          </div>
        </div>
      )}

      {/* Onglet Résultats */}
      {activeTab === 'resultats' && (
        <div>
          {searchResults.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <div className="text-4xl mb-2">🔍</div>
              <p>Aucun résultat. Effectuez une recherche dans l'onglet "Recherche plein texte".</p>
            </div>
          ) : (
            <div className="space-y-3">
              {searchResults.map(doc => (
                <div key={doc.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span>{getFileIcon(doc.fichierType)}</span>
                      <span className="font-semibold text-gray-800">{doc.nom}</span>
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{doc.typeDocument}</span>
                    </div>
                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-medium">
                      {doc.occurrences} occurrence(s)
                    </span>
                  </div>
                  <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm text-gray-700 font-mono whitespace-pre-wrap">
                    {doc.extrait}
                  </div>
                  <div className="text-xs text-gray-400 mt-2">
                    Traité le {new Date(doc.ocrDate).toLocaleString('fr-FR')} • {doc.uploadedBy?.prenom} {doc.uploadedBy?.nom}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
