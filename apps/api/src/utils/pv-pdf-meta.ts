export const PV_PDF_MAX_HTML_CHARS = 600_000;

export type PvPdfMeta = {
  titre: string;
  statutLabel: string;
  dateReunionLabel: string;
  participantUserLines: string[];
  participantClientLines: string[];
  liensProjets?: string;
  liensTaches?: string;
  liensUserStories?: string;
  liensEpics?: string;
  bodyHtml: string;
  generatedAt: Date;
};
