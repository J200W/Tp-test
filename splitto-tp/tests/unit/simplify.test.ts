import { describe, expect, it } from 'vitest';
import { simplifyDebts } from '../../src/domain/simplify';

describe('simplifyDebts', () => {
  it('retourne un règlement pour 2 personnes', () => {
    expect(simplifyDebts({ a: 10, b: -10 })).toEqual([
      { from: 'b', to: 'a', amount: 10 },
    ]);
  });

  it('supprime les intermédiaires inutiles dans un cas triangle', () => {
    expect(simplifyDebts({ a: 10, b: 0, c: -10 })).toEqual([
      { from: 'c', to: 'a', amount: 10 },
    ]);
  });
});
