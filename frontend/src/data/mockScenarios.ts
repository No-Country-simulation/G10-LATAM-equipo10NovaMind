import type { TechnicalScenario, Achievement, RealDocumentPreset } from '../types/types';

export const SCENARIOS: TechnicalScenario[] = [
  {
    id: 'oci-swap-memory',
    titulo: 'Guía Técnica OCI: Optimización de Memoria y Swap de 4 GB en VM.Standard.E2.1.Micro',
    nicho: 'General',
    perfilRecomendado: 'Principiante',
    contenido: `En la capa Always Free de Oracle Cloud Infrastructure (OCI), las instancias VM.Standard.E2.1.Micro cuentan con 1 vCPU AMD EPYC y 1 GB de RAM física. Cuando se ejecutan procesos modernos como compilaciones de frontend (npm run build de Vite/TypeScript, pico de 1.4-1.8 GB) o backends de IA con FastAPI y ChromaDB (pico de 1.2 GB), el kernel activa el OOM Killer (Out Of Memory Killer) y termina los procesos con código 137. Para evitarlo y operar con $0.00 USD de por vida, se aprovisiona un Swapfile de 4 GB en el Boot Volume NVMe: sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile, registrándolo en /etc/fstab y ajustando vm.swappiness=20. Esto expande la memoria virtual a 5 GB totales y garantiza 100% de estabilidad operativa.`,
    data: {
      status: 'exito',
      metadatos: {
        perfil_aplicado: 'Principiante',
        formato_generado: 'Paquete Educativo Completo (5 Estaciones)',
        tiempo_estimado_estudio_minutos: 6,
        conceptos_clave: ['VM.Standard.E2.1.Micro', 'OOM Killer (SIGKILL 137)', 'Swap de 4 GB', 'Swappiness 20', 'Persistencia /etc/fstab'],
        fecha_generacion: '2026-10-07T23:00:00Z',
        modelo_llm: 'Ejemplo incluido en la app (no lo generó un modelo)'
      },
      contenido_adaptado: {
        titulo: 'Dominando la Memoria en OCI: Aprovisionamiento de 4 GB Swap sin Costos',
        introduccion_contextualizada: 'Aprende a transformar una máquina virtual gratuita de 1 GB en un servidor resistente de 5 GB virtuales en Oracle Cloud para correr aplicaciones modernas sin caídas.',
        resumen_ninja: {
          titulo: 'Arquitectura de Memoria Virtual & Prevención de Caídas',
          analogia_central: 'La memoria RAM es tu escritorio de trabajo de 1 GB. El Swap de 4 GB es un cajón auxiliar en el disco: cuando la mesa se satura con tareas pesadas (npm build), guardas temporalmente lo inactivo en el cajón para que nada se caiga al suelo (OOM Crash).',
          conceptos_clave: [
            { id: 'c1', texto: 'Restricción Always Free: Las instancias micro de OCI incluyen 1 GB de RAM física gratuita de por vida.', verificado: false },
            { id: 'c2', texto: 'OOM Killer: El vigilante del kernel de Linux que mata tus procesos con señal 137 si se agota la memoria.', verificado: false },
            { id: 'c3', texto: 'Swap de 4 GB: Expande la capacidad a 5 GB totales, permitiendo compilar TypeScript y ejecutar FastAPI sin pagar.', verificado: false }
          ],
          metricas_rapidas: {
            riesgo: 'Cero (OOM Killer neutralizado)',
            despliegue: '< 3 minutos (Terminal Bash)',
            tipo_oci: 'VM.Standard.E2.1.Micro',
            costo: '$0.00 USD (Always Free OCI)'
          }
        },
        flashcards: [
          {
            id: 'fc-swap-1',
            frente: '¿Qué es el temido "OOM Killer" en una máquina virtual de Linux?',
            dorso: 'Es un mecanismo de emergencia del kernel. Si la memoria RAM se agota al 100%, el kernel termina forzosamente los procesos más pesados (código de salida 137) para evitar el congelamiento del sistema operativo.',
            pista_didactica: 'OOM significa "Out Of Memory" (Sin Memoria).',
            dominado: false
          },
          {
            id: 'fc-swap-2',
            frente: '¿Por qué fallan "npm run build" y "ChromaDB" en una instancia VM.Standard.E2.1.Micro sin Swap?',
            dorso: 'Porque la compilación de TypeScript y la carga de librerías de IA generan picos transitorios de 1.4 GB a 1.8 GB de memoria, superando el gigabyte físico disponible.',
            pista_didactica: 'La demanda de compilación excede la capacidad física del hardware.',
            dominado: false
          },
          {
            id: 'fc-swap-3',
            frente: '¿Para qué sirve el parámetro "vm.swappiness=20"?',
            dorso: 'Indica al kernel que agote el 80% de la memoria RAM física rápida antes de recurrir a la memoria en disco (Swap), evitando ralentizaciones innecesarias.',
            pista_didactica: 'Controla qué tan "ansioso" es el sistema para escribir en disco.',
            dominado: false
          }
        ],
        tutorial: [
          {
            id: 'tut-swap-1',
            paso: 1,
            titulo: 'Reserva de Espacio y Permisos de Seguridad',
            descripcion: 'Crea el archivo de 4 GB contiguos en el disco NVMe y restringe el acceso exclusivamente al usuario root (chmod 600).',
            cli_command: 'sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile',
            completado: false,
            verificacion: 'ls -lh /swapfile confirma tamaño 4.0G con permisos -rw-------.'
          },
          {
            id: 'tut-swap-2',
            paso: 2,
            titulo: 'Inicialización y Activación del Swap',
            descripcion: 'Formatea el archivo con la firma de swap de Linux y actívalo de inmediato en el kernel.',
            cli_command: 'sudo mkswap /swapfile && sudo swapon /swapfile',
            completado: false,
            verificacion: 'El kernel responde "Setting up swapspace version 1" y swapon activa el archivo.'
          },
          {
            id: 'tut-swap-3',
            paso: 3,
            titulo: 'Persistencia en Boot (/etc/fstab)',
            descripcion: 'Asegura que el archivo se monte automáticamente tras reinicios o mantenimientos de la VM.',
            cli_command: 'echo \'/swapfile none swap sw 0 0\' | sudo tee -a /etc/fstab',
            completado: false,
            verificacion: 'Línea registrada permanentemente al final de /etc/fstab.'
          },
          {
            id: 'tut-swap-4',
            paso: 4,
            titulo: 'Optimización de Swappiness y Verificación',
            descripcion: 'Ajusta la agresividad del kernel a 20 e inspecciona el estado de la memoria.',
            cli_command: 'echo \'vm.swappiness=20\' | sudo tee -a /etc/sysctl.conf && sudo sysctl -p && free -h',
            completado: false,
            verificacion: 'Comando free -h muestra 4.0Gi en la fila de Swap.'
          }
        ],
        director_cut: [
          {
            id: 'sc-swap-1',
            escena: 1,
            tiempo: '00:00 - 00:18',
            duracion_segundos: 18.3,
            titulo: 'La Frustración del Error 137 Killed',
            guion_locutor: 'Estás desplegando en una instancia Always Free de Oracle Cloud con un solo gigabyte de RAM. Ejecutas npm run build y, a los pocos segundos, aparece Killed con el código 137. El kernel acaba de liquidar tu proceso por falta de memoria.',
            estimacion_palabras: 42,
            storyboard_visual: 'Pantalla de terminal con texto en rojo "Killed (exit code 137)", seguida por el logotipo de Oracle Cloud Always Free.',
            consejo_pedagogico: 'Empieza con el dolor común de todo desarrollador para enganchar la atención de inmediato.',
            objetivo_pedagogico: 'Identificar el disparador del OOM Killer en VMs de 1 GB de RAM.',
            visual: {
              tipo: 'ppt_concepto',
              titulo: 'Diagnóstico: OOM Killer en OCI',
              puntos_clave: ['1 GB RAM física', 'Exit Code 137', 'Vite / Next.js Build Failure'],
              prompt_grafico: 'Terminal oscura con mensaje de kernel OOM Killer resaltado en rojo neón.'
            },
            fuentes: [
              {
                chunk_id: 'chk-oci-01',
                pagina: 1,
                texto_fuente: 'En instancias micro de 1 GB de RAM, procesos pesados de compilación Node.js activan el Out-Of-Memory Killer de Linux arrojando código 137.'
              }
            ]
          },
          {
            id: 'sc-swap-2',
            escena: 2,
            tiempo: '00:18 - 00:35',
            duracion_segundos: 17.0,
            titulo: 'Creando 4 GB de Memoria Virtual en 4 Comandos',
            guion_locutor: 'La solución es un archivo de swap. Con fallocate reservamos cuatro gigabytes en el disco NVMe, lo blindamos con chmod 600 para que solo root lea esos volcados de memoria, lo formateamos con mkswap y lo activamos con swapon.',
            estimacion_palabras: 39,
            storyboard_visual: 'Animación esquemática donde un bloque de 1 GB RAM se expande con un bloque complementario de 4 GB etiquetado como NVMe Boot Volume.',
            consejo_pedagogico: 'Muestra la terminal en vivo ejecutando los comandos con tipografía limpia en modo oscuro.',
            objetivo_pedagogico: 'Explicar la creación segura y permisos 600 de un swapfile.',
            visual: {
              tipo: 'diagrama_bloques',
              titulo: 'Topología de Expansión de Memoria',
              puntos_clave: ['1 GB RAM DDR4', '+ 4 GB Swap NVMe', '= 5 GB Memoria Total'],
              codigo_o_estructura: 'sudo fallocate -l 4G /swapfile\nsudo chmod 600 /swapfile\nsudo mkswap /swapfile\nsudo swapon /swapfile'
            },
            fuentes: [
              {
                chunk_id: 'chk-oci-02',
                pagina: 2,
                texto_fuente: 'fallocate reserva 4 GB en disco NVMe local. Los permisos 600 son críticos para impedir que usuarios sin privilegios lean volcados de memoria.'
              }
            ]
          },
          {
            id: 'sc-swap-3',
            escena: 3,
            tiempo: '00:35 - 00:53',
            duracion_segundos: 17.8,
            titulo: 'Compilación Exitosa y Costo Cero Garantizado',
            guion_locutor: 'Lanzamos el build de nuevo. Esta vez el compilador supera el gigabyte y medio de memoria sin detenerse y termina en doce segundos. Con free -h comprobamos los cuatro gigas de swap, y la factura de OCI sigue en cero dólares.',
            estimacion_palabras: 41,
            storyboard_visual: 'La terminal muestra Vite build in 12s en verde brillante, y la consola OCI confirma costo $0.00 USD.',
            consejo_pedagogico: 'Cerrar con el resultado victorioso: éxito técnico y costo cero garantizado.',
            objetivo_pedagogico: 'Validar la estabilidad del build y cero costo en OCI Always Free.',
            visual: {
              tipo: 'comparativa',
              titulo: 'Antes vs Después de Swapfile',
              puntos_clave: ['Antes: Killed 137 en 4s', 'Después: Vite Build OK en 12s', 'Factura OCI: $0.00 USD / mes'],
              codigo_o_estructura: 'free -h  # Muestra 4.0Gi Swap disponible'
            },
            fuentes: [
              {
                chunk_id: 'chk-oci-03',
                pagina: 3,
                texto_fuente: 'Con 4 GB de Swap NVMe, el sistema soporta picos de memoria de compilación sin incurrir en costos de escalado vertical en OCI.'
              }
            ]
          }
        ],
        quiz: [
          {
            id: 'q-swap-1',
            pregunta: '¿Por qué es indispensable configurar permisos 600 (chmod 600) en el archivo /swapfile?',
            opciones: [
              'A) Porque de lo contrario Linux se niega a arrancar el entorno gráfico.',
              'B) Porque el Swap contiene volcados de memoria que pueden almacenar credenciales y secretos; solo root debe tener acceso.',
              'C) Porque los permisos 600 aceleran la velocidad de lectura del disco NVMe.'
            ],
            respuesta_correcta: 1,
            justificacion_rag: 'El espacio swap almacena páginas de memoria en texto plano donde pueden residir variables de entorno, tokens y claves de sesión. Restringir el archivo a lectura/escritura exclusiva de root evita ataques locales de exfiltración de memoria.',
            cita_fuente: 'Guía Técnica Oficial OCI: "El Swap contiene volcados de memoria donde pueden residir variables de entorno, claves de sesión o fragmentos de datos. Es obligatorio restringir la lectura y escritura exclusivamente al usuario root (chmod 600)."'
          },
          {
            id: 'q-swap-2',
            pregunta: '¿Cuál es el propósito de configurar "vm.swappiness=20" en lugar del valor por defecto (60)?',
            opciones: [
              'A) Desactivar completamente la memoria RAM para usar solo el disco duro.',
              'B) Priorizar el uso de la memoria RAM física rápida hasta agotar el 80% antes de acudir al disco, evitando ralentizaciones.',
              'C) Aumentar el límite de conexiones TCP en la Virtual Cloud Network.'
            ],
            respuesta_correcta: 1,
            justificacion_rag: 'El valor por defecto swappiness=60 traslada páginas a swap de forma prematura. Un valor de 20 instruye al kernel a exprimir la RAM física disponible antes de paginar en disco, manteniendo la máxima agilidad en el CPU.',
            cita_fuente: 'Documentación de Kernel Linux & OCI: "vm.swappiness=20: Prioriza el uso de la RAM física hasta agotar el 80% antes de acudir al disco."'
          },
          {
            id: 'q-swap-3',
            pregunta: '¿Qué comando permite certificar en una sola línea que el Swap está activo y con 4.0 GiB disponibles?',
            opciones: [
              'A) free -h',
              'B) oci compute restart',
              'C) ping localhost'
            ],
            respuesta_correcta: 0,
            justificacion_rag: 'El comando "free -h" despliega en formato legible por humanos las líneas de memoria física (Mem) y memoria de intercambio (Swap), indicando el total asignado (4.0Gi) y el uso actual.',
            cita_fuente: 'Guía Técnica Oficial OCI: "Verificación global de memoria: free -h. Respuesta certificada: Swap total 4.0Gi."'
          }
        ]
      },
      // Paquete de ejemplo escrito a mano: no pasó por el auditor ni se subió a OCI, y lo dice
      evaluacion_calidad: {
        anclaje_fuente_score: null,
        auditoria_ejecutada: false,
        claridad_pedagogica: 'Alta',
        observaciones: 'Paquete de ejemplo incluido en la app: no pasó por la auditoría de fidelidad.'
      },
      almacenamiento_oci: {
        status_upload: 'omitido'
      }
    }
  }
];

export const REAL_DOCUMENTS_CATALOG: RealDocumentPreset[] = [
  {
    id: 'guia-swap-oci',
    nombre_archivo: 'guia_optimizacion_swap_oci.md',
    titulo: 'Guía Técnica OCI: Optimización de Memoria y Swap de 4 GB',
    nicho: 'Industria y Operaciones',
    perfil: 'Principiante',
    detalle: 'Didáctico',
    formato_sugerido: 'Paquete Educativo Completo (5 Estaciones)',
    tipo: 'markdown',
    tamano_formato: '7.7 KB (Markdown)',
    descripcion: 'Arquitectura de memoria virtual y aprovisionamiento de 4 GB Swap en VM.Standard.E2.1.Micro para prevenir el OOM Killer sin costes en OCI Always Free.',
  },
  {
    id: 'apache-kafka',
    nombre_archivo: 'apache_kafka_introduction.md',
    titulo: 'Apache Kafka: Fundamentos y Arquitectura de Event Streaming',
    nicho: 'Finanzas y Contabilidad',
    perfil: 'Desarrollador Junior',
    detalle: 'Didáctico',
    formato_sugerido: 'Paquete Educativo Completo (5 Estaciones)',
    tipo: 'markdown',
    tamano_formato: '11.2 KB (Markdown)',
    descripcion: 'Fundamentos de Event Streaming distribuido, Topics, Particiones y Arquitectura de Microservicios reactivos en tiempo real.',
  },
  {
    id: 'enisa-threat-landscape',
    nombre_archivo: 'ENISA Threat Landscape 2026_Final.pdf',
    titulo: 'ENISA Threat Landscape: Ciberamenazas y Resiliencia Digital',
    nicho: 'Medicina y Salud',
    perfil: 'Líder Técnico / Arquitecto',
    detalle: 'Didáctico',
    formato_sugerido: 'Paquete Educativo Completo (5 Estaciones)',
    tipo: 'pdf',
    tamano_formato: '8.4 MB (PDF Oficial)',
    descripcion: 'Informe exhaustivo de la Agencia Europea de Ciberseguridad sobre vectores de ataque, cadenas de suministro y ciberdefensa moderna.',
  },
  {
    id: 'quijote-primera-parte',
    nombre_archivo: 'quijote_primera_parte_resumen.md',
    titulo: 'Don Quijote de la Mancha · Primera Parte (1605)',
    nicho: 'Leyes y Legal',
    perfil: 'Principiante',
    detalle: 'Didáctico',
    formato_sugerido: 'Paquete Educativo Completo (5 Estaciones)',
    tipo: 'markdown',
    tamano_formato: '15 KB (Markdown)',
    descripcion: 'Resumen del argumento de la primera parte de la obra de Cervantes (dominio público), tomado de Wikipedia en español con licencia CC BY-SA 4.0.',
  },
  {
    id: 'quijote-segunda-parte',
    nombre_archivo: 'quijote_segunda_parte_resumen.md',
    titulo: 'Don Quijote de la Mancha · Segunda Parte (1615)',
    nicho: 'Marketing y Ventas',
    perfil: 'Principiante',
    detalle: 'Didáctico',
    formato_sugerido: 'Paquete Educativo Completo (5 Estaciones)',
    tipo: 'markdown',
    tamano_formato: '15 KB (Markdown)',
    descripcion: 'Resumen del argumento de la segunda parte de la obra de Cervantes (dominio público), tomado de Wikipedia en español con licencia CC BY-SA 4.0.',
  },
];

export const INITIAL_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'ninja',
    titulo: 'Síntesis',
    descripcion: 'Asimila los conceptos esenciales y activa la intuición didáctica del tema.',
    icono: '⚡',
    desbloqueado: false,
    categoria: 'ninja',
  },
  {
    id: 'streak',
    titulo: 'Memoria de Acero',
    descripcion: 'Supera la ronda de evocación activa dominando los conceptos clave.',
    icono: '🧠',
    desbloqueado: false,
    categoria: 'streak',
  },
  {
    id: 'builder',
    titulo: 'Ingeniero de Laboratorio',
    descripcion: 'Ejecuta y valida cada paso técnico del entorno interactivo.',
    icono: '💻',
    desbloqueado: false,
    categoria: 'builder',
  },
  {
    id: 'director',
    titulo: 'Director Didáctico',
    descripcion: 'Recorre el guion pedagógico y comprende la narrativa de transmisión.',
    icono: '🎬',
    desbloqueado: false,
    categoria: 'director',
  },
  {
    id: 'master',
    titulo: 'Maestro Cero Alucinaciones',
    descripcion: 'Supera el Examen Final conservando escudos cognitivos y anclaje RAG.',
    icono: '👑',
    desbloqueado: false,
    categoria: 'master',
  },
];