"""
Regresiones de la auditoría Fase 1 (backend): ingesta, modo invitado, crítico honesto,
límites de subida, conteo de palabras e identidad de documentos.
"""

import asyncio

import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from fastapi.testclient import TestClient

from app import auth
from app.agentes.agente3_critico import AgenteCriticoContenido, CriticoGenerationError
from app.core.ingestion import cargar_documento_desde_bytes
from app.core.schemas import ParametrosGeneracion, calcular_documento_id, contar_palabras

DOC_MD = b"# Swap en OCI\n\nEl kernel de Linux usa la memoria swap para evitar errores OOM en VMs pequenas."


# --- Ingesta: el nombre de archivo del cliente nunca decide la ruta de escritura -------
@pytest.mark.parametrize("nombre", ["../../evil.md", "..\\..\\evil.md", "/tmp/evil.md", "C:/evil.md"])
def test_subida_no_escribe_fuera_de_un_temporal(tmp_path, monkeypatch, nombre):
    monkeypatch.chdir(tmp_path)
    doc = cargar_documento_desde_bytes(DOC_MD, nombre)
    assert "swap" in doc.texto.lower()
    assert list(tmp_path.rglob("*")) == []  # nada escrito en el cwd (ni data/documents)


# --- Modo invitado ------------------------------------------------------------------
def _credenciales(token):
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


def test_invitado_rechazado_en_prod(monkeypatch):
    monkeypatch.setenv("APP_ENV", "prod")
    monkeypatch.delenv("PERMITIR_MODO_INVITADO", raising=False)
    with pytest.raises(HTTPException) as exc:
        asyncio.run(auth.require_user(_credenciales(auth.GUEST_TOKEN)))
    assert exc.value.status_code == 401


def test_invitado_habilitado_explicitamente(monkeypatch):
    monkeypatch.setenv("APP_ENV", "prod")
    monkeypatch.setenv("PERMITIR_MODO_INVITADO", "true")
    principal = asyncio.run(auth.require_user(_credenciales(auth.GUEST_TOKEN)))
    assert principal.is_guest and principal.user_id == auth.GUEST_USER_ID


def test_usuario_real_con_uuid_de_ceros_no_es_invitado():
    real = auth.Principal("00000000-1234-4abc-8def-000000000001", "jwt-real")
    assert real.is_guest is False


# --- Crítico: sin proveedores no hay nota inventada ----------------------------------
def _parametros():
    return ParametrosGeneracion(
        perfil_destinatario="Principiante",
        formato_salida="Flashcards",
        nicho_sector="General",
        nivel_detalle="Didáctico",
        tema_consulta="swap",
    )


def test_critico_sin_proveedores_lanza_error(monkeypatch):
    critico = AgenteCriticoContenido(gemini_api_key="k", groq_api_key="k", entorno="dev")
    critico._cliente = None

    def caido(*_a, **_k):
        raise TimeoutError("proveedor caído")

    monkeypatch.setattr(critico, "_evaluar_gemini", caido)
    monkeypatch.setattr(critico, "_evaluar_groq", caido)
    with pytest.raises(CriticoGenerationError):
        critico.evaluar({"titulo": "x"}, "fragmento fuente", _parametros())


def test_modo_mock_no_rompe():
    critico = AgenteCriticoContenido(permitir_mock=True, entorno="dev")
    evaluacion = critico.evaluar({"titulo": "x"}, "fragmento", _parametros())
    assert "MOCK_CRITICO" in evaluacion.observaciones


# --- API: límite de tamaño de subida ------------------------------------------------
def test_subida_demasiado_grande_devuelve_413(monkeypatch):
    from app import main

    monkeypatch.setenv("APP_ENV", "dev")
    monkeypatch.setenv("PERMITIR_GENERACION_INVITADO", "true")
    monkeypatch.setattr(main, "MAX_BYTES_ARCHIVO", 64)
    cliente = TestClient(main.app)
    r = cliente.post(
        "/api/v1/adaptar",
        headers={"Authorization": f"Bearer {auth.GUEST_TOKEN}"},
        data={"perfil_destinatario": "Principiante", "formato_salida": "Flashcards"},
        files={"archivo": ("doc.md", b"x" * 65, "text/markdown")},
    )
    assert r.status_code == 413


def test_invitado_no_genera_sin_permiso_explicito(monkeypatch):
    from unittest.mock import patch

    from app import main

    monkeypatch.setenv("APP_ENV", "dev")
    monkeypatch.delenv("PERMITIR_GENERACION_INVITADO", raising=False)
    cliente = TestClient(main.app)
    with patch("app.main._generar") as generar:
        for ruta in ("/api/v1/adaptar", "/api/v1/adaptar/stream"):
            r = cliente.post(
                ruta,
                headers={"Authorization": f"Bearer {auth.GUEST_TOKEN}"},
                data={"perfil_destinatario": "Principiante", "formato_salida": "Flashcards",
                      "texto_directo": "texto"},
            )
            assert r.status_code == 403, ruta
    generar.assert_not_called()


# --- Conteo de palabras: mismos separadores que JavaScript ---------------------------
@pytest.mark.parametrize(
    "texto,esperado",
    [
        ("a\x85b", 2),      # "…" de Windows-1252 decodificado como Latin-1
        ("a\ufeffb", 2),    # BOM en medio del texto
        ("a\x1cb", 2),
        ("a\u200bb", 1),    # zero-width space NO separa (igual que JS)
        ("\ufeffHola mundo\u3000ok", 3),
    ],
)
def test_contar_palabras_separadores_unicode(texto, esperado):
    assert contar_palabras(texto) == esperado


# --- Identidad de documentos: por contenido, no por título ---------------------------
def test_documentos_distintos_con_el_mismo_titulo_no_colisionan():
    assert calcular_documento_id("Documento Técnico", "contenido A") != calcular_documento_id(
        "Documento Técnico", "contenido B"
    )
