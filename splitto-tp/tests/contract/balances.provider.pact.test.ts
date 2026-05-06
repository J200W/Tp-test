import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, it } from 'vitest';
import { Pool } from 'pg';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { Server } from 'node:http';
import { Verifier } from '@pact-foundation/pact';
import { createApp } from '../../src/server';

describe('Pact Provider - splitto-api', () => {
  let container: StartedPostgreSqlContainer;
  let pool: Pool;
  let server: Server;
  let baseUrl = '';

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('splitto')
      .withUsername('splitto')
      .withPassword('splitto')
      .start();

    pool = new Pool({ connectionString: container.getConnectionUri() });

    const migrationSql = readFileSync(
      resolve(process.cwd(), 'migrations', '001-initial.sql'),
      'utf8',
    );
    await pool.query(migrationSql);

    const app = createApp(pool);
    await new Promise<void>((resolveListen) => {
      server = app.listen(0, '127.0.0.1', () => resolveListen());
    });
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Could not resolve provider server address');
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  }, 120_000);

  afterAll(async () => {
    await new Promise<void>((resolveClose, rejectClose) => {
      server.close((err) => {
        if (err) rejectClose(err);
        else resolveClose();
      });
    });
    await pool?.end();
    await container?.stop();
  });

  it('vérifie le contrat consumer généré', async () => {
    const verifier = new Verifier({
      provider: 'splitto-api',
      providerBaseUrl: baseUrl,
      pactUrls: [resolve(process.cwd(), 'pacts', 'splitto-frontend-splitto-api.json')],
      stateHandlers: {
        'group-1 a 3 membres et 2 dépenses': async () => {
          await pool.query('TRUNCATE groups CASCADE');

          await pool.query('INSERT INTO groups (id, name, currency) VALUES ($1, $2, $3)', [
            'group-1',
            'Trip',
            'EUR',
          ]);

          await pool.query(
            `INSERT INTO members (id, group_id, name, email) VALUES
             ($1, $2, $3, $4),
             ($5, $2, $6, $7),
             ($8, $2, $9, $10)`,
            [
              'm-1',
              'group-1',
              'Alice',
              'alice@example.com',
              'm-2',
              'Bob',
              'bob@example.com',
              'm-3',
              'Chloe',
              'chloe@example.com',
            ],
          );

          await pool.query(
            `INSERT INTO expenses (
               id, group_id, description, amount, currency, paid_by, paid_at, split_mode, split_data, category, created_at
             ) VALUES
             ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11),
             ($12, $2, $13, $14, $5, $15, $16, $8, $17::jsonb, $10, $11)`,
            [
              'exp-1',
              'group-1',
              'Restaurant',
              30,
              'EUR',
              'm-1',
              new Date('2026-01-10T10:00:00.000Z'),
              'equal',
              JSON.stringify({ mode: 'equal', beneficiaries: ['m-1', 'm-2', 'm-3'] }),
              'food',
              new Date('2026-01-10T10:00:00.000Z'),
              'exp-2',
              'Taxi',
              12,
              'm-2',
              new Date('2026-01-11T10:00:00.000Z'),
              JSON.stringify({ mode: 'equal', beneficiaries: ['m-1', 'm-2'] }),
            ],
          );
        },
        'aucun groupe inexistant': async () => {
          await pool.query('TRUNCATE groups CASCADE');
        },
      },
    });

    await verifier.verifyProvider();
  });
});
