/**
 * Recursos de apoyo del modo paralelo, junto a la estación con la que se estudian:
 *   Estación 1 · objetivos de aprendizaje y resumen ejecutivo por secciones
 *   Estación 2 · glosario
 *   Estación 4 · propuesta de diapositivas
 * Un recurso ausente no se muestra; uno fallido muestra una línea explicándolo.
 */
import { BookMarked, Layers, ListChecks, ScrollText } from 'lucide-react';
import type { ReactNode } from 'react';
import type { AdaptedContentPackage, RecursoId } from '../../types/types';
import { estadoDe, motivoError, NOMBRE_RECURSO } from '../../utils/paqueteIncremental';
import { resumenEnPuntos } from '../../utils/resumenEnPuntos';
import { ChipVerificacion, FuenteChip } from '../RecursoEstado/RecursoEstado';
import styles from './RecursosApoyo.module.css';

interface Props {
  paquete: AdaptedContentPackage;
  estacion: number;
}

function Bloque({ paquete, recurso, icono, abierto = false, cantidad, children }: {
  paquete: AdaptedContentPackage;
  recurso: RecursoId;
  icono: ReactNode;
  abierto?: boolean;
  cantidad?: number;
  children: ReactNode;
}) {
  const estado = estadoDe(paquete, recurso);
  if (estado?.estado === 'fallido') {
    return (
      <p className={styles.fallido} role="note">
        {NOMBRE_RECURSO[recurso]}: no disponible ({motivoError(estado.error_codigo)}).
      </p>
    );
  }
  return (
    <details className={styles.bloque} open={abierto}>
      <summary className={styles.resumen}>
        {icono}
        <span className={styles.titulo}>{NOMBRE_RECURSO[recurso]}</span>
        {cantidad !== undefined && <span className={styles.cantidad}>{cantidad}</span>}
        {estado && <ChipVerificacion estado={estado} />}
      </summary>
      <div className={styles.cuerpo}>{children}</div>
    </details>
  );
}

/** Resumen ejecutivo: una frase, puntos clave y, plegados, el detalle por secciones y las conclusiones. */
export function ResumenEjecutivo({ paquete }: { paquete: AdaptedContentPackage }) {
  const r = paquete.contenido_adaptado.resumen_ejecutivo;
  if (!r) return null;
  const { frase, puntos } = resumenEnPuntos(r.texto);
  return (
    <Bloque paquete={paquete} recurso="resumen" abierto icono={<ScrollText size={16} aria-hidden="true" />}>
      <p className={styles.frase}><strong>En una frase:</strong> {frase}</p>
      {puntos.length > 0 && <ul className={styles.lista}>{puntos.map((p) => <li key={p}>{p}</li>)}</ul>}
      {(r.por_secciones.length > 0 || r.conclusiones.length > 0) && (
        <details className={styles.detalle}>
          <summary title="Pulsa para desplegar">Ver por secciones y conclusiones</summary>
          {r.por_secciones.length > 0 && (
            <>
              <h5 className={styles.subtitulo}>Por secciones</h5>
              <dl className={styles.definiciones}>
                {r.por_secciones.map((s, i) => (
                  <div key={`${s.seccion}-${i}`}>
                    <dt>{s.seccion} <FuenteChip fuente={s.fuente} /></dt>
                    <dd>{s.resumen}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
          {r.conclusiones.length > 0 && (
            <>
              <h5 className={styles.subtitulo}>Conclusiones</h5>
              <ul className={styles.lista}>{r.conclusiones.map((x) => <li key={x}>{x}</li>)}</ul>
            </>
          )}
        </details>
      )}
    </Bloque>
  );
}

export function RecursosApoyo({ paquete, estacion }: Props) {
  const c = paquete.contenido_adaptado;
  const bloques: ReactNode[] = [];

  if (estacion === 0) {
    if (c.objetivos_aprendizaje?.length || estadoDe(paquete, 'objetivos')) {
      bloques.push(
        <Bloque key="objetivos" paquete={paquete} recurso="objetivos" abierto
          icono={<ListChecks size={16} aria-hidden="true" />} cantidad={c.objetivos_aprendizaje?.length}>
          <ul className={styles.lista}>{c.objetivos_aprendizaje?.map((o) => <li key={o}>{o}</li>)}</ul>
        </Bloque>,
      );
    }
    // Con la Estación 1 en pantalla, el resumen va dentro de ella (entre la síntesis y los puntos clave)
    if (c.resumen_ejecutivo && !c.resumen_ninja) {
      bloques.push(<ResumenEjecutivo key="ejecutivo" paquete={paquete} />);
    }
  }

  if (estacion === 1 && (c.glosario?.length || estadoDe(paquete, 'glosario'))) {
    bloques.push(
      <Bloque key="glosario" paquete={paquete} recurso="glosario"
        icono={<BookMarked size={16} aria-hidden="true" />} cantidad={c.glosario?.length}>
        <dl className={styles.definiciones}>
          {c.glosario?.map((g) => (
            <div key={g.termino}>
              <dt>{g.termino} <FuenteChip fuente={g.fuente} /></dt>
              <dd>{g.definicion}</dd>
            </div>
          ))}
        </dl>
      </Bloque>,
    );
  }

  if (estacion === 3 && (c.diapositivas?.length || estadoDe(paquete, 'diapositivas'))) {
    bloques.push(
      <Bloque key="diapositivas" paquete={paquete} recurso="diapositivas"
        icono={<Layers size={16} aria-hidden="true" />} cantidad={c.diapositivas?.length}>
        <ol className={styles.diapositivas}>
          {c.diapositivas?.map((d) => (
            <li key={d.orden} className={styles.diapositiva}>
              <div className={styles.diapositivaCabecera}>
                <span className={styles.diapositivaNumero}>{String(d.orden).padStart(2, '0')}</span>
                <strong>{d.titulo}</strong>
              </div>
              <ul className={styles.lista}>{d.puntos_clave.map((p) => <li key={p}>{p}</li>)}</ul>
              <p className={styles.visual}><em>Visual:</em> {d.concepto_visual}</p>
              <FuenteChip fuente={d.fuente} />
            </li>
          ))}
        </ol>
      </Bloque>,
    );
  }

  if (!bloques.length) return null;
  return <section className={styles.contenedor} aria-label="Recursos de apoyo">{bloques}</section>;
}
