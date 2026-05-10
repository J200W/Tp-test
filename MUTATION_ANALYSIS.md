# Analyse des mutations

## Score initial

- balances.ts : 59,81 %
- simplify.ts : 82,46 %

## Score final

- balances.ts : 88,79 %
- simplify.ts : 89,47 %

## Synthèse des captures (`stryker-report-before.png`, `stryker-report-after.png`)

Les pourcentages ci-dessus correspondent au score **Total** par fichier dans le rapport Stryker (vue « All files » / détail par fichier).


| Indicateur                                       | Avant        | Après      |
| ------------------------------------------------ | ------------ | ---------- |
| **Tous fichiers** — score Total                  | 67,68 %      | 89,02 %    |
| **Tous fichiers** — score Covered                | 76,03 %      | 91,25 %    |
| **balances.ts** — tués / survivants / sans couv. | 64 / 26 / 17 | 95 / 8 / 4 |
| **simplify.ts** — tués / survivants / timeout    | 42 / 9 / 5   | 46 / 6 / 5 |


Objectif du sujet (≥ 80 % sur **balances.ts** et **simplify.ts**) : **non atteint** sur `balances.ts` au premier run ; **atteint** pour les deux fichiers après renforcement des tests et exécution de Stryker via `vitest.unit.config.ts` (tests unitaires uniquement).

## Mutants survivants après amélioration

### Mutant 1 : ignore du traitement « montant arrondi à 0 centime »

- Fichier : `balances.ts` (condition sur `amountInCents` dans la boucle des dépenses)
- Mutation : `===` neutralisé ou branche du `if` supprimée (équivalent à ne plus court-circuiter les montants nuls)
- Pourquoi il survit : traiter une dépense à 0 centime comme les autres laisse souvent les mêmes soldes après arrondi qu’un `continue`
- Décision : accepté

### Mutant 2 : validation `percentage` — comparaison à la tolérance 0,001

- Fichier : `balances.ts` (somme des pourcentages)
- Mutation : `>` → `>=` sur `Math.abs(total - 100)` par rapport à `0.001`
- Pourquoi il survit : les jeux de données des tests ne distinguent pas ce cas limite des flottants
- Décision : accepté

### Mutant 3 : garde `totalWeight` et cohérence `distributed` dans `allocateByRatios`

- Fichier : `balances.ts` (`allocateByRatios`)
- Mutation : bloc `if (totalWeight <= 0)` ou `if (distributed !== amountInCents)` supprimé ; parfois « no coverage »
- Pourquoi il survit : chemins rarement ou jamais empruntés avec les splits valides actuels
- Décision : accepté (code défensif)

### Mutant 4 : comparateur de tri (fractions / index)

- Fichier : `balances.ts` (tri avant répartition des centimes résiduels)
- Mutation : condition du tri forcée à `true`, ou opération sur `index` modifiée (ex. `-` → `+`)
- Pourquoi il survit : les soldes attendus restent identiques pour plusieurs ordres d’arrondi possibles
- Décision : accepté

### Mutant 5 : chaîne passée à `buildParticipants`

- Fichier : `simplify.ts`
- Mutation : littéral `"debtor"` / `"creditor"` remplacé par une chaîne incorrecte
- Pourquoi il survit : les soldes testés ne suffisent pas à révéler l’erreur dans tous les cas
- Décision : accepté

### Mutant 6 : condition de la boucle `while` sur créditeurs et débiteurs

- Fichier : `simplify.ts`
- Mutation : borne sur `j` ou `debtors.length` altérée ; certains scénarios se soldent par **timeout** plutôt qu’échec net
- Pourquoi il survit : même nombre de mutants non détectés ; timeouts mal classés côté score
- Décision : accepté pour ce rendu

### Mutant 7 : prédicats `amount > 0` / `amount < 0` dans le filtre des participants

- Fichier : `simplify.ts` (`buildParticipants`)
- Mutation : `>` → `>=`, `<` → `<=`, ou filtre relâché
- Pourquoi il survit : absence de cas avec montant exactement 0 devant être classé comme débiteur ou créditeur
- Décision : accepté

