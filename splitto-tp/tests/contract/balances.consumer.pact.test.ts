import { describe, it } from 'vitest';
import { MatchersV3, PactV3 } from '@pact-foundation/pact';

const { like, eachLike } = MatchersV3;

describe('Pact Consumer - GET /api/groups/:id/balances', () => {
  const provider = new PactV3({
    consumer: 'splitto-frontend',
    provider: 'splitto-api',
    dir: './pacts',
  });

  it('retourne 200 avec balances quand le groupe existe', async () => {
    provider
      .given('group-1 a 3 membres et 2 dépenses')
      .uponReceiving('GET balances for existing group')
      .withRequest({
        method: 'GET',
        path: '/api/groups/group-1/balances',
      })
      .willRespondWith({
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: {
          groupId: like('group-1'),
          balances: like({
            'm-1': like(20),
            'm-2': like(-10),
            'm-3': like(-10),
          }),
          settlements: eachLike(
            {
              from: like('m-2'),
              to: like('m-1'),
              amount: like(10),
            },
            1,
          ),
        },
      });

    await provider.executeTest(async (mockserver) => {
      const response = await fetch(`${mockserver.url}/api/groups/group-1/balances`);
      await response.json();
    });
  });

  it('retourne 404 quand le groupe n existe pas', async () => {
    provider
      .given('aucun groupe inexistant')
      .uponReceiving('GET balances for missing group')
      .withRequest({
        method: 'GET',
        path: '/api/groups/inexistant/balances',
      })
      .willRespondWith({
        status: 404,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: {
          error: like('Group not found'),
        },
      });

    await provider.executeTest(async (mockserver) => {
      const response = await fetch(`${mockserver.url}/api/groups/inexistant/balances`);
      await response.json();
    });
  });
});
