import type { Page } from '@playwright/test';

export class HomePage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/');
    await this.page.getByRole('heading', { name: 'Splitto' }).waitFor();
  }

  async createGroup(params: {
    name: string;
    currency: 'EUR' | 'USD' | 'GBP' | 'CHF';
    membersMultiline: string;
  }): Promise<void> {
    await this.page.getByRole('button', { name: 'Nouveau groupe' }).click();
    await this.page.getByRole('dialog', { name: 'Créer un groupe' }).waitFor();

    await this.page.getByLabel('Nom du groupe').fill(params.name);
    await this.page.getByLabel('Devise').selectOption(params.currency);
    await this.page
      .getByLabel('Membres (un par ligne, format : Nom <email>)')
      .fill(params.membersMultiline);

    await this.page.getByRole('button', { name: 'Créer' }).click();
  }

  async openFirstGroup(): Promise<void> {
    await this.page.getByRole('listitem').first().click();
    await this.page.getByRole('button', { name: 'Ajouter une dépense' }).waitFor();
  }
}
