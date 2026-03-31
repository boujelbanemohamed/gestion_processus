export const getLicences = (req, res) => {
  res.json([
    { id: 1, nom: "Licence test", dateDebut: "2024-01-01", dateFin: "2025-01-01" }
  ]);
};

export const getTypesLicence = (req, res) => {
  res.json([
    { id: 1, nom: "Standard" },
    { id: 2, nom: "Premium" }
  ]);
};