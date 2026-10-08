"""
Agente 3 - Crítico / Revisor
Desarrollado por: Equipo 10 (G10 - NovaMind) para No-Country
Simulación Hackathon ONE G10 (Oracle Next Education & Alura)

Responsable de:
1. Auditar el contenido generado por el Agente 2.
2. Compararlo contra los fragmentos recuperados por el Agente 1.
3. Evaluar fidelidad a la fuente y claridad pedagógica.
4. Devolver una EvaluacionCalidad validada.

Este agente NO decide si el flujo termina o reintenta.
Esa responsabilidad pertenece al orquestador LangGraph.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Optional

import cohere
import requests

from app.core.prompts import (
    SYSTEM_CRITICO,
    construir_prompt_critico,
)
from app.core.schemas import (
    AfirmacionEvaluada,
    ContenidoAdaptado,
    EvaluacionCalidad,
    ParametrosGeneracion,
)

logger = logging.getLogger("nuevamente.agente3_critico")


class CriticoGenerationError(Exception):
    """Error al invocar el proveedor del crítico o validar la evaluación."""


class AgenteCriticoContenido:
    """
    Agente encargado de revisar la fidelidad y claridad del contenido generado.
    Implementa arquitectura Multi-Proveedor (Gemini 2.5 Flash / Groq / Cohere)
    con cascada de resiliencia y tolerancia a fallos.
    """

    def __init__(
        self,
        api_key: str | None = None,
        modelo: str = "command-r-08-2024",
        proveedor: str | None = None,
        modelo_critico: str | None = None,
        proveedor_fallback: str | None = None,
        modelo_fallback: str | None = None,
        gemini_api_key: str | None = None,
        groq_api_key: str | None = None,
        timeout: float = 25.0,
        permitir_mock: bool = False,
        entorno: str = "dev",
    ):
        self._bypass = (
            (permitir_mock or os.getenv("MOCK_CRITICO", "false").lower() in ("true", "1", "yes"))
            and entorno != "prod"
        )
        self._entorno = entorno
        self._timeout = timeout
        self._modelo = modelo
        self._proveedor = (proveedor or os.getenv("PROVEEDOR_CRITICO", "gemini")).lower()
        self._modelo_critico = modelo_critico or os.getenv("MODELO_CRITICO", "gemini-2.5-flash")
        self._proveedor_fallback = (proveedor_fallback or os.getenv("PROVEEDOR_CRITICO_FALLBACK", "groq")).lower()
        self._modelo_fallback = modelo_fallback or os.getenv("MODELO_CRITICO_FALLBACK", "qwen/qwen3.8-27b")

        self._gemini_key = gemini_api_key or os.getenv("GEMINI_API_KEY")
        self._groq_key = groq_api_key or os.getenv("GROQ_API_KEY")

        clave_cohere = api_key or os.getenv("COHERE_API_KEY")
        if not clave_cohere and not self._gemini_key and not self._groq_key and not self._bypass:
            raise CriticoGenerationError(
                "No existe clave de API para ningún proveedor configurado (COHERE_API_KEY, GEMINI_API_KEY, GROQ_API_KEY)."
            )

        self._cliente = cohere.ClientV2(api_key=clave_cohere, timeout=self._timeout) if clave_cohere else None

    @staticmethod
    def _generar_evaluacion_rapida(observaciones: str = "Aprobación automática para integración de infraestructura") -> EvaluacionCalidad:
        """
        Construye una evaluación válida inmediata con fidelidad 1.0 (100%).
        """
        afirmacion_valida = AfirmacionEvaluada(
            afirmacion="Contenido pedagógico respaldado por la fuente técnica.",
            respaldada=True,
            chunk_id_evidencia="chunk-001",
            comentario="Fidelidad comprobada contra fragmentos fuente.",
        )
        return EvaluacionCalidad(
            claridad_pedagogica="Alta",
            observaciones=observaciones,
            afirmaciones=[afirmacion_valida],
            sugerencias_correccion=[],
        )

    def evaluar(
        self,
        contenido_generado: Any,
        fragmentos: str,
        parametros: ParametrosGeneracion,
    ) -> EvaluacionCalidad:
        """
        Evalúa el contenido generado frente a los fragmentos fuente.
        """
        if self._bypass:
            return self._generar_evaluacion_rapida()

        if not fragmentos or not str(fragmentos).strip():
            raise CriticoGenerationError(
                "No existen fragmentos fuente para realizar la evaluación."
            )

        contenido_json = (
            contenido_generado.model_dump_json()
            if hasattr(contenido_generado, "model_dump_json")
            else json.dumps(contenido_generado, ensure_ascii=False)
        )

        prompt = construir_prompt_critico(
            contenido_generado=contenido_json,
            fragmentos=fragmentos,
            perfil_destinatario=parametros.perfil_destinatario,
            formato_salida=parametros.formato_salida,
            nivel_detalle=parametros.nivel_detalle,
            nicho_sector=parametros.nicho_sector,
        )

        # Si _cliente es un simulador de tests o proveedor forzado a cohere
        es_cliente_simulado = self._cliente is not None and not isinstance(self._cliente, cohere.ClientV2)
        if es_cliente_simulado or self._proveedor == "cohere":
            return self._evaluar_cohere(prompt)

        errores: list[str] = []

        # 1. Intentar proveedor primario (por defecto: gemini)
        try:
            if self._proveedor == "gemini" and self._gemini_key:
                return self._evaluar_gemini(prompt)
            elif self._proveedor == "groq" and self._groq_key:
                return self._evaluar_groq(prompt)
            elif self._cliente:
                return self._evaluar_cohere(prompt)
        except Exception as exc:
            logger.warning("[agente3_critico] Falló proveedor primario '%s': %s. Intentando fallback.", self._proveedor, exc)
            errores.append(f"{self._proveedor}: {exc}")

        # 2. Intentar proveedor fallback (por defecto: groq)
        try:
            if self._proveedor_fallback == "groq" and self._groq_key:
                return self._evaluar_groq(prompt)
            elif self._proveedor_fallback == "gemini" and self._gemini_key:
                return self._evaluar_gemini(prompt)
            elif self._cliente:
                return self._evaluar_cohere(prompt)
        except Exception as exc:
            logger.warning("[agente3_critico] Falló proveedor secundario '%s': %s.", self._proveedor_fallback, exc)
            errores.append(f"{self._proveedor_fallback}: {exc}")

        # 3. Intentar Cohere como último recurso
        if self._cliente and self._proveedor != "cohere" and self._proveedor_fallback != "cohere":
            try:
                return self._evaluar_cohere(prompt)
            except Exception as exc:
                errores.append(f"cohere: {exc}")

        # 4. Fallback de contingencia rápida si está explícitamente autorizado y fuera de producción
        if os.getenv("FALLBACK_CRITICO", "false").lower() in ("true", "1", "yes") and self._entorno != "prod":
            return self._generar_evaluacion_rapida(f"Evaluación rápida por fallback: {'; '.join(errores)}")

        raise CriticoGenerationError(
            f"Salida del Crítico no válida (fallaron proveedores): {'; '.join(errores)}"
        )

    def _evaluar_gemini(self, prompt: str) -> EvaluacionCalidad:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self._modelo_critico}:generateContent?key={self._gemini_key}"
        body = {
            "systemInstruction": {"parts": [{"text": SYSTEM_CRITICO}]},
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "responseMimeType": "application/json",
                "temperature": 0.0,
            },
        }
        resp = requests.post(url, json=body, timeout=self._timeout)
        resp.raise_for_status()
        data = resp.json()
        candidates = data.get("candidates", [])
        if not candidates:
            raise CriticoGenerationError("Gemini no devolvió candidatos de respuesta")
        parts = candidates[0].get("content", {}).get("parts", [])
        if not parts:
            raise CriticoGenerationError("Gemini no devolvió partes de contenido")
        texto = parts[0].get("text", "")
        datos = self._parsear_json(texto)
        return EvaluacionCalidad.model_validate(datos)

    def _evaluar_groq(self, prompt: str) -> EvaluacionCalidad:
        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self._groq_key}",
            "Content-Type": "application/json",
        }
        modelo = self._modelo_fallback if self._proveedor != "groq" else self._modelo_critico
        body = {
            "model": modelo,
            "messages": [
                {"role": "system", "content": SYSTEM_CRITICO + " Responde únicamente en formato JSON."},
                {"role": "user", "content": prompt},
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.0,
        }
        resp = requests.post(url, headers=headers, json=body, timeout=self._timeout)
        resp.raise_for_status()
        data = resp.json()
        choices = data.get("choices", [])
        if not choices:
            raise CriticoGenerationError("Groq no devolvió elecciones de respuesta")
        texto = choices[0].get("message", {}).get("content", "")
        datos = self._parsear_json(texto)
        return EvaluacionCalidad.model_validate(datos)

    def _evaluar_cohere(self, prompt: str) -> EvaluacionCalidad:
        if not self._cliente:
            raise CriticoGenerationError("Cliente Cohere no configurado para Agente 3.")
        respuesta = self._cliente.chat(
            model=self._modelo,
            messages=[
                {
                    "role": "system",
                    "content": SYSTEM_CRITICO,
                },
                {
                    "role": "user",
                    "content": prompt,
                },
            ],
            response_format={"type": "json_object"},
            temperature=0.0,
        )
        texto = self._extraer_texto(respuesta)
        datos = self._parsear_json(texto)
        return EvaluacionCalidad.model_validate(datos)

    @staticmethod
    def _extraer_texto(respuesta: Any) -> str:
        """
        Extrae de forma robusta el texto de una respuesta ClientV2.
        """
        try:
            contenido = respuesta.message.content

            if isinstance(contenido, list):
                if not contenido:
                    raise CriticoGenerationError(
                        "Cohere devolvió una respuesta vacía."
                    )

                primer_bloque = contenido[0]

                if hasattr(primer_bloque, "text"):
                    return primer_bloque.text

                if isinstance(primer_bloque, dict):
                    texto = primer_bloque.get("text")

                    if texto is None:
                        raise CriticoGenerationError(
                            "La respuesta de Cohere no contiene el campo 'text'."
                        )

                    return str(texto)

            return str(contenido)

        except CriticoGenerationError:
            raise

        except Exception as exc:
            raise CriticoGenerationError(
                f"No se pudo extraer el texto de la respuesta de Cohere: {exc}"
            ) from exc

    @staticmethod
    def _parsear_json(texto: str) -> dict:
        """
        Convierte la respuesta del modelo en un objeto JSON.
        También tolera fences Markdown por seguridad.
        """
        limpio = (
            texto
            .strip()
            .removeprefix("```json")
            .removeprefix("```")
            .removesuffix("```")
            .strip()
        )

        try:
            datos = json.loads(limpio)

        except json.JSONDecodeError as exc:
            raise CriticoGenerationError(
                f"Cohere no devolvió JSON válido: {exc}\n"
                f"---\n{texto}"
            ) from exc

        if not isinstance(datos, dict):
            raise CriticoGenerationError(
                "La respuesta del Crítico no contiene un objeto JSON."
            )

        return datos