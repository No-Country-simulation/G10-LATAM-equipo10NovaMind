"""
Uso (desde backend/):  python -m app.espejo [--reconciliar] [--forzar-borrado] [--tabla NOMBRE ...]

Sale con código 1 si alguna tabla falló y 2 si falta configuración.
En la VM lo lanza deploy/systemd/nuevamente-espejo.timer.
"""

import argparse
import logging
import os
import sys

from dotenv import load_dotenv

from app.espejo.sincronizador import DestinoOracle, FuenteSupabase, Sincronizador, conectar_oracle
from app.espejo.tablas import POR_NOMBRE, TABLAS

REQUERIDAS = (
    "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY",
    "ORACLE_ESPEJO_USUARIO", "ORACLE_ESPEJO_CLAVE", "ORACLE_ESPEJO_DSN",
)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.espejo", description="Copia Supabase en el espejo de Oracle.")
    parser.add_argument("--reconciliar", action="store_true", help="borra del espejo lo que ya no existe en Supabase")
    parser.add_argument("--forzar-borrado", action="store_true", help="permite borrados masivos al reconciliar")
    parser.add_argument("--tabla", action="append", choices=sorted(POR_NOMBRE), help="solo estas tablas")
    args = parser.parse_args(argv)

    load_dotenv()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    faltan = [v for v in REQUERIDAS if not os.getenv(v)]
    if faltan:
        print("Faltan variables: " + ", ".join(faltan), file=sys.stderr)
        return 2

    fuente = FuenteSupabase(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    conexion = conectar_oracle(
        os.environ["ORACLE_ESPEJO_USUARIO"], os.environ["ORACLE_ESPEJO_CLAVE"], os.environ["ORACLE_ESPEJO_DSN"],
        os.getenv("ORACLE_ESPEJO_WALLET_DIR", ""), os.getenv("ORACLE_ESPEJO_WALLET_CLAVE", ""),
    )
    tablas = [POR_NOMBRE[n] for n in args.tabla] if args.tabla else TABLAS
    try:
        resultados = Sincronizador(
            fuente, DestinoOracle(conexion), lote=int(os.getenv("ESPEJO_LOTE", "500")), tablas=tablas,
        ).ejecutar(reconciliar=args.reconciliar, forzar_borrado=args.forzar_borrado)
    finally:
        fuente.close()
        conexion.close()

    for r in resultados:
        estado = "ERROR " + r.error if r.error else "ok"
        logging.info("[espejo] %-18s copiadas=%d borradas=%d %s", r.tabla, r.copiadas, r.borradas, estado)
    return 1 if any(r.error for r in resultados) else 0


if __name__ == "__main__":
    sys.exit(main())
