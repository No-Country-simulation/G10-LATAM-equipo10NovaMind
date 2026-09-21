import os
import re
from dataclasses import dataclass
from typing import List, Optional

import chromadb
import cohere
from chromadb.config import Settings


@dataclass
class ChunkResultado:
    texto: str
    documento_id: str
    documento_titulo: str
    chunk_id: str
    posicion: int
    score: float


_MAX_EMBED_TEXTS_POR_LLAMADA = 96


class AgenteInvestigadorRAG:
    """
    Agente 1 - Investigador RAG.

    Responsabilidades:
    - Limpiar documentos.
    - Dividir documentos en chunks.
    - Mantener overlap entre chunks.
    - Generar embeddings con Cohere.
    - Indexar chunks en ChromaDB.
    - Realizar búsquedas semánticas.
    - Filtrar resultados mediante min_score.
    """

    def __init__(
        self,
        cohere_api_key: Optional[str] = None,
        embedding_model: str = "embed-multilingual-v3.0",
        chroma_path: str = "./chroma_db",
        collection_name: str = "nuevamente_documentos",
    ):
        # ========================================================
        # COHERE
        # ========================================================

        self.cohere_api_key = (
            cohere_api_key
            or os.getenv("COHERE_API_KEY")
        )

        if not self.cohere_api_key:
            raise ValueError(
                "No se encontró COHERE_API_KEY."
            )

        self.cohere_client = cohere.ClientV2(
            api_key=self.cohere_api_key
        )

        self.embedding_model = embedding_model

        # ========================================================
        # CHROMADB
        # ========================================================

        self.chroma_client = chromadb.PersistentClient(
            path=chroma_path,
            settings=Settings(anonymized_telemetry=False),
        )

        self.collection = (
            self.chroma_client.get_or_create_collection(
                name=collection_name,
                # Compatible con chromadb 0.5.x (la clave `configuration`
                # falla en esa versión con AttributeError: 'dict' object
                # has no attribute 'to_json').
                metadata={"hnsw:space": "cosine"},
            )
        )

    # ============================================================
    # EMBEDDINGS
    # ============================================================

    def _embeber(
        self,
        textos: List[str],
        input_type: str,
    ) -> List[List[float]]:
        """
        Genera embeddings utilizando Cohere en lotes de tamaño seguro.

        Cohere limita la solicitud de textos del endpoint Embed a 96 elementos
        por llamada. Se mantiene el mismo orden de entrada al concatenar los
        resultados de cada lote.
        """
        if not textos:
            return []

        embeddings: List[List[float]] = []

        for inicio in range(0, len(textos), _MAX_EMBED_TEXTS_POR_LLAMADA):
            lote = textos[inicio:inicio + _MAX_EMBED_TEXTS_POR_LLAMADA]

            respuesta = self.cohere_client.embed(
                model=self.embedding_model,
                texts=lote,
                input_type=input_type,
                embedding_types=["float"],
            )

            valores = getattr(respuesta.embeddings, "float", None)
            if valores is None:
                valores = getattr(respuesta.embeddings, "float_", None)

            if valores is None:
                raise RuntimeError(
                    "Cohere no devolvió embeddings de tipo float."
                )

            if len(valores) != len(lote):
                raise RuntimeError(
                    "La cantidad de embeddings devueltos por Cohere "
                    "no coincide con la cantidad de textos enviada."
                )

            embeddings.extend(valores)

        return embeddings

    # ============================================================
    # INGESTA DE DOCUMENTOS
    # ============================================================

    def ingerir_documento(
        self,
        documento_id: str,
        documento_titulo: str,
        texto: str,
        chunk_size: int = 220,
        chunk_overlap: int = 40,
    ) -> int:
        """
        Limpia, segmenta, embebe e indexa un documento.

        Parámetros:
        - documento_id: identificador único del documento.
        - documento_titulo: nombre o título del documento.
        - texto: contenido completo del documento.
        - chunk_size: máximo de palabras por chunk.
        - chunk_overlap: cantidad de palabras compartidas
          entre chunks consecutivos.

        Retorna:
        - Cantidad de chunks indexados.
        """

        # --------------------------------------------------------
        # VALIDACIONES
        # --------------------------------------------------------

        if not documento_id or not documento_id.strip():
            raise ValueError(
                "documento_id no puede estar vacío."
            )

        if not documento_titulo or not documento_titulo.strip():
            raise ValueError(
                "documento_titulo no puede estar vacío."
            )

        if not texto or not texto.strip():
            raise ValueError(
                "El texto del documento está vacío."
            )

        if chunk_size <= 0:
            raise ValueError(
                "chunk_size debe ser mayor que 0."
            )

        if (
            chunk_overlap < 0
            or chunk_overlap >= chunk_size
        ):
            raise ValueError(
                "chunk_overlap debe ser >= 0 "
                "y menor que chunk_size."
            )

        # --------------------------------------------------------
        # LIMPIAR TEXTO
        # --------------------------------------------------------

        texto_limpio = self._limpiar_texto(texto)

        if not texto_limpio:
            return 0

        # --------------------------------------------------------
        # SEGMENTAR
        # --------------------------------------------------------

        chunks = self._segmentar_texto(
            texto=texto_limpio,
            chunk_size=chunk_size,
            overlap=chunk_overlap,
        )

        if not chunks:
            return 0

        # --------------------------------------------------------
        # GENERAR EMBEDDINGS
        # --------------------------------------------------------
        # Se hace antes de borrar la versión anterior para no perder
        # una indexación válida si Cohere falla.
        embeddings = self._embeber(
            chunks,
            input_type="search_document",
        )

        if len(embeddings) != len(chunks):
            raise RuntimeError(
                "La cantidad de embeddings no coincide "
                "con la cantidad de chunks."
            )

        # --------------------------------------------------------
        # PREPARAR IDS Y METADATOS
        # --------------------------------------------------------

        ids = []
        metadatos = []

        for posicion, chunk in enumerate(chunks):

            chunk_id = f"{documento_id}_{posicion}"

            ids.append(chunk_id)

            metadatos.append(
                {
                    "documento_id": documento_id,
                    "documento_titulo": documento_titulo,
                    "chunk_id": chunk_id,
                    "posicion": posicion,
                }
            )

        # --------------------------------------------------------
        # ACTUALIZAR ÍNDICE EN CHROMADB
        # --------------------------------------------------------
        # `upsert` permite reemplazar los chunks existentes sin borrar
        # primero una indexación válida. Los chunks antiguos que ya no
        # existen se eliminan DESPUÉS de que el nuevo conjunto fue aceptado.
        existentes = self.collection.get(
            where={"documento_id": documento_id},
            include=[],
        ).get("ids", [])

        self.collection.upsert(
            ids=ids,
            documents=chunks,
            embeddings=embeddings,
            metadatas=metadatos,
        )

        ids_nuevos = set(ids)
        ids_obsoletos = [id_ for id_ in existentes if id_ not in ids_nuevos]
        if ids_obsoletos:
            self.collection.delete(ids=ids_obsoletos)

        return len(chunks)

    # ============================================================
    # ELIMINAR DOCUMENTO
    # ============================================================

    def eliminar_documento(
        self,
        documento_id: str,
    ) -> None:
        """
        Elimina todos los chunks pertenecientes
        a un documento.
        """

        self.collection.delete(
            where={
                "documento_id": documento_id
            }
        )

    # ============================================================
    # LIMPIEZA DE TEXTO
    # ============================================================

    @staticmethod
    def _limpiar_texto(
        texto: str,
    ) -> str:
        """
        Normaliza espacios y saltos de línea
        sin eliminar el contenido.
        """

        texto = texto.replace(
            "\r\n",
            "\n",
        )

        texto = texto.replace(
            "\r",
            "\n",
        )

        # Eliminar espacios al final de cada línea
        texto = re.sub(
            r"[ \t]+$",
            "",
            texto,
            flags=re.MULTILINE,
        )

        # Evitar demasiados saltos de línea
        texto = re.sub(
            r"\n{3,}",
            "\n\n",
            texto,
        )

        # Evitar espacios repetidos
        texto = re.sub(
            r"[ \t]{2,}",
            " ",
            texto,
        )

        return texto.strip()

    # ============================================================
    # SEGMENTACIÓN / CHUNKING
    # ============================================================

    @staticmethod
    def _segmentar_texto(
        texto: str,
        chunk_size: int,
        overlap: int,
    ) -> List[str]:
        """
        Divide el documento en chunks.

        Reglas:
        - Máximo de chunk_size palabras por chunk.
        - Mantiene overlap entre chunks consecutivos.
        - Intenta respetar los límites de párrafos.
        - Si no es posible respetar un párrafo sin superar
          chunk_size, realiza el corte por palabras.
        """

        # --------------------------------------------------------
        # VALIDACIONES
        # --------------------------------------------------------

        if not texto.strip():
            return []

        if chunk_size <= 0:
            raise ValueError(
                "chunk_size debe ser mayor que 0."
            )

        if (
            overlap < 0
            or overlap >= chunk_size
        ):
            raise ValueError(
                "overlap debe ser >= 0 "
                "y menor que chunk_size."
            )

        # --------------------------------------------------------
        # SEPARAR POR PÁRRAFOS
        # --------------------------------------------------------

        parrafos = [
            p.strip()
            for p in re.split(
                r"\n\s*\n",
                texto,
            )
            if p.strip()
        ]

        if not parrafos:
            return []

        # --------------------------------------------------------
        # CONVERTIR A PALABRAS
        # --------------------------------------------------------

        palabras = []
        finales_parrafo = []

        posicion = 0

        for parrafo in parrafos:

            palabras_parrafo = parrafo.split()

            if not palabras_parrafo:
                continue

            palabras.extend(
                palabras_parrafo
            )

            posicion += len(
                palabras_parrafo
            )

            finales_parrafo.append(
                posicion
            )

        if not palabras:
            return []

        total_palabras = len(palabras)

        # --------------------------------------------------------
        # CREAR CHUNKS
        # --------------------------------------------------------

        chunks = []

        inicio = 0

        while inicio < total_palabras:

            limite = min(
                inicio + chunk_size,
                total_palabras,
            )

            fin = limite

            # ----------------------------------------------------
            # BUSCAR EL ÚLTIMO FINAL DE PÁRRAFO POSIBLE
            # ----------------------------------------------------

            candidatos = [
                final
                for final in finales_parrafo
                if (
                    inicio + overlap < final <= limite
                )
            ]

            if candidatos:
                fin = max(candidatos)

            # ----------------------------------------------------
            # CREAR CHUNK
            # ----------------------------------------------------

            chunk = " ".join(
                palabras[inicio:fin]
            ).strip()

            if chunk:
                chunks.append(chunk)

            # ----------------------------------------------------
            # SI LLEGAMOS AL FINAL
            # ----------------------------------------------------

            if fin >= total_palabras:
                break

            # ----------------------------------------------------
            # SIGUIENTE CHUNK
            #
            # El nuevo chunk comienza overlap palabras antes
            # del final del chunk anterior.
            # ----------------------------------------------------

            nuevo_inicio = fin - overlap

            # Seguridad adicional para evitar ciclos
            if nuevo_inicio <= inicio:
                nuevo_inicio = fin

            inicio = nuevo_inicio

        return chunks

    # ============================================================
    # BÚSQUEDA SEMÁNTICA
    # ============================================================

    def buscar(
        self,
        consulta: str,
        top_k: int = 5,
        documento_id: Optional[str] = None,
        min_score: Optional[float] = 0.60,
    ) -> List[ChunkResultado]:
        """
        Realiza una búsqueda semántica.

        min_score:
        Umbral mínimo de similitud.

        Los resultados con score inferior se descartan.
        """

        if not consulta or not consulta.strip():
            return []

        if top_k <= 0:
            return []

        # --------------------------------------------------------
        # EMBEDDING DE LA CONSULTA
        # --------------------------------------------------------

        embedding_consulta = self._embeber(
            [consulta],
            input_type="search_query",
        )[0]

        # --------------------------------------------------------
        # FILTRO POR DOCUMENTO
        # --------------------------------------------------------

        where = None

        if documento_id:
            where = {
                "documento_id": documento_id
            }

        # --------------------------------------------------------
        # BÚSQUEDA EN CHROMADB
        # --------------------------------------------------------
        # Chroma no debe recibir más resultados de los que existen.
        if documento_id:
            disponibles = len(
                self.collection.get(
                    where={"documento_id": documento_id},
                    include=[],
                ).get("ids", [])
            )
        else:
            disponibles = self.collection.count()

        if disponibles <= 0:
            return []

        n_results = min(top_k, disponibles)

        resultados = self.collection.query(
            query_embeddings=[
                embedding_consulta
            ],
            n_results=n_results,
            where=where,
            include=[
                "documents",
                "metadatas",
                "distances",
            ],
        )

        documentos = resultados.get(
            "documents",
            [[]],
        )[0]

        metadatas = resultados.get(
            "metadatas",
            [[]],
        )[0]

        distances = resultados.get(
            "distances",
            [[]],
        )[0]

        resultados_finales = []

        # --------------------------------------------------------
        # PROCESAR RESULTADOS
        # --------------------------------------------------------

        for documento, metadata, distancia in zip(
            documentos,
            metadatas,
            distances,
        ):

            # ----------------------------------------------------
            # DISTANCIA COSENO → SCORE
            # ----------------------------------------------------

            score = round(
                1 - distancia,
                4,
            )

            # ----------------------------------------------------
            # FILTRO DE SIMILITUD
            # ----------------------------------------------------

            if (
                min_score is not None
                and score < min_score
            ):
                continue

            # ----------------------------------------------------
            # CREAR RESULTADO
            # ----------------------------------------------------

            resultados_finales.append(
                ChunkResultado(
                    texto=documento,
                    documento_id=metadata.get(
                        "documento_id",
                        "",
                    ),
                    documento_titulo=metadata.get(
                        "documento_titulo",
                        "",
                    ),
                    chunk_id=metadata.get(
                        "chunk_id",
                        "",
                    ),
                    posicion=int(
                        metadata.get(
                            "posicion",
                            0,
                        )
                    ),
                    score=score,
                )
            )

        return resultados_finales

    # ============================================================
    # CONTAR CHUNKS
    # ============================================================

    def contar_chunks(
        self,
        documento_id: Optional[str] = None,
    ) -> int:
        """
        Cuenta los chunks almacenados.

        Si se proporciona documento_id,
        cuenta únicamente los chunks de ese documento.
        """

        if documento_id:

            resultados = self.collection.get(
                where={
                    "documento_id": documento_id
                },
                include=[],
            )

            return len(
                resultados.get(
                    "ids",
                    [],
                )
            )

        return self.collection.count()
