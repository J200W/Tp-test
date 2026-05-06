// src/domain/simplify.ts — simplification des dettes
//
// EXERCICE 2 — À COMPLÉTER EN TDD STRICT
//
// Spec : voir SUJET.md, exercice 2
//
// Le but : transformer un dictionnaire de soldes en LISTE MINIMALE
// de règlements pour solder le groupe.

import type { Balances, Settlement } from './types';

export function simplifyDebts(balances: Balances): Settlement[] {
  const creditors = Object.entries(balances)
    .filter(([, amount]) => amount > 0)
    .map(([memberId, amount]) => ({ memberId, amount }));
  const debtors = Object.entries(balances)
    .filter(([, amount]) => amount < 0)
    .map(([memberId, amount]) => ({ memberId, amount: -amount }));

  const settlements: Settlement[] = [];
  let i = 0;
  let j = 0;

  while (i < creditors.length && j < debtors.length) {
    const creditor = creditors[i];
    const debtor = debtors[j];
    const transfer = Math.min(creditor.amount, debtor.amount);

    settlements.push({
      from: debtor.memberId,
      to: creditor.memberId,
      amount: Number(transfer.toFixed(2)),
    });

    creditor.amount = Number((creditor.amount - transfer).toFixed(2));
    debtor.amount = Number((debtor.amount - transfer).toFixed(2));

    if (creditor.amount === 0) i += 1;
    if (debtor.amount === 0) j += 1;
  }

  return settlements;
}
