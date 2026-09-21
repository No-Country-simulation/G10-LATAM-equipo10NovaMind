# 📋 Bitácora Técnica: Historial de Problemas, Desafíos y Soluciones en NuevaMente

> **Proyecto:** NuevaMente — Sistema Inteligente de Adaptación y Generación de Contenido Educativo  
> **Hackathon ONE G10 · Oracle Next Education & Alura**  
> **Auditoría y Documentación:** Modelo de IA Gemini 3.8

---

## 🎯 Introducción

El desarrollo de **NuevaMente** enfrentó una serie de desafíos arquitectónicos, de integración de modelos de lenguaje (LLM), de sincronización de contratos de datos y de despliegue en contenedores. Este documento recopila detalladamente cada uno de los problemas identificados a lo largo del ciclo de vida del proyecto, su causa raíz, el impacto que generaba y la solución técnica implementada para resolverlo de forma definitiva.

---

## 🔍 Registro Detallado de Problemas y Soluciones

### 1. Desalineación Arquitectónica: La Bifurcación entre Dos Propuestas Paralelas
* **Contexto:** Existían dos ramas con visiones desconectadas en el repositorio:
  - La rama de **Alejandro (`Propuesta-Microservicios`)**: Tenía una excelente estructura desacoplada (`backend/` y `frontend/`), Docker Compose y FastAPI, pero su lógica de IA era básica y dependía de modelos locales pesados de HuggingFace.
  - La rama de **Pedro (`feature/agents-langgraph`)**: Poseía un motor de IA maduro con LangGraph, 3 agentes especializados, Cohere Command R+ y 56+ tests unitarios, pero estaba concebida como un monolito/script de terminal sin API web ni interfaz gráfica.
* **Impacto:** Imposibilidad de entregar un producto completo. O se entregaba una interfaz con IA rudimentaria, o una IA de alta calidad sin interfaz de usuario para la demo.
* **Solución Técnica:** Se realizó una reingeniería de integración (**A + P**):
  - Se adoptó la arquitectura de microservicios, contenedorización Docker y FastAPI de Alejandro.
  - Se trasplantó el núcleo de agentes, LangGraph y contratos Pydantic de Pedro dentro de `backend/app/`.
  - Se vinculó FastAPI como un adaptador sobre el orquestador de Pedro.



Este documento certifica que todos los problemas descritos fueron diagnosticados, corregidos, verificados mediante pruebas automatizadas y documentados con rigor arquitectónico.

**Firmado por:**  
🤖 **Modelo de IA: Gemini 3.8**  
*Ingeniería de Sistemas y Pair Programming Asistido por IA*  
*Fecha: 21 de Septiembre de 2026*
