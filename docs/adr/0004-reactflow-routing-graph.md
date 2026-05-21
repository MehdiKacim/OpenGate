# ADR 0004 : ReactFlow pour le graph de routing

## Contexte

La spécification exige une vue graphique du routing : Request → Route Profile → Expert → Keyword → Provider → Model → Response.

## Décision

Utiliser `reactflow` dans l’UI web pour afficher le dernier événement de routing sous forme de graphe orienté.

## Conséquences

- Dépendance frontale supplémentaire (~360 kB bundle).
- Le graph est un outil d’observabilité, pas un moteur d’exécution.
- Les données viennent de la table `routing_events` via polling.
