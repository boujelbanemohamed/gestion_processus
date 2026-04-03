import { prisma } from '../utils/prisma';
import nodemailer from 'nodemailer';

export class NotificationService {

  // ── SMTP helper (même pattern que PasswordResetService) ───────────────────
  private async getActiveSMTP() {
    const smtp = await prisma.sMTPConfig.findFirst({ where: { isActive: true } });
    if (!smtp) return null;
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: { user: smtp.user, pass: smtp.password },
    });
    return { smtp, transporter };
  }

  // ── Créer une notification in-app ─────────────────────────────────────────
  async createNotification(data: {
    userId: string;
    type: string;
    titre: string;
    contenu: string;
    lienType?: string;
    lienId?: string;
  }) {
    return (prisma as any).notification.create({ data });
  }

  // ── Récupérer les notifications d'un utilisateur ──────────────────────────
  async getNotifications(userId: string) {
    return (prisma as any).notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  // ── Marquer une notification comme lue ───────────────────────────────────
  async marquerLue(id: string, userId: string) {
    return (prisma as any).notification.updateMany({
      where: { id, userId },
      data: { lue: true },
    });
  }

  // ── Marquer toutes comme lues ─────────────────────────────────────────────
  async marquerToutesLues(userId: string) {
    return (prisma as any).notification.updateMany({
      where: { userId, lue: false },
      data: { lue: true },
    });
  }

  // ── Compter les non lues ──────────────────────────────────────────────────
  async countNonLues(userId: string) {
    return (prisma as any).notification.count({
      where: { userId, lue: false },
    });
  }

  // ── Envoyer email de mention ──────────────────────────────────────────────
  private libelleContexte(type: 'tache' | 'epic' | 'userStory'): { sujet: string; intro: string; libelle: string; cta: string } {
    if (type === 'epic') {
      return {
        sujet: 'epic',
        intro: 'vous a mentionné dans un commentaire sur l’epic :',
        libelle: '📗 Epic',
        cta: 'Voir les tâches →',
      };
    }
    if (type === 'userStory') {
      return {
        sujet: 'user story',
        intro: 'vous a mentionné dans un commentaire sur la user story :',
        libelle: '📘 User story',
        cta: 'Voir les tâches →',
      };
    }
    return {
      sujet: 'tâche',
      intro: 'vous a mentionné dans un commentaire de la tâche :',
      libelle: '📋',
      cta: 'Voir la tâche →',
    };
  }

  async envoyerEmailMention(data: {
    destinataireEmail: string;
    destinataireNom: string;
    auteurNom: string;
    commentaireContenu: string;
    appUrl: string;
    context: { type: 'tache' | 'epic' | 'userStory'; titre: string };
  }) {
    try {
      const smtpData = await this.getActiveSMTP();
      if (!smtpData) {
        console.log('[NOTIF] Pas de config SMTP active — email non envoyé');
        return;
      }
      const { smtp, transporter } = smtpData;
      const lien = `${data.appUrl}/taches`;
      const L = this.libelleContexte(data.context.type);

      await transporter.sendMail({
        from: `"${smtp.fromName || 'PMO Hub'}" <${smtp.fromEmail}>`,
        to: data.destinataireEmail,
        subject: `📌 Mention (${L.sujet}) : ${data.context.titre}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
              <h2 style="margin:0;">📌 Nouvelle mention</h2>
            </div>
            <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
              <p>Bonjour <strong>${data.destinataireNom}</strong>,</p>
              <p><strong>${data.auteurNom}</strong> ${L.intro}</p>
              <div style="background: white; border-left: 4px solid #2563eb; padding: 12px; margin: 16px 0; border-radius: 4px;">
                <p style="margin:0; font-weight: bold; color: #1d4ed8;">${L.libelle} ${data.context.titre}</p>
                <p style="margin: 8px 0 0; color: #374151; font-style: italic;">"${data.commentaireContenu}"</p>
              </div>
              <a href="${lien}" style="display: inline-block; background: #2563eb; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; margin-top: 8px;">
                ${L.cta}
              </a>
              <p style="color: #9ca3af; font-size: 12px; margin-top: 20px;">PMO Hub — Notification automatique</p>
            </div>
          </div>
        `,
      });
      console.log(`[NOTIF] Email mention envoyé à ${data.destinataireEmail}`);
    } catch (err) {
      console.error('[NOTIF] Erreur envoi email mention:', err);
    }
  }

  // ── Traiter les mentions dans un commentaire ──────────────────────────────
  // Extrait les @Prénom Nom du texte et notifie chaque personne trouvée
  async traiterMentions(data: {
    contenu: string;
    auteurId: string;
    auteurNom: string;
    appUrl: string;
    context: { type: 'tache' | 'epic' | 'userStory'; id: string; titre: string };
  }) {
    // Extraire les mentions @Prénom Nom (2 mots après @)
    const mentionRegex = /@([A-Za-zÀ-ÿ]+\s+[A-Za-zÀ-ÿ]+)/g;
    const mentions: string[] = [];
    let match;
    while ((match = mentionRegex.exec(data.contenu)) !== null) {
      mentions.push(match[1].trim());
    }

    if (mentions.length === 0) return;

    // Récupérer tous les utilisateurs
    const users = await prisma.user.findMany({
      select: { id: true, nom: true, prenom: true, email: true },
    });

    for (const mention of mentions) {
      // Trouver l'utilisateur correspondant (insensible à la casse)
      const user = users.find(u =>
        `${u.prenom} ${u.nom}`.toLowerCase() === mention.toLowerCase() ||
        `${u.nom} ${u.prenom}`.toLowerCase() === mention.toLowerCase()
      );

      if (!user || user.id === data.auteurId) continue;

      // 1. Notification in-app
      await this.createNotification({
        userId: user.id,
        type: 'mention',
        titre: `Mention : "${data.context.titre}"`,
        contenu: `${data.auteurNom} : ${data.contenu.substring(0, 100)}${data.contenu.length > 100 ? '...' : ''}`,
        lienType: data.context.type,
        lienId: data.context.id,
      });

      // 2. Email
      await this.envoyerEmailMention({
        destinataireEmail: user.email,
        destinataireNom: `${user.prenom} ${user.nom}`,
        auteurNom: data.auteurNom,
        commentaireContenu: data.contenu,
        appUrl: data.appUrl,
        context: { type: data.context.type, titre: data.context.titre },
      });
    }
  }

  // ── Assignation à une tâche ───────────────────────────────────────────────
  async notifierAssignation(data: {
    tacheId: string; tacheNom: string;
    assigneEmail: string; assigneNom: string;
    auteurNom: string; appUrl: string;
  }) {
    try {
      await this.createNotification({
        userId: data.assigneEmail,
        type: 'assignation',
        titre: `Vous avez été assigné à "${data.tacheNom}"`,
        contenu: `${data.auteurNom} vous a assigné à cette tâche.`,
        lienType: 'tache', lienId: data.tacheId,
      });
    } catch { /* silencieux */ }
    try {
      const smtp = await this.getActiveSMTP();
      if (!smtp) return;
      await smtp.transporter.sendMail({
        from: `"${smtp.smtp.fromName || 'PMO Hub'}" <${smtp.smtp.fromEmail}>`,
        to: data.assigneEmail,
        subject: `✅ Nouvelle assignation : ${data.tacheNom}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:600px">
          <div style="background:#2563eb;color:white;padding:20px;border-radius:8px 8px 0 0"><h2 style="margin:0">✅ Nouvelle assignation</h2></div>
          <div style="background:#f9fafb;padding:20px;border:1px solid #e5e7eb;border-radius:0 0 8px 8px">
            <p>Bonjour <strong>${data.assigneNom}</strong>,</p>
            <p><strong>${data.auteurNom}</strong> vous a assigné à la tâche :</p>
            <div style="background:white;border-left:4px solid #2563eb;padding:12px;margin:16px 0;border-radius:4px">
              <p style="margin:0;font-weight:bold;color:#1d4ed8">📋 ${data.tacheNom}</p>
            </div>
            <a href="${data.appUrl}/taches" style="display:inline-block;background:#2563eb;color:white;padding:10px 20px;border-radius:6px;text-decoration:none">Voir la tâche →</a>
            <p style="color:#9ca3af;font-size:12px;margin-top:20px">PMO Hub — Notification automatique</p>
          </div></div>`,
      });
    } catch (err) { console.error('[NOTIF] Erreur assignation:', err); }
  }

  // ── Changement de statut ──────────────────────────────────────────────────
  async notifierChangementStatut(data: {
    tacheId: string; tacheNom: string; ancienStatut: string; nouveauStatut: string;
    destinataires: { id: string; email: string; nom: string }[];
    auteurNom: string; appUrl: string;
  }) {
    const statutLabels: Record<string, string> = {
      cree: 'Créée', a_faire: 'À faire', en_cours: 'En cours',
      en_attente: 'En attente', bloque: '🔴 Bloqué', termine: '✅ Terminé', archive: 'Archivée'
    };
    const nouveauLabel = statutLabels[data.nouveauStatut] || data.nouveauStatut;
    const ancienLabel = statutLabels[data.ancienStatut] || data.ancienStatut;

    for (const dest of data.destinataires) {
      try {
        await this.createNotification({
          userId: dest.id, type: 'statut',
          titre: `Statut modifié : "${data.tacheNom}" → ${nouveauLabel}`,
          contenu: `${data.auteurNom} a changé le statut de ${ancienLabel} à ${nouveauLabel}.`,
          lienType: 'tache', lienId: data.tacheId,
        });
      } catch { /* silencieux */ }
      try {
        const smtp = await this.getActiveSMTP();
        if (!smtp) continue;
        await smtp.transporter.sendMail({
          from: `"${smtp.smtp.fromName || 'PMO Hub'}" <${smtp.smtp.fromEmail}>`,
          to: dest.email,
          subject: `🔄 Statut modifié : ${data.tacheNom}`,
          html: `<div style="font-family:Arial,sans-serif;max-width:600px">
            <div style="background:#7c3aed;color:white;padding:20px;border-radius:8px 8px 0 0"><h2 style="margin:0">🔄 Changement de statut</h2></div>
            <div style="background:#f9fafb;padding:20px;border:1px solid #e5e7eb;border-radius:0 0 8px 8px">
              <p>Bonjour <strong>${dest.nom}</strong>,</p>
              <p><strong>${data.auteurNom}</strong> a modifié le statut de la tâche <strong>${data.tacheNom}</strong> :</p>
              <div style="background:white;border-left:4px solid #7c3aed;padding:12px;margin:16px 0;border-radius:4px">
                <p style="margin:0">${ancienLabel} → <strong>${nouveauLabel}</strong></p>
              </div>
              <a href="${data.appUrl}/taches" style="display:inline-block;background:#7c3aed;color:white;padding:10px 20px;border-radius:6px;text-decoration:none">Voir la tâche →</a>
            </div></div>`,
        });
      } catch (err) { console.error('[NOTIF] Erreur statut:', err); }
    }
  }

  // ── Tâche en retard ───────────────────────────────────────────────────────
  async notifierRetard(data: {
    tacheId: string; tacheNom: string; joursRetard: number;
    destinataires: { id: string; email: string; nom: string }[];
    appUrl: string;
  }) {
    for (const dest of data.destinataires) {
      try {
        await this.createNotification({
          userId: dest.id, type: 'retard',
          titre: `⚠️ Tâche en retard : "${data.tacheNom}"`,
          contenu: `Cette tâche est en retard de ${data.joursRetard} jour(s).`,
          lienType: 'tache', lienId: data.tacheId,
        });
      } catch { /* silencieux */ }
      try {
        const smtp = await this.getActiveSMTP();
        if (!smtp) continue;
        await smtp.transporter.sendMail({
          from: `"${smtp.smtp.fromName || 'PMO Hub'}" <${smtp.smtp.fromEmail}>`,
          to: dest.email,
          subject: `⚠️ Tâche en retard : ${data.tacheNom}`,
          html: `<div style="font-family:Arial,sans-serif;max-width:600px">
            <div style="background:#dc2626;color:white;padding:20px;border-radius:8px 8px 0 0"><h2 style="margin:0">⚠️ Tâche en retard</h2></div>
            <div style="background:#f9fafb;padding:20px;border:1px solid #e5e7eb;border-radius:0 0 8px 8px">
              <p>Bonjour <strong>${dest.nom}</strong>,</p>
              <p>La tâche suivante est en retard de <strong>${data.joursRetard} jour(s)</strong> :</p>
              <div style="background:white;border-left:4px solid #dc2626;padding:12px;margin:16px 0;border-radius:4px">
                <p style="margin:0;font-weight:bold;color:#dc2626">📋 ${data.tacheNom}</p>
              </div>
              <a href="${data.appUrl}/taches" style="display:inline-block;background:#dc2626;color:white;padding:10px 20px;border-radius:6px;text-decoration:none">Voir la tâche →</a>
            </div></div>`,
        });
      } catch (err) { console.error('[NOTIF] Erreur retard:', err); }
    }
  }

  // ── Nouvelle tâche liée à un projet ───────────────────────────────────────
  async notifierNouvelleTacheProjet(data: {
    tacheId: string; tacheNom: string; projetNom: string;
    membres: { id: string; email: string; nom: string }[];
    createurNom: string; appUrl: string;
  }) {
    for (const membre of data.membres) {
      try {
        await this.createNotification({
          userId: membre.id, type: 'nouvelle_tache',
          titre: `Nouvelle tâche dans "${data.projetNom}"`,
          contenu: `${data.createurNom} a créé la tâche "${data.tacheNom}".`,
          lienType: 'tache', lienId: data.tacheId,
        });
      } catch { /* silencieux */ }
      try {
        const smtp = await this.getActiveSMTP();
        if (!smtp) continue;
        await smtp.transporter.sendMail({
          from: `"${smtp.smtp.fromName || 'PMO Hub'}" <${smtp.smtp.fromEmail}>`,
          to: membre.email,
          subject: `📋 Nouvelle tâche dans ${data.projetNom}`,
          html: `<div style="font-family:Arial,sans-serif;max-width:600px">
            <div style="background:#059669;color:white;padding:20px;border-radius:8px 8px 0 0"><h2 style="margin:0">📋 Nouvelle tâche</h2></div>
            <div style="background:#f9fafb;padding:20px;border:1px solid #e5e7eb;border-radius:0 0 8px 8px">
              <p>Bonjour <strong>${membre.nom}</strong>,</p>
              <p><strong>${data.createurNom}</strong> a créé une nouvelle tâche dans le projet <strong>${data.projetNom}</strong> :</p>
              <div style="background:white;border-left:4px solid #059669;padding:12px;margin:16px 0;border-radius:4px">
                <p style="margin:0;font-weight:bold;color:#059669">📋 ${data.tacheNom}</p>
              </div>
              <a href="${data.appUrl}/taches" style="display:inline-block;background:#059669;color:white;padding:10px 20px;border-radius:6px;text-decoration:none">Voir la tâche →</a>
            </div></div>`,
        });
      } catch (err) { console.error('[NOTIF] Erreur nouvelle tâche projet:', err); }
    }
  }

  // ── Commentaire sur une tâche ─────────────────────────────────────────────
  async notifierCommentaireSurCible(data: {
    cibleType: 'tache' | 'epic' | 'userStory';
    cibleId: string;
    cibleNom: string;
    commentaire: string;
    destinataires: { id: string; email: string; nom: string }[];
    auteurNom: string;
    appUrl: string;
  }) {
    const intro =
      data.cibleType === 'epic'
        ? `a commenté l’epic <strong>${data.cibleNom}</strong> :`
        : data.cibleType === 'userStory'
          ? `a commenté la user story <strong>${data.cibleNom}</strong> :`
          : `a commenté la tâche <strong>${data.cibleNom}</strong> :`;
    const cta =
      data.cibleType === 'tache' ? 'Voir la tâche →' : 'Voir les tâches →';

    for (const dest of data.destinataires) {
      try {
        await this.createNotification({
          userId: dest.id,
          type: 'commentaire',
          titre: `Nouveau commentaire sur "${data.cibleNom}"`,
          contenu: `${data.auteurNom} : ${data.commentaire.substring(0, 100)}`,
          lienType: data.cibleType,
          lienId: data.cibleId,
        });
      } catch { /* silencieux */ }
      try {
        const smtp = await this.getActiveSMTP();
        if (!smtp) continue;
        await smtp.transporter.sendMail({
          from: `"${smtp.smtp.fromName || 'PMO Hub'}" <${smtp.smtp.fromEmail}>`,
          to: dest.email,
          subject: `💬 Nouveau commentaire : ${data.cibleNom}`,
          html: `<div style="font-family:Arial,sans-serif;max-width:600px">
            <div style="background:#0284c7;color:white;padding:20px;border-radius:8px 8px 0 0"><h2 style="margin:0">💬 Nouveau commentaire</h2></div>
            <div style="background:#f9fafb;padding:20px;border:1px solid #e5e7eb;border-radius:0 0 8px 8px">
              <p>Bonjour <strong>${dest.nom}</strong>,</p>
              <p><strong>${data.auteurNom}</strong> ${intro}</p>
              <div style="background:white;border-left:4px solid #0284c7;padding:12px;margin:16px 0;border-radius:4px;font-style:italic">
                "${data.commentaire.substring(0, 200)}${data.commentaire.length > 200 ? '...' : ''}"
              </div>
              <a href="${data.appUrl}/taches" style="display:inline-block;background:#0284c7;color:white;padding:10px 20px;border-radius:6px;text-decoration:none">${cta}</a>
            </div></div>`,
        });
      } catch (err) {
        console.error('[NOTIF] Erreur commentaire:', err);
      }
    }
  }

  async notifierCommentaire(data: {
    tacheId: string;
    tacheNom: string;
    commentaire: string;
    destinataires: { id: string; email: string; nom: string }[];
    auteurNom: string;
    appUrl: string;
  }) {
    return this.notifierCommentaireSurCible({
      cibleType: 'tache',
      cibleId: data.tacheId,
      cibleNom: data.tacheNom,
      commentaire: data.commentaire,
      destinataires: data.destinataires,
      auteurNom: data.auteurNom,
      appUrl: data.appUrl,
    });
  }

  // ── Document uploadé ──────────────────────────────────────────────────────
  async notifierDocumentUploade(data: {
    tacheId: string; tacheNom: string; documentNom: string;
    destinataires: { id: string; email: string; nom: string }[];
    auteurNom: string; appUrl: string;
  }) {
    for (const dest of data.destinataires) {
      try {
        await this.createNotification({
          userId: dest.id, type: 'document',
          titre: `Nouveau document dans "${data.tacheNom}"`,
          contenu: `${data.auteurNom} a uploadé "${data.documentNom}".`,
          lienType: 'tache', lienId: data.tacheId,
        });
      } catch { /* silencieux */ }
      try {
        const smtp = await this.getActiveSMTP();
        if (!smtp) continue;
        await smtp.transporter.sendMail({
          from: `"${smtp.smtp.fromName || 'PMO Hub'}" <${smtp.smtp.fromEmail}>`,
          to: dest.email,
          subject: `📎 Nouveau document : ${data.tacheNom}`,
          html: `<div style="font-family:Arial,sans-serif;max-width:600px">
            <div style="background:#d97706;color:white;padding:20px;border-radius:8px 8px 0 0"><h2 style="margin:0">📎 Nouveau document</h2></div>
            <div style="background:#f9fafb;padding:20px;border:1px solid #e5e7eb;border-radius:0 0 8px 8px">
              <p>Bonjour <strong>${dest.nom}</strong>,</p>
              <p><strong>${data.auteurNom}</strong> a uploadé un document sur la tâche <strong>${data.tacheNom}</strong> :</p>
              <div style="background:white;border-left:4px solid #d97706;padding:12px;margin:16px 0;border-radius:4px">
                <p style="margin:0">📎 <strong>${data.documentNom}</strong></p>
              </div>
              <a href="${data.appUrl}/taches" style="display:inline-block;background:#d97706;color:white;padding:10px 20px;border-radius:6px;text-decoration:none">Voir la tâche →</a>
            </div></div>`,
        });
      } catch (err) { console.error('[NOTIF] Erreur document:', err); }
    }
  }

}