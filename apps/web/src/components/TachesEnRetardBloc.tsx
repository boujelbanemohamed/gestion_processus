import { useNavigate } from 'react-router-dom';

export type TacheEnRetardItem = {
  id: string;
  nom: string;
  statut: string;
  dateFinPrevue: string | null;
  projet: { id: string; nom: string; codeProjet: string } | null;
  assignesUtilisateurs: Array<{ id: string; nom: string; prenom: string }>;
  assignesEntites: Array<{ id: string; nom: string; code: string | null }>;
};

type Props = {
  items: TacheEnRetardItem[];
  /** Sur la page Tâches : masquer le lien « Ouvrir la page Tâches » */
  hideFooterLink?: boolean;
  /** Si défini, clic sur le nom de la tâche (ex. ouvrir la modale sur la page Tâches) */
  onTacheClick?: (tacheId: string) => void;
};

export default function TachesEnRetardBloc({ items, hideFooterLink, onTacheClick }: Props) {
  const navigate = useNavigate();

  if (!items.length) return null;

  return (
    <div className="bg-white p-4 rounded-lg shadow mb-6 border-l-4 border-amber-500">
      <h2 className="text-lg font-semibold mb-1">Tâches en retard</h2>
      <p className="text-xs text-gray-500 mb-4">
        Jusqu&apos;à 10 tâches non finalisées (hors terminé / archivé) dont la date de fin prévue est dépassée, triées par échéance la plus ancienne.
      </p>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 uppercase border-b">
              <th className="py-2 pr-4">Tâche</th>
              <th className="py-2 pr-4">Projet</th>
              <th className="py-2 pr-4 whitespace-nowrap">Fin prévue</th>
              <th className="py-2 pr-4">Assignés</th>
              <th className="py-2">Entités</th>
            </tr>
          </thead>
          <tbody>
            {items.map((t) => {
              const projet = t.projet;
              return (
                <tr key={t.id} className="border-t border-gray-100 hover:bg-amber-50/40">
                  <td className="py-3 pr-4 align-top">
                    <button
                      type="button"
                      onClick={() => (onTacheClick ? onTacheClick(t.id) : navigate('/taches'))}
                      className="text-left font-medium text-blue-700 hover:underline"
                    >
                      {t.nom}
                    </button>
                    <div className="text-xs text-gray-500 capitalize mt-0.5">{t.statut.replace(/_/g, ' ')}</div>
                  </td>
                  <td className="py-3 pr-4 align-top text-gray-700">
                    {projet ? (
                      <button
                        type="button"
                        onClick={() => navigate(`/projets/${projet.id}`)}
                        className="text-left text-blue-700 hover:underline"
                      >
                        {projet.nom}
                        <span className="text-gray-500 font-normal"> ({projet.codeProjet})</span>
                      </button>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 align-top whitespace-nowrap text-amber-800 font-medium">
                    {t.dateFinPrevue
                      ? new Date(t.dateFinPrevue).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })
                      : '—'}
                  </td>
                  <td className="py-3 pr-4 align-top text-gray-700">
                    {t.assignesUtilisateurs.length > 0
                      ? t.assignesUtilisateurs.map((u) => `${u.prenom} ${u.nom}`).join(', ')
                      : '—'}
                  </td>
                  <td className="py-3 align-top text-gray-700">
                    {t.assignesEntites.length > 0
                      ? t.assignesEntites.map((e) => (e.code ? `${e.nom} (${e.code})` : e.nom)).join(', ')
                      : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!hideFooterLink && (
        <p className="text-xs text-gray-500 mt-3">
          <button type="button" onClick={() => navigate('/taches')} className="text-blue-600 hover:underline">
            Ouvrir la page Tâches
          </button>
        </p>
      )}
    </div>
  );
}
