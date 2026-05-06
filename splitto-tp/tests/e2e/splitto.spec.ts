import { expect, test } from '@playwright/test';
import { HomePage } from './pages/home.page';
import { GroupPage } from './pages/group.page';

const MEMBERS = `Alice <alice@example.com>
Bob <bob@example.com>
Charlie <charlie@example.com>`;

test.beforeEach(async ({ request }) => {
  await request.post('/_test/reset');
});

test('créer un groupe avec 3 membres', async ({ page }) => {
  const home = new HomePage(page);
  const groupName = `Trip E2E ${Date.now()}`;

  await home.goto();
  await home.createGroup({
    name: groupName,
    currency: 'EUR',
    membersMultiline: MEMBERS,
  });

  await expect(page.getByRole('listitem')).toHaveCount(1);
  await expect(page.getByRole('listitem').first()).toBeVisible();
});

test('ajouter une dépense dans un groupe existant', async ({ page }) => {
  const home = new HomePage(page);
  const group = new GroupPage(page);
  const groupName = `Expense E2E ${Date.now()}`;

  await home.goto();
  await home.createGroup({
    name: groupName,
    currency: 'EUR',
    membersMultiline: MEMBERS,
  });
  await home.openFirstGroup();

  await group.addExpense({
    description: 'Pizza',
    amount: '18',
    paidBy: 'Alice',
    beneficiaries: ['Alice', 'Bob', 'Charlie'],
  });

  await expect(group.expenseRow('Pizza')).toBeVisible();
});

test('voir les soldes mis à jour après une dépense de 30€', async ({ page }) => {
  const home = new HomePage(page);
  const group = new GroupPage(page);
  const groupName = `Balances E2E ${Date.now()}`;

  await home.goto();
  await home.createGroup({
    name: groupName,
    currency: 'EUR',
    membersMultiline: MEMBERS,
  });
  await home.openFirstGroup();

  await group.addExpense({
    description: 'Course',
    amount: '30',
    paidBy: 'Alice',
    beneficiaries: ['Alice', 'Bob', 'Charlie'],
  });

  await expect(group.balanceRow('Alice', '20.00 EUR')).toBeVisible();
  await expect(group.balanceRow('Bob', '-10.00 EUR')).toBeVisible();
  await expect(group.balanceRow('Charlie', '-10.00 EUR')).toBeVisible();
});

test('marquer un règlement comme réglé', async ({ page }) => {
  const home = new HomePage(page);
  const group = new GroupPage(page);
  const groupName = `Settle E2E ${Date.now()}`;

  await home.goto();
  await home.createGroup({
    name: groupName,
    currency: 'EUR',
    membersMultiline: MEMBERS,
  });
  await home.openFirstGroup();

  await group.addExpense({
    description: 'Taxi',
    amount: '30',
    paidBy: 'Alice',
    beneficiaries: ['Alice', 'Bob', 'Charlie'],
  });

  await group.settleFirstSuggestion();
  await expect(page.getByTestId('settlement-row-0')).toHaveCount(0);
});
