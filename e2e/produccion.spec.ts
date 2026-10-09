import { expect, test, type Browser, type Page } from '@playwright/test';

/**
 * Solo con la interfaz (sin mirar el store), para que corra también contra el build de
 * producción en Docker: `E2E_URL=http://localhost:8080 pnpm test:e2e`.
 */
async function jugador(browser: Browser, nombre: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto('/');
  await page.getByPlaceholder('Tu nombre').fill(nombre);
  return page;
}

test('dos jugadores entran a la misma sala y empiezan la partida', async ({ browser }) => {
  const ana = await jugador(browser, 'Ana');
  await ana.getByRole('button', { name: 'Crear sala' }).click();
  const codigo = (await ana.locator('.codigo-sala').textContent())?.trim() ?? '';
  expect(codigo).toMatch(/^[A-Z]{5}$/);

  const beto = await jugador(browser, 'Beto');
  await beto.getByPlaceholder('Código').fill(codigo);
  await beto.getByRole('button', { name: 'Unirse' }).click();
  await expect(ana.locator('.lugar', { hasText: 'Beto' })).toBeVisible();
  await expect(beto.locator('.lugar', { hasText: 'Ana' })).toBeVisible();

  await ana.getByRole('button', { name: 'Empezar partida' }).click();
  for (const page of [ana, beto]) {
    await expect(page.locator('.mesa canvas')).toBeVisible();
    await expect(page.locator('.controles .mensaje')).toContainText('la carta que le vas a pasar');
  }
  // El mensaje dice a quién le pasas: a Beto le toca pasarle a Ana.
  await expect(beto.locator('.controles .mensaje')).toContainText('Ana');
});
