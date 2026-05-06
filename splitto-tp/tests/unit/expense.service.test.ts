import { describe, expect, it } from 'vitest';
import { ExpenseService } from '../../src/domain/expense.service';
import type { CreateExpenseInput, Expense } from '../../src/domain/types';
import type { ExpenseRepository } from '../../src/ports/expense.repository';
import type { EmailNotifier } from '../../src/ports/notifier';
import type { Clock } from '../../src/ports/clock';
import type { IdGenerator } from '../../src/ports/id-generator';
import type { Logger } from '../../src/ports/logger';

/**
 * Fake implémentation de ExpenseRepository pour les tests unitaires.
 * Cette implémentation stocke les expenses dans une map en mémoire.
 */
class InMemoryExpenseRepositoryFake implements ExpenseRepository {
    private readonly items = new Map<string, Expense>();

    async save(expense: Expense): Promise<void> {
        this.items.set(expense.id, expense);
    }

    async findById(id: string): Promise<Expense | null> {
        return this.items.get(id) ?? null;
    }

    async findByGroupId(groupId: string): Promise<Expense[]> {
        return Array.from(this.items.values()).filter((item) => item.groupId === groupId);
    }

    async findInDateRange(groupId: string, from: Date, to: Date): Promise<Expense[]> {
        return Array.from(this.items.values()).filter((item) => {
            return item.groupId === groupId && item.paidAt >= from && item.paidAt <= to;
        });
    }
}

describe('ExpenseService.create', () => {
    const fixedNow = new Date('2026-01-10T12:00:00.000Z');
    const baseInput: CreateExpenseInput = {
        groupId: 'group-1',
        description: 'Restaurant',
        amount: 150,
        currency: 'EUR',
        paidBy: 'alice',
        paidAt: new Date('2026-01-10T11:00:00.000Z'),
        split: { mode: 'equal', beneficiaries: ['alice', 'bob'] },
        category: 'food',
    };

    it('crée une expense, la sauvegarde et notifie si montant >= 100', async () => {
        // ─── FAKE ───────────────────────────────────────
        const fakeRepo = new InMemoryExpenseRepositoryFake();

        // ─── STUB ───────────────────────────────────────
        const stubClock: Clock = {
            now: () => fixedNow,
        };

        // ─── SPY ────────────────────────────────────────
        const notifierSpyCalls: Array<{ groupId: string; message: string }> = [];
        const spyNotifier: EmailNotifier = {
            notifyGroupMembers: async (groupId, message) => {
                notifierSpyCalls.push({ groupId, message });
            },
        };

        // ─── MOCK ───────────────────────────────────────
        const mockIdGen: IdGenerator & { calls: number } = {
            calls: 0,
            next() {
                this.calls += 1;
                return 'exp-123';
            },
        };

        // ─── DUMMY ──────────────────────────────────────
        const dummyLogger: Logger = {
            info: () => { },
            error: () => { },
        };

        const expenseService = new ExpenseService(
            fakeRepo,
            spyNotifier,
            stubClock,
            mockIdGen,
            dummyLogger,
        );

        const created = await expenseService.create(baseInput);

        expect(created).toEqual({
            ...baseInput,
            id: 'exp-123',
            createdAt: fixedNow,
        });

        const fromRepo = await fakeRepo.findById('exp-123');
        expect(fromRepo).toEqual(created);

        expect(mockIdGen.calls).toBe(1);
        expect(notifierSpyCalls).toEqual([
            {
                groupId: 'group-1',
                message: 'Nouvelle dépense importante : Restaurant (150€)',
            },
        ]);
    });

    it("ne notifie pas si montant < 100", async () => {
        const fakeRepo = new InMemoryExpenseRepositoryFake();
        const stubClock: Clock = { now: () => fixedNow };
        const notifierSpyCalls: Array<{ groupId: string; message: string }> = [];
        const spyNotifier: EmailNotifier = {
            notifyGroupMembers: async (groupId, message) => {
                notifierSpyCalls.push({ groupId, message });
            },
        };
        const mockIdGen: IdGenerator = { next: () => 'exp-456' };
        const dummyLogger: Logger = { info: () => { }, error: () => { } };

        const expenseService = new ExpenseService(
            fakeRepo,
            spyNotifier,
            stubClock,
            mockIdGen,
            dummyLogger,
        );

        await expenseService.create({
            ...baseInput,
            amount: 99.99,
            description: 'Café',
        });

        expect(notifierSpyCalls).toHaveLength(0);
        expect(await fakeRepo.findById('exp-456')).not.toBeNull();
    });
});
