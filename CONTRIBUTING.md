# Guía de Contribución — NuevaMente

Guía de flujo de trabajo para el equipo de desarrollo de **NuevaMente** (Hackathon ONE G10 · Oracle Next Education & Alura). Seguimos **GitHub Flow** (trunk-based): una rama principal estable (`main`) y ramas efímeras de corta duración por funcionalidad o corrección.


## 1. Antes de Iniciar una Tarea

Asegúrate de partir siempre del estado más reciente de `main`:
```bash
git checkout main
git pull origin main
git checkout -b feature/<area>-<descripcion-corta>
```

### Convención de Ramas
`<tipo>/<área>-<descripción-corta>`

| Tipo | Propósito |
|---|---|
| `feature/` | Funcionalidad o módulo nuevo |
| `fix/` | Corrección de un fallo o regresión |
| `docs/` | Documentación, diagramas o especificaciones |
| `chore/` | Mantenimiento de dependencias, scripts o CI/CD |

Ejemplos:
```
feature/backend-generacion-paralela
feature/frontend-estacion-resumen
fix/backend-cors-produccion
docs/arquitectura-general
chore/actualizar-requisitos
```


## 2. Durante el Desarrollo

- **Commits atómicos y descriptivos:** Utilizar estilo convencional (ejemplo: `feat(backend): agregar verificación determinista de citas`).
- **Verificación de Sintaxis y Tipos:**
  - Backend:
    ```powershell
    python -m py_compile (Get-ChildItem -Path backend/app -Recurse -Filter *.py | Select-Object -ExpandProperty FullName)
    ```
  - Frontend:
    ```powershell
    cd frontend
    npx tsc --noEmit -p .
    ```
- **Pruebas Automatizadas Locales:**
  Antes de abrir un Pull Request, toda la suite debe pasar en verde:
  - Backend: `cd backend && python -m pytest -q` (300 tests)
  - Frontend: `cd frontend && npm test` (26 tests)


## 3. Pull Requests y Revisiones

- Abrir el PR contra la rama `main`.
- **Descripción clara:** Qué problema resuelve, qué componentes modifica y cómo probarlo localmente.
- **Estrategia de Integración:** **Squash and Merge** siempre. Mantiene el historial de `main` ordenado con un commit limpio por funcionalidad terminada.
- Eliminar la rama remota tras completar el merge.


## 4. Congelamiento de Versiones para Demostraciones

Para fijar un hito estable antes de una evaluación o entrega:
```bash
git tag -a v2.8-demo -m "Versión estable para demostración Hackathon"
git push origin v2.8-demo
```
