# Contribuir a NuevaMente

Guía corta de flujo de trabajo para el equipo durante el hackathon.
Usamos **GitHub Flow** (trunk-based): una sola rama de larga vida (`main`)
y ramas efímeras por tarea. Nada de `develop` ni ramas de `release` — no
las necesitamos para una demo de hackathon.

## 1. Antes de empezar una tarea

```bash
git checkout main
git pull origin main
git checkout -b feature/<area>-<descripcion-corta>
```

### Convención de nombres

`<tipo>/<área>-<descripción-corta>`

| Tipo | Uso |
|---|---|
| `feature/` | funcionalidad nueva |
| `fix/` | corrección de un bug |
| `docs/` | README, diagramas, documentación |
| `chore/` | dependencias, configuración, CI |

El `<área>` debería mapear a una carpeta real del proyecto, para que dos
personas no choquen trabajando el mismo archivo:

```
feature/backend-ingesta-pdf
feature/backend-rag-chroma
feature/backend-orquestador-langgraph
feature/backend-oci-storage
feature/frontend-streamlit-ui
feature/frontend-api-client
feature/infra-docker-compose
fix/backend-parseo-json-llm
docs/diagrama-arquitectura
```

## 2. Durante el desarrollo

- Commits chicos y descriptivos, en español o inglés (elegir uno y ser
  consistentes). Ejemplo: `feat(backend): agregar chunking consciente de headers markdown`.
- Si la tarea toca `backend/`, correr antes de commitear:
  ```bash
  python -m py_compile $(find backend/app -name "*.py")
  ```
  (lo mismo con `frontend/app` si se tocó el frontend). El CI corre esto
  igual, pero detectarlo localmente ahorra una vuelta de PR.

## 3. Pull Request

- Abrir el PR contra `main` apenas la tarea esté funcional, aunque sea
  chica — PRs grandes son más difíciles de revisar bajo presión de tiempo.
- Título del PR: mismo estilo que el nombre de la rama, en imperativo.
  Ejemplo: "Agregar cliente HTTP del frontend hacia el backend".
- Descripción mínima: qué hace, cómo probarlo (`docker compose up` +
  endpoint o pantalla a mirar).
- El check de CI (`syntax-check` + `validate-compose`) tiene que estar en
  verde antes de mergear.
- Con 3+ personas en el equipo: al menos 1 review antes de mergear. Con 2
  personas: alcanza con avisar por el canal del equipo y hacer una lectura
  cruzada rápida.

## 4. Merge

**Squash and merge**, siempre. Mantiene `main` con un commit por feature,
aunque adentro de la rama haya habido commits de prueba y error. Borrar
la rama después de mergear (GitHub lo ofrece automáticamente).

## 5. Antes de la presentación

Congelar el estado que se va a mostrar con un tag, para tener un punto de
retorno conocido si algo se rompe a último momento:

```bash
git tag -a v1.0-demo -m "Estado estable para la presentación"
git push origin v1.0-demo
```

## Protecciones configuradas en `main`

- No se permite push directo; todo entra por PR.
- Check de CI obligatorio antes de poder mergear.
- Revisión mínima de 1 persona (si el equipo lo amerita).
