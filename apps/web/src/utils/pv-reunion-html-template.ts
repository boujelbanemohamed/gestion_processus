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
  ordreDuJourLines?: string[];
  pointsDiscutesText?: string;
  decisionsPrisesLines?: string[];
  risquesBlocagesText?: string;
  conclusionText?: string;
  actionsRows?: Array<{ action: string; responsable: string; dateLimite: string }>;
};

/** Structure type pour un procès-verbal (HTML compatible éditeur / export). */
export function buildStructuredPvHtml(ctx: PvTemplateContext): string {
  const t = escapeHtml(ctx.titre);
  const ordre = (ctx.ordreDuJourLines || []).map((x) => String(x || '').trim()).filter(Boolean);
  const decisions = (ctx.decisionsPrisesLines || []).map((x) => String(x || '').trim()).filter(Boolean);
  const points = String(ctx.pointsDiscutesText || '').trim();
  const risques = String(ctx.risquesBlocagesText || '').trim();
  const conclusion = String(ctx.conclusionText || '').trim();
  const actions = (ctx.actionsRows || [])
    .map((x) => ({
      action: String(x?.action || '').trim(),
      responsable: String(x?.responsable || '').trim(),
      dateLimite: String(x?.dateLimite || '').trim(),
    }))
    .filter((x) => x.action || x.responsable || x.dateLimite);

  const pointsHtml = points
    ? points
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => `<p>${escapeHtml(line)}</p>`)
        .join('')
    : '';
  const risquesHtml = risques
    ? risques
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => `<p>${escapeHtml(line)}</p>`)
        .join('')
    : '';
  const conclusionHtml = conclusion
    ? conclusion
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => `<p>${escapeHtml(line)}</p>`)
        .join('')
    : '';

  const actionsHtml = actions.length
    ? `
<h2>Actions à réaliser</h2>
<table>
<thead>
<tr><th>Action</th><th>Responsable</th><th>Date limite</th></tr>
</thead>
<tbody>
${actions
  .map(
    (a) =>
      `<tr><td>${escapeHtml(a.action || '—')}</td><td>${escapeHtml(a.responsable || '—')}</td><td>${escapeHtml(a.dateLimite || '—')}</td></tr>`
  )
  .join('')}
</tbody>
</table>`
    : '';

  return `
<h2>Informations générales</h2>
<p><strong>Titre de la réunion :</strong> ${t}</p>
<p><strong>Date :</strong> ${escapeHtml(ctx.dateReunionLabel)}</p>
<p><strong>Statut :</strong> ${escapeHtml(ctx.statutLabel)}</p>

<h2>Participants</h2>
<h3>Présents (utilisateurs)</h3>
<ul>${linesToUl(ctx.usersLines)}</ul>
<h3>Présents (clients / fournisseurs)</h3>
<ul>${linesToUl(ctx.cfLines)}</ul>

${ordre.length ? `<h2>Ordre du jour</h2><ol>${linesToUl(ordre)}</ol>` : ''}
${pointsHtml ? `<h2>Points discutés</h2>${pointsHtml}` : ''}
${decisions.length ? `<h2>Décisions prises</h2><ol>${linesToUl(decisions)}</ol>` : ''}
${actionsHtml}
${risquesHtml ? `<h2>Risques / blocages</h2>${risquesHtml}` : ''}
${conclusionHtml ? `<h2>Conclusion</h2>${conclusionHtml}` : ''}
${(() => {
  const parts: string[] = [];
  if (ctx.projetsLines.length)
    parts.push(`<p><strong>Projets :</strong> ${escapeHtml(ctx.projetsLines.join(' ; '))}</p>`);
  if (ctx.tachesLines.length)
    parts.push(`<p><strong>Tâches :</strong> ${escapeHtml(ctx.tachesLines.join(' ; '))}</p>`);
  if (ctx.userStoriesLines.length)
    parts.push(`<p><strong>User stories :</strong> ${escapeHtml(ctx.userStoriesLines.join(' ; '))}</p>`);
  if (ctx.epicsLines.length)
    parts.push(`<p><strong>Epics :</strong> ${escapeHtml(ctx.epicsLines.join(' ; '))}</p>`);
  if (!parts.length) return '';
  return `\n<h2>Rattachements (référence)</h2>\n${parts.join('\n')}`;
})()}
`.trim();
}
