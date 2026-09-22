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
import os
from typing import Any

import cohere

from app.core.prompts import (
    SYSTEM_CRITICO,
    construir_prompt_critico,
)
from app.core.schemas import (
    ContenidoAdaptado,
    EvaluacionCalidad,
    ParametrosGeneracion,
)


class CriticoGenerationError(Exception):
    """Error al invocar Cohere o validar la evaluación del crítico."""


class AgenteCriticoContenido:
    """
    Agente encargado de revisar la fidelidad y claridad del contenido generado.
    """

    def __init__(
        self,
        api_key: str | None = None,
        modelo: str = "command-a-03-2025",
    ):
        """
        Args:
            api_key: clave de Cohere. Si no se proporciona,
                se obtiene de COHERE_API_KEY.
            modelo: modelo de Cohere utilizado para la evaluación.
        """
        clave = api_key or os.getenv("COHERE_API_KEY")

        if not clave:
            raise CriticoGenerationError(
                "No existe COHERE_API_KEY en las variables de entorno."
            )

        self._cliente = cohere.ClientV2(api_key=clave)
        self._modelo = modelo

    def evaluar(
        self,
        contenido_generado: ContenidoAdaptado,
        fragmentos: str,
        parametros: ParametrosGeneracion,
    ) -> EvaluacionCalidad:
        """
        Evalúa el contenido generado frente a los fragmentos fuente.

        Args:
            contenido_generado: contenido producido por el Agente 2.
            fragmentos: información recuperada por el Agente 1.
            parametros: contexto real utilizado para la adaptación:
                perfil, formato, nivel de detalle, nicho y tema.

        Returns:
            EvaluacionCalidad validada con Pydantic.

        Raises:
            CriticoGenerationError:
                Si Cohere falla o la respuesta no cumple el esquema.
        """
        if not fragmentos.strip():
            raise CriticoGenerationError(
                "No existen fragmentos fuente para realizar la evaluación."
            )

        contenido_json = contenido_generado.model_dump_json()

        prompt = construir_prompt_critico(
            contenido_generado=contenido_json,
            fragmentos=fragmentos,
            perfil_destinatario=parametros.perfil_destinatario,
            formato_salida=parametros.formato_salida,
            nivel_detalle=parametros.nivel_detalle,
            nicho_sector=parametros.nicho_sector,
        )

        try:
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

        except CriticoGenerationError:
            raise

        except Exception as exc:
            raise CriticoGenerationError(
                f"Salida del Crítico no válida: {exc}"
            ) from exc

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