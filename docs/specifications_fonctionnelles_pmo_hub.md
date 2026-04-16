# SPECIFICATIONS FONCTIONNELLES
## PMO HUB

Version: 1.0  
Date: 16/04/2026  
Auteur: Equipe Produit / PMO HUB

---

## 1. Introduction

### 1.1 Objet
Ce document formalise les specifications fonctionnelles de la plateforme PMO HUB.  
Il decrit:
- les objectifs metier,
- les modules fonctionnels,
- les roles utilisateurs,
- les regles de gestion,
- les flux operationnels,
- les criteres de recette.

### 1.2 Public cible
- Direction / sponsors
- MOA / metier
- Chef de projet
- Equipe technique (frontend, backend, data)
- QA / recette

### 1.3 Perimetre
Le perimetre couvre la gestion centralisee:
- des processus,
- des projets,
- des elements Agile (Epic, User Story, Tache),
- des documents et ACL,
- des PV de reunion,
- des referentiels (entites, clients/fournisseurs, contrats, licences/certifications, utilisateurs),
- du dashboard pilote par role.

---

## 2. Contexte et objectifs metier

### 2.1 Vision
Fournir une plateforme unique de pilotage PMO, avec un haut niveau de tracabilite, de securite d'acces et de visibilite contextuelle par utilisateur.

### 2.2 Objectifs
- Centraliser les donnees projet/processus.
- Standardiser le suivi des taches et livrables.
- Renforcer la gouvernance des acces (ACL).
- Offrir des dashboards orientes decision.
- Reduire les actions manuelles grace aux heritages et synchronisations automatiques.

---

## 3. Roles utilisateurs

### 3.1 Roles
- admin
- contributeur
- lecteur

### 3.2 Principes de securite
- Le role definit une capacite generale.
- Les ACL definissent l'acces effectif a chaque ressource.
- Un admin peut etre explicitement exclu d'une ressource.
- Un utilisateur ne voit que ce qui le concerne (filtrage backend).

### 3.3 Matrice simplifiee Role x Action

#### admin
- Consultation: Oui (sauf exclusion explicite)
- Creation: Oui
- Modification: Oui
- Suppression: Oui
- Gestion des droits: Oui

#### contributeur
- Consultation: Oui (sur perimetre autorise)
- Creation: Oui (selon module)
- Modification: Oui (selon perimetre/droits)
- Suppression: Limitee (selon droits)
- Gestion des droits: Non, sauf delegation explicite

#### lecteur
- Consultation: Oui (sur perimetre autorise)
- Creation/Modification/Suppression: Non
- Gestion des droits: Non

---

## 4. Modules fonctionnels detailles

### 4.1 Authentification et session
Fonctions:
- Connexion utilisateur.
- Chargement du profil (role, droits, modules UI).
- Gestion de session.

Regles:
- L'acces aux pages est conditionne a une session valide.
- Les menus et actions visibles dependent du role + droits effectifs.

### 4.2 Dashboard
Fonctions:
- Vue personnalisee selon role.
- KPI globaux et contextuels.
- Section "Projets les plus actifs".

Specifique admin:
- Totaux globaux:
  - Processus
  - Projets
  - Epic + User Story + Taches (regroupe)
  - Clients + Fournisseurs (regroupe)
  - Contrats
  - PV de reunion
  - Licences + Certifications (regroupe)
  - Entites
  - Documents
  - Utilisateurs
- Section "Projets par statut et entite":
  - total projets,
  - total par statut,
  - pourcentage global par statut,
  - projets par statut avec entites assignees et delai restant.

Specifique contributeur:
- Affichage limite au perimetre assigne.
- Section "Taches assignees" (non finalisees).

### 4.3 Processus
Fonctions:
- Creation, consultation, modification selon droits.
- Association aux entites.

Regles:
- Non-admin: visualise uniquement les processus lies a ses entites.
- Admin: acces global, sauf exclusions explicites ACL.

### 4.4 Projets
Fonctions:
- CRUD projet.
- Gouvernance projet (sponsor, chef de projet, tech lead, equipe).
- Affectation entites et clients/fournisseurs.
- Acces detail projet, historique, droits, corbeille.

Exigences:
- Tri de la liste par statut puis deadline.
- Affichage en ligne projet:
  - statut,
  - code projet,
  - entites affectees,
  - clients/fournisseurs affectes.

Regles automatiques:
- Synchronisation des intervenants depuis affectations indirectes des taches (directes et via US/Epic).
- Deduction des entites depuis les utilisateurs de gouvernance/intervenants.
- Dashboard admin aligne sur les entites effectives.

### 4.5 Gestion Agile (Epic / User Story / Tache)
Fonctions:
- Hierarchie Epic > User Story > Tache.
- Affectation des taches aux utilisateurs.
- Filtres et tris operationnels.

Exigences:
- Bouton "Mes taches": taches assignees a l'utilisateur connecte, hors terminees/archives.
- "Voir archives": affichage optionnel des archives.
- Filtre par statut.
- Tri par statut puis echeance pour taches, user stories, epics.

Heritage:
- Si une tache liee a une US/Epic porte des entites, l'Epic herite des entites (chaine de liaison).

### 4.6 Documents et ACL
Fonctions:
- Gestion documentaire multi-contexte.
- Modal "Acces" pour gestion fine des permissions.
- Alignement des droits avec la ressource parent.

Exigences:
- Bouton "Acces" sur documents Epic/Tache avec logique equivalente au projet.
- Le createur peut:
  - retirer acces implicite a un admin,
  - deleguer des droits a d'autres utilisateurs.
- Les documents de taches/epics remontent dans les sections documentaires projet lorsque lies.

Permissions:
- lecture
- modification
- suppression
- gestion

### 4.7 PV de reunion
Fonctions:
- Gestion PV et pieces jointes.
- ACL et statuts coherents.

Exigences:
- Le statut d'un document lie PV reflète le statut reel du PV.
- Les droits dans la page Documents sont identiques a ceux du PV.

### 4.8 Referentiels
Modules:
- Entites
- Clients/Fournisseurs
- Contrats
- Licences/Certifications
- Utilisateurs

Regles:
- Controle d'acces selon role + ACL.
- Donnees reutilisees dans formulaires et aggregations dashboard.

---

## 5. Regles de gestion transverses (RG)

- RG-001: La visibilite est filtree cote backend.
- RG-002: Les ACL ressource priment sur les droits de role.
- RG-003: Un admin peut etre explicitement exclu d'une ressource.
- RG-004: Les listes critiques sont triees (statut puis echeance).
- RG-005: Les archives sont masquees par defaut dans les vues Agile.
- RG-006: Les statuts affiches en vue consolidee doivent rester coherents avec la source metier.
- RG-007: Les entites projet peuvent etre explicites et/ou deduites.
- RG-008: Le dashboard est adapte au role (admin global vs contributeur cible).

---

## 6. Flux fonctionnels

### Flux A - Connexion et initialisation
1. L'utilisateur se connecte.
2. Le systeme valide la session.
3. Le profil role/droits est charge.
4. Les modules visibles sont adaptes.
5. Les donnees visibles sont filtrees selon ACL.

### Flux B - Creation et gouvernance projet
1. Creation du projet (metadonnees).
2. Affectation gouvernance (sponsor/CP/tech lead/equipe).
3. Affectation entites et clients/fournisseurs.
4. Enregistrement ACL.
5. Affichage en liste avec badges.
6. Synchronisation des entites/intervenants derives.

### Flux C - Execution Agile
1. Creation Epic.
2. Creation User Stories.
3. Creation et affectation Taches.
4. Filtrage "Mes taches".
5. Tri par statut/echeance.
6. Heritage entites vers niveaux superieurs.

### Flux D - Gestion documentaire securisee
1. Upload document sur une ressource.
2. Ouverture modal "Acces".
3. Ajout/modification/retrait des droits.
4. Exclusion admin possible.
5. Application immediate des ACL dans les vues.

### Flux E - Pilotage dashboard admin
1. Chargement KPI globaux.
2. Repartition projets par statut et entites.
3. Calcul pourcentage global par statut.
4. Affichage projet + entites + delai restant.
5. Navigation vers listes detaillees.

---

## 7. Cas d'utilisation majeurs

### UC-01 Consultation dashboard admin
Acteur: admin  
Precondition: utilisateur authentifie  
Scenario:
1. Ouvre dashboard.
2. Consulte totaux globaux.
3. Analyse section projets par statut/entite.
Resultat attendu: KPI complets et coherents.

### UC-02 Consultation dashboard contributeur
Acteur: contributeur  
Precondition: utilisateur authentifie  
Scenario:
1. Ouvre dashboard.
2. Visualise uniquement son perimetre.
3. Consulte "Taches assignees".
Resultat attendu: aucun element hors perimetre n'apparait.

### UC-03 Gestion des droits d'un document
Acteur: createur document (ou delegue gestion)  
Scenario:
1. Ouvre modal "Acces".
2. Ajoute/revoque des droits.
3. Exclut eventuellement un admin.
Resultat attendu: ACL appliquees immediatement.

### UC-04 Filtre Mes taches
Acteur: utilisateur connecte  
Scenario:
1. Active "Mes taches".
2. Liste filtree sur taches assignees non terminees/non archivees.
Resultat attendu: filtrage exact.

### UC-05 Affichage ligne projet enrichie
Acteur: utilisateur autorise  
Scenario:
1. Ouvre page Projets.
2. Observe chaque ligne projet.
Resultat attendu: entites et clients/fournisseurs affiches.

---

## 8. Criteres d'acceptation (recette)

- CR-01: Un contributeur ne voit pas les processus hors entites affectees.
- CR-02: "Mes taches" exclut terminees et archivees.
- CR-03: Les archives n'apparaissent que via "Voir archives".
- CR-04: Chaque ligne projet affiche entites + clients/fournisseurs.
- CR-05: Un document lie PV affiche le statut reel du PV.
- CR-06: Un admin exclu explicitement perd l'acces a la ressource cible.
- CR-07: Dashboard admin affiche les totaux globaux attendus.
- CR-08: Dashboard admin affiche le pourcentage global des projets par statut.

---

## 9. Exigences non fonctionnelles

- Securite: ACL robuste et enforcement backend.
- Performance: chargements listes et dashboards fluides.
- Cohérence: regles d'acces uniformes entre modules.
- Traçabilite: historique des actions critiques.
- Maintenabilite: centralisation des regles metier sensibles.

---

## 10. Risques et points de vigilance

- Qualite des donnees historiques (besoin ponctuel de backfill).
- Coherence des affectations utilisateurs-entites.
- Multiplicite des cas ACL (tests de non-regression indispensables).
- Charge potentielle sur les requetes agregées dashboard.

---

## 11. Hors perimetre (version actuelle)

- Multi-tenant complet.
- Connecteurs externes (ERP/SSO/BI) non explicitement demandes.
- Moteurs d'approbation complexes multi-niveaux.

---

## 12. Annexes recommandees (version 1.1)

- RACI detaille par module.
- Dictionnaire des statuts metier.
- Plan de recette complet (cas nominaux + cas limites + securite).
- Guide utilisateur par role (admin/contributeur/lecteur).

