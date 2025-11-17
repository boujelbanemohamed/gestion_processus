import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth';
import { api } from '../services/api';

interface KPIs {
  processus: {
    total: number;
    parStatut: Record<string, number>;
  };
  projets: {
    actifs: number;
  };
  documentsRecents: any[];
  utilisateursActifs: number;
  entitesTotal: number;
  entitesMembres?: Array<{ id: string; nom: string; code?: string; _count: { membres: number } }>;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    loadKPIs();
  }, []);

  const loadKPIs = async () => {
    try {
      const response = await api.get('/dashboard');
      setKpis(response.data);
    } catch (error) {
      console.error('Erreur chargement KPIs:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-6">Chargement...</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <button
          type="button"
          onClick={() => navigate('/processus')}
          className="bg-white p-4 rounded-lg shadow text-left hover:bg-blue-50 transition"
          title="Aller à la liste des processus"
        >
          <div className="text-sm text-blue-600">Processus total</div>
          <div className="text-2xl font-bold text-blue-600">{kpis?.processus.total || 0}</div>
        </button>
        <button
          type="button"
          onClick={() => navigate('/entites')}
          className="bg-white p-4 rounded-lg shadow text-left hover:bg-blue-50 transition"
          title="Aller à la liste des entités"
        >
          <div className="text-sm text-blue-600">Entités</div>
          <div className="text-2xl font-bold text-blue-600">{kpis?.entitesTotal || 0}</div>
        </button>
        <button
          type="button"
          onClick={() => isAdmin && navigate('/users')}
          disabled={!isAdmin}
          className={`p-4 rounded-lg shadow text-left transition ${isAdmin ? 'bg-white hover:bg-blue-50 cursor-pointer' : 'bg-gray-100 cursor-not-allowed'}`}
          title={isAdmin ? 'Aller à la liste des utilisateurs' : "Accès réservé à l'administrateur"}
        >
          <div className={`text-sm ${isAdmin ? 'text-blue-600' : 'text-gray-600'}`}>Utilisateurs actifs</div>
          <div className={`text-2xl font-bold ${isAdmin ? 'text-blue-600' : 'text-gray-600'}`}>{kpis?.utilisateursActifs || 0}</div>
        </button>
        <button
          type="button"
          onClick={() => navigate('/documents')}
          className="bg-white p-4 rounded-lg shadow text-left hover:bg-blue-50 transition"
          title="Aller à la liste des documents"
        >
          <div className="text-sm text-blue-600">Documents récents</div>
          <div className="text-2xl font-bold text-blue-600">{kpis?.documentsRecents.length || 0}</div>
        </button>
      </div>

      {kpis && Object.keys(kpis.processus.parStatut).length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">Processus par statut</h2>
            <div className="space-y-2">
              {Object.entries(kpis.processus.parStatut).map(([statut, count]) => (
                <button
                  key={statut}
                  type="button"
                  onClick={() => navigate(`/processus?statut=${encodeURIComponent(statut)}`)}
                  className="w-full flex justify-between items-center px-3 py-2 rounded hover:bg-blue-50 transition capitalize text-left text-blue-600 hover:underline"
                  title={`Voir les processus avec le statut ${statut}`}
                >
                  <span>{statut.replace('_', ' ')}</span>
                  <span className="font-bold">{count}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Camembert des statuts */}
          <div className="bg-white p-4 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">Répartition des statuts (en %)</h2>
            <PieChart parStatut={kpis.processus.parStatut} />
          </div>
        </div>
      )}

      {kpis?.entitesMembres && kpis.entitesMembres.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">Membres par entité</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="text-left text-xs text-gray-500 uppercase">
                    <th className="py-2 pr-4">Entité</th>
                    <th className="py-2">Membres</th>
                  </tr>
                </thead>
                <tbody>
                  {kpis.entitesMembres
                    .slice()
                    .sort((a, b) => b._count.membres - a._count.membres)
                    .slice(0, 10)
                    .map((e) => (
                      <tr key={e.id} className="border-t">
                        <td className="py-2 pr-4 text-sm">{e.nom}{e.code ? ` (${e.code})` : ''}</td>
                        <td className="py-2 text-sm font-semibold">{e._count.membres}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {kpis.entitesMembres.length > 10 && (
              <p className="text-xs text-gray-500 mt-2">Affichage des 10 premières entités (triées par nombre de membres)</p>
            )}
          </div>

          <div className="bg-white p-4 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">Répartition des membres par entité (en %)</h2>
            <PieChartMembers entites={kpis.entitesMembres} />
          </div>
        </div>
      )}
    </div>
  );
}

// Composant local: camembert SVG sans dépendance
function PieChart({ parStatut }: { parStatut: Record<string, number> }) {
  const entries = Object.entries(parStatut);
  const total = entries.reduce((sum, [, c]) => sum + (c as number), 0) || 1;

  // Couleurs par statut (alignées avec l'app)
  const colorByStatut: Record<string, string> = {
    brouillon: '#9CA3AF', // gray-400
    en_revision: '#F59E0B', // amber-500
    valide: '#2563EB', // blue-600
    actif: '#16A34A', // green-600
    archive: '#7C3AED', // violet-600
    obsolete: '#DC2626', // red-600
  };

  // Génération des arcs
  let cumulative = 0;
  const radius = 70;
  const cx = 90;
  const cy = 90;

  const slices = entries.map(([statut, count]) => {
    const value = (count as number);
    const fraction = value / total;
    const startAngle = cumulative * 2 * Math.PI;
    const endAngle = (cumulative + fraction) * 2 * Math.PI;
    cumulative += fraction;

    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy + radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(endAngle);
    const y2 = cy + radius * Math.sin(endAngle);
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;

    const pathData = [
      `M ${cx} ${cy}`,
      `L ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
      'Z',
    ].join(' ');

    const color = colorByStatut[statut] || '#6B7280';
    const percent = Math.round((value / total) * 100);

    return { statut, value, percent, color, pathData };
  });

  return (
    <div className="flex items-center gap-6">
      <svg width={180} height={180} viewBox="0 0 180 180" role="img" aria-label="Camembert des statuts">
        <circle cx={cx} cy={cy} r={radius} fill="#F3F4F6" />
        {slices.map((s) => (
          <path key={s.statut} d={s.pathData} fill={s.color} />
        ))}
        {/* Cercle central pour effet donut léger */}
        <circle cx={cx} cy={cy} r={40} fill="#FFFFFF" />
      </svg>
      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
        {slices.map((s) => (
          <div key={s.statut} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: s.color }} />
              <span className="text-sm capitalize">{s.statut.replace('_', ' ')}</span>
            </div>
            <span className="text-sm font-semibold">{s.percent}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PieChartMembers({ entites }: { entites: Array<{ id: string; nom: string; code?: string; _count: { membres: number } }> }) {
  if (!entites || entites.length === 0) return null;
  const sorted = entites.slice().sort((a, b) => b._count.membres - a._count.membres);
  const top = sorted.slice(0, 8);
  const others = sorted.slice(8);
  const items = top.map(e => ({ label: `${e.nom}${e.code ? ` (${e.code})` : ''}`, value: e._count.membres }));
  const othersSum = others.reduce((s, e) => s + e._count.membres, 0);
  if (othersSum > 0) items.push({ label: 'Autres', value: othersSum });

  const total = items.reduce((s, it) => s + it.value, 0) || 1;
  let cumulative = 0;
  const radius = 70;
  const cx = 90;
  const cy = 90;

  const palette = ['#2563EB','#16A34A','#F59E0B','#7C3AED','#DC2626','#059669','#9333EA','#EA580C','#0EA5E9'];

  const slices = items.map((it, idx) => {
    const fraction = it.value / total;
    const startAngle = cumulative * 2 * Math.PI;
    const endAngle = (cumulative + fraction) * 2 * Math.PI;
    cumulative += fraction;

    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy + radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(endAngle);
    const y2 = cy + radius * Math.sin(endAngle);
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
    const pathData = [`M ${cx} ${cy}`, `L ${x1} ${y1}`, `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`, 'Z'].join(' ');
    const percent = Math.round(fraction * 100);
    const color = palette[idx % palette.length];
    return { label: it.label, percent, color, pathData };
  });

  return (
    <div className="flex items-center gap-6">
      <svg width={180} height={180} viewBox="0 0 180 180" role="img" aria-label="Camembert membres par entité">
        <circle cx={cx} cy={cy} r={radius} fill="#F3F4F6" />
        {slices.map((s) => (
          <path key={s.label} d={s.pathData} fill={s.color} />
        ))}
        <circle cx={cx} cy={cy} r={40} fill="#FFFFFF" />
      </svg>
      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
        {slices.map((s) => (
          <div key={s.label} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: s.color }} />
              <span className="text-sm">{s.label}</span>
            </div>
            <span className="text-sm font-semibold">{s.percent}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
