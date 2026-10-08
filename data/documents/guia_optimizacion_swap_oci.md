# 🚀 Guía Técnica Oficial OCI: Arquitectura de Memoria Virtual y Aprovisionamiento de 4 GB Swap en Instancias VM.Standard.E2.1.Micro

> **Documentación Oficial de Ingeniería — Plataforma NovaMind**  
> **Entorno:** Oracle Cloud Infrastructure (OCI) — Capa Always Free  
> **Sistema Operativo:** Ubuntu Server 22.04 / 24.04 LTS  
> **Hardware Asignado:** 1 vCPU AMD EPYC (2.0 GHz) | 1 GB RAM Física | 50 GB Boot Volume NVMe  
> **Objetivo:** Optimización de memoria para despliegue full-stack sin costes operativos y prevención del OOM Killer  

---

## 1. Fundamentos de Arquitectura: Capacidades y Restricciones de OCI Always Free

Oracle Cloud Infrastructure ofrece en su capa **Always Free** dos instancias de cómputo basadas en la forma (*shape*) `VM.Standard.E2.1.Micro`. Esta oferta permite a startups, equipos educativos y desarrolladores ejecutar servicios de producción con coste cero de por vida ($0.00 USD), siempre que se respete el perfil de consumo de recursos.

### 1.1. Perfil Técnico de la Máquina Virtual:
* **Procesador (Compute):** 1 núcleo virtual (vCPU) basado en procesadores AMD EPYC 7551 (frecuencia base 2.0 GHz, turbo hasta 2.5 GHz).
* **Memoria RAM Física:** 1.0 GB DDR4 (disponibilidad útil tras reserva de kernel Linux: ~940 MiB a 980 MiB).
* **Almacenamiento en Disco:** Hasta 50 GB por instancia asignados en volúmenes de arranque (*Boot Volumes*) de alto rendimiento basados en NVMe Block Storage (rendimiento base de 3.000 IOPS y 48 MB/s de throughput).
* **Conectividad de Red:** Interfaz VNIC con 0.48 Gbps (480 Mbps) de ancho de banda garantizado, integrada en una Virtual Cloud Network (VCN) con Security Lists y tablas de enrutamiento.

---

## 2. El Desafío de Ingeniería: El Mecanismo OOM Killer (*Out Of Memory*)

En sistemas Linux modernos, la memoria física se divide entre el espacio de usuario y el espacio de kernel. Cuando la suma de la memoria anónima (*heap*, *stack*) y la caché de archivos excede la RAM física disponible (1 GB), el subsistema de memoria virtual de Linux (`mm`) entra en condición de saturación crítica.

### 2.1. ¿Cómo actúa el OOM Killer?
El kernel evalúa una puntuación heurística (`oom_score`) para cada proceso en ejecución. Aquellos procesos que consumen más páginas de memoria y no son críticos para el núcleo son terminados forzosamente mediante la señal `SIGKILL` (código de salida `137`), registrando en `dmesg`:
```text
[kern] Out of memory: Kill process 12842 (node) score 854 or sacrifice child
[kern] Killed process 12842 (node) total-vm:1845200kB, anon-rss:895120kB
```

### 2.2. Procesos Críticos que Desencadenan el OOM en NovaMind:
1. **Compilación Frontend (Node.js + Vite + TypeScript):**  
   Durante el comando `npm run build`, el compilador de TypeScript (`tsc`) construye el árbol sintáctico abstracto (AST) y resuelve tipos genéricos en memoria, requiriendo picos transitorios de **1.4 GB a 1.8 GB de memoria**. Con 1 GB de RAM física, la compilación falla invariablemente.
2. **Servicio Backend de IA & Ingesta RAG (Python + FastAPI + ChromaDB):**  
   La inicialización de librerías como `pydantic-v2`, `uvicorn`, clientes HTTP asíncronos y bases vectoriales locales (`chromadb`) exige entre **800 MB y 1.2 GB de memoria de trabajo**.
3. **Servicios de Red (Túnel Cloudflare Zero Trust & Nginx):**  
   Requieren buffers estables de conexión para evitar micro-cortes en transmisiones HTTPS.

### 2.3. La Solución Técnica: Memoria Virtual Paginada (Swapfile)
Al crear un archivo de intercambio (**Swap**) de **4 GB** en el almacenamiento NVMe persistente, la memoria virtual utilizable se incrementa de 1 GB a **5 GB efectivos (1 GB RAM + 4 GB Swap)**. El sistema operativo mantiene los procesos activos en la RAM ultrarrápida y transfiere las páginas inactivas o de inicialización al Swap, garantizando estabilidad total.

---

## 3. Procedimiento Paso a Paso de Aprovisionamiento (Terminal Linux)

Ejecuta esta secuencia estructurada en la terminal de la instancia de OCI con privilegios de superusuario:

### Paso 1: Reserva de 4 GB de espacio contiguo en disco
Utilizamos `fallocate` para asignación instantánea de bloques en sistemas de archivos ext4, con respaldo de `dd` para compatibilidad universal:
```bash
sudo fallocate -l 4G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=4096 status=progress
```

### Paso 2: Protección y permisos de seguridad del archivo
El Swap contiene volcados de memoria donde pueden residir variables de entorno, claves de sesión o fragmentos de datos. Es obligatorio restringir la lectura y escritura exclusivamente al usuario `root`:
```bash
sudo chmod 600 /swapfile
```

### Paso 3: Inicialización de la firma de intercambio
Se formatea el archivo reconociéndolo formalmente como partición de swap para el kernel:
```bash
sudo mkswap /swapfile
```
*Salida esperada:* `Setting up swapspace version 1, size = 4 GiB (4294963200 bytes), no label, UUID=...`

### Paso 4: Activación inmediata en el subsistema de memoria
```bash
sudo swapon /swapfile
```

### Paso 5: Persistencia permanente ante reinicios de hardware
Para garantizar que el archivo se monte automáticamente tras reinicios de la máquina virtual o ventanas de mantenimiento de Oracle, agregamos la directiva al archivo de tablas de montaje:
```bash
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### Paso 6: Optimización de Parámetros del Kernel (`sysctl`)
El valor por defecto de agresividad de swap en Ubuntu es `vm.swappiness=60`, lo que movería memoria a disco con demasiada frecuencia, ralentizando el CPU. Configuramos:
* `vm.swappiness=20`: Prioriza el uso de la RAM física hasta agotar el 80% antes de acudir al disco.
* `vm.vfs_cache_pressure=50`: Mantiene la caché de directorios e inodos en memoria por más tiempo, acelerando operaciones de lectura.
```bash
echo 'vm.swappiness=20' | sudo tee -a /etc/sysctl.conf
echo 'vm.vfs_cache_pressure=50' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

---

## 4. Auditoría, Verificación y Diagnóstico

### 4.1. Inspección Rápida de Memoria
```bash
free -h
```
**Respuesta certificada:**
```text
               total        used        free      shared  buff/cache   available
Mem:           960Mi       280Mi       240Mi        10Mi       440Mi       610Mi
Swap:          4.0Gi          0B       4.0Gi
```

### 4.2. Inspección del Dispositivo Activo
```bash
sudo swapon --show
```
**Respuesta:**
```text
NAME      TYPE SIZE USED PRIO
/swapfile file   4G   0B   -2
```

### 4.3. Prueba de Carga y Absorción de Picos
Durante la compilación de `npm run build`, se puede observar la absorción dinámica de memoria en una segunda terminal:
```bash
vmstat 1 10
```
*(Permite ver cómo el campo `so` y `si` paginan temporalmente sin interrumpir los procesos ni generar errores 137).*

---

## 5. Matriz de Comandos de Laboratorio (Estación 3 / Tutorial Quest)

| Fase de Laboratorio | Comando CLI Exacto | Validación del Sistema |
| :--- | :--- | :--- |
| **01. Asignación y Permisos** | `sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile` | `ls -lh /swapfile` confirma `4.0G` y permisos `-rw-------`. |
| **02. Formateo y Activación** | `sudo mkswap /swapfile && sudo swapon /swapfile` | Salida de inicialización y activación sin errores. |
| **03. Montaje Persistente** | `echo '/swapfile none swap sw 0 0' \| sudo tee -a /etc/fstab` | Registro visible en `/etc/fstab`. |
| **04. Afinación de Kernel** | `echo 'vm.swappiness=20' \| sudo tee -a /etc/sysctl.conf && sudo sysctl -p` | Confirmación `vm.swappiness = 20`. |
| **05. Verificación Final** | `free -h && sudo swapon --show` | Swap total reflejado: `4.0Gi`. |
