import { describe, expect, it } from 'vitest';
import { computeBalances } from '../../src/domain/balances';
import type { Expense, Group, Member } from '../../src/domain/types';

const members: Member[] = [
    { id: 'alice', name: 'Alice', email: 'alice@example.com' },
    { id: 'bob', name: 'Bob', email: 'bob@example.com' },
    { id: 'chloe', name: 'Chloe', email: 'chloe@example.com' },
];

const group: Group = {
    id: 'group-1',
    name: 'Trip',
    currency: 'EUR',
    members,
};

function makeExpense(expense: Partial<Expense>): Expense {
    return {
        id: expense.id ?? 'exp-1',
        groupId: expense.groupId ?? group.id,
        description: expense.description ?? 'Test expense',
        amount: expense.amount ?? 0,
        currency: expense.currency ?? 'EUR',
        paidBy: expense.paidBy ?? 'alice',
        paidAt: expense.paidAt ?? new Date('2026-01-01T00:00:00.000Z'),
        createdAt: expense.createdAt ?? new Date('2026-01-01T00:00:00.000Z'),
        split: expense.split ?? { mode: 'equal', beneficiaries: ['alice'] },
        category: expense.category,
    };
}

function expectSumIsZero(balances: Record<string, number>): void {
    const sum = Object.values(balances).reduce((acc, value) => acc + value, 0);
    expect(Number(sum.toFixed(2))).toBe(0);
}

describe('computeBalances', () => {
    it('retourne 0 pour tous les membres quand il n’y a aucune dépense', () => {
        expect(computeBalances(group, [])).toEqual({
            alice: 0,
            bob: 0,
            chloe: 0,
        });
    });

    it('calcule une dépense equal entre 3 avec payeur bénéficiaire', () => {
        const expense = makeExpense({
            amount: 30,
            paidBy: 'alice',
            split: { mode: 'equal', beneficiaries: ['alice', 'bob', 'chloe'] },
        });

        const balances = computeBalances(group, [expense]);
        expect(balances).toEqual({
            alice: 20,
            bob: -10,
            chloe: -10,
        });
        expectSumIsZero(balances);
    });

    it('calcule une dépense equal entre 3 sans payeur bénéficiaire', () => {
        const expense = makeExpense({
            amount: 30,
            paidBy: 'alice',
            split: { mode: 'equal', beneficiaries: ['bob', 'chloe'] },
        });

        const balances = computeBalances(group, [expense]);
        expect(balances).toEqual({
            alice: 30,
            bob: -15,
            chloe: -15,
        });
        expectSumIsZero(balances);
    });

    it('gère plusieurs dépenses qui se compensent partiellement', () => {
        const expenses = [
            makeExpense({
                id: 'exp-1',
                amount: 30,
                paidBy: 'alice',
                split: { mode: 'equal', beneficiaries: ['alice', 'bob', 'chloe'] },
            }),
            makeExpense({
                id: 'exp-2',
                amount: 12,
                paidBy: 'bob',
                split: { mode: 'equal', beneficiaries: ['alice', 'bob'] },
            }),
        ];

        const balances = computeBalances(group, expenses);
        expect(balances).toEqual({
            alice: 14,
            bob: -4,
            chloe: -10,
        });
        expectSumIsZero(balances);
    });

    it('calcule une dépense weighted avec poids non uniformes', () => {
        const expense = makeExpense({
            amount: 80,
            paidBy: 'alice',
            split: { mode: 'weighted', weights: { alice: 1, bob: 1, chloe: 2 } },
        });

        const balances = computeBalances(group, [expense]);
        expect(balances).toEqual({
            alice: 60,
            bob: -20,
            chloe: -40,
        });
        expectSumIsZero(balances);
    });

    it('calcule une dépense percentage avec arrondi au centime', () => {
        const expense = makeExpense({
            amount: 100,
            paidBy: 'alice',
            split: { mode: 'percentage', percentages: { alice: 33.33, bob: 33.33, chloe: 33.34 } },
        });

        const balances = computeBalances(group, [expense]);
        expect(balances).toEqual({
            alice: 66.67,
            bob: -33.33,
            chloe: -33.34,
        });
        expectSumIsZero(balances);
    });

    it('garde une dépense historique avec membre supprimé dans les soldes', () => {
        const expense = makeExpense({
            amount: 30,
            paidBy: 'alice',
            split: { mode: 'equal', beneficiaries: ['alice', 'bob', 'deleted-user'] },
        });

        const balances = computeBalances(group, [expense]);
        expect(balances).toEqual({
            alice: 20,
            bob: -10,
            chloe: 0,
            'deleted-user': -10,
        });
        expectSumIsZero(balances);
    });

    it('ignore une dépense de montant zéro', () => {
        const expense = makeExpense({
            amount: 0,
            paidBy: 'alice',
            split: { mode: 'equal', beneficiaries: ['alice', 'bob'] },
        });

        expect(computeBalances(group, [expense])).toEqual({
            alice: 0,
            bob: 0,
            chloe: 0,
        });
    });

    it('rejette un split percentage qui ne somme pas à 100', () => {
        const expense = makeExpense({
            amount: 100,
            paidBy: 'alice',
            split: { mode: 'percentage', percentages: { alice: 40, bob: 40, chloe: 10 } },
        });

        expect(() => computeBalances(group, [expense])).toThrow(
            'percentage split must sum to 100',
        );
    });
});
