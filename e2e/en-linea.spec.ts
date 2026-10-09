import { expect, test, type Browser, type Page } from '@playwright/test';
import { enLaMesa, estado, jugar } from './ayuda';

/** Un jugador en su propio navegador (contexto aparte: otra pestaña, otra sesión). */
async function jugador(browser: Browser, nombre: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto('/');
  await page.getByPlaceholder('Tu nombre').fill(nombre);
  return page;
}

test('dos amigos: crear sala, unirse con el código, elegir el juego y jugar', async ({
  browser,
}) => {
  const ana = await jugador(browser, 'Ana');
  await ana.getByRole('button', { name: 'Crear sala' }).click();
  const codigo = (await ana.locator('.codigo-sala').textContent())?.trim() ?? '';
  expect(codigo).toMatch(/^[A-Z]{5}$/);

  const beto = await jugador(browser, 'Beto');
  await beto.getByPlaceholder('Código').fill(codigo);
  await beto.getByRole('button', { name: 'Unirse' }).click();

  for (const page of [ana, beto]) {
    await expect(page.locator('.lugar.persona, .lugar.tu')).toHaveCount(2);
  }
  // Solo el anfitrión elige el juego; Beto lo ve sin poder cambiarlo.
  await expect(beto.getByRole('radio', { name: 'Americana ♠♥' })).toBeDisabled();
  await ana.getByRole('radio', { name: 'Americana ♠♥' }).click();
  await expect(beto.getByRole('radio', { name: 'Americana ♠♥' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(beto.getByText('Esperando a que Ana empiece')).toBeVisible();

  await ana.getByRole('button', { name: 'Empezar partida' }).click();
  await enLaMesa(ana);
  await enLaMesa(beto);

  const deAna = await estado(ana);
  const deBeto = await estado(beto);
  expect(deAna.vista?.view.yo).toBe(0);
  expect(deBeto.vista?.view.yo).toBe(1);
  expect(deBeto.nombres).toEqual(['Ana', 'Tú']);
  // En línea el cliente nunca tiene la partida completa ni la mano del otro.
  expect(deBeto.local).toBeNull();
  const texto = JSON.stringify(deBeto);
  for (const carta of deAna.vista?.view.mano ?? []) expect(texto).not.toContain(`"${carta.id}"`);

  await jugar(ana, 'pasarCarta');
  await expect
    .poll(async () => (await estado(beto)).vista?.jugada)
    .toEqual({ type: 'pasarCarta', player: 0 });
});

test('al recargar la página se vuelve a la sala', async ({ browser }) => {
  const ana = await jugador(browser, 'Ana');
  await ana.getByRole('button', { name: 'Crear sala' }).click();
  await ana.getByRole('radio', { name: '1', exact: true }).click();
  await ana.getByRole('button', { name: 'Empezar partida' }).click();
  await enLaMesa(ana);
  const antes = (await estado(ana)).vista?.view.mano.map((c) => c.id);

  await ana.reload();
  await enLaMesa(ana);
  await expect
    .poll(async () => (await estado(ana)).vista?.view.mano.map((c) => c.id))
    .toEqual(antes);
});

test('un código que no existe se explica en el menú', async ({ browser }) => {
  const beto = await jugador(browser, 'Beto');
  await beto.getByPlaceholder('Código').fill('ZZZZZ');
  await beto.getByRole('button', { name: 'Unirse' }).click();
  await expect(beto.getByText('No se encontró esa sala')).toBeVisible();
});
