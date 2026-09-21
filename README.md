# NuevaMente 🎓 — Frontend y Backend como servicios separados

Sistema Inteligente de Adaptación y Generación de Contenido Educativo —
Hackathon ONE G10 (Oracle Next Education & Alura).

Este scaffold levanta **dos servicios independientes**, cada uno con su
propio `Dockerfile`, `requirements.txt` y ciclo de vida, comunicados
exclusivamente por HTTP:

```
nuevamente-microservicios/
├── docker-compose.yml
├── backend/     → API REST (FastAPI). Dueño de TODA la lógica de negocio.
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── .env.example
│   └── app/
│       ├── main.py           ← endpoints HTTP (contrato con el frontend)
│       ├── core/              ← ingesta, RAG, agentes LangGraph, schemas
│       └── storage/            ← cliente de OCI Object Storage
└── frontend/    → UI (Streamlit). Sin lógica de negocio.
    ├── Dockerfile
    ├── requirements.txt
    ├── .env.example
    └── app/
        ├── streamlit_app.py   ← solo widgets + renderizado
        ├── api_client.py       ← ÚNICA frontera de comunicación con el backend
        └── constants.py          ← opciones de los selectbox (duplicadas del backend)
```

## Arquitectura

```
┌─────────────────────────┐         HTTP (multipart/form-data)        ┌──────────────────────────────┐
│   Servicio: frontend      │  ─────────────  POST /adaptar  ───────▶ │   Servicio: backend             │
│   Streamlit · puerto 8501  │                                         │   FastAPI · puerto 8000          │
│                              │  ◀──────────── JSON RespuestaAdaptacion │   LangGraph: investigador→       │
│   api_client.py = frontera    │                                         │   redactor→crítico                │
└─────────────────────────┘                                         │   Chroma + OCI Object Storage      │
                                                                       └──────────────────────────────┘
```

Cada servicio se puede parar, reconstruir, escalar o desplegar en una
máquina distinta sin tocar el otro — es la diferencia real frente al
scaffold "todo en un proceso" (variante `nuevamente-frontend-only`).

## Quickstart

```bash
cp backend/.env.example backend/.env    # completar GEMINI_API_KEY, OCI_NAMESPACE, etc.
cp frontend/.env.example frontend/.env  # normalmente no hace falta tocar nada acá

docker compose up --build -d
docker compose ps                       # confirmar que backend está "healthy"
```

- Frontend: `http://localhost:8501`
- Backend (Swagger/OpenAPI): `http://localhost:8000/docs`

Probar el backend de forma aislada, sin el frontend:

```bash
curl -X POST http://localhost:8000/adaptar \
  -F "archivo=@documento.pdf" \
  -F "perfil_destinatario=Principiante / Transición de Carrera" \
  -F "formato_salida=Flashcards" \
  -F "nicho_sector=General" \
  -F "nivel_detalle=Didactico"
```

## Puntos de entrada/salida de comunicación (resumen)

| Dirección | Dónde vive | Qué hace |
|---|---|---|
| Frontend → Backend | `frontend/app/api_client.py::generar_contenido_adaptado()` | Arma el `multipart/form-data` y hace `POST /adaptar` |
| Backend recibe | `backend/app/main.py::adaptar_contenido()` | Único handler que procesa la request; delega en `core/` |
| Backend → Frontend | `return RespuestaAdaptacion(...)` en `main.py` | FastAPI serializa el modelo Pydantic a JSON automáticamente |
| Frontend recibe | `resp.json()` en `api_client.py` | El resto del frontend solo lee ese dict, sin tipos compartidos |

## Trade-off explícito de esta separación

`frontend/app/constants.py` duplica a mano las opciones de perfil,
formato y nivel que en el backend son Enums de Pydantic
(`backend/app/core/schemas.py`). Es el costo real de que sean dos
servicios independientes con `requirements.txt` propios: no hay tipos
compartidos en tiempo de compilación. Si el equipo prefiere evitarlo,
la alternativa es publicar `schemas.py` como paquete Python instalado en
ambos servicios (fuera del alcance de este scaffold de hackathon).

## Trabajo en equipo

Convención de ramas, flujo de Pull Requests y checks de CI en
[`CONTRIBUTING.md`](./CONTRIBUTING.md).

## Checklist del whitepaper cubierto

- [x] Ingestión de PDF / Markdown / texto (backend)
- [x] RAG con chunking + embeddings + Chroma (backend)
- [x] Orquestación multi-agente con LangGraph (backend)
- [x] Salida estructurada validada con Pydantic (backend)
- [x] UI interactiva (Streamlit) — servicio propio
- [x] API REST operativa (FastAPI) — servicio propio, documentado en `/docs`
- [x] Persistencia en OCI Object Storage (backend)
- [ ] 3 escenarios de demo documentados (pendiente del equipo)
