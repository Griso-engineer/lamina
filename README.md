# Lamina — calcul des vitrages (Tracés)

*Lamina* : la feuille, la lame — le verre plat et ses plis de feuilleté.

Application web statique qui regroupe des calculs de vitrages. Même présentation et même mode d'emploi que
Firmitas (onglets de calcul, projets dans le navigateur, fiche NDC en PDF ou Word), thème bleu-gris.

## Onglets

- **Roark** : prédimensionnement rapide d'un vitrage rectangulaire chargé normalement à son plan.
  - *Plaques* appuyées sur 4, 3 ou 2 côtés adjacents (appuis simples, encastrements, bords libres) :
    W. C. Young & R. G. Budynas, *Roark's Formulas for Stress and Strain*, tableau 11.4, coefficients α, β, γ
    interpolés en a/b (reprise de l'onglet Plaques de Firmitas) ; pression uniforme, variable ou charge
    concentrée selon le cas ; effet membrane (§ 11.11) pour information.
  - *Bandes et consoles* tenues sur 1 ou 2 côtés opposés (appuis simples, encastré–appuyé, bi-encastré,
    console) : statique de poutre de largeur unité, pression uniforme, charge linéique parallèle aux appuis
    (main courante) ou charge ponctuelle en position quelconque, avec largeur participante b_eff ;
    rigidité de poutre E·t³/12 ou de plaque E·t³/12(1 − ν²) ; flèche par intégration exacte.
  - *Verre* monolithique ou feuilleté (plis de bas en haut, traitement par pli, intercalaire, ω) :
    épaisseurs effectives NF EN 16612 (h_ef;w pour la flèche, h_ef;σ,j pour la contrainte du pli j).
  - *Résistance* NF EN 16612 par cas ELU (k_mod selon la durée cumulée de la charge, k_sp, k_e, k_v,
    f_b;k selon le traitement), ou contrainte admissible saisie.
  - Plusieurs cas ELU (contrainte) et ELS (flèche limite b/n et plafond en mm).
- **Projets** : enregistrement dans le navigateur (localStorage), export / import .json, fiches NDC du projet.
- **Contre-vérification** : recoupement en direct avec les classeurs d'origine et liste des anomalies relevées.

## Classeurs d'origine et contre-vérification

- « Glass behaviour under different restraints.xlsx » : formules de Roark (4 côtés) et de poutre (2 côtés, console).
  Anomalies corrigées : moment de la console sous pression (q·a·b²/2 au lieu de q·b·a²/2, contrainte
  sous-estimée d'un facteur a/b) ; encastré–appuyé sous charge ponctuelle ou linéique (seul le moment
  d'encastrement retenu, flèche sous la charge au lieu de la flèche maximale) ; flèche limite sur le grand
  côté ; E codé en dur ; charge ponctuelle répartie sur toute la largeur.
- « Glass Strength Spreadsheet.xlsx » : f_g;d prEN 16612 (repris tel quel, k_e ajouté).
- « Effective Thickness - prEN16612-2017 - LG.xlsx » : h_ef;w et h_ef;σ (repris ; axe neutre au centre de
  gravité du verre au lieu du milieu géométrique, identique pour une composition symétrique).

`tests.html` exécute les recoupements (classeurs, formules fermées de la RDM, cas limites du feuilleté).

## Lancer en local

```
powershell -ExecutionPolicy Bypass -File serve.ps1
```

Avant chaque publication : `sh stamp.sh` (suffixe ?v=empreinte sur les scripts et la feuille de style).

## Hors champ (à ce stade)

Double vitrage (partage des charges, lame de gaz), stabilité des verres porteurs, choc, attaches et calages,
contraintes thermiques, effet membrane dans les vérifications.
