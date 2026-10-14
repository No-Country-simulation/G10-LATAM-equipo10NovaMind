"""Aislamiento entre pruebas del estado global del proceso."""

import pytest


@pytest.fixture(autouse=True)
def _cache_de_invitados_vacia():
    """Las cachés de invitados y de auditorías y los modelos agotados viven en el proceso: ninguna prueba hereda de otra."""
    from app import main
    from app.agentes import generacion_paralela
    from app.servicios.servicio_gemini import limpiar_modelos_agotados

    if main._REGISTRO_INVITADOS is not None:
        main._REGISTRO_INVITADOS.filas.clear()
    generacion_paralela._AUDITORIAS.clear()
    limpiar_modelos_agotados()
    yield
