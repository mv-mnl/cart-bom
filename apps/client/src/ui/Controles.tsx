import { conquian, type ConquianState } from '@cartas/conquian';
import type { Card } from '@cartas/core';
import { HUMANO, usePartida, type ModoControl } from '../store';
import { conArticulo, datosPalo, etiquetaCorta, nombreCarta, type EstiloBaraja } from './baraja';
import { opcionesSeleccion, sugerencias, type Opcion } from './opciones';
import { PanelOrden } from './PanelOrden';

function MiniCarta({ carta, estilo }: { carta: Card; estilo: EstiloBaraja }) {
  const { simbolo, nombre } = datosPalo(carta.palo, estilo);
  const clase =
    estilo === 'americana'
      ? `mini mini-americana ${carta.palo === 'oros' || carta.palo === 'copas' ? 'mini-rojo' : 'mini-negro'}`
      : `mini mini-${carta.palo}`;
  return (
    <span className={clase} title={nombreCarta(carta, estilo)}>
      {etiquetaCorta(carta.valor, estilo)}
      <small>{simbolo ?? nombre.slice(0, 2)}</small>
    </span>
  );
}

function BotonOpcion({ opcion, principal }: { opcion: Opcion; principal: boolean }) {
  const jugar = usePartida((s) => s.jugar);
  const estilo = usePartida((s) => s.baraja);
  return (
    <button
      className={principal ? 'opcion' : 'opcion secundario'}
      onClick={() => jugar(opcion.accion)}
    >
      {opcion.cartas.length > 0 && (
        <span className="minis">
          {opcion.cartas.map((c) => (
            <MiniCarta key={c.id} carta={c} estilo={estilo} />
          ))}
        </span>
      )}
      <span>{opcion.etiqueta}</span>
    </button>
  );
}

/** Mensaje corto de qué está pasando y qué te toca hacer. */
function mensaje(
  state: ConquianState,
  nombres: readonly string[],
  modo: ModoControl,
  estilo: EstiloBaraja,
): string {
  const verbo = modo === 'arrastrar' ? 'Elige' : 'Toca';
  const { fase } = state;
  const nombre = (p: number) => nombres[p] ?? `Jugador ${p}`;
  switch (fase.type) {
    case 'intercambio':
      return fase.elegidas[HUMANO] === null
        ? `${verbo} la carta que le vas a pasar a ${nombre((HUMANO + 1) % state.jugadores.length)}.`
        : 'Esperando a que los demás elijan…';
    case 'oferta': {
      const turno = fase.cola[0] ?? -1;
      const carta = conArticulo(fase.carta, estilo);
      const puso = fase.origen === 'mazo' ? 'volteó' : 'botó';
      if (turno !== HUMANO) {
        return fase.origen === 'mazo' && fase.de === turno
          ? `${nombre(turno)} volteó ${carta} y está pensando…`
          : `${nombre(fase.de)} ${puso} ${carta}. ${nombre(turno)} está pensando…`;
      }
      if (fase.de === HUMANO) return `Salió ${carta}. ¿Te sirve?`;
      return `${nombre(fase.de)} ${puso} ${carta}. ¿Te sirve?`;
    }
    case 'botar':
      return fase.jugador === HUMANO
        ? `Ahora paga: ${verbo.toLowerCase()} la carta que vas a botar.`
        : `${nombre(fase.jugador)} está pagando…`;
    case 'terminado': {
      const r = fase.resultado;
      if (r.type === 'empate') return 'Se acabó el mazo: empate.';
      return r.ganadores.includes(HUMANO) ? '¡Ganaste!' : `Ganó ${nombre(r.ganadores[0] ?? -1)}.`;
    }
  }
}

/** Cómo hacer lo que toca ahora, según el modo. En solo botones, los botones lo dicen. */
function ayuda(state: ConquianState, modo: ModoControl): string | null {
  if (modo === 'botones') return null;
  const soloArrastrar = modo === 'arrastrar';
  const { fase } = state;
  if (fase.type === 'intercambio' && fase.elegidas[HUMANO] === null) {
    return soloArrastrar
      ? 'Arrástrala al lugar marcado junto a tu mano.'
      : 'Tócala o arrástrala al lugar marcado junto a tu mano.';
  }
  if (fase.type === 'oferta' && fase.cola[0] === HUMANO) {
    return soloArrastrar
      ? 'Arrástrala a un juego tuyo o a la zona de armado con las cartas que van; si no te sirve, a las muertas.'
      : 'Arrástrala a un juego tuyo o a la zona de armado, o usa los botones.';
  }
  if (fase.type === 'botar' && fase.jugador === HUMANO) {
    return 'Arrastra al centro la carta que vas a botar.';
  }
  return null;
}

/** Por qué la selección actual no sirve, para no dejar al jugador adivinando. */
function pista(state: ConquianState, cuantas: number): string | null {
  const { fase } = state;
  if (fase.type === 'intercambio') return 'Selecciona una sola carta.';
  if (fase.type === 'botar' && fase.jugador === HUMANO && cuantas !== 1) {
    return 'Para botar, selecciona una sola carta.';
  }
  const miTurno =
    (fase.type === 'oferta' && fase.cola[0] === HUMANO) ||
    (fase.type === 'botar' && fase.jugador === HUMANO);
  if (!miTurno) return 'Espera tu turno.';
  if (cuantas < 2) return 'Selecciona las cartas de tu mano que van juntas.';
  return 'Esas cartas no forman juego (tercia, poker o escalera del mismo palo).';
}

export function Controles() {
  const state = usePartida((s) => s.state);
  const nombres = usePartida((s) => s.nombres);
  const seleccion = usePartida((s) => s.seleccion);
  const avisoArrastre = usePartida((s) => s.aviso);
  const ayudas = usePartida((s) => s.ayudas);
  const modo = usePartida((s) => s.modo);
  const estilo = usePartida((s) => s.baraja);
  const { limpiarSeleccion, nueva, jugar } = usePartida.getState();
  if (!state) return null;

  const { fase } = state;
  const ofertaMia = fase.type === 'oferta' && fase.cola[0] === HUMANO;
  const terminado = conquian.result(state) !== null;
  const cuantas = seleccion.cartas.length + (seleccion.desmoche ? 1 : 0);
  const haySeleccion = cuantas > 0;

  // En solo arrastrar no hay botones de jugada: las ayudas se marcan sobre la mesa.
  const conBotones = modo !== 'arrastrar';
  const conSeleccion = conBotones ? opcionesSeleccion(state, HUMANO, seleccion, estilo) : [];
  // Las sugerencias se muestran mientras no estés armando tu propia jugada.
  const sugeridas =
    !conBotones || !ayudas || haySeleccion || terminado
      ? []
      : sugerencias(state, HUMANO, 4, estilo);
  const comoArrastrar = !ayudas || terminado ? null : ayuda(state, modo);
  const aviso =
    avisoArrastre ??
    (haySeleccion && conSeleccion.length === 0 && !terminado ? pista(state, cuantas) : null);

  return (
    <div className="controles">
      <div className="centro">
        <p className="mensaje">{mensaje(state, nombres, modo, estilo)}</p>
        {comoArrastrar && <p className="ayuda">{comoArrastrar}</p>}

        {sugeridas.length > 0 && (
          <div className="opciones">
            <span className="rotulo">Puedes:</span>
            {sugeridas.map((o, i) => (
              <BotonOpcion key={i} opcion={o} principal={i === 0} />
            ))}
          </div>
        )}
        {conSeleccion.length > 0 && (
          <div className="opciones">
            {conSeleccion.map((o, i) => (
              <BotonOpcion key={i} opcion={o} principal />
            ))}
          </div>
        )}
        {aviso && <p className="pista">{aviso}</p>}

        {((conBotones && (ofertaMia || haySeleccion)) || terminado) && (
          <div className="botones">
            {conBotones && ofertaMia && (
              <button
                className={sugeridas.length + conSeleccion.length > 0 ? 'secundario' : ''}
                onClick={() => jugar({ type: 'pasar', player: HUMANO })}
              >
                No me sirve, pasar
              </button>
            )}
            {conBotones && haySeleccion && !terminado && (
              <button className="secundario" onClick={limpiarSeleccion}>
                Quitar selección
              </button>
            )}
            {terminado && (
              <button onClick={() => nueva(state.jugadores.length)}>Otra partida</button>
            )}
          </div>
        )}
      </div>
      <PanelOrden />
    </div>
  );
}
