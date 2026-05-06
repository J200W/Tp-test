import { expect, type Locator, type Page } from '@playwright/test';

export class GroupPage {
  constructor(private readonly page: Page) {}

  async addExpense(params: {
    description: string;
    amount: string;
    paidBy: string;
    beneficiaries: string[];
  }): Promise<void> {
    await this.page.getByRole('button', { name: 'Ajouter une dépense' }).click();
    const dialog = this.page.getByRole('dialog', { name: 'Ajouter une dépense' });
    await dialog.waitFor();

    await dialog.getByLabel('Description').fill(params.description);
    await dialog.getByLabel('Montant').fill(params.amount);
    await dialog.getByLabel('Payé par').selectOption({ label: params.paidBy });

    const allBeneficiaryCheckboxes = dialog.getByRole('checkbox');
    for (const [index, member] of ['Alice', 'Bob', 'Charlie'].entries()) {
      const shouldBeChecked = params.beneficiaries.includes(member);
      await allBeneficiaryCheckboxes.nth(index).setChecked(shouldBeChecked);
    }

    await dialog.getByRole('button', { name: 'Ajouter' }).click();
  }

  expenseRow(description: string): Locator {
    return this.page.getByRole('row', { name: new RegExp(description) });
  }

  balanceRow(memberName: string, expectedAmount: string): Locator {
    return this.page.getByRole('row', {
      name: new RegExp(`${memberName}\\s+${expectedAmount}`),
    });
  }

  async settleFirstSuggestion(): Promise<void> {
    await expect(this.page.getByTestId('settlement-row-0')).toBeVisible();
    await this.page.getByRole('button', { name: 'Régler' }).first().click();
  }
}
