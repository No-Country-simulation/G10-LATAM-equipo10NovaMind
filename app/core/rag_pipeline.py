"""
Pipeline de RAG: chunking -> embeddings -> indexación y recuperación en Chroma.

Diseño clave para el requisito de "anclaje en las fuentes": cada chunk se
indexa junto a su metadata (doc_id, título, índice, extracto), de forma que
el Agente Crítico pueda verificar cada afirmación generada contra un chunk
trazable, y no contra un embedding "anónimo".
"""

from __future__ import annotations

import os
from functools import lru_cache

import chromadb
from chromadb.utils import embedding_functions
from langchain_text_splitters import (
    MarkdownHeaderTextSplitter,
    RecursiveCharacterTextSplitter,
)

from app.core.ingestion import DocumentoIngresado
from app.core.schemas import ChunkMetadata, ChunkRecuperado

CHROMA_PERSIST_DIR = os.getenv("CHROMA_PERSIST_DIR", "data/chroma")
CHROMA_COLLECTION_NAME = os.getenv("CHROMA_COLLECTION_NAME", "nuevamente_docs")
LOCAL_EMBEDDINGS_MODEL = os.getenv(
    "LOCAL_EMBEDDINGS_MODEL", "intfloat/multilingual-e5-base"
)

_CHUNK_SIZE = 700
_CHUNK_OVERLAP = 100


# ---------------------------------------------------------------------------
# Chunking
# ---------------------------------------------------------------------------

def _splitter_recursivo() -> RecursiveCharacterTextSplitter:
    return RecursiveCharacterTextSplitter(
        chunk_size=_CHUNK_SIZE,
        chunk_overlap=_CHUNK_OVERLAP,
        separators=["\n\n", "\n", ". ", " ", ""],
    )


def dividir_en_chunks(doc: DocumentoIngresado) -> list[str]:
    """
    Usa un splitter consciente de headers Markdown cuando el documento es
    .md (preserva procedimientos/secciones completas); para PDF/texto plano
    usa el splitter recursivo genérico.
    """
    if doc.extension in (".md", ".markdown"):
        headers = [("#", "h1"), ("##", "h2"), ("###", "h3")]
        md_splitter = MarkdownHeaderTextSplitter(headers_to_split_on=headers)
        secciones = md_splitter.split_text(doc.texto)
        recursivo = _splitter_recursivo()
        chunks: list[str] = []
        for seccion in secciones:
            chunks.extend(recursivo.split_text(seccion.page_content))
        return chunks

    return _splitter_recursivo().split_text(doc.texto)


# ---------------------------------------------------------------------------
# Vector store (Chroma persistente en disco, embeddings locales por defecto)
# ---------------------------------------------------------------------------

@lru_cache(maxsize=1)
def _get_chroma_collection():
    client = chromadb.PersistentClient(path=CHROMA_PERSIST_DIR)

    embeddings_provider = os.getenv("EMBEDDINGS_PROVIDER", "local")
    if embeddings_provider == "local":
        ef = embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name=LOCAL_EMBEDDINGS_MODEL
        )
    else:
        # Fallback: embeddings de Gemini (requiere GEMINI_API_KEY configurada)
        ef = embedding_functions.GoogleGenerativeAiEmbeddingFunction(
            api_key=os.environ["GEMINI_API_KEY"]
        )

    return client.get_or_create_collection(
        name=CHROMA_COLLECTION_NAME,
        embedding_function=ef,
        metadata={"hnsw:space": "cosine"},
    )


def indexar_documento(doc: DocumentoIngresado) -> int:
    """
    Chunkea el documento y lo indexa en Chroma con metadata trazable.
    Devuelve la cantidad de chunks indexados.
    """
    chunks = dividir_en_chunks(doc)
    if not chunks:
        return 0

    coleccion = _get_chroma_collection()

    ids = [f"{doc.doc_id}-{i}" for i in range(len(chunks))]
    metadatas = [
        ChunkMetadata(
            doc_id=doc.doc_id,
            doc_titulo=doc.titulo,
            chunk_index=i,
            fuente_extracto=chunk[:280],
        ).model_dump()
        for i, chunk in enumerate(chunks)
    ]

    coleccion.upsert(ids=ids, documents=chunks, metadatas=metadatas)
    return len(chunks)


def recuperar_chunks_relevantes(
    query: str, doc_id: str | None = None, k: int = 6
) -> list[ChunkRecuperado]:
    """
    Recupera los k chunks más relevantes para `query`. Si se pasa `doc_id`,
    restringe la búsqueda a ese documento (evita mezclar fuentes de
    distintos documentos ingeridos en la misma sesión).
    """
    coleccion = _get_chroma_collection()

    where = {"doc_id": doc_id} if doc_id else None
    resultados = coleccion.query(query_texts=[query], n_results=k, where=where)

    chunks: list[ChunkRecuperado] = []
    docs = resultados.get("documents", [[]])[0]
    metas = resultados.get("metadatas", [[]])[0]
    distancias = resultados.get("distances", [[]])[0]

    for texto, meta, distancia in zip(docs, metas, distancias):
        similitud = max(0.0, 1.0 - distancia)  # cosine distance -> similitud aprox.
        chunks.append(
            ChunkRecuperado(
                texto=texto,
                metadata=ChunkMetadata(**meta),
                score=round(similitud, 4),
            )
        )
    return chunks
