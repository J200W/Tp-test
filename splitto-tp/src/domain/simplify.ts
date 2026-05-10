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
  assertBalancesConsistent(balances);

  const creditors = buildParticipants(balances, 'creditor');
  const debtors = buildParticipants(balances, 'debtor');

  creditors.sort((a, b) => b.amountInCents - a.amountInCents);
  debtors.sort((a, b) => b.amountInCents - a.amountInCents);

  const settlements: Settlement[] = [];
  let i = 0;
  let j = 0;

  while (i < creditors.length && j < debtors.length) {
    const creditor = creditors[i];
    const debtor = debtors[j];
    const transfer = Math.min(creditor.amountInCents, debtor.amountInCents);

    settlements.push({
      from: debtor.memberId,
      to: creditor.memberId,
      amount: centsToAmount(transfer),
    });

    creditor.amountInCents -= transfer;
    debtor.amountInCents -= transfer;

    if (creditor.amountInCents === 0) i += 1;
    if (debtor.amountInCents === 0) j += 1;
  }

  return settlements;
}

/** Tolérance ~ 2 centimes pour les erreurs d’arrondi flottant sur la somme des soldes. */
function assertBalancesConsistent(balances: Balances): void {
  const sum = Object.values(balances).reduce((s, value) => s + value, 0);
  if (Math.abs(sum) > 0.02) {
    throw new Error('balances must sum to zero');
  }
}

function toCents(amount: number): number {
  return Math.round(amount * 100);
}

function centsToAmount(cents: number): number {
  return Number((cents / 100).toFixed(2));
}

function buildParticipants(
  balances: Balances,
  kind: 'creditor' | 'debtor',
): Array<{ memberId: string; amountInCents: number }> {
  return Object.entries(balances)
    .filter(([, amount]) => (kind === 'creditor' ? amount > 0 : amount < 0))
    .map(([memberId, amount]) => ({
      memberId,
      amountInCents: toCents(kind === 'creditor' ? amount : -amount),
    }));
}
