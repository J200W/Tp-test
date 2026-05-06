// src/domain/balances.ts — calcul des soldes d'un groupe
//
// EXERCICE 1 — À COMPLÉTER
//
// Spec : voir SUJET.md, exercice 1
//
// Cette fonction est PURE : pas d'effets de bord, pas d'I/O.
// Elle prend un groupe et ses dépenses, retourne les soldes.

import type { Group, Expense, Balances } from './types';

export function computeBalances(group: Group, expenses: Expense[]): Balances {
    const balances: Balances = {};

    for (const member of group.members) {
        balances[member.id] = 0;
    }

    for (const expense of expenses) {
        const amountInCents = toCents(expense.amount);
        if (amountInCents === 0) {
            continue;
        }

        addCents(balances, expense.paidBy, amountInCents);

        const allocations = buildAllocations(expense, amountInCents);
        for (const [memberId, allocatedCents] of allocations) {
            addCents(balances, memberId, -allocatedCents);
        }
    }

    return roundBalances(balances);
}

function buildAllocations(expense: Expense, amountInCents: number): Map<string, number> {
    switch (expense.split.mode) {
        case 'equal': {
            const beneficiaries = expense.split.beneficiaries;
            if (beneficiaries.length === 0) {
                throw new Error('equal split requires at least one beneficiary');
            }
            return allocateByRatios(
                amountInCents,
                beneficiaries.map((memberId) => [memberId, 1] as const),
            );
        }
        case 'weighted': {
            const entries = Object.entries(expense.split.weights);
            if (entries.length === 0) {
                throw new Error('weighted split requires at least one beneficiary');
            }
            for (const [, weight] of entries) {
                if (weight <= 0) {
                    throw new Error('weighted split requires positive weights');
                }
            }
            return allocateByRatios(amountInCents, entries);
        }
        case 'percentage': {
            const entries = Object.entries(expense.split.percentages);
            if (entries.length === 0) {
                throw new Error('percentage split requires at least one beneficiary');
            }
            const total = entries.reduce((sum, [, percentage]) => sum + percentage, 0);
            if (Math.abs(total - 100) > 0.001) {
                throw new Error('percentage split must sum to 100');
            }
            for (const [, percentage] of entries) {
                if (percentage <= 0) {
                    throw new Error('percentage split requires positive percentages');
                }
            }
            return allocateByRatios(amountInCents, entries);
        }
    }
}

function allocateByRatios(
    amountInCents: number,
    entries: ReadonlyArray<readonly [string, number]>
): Map<string, number> {
    const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);
    if (totalWeight <= 0) {
        throw new Error('split total weight must be positive');
    }

    const provisional = entries.map(([memberId, weight], index) => {
        const exact = (amountInCents * weight) / totalWeight;
        return {
            memberId,
            index,
            floor: Math.floor(exact),
            fractional: exact - Math.floor(exact),
        };
    });

    let distributed = provisional.reduce((sum, item) => sum + item.floor, 0);
    let remaining = amountInCents - distributed;

    provisional.sort((a, b) => {
        if (b.fractional !== a.fractional) {
            return b.fractional - a.fractional;
        }
        return a.index - b.index;
    });

    for (const item of provisional) {
        if (remaining === 0) {
            break;
        }
        item.floor += 1;
        remaining -= 1;
        distributed += 1;
    }

    if (distributed !== amountInCents) {
        throw new Error('could not allocate full expense amount');
    }

    const result = new Map<string, number>();
    for (const item of provisional) {
        result.set(item.memberId, (result.get(item.memberId) ?? 0) + item.floor);
    }
    return result;
}


function addCents(balances: Balances, memberId: string, deltaInCents: number): void {
    const current = balances[memberId] ?? 0;
    balances[memberId] = current + deltaInCents / 100;
}

function toCents(amount: number): number {
    return Math.round(amount * 100);
}

function roundBalances(balances: Balances): Balances {
    const rounded: Balances = {};
    for (const [memberId, balance] of Object.entries(balances)) {
        rounded[memberId] = Number(balance.toFixed(2));
    }
    return rounded;
}
