# Rapport d’améliorations UX/UI — application de génération de pitch

**Date source :** 28 avril 2026  
**Sources analysées :** transcriptions Upmeet reçues par mail le 28/04/2026  
- `Stratégie Commerciale IA - Votre compte-rendu Upmeet` — focus principal sur l’usage de l’application.
- `Vente Négociation Persuasion - Votre compte-rendu Upmeet` — contexte pédagogique et logique de pitch.

## Synthèse exécutive

L’application fonctionne et crée de la valeur : plusieurs utilisateurs obtiennent un pitch exploitable, et le mécanisme `repérer le flou → enrichir → clarifier → raccourcir → générer le pitch` est perçu comme puissant.

Mais l’usage terrain a révélé un problème central : **la logique métier est bonne, l’interface ne guide pas encore assez le cycle d’amélioration**. Les utilisateurs comprennent l’intérêt, mais se perdent dans les boutons, les remplacements de texte, la dictée mobile, les retours d’action et le niveau d’enjeu attendu.

Priorité dev : transformer l’outil d’un formulaire intelligent en **assistant guidé par étapes**, avec des actions visibles, réversibles, contextualisées et adaptées mobile.

---

# 1. Améliorations prioritaires à transmettre à l’agent de développement

## P0 — Sécuriser le cycle d’édition pour éviter les pertes ou écrasements de texte

### Problème observé
Plusieurs utilisateurs ont eu l’impression de perdre ou d’écraser leur texte :
- « Je n'arrive pas quand je clique. Il ne veut pas remplacer mon texte. » — 02:15:24
- « Il s'est remplacé sans que je m'en rende compte. » — 02:15:32
- « Il est où mon texte ? » — 02:15:58
- « J'ai tout remplacé par “recueil flou”, du coup il n'y a plus rien. » — 02:28:15

### Recommandation dev
Ajouter une gestion explicite et robuste des versions :
1. Historique local par bloc : `version initiale`, `réponse dictée`, `clarification`, `pitch généré`.
2. Bouton `Annuler la dernière action` visible après chaque transformation.
3. Confirmation visuelle après remplacement : toast ou badge `Texte mis à jour`.
4. Ne jamais remplacer silencieusement le contenu principal.
5. Renommer `Remplacer mon texte` si l’action enrichit/fusionne plutôt qu’elle ne remplace.

### Critère d’acceptation
Un utilisateur doit pouvoir tester plusieurs itérations sans jamais se demander où est passé son texte.

---

## P0 — Remplacer la logique de boutons dispersés par un workflow guidé

### Problème observé
Le process n’est pas naturellement compris :
- « En ergonomie, il faut que je revoie le truc. » — 02:24:31
- « Je pense même qu'il faudrait que je fasse un bouton étape suivante parce que c'est toujours la même étape. » — 02:25:49
- « Il va falloir que je change un peu l’UX, clairement. » — 02:32:01
- « Le processus n'est pas clair. C'est pas parfait. » — 02:32:01

### Recommandation dev
Créer un mode guidé par bloc :
1. Étape 1 — `Décrire mes forces / mon projet`.
2. Étape 2 — `Repérer ce qui reste flou`.
3. Étape 3 — `Répondre aux points flous`.
4. Étape 4 — `Clarifier le texte`.
5. Étape 5 — `Refaire une itération ou passer au bloc suivant`.
6. Étape 6 — `Générer le pitch`.
7. Étape 7 — `Raccourcir / finaliser / copier`.

Ajouter un bouton principal unique : `Étape suivante`, qui déclenche l’action logique selon l’état courant.

### Critère d’acceptation
L’utilisateur ne doit pas avoir à mémoriser la séquence. L’interface doit porter le cycle.

---

## P0 — Optimiser l’expérience mobile de dictée

### Problème observé
L’usage réel se fait beaucoup sur téléphone. Les utilisateurs doivent remonter/descendre entre le texte, les questions et le bouton de dictée :
- « Ce serait hyper intéressant […] d’avoir le bouton d’enregistrement qui se balade en bas quelque part. » — 02:34:47
- « Je dois remonter, dicter le champ, je redescends. Je lis mes trucs, je remonte pour arrêter. » — 02:35:05
- « Éviter […] sur un téléphone portable […] les allers-retours entre les éléments que l’on doit préciser et l’enregistrement. » — 02:35:25

### Recommandation dev
Sur mobile :
1. Ajouter une barre flottante en bas d’écran.
2. Bouton micro toujours accessible.
3. État d’enregistrement très visible : micro rouge, timer, animation ou badge `Enregistrement en cours`.
4. Bouton `Stop` dans la même zone que le bouton `Record`.
5. Garder le contexte de la question visible pendant la dictée.

### Critère d’acceptation
L’utilisateur peut lire un point flou, dicter sa réponse et arrêter l’enregistrement sans changer de zone d’écran.

---

## P1 — Traiter chaque point flou comme une carte actionnable

### Problème observé
Le retour `repérer le flou` génère plusieurs points, mais l’utilisateur ne sait pas toujours où répondre ni comment traiter chaque point proprement.

Feedback explicite :
- « Dans chaque élément qui reste flou à traiter, avoir un bouton d’enregistrement qui permet de traiter que cet élément-là. » — 02:39:18
- « Ce qu’il faut préciser, un bouton micro. Tu appuies dessus, il lance l’enregistrement et tu clarifies le truc. Point par point. » — 02:41:06
- « Comme ça, il est beaucoup plus précis. Il sait exactement ce à quoi tu réponds. » — 02:41:06

### Recommandation dev
Transformer chaque point flou en carte :
- Texte du point à clarifier.
- Bouton `🎙 Préciser ce point`.
- Bouton `Ignorer / hors sujet`.
- État : `à traiter`, `traité`, `ignoré`.
- Possibilité de relancer une clarification globale après traitement des cartes.

### Critère d’acceptation
Chaque réponse dictée est attachée au bon point flou, sans mélange dans un grand champ global.

---

## P1 — Ajouter une action “Ignorer ce point / ce n’est pas mon sujet”

### Problème observé
L’IA peut proposer des pistes non pertinentes. Il faut permettre à l’utilisateur de refuser un point sans polluer le texte.

Feedback explicite :
- « Si ce point-là n’est pas intéressant, on a la petite croix en dessous pour dire, on zappe. » — 02:53:37
- « Mettre à gauche le micro pour dire je précise ce point. Et peut-être à droite pour dire le sujet ne m’intéresse pas. » — 02:54:16

### Recommandation dev
Sur chaque carte de flou :
- `🎙 Préciser`
- `🚫 Hors sujet`
- éventuellement `Pas prioritaire`

L’IA doit intégrer le rejet : ne pas reposer le même point dans l’itération suivante sauf si l’utilisateur le réactive.

### Critère d’acceptation
Un point ignoré ne revient pas dans la boucle suivante.

---

## P1 — Renforcer les feedbacks visuels après chaque bouton

### Problème observé
Les utilisateurs ne savent pas toujours si l’action a fonctionné :
- « Il faudrait qu'il y ait un petit pop-up qui dise que ça l'a remplacé. » — 02:33:52
- « Il faut qu'il y ait un retour quand on appuie sur un bouton. » — 02:42:08
- « Peut-être que ça a marché. » — 02:42:15

### Recommandation dev
Ajouter feedback systématique :
- Chargement : `Analyse en cours…`
- Succès : `Texte clarifié`, `Pitch copié`, `Point ignoré`, `Dictée ajoutée`.
- Erreur : message clair + action possible.
- Copie : animation ou toast `Copié dans le presse-papiers`.

### Critère d’acceptation
Aucune action utilisateur ne doit rester silencieuse.

---

## P1 — Qualifier/rehausser automatiquement le niveau d’enjeu

### Problème observé
L’application produit parfois des enjeux trop fonctionnels ou trop superficiels. Le bon pitch doit remonter au niveau : responsabilité, risque, impact humain, confiance, perte d’information, décision, argent, sécurité, image.

Évidence :
- « Il faut que l'application qualifie aussi le niveau d’enjeu. » — 03:04:43
- « L’enjeu, c’est l’importance. Ce n’est pas prévenir plus rapidement. » — 03:03:46
- « Les enjeux n’étaient pas de très haut niveau. » — 03:04:43
- « C’est très compliqué quand on est le technicien de son produit de se projeter dans les enjeux parce qu’on est enfermé dans les fonctionnalités. » — 03:04:43

### Recommandation dev
Ajouter une passe IA dédiée : `Rehausser les enjeux`.

Elle doit transformer :
- fonctionnalité → conséquence métier
- attente superficielle → risque / coût / impact
- description produit → enjeu stratégique ou humain

Exemple :
- faible : `traiter plus vite les signalements`
- fort : `réduire le risque de crise mal gérée, protéger la responsabilité du maire, restaurer la confiance des habitants`

### Critère d’acceptation
Le pitch final doit contenir au moins un enjeu de haut niveau clairement formulé avant la solution.

---

## P2 — Limiter et cadrer le nombre d’itérations

### Problème observé
Le cycle peut devenir infini ou répétitif :
- « Si au bout d’un moment tu vois que tu n’avances pas, donc là, c’est fini et tu passes à la suite. » — 02:34:11
- « Maximum trois itérations de mise à jour. » — 02:48:46
- « Trois fois, ça a l’air bien. » — 02:49:10

### Recommandation dev
Limiter par défaut à 3 itérations par bloc :
1. Itération 1 : clarifier les flous majeurs.
2. Itération 2 : approfondir les angles faibles.
3. Itération 3 : finaliser ou passer à la suite.

Après 3 cycles, proposer :
- `Passer au bloc suivant`
- `Forcer une itération supplémentaire`
- `Générer le pitch maintenant`

### Critère d’acceptation
L’utilisateur ne reste pas bloqué dans l’amélioration infinie.

---

## P2 — Rendre le lien de reprise/session beaucoup plus visible

### Problème observé
Un utilisateur a lancé deux sessions différentes sur téléphone et ordinateur. Le lien de récupération existe mais est mal placé :
- « Ce sont deux sessions totalement différentes. Il n’y a pas de cookies. » — 02:55:53
- « T’as un lien en dessous qui est récupéré la session. Tout en bas, mais il est vraiment mal fichu. » — 02:56:04

### Recommandation dev
1. Afficher dès le haut de page : `Sauvegarder / reprendre ma session`.
2. Ajouter `Copier le lien de reprise` après création de session.
3. Envoyer automatiquement le lien par email si email disponible.
4. Ajouter un QR code de reprise pour passer mobile ↔ ordinateur.

### Critère d’acceptation
Un utilisateur peut reprendre sa session sur un autre appareil sans créer de doublon.

---

## P2 — Clarifier l’usage pour les personnes extérieures au projet

### Problème observé
Une stagiaire/personne moins familière du projet s’est perdue, mais son regard extérieur a été utile :
- « C’est un outil qui est fait pour les porteurs. Et comme toi, tu n’es pas très familière avec le projet, tu es d’autant plus perdue. » — 02:43:54
- « Je suis la stagiaire et je ne suis là que depuis 3 semaines et je ne comprends pas bien. » — 02:44:46
- « Ça lui donne des bonnes questions à vous poser. » — 02:57:16

### Recommandation dev
Ajouter un mode/persona au démarrage :
- `Je suis le porteur du projet`
- `Je travaille dans l’équipe`
- `Je découvre le projet / regard extérieur`

Adapter les questions selon le niveau de connaissance.

### Critère d’acceptation
Une personne externe doit pouvoir contribuer utilement sans être bloquée par des questions trop expertes.

---

# 2. Recommandation de nouvelle UX cible

## Écran 1 — Identification simple
- Prénom
- Nom
- Startup/projet
- Email facultatif pour lien de reprise
- Bouton `Commencer`

## Écran 2 — Bloc “Mes forces / mon projet”
- Champ texte principal ou dictée.
- CTA principal : `Repérer ce qui reste flou`.
- Micro flottant mobile.

## Écran 3 — Points flous en cartes
Chaque carte contient :
- Point à clarifier.
- `🎙 Préciser ce point`
- `✍️ Écrire`
- `🚫 Hors sujet`
- État traité/non traité.

CTA : `Clarifier mon texte avec ces réponses`.

## Écran 4 — Texte clarifié
- Texte amélioré.
- Actions : `Valider`, `Refaire une itération`, `Raccourcir`, `Annuler`.
- Indicateur : `Itération 1/3`.

## Écran 5 — Bloc “Enjeux de l’interlocuteur”
Même logique, avec une passe IA spécifique :
- `Rehausser les enjeux`
- `Rendre plus concret`
- `Adapter à une cible précise`

## Écran 6 — Pitch généré
- Pitch final.
- Scores indicatifs : clarté, niveau d’enjeu, concision, bénéfice client.
- Actions : `Raccourcir`, `Rendre plus percutant`, `Copier`, `Partager`, `Sauvegarder`.

---

# 3. Backlog synthétique pour l’agent dev

| Priorité | Ticket | Objectif |
|---|---|---|
| P0 | Ajouter historique + undo | Éviter toute perte/écrasement de texte |
| P0 | Créer bouton `Étape suivante` | Guider le cycle sans mémorisation |
| P0 | Barre mobile flottante de dictée | Supprimer les allers-retours mobile |
| P1 | Transformer les flous en cartes | Répondre point par point |
| P1 | Ajouter `Ignorer / hors sujet` | Éviter les boucles IA non pertinentes |
| P1 | Feedback visuel systématique | Confirmer toute action utilisateur |
| P1 | Passe IA `Rehausser les enjeux` | Sortir des fonctionnalités, aller vers l’impact |
| P2 | Limite 3 itérations par bloc | Éviter boucle infinie |
| P2 | Lien de reprise visible | Passer téléphone ↔ ordinateur sans doublon |
| P2 | Mode “regard extérieur” | Permettre contribution d’un non-porteur |

---

# 4. Prompt prêt à donner à l’agent de développement

```text
Tu dois améliorer l’UX/UI d’une application web de génération de pitch pour startups.

Contexte : l’application aide un porteur de projet à produire un pitch court et puissant via un cycle : décrire son projet → repérer le flou → répondre aux points flous → clarifier → raccourcir → générer le pitch.

Les tests terrain montrent que la valeur métier est forte, mais que l’UX actuelle est trop ambiguë : les utilisateurs ne savent pas toujours quel bouton utiliser, pensent parfois avoir perdu leur texte, doivent remonter/descendre sur mobile pour dicter, et manquent de feedback après action.

Implémente en priorité :
1. Historique local + undo par bloc, pour empêcher toute perte de texte.
2. Bouton principal `Étape suivante`, qui déclenche l’action logique selon l’état courant.
3. Barre flottante mobile avec micro, stop, état d’enregistrement visible.
4. Transformation des points flous en cartes actionnables : `Préciser`, `Écrire`, `Ignorer / hors sujet`.
5. Feedback visuel systématique après chaque action : loading, succès, erreur, copie.
6. Passe IA dédiée `Rehausser les enjeux`, pour transformer les fonctionnalités en enjeux forts : risque, coût, responsabilité, confiance, impact humain, décision.
7. Limite de 3 itérations par bloc, avec possibilité de forcer une itération supplémentaire.
8. Lien de reprise de session visible en haut de page + copie + envoi email si disponible.

Critère global : l’utilisateur doit pouvoir utiliser l’application sur mobile, dicter ses réponses, traiter chaque point flou, comprendre l’étape suivante et finaliser son pitch sans jamais se demander si son texte a disparu ni quelle action lancer ensuite.
```

---

# 5. Points de vigilance produit

1. **Ne pas surcharger l’interface.** La tentation est d’ajouter beaucoup de boutons. La bonne réponse est plutôt un workflow guidé avec une action principale claire.
2. **Ne pas laisser l’IA tourner en rond.** Il faut détecter les répétitions et proposer de passer à la suite.
3. **Ne pas confondre enjeu et fonctionnalité.** C’est le point le plus stratégique pour la qualité du pitch.
4. **Mobile first.** L’usage réel observé montre que le téléphone est central.
5. **Le texte utilisateur est sacré.** Toute transformation doit être visible, réversible et compréhensible.

---

# 6. Conclusion

L’application a validé son intérêt pédagogique et commercial : elle aide réellement les porteurs à sortir d’un discours centré produit pour construire un pitch plus clair, plus ciblé et plus orienté enjeux.

Le chantier prioritaire n’est donc pas de changer le concept, mais de **rendre le cycle d’amélioration évident, sécurisé et fluide**. En pratique : workflow guidé, cartes de flou, dictée mobile flottante, feedbacks visuels, undo, et rehaussement automatique des enjeux.
