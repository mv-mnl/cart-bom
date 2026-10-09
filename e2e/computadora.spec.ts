import { expect, test } from '@playwright/test';
import { enLaMesa, estado, jugar } from './ayuda';

test('contra la computadora: se reparte, eliges tu carta y la computadora juega', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Cartas' })).toBeVisible();
  await page.getByRole('button', { name: '2 jugadores' }).click();
  await enLaMesa(page);
  await expect(page.locator('.controles .mensaje')).toContainText('la carta que le vas a pasar');

  const inicio = await estado(page);
  expect(inicio.vista?.view.mano).toHaveLength(9);
  expect(inicio.nombres).toEqual(['Tú', 'Compu 1']);

  await jugar(page, 'pasarCarta');
  // La computadora elige la suya y empieza el juego: alguien saca del mazo.
  await expect
    .poll(async () => (await estado(page)).vista?.jugada?.player, { timeout: 10_000 })
    .toBe(1);
});

test('el menú vuelve a la pantalla de inicio', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '3 jugadores' }).click();
  await enLaMesa(page);
  await page.getByRole('button', { name: 'Volver al menú' }).click();
  await expect(page.getByRole('heading', { name: 'Cartas' })).toBeVisible();
});
