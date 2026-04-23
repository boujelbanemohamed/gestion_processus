import { useMemo, useState } from 'react';
import { api } from '../services/api';

type ProjectOption = { id: string; nom: string; codeProjet?: string | null };
type UserOption = { id: string; nom: string; prenom: string; email?: string | null };
type ClientFournisseurOption = { id: string; nom: string; type: string };

type CsvRow = Record<string, string>;
type ImportError = { line: number; field: string; message: string };

function norm(v: unknown) {
  return String(v || '').trim();
}

function detectDelimiter(sample: string): string {
  const first = sample.split(/\r?\n/).find((l) => l.trim().length > 0) || '';
  const candidates = [',', ';', '\t'];
  let best = ',';
  let bestCount = -1;
  for (const d of candidates) {
    const c = first.split(d).length - 1;
    if (c > bestCount) {
      bestCount = c;
      best = d;
    }
  }
  return best;
}

function parseCsv(content: string): CsvRow[] {
  const delimiter = detectDelimiter(content);
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  if (lines.length === 0) return [];
  const headers = lines[0].split(delimiter).map((h) => norm(h).toLowerCase());
  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;
    const cells = line.split(delimiter);
    const row: CsvRow = {};
    headers.forEach((h, idx) => {
      row[h] = norm(cells[idx] ?? '');
    });
    rows.push(row);
  }
  return rows;
}

const REQUIRED_HEADERS = ['projet', 'epic', 'user_story', 'tache'];

function splitList(value: string): string[] {
  return norm(value)
    .split(/[;,]/)
    .map((v) => norm(v))
    .filter(Boolean);
}

function csvTemplate(): string {
  return [
    'projet,epic,epic_description,user_story,tache,tache_description,statut,priorite,complexite,date_debut,date_fin_prevue,assignes_utilisateurs,assignes_clients_fournisseurs',
    'Migration ERP,Epic Facturation,"Refonte complete du flux de facturation",US Saisie facture,Tâche Créer écran facture,"Créer l ecran de saisie facture",a_faire,haute,moyenne,2026-05-01,2026-05-10,"prenom1 nom1;prenom2 nom2","Client ABC;Fournisseur XYZ"',
    'Migration ERP,Epic Facturation,"Refonte complete du flux de facturation",US Saisie facture,Tâche Validation facture,"Ajouter les regles de validation",en_cours,moyenne,moyenne,2026-05-03,2026-05-12,"user-id-1","client-id-1;client-id-2"',
    'Migration ERP,Epic Facturation,"Refonte complete du flux de facturation",US Saisie facture,Tâche Initialisation,,cree,moyenne,basse,,,,',
    'Migration ERP,Epic Facturation,"Refonte complete du flux de facturation",US Saisie facture,Tâche En attente,,en_attente,moyenne,moyenne,,,,',
    'Migration ERP,Epic Facturation,"Refonte complete du flux de facturation",US Saisie facture,Tâche Bloquée,,bloque,haute,haute,,,,',
    'Migration ERP,Epic Facturation,"Refonte complete du flux de facturation",US Saisie facture,Tâche Finalisée,,termine,basse,basse,,,,',
    'Migration ERP,Epic Facturation,"Refonte complete du flux de facturation",US Saisie facture,Tâche Archivée,,archive,basse,basse,,,,',
    'Migration ERP,Epic Facturation,"Refonte complete du flux de facturation",US Export facture,,,basse,basse,,,,',
    'Migration ERP,Epic Reporting,"Regrouper les KPIs et tableaux de bord",,,,,,,,,',
  ].join('\n');
}

export default function BulkAgileCsvImportModal({
  projects,
  users,
  clientsFournisseurs,
}: {
  projects: ProjectOption[];
  users: UserOption[];
  clientsFournisseurs: ClientFournisseurOption[];
}) {
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [errors, setErrors] = useState<ImportError[]>([]);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ epics: number; userStories: number; taches: number } | null>(null);

  const projectMap = useMemo(() => {
    const m = new Map<string, ProjectOption[]>();
    projects.forEach((p) => {
      const keys = [norm(p.nom).toLowerCase(), p.id.toLowerCase()];
      if (p.codeProjet) keys.push(norm(p.codeProjet).toLowerCase());
      keys.forEach((k) => {
        const prev = m.get(k) || [];
        prev.push(p);
        m.set(k, prev);
      });
    });
    return m;
  }, [projects]);

  const resolveProject = (rawValue: string): { project: ProjectOption | null; error?: string } => {
    const token = norm(rawValue).toLowerCase();
    if (!token) return { project: null, error: 'Projet requis.' };
    const matches = projectMap.get(token) || [];
    if (matches.length === 0) {
      return { project: null, error: `Projet introuvable: "${rawValue}" (nom, code ou id attendu).` };
    }
    if (matches.length > 1) {
      return {
        project: null,
        error:
          `Projet ambigu pour "${rawValue}" (${matches.length} correspondances). ` +
          'Utilisez un identifiant projet unique (id ou code projet unique).',
      };
    }
    return { project: matches[0] };
  };

  const userMap = useMemo(() => {
    const m = new Map<string, UserOption>();
    users.forEach((u) => {
      m.set(u.id.toLowerCase(), u);
      const fullA = `${norm(u.prenom)} ${norm(u.nom)}`.toLowerCase();
      const fullB = `${norm(u.nom)} ${norm(u.prenom)}`.toLowerCase();
      if (fullA) m.set(fullA, u);
      if (fullB) m.set(fullB, u);
      if (u.email) m.set(norm(u.email).toLowerCase(), u);
    });
    return m;
  }, [users]);

  const clientFournisseurMap = useMemo(() => {
    const m = new Map<string, ClientFournisseurOption>();
    clientsFournisseurs.forEach((c) => {
      m.set(c.id.toLowerCase(), c);
      m.set(norm(c.nom).toLowerCase(), c);
    });
    return m;
  }, [clientsFournisseurs]);

  const downloadTemplate = () => {
    const blob = new Blob([csvTemplate()], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_import_agile.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const validateRows = (parsedRows: CsvRow[]) => {
    const errs: ImportError[] = [];
    if (parsedRows.length === 0) {
      errs.push({ line: 1, field: 'fichier', message: 'Le fichier est vide.' });
      return errs;
    }
    const headers = Object.keys(parsedRows[0] || {});
    for (const h of REQUIRED_HEADERS) {
      if (!headers.includes(h)) {
        errs.push({ line: 1, field: h, message: `Colonne manquante: ${h}` });
      }
    }
    parsedRows.forEach((row, idx) => {
      const line = idx + 2;
      const projetRaw = norm(row.projet || row.projet_id || '');
      const epic = norm(row.epic || '');
      const us = norm(row.user_story || '');
      const tache = norm(row.tache || '');

      const projectResolution = resolveProject(projetRaw);
      if (!projectResolution.project) {
        errs.push({
          line,
          field: 'projet',
          message: projectResolution.error || 'Projet invalide.',
        });
      }
      if (!epic) errs.push({ line, field: 'epic', message: 'Epic requis.' });
      if (tache && !us) {
        errs.push({
          line,
          field: 'user_story',
          message: 'user_story requis si tache est renseignée.',
        });
      }
      const rawUsers = splitList(row.assignes_utilisateurs || '');
      rawUsers.forEach((token) => {
        if (!userMap.get(token.toLowerCase())) {
          errs.push({
            line,
            field: 'assignes_utilisateurs',
            message: `Utilisateur introuvable: "${token}" (id, nom prenom ou email).`,
          });
        }
      });
      const rawClients = splitList(row.assignes_clients_fournisseurs || '');
      rawClients.forEach((token) => {
        if (!clientFournisseurMap.get(token.toLowerCase())) {
          errs.push({
            line,
            field: 'assignes_clients_fournisseurs',
            message: `Client/Fournisseur introuvable: "${token}" (id ou nom).`,
          });
        }
      });
    });
    return errs;
  };

  const onFileChange = async (file?: File | null) => {
    setResult(null);
    setErrors([]);
    setRows([]);
    if (!file) {
      setFileName('');
      return;
    }
    setFileName(file.name);
    const txt = await file.text();
    const parsed = parseCsv(txt);
    setRows(parsed);
    setErrors(validateRows(parsed));
  };

  const runImport = async () => {
    const preErrors = validateRows(rows);
    setErrors(preErrors);
    if (preErrors.length > 0) return;
    setRunning(true);
    setResult(null);

    const epicMap = new Map<string, string>();
    const usMap = new Map<string, string>();
    let createdEpics = 0;
    let createdUs = 0;
    let createdTaches = 0;
    const importErrors: ImportError[] = [];

    // Précharger les epics / user stories existants pour éviter les doublons globaux.
    const projectIds = [...new Set(
      rows
        .map((row) => {
          const projetRaw = norm(row.projet || row.projet_id || '');
          const resolved = resolveProject(projetRaw);
          return resolved.project?.id || '';
        })
        .filter(Boolean)
    )];
    for (const projetId of projectIds) {
      try {
        const [epicsRes, usRes] = await Promise.all([
          api.get('/epics', { params: { projetId } }),
          api.get('/user-stories', { params: { projetId } }),
        ]);
        const epics = Array.isArray(epicsRes.data) ? epicsRes.data : [];
        epics.forEach((e: any) => {
          const epicId = norm(e?.id);
          const epicNom = norm(e?.nom).toLowerCase();
          if (epicId && epicNom) {
            epicMap.set(`${projetId}::${epicNom}`, epicId);
          }
        });
        const userStories = Array.isArray(usRes.data) ? usRes.data : [];
        userStories.forEach((us: any) => {
          const usId = norm(us?.id);
          const usDesc = norm(us?.description).toLowerCase();
          const epicId = norm(us?.epicId || us?.epic?.id);
          if (usId && usDesc && epicId) {
            usMap.set(`${epicId}::${usDesc}`, usId);
          }
        });
      } catch (e: any) {
        importErrors.push({
          line: 1,
          field: 'api',
          message:
            `Préchargement des epics/user stories impossible pour le projet ${projetId}: ` +
            (e?.response?.data?.error || e?.message || 'Erreur API'),
        });
      }
    }
    if (importErrors.length > 0) {
      setErrors(importErrors);
      setRunning(false);
      return;
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const line = i + 2;
      try {
        const projetRaw = norm(row.projet || row.projet_id || '');
        const projectResolution = resolveProject(projetRaw);
        const project = projectResolution.project;
        if (!project) {
          importErrors.push({
            line,
            field: 'projet',
            message: projectResolution.error || `Projet introuvable: ${projetRaw}`,
          });
          continue;
        }
        const epicName = norm(row.epic);
        const epicDescription = row.epic_description || row.description_epic || null;
        const usDesc = norm(row.user_story);
        const tacheNom = norm(row.tache);
        const assignesUtilisateurIds = splitList(row.assignes_utilisateurs || '')
          .map((token) => userMap.get(token.toLowerCase())?.id || '')
          .filter(Boolean);
        const assignesClientFournisseurIds = splitList(row.assignes_clients_fournisseurs || '')
          .map((token) => clientFournisseurMap.get(token.toLowerCase())?.id || '')
          .filter(Boolean);

        const epicKey = `${project.id}::${epicName.toLowerCase()}`;
        let epicId = epicMap.get(epicKey);
        if (!epicId) {
          const { data } = await api.post('/epics', {
            nom: epicName,
            description: epicDescription,
            projetId: project.id,
          });
          const createdEpicId = norm(data?.id);
          if (!createdEpicId) {
            throw new Error("Création d'epic échouée: id manquant dans la réponse API.");
          }
          epicId = createdEpicId;
          epicMap.set(epicKey, epicId);
          createdEpics++;
        }

        let usId: string | null = null;
        if (usDesc) {
          const usKey = `${epicId}::${usDesc.toLowerCase()}`;
          usId = usMap.get(usKey) || null;
          if (!usId) {
            const { data } = await api.post('/user-stories', {
              description: usDesc,
              epicId,
            });
            const createdUsId = norm(data?.id);
            if (!createdUsId) {
              throw new Error("Création de user story échouée: id manquant dans la réponse API.");
            }
            usId = createdUsId;
            usMap.set(usKey, usId);
            createdUs++;
          }
        }

        if (tacheNom) {
          if (!usId) {
            importErrors.push({
              line,
              field: 'user_story',
              message: 'Impossible de créer la tâche sans user_story.',
            });
            continue;
          }
          await api.post('/taches', {
            nom: tacheNom,
            description: row.tache_description || null,
            statut: row.statut || 'cree',
            priorite: row.priorite || 'basse',
            complexite: row.complexite || 'basse',
            dateDebut: row.date_debut || null,
            dateFinApprox: row.date_fin_prevue || null,
            projetId: project.id,
            userStoryId: usId,
            assignesUtilisateurIds,
            assignesClientFournisseurIds,
          });
          createdTaches++;
        }
      } catch (e: any) {
        importErrors.push({
          line,
          field: 'api',
          message: e?.response?.data?.error || e?.message || 'Erreur import',
        });
      }
    }

    setErrors(importErrors);
    setResult({ epics: createdEpics, userStories: createdUs, taches: createdTaches });
    setRunning(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-3 py-2 rounded border border-indigo-300 text-sm text-indigo-700 hover:bg-indigo-50 font-medium"
      >
        ⬆ Import CSV (massif)
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-5 py-3 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">Import massif (Epic / User Story / Tâches)</h3>
              <button className="text-gray-500 hover:text-gray-700" onClick={() => setOpen(false)}>
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4 overflow-auto">
              <div className="flex flex-wrap gap-2 items-center">
                <button
                  type="button"
                  onClick={downloadTemplate}
                  className="px-3 py-2 rounded bg-slate-100 text-slate-800 text-sm hover:bg-slate-200"
                >
                  Télécharger le template CSV
                </button>
                <label className="px-3 py-2 rounded border border-gray-300 text-sm cursor-pointer hover:bg-gray-50">
                  Choisir un fichier CSV
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => void onFileChange(e.target.files?.[0] || null)}
                  />
                </label>
                <span className="text-sm text-gray-600">{fileName || 'Aucun fichier sélectionné'}</span>
              </div>

              {rows.length > 0 && (
                <div className="text-sm text-gray-700">
                  {rows.length} ligne(s) détectée(s). L’import crée les epics/user stories manquants puis les tâches et leurs assignations.
                </div>
              )}

              {result && (
                <div className="text-sm border border-green-200 bg-green-50 text-green-800 rounded p-3">
                  Import terminé. Créés: {result.epics} epic(s), {result.userStories} user story(ies), {result.taches} tâche(s).
                </div>
              )}

              {errors.length > 0 && (
                <div className="border border-red-200 bg-red-50 rounded p-3">
                  <p className="text-sm font-semibold text-red-800 mb-2">
                    {errors.length} erreur(s) à corriger avant réimport
                  </p>
                  <div className="max-h-60 overflow-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-red-900">
                          <th className="pr-3">Ligne</th>
                          <th className="pr-3">Champ</th>
                          <th>Message</th>
                        </tr>
                      </thead>
                      <tbody>
                        {errors.map((e, idx) => (
                          <tr key={`${e.line}-${idx}`} className="border-t border-red-100">
                            <td className="pr-3 py-1">{e.line}</td>
                            <td className="pr-3 py-1">{e.field}</td>
                            <td className="py-1">{e.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            <div className="px-5 py-3 border-t flex items-center justify-end gap-2">
              <button
                type="button"
                className="px-3 py-2 rounded border border-gray-300 text-sm"
                onClick={() => setOpen(false)}
              >
                Fermer
              </button>
              <button
                type="button"
                onClick={() => void runImport()}
                disabled={running || rows.length === 0}
                className="px-3 py-2 rounded bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                {running ? 'Import en cours...' : 'Lancer l’import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

