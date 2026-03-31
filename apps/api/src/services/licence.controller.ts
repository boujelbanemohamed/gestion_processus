import { Request, Response } from "express";

export const getLicences = async (_req: Request, res: Response) => {
  res.json([
    { id: 1, nom: "Licence Test", statut: "active" }
  ]);
};

export const getTypesLicence = async (_req: Request, res: Response) => {
  res.json([
    { id: 1, nom: "Standard" },
    { id: 2, nom: "Premium" }
  ]);
};