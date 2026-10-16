-- El cuestionario sale de la tarea B1 y pasa a una tarea propia, «C», que corre después de
-- A, B1 y B2 y pregunta solo por lo que enseñaron las demás estaciones.
alter table public.generation_tasks drop constraint if exists generation_tasks_task_check;
alter table public.generation_tasks
  add constraint generation_tasks_task_check check (task in ('A', 'B1', 'B2', 'C', 'tts'));
