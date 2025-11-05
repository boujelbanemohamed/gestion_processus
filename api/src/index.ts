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

const app = express();
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "authorization", "Content-Type", "Accept"],
    exposedHeaders: ["Authorization"],
  })
);
app.use(express.json());

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

// Documents
app.get("/api/v1/documents", documentController.getAllDocuments);
app.get("/api/v1/documents/:id", documentController.getDocument);
app.post("/api/v1/documents", documentController.uploadMiddleware, documentController.createDocument);
app.post("/api/v1/documents/:id/versions", documentController.uploadMiddleware, documentController.createVersion);
app.get("/api/v1/documents/:id/download", documentController.downloadDocument);
app.get("/api/v1/documents/:id/versions/:versionId/download", documentController.downloadVersion);
app.put("/api/v1/documents/:id", documentController.updateDocument);
app.delete("/api/v1/documents/:id", documentController.deleteDocument);
// Commentaires de documents
app.get("/api/v1/documents/:id/comments", documentCommentController.listComments);
app.post("/api/v1/documents/:id/comments", documentCommentController.addComment);

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
