# Pendientes y próximos pasos

Corte: **14 de octubre de 2026, tarde**. Las preguntas de la sección 1 son las que el agente debe hacer al retomar el trabajo. El detalle técnico está en `deploy/auditoria/PROXIMOS_PASOS.md` (no versionado) y la historia, en `BITACORA_FULLSTACK_V2.md` (las últimas entradas cuentan la jornada del 14/10).

## Al retomar (leer primero)

- **Quién hace qué:** Claude trabaja en esta carpeta y deja los cambios verificados **sin commit**, con el mensaje propuesto. **Los commits y el push los hace Gemini** o el usuario. Gemini trabaja en `../NovaMind-gemini` (rama `gemini/pruebas`) y a veces lanza scripts en `../pruebas_nichos/` sin abrir puertos: revisar `git status` y `git log -1` antes de editar.
- **Último commit en el remoto:** `7a6cd6f` (documentación, CHANGELOG 2.7.0). Solo falta subir este archivo con `docs: pendientes listos para retomar`. Si ya está en `git log`, ignorar esta línea.
- **En curso fuera del repo:**
  - **El encargado de Supabase** revisa la página de migraciones (artefacto «Migraciones Supabase de NovaMind»: https://claude.ai/code/artifact/178338d3-0d5b-4af9-9321-795137a8c70a), con los 2 SQL de `supabase/migrations/`.
  - **Lista de despliegue en las VM:** https://claude.ai/code/artifact/fc2a9cf5-f4a0-40c8-b6b0-453de2a8c0d4. Ya está al día (versión 2: `VITE_OCI_PAR_URL` ya no existe).
- **Siguiente trabajo propuesto, sin cuota:** exportar el video como WebM (sección 3, punto 9, opcional). Gastan cuota: una 4.ª corrida de nichos (punto 4) y el repaso guiado con modelo (punto 5). Las palabras clave de las fotos quedaron hechas el 14/10, sin commit.
- **Servidores locales:** el backend de Claude (puerto 8000) y el front (5173) pueden seguir abiertos desde la sesión anterior; si el puerto está ocupado, preguntar antes de reiniciarlos.

## Estado de las ramas

| Rama | Commit | Situación |
|---|---|---|
| `feature/fullstack-nuevamente-v2` (local y `origin`) | `7a6cd6f` | Rama de trabajo, sincronizada con el remoto |
| `gemini/pruebas` (worktree `../NovaMind-gemini`) | `7a6cd6f` o posterior | Rama de Gemini, que hace los commits |
| `backend` e `integracion` (local y remoto) | `394d19c` | Muy por detrás: falta un fast-forward a la rama de trabajo (lo decide el usuario) |
| `origin/frontEnd` | — | Absorbida el 14/10. Se deja sin tocar |
| `origin/feature/newmind-edtech-oci` | — | Absorbido o descartado con motivo todo lo aprovechable |

## 1. Preguntas para el usuario

1. **¿Cómo fue la prueba en el navegador?** La lista está en la conversación del 14/10 y cubre:
   - **Flashcards:** pista en el anverso y botones para girar.
   - **Quiz:** reintento por pregunta, 100 % y repaso guiado (al aprobar y al agotar escudos).
   - **Vitrina de trofeos.**
   - **"Copiar prompt visual".**
   - **Voz latina del navegador.**
   - **Mermaid.**
   - **Sesión y caché de invitados.**

   Cada fallo se arregla antes de desplegar.

   **Revisión del 14/10 hecha con Gemini en Chrome real:**
   - **Ya probado:** fallo con escudo, "Repasa esto", pantalla con 0 escudos, prompt visual, voz es-US, flashcards a 400 px y caché de invitados.
   - **Falta probar a mano:**
     - "Restaurar escudos": la captura no lo muestra;
     - "Descartaste «…»": la captura se corta antes;
     - con cuenta, que la opción fallada siga marcada tras recargar;
     - iniciar y cerrar sesión;
     - los dos textos nuevos de la medalla (invitado y con cuenta).
2. ~~**¿Se arregla el plazo de `/api/v1/narracion/generar`?**~~ **Hecho el 14/10.**
   - Plazo de 80 s para la voz y las fotos.
   - ElevenLabs espera 25 s.
   - Un guion que no puede caber se rechaza antes de pagar la voz (`guion_largo`).
   - El detalle está en la bitácora.
3. ~~**¿Cuándo se ejecuta el E2E de narración?**~~ **Hecho el 14/10.**
   - Resultado: OK, 3 escenas con ElevenLabs y foto, 45,9 s de un máximo de 60 s.
   - La narración tardó 5,7 s.
   - `tsc` limpio.
   - El detalle está en la bitácora.
   - Para repetirlo: `node tests/e2e_narracion.manual.ts`, desde `frontend/`, o `--spec <guion.json>` para reutilizar un guion.
4. **¿Se unifican las ramas?** El push de la rama de trabajo ya se hace con cada commit de Gemini. Falta un `merge --ff-only` de `backend` e `integracion` a la rama de trabajo, seguido de push. Son acciones sobre el remoto compartido: las hace el usuario o las autoriza explícitamente.
5. **¿Se despliega en la VM?** La guía está en `deploy/README_DESPLIEGUE_OCI.md`, sección 3b. Bloqueantes:
   - `client_max_body_size 16m` en nginx; sin esto, toda subida de más de 1 MB da 413;
   - `GEMINI_API_KEY`, `GROQ_API_KEY`, `SUPABASE_*` y `ELEVENLABS_*` en el `.env` de la VM;
   - `PERMITIR_MODO_INVITADO=true` si la demo usa invitados con `APP_ENV=prod`;
   - `VITE_SUPABASE_*` en el build del front.
6. **¿Qué respondió el encargado de Supabase?** Revisa la página de migraciones (enlace en «Al retomar»): las 2 migraciones de `supabase/migrations/`, RLS en las 6 tablas y las URL de vuelta `/auth/callback`. Sin la segunda migración, la caché de los usuarios con cuenta y el registro de la narración no se guardan.

## 2. Decisiones del equipo

- **Botón para adaptar un recurso a un nicho o sector** (idea del usuario). Dos opciones:
  - **Elegir el sector en la Estación 1:** una sola generación, más barata y coherente.
  - **Un botón por estación:** más flexible, pero cada clic gasta cuota.
- **Ramas remotas antiguas:** archivarlas con una etiqueta (`archivo/frontEnd`, `archivo/newmind-edtech-oci`) y borrarlas.
- **Seguridad de `feature/newmind-edtech-oci`:** su `geminiService.ts` usa `VITE_GEMINI_API_KEY`, que queda en el JavaScript público. **Si esa rama se desplegó alguna vez con una clave real, hay que rotarla.**
- **Promover a `main`:** `origin/main` solo tiene el README inicial.
- **ElevenLabs:**
  - subir el tope de créditos de la clave de 1 000 a 10 000, porque 1 000 alcanzan para unas 2 narraciones;
  - escuchar la voz Alice y decidir si se queda;
  - restringir la clave a la IP de la VM.
- **Pago por uso de Gemini:** solo si en la demo falta cuota. El modelo del resumen ya está decidido: se queda `3.5-flash-lite`.

## 3. Trabajo técnico pendiente

En orden de prioridad:

1. ~~**Guion fuera de rango.**~~ **Hecho el 14/10.**
   - Un guion de más de 125 palabras se acorta con una llamada breve antes de publicarlo.
   - La demo pasó a 122 palabras.
   - Falta probarlo con un documento real que genere un guion largo: gasta cuota de Gemini.
2. ~~**Privacidad.**~~ **Hecho el 14/10.**
   - La dirección se enmascara en los logs.
   - Los tests ya no suben PDF a OCI.
   - El recibo usa la ruta real.
   - **Decisión pendiente del equipo:** borrar del bucket los 2 objetos de prueba (`documentos-originales/doc-arquitectura.pdf` y `doc-t.pdf`).
3. ~~**Visor de fuente.**~~ **Hecho el 14/10.**
   - El chip «Fuente · pág. N» abre el pasaje literal del documento con la cita resaltada.
   - También en las citas de la Estación 4 (hecho el 14/10).
   - Los paquetes guardados antes del cambio no traen contexto, así que su chip sigue siendo texto.
4. **Nichos: 3.ª corrida hecha y auditada el 14/10** (`resultados_20261014_1402`; detalle en la bitácora).
   - Se cumple la regla de una escena en los 3 nichos.
   - Medicina ya tiene guion.
   - Las citas verificadas están en torno al 96 %.
   - **Queda:**
     - Leyes atribuyó una vez al documento un uso legal (1 de 5);
     - las palabras clave copiaban los ejemplos del prompt, ya corregido sin commit. Una 4.ª corrida lo confirmaría (unas 15 llamadas).
   - Texto original de este punto: (unas 15 llamadas a Gemini, fuera del repo). Debe confirmar que el sector aparece en una sola escena del guion y dar el guion de Medicina, que en la 2.ª corrida falló por un 503 de Google. Resultados en `../pruebas_nichos/`.
   - **Preparada el 14/10 por la tarde:** el script trae la sección 7 (guion escena a escena y palabras clave de las fotos), y `LEEME.md`, las instrucciones de la 3.ª corrida.
   - Requisito: antes, el commit del cambio de las palabras clave.
   - Reconstruida con los datos de la 2.ª corrida, la sección 7 da Leyes con el sector en 2 escenas y Finanzas en 3: ninguno cumple aún la regla.
5. **Repaso guiado con modelo (opcional):** un plan de repaso breve redactado solo a partir de las citas de las preguntas falladas. La versión sin modelo ya está hecha.
6. ~~**Palabras clave de las fotos.**~~ **Hecho el 14/10.**
   - El prompt pide un objeto o lugar físico.
   - Una palabra ambigua ("cloud", "kafka"…) deja la escena sin foto.
   - En la 3.ª corrida de nichos se copiaban los ejemplos del prompt. Ya está corregido, sin commit; falta confirmarlo con otra corrida.
   - **Openverse con plazo propio de 25 s** (antes, 8 s comunes). Hecho el 14/10, sin commit.
7. ~~**Límites conocidos de la verificación de citas.**~~ **Hecho el 14/10, sin commit.**
   - Se verifican la nota pegada a un año y las citas que cruzan un salto de página, con o sin notas al pie.
   - Saltos de página: 152 de 152 en tres PDF reales, y 0 falsos positivos en 455 casos negativos. El detalle está en la bitácora.
8. **Velocidad de la voz:** si se agranda el guion, revisar `PALABRAS_GUION_MIN` y `PALABRAS_GUION_MAX` (ElevenLabs habla a unas 145 palabras por minuto y Gemini a unas 160).
9. **Exportar el video como WebM (opcional):** con `MediaRecorder` en el navegador, nunca con FFmpeg en la VM.
10. ~~**Documentación por módulos sin versionar.**~~ **Decidido el 14/10:** `backend/docs/modulos/` se queda solo en el ordenador del usuario. No se versiona. Los errores que Gemini introdujo en ellos ya están corregidos.

## 4. Hecho el 14/10 (resumen)

- Caché de invitados y de auditorías: repetir un documento ya no gasta cuota.
- Clasificación de los 429 de Gemini (diario o por minuto) y respaldo escalonado. El trabajo de Gemini se revisó y se corrigió: semáforo global y solo para el respaldo, y prioridad de la cuota diaria.
- Front portado de `newmind-edtech-oci`:
  - flashcards;
  - vitrina de trofeos;
  - texto de los escudos;
  - 100 % solo en el quiz, con reintento por pregunta;
  - voz latina por nombre;
  - directivas de nivel de detalle;
  - "Copiar prompt visual".
- Repaso guiado del quiz, sin modelo.
- Lint del front a cero.
- Rama `frontEnd` absorbida: tabla Python ↔ Node en el README y limpieza de componentes y dependencias sin uso.
- `.env.example` completo y guía de despliegue actualizada (sección 3b).
- Modelo del resumen decidido: se queda `3.5-flash-lite`.
