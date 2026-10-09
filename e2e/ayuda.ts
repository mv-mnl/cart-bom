import { expect, type Page } from '@playwright/test';

/** Lo que el cliente sabe de la partida (el store queda en `__PARTIDA__` en desarrollo). */
export interface EstadoCliente {
  readonly vista: {
    readonly view: { readonly yo: number; readonly mano: readonly { readonly id: string }[] };
    readonly acciones: readonly { readonly type: string; readonly player: number }[];
    readonly jugada: { readonly type: string; readonly player: number } | null;
  } | null;
  readonly local: unknown;
  readonly nombres: readonly string[];
}

export function estado(page: Page): Promise<EstadoCliente> {
  return page.evaluate(() => {
    const store = (globalThis as { __PARTIDA__?: { getState(): EstadoCliente } }).__PARTIDA__;
    if (!store) throw new Error('falta __PARTIDA__ (¿no es modo desarrollo?)');
    const { vista, local, nombres } = store.getState();
    return JSON.parse(JSON.stringify({ vista, local, nombres })) as EstadoCliente;
  });
}

/**
 * Hace una jugada de las que ofrece el cliente (las mismas que salen en los botones).
 * Mover cartas por el canvas no se prueba aquí: eso lo cubren las pruebas de arrastre.
 */
export async function jugar(page: Page, tipo: string): Promise<void> {
  await page.evaluate((tipo) => {
    const store = (
      globalThis as {
        __PARTIDA__?: {
          getState(): {
            vista: { acciones: { type: string }[] } | null;
            jugar(a: unknown): void;
          };
        };
      }
    ).__PARTIDA__;
    const s = store?.getState();
    const accion = s?.vista?.acciones.find((a) => a.type === tipo);
    if (!accion) throw new Error(`no hay jugada ${tipo}`);
    s?.jugar(accion);
  }, tipo);
}

/** La mesa de PixiJS ya está dibujada. */
export async function enLaMesa(page: Page): Promise<void> {
  await expect(page.locator('.mesa canvas')).toBeVisible();
  await expect(page.locator('.controles .mensaje')).toBeVisible();
}
