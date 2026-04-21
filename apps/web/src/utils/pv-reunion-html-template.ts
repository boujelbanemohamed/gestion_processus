function escapeHtml(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function linesToUl(lines: string[]): string {
  if (!lines.length) return '<li>—</li>';
  return lines.map((l) => `<li>${escapeHtml(l)}</li>`).join('');
}

export type PvTemplateContext = {
  titre: string;
  statutLabel: string;
  dateReunionLabel: string;
  usersLines: string[];
  cfLines: string[];
  projetsLines: string[];
  tachesLines: string[];
  userStoriesLines: string[];
  epicsLines: string[];
};

/** Structure type pour un procès-verbal (HTML compatible éditeur / export). */
export function buildStructuredPvHtml(ctx: PvTemplateContext): string {
  const t = escapeHtml(ctx.titre);
  return `
<h2>1. Informations générales</h2>
<p><strong>Titre de la réunion :</strong> ${t}</p>
<p><strong>Date :</strong> ${escapeHtml(ctx.dateReunionLabel)}</p>
<p><strong>Statut :</strong> ${escapeHtml(ctx.statutLabel)}</p>

<h2>2. Participants</h2>
<h3>Présents (utilisateurs)</h3>
<ul>${linesToUl(ctx.usersLines)}</ul>
<h3>Présents (clients / fournisseurs)</h3>
<ul>${linesToUl(ctx.cfLines)}</ul>

<h2>3. Ordre du jour</h2>
<p><em>À compléter…</em></p>

<h2>4. Points discutés</h2>
<p><em>À compléter…</em></p>

<h2>5. Décisions prises</h2>
<p><em>À compléter…</em></p>

<h2>6. Actions à réaliser</h2>
<table>
<thead>
<tr><th>Description</th><th>Responsable</th><th>Date de fin</th></tr>
</thead>
<tbody>
<tr><td><em>—</em></td><td><em>—</em></td><td><em>—</em></td></tr>
</tbody>
</table>

<h2>7. Risques / blocages</h2>
<p><em>À compléter…</em></p>

<h2>8. Conclusion</h2>
<p><em>À compléter…</em></p>

<h2>Rattachements (référence)</h2>
<p><strong>Projets :</strong> ${escapeHtml(ctx.projetsLines.join(' ; ') || '—')}</p>
<p><strong>Tâches :</strong> ${escapeHtml(ctx.tachesLines.join(' ; ') || '—')}</p>
<p><strong>User stories :</strong> ${escapeHtml(ctx.userStoriesLines.join(' ; ') || '—')}</p>
<p><strong>Epics :</strong> ${escapeHtml(ctx.epicsLines.join(' ; ') || '—')}</p>
`.trim();
}
