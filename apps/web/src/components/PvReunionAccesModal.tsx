import { useEffect, useState } from 'react';
import { api, API_BASE_URL } from '../services/api';

function clientFournisseurLabel(x: { nom?: string; type?: string } | null | undefined) {
  const n = String(x?.nom || '').trim();
  const t = x?.type ? ` (${x.type})` : '';
  return (n || '—') + t;
}

export type PvReunionAccesDetail = {
  ficheNom?: string;
  pvId?: string;
  canManagePermissions?: boolean;
  visibilityNote?: string;
  admins?: { id: string; nom: string; prenom: string; email?: string; role?: string }[];
  creator?: { id: string; nom: string; prenom: string; email?: string; role?: string } | null;
  modificationDelegues?: { userId?: string; user?: { id: string; nom: string; prenom: string; email?: string } }[];
  presentsUser?: { user?: { id: string; nom: string; prenom: string; email?: string } }[];
  presentsClientFournisseur?: { clientFournisseur?: { id: string; nom: string; type?: string } }[];
  document?: { id: string; nom?: string; fichierNomOriginal?: string } | null;
};

export function PvReunionAccesModal({
  open,
  onClose,
  pvId,
  titreFallback,
}: {
  open: boolean;
  onClose: () => void;
  pvId: string | null;
  titreFallback: string;
}) {
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<PvReunionAccesDetail | null>(null);

  useEffect(() => {
    if (!open || !pvId) {
      setDetail(null);
      return;
    }
    let cancel = false;
    setLoading(true);
    setDetail(null);
    api
      .get(`/pv-reunions/${pvId}/acces`)
      .then((r) => {
        if (cancel) return;
        const d = r.data as PvReunionAccesDetail;
        setDetail(d);
      })
      .catch(() => {
        if (!cancel) setDetail(null);
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [open, pvId]);

  if (!open) return null;

  const title = detail?.ficheNom || titreFallback;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-6">
      <div className="bg-white rounded-lg shadow-xl p-6 sm:p-8 w-full max-w-5xl max-h-[min(94vh,960px)] overflow-y-auto">
        <h3 className="text-xl font-semibold mb-2">Accès — {title}</h3>
        <p className="text-sm text-gray-600 mb-4 leading-relaxed">
          {detail?.visibilityNote ||
            'Chargement des règles de visibilité…'}
        </p>
        {detail && !detail.canManagePermissions && (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-md px-3 py-2 mb-4">
            Vous consultez cette synthèse en lecture seule. Pour modifier les présents ou les délégués modification, un
            utilisateur habilité à modifier ce PV doit ouvrir la fiche en mode édition.
          </p>
        )}
        {loading ? (
          <p className="text-sm text-gray-500">Chargement…</p>
        ) : detail ? (
          <div className="space-y-5 text-sm">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Administrateurs actifs</p>
              <p className="text-xs text-gray-500 mb-2">
                Les comptes administrateur du produit ont accès à l’ensemble des PV (sous réserve du module « PV de
                réunion »).
              </p>
              <ul className="space-y-2 text-gray-700">
                {(detail.admins || []).map((a) => (
                  <li key={a.id} className="border border-gray-100 rounded-lg px-3 py-2">
                    <span className="font-medium">
                      {a.prenom} {a.nom}
                    </span>
                    {a.email && <span className="text-gray-500 ml-1">({a.email})</span>}
                  </li>
                ))}
                {(detail.admins || []).length === 0 && (
                  <li className="text-gray-400 italic">Aucun administrateur actif répertorié.</li>
                )}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Créateur</p>
              {detail.creator ? (
                <p>
                  <span className="font-medium">
                    {detail.creator.prenom} {detail.creator.nom}
                  </span>
                  {detail.creator.email && (
                    <span className="text-gray-500 ml-1">({detail.creator.email})</span>
                  )}
                </p>
              ) : (
                <p className="text-gray-400">—</p>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Délégués modification
              </p>
              <ul className="list-disc list-inside space-y-1">
                {(detail.modificationDelegues || []).map((d, i) => (
                  <li key={d.user?.id || d.userId || i}>
                    {d.user
                      ? `${d.user.prenom} ${d.user.nom}${d.user.email ? ` (${d.user.email})` : ''}`
                      : d.userId || '—'}
                  </li>
                ))}
                {(detail.modificationDelegues || []).length === 0 && (
                  <li className="text-gray-400 list-none italic">Aucun délégué (hors créateur / admins)</li>
                )}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Présents (utilisateurs)</p>
              <ul className="flex flex-wrap gap-2">
                {(detail.presentsUser || []).map((p, i) => (
                  <li
                    key={p.user?.id || i}
                    className="px-2 py-1 bg-gray-100 rounded text-xs"
                  >
                    {p.user ? `${p.user.prenom} ${p.user.nom}` : '—'}
                  </li>
                ))}
                {(detail.presentsUser || []).length === 0 && (
                  <li className="text-gray-400 italic list-none">Aucun</li>
                )}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Présents (clients / fournisseurs)
              </p>
              <ul className="flex flex-wrap gap-2">
                {(detail.presentsClientFournisseur || []).map((p, i) => (
                  <li key={p.clientFournisseur?.id || i} className="px-2 py-1 bg-amber-50 rounded text-xs">
                    {clientFournisseurLabel(p.clientFournisseur)}
                  </li>
                ))}
                {(detail.presentsClientFournisseur || []).length === 0 && (
                  <li className="text-gray-400 italic list-none">Aucun</li>
                )}
              </ul>
            </div>
            {detail.document?.id && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Document principal</p>
                <a
                  href={`${API_BASE_URL}/documents/${detail.document.id}/view?token=${localStorage.getItem('token')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {detail.document.nom || detail.document.fichierNomOriginal}
                </a>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-red-600">Impossible de charger le détail des accès.</p>
        )}
        <div className="flex justify-end mt-6 pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
