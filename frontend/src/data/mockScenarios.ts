import type { TechnicalScenario, Achievement } from '../types/types';

export const SCENARIOS: TechnicalScenario[] = [
  {
    id: 'vcn-network',
    titulo: 'Introducción a la Arquitectura de Redes VCN en OCI',
    nicho: 'General',
    perfilRecomendado: 'Principiante',
    contenido: `La Virtual Cloud Network (VCN) es una red privada y personalizable configurada en Oracle Cloud Infrastructure. Similar a una red de centro de datos tradicional, la VCN ofrece control total sobre su entorno de red, incluyendo subredes públicas y privadas, tablas de enrutamiento, Internet Gateways, NAT Gateways y Security Lists para control de tráfico mediante reglas de entrada (ingress) y salida (egress). Permite asignar bloques CIDR IPv4/IPv6 contiguos y segmentar la topología con baja latencia y aislamiento físico de tenants.`,
    data: {
      status: 'exito',
      metadatos: {
        perfil_aplicado: 'Principiante',
        formato_generado: 'Paquete Educativo Completo (5 Estaciones)',
        tiempo_estimado_estudio_minutos: 6,
        conceptos_clave: ['VCN', 'Subredes Públicas/Privadas', 'Internet Gateway', 'Security Lists', 'Tablas de Enrutamiento'],
        fecha_generacion: '2026-10-04T18:00:00Z',
        modelo_llm: 'Gemini 2.5 Flash + RAG Vector Grounding'
      },
      contenido_adaptado: {
        titulo: 'Dominando Redes en la Nube (VCN) desde Cero',
        introduccion_contextualizada: 'Imagina la VCN como tu propio barrio privado y seguro dentro de la nube de Oracle, donde tú decides quién entra y quién sale.',
        resumen_ninja: {
          titulo: 'Sintaxis Rápida y Pilares de la VCN',
          analogia_central: 'Una VCN es el perímetro fortificado de tu centro de cómputo en la nube de Oracle: aísla tus máquinas, define autopistas seguras hacia internet y filtra visitantes.',
          conceptos_clave: [
            { id: 'c1', texto: 'Aislamiento absoluto: Ningún servidor se comunica hacia afuera sin un Gateway explícito.', verificado: false },
            { id: 'c2', texto: 'Subred Pública vs Privada: Las públicas tienen IP accesible desde la web; las privadas guardan bases de datos.', verificado: false },
            { id: 'c3', texto: 'Security Lists: Guardias virtuales de aduana con reglas estatales Ingress y Egress.', verificado: false }
          ],
          metricas_rapidas: {
            riesgo: 'Bajo (Aislamiento por defecto)',
            despliegue: '< 5 min (Always Free)',
            tipo_oci: 'Core Networking VCN',
            costo: '$0.00 (Capa Gratuita ONE)'
          }
        },
        flashcards: [
          {
            id: 'fc-1',
            frente: '¿Qué es una VCN en Oracle Cloud Infrastructure?',
            dorso: 'Es tu red virtual privada y personalizada dentro de la nube de Oracle, funcionando con el mismo aislamiento de un centro de datos físico pero con flexibilidad por software.',
            pista_didactica: 'Piensa en ella como el terreno cercado y delimitado donde residen tus servidores.',
            dominado: false
          },
          {
            id: 'fc-2',
            frente: '¿Para qué sirven las Security Lists (Listas de Seguridad)?',
            dorso: 'Son guardias virtuales de firewall que definen exactamente qué paquetes de datos pueden entrar (ingress) o salir (egress) a nivel de subred.',
            pista_didactica: 'Son como la lista de invitados VIP y el control de pasaportes de tu red.',
            dominado: false
          },
          {
            id: 'fc-3',
            frente: '¿Cuál es la diferencia crítica entre un Internet Gateway y un NAT Gateway?',
            dorso: 'El Internet Gateway permite tráfico bidireccional para servidores públicos. El NAT Gateway permite que servidores privados salgan a internet (ej. descargar parches) sin que internet pueda iniciar conexiones hacia ellos.',
            pista_didactica: 'Internet Gateway = puerta giratoria de dos vías. NAT Gateway = mirilla de puerta que solo abre hacia afuera.',
            dominado: false
          }
        ],
        tutorial: [
          {
            id: 't-1',
            paso: 1,
            titulo: 'Aprovisionamiento de la VCN Raíz',
            descripcion: 'Crea el bloque de red privado con CIDR /16 asignando el compartimento de trabajo Always Free.',
            cli_command: 'oci network vcn create --compartment-id ocid1.compartment.oc1..aaaa --cidr-block "10.0.0.0/16" --display-name "VCN-ONE-Laboratorio" --dns-label "vcnlab"',
            completado: false,
            verificacion: 'VCN en estado PROVISIONED con OCID asignado y tabla de rutas por defecto.'
          },
          {
            id: 't-2',
            paso: 2,
            titulo: 'Despliegue de Subred Pública y Subred Privada',
            descripcion: 'Segmenta la red en dos subredes /24 contiguas para separar la capa de presentación y la base de datos.',
            cli_command: 'oci network subnet create --vcn-id $VCN_ID --cidr-block "10.0.1.0/24" --display-name "Subred-Front-Publica" --dns-label "subfront"\noci network subnet create --vcn-id $VCN_ID --cidr-block "10.0.2.0/24" --display-name "Subred-DB-Privada" --prohibit-public-ip-on-vnic true',
            completado: false,
            verificacion: 'Subred privada creada con prohibit-public-ip activo para máxima seguridad.'
          },
          {
            id: 't-3',
            paso: 3,
            titulo: 'Configuración de Security List para HTTPS e Ingress',
            descripcion: 'Añade una regla de entrada con protocolo TCP puerto 443 para tráfico seguro desde internet.',
            cli_command: 'oci network security-list update --security-list-id $SECLIST_ID --ingress-security-rules \'[{"protocol":"6","source":"0.0.0.0/0","tcpOptions":{"destinationPortRange":{"max":443,"min":443}}}]\'',
            completado: false,
            verificacion: 'Regla de Ingress activa: puerto 443 abierto para tráfico HTTPS seguro.'
          }
        ],
        director_cut: [
          {
            id: 'sc-1',
            escena: 1,
            tiempo: '00:00 - 01:15',
            titulo: 'El Caos del Centro de Datos Físico vs La Nube OCI',
            guion_locutor: '"Hola comunidad técnica. Imaginen que montar una red de servidores requiriera tender kilómetros de cables de fibra, comprar switches de rack y esperar 3 meses de entrega. En Oracle Cloud, esa red completa cobra vida en 3 segundos con una VCN."',
            storyboard_visual: 'Animación de un rack tradicional de servidores con cables enredados que se transforman en una elegante topología vectorial de OCI con luces violetas y doradas.',
            consejo_pedagogico: 'Usa la metáfora de la inmediatez: pasar de semanas de logística de cables a un comando CLI instantáneo.'
          },
          {
            id: 'sc-2',
            escena: 2,
            tiempo: '01:15 - 02:45',
            titulo: 'La Analogía del Barrio Cerrado & Las Subredes',
            guion_locutor: '"Tu VCN es tu propio barrio cerrado. La subred pública es la garita de seguridad y el área comercial de entrada donde cualquier visitante puede consultar un catálogo web. Pero tus servidores de base de datos residen en la zona privada al fondo, protegidos por un NAT Gateway."',
            storyboard_visual: 'Plano arquitectónico isométrico estilo blueprint OCI: el Internet Gateway brilla en el perímetro, mientras los nodos internos quedan protegidos.',
            consejo_pedagogico: 'Refuerza la distinción visual entre IPs públicas (expuestas) e IPs privadas RFC1918 (aisladas).'
          },
          {
            id: 'sc-3',
            escena: 3,
            tiempo: '02:45 - 04:10',
            titulo: 'Flujo de Tráfico y Reglas Stateful de Seguridad',
            guion_locutor: '"Cuando un usuario envía un paquete HTTPS por el puerto 443, la Security List evalúa la regla de Ingress. Como es stateful, la respuesta de salida se autoriza automáticamente sin abrir puertos adicionales en Egress. Cero fricción, máxima protección."',
            storyboard_visual: 'Un pulso luminoso de datos viaja desde el cliente exterior, atraviesa el puerto 443 y regresa en verde esmeralda confirmando la respuesta bidireccional.',
            consejo_pedagogico: 'Enfatiza el concepto de "inspección de estado" (Stateful) para que no teman crear reglas complejas de retorno.'
          },
          {
            id: 'sc-4',
            escena: 4,
            tiempo: '04:10 - 05:00',
            titulo: 'Cierre Didáctico y Preparación para el Examen Capstone',
            guion_locutor: '"Has dominado los bloques fundamentales de networking en OCI. Ahora es momento de poner a prueba tus reflejos en el laboratorio y validar tus conocimientos en el Examen Final sin alucinaciones."',
            storyboard_visual: 'Transición hacia el emblema de certificación OCI con fuegos artificiales y el portal del Examen Final desbloqueándose.',
            consejo_pedagogico: 'Conectar el final de la lección con el llamado a la acción activo: resolver el quiz interactivo.'
          }
        ],
        quiz: [
          {
            id: 'q-1',
            pregunta: '¿Qué componente de OCI permite que una instancia en una subred privada se conecte a internet para actualizar software sin exponerse a conexiones entrantes?',
            opciones: [
              'A) Internet Gateway (IGW)',
              'B) NAT Gateway',
              'C) Dynamic Routing Gateway (DRG)'
            ],
            respuesta_correcta: 1,
            justificacion_rag: 'El NAT Gateway en OCI permite el acceso de salida a internet (egress) a instancias en subredes privadas bloqueando cualquier conexión iniciada desde el exterior (ingress).',
            cita_fuente: 'Documentación OCI Networking: "A NAT gateway gives cloud resources without public IP addresses access to the internet without exposing those resources to incoming internet connections."'
          },
          {
            id: 'q-2',
            pregunta: 'En las Security Lists de OCI, ¿qué significa que una regla de seguridad sea "Stateful" (con estado)?',
            opciones: [
              'A) Requiere que se cree manualmente una regla simétrica de salida para cada regla de entrada.',
              'B) Al autorizar el tráfico de entrada, la conexión de respuesta saliente se rastrea y permite automáticamente.',
              'C) La regla solo funciona si la máquina virtual está en estado STOPPED.'
            ],
            respuesta_correcta: 1,
            justificacion_rag: 'Las reglas stateful en OCI rastrean la conexión TCP/UDP; cuando entra tráfico permitido, el paquete de respuesta de retorno se permite automáticamente sin necesidad de regla explícita en egress.',
            cita_fuente: 'OCI Security Lists Architecture: "When a packet matches a stateful ingress rule, the response traffic is automatically tracked and allowed regardless of egress rules."'
          },
          {
            id: 'q-3',
            pregunta: '¿Cuál es la práctica recomendada de arquitectura para proteger una base de datos en una VCN de OCI?',
            opciones: [
              'A) Desplegarla en una Subred Privada con la propiedad "prohibit public IP" activada.',
              'B) Asignarle una IP pública con Security List abierta a 0.0.0.0/0.',
              'C) Colocarla fuera de la VCN conectada directamente por cable virtual a internet.'
            ],
            respuesta_correcta: 0,
            justificacion_rag: 'Las subredes privadas aíslan completamente los datos sensibles asegurando que las instancias no posean direcciones IP públicas enrutables.',
            cita_fuente: 'Oracle Cloud Well-Architected Framework: "Tier your architecture with private subnets for persistence layers and public subnets strictly reserved for load balancers."'
          }
        ]
      },
      evaluacion_calidad: {
        anclaje_fuente_score: 0.98,
        claridad_pedagogica: 'Alta',
        observaciones: 'Lenguaje ajustado con analogías para público principiante, sin tecnicismos excesivos y con citas técnicas verificadas.',
        mitigacion_alucinaciones: '100% de los términos OCI (VCN, CIDR, NAT Gateway, Security Lists) anclados en el contexto original.',
        chunks_procesados: 4,
        similitud_coseno_promedio: 0.942
      },
      almacenamiento_oci: {
        bucket: 'nuevamente-contenidos-educativos',
        objeto_id: 'contenido-vcn-principiante-flashcards-001.json',
        status_upload: 'completado',
        region: 'us-ashburn-1',
        etag: '9b2c8a14e9f5038ab1d07c21f8a84617',
        tamano_bytes: 4280,
        url_always_free: 'https://objectstorage.us-ashburn-1.oraclecloud.com/n/onegroup10/b/nuevamente-contenidos-educativos/o/contenido-vcn-principiante-flashcards-001.json'
      }
    }
  },
  {
    id: 'autonomous-db',
    titulo: 'OCI Autonomous Database Serverless & Data Safe en Fintech',
    nicho: 'Fintech',
    perfilRecomendado: 'Desarrollador Junior',
    contenido: `Oracle Autonomous Database Serverless (ATP/ADW) en OCI ofrece ajuste automático de rendimiento, auto-escalado de CPUs elástico y parcheo de seguridad sin tiempo de inactividad (Zero Downtime). Integrado con Oracle Data Safe, proporciona evaluación de seguridad continua, enmascaramiento de datos financieros confidenciales (PCI-DSS), auditoría de transacciones y detección de usuarios con privilegios excesivos. Su arquitectura Always Free provee hasta 2 instancias autónomas con 20 GB de almacenamiento cada una.`,
    data: {
      status: 'exito',
      metadatos: {
        perfil_aplicado: 'Desarrollador Junior',
        formato_generado: 'Paquete Educativo Completo (5 Estaciones)',
        tiempo_estimado_estudio_minutos: 7,
        conceptos_clave: ['Autonomous Database (ATP)', 'Data Safe', 'Auto-scaling', 'Cifrado TDE', 'PCI-DSS Compliance'],
        fecha_generacion: '2026-10-04T18:05:00Z',
        modelo_llm: 'Gemini 2.5 Flash + RAG Vector Grounding'
      },
      contenido_adaptado: {
        titulo: 'Bases de Datos Autónomas y Blindaje Data Safe para Fintech',
        introduccion_contextualizada: 'En aplicaciones financieras no hay margen para caídas ni filtraciones. Oracle Autonomous Database se autogestiona mientras Data Safe audita cada centavo.',
        resumen_ninja: {
          titulo: 'Puntos Clave del Motor Financiero Autónomo',
          analogia_central: 'Es como un auto deportivo con piloto automático: acelera en picos de transacciones bancarias (Black Friday), se parcha solo sin frenar y tiene una caja fuerte inexpugnable.',
          conceptos_clave: [
            { id: 'c1', texto: 'Auto-tuning: Crea índices y optimiza consultas SQL automáticamente según los hábitos del usuario.', verificado: false },
            { id: 'c2', texto: 'Zero-Downtime Patching: Actualiza kernels y parches de seguridad sin cortar transferencias bancarias.', verificado: false },
            { id: 'c3', texto: 'Oracle Data Safe: Enmascara números de tarjetas y audita accesos en cumplimiento con PCI-DSS.', verificado: false }
          ],
          metricas_rapidas: {
            riesgo: 'Mínimo (Cifrado TDE siempre activo)',
            despliegue: '< 3 min (Aprovisionamiento Always Free)',
            tipo_oci: 'Autonomous Transaction Processing',
            costo: '$0.00 (Capa Always Free OCI)'
          }
        },
        flashcards: [
          {
            id: 'fc-1',
            frente: '¿Qué hace la función de "Auto-scaling" en OCI Autonomous Database?',
            dorso: 'Permite a la base de datos escalar hasta el triple de CPUs asignadas de forma instantánea cuando la carga transaccional aumenta, cobrando solo por el uso real en segundos.',
            pista_didactica: 'Como un motor turbo que solo gasta combustible cuando pisas el acelerador en una ráfaga de pagos.',
            dominado: false
          },
          {
            id: 'fc-2',
            frente: '¿Por qué Data Safe es indispensable para normativas como PCI-DSS o GDPR?',
            dorso: 'Porque identifica automáticamente datos sensibles (números de tarjeta, CVV, DNI), los anonimiza para entornos de prueba y genera reportes de auditoría listos para reguladores.',
            pista_didactica: 'Es un auditor forense automatizado que vela por el secreto bancario 24/7.',
            dominado: false
          },
          {
            id: 'fc-3',
            frente: '¿Cómo funciona el cifrado en Autonomous Database?',
            dorso: 'Transparent Data Encryption (TDE) está habilitado por defecto y de manera obligatoria: tanto los datos en reposo como en tránsito están cifrados con claves administradas en OCI Vault.',
            pista_didactica: 'Ningún dato sale ni entra sin estar sellado con criptografía de grado militar.',
            dominado: false
          }
        ],
        tutorial: [
          {
            id: 't-1',
            paso: 1,
            titulo: 'Crear Instancia ATP en Capa Always Free',
            descripcion: 'Aprovisiona una base de datos OLTP autónoma indicando la opción Always Free habilitada.',
            cli_command: 'oci db autonomous-database create --compartment-id $COMPARTMENT_ID --db-name "FintechDB" --display-name "ATP-Fintech-Core" --cpu-core-count 1 --data-storage-size-in-tbs 0.02 --is-free-tier true --admin-password "P@ssw0rdFintech2026"',
            completado: false,
            verificacion: 'Estado AVAILABLE, conectividad mTLS generada mediante Wallet criptográfico.'
          },
          {
            id: 't-2',
            paso: 2,
            titulo: 'Descarga del Wallet y Configuración de Conexión Segura',
            descripcion: 'Obtén el paquete de credenciales cifradas para la aplicación NodeJS / Python.',
            cli_command: 'oci db autonomous-database generate-wallet --autonomous-database-id $DB_ID --file wallet.zip --password "WalletPass123!"',
            completado: false,
            verificacion: 'Archivo wallet.zip descargado con certificados cwallet.sso y tnsnames.ora.'
          },
          {
            id: 't-3',
            paso: 3,
            titulo: 'Registro y Evaluación de Seguridad en Oracle Data Safe',
            descripcion: 'Registra la base de datos en la consola Data Safe para lanzar el escaneo de cumplimiento financiero.',
            cli_command: 'oci data-safe target-database register --compartment-id $COMPARTMENT_ID --database-id$DB_ID',
            completado: false,
            verificacion: 'Data Safe Target Status: ACTIVE. Evaluación de Seguridad inicial: 0 vulnerabilidades críticas.'
          }
        ],
        director_cut: [
          {
            id: 'sc-1',
            escena: 1,
            tiempo: '00:00 - 01:15',
            titulo: 'El Dilema de las 3 AM del DBA en Fintech',
            guion_locutor: '"A las 3 de la madrugada, un fallo de disco o un parche de seguridad de emergencia solía significar llamadas de pánico para los DBAs bancarios. Autonomous Database en OCI erradica las guardias de noche gracias al aprendizaje automático integrado."',
            storyboard_visual: 'Contraste entre un operador estresado frente a pantallas rojas de error y un dashboard sereno de OCI gestionando el clúster con tranquilidad.',
            consejo_pedagogico: 'Humaniza el beneficio de la autonomía de OCI: tranquilidad operativa y foco en desarrollo de producto.'
          },
          {
            id: 'sc-2',
            escena: 2,
            tiempo: '01:15 - 02:45',
            titulo: 'Auto-Tuning: La IA que crea índices en caliente',
            guion_locutor: '"Si un desarrollador comete una consulta SQL sin índice durante una campaña de préstamos, el motor de OCI la detecta, prueba el índice en una copia invisible, y si mejora la velocidad, lo promueve a producción sin detener el tráfico."',
            storyboard_visual: 'Visualización de un árbol B-Tree generándose dinámicamente en memoria con un velocímetro que pasa de 1200ms a 2ms.',
            consejo_pedagogico: 'Explicar que la optimización es empírica y validada por la propia base de datos.'
          },
          {
            id: 'sc-3',
            escena: 3,
            tiempo: '02:45 - 04:10',
            titulo: 'Data Safe: El escudo regulatorio PCI-DSS',
            guion_locutor: '"Para operar en Fintech necesitas certificar ante auditores. Data Safe escanea el esquema, descubre columnas con PAN (números de tarjeta) y las enmascara automáticamente en las réplicas de testing para que ningún desarrollador toque datos reales."',
            storyboard_visual: 'Un número de tarjeta de crédito real que se transforma en ****-****-****-8842 al pasar al entorno de desarrollo.',
            consejo_pedagogico: 'Resaltar la diferencia entre enmascaramiento estático y dinámico para ambientes de prueba.'
          },
          {
            id: 'sc-4',
            escena: 4,
            tiempo: '04:10 - 05:00',
            titulo: 'Conclusión y Desafío de Evaluación',
            guion_locutor: '"Tienes el poder de una infraestructura bancaria enterprise en la capa Always Free. Es tu turno de demostrar que estás listo para liderar proyectos Fintech en Oracle Cloud."',
            storyboard_visual: 'Insignia dorada de OCI Fintech Master brillando con resplandor cyan y desbloqueo del examen.',
            consejo_pedagogico: 'Motivar al estudiante con el valor de mercado de estas competencias.'
          }
        ],
        quiz: [
          {
            id: 'q-1',
            pregunta: '¿Cuál es el beneficio de la característica "Zero Downtime Patching" en OCI Autonomous Database?',
            opciones: [
              'A) Las aplicaciones deben desconectarse durante ventanas de mantenimiento programadas los domingos.',
              'B) Aplica parches de seguridad y actualizaciones de software sin interrumpir las sesiones y transacciones activas de los usuarios.',
              'C) Solo permite parches si se borra la base de datos y se restaura el backup.'
            ],
            respuesta_correcta: 1,
            justificacion_rag: 'Oracle Autonomous Database aplica parches de firmware, sistema operativo y base de datos de manera transparente y continua utilizando clustering Exadata subyacente.',
            cita_fuente: 'Oracle Autonomous Database Technical Overview: "Automated patching is applied with zero downtime to running mission-critical workloads."'
          },
          {
            id: 'q-2',
            pregunta: '¿Qué herramienta de OCI permite descubrir y enmascarar datos financieros sensibles (PII / PCI) para cumplir con normativas de protección de datos?',
            opciones: [
              'A) Oracle Data Safe',
              'B) OCI Cloud Shell',
              'C) OCI File Storage Service (FSS)'
            ],
            respuesta_correcta: 0,
            justificacion_rag: 'Oracle Data Safe es el centro de control de seguridad para bases de datos de Oracle que incluye evaluación de riesgos, enmascaramiento de datos y auditoría de actividades.',
            cita_fuente: 'OCI Data Safe Documentation: "Data Safe helps you understand data sensitivity, evaluate security risks, mask sensitive data, and assess user security posture."'
          },
          {
            id: 'q-3',
            pregunta: '¿Qué tipo de cifrado viene habilitado por defecto y sin costo adicional en Autonomous Database?',
            opciones: [
              'A) Cifrado manual mediante scripts PL/SQL de terceros.',
              'B) No tiene cifrado a menos que se contrate una licencia de pago Enterprise extrema.',
              'C) Transparent Data Encryption (TDE) tanto para datos en reposo como en tránsito.'
            ],
            respuesta_correcta: 2,
            justificacion_rag: 'TDE viene activado de forma obligatoria en todas las bases de datos autónomas, garantizando que los archivos de datos (datafiles) y backups estén cifrados por defecto.',
            cita_fuente: 'Oracle Database Security Guide: "TDE is enabled out of the box in all Autonomous Database instances to guarantee end-to-end protection."'
          }
        ]
      },
      evaluacion_calidad: {
        anclaje_fuente_score: 0.99,
        claridad_pedagogica: 'Sobresaliente',
        observaciones: 'Ejemplos financieros concretos (PCI-DSS, tarjetas de crédito, Black Friday) que anclan conceptos densos con claridad.',
        mitigacion_alucinaciones: 'Verificación contra la especificación oficial de Autonomous Database Always Free de OCI.',
        chunks_procesados: 5,
        similitud_coseno_promedio: 0.961
      },
      almacenamiento_oci: {
        bucket: 'nuevamente-contenidos-educativos',
        objeto_id: 'contenido-atp-fintech-developer-002.json',
        status_upload: 'completado',
        region: 'us-ashburn-1',
        etag: '8c41d198a44b910fa22e4318c645bc22',
        tamano_bytes: 4720,
        url_always_free: 'https://objectstorage.us-ashburn-1.oraclecloud.com/n/onegroup10/b/nuevamente-contenidos-educativos/o/contenido-atp-fintech-developer-002.json'
      }
    }
  },
  {
    id: 'iam-compartments',
    titulo: 'OCI Compartments, IAM Policies & Control de Acceso Empresarial',
    nicho: 'General',
    perfilRecomendado: 'Líder Técnico / Arquitecto',
    contenido: `El servicio de Identity and Access Management (IAM) en Oracle Cloud Infrastructure estructura la tenencia mediante Compartimientos (Compartments) jerárquicos para aislamiento de recursos, control de presupuestos y gobierno multi-inquilino. Las políticas declarativas de IAM siguen la sintaxis "Allow <group> to <verb> <resource-type> in compartment <compartment-name>", estructuradas bajo los 4 verbos jerárquicos (inspect, read, use, manage). Admite autenticación federada, MFA y credenciales de token temporales.`,
    data: {
      status: 'exito',
      metadatos: {
        perfil_aplicado: 'Líder Técnico / Arquitecto',
        formato_generado: 'Paquete Educativo Completo (5 Estaciones)',
        tiempo_estimado_estudio_minutos: 6,
        conceptos_clave: ['Compartments Jerárquicos', 'IAM Policies', 'Verbos IAM (inspect/read/use/manage)', 'MFA', 'Principio de Menor Privilegio'],
        fecha_generacion: '2026-10-04T18:10:00Z',
        modelo_llm: 'Gemini 2.5 Flash + RAG Vector Grounding'
      },
      contenido_adaptado: {
        titulo: 'Arquitectura de Gobierno y Control de Acceso IAM en OCI',
        introduccion_contextualizada: 'Organizar la nube sin una estructura sólida de compartimentos es como un edificio sin llaves ni oficinas separadas. IAM es la matriz de seguridad de OCI.',
        resumen_ninja: {
          titulo: 'Matriz de Autorización y Principios IAM',
          analogia_central: 'Los compartimentos son carpetas lógicas donde guardas tus servidores y bases de datos; las políticas son las llaves maestras que dictan quién puede mirar, usar o destruir lo que hay adentro.',
          conceptos_clave: [
            { id: 'c1', texto: 'Aislamiento lógico estricto: Los compartimentos no añaden latencia ni costos, solo orden y fronteras de permisos.', verificado: false },
            { id: 'c2', texto: 'Los 4 Verbos Jerárquicos: inspect (menor) -> read -> use -> manage (control total).', verificado: false },
            { id: 'c3', texto: 'Principio de Menor Privilegio: Ningún usuario tiene acceso por defecto hasta que una política explícita lo concede.', verificado: false }
          ],
          metricas_rapidas: {
            riesgo: 'Crítico si está mal diseñado (Gobernanza)',
            despliegue: '< 2 min por política',
            tipo_oci: 'Identity & Access Management (IAM)',
            costo: '$0.00 (Servicio Nativo Gratuito)'
          }
        },
        flashcards: [
          {
            id: 'fc-1',
            frente: '¿Qué es un Compartment en OCI y cuál es su costo?',
            dorso: 'Es una colección lógica de recursos relacionados a los que solo pueden acceder los grupos autorizados por políticas. Su uso es 100% gratuito y no añade sobrecarga de red.',
            pista_didactica: 'Son como los departamentos de una empresa (Marketing, Finanzas, Dev), organizados en carpetas seguras.',
            dominado: false
          },
          {
            id: 'fc-2',
            frente: '¿Cuál es la diferencia entre el verbo "use" y el verbo "manage" en las políticas IAM de OCI?',
            dorso: '"use" permite interactuar con los recursos existentes (ej. encender una VM o consultar un bucket) pero NO crearlos ni eliminarlos. "manage" concede permisos completos, incluyendo crear, reconfigurar y destruir.',
            pista_didactica: 'use = conducir el auto alquilado; manage = ser el dueño de la concesionaria.',
            dominado: false
          },
          {
            id: 'fc-3',
            frente: '¿Puede un recurso de un Compartimento comunicarse con un recurso de otro Compartimento?',
            dorso: '¡Sí! Los compartimentos son límites de autorización administrativa, NO límites de red física. Dos VMs en distintos compartimentos pueden comunicarse si la red VCN lo permite.',
            pista_didactica: 'Las carpetas de Google Drive organizan permisos, pero las computadoras se siguen enviando mensajes por internet.',
            dominado: false
          }
        ],
        tutorial: [
          {
            id: 't-1',
            paso: 1,
            titulo: 'Creación de Compartimento Dedicado de Proyectos',
            descripcion: 'Crea una carpeta de compartimento bajo el compartimento raíz (tenancy) para los laboratorios ONE.',
            cli_command: 'oci iam compartment create --name "ONE-Laboratorio-Educativo" --description "Espacio de trabajo aislado para estudiantes ONE" --compartment-id $ROOT_TENANCY_OCID',
            completado: false,
            verificacion: 'Compartimento creado con lifecycle-state ACTIVE y OCID único registrado.'
          },
          {
            id: 't-2',
            paso: 2,
            titulo: 'Crear Grupo de Usuarios Desarrolladores',
            descripcion: 'Define el grupo de seguridad que agrupará a los miembros del equipo técnico.',
            cli_command: 'oci iam group create --name "Dev-Estudiantes-ONE" --description "Desarrolladores con permisos de despliegue controlado"',
            completado: false,
            verificacion: 'Grupo registrado en el Identity Domain de OCI listo para asignación de miembros.'
          },
          {
            id: 't-3',
            paso: 3,
            titulo: 'Escribir Política de Menor Privilegio Declarativa',
            descripcion: 'Aplica una política que permite al grupo usar instancias y gestionar buckets únicamente en su compartimento.',
            cli_command: 'oci iam policy create --compartment-id $ROOT_TENANCY_OCID --name "Policy-Devs-ONE" --statements \'["Allow group Dev-Estudiantes-ONE to manage object-family in compartment ONE-Laboratorio-Educativo", "Allow group Dev-Estudiantes-ONE to use instance-family in compartment ONE-Laboratorio-Educativo"]\'',
            completado: false,
            verificacion: 'Política activa y validada por el evaluador de políticas IAM de OCI.'
          }
        ],
        director_cut: [
          {
            id: 'sc-1',
            escena: 1,
            tiempo: '00:00 - 01:15',
            titulo: 'La Tenancy Raíz y el Peligro del Usuario Admin',
            guion_locutor: '"El error más costoso que cometen las empresas novatas en la nube es poner todas sus bases de datos en el compartimento raíz y compartir la contraseña de administrador. En OCI, la regla dorada es: nadie toca el Root."',
            storyboard_visual: 'Una pirámide de seguridad donde el vértice superior (Root) está sellado y protegido con doble factor MFA mientras la base se ramifica ordenadamente.',
            consejo_pedagogico: 'Destacar la responsabilidad arquitectónica del principio de menor privilegio.'
          },
          {
            id: 'sc-2',
            escena: 2,
            tiempo: '01:15 - 02:45',
            titulo: 'Anatomía de una Sentencia de Política en OCI',
            guion_locutor: '"Las políticas de OCI se leen casi como inglés natural: Allow <quién> to <qué nivel de acción> <qué familia de recursos> in compartment <dónde>. Cuatro partes sencillas que blindan tu infraestructura."',
            storyboard_visual: 'La sintaxis se desglosa palabra por palabra con cajas iluminadas en cian, violeta y ámbar explicando cada componente.',
            consejo_pedagogico: 'Facilitar la memorización de la estructura estándar de IAM.'
          },
          {
            id: 'sc-3',
            escena: 3,
            tiempo: '02:45 - 04:10',
            titulo: 'La Escalera de Verbos: Inspect, Read, Use y Manage',
            guion_locutor: '"Si necesitas que un becario vea el inventario sin tocar nada, dale inspect. Si necesita descargar un archivo, dale read. Si va a encender un servidor, use. Reserva manage únicamente para quien tiene la autorización de borrar."',
            storyboard_visual: 'Una escalera visual ascendente donde cada escalón suma capacidades progresivas sobre los recursos.',
            consejo_pedagogico: 'Ayudar al estudiante a seleccionar siempre el escalón más bajo necesario.'
          },
          {
            id: 'sc-4',
            escena: 4,
            tiempo: '04:10 - 05:00',
            titulo: 'Certificación de Gobierno en la Nube',
            guion_locutor: '"Felicidades por dominar la gobernanza en OCI. Has adquirido el criterio de un arquitecto de soluciones de clase mundial."',
            storyboard_visual: 'Aparece la insignia OCI Security Architect con resplandor dorado y la invitación al examen final.',
            consejo_pedagogico: 'Celebrar el avance cognitivo hacia niveles de arquitectura enterprise.'
          }
        ],
        quiz: [
          {
            id: 'q-1',
            pregunta: '¿Cuál de los cuatro verbos de IAM en OCI confiere el nivel más bajo de acceso, permitiendo únicamente listar recursos sin ver su contenido ni metadatos sensibles?',
            opciones: [
              'A) use',
              'B) inspect',
              'C) read'
            ],
            respuesta_correcta: 1,
            justificacion_rag: 'El verbo "inspect" ofrece la capacidad mínima de listar recursos sin acceso a metadatos confidenciales ni contenido del recurso.',
            cita_fuente: 'OCI IAM Verbs Reference: "inspect gives the ability to list resources of a given type, without viewing the resources\' user-specified metadata or payload."'
          },
          {
            id: 'q-2',
            pregunta: '¿Qué afirmación sobre los Compartimentos en OCI es CORRECTA?',
            opciones: [
              'A) Tienen un costo mensual fijo por cada compartimento creado en la cuenta.',
              'B) Son colecciones lógicas globales para organizar y aislar recursos; son gratuitos y pueden anidarse hasta 6 niveles de profundidad.',
              'C) Limitan el ancho de banda de red entre servidores que pertenezcan a compartimentos diferentes.'
            ],
            respuesta_correcta: 1,
            justificacion_rag: 'Los compartimentos son un mecanismo puramente lógico de gobernanza y control de acceso en OCI, sin coste monetario alguno y con capacidad de anidamiento.',
            cita_fuente: 'OCI Architecture Guide: "Compartments are a fundamental component of OCI for organizing and isolating your cloud resources at zero added cost."'
          },
          {
            id: 'q-3',
            pregunta: '¿Cómo evalúa OCI el acceso si un usuario pertenece a un grupo sin políticas explícitas asignadas?',
            opciones: [
              'A) Se le deniega el acceso a todos los recursos por defecto (Deny by default).',
              'B) Se le concede acceso de solo lectura en el compartimento raíz.',
              'C) Se le asigna automáticamente el rol de Administrador de Emergencia.'
            ],
            respuesta_correcta: 0,
            justificacion_rag: 'El modelo de seguridad de OCI es de confianza cero (Zero Trust) y denegación por defecto: si no existe una política que explícitamente diga "Allow", la solicitud es rechazada.',
            cita_fuente: 'OCI Identity and Access Management Principles: "Access is denied by default. An explicit Allow policy statement is required for any user or group to perform any action."'
          }
        ]
      },
      evaluacion_calidad: {
        anclaje_fuente_score: 0.98,
        claridad_pedagogica: 'Alta',
        observaciones: 'Estructuración limpia de las políticas de menor privilegio con los cuatro verbos jerárquicos explicados didácticamente.',
        mitigacion_alucinaciones: 'Sintaxis y verbos verificados contra la gramática oficial de políticas de OCI IAM.',
        chunks_procesados: 4,
        similitud_coseno_promedio: 0.954
      },
      almacenamiento_oci: {
        bucket: 'nuevamente-contenidos-educativos',
        objeto_id: 'contenido-iam-arquitectura-politicas-003.json',
        status_upload: 'completado',
        region: 'us-ashburn-1',
        etag: '7a13f044c68d29bce01441a99d45e991',
        tamano_bytes: 4560,
        url_always_free: 'https://objectstorage.us-ashburn-1.oraclecloud.com/n/onegroup10/b/nuevamente-contenidos-educativos/o/contenido-iam-arquitectura-politicas-003.json'
      }
    }
  }
];

export const INITIAL_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'ninja',
    titulo: 'Síntesis Ninja',
    descripcion: 'Asimila los conceptos esenciales y activa la intuición didáctica del tema.',
    icono: '⚡',
    desbloqueado: false,
    categoria: 'ninja',
  },
  {
    id: 'streak',
    titulo: 'Memoria de Acero',
    descripcion: 'Supera la ronda de Active Recall dominando los conceptos clave.',
    icono: '🧠',
    desbloqueado: false,
    categoria: 'streak',
  },
  {
    id: 'builder',
    titulo: 'Ingeniero de Laboratorio',
    descripcion: 'Ejecuta y valida los checkpoints técnicos del entorno interactivo.',
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
    titulo: 'Zero-Hallucination Master',
    descripcion: 'Supera el Examen Final Capstone conservando escudos cognitivos y anclaje RAG.',
    icono: '👑',
    desbloqueado: false,
    categoria: 'master',
  },
];