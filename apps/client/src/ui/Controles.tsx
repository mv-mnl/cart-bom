import type { Card } from '@cartas/core';
import { usePartida, type ModoControl } from '../store';
import { obligado, ofertaMia, resultado, type Vista } from '../vista';
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
  vista: Vista,
  nombres: readonly string[],
  modo: ModoControl,
  estilo: EstiloBaraja,
): string {
  const verbo = modo === 'arrastrar' ? 'Elige' : 'Toca';
  const { fase, yo } = vista.view;
  const nombre = (p: number) => nombres[p] ?? `Jugador ${p}`;
  switch (fase.type) {
    case 'intercambio':
      return fase.miCarta === null
        ? `${verbo} la carta que le vas a pasar a ${nombre((yo + 1) % vista.view.jugadores.length)}.`
        : 'Esperando a que los demás elijan…';
    case 'voltear':
      return fase.jugador === yo
        ? 'Te toca: saca una carta del mazo.'
        : `${nombre(fase.jugador)} va a sacar del mazo…`;
    case 'oferta': {
      const { turno } = fase;
      const carta = conArticulo(fase.carta, estilo);
      if (turno !== yo) {
        if (fase.origen === 'mazo' && fase.de === turno) {
          return `${nombre(turno)} volteó ${carta} y está pensando…`;
        }
        const quien =
          fase.de === yo
            ? fase.origen === 'mazo'
              ? 'Volteaste'
              : 'Botaste'
            : `${nombre(fase.de)} ${fase.origen === 'mazo' ? 'volteó' : 'botó'}`;
        return `${quien} ${carta}. ${nombre(turno)} está pensando…`;
      }
      const puso = fase.origen === 'mazo' ? 'volteó' : 'botó';
      const pregunta = obligado(vista) ? 'Entra en tu juego: va directo.' : '¿Te sirve?';
      if (fase.de === yo) return `Salió ${carta}. ${pregunta}`;
      return `${nombre(fase.de)} ${puso} ${carta}. ${pregunta}`;
    }
    case 'botar':
      return fase.jugador === yo
        ? `Ahora paga: ${verbo.toLowerCase()} la carta que vas a botar.`
        : `${nombre(fase.jugador)} está pagando…`;
    case 'terminado': {
      const r = fase.resultado;
      if (r.type === 'empate') return 'Se acabó el mazo: empate.';
      return r.ganadores.includes(yo) ? '¡Ganaste!' : `Ganó ${nombre(r.ganadores[0] ?? -1)}.`;
    }
  }
}

/** Cómo hacer lo que toca ahora, según el modo. En solo botones, los botones lo dicen. */
function ayuda(vista: Vista, modo: ModoControl): string | null {
  if (modo === 'botones') return null;
  const soloArrastrar = modo === 'arrastrar';
  const { fase, yo } = vista.view;
  if (fase.type === 'intercambio' && fase.miCarta === null) {
    return soloArrastrar
      ? 'Arrástrala al lugar marcado junto a tu mano.'
      : 'Tócala o arrástrala al lugar marcado junto a tu mano.';
  }
  if (fase.type === 'voltear' && fase.jugador === yo) {
    return 'Toca el mazo o arrastra la de arriba hacia la mesa.';
  }
  if (ofertaMia(vista)) {
    // La que entra en un juego tuyo se agrega sola: no hay nada que explicar.
    if (obligado(vista)) return null;
    return soloArrastrar
      ? 'Arrástrala a un juego tuyo o a la zona de armado con las cartas que van; si no te sirve, tócala.'
      : 'Arrástrala a un juego tuyo o a la zona de armado; si no te sirve, tócala o usa el botón.';
  }
  if (fase.type === 'botar' && fase.jugador === yo) {
    return 'Arrastra al centro la carta que vas a botar.';
  }
  return null;
}

/** Por qué la selección actual no sirve, para no dejar al jugador adivinando. */
function pista(vista: Vista, cuantas: number): string | null {
  const { fase, yo } = vista.view;
  if (fase.type === 'intercambio') return 'Selecciona una sola carta.';
  if (fase.type === 'botar' && fase.jugador === yo && cuantas !== 1) {
    return 'Para botar, selecciona una sola carta.';
  }
  if (fase.type === 'voltear' && fase.jugador === yo) return 'Primero saca una carta del mazo.';
  const miTurno = ofertaMia(vista) || (fase.type === 'botar' && fase.jugador === yo);
  if (!miTurno) return 'Espera tu turno.';
  if (cuantas < 2) return 'Selecciona las cartas de tu mano que van juntas.';
  return 'Esas cartas no forman juego (tercia, poker o escalera del mismo palo).';
}

export function Controles() {
  const vista = usePartida((s) => s.vista);
  const nombres = usePartida((s) => s.nombres);
  const seleccion = usePartida((s) => s.seleccion);
  const avisoArrastre = usePartida((s) => s.aviso);
  const ayudas = usePartida((s) => s.ayudas);
  const modo = usePartida((s) => s.modo);
  const estilo = usePartida((s) => s.baraja);
  const { limpiarSeleccion, nueva, jugar } = usePartida.getState();
  if (!vista) return null;

  // Los botones solo ofrecen jugadas válidas: si la carta entra en un juego tuyo, no hay pasar.
  const pasar = vista.acciones.find((a) => a.type === 'pasar');
  const voltear = vista.acciones.find((a) => a.type === 'voltear');
  const terminado = resultado(vista.view) !== null;
  const cuantas = seleccion.cartas.length + (seleccion.desmoche ? 1 : 0);
  const haySeleccion = cuantas > 0;

  // En solo arrastrar no hay botones de jugada: las ayudas se marcan sobre la mesa.
  const conBotones = modo !== 'arrastrar';
  const conSeleccion = conBotones ? opcionesSeleccion(vista, seleccion, estilo) : [];
  // Las sugerencias se muestran mientras no estés armando tu propia jugada.
  const sugeridas =
    !conBotones || !ayudas || haySeleccion || terminado ? [] : sugerencias(vista, 4, estilo);
  const comoArrastrar = !ayudas || terminado ? null : ayuda(vista, modo);
  const aviso =
    avisoArrastre ??
    (haySeleccion && conSeleccion.length === 0 && !terminado ? pista(vista, cuantas) : null);

  return (
    <div className="controles">
      <div className="centro">
        <p className="mensaje">{mensaje(vista, nombres, modo, estilo)}</p>
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

        {((conBotones && (pasar || voltear || haySeleccion)) || terminado) && (
          <div className="botones">
            {conBotones && voltear && (
              <button onClick={() => jugar(voltear)}>Sacar del mazo</button>
            )}
            {conBotones && pasar && (
              <button
                className={sugeridas.length + conSeleccion.length > 0 ? 'secundario' : ''}
                onClick={() => jugar(pasar)}
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
              <button onClick={() => nueva(vista.view.jugadores.length)}>Otra partida</button>
            )}
          </div>
        )}
      </div>
      <PanelOrden />
    </div>
  );
}
