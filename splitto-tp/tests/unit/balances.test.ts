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

    it('répartit le centime résiduel selon la plus grande fraction en weighted', () => {
        const expense = makeExpense({
            amount: 10,
            paidBy: 'alice',
            split: { mode: 'weighted', weights: { alice: 2, bob: 1, chloe: 3 } },
        });

        const balances = computeBalances(group, [expense]);
        expect(balances).toEqual({
            alice: 6.67,
            bob: -1.67,
            chloe: -5,
        });
        expectSumIsZero(balances);
    });

    it('rejette un split equal sans bénéficiaire', () => {
        const expense = makeExpense({
            amount: 10,
            split: { mode: 'equal', beneficiaries: [] },
        });

        expect(() => computeBalances(group, [expense])).toThrow(
            'equal split requires at least one beneficiary',
        );
    });

    it('rejette un split weighted avec poids négatif', () => {
        const expense = makeExpense({
            amount: 10,
            split: { mode: 'weighted', weights: { alice: 1, bob: -1 } },
        });

        expect(() => computeBalances(group, [expense])).toThrow(
            'weighted split requires positive weights',
        );
    });

    it('rejette un split weighted avec un poids à zéro', () => {
        const expense = makeExpense({
            amount: 10,
            split: { mode: 'weighted', weights: { alice: 1, bob: 0 } },
        });

        expect(() => computeBalances(group, [expense])).toThrow(
            'weighted split requires positive weights',
        );
    });

    it('rejette un split weighted sans aucun bénéficiaire', () => {
        const expense = makeExpense({
            amount: 10,
            split: { mode: 'weighted', weights: {} },
        });

        expect(() => computeBalances(group, [expense])).toThrow(
            'weighted split requires at least one beneficiary',
        );
    });

    it('rejette un split percentage avec un pourcentage à zéro', () => {
        const expense = makeExpense({
            amount: 100,
            paidBy: 'alice',
            split: {
                mode: 'percentage',
                percentages: { alice: 50, bob: 50, chloe: 0 },
            },
        });

        expect(() => computeBalances(group, [expense])).toThrow(
            'percentage split requires positive percentages',
        );
    });

    it('rejette un split percentage sans aucune ligne', () => {
        const expense = makeExpense({
            amount: 100,
            split: { mode: 'percentage', percentages: {} },
        });

        expect(() => computeBalances(group, [expense])).toThrow(
            'percentage split requires at least one beneficiary',
        );
    });

    it('attribue un centime en cas d égalité des fractions selon l ordre des bénéficiaires', () => {
        const expense = makeExpense({
            amount: 0.01,
            paidBy: 'alice',
            split: { mode: 'equal', beneficiaries: ['chloe', 'alice', 'bob'] },
        });

        const balances = computeBalances(group, [expense]);
        expect(balances).toEqual({
            alice: 0.01,
            bob: 0,
            chloe: -0.01,
        });
        expectSumIsZero(balances);
    });

    it('retourne un objet vide pour un groupe sans aucun membre', () => {
        const emptyGroup: Group = {
            id: 'empty',
            name: 'Vide',
            currency: 'EUR',
            members: [],
        };

        expect(computeBalances(emptyGroup, [])).toEqual({});
    });

    it('calcule une dépense equal avec un seul bénéficiaire égal au payeur', () => {
        const soloGroup: Group = {
            id: 'solo',
            name: 'Solo',
            currency: 'EUR',
            members: [{ id: 'alice', name: 'Alice', email: 'alice@example.com' }],
        };

        const expense = makeExpense({
            groupId: soloGroup.id,
            amount: 100,
            paidBy: 'alice',
            split: { mode: 'equal', beneficiaries: ['alice'] },
        });

        expect(computeBalances(soloGroup, [expense])).toEqual({ alice: 0 });
    });

    it('répartit une dépense equal sur plus de 10 membres', () => {
        const manyMembers: Member[] = Array.from({ length: 11 }, (_, i) => ({
            id: `m${i}`,
            name: `Member ${i}`,
            email: `m${i}@example.com`,
        }));

        const bigGroup: Group = {
            id: 'big',
            name: 'Big trip',
            currency: 'EUR',
            members: manyMembers,
        };

        const expense = makeExpense({
            groupId: bigGroup.id,
            amount: 110,
            paidBy: 'm0',
            split: { mode: 'equal', beneficiaries: manyMembers.map((m) => m.id) },
        });

        const balances = computeBalances(bigGroup, [expense]);
        expect(balances.m0).toBe(100);
        for (let i = 1; i <= 10; i += 1) {
            expect(balances[`m${i}`]).toBe(-10);
        }
        expectSumIsZero(balances);
    });
});
