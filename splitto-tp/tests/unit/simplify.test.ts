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

  it('retourne 2 règlements minimum pour un cas à 4 personnes', () => {
    expect(simplifyDebts({ a: 30, b: -20, c: -10, d: 0 })).toEqual([
      { from: 'b', to: 'a', amount: 20 },
      { from: 'c', to: 'a', amount: 10 },
    ]);
  });

  it('retourne une liste vide si les comptes sont déjà équilibrés', () => {
    expect(simplifyDebts({ a: 0, b: 0, c: 0 })).toEqual([]);
  });

  it('gère les montants avec centimes sans perdre de précision', () => {
    expect(simplifyDebts({ alice: 66.67, bob: -33.33, chloe: -33.34 })).toEqual([
      { from: 'chloe', to: 'alice', amount: 33.34 },
      { from: 'bob', to: 'alice', amount: 33.33 },
    ]);
  });

  it('ignore les micro-écarts flottants proches de zéro', () => {
    expect(simplifyDebts({ a: 10.0000001, b: -10, c: -0.0000001 })).toEqual([
      { from: 'b', to: 'a', amount: 10 },
    ]);
  });

  it('gère un cas avec deux créditeurs et deux débiteurs', () => {
    expect(simplifyDebts({ a: 10, d: 5, b: -12, c: -3 })).toEqual([
      { from: 'b', to: 'a', amount: 10 },
      { from: 'b', to: 'd', amount: 2 },
      { from: 'c', to: 'd', amount: 3 },
    ]);
  });

  it('trie les créditeurs par montant décroissant avant les règlements', () => {
    expect(simplifyDebts({ a: 5, d: 10, b: -12, c: -3 })).toEqual([
      { from: 'b', to: 'd', amount: 10 },
      { from: 'b', to: 'a', amount: 2 },
      { from: 'c', to: 'a', amount: 3 },
    ]);
  });

  it('ne génère jamais de règlement à 0', () => {
    const settlements = simplifyDebts({ a: 20, b: 0, c: -20, d: 0 });
    expect(settlements).toEqual([{ from: 'c', to: 'a', amount: 20 }]);
    expect(settlements.every((s) => s.amount > 0)).toBe(true);
  });

  it('rejette une carte de soldes dont la somme globale n’est pas nulle', () => {
    expect(() => simplifyDebts({ a: 10, b: -5 })).toThrow('balances must sum to zero');
  });

  it('rejette une carte de soldes contenant NaN ou Infinity', () => {
    expect(() => simplifyDebts({ a: 10, b: Number.NaN })).toThrow(
      'balances must contain finite numbers',
    );
  });
});
