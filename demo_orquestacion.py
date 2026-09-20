"""
Demo de la orquestación de NuevaMente (requisito del brief: 3 escenarios
distintos de adaptación para un mismo documento técnico).

Uso (desde la raíz del repo, con COHERE_API_KEY en .env):
    python demo_orquestacion.py
    python demo_orquestacion.py --archivo mi_documento.md --titulo "Mi manual"

Guarda cada resultado como JSON en ./demo_output/ y muestra un resumen.
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

from app.core.config import ConfigError
from app.orquestador import crear_orquestador

DOCUMENTO_EJEMPLO_TITULO = "Introduccion a la Arquitectura de Redes VCN en OCI"
DOCUMENTO_EJEMPLO = (
    "La Virtual Cloud Network (VCN) es una red privada y personalizable "
    "configurada en Oracle Cloud Infrastructure. Similar a una red de centro de "
    "datos tradicional, la VCN ofrece control total sobre su entorno de red, "
    "incluyendo subredes publicas y privadas, tablas de enrutamiento, Internet "
    "Gateways, NAT Gateways y Security Lists para control de trafico mediante "
    "reglas de entrada (ingress) y salida (egress)."
)

# 3 escenarios: 3 perfiles distintos y 3 formatos distintos sobre el MISMO documento
ESCENARIOS = [
    {"perfil_destinatario": "Principiante", "formato_salida": "Flashcards", "nicho_sector": "General", "nivel_detalle": "Didáctico"},
    {"perfil_destinatario": "Líder Técnico / Arquitecto", "formato_salida": "Quiz Interactivo con Justificaciones", "nicho_sector": "Fintech", "nivel_detalle": "Profundo"},
    {"perfil_destinatario": "Gestor / Ejecutivo (No Técnico)", "formato_salida": "Resumen Ejecutivo (TL;DR)", "nicho_sector": "General", "nivel_detalle": "Intermedio"},
]


def main() -> int:
    parser = argparse.ArgumentParser(description="Demo de la orquestación de NuevaMente")
    parser.add_argument("--archivo", help="Ruta a un .md/.txt con el documento (opcional)")
    parser.add_argument("--titulo", default=DOCUMENTO_EJEMPLO_TITULO)
    parser.add_argument("--salida", default="demo_output")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s")

    contenido = (
        Path(args.archivo).read_text(encoding="utf-8") if args.archivo else DOCUMENTO_EJEMPLO
    )

    try:
        orquestador = crear_orquestador()
    except ConfigError as error:
        print(f"Configuración incompleta: {error}", file=sys.stderr)
        return 2

    carpeta = Path(args.salida)
    carpeta.mkdir(parents=True, exist_ok=True)

    hubo_error = False
    for numero, escenario in enumerate(ESCENARIOS, start=1):
        print(f"\n=== Escenario {numero}: {escenario['perfil_destinatario']} · {escenario['formato_salida']} ===")
        respuesta = orquestador.ejecutar(
            {"documento_titulo": args.titulo, "documento_contenido": contenido, **escenario}
        )

        destino = carpeta / f"escenario_{numero}.json"
        destino.write_text(respuesta.model_dump_json(indent=2), encoding="utf-8")

        print(f"status: {respuesta.status}")
        if respuesta.status == "error":
            hubo_error = True
            print(f"error: {respuesta.error.codigo} - {respuesta.error.mensaje_amigable}")
            continue
        print(f"título: {respuesta.contenido_adaptado.titulo}")
        print(
            f"anclaje a la fuente: {respuesta.evaluacion_calidad.anclaje_fuente_score:.2f} "
            f"| intentos: {respuesta.orquestacion.intentos_redaccion} "
            f"| scores: {respuesta.orquestacion.scores_por_intento} "
            f"| {respuesta.orquestacion.duracion_segundos:.1f}s"
        )
        for aviso in respuesta.advertencias:
            print(f"advertencia: {aviso}")
        print(f"guardado en: {destino}")

    return 1 if hubo_error else 0


if __name__ == "__main__":
    sys.exit(main())
