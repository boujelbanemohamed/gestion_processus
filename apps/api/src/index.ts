import express from "express";
import cors from "cors";
import helmet from "helmet";
import "dotenv/config";
import { authenticate, logger } from "./middleware/auth";
import { logger as loggerMiddleware } from "./middleware/logger";

// Controllers
import * as authController from "./controllers/auth.controller";
import * as entiteController from "./controllers/entite.controller";
import * as processusController from "./controllers/processus.controller";
import * as documentController from "./controllers/document.controller";
import * as documentCommentController from "./controllers/document-comment.controller";
import * as userController from "./controllers/user.controller";
import * as dashboardController from "./controllers/dashboard.controller";
import * as journalController from "./controllers/journal.controller";
import * as categorieController from "./controllers/categorie.controller";
import * as smtpController from "./controllers/smtp.controller";
import * as projetController from "./controllers/projet.controller";
import * as corbeilleController from "./controllers/corbeille.controller";
import * as favorisController from "./controllers/favoris.controller";
import * as contratController from "./controllers/contrat.controller";
import * as ocrController from "./controllers/ocr.controller";
import * as clientFournisseurController from "./controllers/client-fournisseur.controller";
import * as tacheController from "./controllers/tache.controller";
import * as notificationController from "./controllers/notification.controller";

const app = express();
app.use(helmet());
// Configuration CORS pour autoriser plusieurs origines
const allowedOrigins = [
  process.env.FRONTEND_URL || "http://localhost:5173",
  "http://localhost:5173",
  "http://172.17.5.198:5173",
  "http://127.0.0.1:5173",
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Autoriser les requêtes sans origine (ex: Postman, curl)
      if (!origin) {
        return callback(null, true);
      }
      // Vérifier si l'origine est autorisée
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        // En développement, autoriser toutes les origines
        if (process.env.NODE_ENV !== "production") {
          callback(null, true);
        } else {
          callback(new Error("Not allowed by CORS"));
        }
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "authorization", "Content-Type", "Accept"],
    exposedHeaders: ["Authorization"],
  })
);
app.use((req, res, next) => {
  const ct = req.headers['content-type'] || '';
  if (ct.includes('multipart/form-data')) return next();
  express.json()(req, res, next);
});

// Health check (sans auth)
app.get("/api/v1/health", (_req, res) => {
  res.json({ status: "ok", service: "api", version: "0.1.0" });
});

// Routes publiques (auth)
app.post("/api/v1/auth/login", authController.login);
app.post("/api/v1/auth/refresh", authController.refresh);
app.post("/api/v1/auth/register", authController.register);
app.post("/api/v1/auth/forgot-password", authController.forgotPassword);
app.post("/api/v1/auth/reset-password", authController.resetPassword);

// Middleware d'authentification pour routes protégées
app.use(authenticate);
app.use(loggerMiddleware);

// Dashboard
app.get("/api/v1/dashboard", dashboardController.getKPIs);

// Entités
app.get("/api/v1/entites", entiteController.getAllEntites);
app.get("/api/v1/entites/tree", entiteController.getEntiteTree);
app.get("/api/v1/entites/:id", entiteController.getEntite);
app.get("/api/v1/entites/:id/history", entiteController.getEntiteHistory);
app.post("/api/v1/entites", entiteController.createEntite);
app.put("/api/v1/entites/:id", entiteController.updateEntite);
app.delete("/api/v1/entites/:id", entiteController.deleteEntite);

// Processus
app.get("/api/v1/processus", processusController.getAllProcessus);
app.get("/api/v1/processus/:id", processusController.getProcessus);
app.get("/api/v1/processus/:id/history", processusController.getProcessusHistory);
app.post("/api/v1/processus", processusController.createProcessus);
app.put("/api/v1/processus/:id", processusController.updateProcessus);
app.patch("/api/v1/processus/:id/status", processusController.updateProcessusStatus);
app.delete("/api/v1/processus/:id", processusController.deleteProcessus);

// Projets
app.get("/api/v1/projets", projetController.getAllProjets);
app.get("/api/v1/projets/:id", projetController.getProjet);
app.get("/api/v1/projets/:id/history", projetController.getProjetHistory);
app.post("/api/v1/projets", projetController.createProjet);
app.put("/api/v1/projets/:id", projetController.updateProjet);
app.delete("/api/v1/projets/:id", projetController.deleteProjet);

// Documents
app.get("/api/v1/documents", documentController.getAllDocuments);
app.get("/api/v1/documents/:id", documentController.getDocument);
app.post("/api/v1/documents", documentController.uploadMiddleware, documentController.createDocument);
app.post("/api/v1/documents/:id/versions", documentController.uploadMiddleware, documentController.createVersion);
app.get("/api/v1/documents/:id/view", documentController.viewDocument);
app.get("/api/v1/documents/:id/download", documentController.downloadDocument);
app.get("/api/v1/documents/:id/versions/:versionId/download", documentController.downloadVersion);
app.put("/api/v1/documents/:id", documentController.updateDocument);
app.delete("/api/v1/documents/:id", documentController.deleteDocument);
// Commentaires de documents
app.get("/api/v1/documents/:id/comments", documentCommentController.listComments);
app.post("/api/v1/documents/:id/comments", documentCommentController.uploadMiddleware, documentCommentController.addComment);
app.get("/api/v1/comments/:commentId/attachment", documentCommentController.downloadAttachment);

// Utilisateurs
app.get("/api/v1/users", userController.getAllUsers);
app.get("/api/v1/users/:id", userController.getUser);
app.post("/api/v1/users", userController.createUser);
app.put("/api/v1/users/:id", userController.updateUser);
app.patch("/api/v1/users/:id/password", userController.updateUserPassword);
app.delete("/api/v1/users/:id", userController.deleteUser);

// Catégories
app.get("/api/v1/categories", categorieController.getAllCategories);
app.get("/api/v1/categories/:id", categorieController.getCategorie);
app.post("/api/v1/categories", categorieController.createCategorie);
app.put("/api/v1/categories/:id", categorieController.updateCategorie);
app.delete("/api/v1/categories/:id", categorieController.deleteCategorie);

// Journal d'accès
app.get("/api/v1/journal", journalController.getJournal);

// Configuration SMTP
app.get("/api/v1/smtp", smtpController.getAllSMTPConfigs);
app.get("/api/v1/smtp/:id", smtpController.getSMTPConfig);
app.post("/api/v1/smtp", smtpController.createSMTPConfig);
app.put("/api/v1/smtp/:id", smtpController.updateSMTPConfig);
app.delete("/api/v1/smtp/:id", smtpController.deleteSMTPConfig);
app.post("/api/v1/smtp/:id/test", smtpController.testSMTPConfig);
app.post("/api/v1/smtp/test-notification", authenticate, smtpController.testNotification);

// Corbeille (accessible uniquement au super admin)
app.get("/api/v1/corbeille", corbeilleController.getCorbeille);
app.post("/api/v1/corbeille/processus/:id/restaurer", corbeilleController.restaurerProcessus);
app.post("/api/v1/corbeille/documents/:id/restaurer", corbeilleController.restaurerDocument);
app.delete("/api/v1/corbeille/processus/:id", corbeilleController.supprimerDefinitivementProcessus);
app.delete("/api/v1/corbeille/documents/:id", corbeilleController.supprimerDefinitivementDocument);

// Favoris
app.get("/api/v1/favoris", favorisController.getFavoris);
app.post("/api/v1/favoris/processus/:id", favorisController.ajouterProcessusFavori);
app.delete("/api/v1/favoris/processus/:id", favorisController.retirerProcessusFavori);
app.post("/api/v1/favoris/documents/:id", favorisController.ajouterDocumentFavori);
app.delete("/api/v1/favoris/documents/:id", favorisController.retirerDocumentFavori);
app.get("/api/v1/favoris/processus/:id/check", favorisController.estProcessusFavori);
app.get("/api/v1/favoris/documents/:id/check", favorisController.estDocumentFavori);
// Types de société
app.get("/api/v1/types-societe", clientFournisseurController.getTypesSociete);
app.post("/api/v1/types-societe", clientFournisseurController.createTypeSociete);
app.put("/api/v1/types-societe/:id", clientFournisseurController.updateTypeSociete);
app.delete("/api/v1/types-societe/:id", clientFournisseurController.deleteTypeSociete);
// Clients / Fournisseurs
app.get("/api/v1/clients-fournisseurs", clientFournisseurController.getClientsFournisseurs);
app.get("/api/v1/clients-fournisseurs/:id", clientFournisseurController.getClientFournisseur);
app.post("/api/v1/clients-fournisseurs", clientFournisseurController.createClientFournisseur);
app.put("/api/v1/clients-fournisseurs/:id", clientFournisseurController.updateClientFournisseur);
app.delete("/api/v1/clients-fournisseurs/:id", clientFournisseurController.deleteClientFournisseur);
// Représentants légaux
app.post("/api/v1/clients-fournisseurs/:id/representants", clientFournisseurController.addRepresentant);
app.put("/api/v1/clients-fournisseurs/:id/representants/:repId", clientFournisseurController.updateRepresentant);
app.delete("/api/v1/clients-fournisseurs/:id/representants/:repId", clientFournisseurController.deleteRepresentant);
app.post("/api/v1/clients-fournisseurs/:id/projets", clientFournisseurController.addProjet);
app.delete("/api/v1/clients-fournisseurs/:id/projets/:projetId", clientFournisseurController.removeProjet);

// Routes Contrats
app.get("/api/v1/contrats", contratController.getContrats);
app.get("/api/v1/contrats/:id", contratController.getContrat);
app.post("/api/v1/contrats", contratController.uploadContrat, contratController.createContrat);
app.put("/api/v1/contrats/:id", contratController.updateContrat);
app.delete("/api/v1/contrats/:id", contratController.deleteContrat);
app.post("/api/v1/contrats/:id/permissions", contratController.addPermission);
app.delete("/api/v1/contrats/:id/permissions/:userId", contratController.removePermission);
app.post("/api/v1/contrats/:id/documents", contratController.addDocumentToContrat);
app.post("/api/v1/contrats/:id/link-document", contratController.linkDocument);
// Routes OCR
app.get("/api/v1/ocr/documents", authenticate, ocrController.getDocumentsOcr);
app.post("/api/v1/ocr/scan/:id", authenticate, ocrController.scanDocument);
app.post("/api/v1/ocr/scan-all", authenticate, ocrController.scanAll);
app.get("/api/v1/ocr/search", authenticate, ocrController.searchOcr);

app.post("/api/v1/contrats/:id/upload", contratController.uploadContrat, contratController.uploadAndLinkDocument);
app.delete("/api/v1/contrats/:id/documents/:documentId", contratController.removeDocumentFromContrat);


// Tâches
app.get("/api/v1/taches", tacheController.getAllTaches);
// Documents de tâches
app.get("/api/v1/taches/documents-liables", tacheController.getDocumentsLiables);
app.get("/api/v1/taches/:id", tacheController.getTache);
app.post("/api/v1/taches", tacheController.createTache);
app.put("/api/v1/taches/:id", tacheController.updateTache);
app.delete("/api/v1/taches/:id", tacheController.deleteTache);
app.get("/api/v1/taches/:id/commentaires", tacheController.getCommentaires);
app.post("/api/v1/taches/:id/commentaires", tacheController.uploadMiddleware, tacheController.addCommentaire);
app.get("/api/v1/taches/:id/commentaires/:commentaireId/fichier", tacheController.downloadCommentaireFichier);
app.post("/api/v1/taches/:id/documents/lier", tacheController.lierDocument);
app.delete("/api/v1/taches/:id/documents/:documentId", tacheController.delierDocument);
app.post("/api/v1/taches/:id/documents", tacheController.uploadMiddleware, tacheController.uploadDocument);



// Notifications
app.get("/api/v1/notifications", notificationController.getNotifications);
app.get("/api/v1/notifications/count", notificationController.countNonLues);
app.patch("/api/v1/notifications/:id/lue", notificationController.marquerLue);
app.patch("/api/v1/notifications/toutes-lues", notificationController.marquerToutesLues);

// Gestion des erreurs
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || "Erreur serveur",
  });
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
