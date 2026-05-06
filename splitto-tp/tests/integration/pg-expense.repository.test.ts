import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { PgExpenseRepository } from '../../src/infrastructure/pg-expense.repository';
import type { Expense } from '../../src/domain/types';

let container: StartedPostgreSqlContainer;
let pool: Pool;
let repo: PgExpenseRepository;
let seq = 0;

beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine')
        .withDatabase('splitto')
        .withUsername('splitto')
        .withPassword('splitto')
        .start();

    pool = new Pool({ connectionString: container.getConnectionUri() });
    repo = new PgExpenseRepository(pool);

    const migrationSql = readFileSync(
        resolve(process.cwd(), 'migrations', '001-initial.sql'),
        'utf8',
    );
    await pool.query(migrationSql);
}, 120_000);

afterAll(async () => {
    await pool?.end();
    await container?.stop();
});

beforeEach(async () => {
    // Supprime toutes les expenses de la base de données avant chaque test.
    await pool.query('TRUNCATE expenses CASCADE');
});

// Génère des identifiants uniques pour les groupes, les membres et les expenses.
function makeIds(prefix: string) {
    seq += 1;
    return {
        groupId: `${prefix}-g-${seq}`,
        aliceId: `${prefix}-alice-${seq}`,
        bobId: `${prefix}-bob-${seq}`,
    };
}

// Crée un groupe et ses membres dans la base de données.
async function seedGroupAndMembers(groupId: string, aliceId: string, bobId: string): Promise<void> {
    await pool.query('INSERT INTO groups (id, name, currency) VALUES ($1, $2, $3)', [
        groupId,
        `Group ${groupId}`,
        'EUR',
    ]);
    await pool.query(
        'INSERT INTO members (id, group_id, name, email) VALUES ($1, $2, $3, $4), ($5, $2, $6, $7)',
        [aliceId, groupId, 'Alice', 'alice@example.com', bobId, 'Bob', 'bob@example.com'],
    );
}

function makeExpense(params: {
    id: string;
    groupId: string;
    paidBy: string;
    amount: number;
    paidAt: string;
    description?: string;
}): Expense {
    return {
        id: params.id,
        groupId: params.groupId,
        description: params.description ?? 'Diner',
        amount: params.amount,
        currency: 'EUR',
        paidBy: params.paidBy,
        paidAt: new Date(params.paidAt),
        split: { mode: 'equal', beneficiaries: [params.paidBy] },
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        category: 'food',
    };
}

describe('PgExpenseRepository integration', () => {
    it('save() puis findById() retourne l expense identique', async () => {
        const { groupId, aliceId, bobId } = makeIds('findbyid');
        await seedGroupAndMembers(groupId, aliceId, bobId);

        const expense = makeExpense({
            id: 'exp-findbyid',
            groupId,
            paidBy: aliceId,
            amount: 42.5,
            paidAt: '2026-01-10T10:00:00.000Z',
        });

        await repo.save(expense);
        const found = await repo.findById(expense.id);

        expect(found).toEqual(expense);
    });

    it('findByGroupId() retourne uniquement les expenses du groupe demandé', async () => {
        const idsA = makeIds('ga');
        const idsB = makeIds('gb');
        await seedGroupAndMembers(idsA.groupId, idsA.aliceId, idsA.bobId);
        await seedGroupAndMembers(idsB.groupId, idsB.aliceId, idsB.bobId);

        await repo.save(
            makeExpense({
                id: 'exp-a-1',
                groupId: idsA.groupId,
                paidBy: idsA.aliceId,
                amount: 20,
                paidAt: '2026-01-10T10:00:00.000Z',
            }),
        );
        await repo.save(
            makeExpense({
                id: 'exp-b-1',
                groupId: idsB.groupId,
                paidBy: idsB.aliceId,
                amount: 30,
                paidAt: '2026-01-11T10:00:00.000Z',
            }),
        );

        const onlyA = await repo.findByGroupId(idsA.groupId);

        expect(onlyA).toHaveLength(1);
        expect(onlyA[0]?.groupId).toBe(idsA.groupId);
        expect(onlyA[0]?.id).toBe('exp-a-1');
    });

    it('findInDateRange() filtre correctement avec bornes inclusives', async () => {
        const { groupId, aliceId, bobId } = makeIds('daterange');
        await seedGroupAndMembers(groupId, aliceId, bobId);

        await repo.save(
            makeExpense({
                id: 'exp-before',
                groupId,
                paidBy: bobId,
                amount: 5,
                paidAt: '2026-01-09T23:59:59.000Z',
            }),
        );
        await repo.save(
            makeExpense({
                id: 'exp-from',
                groupId,
                paidBy: aliceId,
                amount: 10,
                paidAt: '2026-01-10T00:00:00.000Z',
            }),
        );
        await repo.save(
            makeExpense({
                id: 'exp-middle',
                groupId,
                paidBy: aliceId,
                amount: 15,
                paidAt: '2026-01-12T10:00:00.000Z',
            }),
        );
        await repo.save(
            makeExpense({
                id: 'exp-to',
                groupId,
                paidBy: bobId,
                amount: 25,
                paidAt: '2026-01-15T00:00:00.000Z',
            }),
        );

        const found = await repo.findInDateRange(
            groupId,
            new Date('2026-01-10T00:00:00.000Z'),
            new Date('2026-01-15T00:00:00.000Z'),
        );

        expect(found.map((e) => e.id)).toEqual(['exp-from', 'exp-middle', 'exp-to']);
    });

    it('la contrainte unique rejette un doublon', async () => {
        const { groupId, aliceId, bobId } = makeIds('unique');
        await seedGroupAndMembers(groupId, aliceId, bobId);

        const first = makeExpense({
            id: 'exp-unique-1',
            groupId,
            paidBy: aliceId,
            amount: 60,
            paidAt: '2026-01-20T10:00:00.000Z',
        });
        const duplicate = makeExpense({
            id: 'exp-unique-2',
            groupId,
            paidBy: aliceId,
            amount: 60,
            paidAt: '2026-01-20T10:00:00.000Z',
            description: 'duplicate',
        });

        await repo.save(first);
        await expect(repo.save(duplicate)).rejects.toThrow();
    });

    it('une transaction en échec rollback proprement', async () => {
        const { groupId, aliceId, bobId } = makeIds('tx');
        await seedGroupAndMembers(groupId, aliceId, bobId);

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query(
                `INSERT INTO expenses (id, group_id, description, amount, currency, paid_by, paid_at, split_mode, split_data, category, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11)`,
                [
                    'exp-tx-1',
                    groupId,
                    'first',
                    80,
                    'EUR',
                    aliceId,
                    new Date('2026-01-25T10:00:00.000Z'),
                    'equal',
                    JSON.stringify({ mode: 'equal', beneficiaries: [aliceId] }),
                    'food',
                    new Date('2026-01-01T00:00:00.000Z'),
                ],
            );

            await client.query(
                `INSERT INTO expenses (id, group_id, description, amount, currency, paid_by, paid_at, split_mode, split_data, category, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11)`,
                [
                    'exp-tx-2',
                    groupId,
                    'duplicate',
                    80,
                    'EUR',
                    aliceId,
                    new Date('2026-01-25T10:00:00.000Z'),
                    'equal',
                    JSON.stringify({ mode: 'equal', beneficiaries: [aliceId] }),
                    'food',
                    new Date('2026-01-01T00:00:00.000Z'),
                ],
            );

            await client.query('COMMIT');
        } catch {
            await client.query('ROLLBACK');
        } finally {
            client.release();
        }

        const afterRollback = await repo.findByGroupId(groupId);
        expect(afterRollback).toEqual([]);
    });
});
