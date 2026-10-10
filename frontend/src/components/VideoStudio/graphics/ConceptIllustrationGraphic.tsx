import { useState, useEffect } from 'react';
import type { AudiovisualScene } from '../../../types/videoStudio';
import {
  Sparkles,
  Eye,
  Ear,
  Scan,
  Activity,
  Layers,
  Shield,
  Lightbulb,
  FileText,
  Target,
  Compass,
  Cpu,
  Brain,
  Search,
  CheckCircle2,
  Heart,
  Zap,
  Globe,
} from 'lucide-react';
import styles from './graphics.module.css';

interface Props {
  scene: AudiovisualScene;
}

export type VisualArtworkType =
  | 'animal_canine_features'
  | 'vision_gaze_facial'
  | 'botany_nature_plants'
  | 'culinary_gastronomy_food'
  | 'automotive_mechanics_engineering'
  | 'math_geometry_calculus'
  | 'art_design_painting'
  | 'cybersecurity_ransomware'
  | 'digital_city_network'
  | 'threats_vulnerability_radar'
  | 'gated_community_subnets'
  | 'merlin_wizard_wisdom'
  | 'blacksmith_helmet_dilemma'
  | 'truth_path_castles'
  | 'knight_armor'
  | 'knight_liberation'
  | 'castle_silence'
  | 'server_rack_cables'
  | 'traffic_waf'
  | 'database_btree_autotuning'
  | 'data_masking_safe'
  | 'cloud_architecture_topology'
  | 'science_biology'
  | 'science_physics_space'
  | 'book_literature'
  | 'mind_insight'
  | 'ai_robotics'
  | 'coding_software'
  | 'finance_economy'
  | 'medicine_health'
  | 'education_learning'
  | 'law_justice'
  | 'nature_ecology'
  | 'music_arts'
  | 'journey_mountain'
  | 'badge_certification_trophy'
  | 'steps_flow_pipeline'
  | 'universal_dynamic_infographic';

/**
 * Resuelve un icono dinámico contextual agnóstico para cualquier tema no catalogado
 */
export function getAgnosticConceptIcon(scene: AudiovisualScene) {
  const text = `${scene.titulo} ${scene.narracion} ${scene.descripcionComposicion} ${scene.conceptoPedagogico}`.toLowerCase();
  if (text.includes('ojo') || text.includes('mirada') || text.includes('visión') || text.includes('ver') || text.includes('observa')) {
    return Eye;
  }
  if (text.includes('oreja') || text.includes('escucha') || text.includes('oído') || text.includes('sonido') || text.includes('audio')) {
    return Ear;
  }
  if (text.includes('mente') || text.includes('cerebro') || text.includes('pensar') || text.includes('idea') || text.includes('cognit')) {
    return Brain;
  }
  if (text.includes('análisis') || text.includes('examinar') || text.includes('rasgo') || text.includes('escan') || text.includes('evalua')) {
    return Scan;
  }
  if (text.includes('seguridad') || text.includes('proteger') || text.includes('escudo') || text.includes('defensa') || text.includes('bloqueo')) {
    return Shield;
  }
  if (text.includes('métrica') || text.includes('rendimiento') || text.includes('pulso') || text.includes('ritmo') || text.includes('velocidad')) {
    return Activity;
  }
  if (text.includes('meta') || text.includes('objetivo') || text.includes('foco') || text.includes('destino') || text.includes('blanco')) {
    return Target;
  }
  if (text.includes('estructura') || text.includes('capa') || text.includes('nivel') || text.includes('módulo') || text.includes('arquitectura')) {
    return Layers;
  }
  if (text.includes('tecnología') || text.includes('sistema') || text.includes('chip') || text.includes('algoritmo') || text.includes('datos')) {
    return Cpu;
  }
  if (text.includes('guía') || text.includes('estrategia') || text.includes('camino') || text.includes('orientación') || text.includes('navega')) {
    return Compass;
  }
  if (text.includes('concepto') || text.includes('innovación') || text.includes('insight') || text.includes('solución') || text.includes('descubr')) {
    return Lightbulb;
  }
  if (text.includes('emoción') || text.includes('salud') || text.includes('vida') || text.includes('cariño') || text.includes('vínculo')) {
    return Heart;
  }
  if (text.includes('fuerza') || text.includes('energía') || text.includes('potencia') || text.includes('dinámica')) {
    return Zap;
  }
  if (text.includes('mundo') || text.includes('global') || text.includes('red') || text.includes('planeta') || text.includes('universo')) {
    return Globe;
  }
  return Sparkles;
}

/**
 * Extrae y limpia el nombre o término principal del concepto para la animación vectorial,
 * eliminando prefijos de relleno tipo "El concepto de", "Introducción a", "Analogía de", etc.
 */
export function extractCleanConceptLabel(scene: AudiovisualScene): string {
  let raw = (scene.textoEnPantalla?.conceptoNombre || scene.titulo || '').trim();

  // 1. Quitar prefijos comunes de títulos didácticos o metodológicos
  const prefixes = [
    /^(el\s+)?concepto\s+de(l)?\s+/i,
    /^(la\s+)?analogía\s+de(l)?\s+/i,
    /^(la\s+)?metáfora\s+de(l)?\s+/i,
    /^introducción\s*[:\-–]\s*/i,
    /^introducción\s+a(l)?\s+/i,
    /^¿qué\s+es\s+(el\s+|la\s+|un\s+|una\s+)?/i,
    /^definición\s+de(l)?\s+/i,
    /^fundamentos\s+de(l)?\s+/i,
    /^panorama\s+de(l)?\s+/i,
    /^resumen\s+de(l)?\s+/i,
    /^entendiendo\s+(el\s+|la\s+|los\s+|las\s+)?/i,
    /^comprendiendo\s+(el\s+|la\s+|los\s+|las\s+)?/i,
    /^explicación\s+de(l)?\s+/i,
    /^análisis\s+de(l)?\s+/i,
    /^módulo\s+\d+[:\-–\s]*/i,
    /^escena\s+\d+[:\-–\s]*/i,
    /^fase\s+\d+[:\-–\s]*/i,
    /^paso\s+\d+[:\-–\s]*/i,
    /^capítulo\s+\d+[:\-–\s]*/i,
    /^lección\s+\d+[:\-–\s]*/i,
    /^tema\s+\d+[:\-–\s]*/i,
  ];

  for (const prefix of prefixes) {
    raw = raw.replace(prefix, '').trim();
  }

  // 2. Si tiene separador ':' o ' - ' o ' – '
  if (raw.includes(':') || raw.includes(' - ') || raw.includes(' – ')) {
    const parts = raw.split(/[:\-–]/).map((p) => p.trim()).filter(Boolean);
    if (parts.length > 1) {
      raw = parts[parts.length - 1];
    }
  }

  // 3. Quitar artículos o preposiciones iniciales redundantes
  raw = raw.replace(/^(el|la|los|las|un|una|unos|unas|de|del|sobre|hacia)\s+/i, '').trim();
  raw = raw.replace(/^[¿¡"']+|[?!.,:;"']+$/g, '').trim();

  // 4. Limitar a máximo 2 o 3 palabras concisas para que nunca se desborde
  const words = raw.split(/\s+/).filter(Boolean);
  if (words.length > 3) {
    raw = words.slice(0, 3).join(' ');
  }

  return raw || 'Concepto Clave';
}

/**
 * Detector semántico exhaustivo del tipo de ilustración vectorial para cada escena.
 * Analiza el título, guion de locución, storyboard visual (indicación de escena),
 * definición y metáforas didácticas con una jerarquía estricta de prioridades.
 */
export function detectArtworkType(scene: AudiovisualScene): VisualArtworkType {
  const textCorpus = [
    scene.titulo || '',
    scene.descripcionComposicion || '',
    scene.conceptoPedagogico || '',
    scene.narracion || '',
    scene.textoEnPantalla?.conceptoNombre || '',
    scene.textoEnPantalla?.definicionConcepto || '',
    ...(scene.textoEnPantalla?.puntosClave || []),
  ]
    .join(' ')
    .toLowerCase();

  // =========================================================================
  // PRIORIDAD 0: PERSONAJES, ARCOS NARRATIVOS Y STORYBOARDS ESPECÍFICOS
  // =========================================================================

  // 0.1 MERLÍN EL SABIO, MAGO, BÁCULO, TRANSMUTACIÓN DEL MIEDO, ANIMALES DEL BOSQUE
  if (
    textCorpus.includes('merlín') ||
    textCorpus.includes('merlin') ||
    textCorpus.includes('mago') ||
    textCorpus.includes('hechicero') ||
    textCorpus.includes('alquimista') ||
    textCorpus.includes('báculo') ||
    textCorpus.includes('varita') ||
    (textCorpus.includes('miedo') && (textCorpus.includes('armadura') || textCorpus.includes('creó') || textCorpus.includes('enseña'))) ||
    (textCorpus.includes('sabiduría') && textCorpus.includes('autoconocimiento'))
  ) {
    return 'merlin_wizard_wisdom';
  }

  // 0.2 EL HERRERO, YUNQUE, MARTILLO Y EL DILEMA DEL YELMO ATASCADO
  if (
    textCorpus.includes('herrero') ||
    textCorpus.includes('martillo') ||
    textCorpus.includes('yunque') ||
    textCorpus.includes('dilema del yelmo') ||
    textCorpus.includes('forja') ||
    (textCorpus.includes('yelmo') && (textCorpus.includes('quitar') || textCorpus.includes('atascado') || textCorpus.includes('oxidado') || textCorpus.includes('golpe')))
  ) {
    return 'blacksmith_helmet_dilemma';
  }

  // 0.3 EL SENDERO DE LA VERDAD & LOS CASTILLOS (Silencio, Conocimiento, Valentía)
  if (
    textCorpus.includes('sendero de la verdad') ||
    textCorpus.includes('senda de la verdad') ||
    textCorpus.includes('castillo del conocimiento') ||
    textCorpus.includes('castillo de la valentía') ||
    (textCorpus.includes('sendero') && textCorpus.includes('verdad')) ||
    (textCorpus.includes('sendero') && textCorpus.includes('castillo'))
  ) {
    return 'truth_path_castles';
  }

  // 0.4 LIBERACIÓN, CIMA, LÁGRIMAS QUE DERRITEN LA ARMADURA, CORAZÓN RADIANTE
  if (
    textCorpus.includes('abismo de la confianza') ||
    textCorpus.includes('lágrima') ||
    textCorpus.includes('llanto') ||
    textCorpus.includes('desprender') ||
    textCorpus.includes('cae la armadura') ||
    textCorpus.includes('corazón libre') ||
    textCorpus.includes('deshacer la armadura') ||
    (textCorpus.includes('cima') && (textCorpus.includes('armadura') || textCorpus.includes('liber') || textCorpus.includes('verdad') || textCorpus.includes('sol')))
  ) {
    return 'knight_liberation';
  }

  // 0.5 CASTILLO DEL SILENCIO & FORTALEZAS MEDIEVALES
  if (
    textCorpus.includes('castillo del silencio') ||
    (textCorpus.includes('castillo') && (textCorpus.includes('silencio') || textCorpus.includes('fortaleza') || textCorpus.includes('muralla') || textCorpus.includes('torreón')))
  ) {
    return 'castle_silence';
  }

  // 0.6 CABALLERO MEDIEVAL, ARMADURA BRILLANTE, YELMO, ESPADA, GESTAS
  if (
    textCorpus.includes('caballero') ||
    textCorpus.includes('armadura') ||
    textCorpus.includes('yelmo') ||
    textCorpus.includes('espada') ||
    textCorpus.includes('escudero') ||
    textCorpus.includes('medieval') ||
    textCorpus.includes('don quijote') ||
    textCorpus.includes('hidalgo') ||
    textCorpus.includes('lanza') ||
    textCorpus.includes('cruzada')
  ) {
    return 'knight_armor';
  }

  // =========================================================================
  // PRIORIDAD 1: ARQUITECTURAS TÉCNICAS, CLOUD & CIBERSEGURIDAD
  // =========================================================================

  // 1.1 Rack de servidores físicos tradicionales vs Nube (Caos de cableado & fibra óptica)
  if (
    textCorpus.includes('rack') ||
    textCorpus.includes('cable') ||
    textCorpus.includes('fibra') ||
    textCorpus.includes('óptica') ||
    textCorpus.includes('patch panel') ||
    textCorpus.includes('datacenter') ||
    textCorpus.includes('data center') ||
    textCorpus.includes('servidor tradicional') ||
    textCorpus.includes('centro de datos') ||
    textCorpus.includes('comprar hardware') ||
    textCorpus.includes('hardware físico') ||
    textCorpus.includes('físico vs') ||
    textCorpus.includes('cables enredados')
  ) {
    return 'server_rack_cables';
  }

  // 1.2 Ciberseguridad, Ransomware, Malware, Hackers, Cifrado de Datos, Rescate
  if (
    textCorpus.includes('ransomware') ||
    textCorpus.includes('malware') ||
    textCorpus.includes('secuestro') ||
    textCorpus.includes('ciberataque') ||
    textCorpus.includes('ciberseguridad') ||
    textCorpus.includes('hacker') ||
    textCorpus.includes('phishing') ||
    textCorpus.includes('cifrado') ||
    textCorpus.includes('cifra los archivos') ||
    textCorpus.includes('pago para liberar') ||
    textCorpus.includes('rescate') ||
    textCorpus.includes('troyano') ||
    textCorpus.includes('infección')
  ) {
    return 'cybersecurity_ransomware';
  }

  // 1.3 Ciudad Digital, Metrópolis Conectada, Sociedad Hiperconectada, Internet Urbano
  if (
    textCorpus.includes('ciudad digital') ||
    textCorpus.includes('ciudad moderna') ||
    textCorpus.includes('metrópolis digital') ||
    textCorpus.includes('smart city') ||
    textCorpus.includes('infraestructura digital') ||
    textCorpus.includes('mundo digital') ||
    textCorpus.includes('sociedad conectada')
  ) {
    return 'digital_city_network';
  }

  // 1.4 Panorama de Amenazas / ENISA / Radar de Vulnerabilidades
  if (
    textCorpus.includes('panorama de amenazas') ||
    textCorpus.includes('enisa') ||
    textCorpus.includes('radar') ||
    textCorpus.includes('vector de ataque') ||
    textCorpus.includes('vulnerabilidad')
  ) {
    return 'threats_vulnerability_radar';
  }

  // 1.5 Barrio cerrado, garita de seguridad, subred pública y privada (Metáfora VCN)
  if (
    textCorpus.includes('barrio cerrado') ||
    textCorpus.includes('garita') ||
    textCorpus.includes('condominio') ||
    textCorpus.includes('urbanización') ||
    textCorpus.includes('área comercial de entrada') ||
    (textCorpus.includes('subred') && textCorpus.includes('pública') && textCorpus.includes('privada'))
  ) {
    return 'gated_community_subnets';
  }

  // 1.6 Data Masking / Enmascaramiento / Tarjeta de crédito / PCI-DSS
  if (
    textCorpus.includes('enmascara') ||
    textCorpus.includes('tarjeta de crédito') ||
    textCorpus.includes('pci-dss') ||
    textCorpus.includes('pan ') ||
    textCorpus.includes('número de tarjeta') ||
    textCorpus.includes('****')
  ) {
    return 'data_masking_safe';
  }

  // 1.7 Base de datos / Auto-Tuning / B-Tree / SQL / Autonomous Database
  if (
    textCorpus.includes('b-tree') ||
    textCorpus.includes('auto-tuning') ||
    textCorpus.includes('índice') ||
    textCorpus.includes('base de datos') ||
    textCorpus.includes('database') ||
    textCorpus.includes('autonomous database') ||
    textCorpus.includes('sql') ||
    textCorpus.includes('dba') ||
    textCorpus.includes('data safe') ||
    textCorpus.includes('query')
  ) {
    return 'database_btree_autotuning';
  }

  // 1.8 Tráfico, WAF, Firewalls, Stateful, Puerto 443, Ingress / Egress
  if (
    textCorpus.includes('tráfico') ||
    textCorpus.includes('security list') ||
    textCorpus.includes('firewall') ||
    textCorpus.includes('ingress') ||
    textCorpus.includes('egress') ||
    textCorpus.includes('stateful') ||
    textCorpus.includes('puerto 443') ||
    textCorpus.includes('ddos') ||
    textCorpus.includes('waf') ||
    textCorpus.includes('balanceador') ||
    textCorpus.includes('paquetes de datos')
  ) {
    return 'traffic_waf';
  }

  // 1.9 Arquitectura Cloud pura, VCN, Topología de Red
  if (
    textCorpus.includes('nube') ||
    textCorpus.includes('cloud') ||
    textCorpus.includes('vcn') ||
    textCorpus.includes('subred') ||
    textCorpus.includes('red privada') ||
    textCorpus.includes('red virtual') ||
    textCorpus.includes('networking') ||
    textCorpus.includes('gateway')
  ) {
    return 'cloud_architecture_topology';
  }

  // =========================================================================
  // PRIORIDAD 2: DOMINIOS Y CONCEPTOS DIDÁCTICOS ESPECÍFICOS
  // =========================================================================

  // 2.1 ANIMALES, CANINOS, PERROS, RASGOS DE MASCOTAS (Orejas, Mirada, Pelaje)
  if (
    textCorpus.includes('perro') ||
    textCorpus.includes('canino') ||
    textCorpus.includes('mascota') ||
    textCorpus.includes('gato') ||
    textCorpus.includes('felino') ||
    textCorpus.includes('hocico') ||
    textCorpus.includes('pelaje') ||
    textCorpus.includes('orejas') ||
    textCorpus.includes('ladrido') ||
    textCorpus.includes('raza canina') ||
    textCorpus.includes('veterinari') ||
    (textCorpus.includes('rasgos') && (textCorpus.includes('oreja') || textCorpus.includes('mirada') || textCorpus.includes('animal') || textCorpus.includes('canino')))
  ) {
    return 'animal_canine_features';
  }

  // 2.2 VISIÓN, MIRADA, OJOS, ENFOQUE BIOMÉTRICO Y RASGOS FACIALES
  if (
    textCorpus.includes('mirada') ||
    textCorpus.includes('visión') ||
    textCorpus.includes('ojo') ||
    textCorpus.includes('pupila') ||
    textCorpus.includes('iris') ||
    textCorpus.includes('retina') ||
    textCorpus.includes('observación visual') ||
    textCorpus.includes('foco visual') ||
    textCorpus.includes('cejas') ||
    textCorpus.includes('pestaña')
  ) {
    return 'vision_gaze_facial';
  }

  // 2.3 GASTRONOMÍA, COCINA, RECETAS, ALIMENTOS Y CHEF
  if (
    textCorpus.includes('cocina') ||
    textCorpus.includes('gastronom') ||
    textCorpus.includes('receta') ||
    textCorpus.includes('plato') ||
    textCorpus.includes('chef') ||
    textCorpus.includes('alimento') ||
    textCorpus.includes('comida') ||
    textCorpus.includes('ingrediente') ||
    textCorpus.includes('sabor') ||
    textCorpus.includes('cocción') ||
    textCorpus.includes('sartén') ||
    textCorpus.includes('culinari')
  ) {
    return 'culinary_gastronomy_food';
  }

  // 2.4 AUTOMOTRIZ, MECÁNICA, ENGRANAJES, MOTORES E INGENIERÍA
  if (
    textCorpus.includes('auto') ||
    textCorpus.includes('vehículo') ||
    textCorpus.includes('motor') ||
    textCorpus.includes('engranaje') ||
    textCorpus.includes('mecánic') ||
    textCorpus.includes('freno') ||
    textCorpus.includes('torque') ||
    textCorpus.includes('pistón') ||
    textCorpus.includes('combustión') ||
    textCorpus.includes('chasis') ||
    textCorpus.includes('velocímetro')
  ) {
    return 'automotive_mechanics_engineering';
  }

  // 2.5 MATEMÁTICAS, CÁLCULO, GEOMETRÍA, ÁLGEBRA Y ECUACIONES
  if (
    textCorpus.includes('matemátic') ||
    textCorpus.includes('cálculo') ||
    textCorpus.includes('álgebra') ||
    textCorpus.includes('geometría') ||
    textCorpus.includes('ecuación') ||
    textCorpus.includes('función') ||
    textCorpus.includes('teorema') ||
    textCorpus.includes('seno') ||
    textCorpus.includes('coseno') ||
    textCorpus.includes('triángulo') ||
    textCorpus.includes('integral') ||
    textCorpus.includes('derivada') ||
    textCorpus.includes('coordenada')
  ) {
    return 'math_geometry_calculus';
  }

  // 2.6 ARTE, PINTURA, COLOR, LIENZO Y DISEÑO VISUAL
  if (
    textCorpus.includes('arte visual') ||
    textCorpus.includes('pintura') ||
    textCorpus.includes('paleta de color') ||
    textCorpus.includes('diseño gráfico') ||
    textCorpus.includes('pincel') ||
    textCorpus.includes('lienzo') ||
    textCorpus.includes('óleo') ||
    textCorpus.includes('acuarela')
  ) {
    return 'art_design_painting';
  }

  // 2.7 BIOLOGÍA CELULAR & GENÉTICA
  if (
    textCorpus.includes('célula') ||
    textCorpus.includes('adn') ||
    textCorpus.includes('genétic') ||
    textCorpus.includes('biolog') ||
    textCorpus.includes('proteína') ||
    textCorpus.includes('enzima') ||
    textCorpus.includes('organismo vivo') ||
    textCorpus.includes('bacteria') ||
    textCorpus.includes('virus') ||
    textCorpus.includes('molécul')
  ) {
    return 'science_biology';
  }

  // 2.8 ESPACIO, COSMOS, PLANETAS, FÍSICA
  if (
    textCorpus.includes('planeta') ||
    textCorpus.includes('astro') ||
    textCorpus.includes('universo') ||
    textCorpus.includes('galaxia') ||
    textCorpus.includes('cosmos') ||
    textCorpus.includes('estrella') ||
    textCorpus.includes('gravedad') ||
    textCorpus.includes('físic') ||
    textCorpus.includes('átomo') ||
    textCorpus.includes('órbita') ||
    textCorpus.includes('cuántic') ||
    textCorpus.includes('espacio exterior')
  ) {
    return 'science_physics_space';
  }

  // 2.9 LIBROS, LITERATURA, LECTURA, NOVELAS & FILOSOFÍA
  if (
    textCorpus.includes('libro') ||
    textCorpus.includes('literat') ||
    textCorpus.includes('novela') ||
    textCorpus.includes('cuento') ||
    textCorpus.includes('relato') ||
    textCorpus.includes('lectura') ||
    textCorpus.includes('autor') ||
    textCorpus.includes('página') ||
    textCorpus.includes('filosof') ||
    textCorpus.includes('poesía') ||
    textCorpus.includes('manuscrito') ||
    textCorpus.includes('escritor')
  ) {
    return 'book_literature';
  }

  // 2.10 INTELIGENCIA ARTIFICIAL & ROBÓTICA
  if (
    textCorpus.includes('inteligencia artificial') ||
    textCorpus.includes('robot') ||
    textCorpus.includes(' ia ') ||
    textCorpus.includes('chatgpt') ||
    textCorpus.includes('llm') ||
    textCorpus.includes('machine learning') ||
    textCorpus.includes('deep learning') ||
    textCorpus.includes('red neuronal') ||
    textCorpus.includes('automatizaci')
  ) {
    return 'ai_robotics';
  }

  // 2.11 MENTE, PSICOLOGÍA & PENSAMIENTO
  if (
    textCorpus.includes('mente') ||
    textCorpus.includes('cerebro') ||
    textCorpus.includes('pensamiento') ||
    textCorpus.includes('idea') ||
    textCorpus.includes('insight') ||
    textCorpus.includes('psicolog') ||
    textCorpus.includes('emoci') ||
    textCorpus.includes('cogniti') ||
    textCorpus.includes('bombilla')
  ) {
    return 'mind_insight';
  }

  // 2.12 CÓDIGO, PROGRAMACIÓN, SOFTWARE & TERMINAL
  if (
    textCorpus.includes('código') ||
    textCorpus.includes('código fuente') ||
    textCorpus.includes('programaci') ||
    textCorpus.includes('software') ||
    textCorpus.includes('terminal') ||
    textCorpus.includes('script') ||
    textCorpus.includes('desarrollo web') ||
    textCorpus.includes('javascript') ||
    textCorpus.includes('python') ||
    textCorpus.includes('typescript') ||
    textCorpus.includes('comando') ||
    textCorpus.includes('cli')
  ) {
    return 'coding_software';
  }

  // 2.13 FINANZAS, ECONOMÍA & NEGOCIOS
  if (
    textCorpus.includes('finanz') ||
    textCorpus.includes('econom') ||
    textCorpus.includes('dinero') ||
    textCorpus.includes('inversi') ||
    textCorpus.includes('mercado') ||
    textCorpus.includes('trading') ||
    textCorpus.includes('bolsa') ||
    textCorpus.includes('cripto') ||
    textCorpus.includes('banco') ||
    textCorpus.includes('roi') ||
    textCorpus.includes('ganancia') ||
    textCorpus.includes('rentabilidad')
  ) {
    return 'finance_economy';
  }

  // 2.14 MEDICINA & SALUD
  if (
    textCorpus.includes('médic') ||
    textCorpus.includes('salud') ||
    textCorpus.includes('paciente') ||
    textCorpus.includes('enfermedad') ||
    textCorpus.includes('hospital') ||
    textCorpus.includes('clínica') ||
    textCorpus.includes('terapia') ||
    textCorpus.includes('fármaco') ||
    textCorpus.includes('diagnóstico') ||
    textCorpus.includes('bienestar')
  ) {
    return 'medicine_health';
  }

  // 2.15 EDUCACIÓN & APRENDIZAJE
  if (
    textCorpus.includes('educaci') ||
    textCorpus.includes('escuela') ||
    textCorpus.includes('aprendizaje') ||
    textCorpus.includes('docente') ||
    textCorpus.includes('profesor') ||
    textCorpus.includes('alumno') ||
    textCorpus.includes('estudiante') ||
    textCorpus.includes('pedagog') ||
    textCorpus.includes('lección') ||
    textCorpus.includes('aula') ||
    textCorpus.includes('clase')
  ) {
    return 'education_learning';
  }

  // 2.16 JUSTICIA, LEY & ÉTICA
  if (
    textCorpus.includes('ley') ||
    textCorpus.includes('justicia') ||
    textCorpus.includes('derecho') ||
    textCorpus.includes('abogado') ||
    textCorpus.includes('juez') ||
    textCorpus.includes('tribunal') ||
    textCorpus.includes('ética') ||
    textCorpus.includes('balanza') ||
    textCorpus.includes('norma') ||
    textCorpus.includes('legal')
  ) {
    return 'law_justice';
  }

  // =========================================================================
  // PRIORIDAD 3: BOTÁNICA Y ECOLOGÍA (SOLO CUANDO EL TEMA SEA ESTRICTAMENTE ESE)
  // NOTA: NO incluir palabras contextuales como 'árbol' o 'hoja' sueltas
  // =========================================================================

  // 3.1 BOTÁNICA & FISIOLOGÍA VEGETAL ESTRICTA
  if (
    textCorpus.includes('fotosíntesis') ||
    textCorpus.includes('clorofila') ||
    textCorpus.includes('botánic') ||
    textCorpus.includes('especie vegetal') ||
    textCorpus.includes('cultivo de plantas') ||
    textCorpus.includes('germinación') ||
    textCorpus.includes('fisiología vegetal') ||
    (textCorpus.includes('planta') && (textCorpus.includes('raíz') || textCorpus.includes('fotosíntesis') || textCorpus.includes('botánica')))
  ) {
    return 'botany_nature_plants';
  }

  // 3.2 ECOLOGÍA & MEDIO AMBIENTE
  if (
    textCorpus.includes('ecolog') ||
    textCorpus.includes('medio ambiente') ||
    textCorpus.includes('sostenible') ||
    textCorpus.includes('biodiversidad') ||
    textCorpus.includes('deforestación') ||
    textCorpus.includes('cambio climático')
  ) {
    return 'nature_ecology';
  }

  // =========================================================================
  // PRIORIDAD 4: ESTRUCTURAS ABSTRACTAS, METAS & PIPELINES
  // =========================================================================

  // 4.1 MÚSICA & SONIDO
  if (
    textCorpus.includes('música') ||
    textCorpus.includes('canción') ||
    textCorpus.includes('melodía') ||
    textCorpus.includes('instrumento musical')
  ) {
    return 'music_arts';
  }

  // 4.2 MONTAÑA, SENDERO & CAMINO
  if (
    textCorpus.includes('montaña') ||
    textCorpus.includes('cumbre') ||
    textCorpus.includes('escalada') ||
    textCorpus.includes('travesía')
  ) {
    return 'journey_mountain';
  }

  // 4.3 TROFEO & CERTIFICACIÓN FINAL
  if (
    textCorpus.includes('trofeo') ||
    textCorpus.includes('certificaci') ||
    textCorpus.includes('emblema') ||
    textCorpus.includes('examen final') ||
    textCorpus.includes('victoria') ||
    textCorpus.includes('felicitaciones') ||
    textCorpus.includes('logro') ||
    textCorpus.includes('premio') ||
    textCorpus.includes('cierre')
  ) {
    return 'badge_certification_trophy';
  }

  // 4.4 PIPELINE SECUENCIAL
  if (
    textCorpus.includes('pipeline') ||
    textCorpus.includes('secuencia de pasos') ||
    textCorpus.includes('paso a paso')
  ) {
    return 'steps_flow_pipeline';
  }

  // =========================================================================
  // PRIORIDAD 5: GENERADOR UNIVERSAL DINÁMICO & AGNÓSTICO
  // =========================================================================
  return 'universal_dynamic_infographic';
}

export const ConceptIllustrationGraphic = ({ scene }: Props) => {
  const artwork = detectArtworkType(scene);
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPulse((p) => (p + 1) % 100);
    }, 45);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={styles.graphicCanvas}>
      {/* Fondo Ambient con rejilla, foco de luz y degradados luminosos */}
      <div className={styles.gridBackground} />
      <div className={styles.spotlightCore} />
      <div className={styles.ambientGlowCyan} />
      <div className={styles.ambientGlowViolet} />

      {/* Capa Vectorial Animada Semántica */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 4,
          padding: '1rem 1.5rem 7rem 1.5rem',
        }}
      >
        {/* ============================================================
            0.0 ANIMALES & RASGOS CANINOS (Orejas, Mirada, Foco Atencional)
           ============================================================ */}
        {artwork === 'animal_canine_features' && (
          <svg
            viewBox="0 0 540 280"
            style={{
              width: '100%',
              maxWidth: '500px',
              height: 'auto',
              filter: 'drop-shadow(0 15px 35px rgba(56, 189, 248, 0.45))',
            }}
          >
            <defs>
              <linearGradient id="dogFaceGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(56, 189, 248, 0.25)" />
                <stop offset="50%" stopColor="rgba(129, 140, 248, 0.3)" />
                <stop offset="100%" stopColor="rgba(15, 23, 42, 0.9)" />
              </linearGradient>
              <linearGradient id="gazeRayGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f43f5e" />
                <stop offset="100%" stopColor="rgba(244, 63, 94, 0.1)" />
              </linearGradient>
            </defs>

            {/* Ondas acústicas concéntricas en las orejas */}
            <path d="M 195 45 A 25 25 0 0 1 230 45" fill="none" stroke="#38bdf8" strokeWidth="2" strokeDasharray="4 3" opacity="0.9" />
            <path d="M 185 30 A 40 40 0 0 1 240 30" fill="none" stroke="#67e8f9" strokeWidth="1.5" strokeDasharray="5 4" opacity="0.6" />
            <path d="M 310 45 A 25 25 0 0 0 275 45" fill="none" stroke="#38bdf8" strokeWidth="2" strokeDasharray="4 3" opacity="0.9" />
            <path d="M 320 30 A 40 40 0 0 0 265 30" fill="none" stroke="#67e8f9" strokeWidth="1.5" strokeDasharray="5 4" opacity="0.6" />

            {/* Oreja Izquierda Erguida */}
            <polygon points="205,95 180,35 225,65" fill="url(#dogFaceGrad)" stroke="#38bdf8" strokeWidth="2.5" strokeLinejoin="round" />
            {/* Oreja Derecha Erguida */}
            <polygon points="300,95 325,35 280,65" fill="url(#dogFaceGrad)" stroke="#38bdf8" strokeWidth="2.5" strokeLinejoin="round" />

            {/* Cabeza del Canino */}
            <path
              d="M 215 75 Q 252 65 290 75 L 305 130 Q 252 140 200 130 Z"
              fill="rgba(15, 23, 42, 0.9)"
              stroke="#818cf8"
              strokeWidth="2"
            />

            {/* Hocico y Nariz */}
            <polygon points="225,130 280,130 265,185 240,185" fill="rgba(30, 41, 59, 0.95)" stroke="#38bdf8" strokeWidth="2" />
            <ellipse cx="252" cy="180" rx="14" ry="9" fill="#0f172a" stroke="#f43f5e" strokeWidth="2" />

            {/* Ojos y Mirada Enfocada */}
            <ellipse cx="228" cy="112" rx="9" ry="6" fill="#0f172a" stroke="#fde047" strokeWidth="2" />
            <circle cx="229" cy="112" r="4" fill="#f59e0b" />
            <circle cx="231" cy="110" r="1.5" fill="#ffffff" />

            <ellipse cx="277" cy="112" rx="9" ry="6" fill="#0f172a" stroke="#fde047" strokeWidth="2" />
            <circle cx="276" cy="112" r="4" fill="#f59e0b" />
            <circle cx="274" cy="110" r="1.5" fill="#ffffff" />

            {/* Rayos de Foco Visual hacia los costados/adelante */}
            <line x1="229" y1="112" x2="110" y2="112" stroke="url(#gazeRayGrad)" strokeWidth="2" strokeDasharray="5 3" className={styles.animatedPath} />
            <line x1="276" y1="112" x2="410" y2="112" stroke="url(#gazeRayGrad)" strokeWidth="2" strokeDasharray="5 3" className={styles.animatedPath} />

            {/* Retícula de Foco Visual */}
            <circle cx="95" cy="112" r="18" fill="rgba(244, 63, 94, 0.15)" stroke="#f43f5e" strokeWidth="1.5" />
            <line x1="75" y1="112" x2="115" y2="112" stroke="#f43f5e" strokeWidth="1" />
            <line x1="95" y1="92" x2="95" y2="132" stroke="#f43f5e" strokeWidth="1" />
            <text x="95" y="145" fill="#fda4af" fontSize="9" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
              FOCO VISUAL
            </text>

            {/* Retícula de Sensor Auditivo en Orejas */}
            <circle cx="425" cy="45" r="16" fill="rgba(56, 189, 248, 0.15)" stroke="#38bdf8" strokeWidth="1.5" />
            <line x1="325" y1="35" x2="408" y2="45" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="3 3" />
            <text x="425" y="75" fill="#7dd3fc" fontSize="9" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
              OREJAS ALERTAS
            </text>
          </svg>
        )}

        {/* ============================================================
            0.01 VISIÓN, MIRADA & BIOMETRÍA FACIAL
           ============================================================ */}
        {artwork === 'vision_gaze_facial' && (
          <svg
            viewBox="0 0 520 260"
            style={{
              width: '100%',
              maxWidth: '480px',
              height: 'auto',
              filter: 'drop-shadow(0 15px 35px rgba(244, 63, 94, 0.45))',
            }}
          >
            <defs>
              <linearGradient id="eyeIrisGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="50%" stopColor="#818cf8" />
                <stop offset="100%" stopColor="#c084fc" />
              </linearGradient>
            </defs>

            {/* Contorno del Ojo */}
            <path
              d="M 140 120 Q 260 40 380 120 Q 260 200 140 120 Z"
              fill="rgba(15, 23, 42, 0.9)"
              stroke="#38bdf8"
              strokeWidth="3"
            />

            {/* Iris Escaneada */}
            <circle cx="260" cy="120" r="45" fill="url(#eyeIrisGrad)" stroke="#67e8f9" strokeWidth="2" />
            <circle cx="260" cy="120" r="32" fill="none" stroke="#ffffff" strokeWidth="1.5" strokeDasharray="4 3" transform={`rotate(${pulse * 3.6} 260 120)`} />
            <circle cx="260" cy="120" r="18" fill="#0f172a" stroke="#f43f5e" strokeWidth="2" />
            <circle cx="268" cy="112" r="5" fill="#ffffff" />

            {/* Retícula de Enfoque y Ejes Biométricos */}
            <line x1="80" y1="120" x2="440" y2="120" stroke="#f43f5e" strokeWidth="1.5" strokeDasharray="6 4" opacity="0.8" />
            <line x1="260" y1="20" x2="260" y2="220" stroke="#f43f5e" strokeWidth="1.5" strokeDasharray="6 4" opacity="0.8" />

            {/* Cono de Percepción Visual */}
            <polygon points="260,120 440,70 440,170" fill="rgba(244, 63, 94, 0.08)" stroke="#f43f5e" strokeWidth="1.5" strokeDasharray="3 3" />
            <circle cx="440" cy="120" r="8" fill="#f43f5e" />
          </svg>
        )}

        {/* ============================================================
            0.02 BOTÁNICA, VEGETACIÓN & FOTOSÍNTESIS
           ============================================================ */}
        {artwork === 'botany_nature_plants' && (
          <svg viewBox="0 0 500 260" style={{ width: '100%', maxWidth: '460px', height: 'auto', filter: 'drop-shadow(0 15px 35px rgba(34, 197, 94, 0.45))' }}>
            <defs>
              <linearGradient id="leafGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#4ade80" />
                <stop offset="50%" stopColor="#16a34a" />
                <stop offset="100%" stopColor="#14532d" />
              </linearGradient>
            </defs>

            <path d="M 250 210 Q 250 140 250 50" fill="none" stroke="#22c55e" strokeWidth="4" strokeLinecap="round" />
            <path d="M 250 130 Q 330 90 310 50 Q 250 60 250 130 Z" fill="url(#leafGrad)" stroke="#4ade80" strokeWidth="2" />
            <path d="M 250 160 Q 170 120 190 80 Q 250 90 250 160 Z" fill="url(#leafGrad)" stroke="#4ade80" strokeWidth="2" />

            <circle cx="340" cy="40" r="18" fill="rgba(250, 204, 21, 0.2)" stroke="#facc15" strokeWidth="2" />
            <line x1="330" y1="55" x2="295" y2="90" stroke="#facc15" strokeWidth="2" strokeDasharray="4 3" className={styles.animatedPath} />

            <circle cx="210" cy="110" r="5" fill="#86efac" />
            <circle cx="290" cy="80" r="6" fill="#86efac" />
          </svg>
        )}

        {/* ============================================================
            0.03 GASTRONOMÍA & ARTE CULINARIO
           ============================================================ */}
        {artwork === 'culinary_gastronomy_food' && (
          <svg viewBox="0 0 500 260" style={{ width: '100%', maxWidth: '460px', height: 'auto', filter: 'drop-shadow(0 15px 35px rgba(245, 158, 11, 0.45))' }}>
            <path d="M 160 170 L 340 170" stroke="#cbd5e1" strokeWidth="4" strokeLinecap="round" />
            <path d="M 175 165 C 175 90, 325 90, 325 165 Z" fill="rgba(245, 158, 11, 0.25)" stroke="#f59e0b" strokeWidth="3" />
            <circle cx="250" cy="85" r="8" fill="#fbbf24" />
            <path d="M 235 65 Q 245 40 235 25" fill="none" stroke="#fde68a" strokeWidth="2" strokeDasharray="3 3" className={styles.animatedPath} />
            <path d="M 265 65 Q 275 40 265 25" fill="none" stroke="#fde68a" strokeWidth="2" strokeDasharray="3 3" className={styles.animatedPath} />
          </svg>
        )}

        {/* ============================================================
            0.04 AUTOMOTRIZ, MOTORES & ENGRANAJES
           ============================================================ */}
        {artwork === 'automotive_mechanics_engineering' && (
          <svg viewBox="0 0 500 260" style={{ width: '100%', maxWidth: '460px', height: 'auto', filter: 'drop-shadow(0 15px 35px rgba(6, 182, 212, 0.45))' }}>
            <g transform={`rotate(${pulse * 3.6} 220 115)`}>
              <circle cx="220" cy="115" r="45" fill="rgba(6, 182, 212, 0.2)" stroke="#22d3ee" strokeWidth="3" strokeDasharray="12 6" />
              <circle cx="220" cy="115" r="20" fill="#0f172a" stroke="#38bdf8" strokeWidth="2" />
            </g>
            <g transform={`rotate(${-pulse * 3.6} 290 145)`}>
              <circle cx="290" cy="145" r="32" fill="rgba(139, 92, 246, 0.2)" stroke="#a855f7" strokeWidth="2.5" strokeDasharray="10 5" />
              <circle cx="290" cy="145" r="14" fill="#0f172a" stroke="#c084fc" strokeWidth="2" />
            </g>
            <path d="M 130 115 L 170 115" stroke="#38bdf8" strokeWidth="3" strokeDasharray="4 4" className={styles.animatedPath} />
            <path d="M 330 145 L 370 145" stroke="#a855f7" strokeWidth="3" strokeDasharray="4 4" className={styles.animatedPath} />
          </svg>
        )}

        {/* ============================================================
            0.05 MATEMÁTICAS, GEOMETRÍA & CÁLCULO
           ============================================================ */}
        {artwork === 'math_geometry_calculus' && (
          <svg viewBox="0 0 500 260" style={{ width: '100%', maxWidth: '460px', height: 'auto', filter: 'drop-shadow(0 15px 35px rgba(236, 72, 153, 0.45))' }}>
            <line x1="120" y1="120" x2="380" y2="120" stroke="#64748b" strokeWidth="1.5" />
            <line x1="250" y1="30" x2="250" y2="200" stroke="#64748b" strokeWidth="1.5" />
            <path d="M 130 120 Q 190 30 250 120 T 370 120" fill="none" stroke="#ec4899" strokeWidth="3" />
            <polygon points="190,120 250,55 310,120" fill="rgba(236, 72, 153, 0.15)" stroke="#f472b6" strokeWidth="1.5" strokeDasharray="4 3" />
            <circle cx="190" cy="75" r="5" fill="#fde047" />
            <circle cx="310" cy="165" r="5" fill="#38bdf8" />
          </svg>
        )}

        {/* ============================================================
            0.06 ARTE, PINTURA & DISEÑO
           ============================================================ */}
        {artwork === 'art_design_painting' && (
          <svg viewBox="0 0 500 260" style={{ width: '100%', maxWidth: '460px', height: 'auto', filter: 'drop-shadow(0 15px 35px rgba(217, 70, 239, 0.45))' }}>
            <path d="M 180 130 C 180 70, 320 70, 320 130 C 320 180, 280 180, 260 160 C 240 140, 210 180, 180 130 Z" fill="rgba(217, 70, 239, 0.2)" stroke="#e879f9" strokeWidth="2.5" />
            <circle cx="215" cy="100" r="9" fill="#f43f5e" />
            <circle cx="250" cy="85" r="9" fill="#facc15" />
            <circle cx="285" cy="100" r="9" fill="#38bdf8" />
            <circle cx="240" cy="150" r="9" fill="#22c55e" />
            <line x1="160" y1="40" x2="230" y2="120" stroke="#cbd5e1" strokeWidth="4" strokeLinecap="round" />
            <polygon points="230,120 240,135 225,135" fill="#f43f5e" />
          </svg>
        )}

        {/* ============================================================
            0.1 CIBERSEGURIDAD & RANSOMWARE (Candado Cifrado, Rescate, Malware)
           ============================================================ */}
        {artwork === 'cybersecurity_ransomware' && (
          <svg
            viewBox="0 0 500 260"
            style={{
              width: '100%',
              maxWidth: '460px',
              height: 'auto',
              filter: 'drop-shadow(0 15px 35px rgba(244, 63, 94, 0.45))',
            }}
          >
            <defs>
              <linearGradient id="ransomPadlockGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ef4444" />
                <stop offset="50%" stopColor="#b91c1c" />
                <stop offset="100%" stopColor="#450a0a" />
              </linearGradient>
              <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="rgba(239, 68, 68, 0.25)" />
                <stop offset="100%" stopColor="rgba(15, 23, 42, 0.85)" />
              </linearGradient>
            </defs>

            {/* Escudo Exterior de Ciberamenaza */}
            <path
              d="M 250 20 L 370 60 L 350 165 C 350 210, 250 240, 250 240 C 250 240, 150 210, 150 165 L 130 60 Z"
              fill="url(#shieldGrad)"
              stroke="#f43f5e"
              strokeWidth="2.5"
            />

            {/* Matriz de Cifrado Binario de Fondo */}
            <g opacity="0.45" fill="#fda4af" fontSize="10" fontFamily="monospace">
              <text x="165" y="85">01100010</text>
              <text x="285" y="85">11010001</text>
              <text x="155" y="120">LOCKED</text>
              <text x="290" y="120">AES-256</text>
              <text x="165" y="155">10110100</text>
              <text x="285" y="155">00101110</text>
            </g>

            {/* Candado Central Bloqueado */}
            <path
              d="M 215 95 L 215 65 C 215 45, 285 45, 285 65 L 285 95"
              fill="none"
              stroke="#fecdd3"
              strokeWidth="10"
              strokeLinecap="round"
            />
            <rect
              x="195"
              y="90"
              width="110"
              height="80"
              rx="16"
              fill="url(#ransomPadlockGrad)"
              stroke="#f43f5e"
              strokeWidth="2.5"
            />

            {/* Ojo de Cerradura */}
            <circle cx="250" cy="122" r="9" fill="#ffffff" />
            <polygon points="246,124 254,124 257,145 243,145" fill="#ffffff" />

            {/* Pulsos de Bloqueo Criptográfico */}
            <circle
              cx="250"
              cy="125"
              r="60"
              fill="none"
              stroke="#ef4444"
              strokeWidth="1.5"
              strokeDasharray="6 4"
              opacity="0.8"
            />
          </svg>
        )}

        {/* ============================================================
            0.2 CIUDAD DIGITAL & RED CONECTADA (Metrópolis, Nodos, Fibra)
           ============================================================ */}
        {artwork === 'digital_city_network' && (
          <svg
            viewBox="0 0 520 260"
            style={{
              width: '100%',
              maxWidth: '480px',
              height: 'auto',
              filter: 'drop-shadow(0 15px 35px rgba(6, 182, 212, 0.4))',
            }}
          >
            <defs>
              <linearGradient id="buildingNeon1" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#06b6d4" />
                <stop offset="100%" stopColor="#083344" />
              </linearGradient>
              <linearGradient id="buildingNeon2" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#2e1065" />
              </linearGradient>
            </defs>

            {/* Cielo Digital con Ondas y Faro */}
            <circle cx="260" cy="65" r="42" fill="rgba(6, 182, 212, 0.12)" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="4 3" />
            <circle cx="260" cy="65" r="16" fill="rgba(56, 189, 248, 0.3)" stroke="#38bdf8" strokeWidth="2" />
            <circle cx="260" cy="65" r="6" fill="#67e8f9" />

            {/* Rascacielos & Torres Digitales */}
            {/* Edificio 1 Izquierda */}
            <rect x="70" y="105" width="55" height="110" rx="4" fill="url(#buildingNeon1)" stroke="#22d3ee" strokeWidth="1.5" />
            <line x1="85" y1="120" x2="85" y2="195" stroke="#67e8f9" strokeWidth="2" strokeDasharray="6 6" />
            <line x1="110" y1="120" x2="110" y2="195" stroke="#67e8f9" strokeWidth="2" strokeDasharray="6 6" />

            {/* Edificio 2 Centro-Izquierda */}
            <rect x="140" y="75" width="65" height="140" rx="4" fill="#0f172a" stroke="#818cf8" strokeWidth="2" />
            <polygon points="172,45 172,75" stroke="#818cf8" strokeWidth="3" />
            <circle cx="172.5" cy="43" r="4" fill="#c084fc" />
            <rect x="152" y="90" width="40" height="18" rx="2" fill="rgba(129, 140, 248, 0.25)" stroke="#a5b4fc" strokeWidth="1" />
            <rect x="152" y="120" width="40" height="18" rx="2" fill="rgba(129, 140, 248, 0.25)" stroke="#a5b4fc" strokeWidth="1" />
            <rect x="152" y="150" width="40" height="18" rx="2" fill="rgba(129, 140, 248, 0.25)" stroke="#a5b4fc" strokeWidth="1" />

            {/* Edificio 3 Central - Servidor Principal / Metrópolis Core */}
            <rect x="220" y="55" width="80" height="160" rx="6" fill="url(#buildingNeon2)" stroke="#c084fc" strokeWidth="2" />
            <polygon points="260,25 260,55" stroke="#f472b6" strokeWidth="3.5" />
            <circle cx="260" cy="22" r="5" fill="#f43f5e" />
            <line x1="240" y1="70" x2="280" y2="70" stroke="#e879f9" strokeWidth="2" />
            <line x1="240" y1="90" x2="280" y2="90" stroke="#e879f9" strokeWidth="2" />
            <line x1="240" y1="110" x2="280" y2="110" stroke="#e879f9" strokeWidth="2" />
            <line x1="240" y1="130" x2="280" y2="130" stroke="#e879f9" strokeWidth="2" />

            {/* Edificio 4 Centro-Derecha */}
            <rect x="315" y="85" width="60" height="130" rx="4" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.5" />
            <polygon points="345,60 345,85" stroke="#38bdf8" strokeWidth="2.5" />
            <circle cx="345" cy="58" r="3.5" fill="#38bdf8" />
            <rect x="325" y="100" width="40" height="16" rx="2" fill="rgba(56, 189, 248, 0.2)" stroke="#38bdf8" strokeWidth="1" />
            <rect x="325" y="125" width="40" height="16" rx="2" fill="rgba(56, 189, 248, 0.2)" stroke="#38bdf8" strokeWidth="1" />

            {/* Edificio 5 Derecha */}
            <rect x="390" y="115" width="55" height="100" rx="4" fill="url(#buildingNeon1)" stroke="#22d3ee" strokeWidth="1.5" />
            <line x1="405" y1="130" x2="405" y2="195" stroke="#67e8f9" strokeWidth="2" strokeDasharray="5 5" />
            <line x1="428" y1="130" x2="428" y2="195" stroke="#67e8f9" strokeWidth="2" strokeDasharray="5 5" />

            {/* Líneas de Red y Tráfico Urbano */}
            <path d="M 50 215 L 470 215" stroke="#06b6d4" strokeWidth="3" />
            <path
              d="M 97 105 Q 172 60, 260 55 T 345 85 T 417 115"
              fill="none"
              stroke="#38bdf8"
              strokeWidth="2"
              strokeDasharray="6 4"
              className={styles.animatedPath}
            />
          </svg>
        )}

        {/* ============================================================
            0.3 RADAR DE AMENAZAS & VULNERABILIDADES (ENISA Radar Scope)
           ============================================================ */}
        {artwork === 'threats_vulnerability_radar' && (
          <svg
            viewBox="0 0 500 260"
            style={{
              width: '100%',
              maxWidth: '460px',
              height: 'auto',
              filter: 'drop-shadow(0 15px 35px rgba(245, 158, 11, 0.4))',
            }}
          >
            <defs>
              <linearGradient id="radarSweepGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(245, 158, 11, 0.6)" />
                <stop offset="100%" stopColor="transparent" />
              </linearGradient>
            </defs>

            {/* Círculos Concéntricos del Radar */}
            <circle cx="250" cy="110" r="95" fill="rgba(15, 23, 42, 0.8)" stroke="#f59e0b" strokeWidth="2" />
            <circle cx="250" cy="110" r="68" fill="none" stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="5 3" />
            <circle cx="250" cy="110" r="40" fill="none" stroke="#fde047" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx="250" cy="110" r="14" fill="rgba(245, 158, 11, 0.3)" stroke="#f59e0b" strokeWidth="1.5" />
            <circle cx="250" cy="110" r="4" fill="#fbbf24" />

            {/* Ejes de Coordenadas */}
            <line x1="140" y1="110" x2="360" y2="110" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4 4" />
            <line x1="250" y1="10" x2="250" y2="210" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4 4" />

            {/* Haz Giratorio del Radar */}
            <polygon
              points="250,110 340,50 330,20"
              fill="url(#radarSweepGrad)"
              opacity="0.85"
              transform={`rotate(${pulse * 3.6} 250 110)`}
            />

            {/* Amenazas Detectadas */}
            <circle cx="305" cy="65" r="7" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />
            <circle cx="305" cy="65" r="14" fill="none" stroke="#ef4444" strokeWidth="1" strokeDasharray="2 2" />
            <text x="318" y="69" fill="#fca5a5" fontSize="9" fontFamily="monospace" fontWeight="bold">MALWARE</text>

            <circle cx="195" cy="150" r="6" fill="#f59e0b" stroke="#ffffff" strokeWidth="1" />
            <text x="135" y="154" fill="#fde68a" fontSize="9" fontFamily="monospace" fontWeight="bold">PHISHING</text>

            <circle cx="205" cy="60" r="5" fill="#ec4899" />
            <text x="160" y="53" fill="#fbcfe8" fontSize="8" fontFamily="monospace">INTRUSIÓN</text>
          </svg>
        )}

        {/* ============================================================
            1. BARRIO CERRADO & SUBREDES (Metáfora Arquitectónica VCN)
           ============================================================ */}
        {artwork === 'gated_community_subnets' && (
          <svg
            viewBox="0 0 540 280"
            style={{
              width: '100%',
              maxWidth: '500px',
              height: 'auto',
              filter: 'drop-shadow(0 15px 35px rgba(6, 182, 212, 0.35))',
            }}
          >
            <defs>
              <linearGradient id="fenceGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(6, 182, 212, 0.4)" />
                <stop offset="100%" stopColor="rgba(139, 92, 246, 0.3)" />
              </linearGradient>
              <linearGradient id="guardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0284c7" />
                <stop offset="100%" stopColor="#0369a1" />
              </linearGradient>
            </defs>

            {/* Perímetro del Barrio Cerrado (VCN) */}
            <rect
              x="40"
              y="25"
              width="460"
              height="225"
              rx="20"
              fill="rgba(15, 23, 42, 0.85)"
              stroke="#22d3ee"
              strokeWidth="2.5"
              strokeDasharray="8 4"
            />
            <rect x="55" y="15" width="140" height="20" rx="6" fill="#0f172a" stroke="#22d3ee" strokeWidth="1.5" />
            <text x="125" y="29" fill="#38bdf8" fontSize="10" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
              VCN · BARRIO CERRADO
            </text>

            {/* 1.1 Garita de Seguridad / Control de Entrada (Internet Gateway) */}
            <rect x="65" y="80" width="85" height="120" rx="10" fill="url(#guardGrad)" stroke="#38bdf8" strokeWidth="2" />
            {/* Techo Garita */}
            <polygon points="60,80 107,55 155,80" fill="#0369a1" stroke="#38bdf8" strokeWidth="1.5" />
            {/* Ventanilla & Guardia */}
            <rect x="80" y="95" width="55" height="35" rx="5" fill="#0f172a" stroke="#67e8f9" strokeWidth="1.5" />
            <circle cx="107" cy="110" r="8" fill="#fbbf24" />
            {/* Barrera Levadiza con Semáforo Verde */}
            <line x1="150" y1="140" x2="200" y2="140" stroke="#10b981" strokeWidth="4" strokeLinecap="round" />
            <circle cx="150" cy="140" r="5" fill="#22c55e" />
            <text x="107" y="180" fill="#bae6fd" fontSize="9" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
              GARITA (IGW)
            </text>
            <text x="107" y="193" fill="#34d399" fontSize="8" fontFamily="monospace" textAnchor="middle">
              Acceso Público
            </text>

            {/* Tráfico entrando por la garita */}
            <path d="M 10 140 L 65 140 M 150 140 L 210 140" stroke="#38bdf8" strokeWidth="2.5" strokeDasharray="4 4" className={styles.animatedPath} />

            {/* 1.2 Subred Pública (Área Comercial / Web Server) */}
            <rect x="210" y="55" width="130" height="165" rx="14" fill="rgba(6, 182, 212, 0.12)" stroke="#06b6d4" strokeWidth="1.5" />
            <rect x="225" y="45" width="100" height="18" rx="4" fill="#083344" stroke="#06b6d4" strokeWidth="1" />
            <text x="275" y="58" fill="#67e8f9" fontSize="9" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
              SUBRED PÚBLICA
            </text>
            
            {/* Casa / Local Comercial Frontal */}
            <polygon points="275,80 240,105 310,105" fill="#0e7490" stroke="#22d3ee" strokeWidth="1.5" />
            <rect x="245" y="105" width="60" height="50" fill="rgba(15, 23, 42, 0.9)" stroke="#22d3ee" strokeWidth="1.5" />
            <rect x="265" y="125" width="20" height="30" fill="#38bdf8" opacity="0.8" />
            <text x="275" y="180" fill="#94a3b8" fontSize="8" fontFamily="sans-serif" textAnchor="middle">
              Catálogo Web
            </text>

            {/* Camino Conector Interno */}
            <path d="M 340 140 L 375 140" stroke="#8b5cf6" strokeWidth="3" strokeDasharray="5 3" className={styles.animatedPath} />

            {/* 1.3 Subred Privada (Residencias Protegidas / Base de Datos Vault) */}
            <rect x="365" y="55" width="120" height="165" rx="14" fill="rgba(139, 92, 246, 0.15)" stroke="#a855f7" strokeWidth="2" />
            <rect x="375" y="45" width="100" height="18" rx="4" fill="#3b0764" stroke="#a855f7" strokeWidth="1" />
            <text x="425" y="58" fill="#e9d5ff" fontSize="9" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
              SUBRED PRIVADA
            </text>

            {/* Casa Residencial Interna Segura */}
            <polygon points="425,80 395,105 455,105" fill="#7e22ce" stroke="#c084fc" strokeWidth="1.5" />
            <rect x="400" y="105" width="50" height="50" fill="rgba(15, 23, 42, 0.95)" stroke="#c084fc" strokeWidth="1.5" />
            {/* Candado de Seguridad Privada */}
            <rect x="418" y="125" width="14" height="12" rx="3" fill="#f0abfc" />
            <path d="M 421 125 L 421 120 C 421 116, 429 116, 429 120 L 429 125" fill="none" stroke="#f0abfc" strokeWidth="1.5" />
            <text x="425" y="180" fill="#34d399" fontSize="8" fontFamily="sans-serif" textAnchor="middle">
              DBs / NAT Gateway
            </text>
          </svg>
        )}

        {/* ============================================================
            2.1 MAGO MERLÍN & LA SABIDURÍA INTERIOR (Enseñanza del Miedo y la Armadura)
           ============================================================ */}
        {artwork === 'merlin_wizard_wisdom' && (
          <svg
            viewBox="0 0 540 290"
            style={{
              width: '100%',
              maxWidth: '500px',
              height: 'auto',
              filter: 'drop-shadow(0 15px 35px rgba(139, 92, 246, 0.45))',
            }}
          >
            <defs>
              <linearGradient id="merlinRobeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#8b5cf6" />
                <stop offset="50%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#1e1b4b" />
              </linearGradient>
              <linearGradient id="merlinHatGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#c084fc" />
                <stop offset="60%" stopColor="#7c3aed" />
                <stop offset="100%" stopColor="#4c1d95" />
              </linearGradient>
              <linearGradient id="staffCrystalGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#67e8f9" />
                <stop offset="50%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#a855f7" />
              </linearGradient>
              <radialGradient id="wisdomAura" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(192, 132, 252, 0.45)" />
                <stop offset="60%" stopColor="rgba(56, 189, 248, 0.2)" />
                <stop offset="100%" stopColor="transparent" />
              </radialGradient>
            </defs>

            {/* Aura Mística de Sabiduría y Autoconocimiento */}
            <circle cx="270" cy="140" r="120" fill="url(#wisdomAura)" />
            <circle cx="270" cy="140" r="95" fill="none" stroke="#c084fc" strokeWidth="1.5" strokeDasharray="6 5" opacity="0.6" />
            <circle cx="270" cy="140" r="70" fill="none" stroke="#38bdf8" strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />

            {/* Constelaciones & Estrellas Guía de Fondo */}
            <polygon points="100,50 103,58 111,58 105,63 107,71 100,66 93,71 95,63 89,58 97,58" fill="#fde047" opacity="0.8" />
            <polygon points="440,65 442,71 448,71 443,75 445,81 440,77 435,81 437,75 432,71 438,71" fill="#67e8f9" opacity="0.8" />
            <polygon points="410,180 412,185 418,185 413,189 415,195 410,191 405,195 407,189 402,185 408,185" fill="#fde047" opacity="0.7" />

            {/* Silueta de Búho Sabio / Animal del Bosque (Compañero de Merlín) */}
            <g transform="translate(90, 110)">
              <ellipse cx="30" cy="45" rx="18" ry="24" fill="rgba(30, 41, 59, 0.95)" stroke="#fbbf24" strokeWidth="1.5" />
              <circle cx="23" cy="35" r="5" fill="#fde047" />
              <circle cx="23" cy="35" r="2" fill="#0f172a" />
              <circle cx="37" cy="35" r="5" fill="#fde047" />
              <circle cx="37" cy="35" r="2" fill="#0f172a" />
              <polygon points="30,40 27,45 33,45" fill="#f59e0b" />
              {/* Ramita */}
              <line x1="5" y1="68" x2="55" y2="68" stroke="#78350f" strokeWidth="3" strokeLinecap="round" />
              <text x="30" y="85" fill="#94a3b8" fontSize="8" fontFamily="monospace" textAnchor="middle">BÚHO GUÍA</text>
            </g>

            {/* --- FIGURA DE MERLÍN EL SABIO --- */}
            {/* Túnica Mágica */}
            <path
              d="M 230 140 Q 200 240 190 250 L 330 250 Q 320 240 290 140 Z"
              fill="url(#merlinRobeGrad)"
              stroke="#a855f7"
              strokeWidth="2.5"
            />
            {/* Cuello y Ribetes Rúnicos */}
            <path d="M 230 140 Q 260 160 290 140" fill="none" stroke="#fde047" strokeWidth="2" />
            <line x1="260" y1="150" x2="260" y2="250" stroke="#fde047" strokeWidth="1.5" strokeDasharray="3 3" />

            {/* Barba Larga Plateada / Blanca de Sabiduría */}
            <path
              d="M 240 115 Q 260 175 260 195 Q 260 175 280 115 Z"
              fill="rgba(241, 245, 249, 0.95)"
              stroke="#cbd5e1"
              strokeWidth="1.5"
            />

            {/* Rostro Sabio y Ojos Serenos */}
            <circle cx="260" cy="110" r="20" fill="#fed7aa" />
            <circle cx="253" cy="107" r="2.5" fill="#1e1b4b" />
            <circle cx="267" cy="107" r="2.5" fill="#1e1b4b" />
            <path d="M 255 118 Q 260 122 265 118" fill="none" stroke="#9a3412" strokeWidth="1.5" />

            {/* Sombrero Puntiagudo de Mago con Estrellas */}
            <polygon points="260,25 220,95 300,95" fill="url(#merlinHatGrad)" stroke="#c084fc" strokeWidth="2.5" />
            <ellipse cx="260" cy="95" rx="46" ry="10" fill="#581c87" stroke="#c084fc" strokeWidth="2" />
            {/* Estrellas en el Sombrero */}
            <polygon points="260,50 262,55 267,55 263,58 265,63 260,60 255,63 257,58 253,55 258,55" fill="#fde047" />
            <polygon points="270,75 271,78 275,78 272,80 273,84 270,82 267,84 268,80 265,78 269,78" fill="#67e8f9" />

            {/* --- BÁCULO MÁGICO DE MERLÍN (Cristal de Sabiduría) --- */}
            {/* Vara de Madera Antigua */}
            <line x1="330" y1="250" x2="330" y2="70" stroke="#78350f" strokeWidth="5" strokeLinecap="round" />
            <path d="M 330 85 Q 345 75 330 65 Q 315 75 330 85 Z" fill="#b45309" stroke="#d97706" strokeWidth="1.5" />
            
            {/* Gema / Cristal de Sabiduría en la Punta del Báculo */}
            <polygon points="330,42 342,60 330,78 318,60" fill="url(#staffCrystalGlow)" stroke="#67e8f9" strokeWidth="2" />
            <circle
              cx="330"
              cy="60"
              r="18"
              fill="none"
              stroke="#38bdf8"
              strokeWidth="1.5"
              strokeDasharray="4 3"
              transform={`rotate(${pulse * 3.6} 330 60)`}
            />
            {/* Rayos de Luz Mágica emergiendo del Cristal */}
            <line x1="330" y1="40" x2="330" y2="20" stroke="#67e8f9" strokeWidth="2" strokeDasharray="3 3" className={styles.animatedPath} />
            <line x1="345" y1="50" x2="370" y2="35" stroke="#fde047" strokeWidth="2" strokeDasharray="3 3" className={styles.animatedPath} />
            <line x1="315" y1="50" x2="290" y2="35" stroke="#fde047" strokeWidth="2" strokeDasharray="3 3" className={styles.animatedPath} />

            {/* --- METÁFORA VISUAL: TRANSMUTACIÓN DEL MIEDO --- */}
            <g transform="translate(370, 105)">
              <rect x="0" y="0" width="135" height="60" rx="10" fill="rgba(15, 23, 42, 0.9)" stroke="#818cf8" strokeWidth="1.5" />
              <text x="67" y="22" fill="#fca5a5" fontSize="8.5" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                ⛓️ MIEDO = ARMADURA
              </text>
              <path d="M 20 38 L 115 38" stroke="#f43f5e" strokeWidth="2" strokeDasharray="3 2" />
              <text x="67" y="50" fill="#34d399" fontSize="8.5" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                ✨ AUTOCONOCIMIENTO
              </text>
            </g>

            {/* Título de la Ilustración */}
            <text x="270" y="278" fill="#fde047" fontSize="11" fontFamily="serif" fontWeight="bold" textAnchor="middle" letterSpacing="1">
              MERLÍN · "EL MIEDO CREÓ LA ARMADURA"
            </text>
          </svg>
        )}

        {/* ============================================================
            2.2 EL HERRERO & EL DILEMA DEL YELMO OXIDADO
           ============================================================ */}
        {artwork === 'blacksmith_helmet_dilemma' && (
          <svg
            viewBox="0 0 520 280"
            style={{
              width: '100%',
              maxWidth: '480px',
              height: 'auto',
              filter: 'drop-shadow(0 15px 35px rgba(245, 158, 11, 0.45))',
            }}
          >
            <defs>
              <linearGradient id="anvilGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#475569" />
                <stop offset="50%" stopColor="#334155" />
                <stop offset="100%" stopColor="#0f172a" />
              </linearGradient>
              <linearGradient id="rustedMetalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#9a3412" />
                <stop offset="50%" stopColor="#78350f" />
                <stop offset="100%" stopColor="#451a03" />
              </linearGradient>
              <radialGradient id="forgeHeat" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(239, 68, 68, 0.5)" />
                <stop offset="50%" stopColor="rgba(245, 158, 11, 0.25)" />
                <stop offset="100%" stopColor="transparent" />
              </radialGradient>
            </defs>

            {/* Resplandor de la Forja */}
            <circle cx="260" cy="140" r="110" fill="url(#forgeHeat)" />

            {/* Chispas incandescentes de impacto */}
            <polygon points="260,95 264,100 270,95 265,102 268,108 262,104 256,108 259,102 254,95 260,100" fill="#fde047" />
            <polygon points="230,85 233,90 238,88 234,93 236,98 231,95 227,98 229,93 225,89 230,90" fill="#fb923c" />
            <polygon points="290,85 293,90 298,88 294,93 296,98 291,95 287,98 289,93 285,89 290,90" fill="#fb923c" />

            {/* --- YUNQUE DEL HERRERO --- */}
            <path
              d="M 180 180 L 150 180 C 130 180 120 190 110 200 L 170 200 L 170 240 L 350 240 L 350 200 L 410 200 C 400 190 390 180 370 180 L 340 180 L 320 160 L 200 160 Z"
              fill="url(#anvilGrad)"
              stroke="#64748b"
              strokeWidth="2.5"
            />
            {/* Base del Yunque */}
            <rect x="150" y="240" width="220" height="20" rx="4" fill="#1e293b" stroke="#475569" strokeWidth="2" />

            {/* --- YELMO OXIDADO ATASCADO SOBRE EL YUNQUE --- */}
            <path
              d="M 225 140 C 225 90 295 90 295 140 L 295 165 C 295 175 225 175 225 165 Z"
              fill="url(#rustedMetalGrad)"
              stroke="#ea580c"
              strokeWidth="2.5"
            />
            {/* Manchas de óxido y remaches cerrados */}
            <circle cx="240" cy="120" r="3" fill="#451a03" />
            <circle cx="280" cy="125" r="3.5" fill="#451a03" />
            <circle cx="260" cy="105" r="2.5" fill="#451a03" />
            {/* Visor bloqueado */}
            <rect x="235" y="130" width="50" height="9" rx="3" fill="#1e293b" stroke="#b45309" strokeWidth="1.5" />
            <line x1="260" y1="128" x2="260" y2="140" stroke="#ea580c" strokeWidth="2" />

            {/* --- MARTILLO DEL HERRERO GOLPEANDO --- */}
            <g transform={`rotate(${-15 + Math.sin(pulse * 0.2) * 20} 340 80)`}>
              {/* Mango de Madera */}
              <line x1="340" y1="80" x2="420" y2="30" stroke="#78350f" strokeWidth="6" strokeLinecap="round" />
              {/* Cabeza de Hierro del Martillo */}
              <rect x="315" y="65" width="45" height="30" rx="4" fill="#334155" stroke="#94a3b8" strokeWidth="2.5" />
            </g>

            {/* Tenazas Sujetando el Yelmo */}
            <path d="M 170 145 L 230 150 M 170 160 L 230 155" stroke="#64748b" strokeWidth="3" strokeLinecap="round" />

            {/* Badge de Frustración / Metáfora */}
            <rect x="30" y="45" width="160" height="50" rx="8" fill="rgba(15, 23, 42, 0.95)" stroke="#ea580c" strokeWidth="1.5" />
            <text x="110" y="65" fill="#fdba74" fontSize="9" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
              🔨 FUERZA INÚTIL
            </text>
            <text x="110" y="82" fill="#cbd5e1" fontSize="8" fontFamily="sans-serif" textAnchor="middle">
              El yelmo no cede a golpes
            </text>

            <text x="260" y="275" fill="#fbbf24" fontSize="11" fontFamily="serif" fontWeight="bold" textAnchor="middle" letterSpacing="1">
              EL DILEMA DEL YELMO · LA ARMADURA ATRAPADA
            </text>
          </svg>
        )}

        {/* ============================================================
            2.3 EL SENDERO DE LA VERDAD & LOS CASTILLOS
           ============================================================ */}
        {artwork === 'truth_path_castles' && (
          <svg
            viewBox="0 0 520 280"
            style={{
              width: '100%',
              maxWidth: '480px',
              height: 'auto',
              filter: 'drop-shadow(0 15px 35px rgba(139, 92, 246, 0.45))',
            }}
          >
            <defs>
              <linearGradient id="mountainGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#312e81" />
                <stop offset="50%" stopColor="#1e1b4b" />
                <stop offset="100%" stopColor="#0f172a" />
              </linearGradient>
              <linearGradient id="truthPathGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#06b6d4" />
                <stop offset="50%" stopColor="#a855f7" />
                <stop offset="100%" stopColor="#fde047" />
              </linearGradient>
            </defs>

            {/* Sol Radiante en la Cima */}
            <circle cx="390" cy="45" r="28" fill="#fde047" opacity="0.9" />
            <circle cx="390" cy="45" r="42" fill="none" stroke="#fde047" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.6" />

            {/* Montañas del Sendero */}
            <polygon points="30,250 180,90 310,250" fill="url(#mountainGrad)" stroke="#4338ca" strokeWidth="2" />
            <polygon points="180,250 390,50 510,250" fill="url(#mountainGrad)" stroke="#6366f1" strokeWidth="2" />

            {/* Sendero Empinado Serpenteante */}
            <path
              d="M 60 250 Q 140 210 130 175 T 240 130 T 310 90 T 390 55"
              fill="none"
              stroke="url(#truthPathGrad)"
              strokeWidth="5"
              strokeLinecap="round"
            />
            <path
              d="M 60 250 Q 140 210 130 175 T 240 130 T 310 90 T 390 55"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2"
              strokeDasharray="4 6"
              className={styles.animatedPath}
            />

            {/* Castillo 1: Silencio */}
            <g transform="translate(100, 150)">
              <rect x="0" y="0" width="30" height="25" fill="#1e1b4b" stroke="#38bdf8" strokeWidth="1.5" />
              <polygon points="0,0 15,-12 30,0" fill="#0284c7" stroke="#38bdf8" strokeWidth="1" />
              <circle cx="15" cy="12" r="3" fill="#fde047" />
              <text x="15" y="36" fill="#7dd3fc" fontSize="7.5" fontFamily="monospace" fontWeight="bold" textAnchor="middle">1. SILENCIO</text>
            </g>

            {/* Castillo 2: Conocimiento */}
            <g transform="translate(225, 105)">
              <rect x="0" y="0" width="30" height="25" fill="#1e1b4b" stroke="#c084fc" strokeWidth="1.5" />
              <polygon points="0,0 15,-12 30,0" fill="#7c3aed" stroke="#c084fc" strokeWidth="1" />
              <circle cx="15" cy="12" r="3" fill="#fde047" />
              <text x="15" y="36" fill="#e9d5ff" fontSize="7.5" fontFamily="monospace" fontWeight="bold" textAnchor="middle">2. SABIDURÍA</text>
            </g>

            {/* Castillo 3: Valentía */}
            <g transform="translate(295, 65)">
              <rect x="0" y="0" width="30" height="25" fill="#1e1b4b" stroke="#f43f5e" strokeWidth="1.5" />
              <polygon points="0,0 15,-12 30,0" fill="#be123c" stroke="#f43f5e" strokeWidth="1" />
              <circle cx="15" cy="12" r="3" fill="#fde047" />
              <text x="15" y="36" fill="#fda4af" fontSize="7.5" fontFamily="monospace" fontWeight="bold" textAnchor="middle">3. VALENTÍA</text>
            </g>

            {/* Silueta del Caballero Peregrino Subiendo */}
            <circle cx="75" cy="235" r="6" fill="#fde047" stroke="#ffffff" strokeWidth="1" />
            <line x1="75" y1="241" x2="75" y2="252" stroke="#fde047" strokeWidth="2.5" />
            <line x1="75" y1="245" x2="85" y2="240" stroke="#fde047" strokeWidth="2" />

            <text x="260" y="275" fill="#fde047" fontSize="11" fontFamily="serif" fontWeight="bold" textAnchor="middle" letterSpacing="1">
              EL SENDERO DE LA VERDAD HACIA LA CIMA
            </text>
          </svg>
        )}

        {/* ============================================================
            2.4 CABALLERO MEDIEVAL CON ARMADURA & ESPADA
           ============================================================ */}
        {artwork === 'knight_armor' && (
          <svg
            viewBox="0 0 500 290"
            style={{
              width: '100%',
              maxWidth: '460px',
              height: 'auto',
              filter: 'drop-shadow(0 15px 35px rgba(245, 158, 11, 0.45))',
            }}
          >
            <defs>
              <linearGradient id="armorSteel" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="35%" stopColor="#cbd5e1" />
                <stop offset="70%" stopColor="#64748b" />
                <stop offset="100%" stopColor="#334155" />
              </linearGradient>
              <linearGradient id="goldFiligree" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="50%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#b45309" />
              </linearGradient>
              <radialGradient id="heartPulse" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#f43f5e" stopOpacity="1" />
                <stop offset="70%" stopColor="#ec4899" stopOpacity="0.8" />
                <stop offset="100%" stopColor="transparent" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Halo de Nobleza */}
            <circle cx="250" cy="135" r="115" fill="rgba(245, 158, 11, 0.08)" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="6 4" />
            <circle cx="250" cy="135" r="85" fill="rgba(139, 92, 246, 0.12)" />

            {/* Espada Medieval Cruzada */}
            <line x1="120" y1="250" x2="380" y2="40" stroke="#f1f5f9" strokeWidth="5" strokeLinecap="round" />
            <line x1="110" y1="240" x2="150" y2="270" stroke="url(#goldFiligree)" strokeWidth="7" strokeLinecap="round" />
            <circle cx="108" cy="255" r="8" fill="#f59e0b" />

            {/* Escudo Heráldico a la Izquierda */}
            <path d="M 130 90 L 190 90 L 180 170 C 180 200, 130 220, 130 220 C 130 220, 80 200, 80 170 L 70 90 Z" fill="rgba(15, 23, 42, 0.95)" stroke="url(#goldFiligree)" strokeWidth="2.5" />
            <polygon points="130,110 135,125 150,125 138,135 142,150 130,140 118,150 122,135 110,125 125,125" fill="#fde047" />

            {/* Hombreras de Acero con Remaches */}
            <path d="M 180 150 C 160 110, 210 90, 230 105 Z" fill="url(#armorSteel)" stroke="#ffffff" strokeWidth="2.5" />
            <path d="M 320 150 C 340 110, 290 90, 270 105 Z" fill="url(#armorSteel)" stroke="#ffffff" strokeWidth="2.5" />

            {/* Coraza / Pectoral de Armadura */}
            <path d="M 195 115 L 305 115 L 290 225 L 250 255 L 210 225 Z" fill="url(#armorSteel)" stroke="#f8fafc" strokeWidth="3" />
            <path d="M 220 125 L 250 165 L 280 125" fill="none" stroke="url(#goldFiligree)" strokeWidth="2.5" />
            <path d="M 250 165 L 250 240" fill="none" stroke="url(#goldFiligree)" strokeWidth="2.5" />

            {/* Corazón Palpitando dentro de la Armadura */}
            <circle
              cx="250"
              cy="180"
              r="17"
              fill="url(#heartPulse)"
              style={{
                transform: `scale(${1 + Math.sin(pulse * 0.1) * 0.2})`,
                transformOrigin: '250px 180px',
              }}
            />

            {/* Yelmo de Caballero Medieval con Penacho */}
            <path d="M 210 75 C 210 30, 290 30, 290 75 L 290 105 C 290 118, 210 118, 210 105 Z" fill="url(#armorSteel)" stroke="#ffffff" strokeWidth="2.5" />
            <path d="M 250 30 C 235 5, 285 -5, 305 10 C 285 22, 270 26, 250 30" fill="url(#goldFiligree)" stroke="#fbbf24" strokeWidth="2" />
            
            {/* Visor con Destello de Mirada Azul */}
            <rect x="220" y="70" width="60" height="11" rx="5" fill="#38bdf8" />
            <line x1="250" y1="68" x2="250" y2="84" stroke="#0284c7" strokeWidth="2.5" />

            <text x="250" y="278" fill="#fbbf24" fontSize="11" fontFamily="serif" fontWeight="bold" textAnchor="middle" letterSpacing="1">
              EL CABALLERO Y LA ARMADURA
            </text>
          </svg>
        )}

        {/* ============================================================
            3. LIBERACIÓN DEL CABALLERO (Desprendimiento & Sol)
           ============================================================ */}
        {artwork === 'knight_liberation' && (
          <svg viewBox="0 0 480 270" style={{ width: '100%', maxWidth: '440px', height: 'auto', filter: 'drop-shadow(0 15px 35px rgba(251, 191, 36, 0.45))' }}>
            <circle cx="240" cy="100" r="55" fill="#fde047" opacity="0.95" />
            <circle cx="240" cy="100" r="85" fill="rgba(251, 191, 36, 0.25)" />
            
            {/* Rayos Solares */}
            <line x1="240" y1="25" x2="240" y2="5" stroke="#f59e0b" strokeWidth="3.5" strokeDasharray="4 4" />
            <line x1="310" y1="55" x2="335" y2="35" stroke="#f59e0b" strokeWidth="3.5" strokeDasharray="4 4" />
            <line x1="170" y1="55" x2="145" y2="35" stroke="#f59e0b" strokeWidth="3.5" strokeDasharray="4 4" />

            {/* Trozos de Armadura Oxidada Desprendiéndose */}
            <path d="M 140 145 L 165 120 L 175 155 Z" fill="#78350f" stroke="#b45309" strokeWidth="2" transform={`rotate(${pulse * 1.5} 155 140)`} />
            <path d="M 320 145 L 345 120 L 335 155 Z" fill="#78350f" stroke="#b45309" strokeWidth="2" transform={`rotate(${-pulse * 1.5} 330 140)`} />

            {/* Corazón Libre y Radiante */}
            <path
              d="M 240 150 C 215 120, 180 145, 205 180 L 240 215 L 275 180 C 300 145, 265 120, 240 150 Z"
              fill="#f43f5e"
              stroke="#fb7185"
              strokeWidth="3"
              style={{
                transform: `scale(${1 + Math.sin(pulse * 0.1) * 0.15})`,
                transformOrigin: '240px 175px',
              }}
            />
            <text x="240" y="245" fill="#fde047" fontSize="12" fontFamily="serif" fontWeight="bold" textAnchor="middle">
              CORAZÓN LIBRE · CAÍDA DE LA ARMADURA
            </text>
          </svg>
        )}

        {/* ============================================================
            4. CASTILLO MEDIEVAL DEL SILENCIO
           ============================================================ */}
        {artwork === 'castle_silence' && (
          <svg viewBox="0 0 480 260" style={{ width: '100%', maxWidth: '420px', height: 'auto' }}>
            <circle cx="380" cy="55" r="28" fill="#fef08a" />
            <circle cx="392" cy="49" r="24" fill="#07090e" />

            {/* Muralla Principal */}
            <rect x="140" y="105" width="200" height="120" fill="rgba(30, 41, 59, 0.95)" stroke="#64748b" strokeWidth="2.5" />
            
            {/* Almenas de la Muralla */}
            <rect x="150" y="90" width="20" height="20" fill="#334155" stroke="#64748b" strokeWidth="1.5" />
            <rect x="185" y="90" width="20" height="20" fill="#334155" stroke="#64748b" strokeWidth="1.5" />
            <rect x="220" y="90" width="20" height="20" fill="#334155" stroke="#64748b" strokeWidth="1.5" />
            <rect x="255" y="90" width="20" height="20" fill="#334155" stroke="#64748b" strokeWidth="1.5" />
            <rect x="290" y="90" width="20" height="20" fill="#334155" stroke="#64748b" strokeWidth="1.5" />

            {/* Torres Laterales */}
            <rect x="95" y="75" width="60" height="150" fill="rgba(15, 23, 42, 0.98)" stroke="#64748b" strokeWidth="2.5" />
            <polygon points="95,75 125,30 155,75" fill="#8b5cf6" stroke="#c084fc" strokeWidth="2" />

            <rect x="325" y="75" width="60" height="150" fill="rgba(15, 23, 42, 0.98)" stroke="#64748b" strokeWidth="2.5" />
            <polygon points="325,75 355,30 385,75" fill="#8b5cf6" stroke="#c084fc" strokeWidth="2" />

            {/* Ventanas Iluminadas */}
            <rect x="115" y="105" width="18" height="26" rx="9" fill="#fbbf24" opacity="0.9" />
            <rect x="345" y="105" width="18" height="26" rx="9" fill="#fbbf24" opacity="0.9" />
            
            {/* Puerta Principal del Castillo con Puente Levadizo */}
            <path d="M 215 225 L 215 160 C 215 140, 265 140, 265 160 L 265 225 Z" fill="#0f172a" stroke="#d97706" strokeWidth="2.5" />
            <text x="240" y="250" fill="#cbd5e1" fontSize="10" fontFamily="serif" textAnchor="middle">
              EL CASTILLO DEL SILENCIO
            </text>
          </svg>
        )}

        {/* ============================================================
            5. RACK DE SERVIDORES FÍSICOS VS NUBE (Caos de Fibra Óptica vs OCI)
           ============================================================ */}
        {artwork === 'server_rack_cables' && (
          <svg
            viewBox="0 0 540 280"
            style={{
              width: '100%',
              maxWidth: '520px',
              height: 'auto',
              filter: 'drop-shadow(0 15px 35px rgba(239, 68, 68, 0.25))',
            }}
          >
            <defs>
              <linearGradient id="rackSteelGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#1e293b" />
                <stop offset="50%" stopColor="#0f172a" />
                <stop offset="100%" stopColor="#020617" />
              </linearGradient>
              <linearGradient id="fiberGlowOrange" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fb923c" />
                <stop offset="100%" stopColor="#ea580c" />
              </linearGradient>
              <linearGradient id="fiberGlowCyan" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#0284c7" />
              </linearGradient>
              <linearGradient id="fiberGlowYellow" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="100%" stopColor="#eab308" />
              </linearGradient>
              <linearGradient id="cloudOciGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(6, 182, 212, 0.35)" />
                <stop offset="100%" stopColor="rgba(139, 92, 246, 0.3)" />
              </linearGradient>
            </defs>

            {/* 5.1 GABINETE RACK FÍSICO 42U (Izquierda) */}
            <g transform="translate(15, 20)">
              {/* Armazón del Rack Metálico */}
              <rect x="0" y="0" width="165" height="230" rx="10" fill="url(#rackSteelGrad)" stroke="#475569" strokeWidth="2.5" />
              <rect x="6" y="6" width="153" height="218" rx="6" fill="#090d16" stroke="#334155" strokeWidth="1" />

              {/* Rieles Laterales Perforados */}
              <line x1="16" y1="12" x2="16" y2="218" stroke="#1e293b" strokeWidth="3" strokeDasharray="3 4" />
              <line x1="149" y1="12" x2="149" y2="218" stroke="#1e293b" strokeWidth="3" strokeDasharray="3 4" />

              {/* Servidor Blade 1 (Superior) */}
              <rect x="22" y="16" width="121" height="34" rx="4" fill="#1e293b" stroke="#64748b" strokeWidth="1.5" />
              {/* Puertos de Fibra Óptica LC / SFP */}
              <rect x="28" y="24" width="8" height="6" fill="#38bdf8" />
              <rect x="38" y="24" width="8" height="6" fill="#38bdf8" />
              <rect x="48" y="24" width="8" height="6" fill="#fb923c" />
              <rect x="58" y="24" width="8" height="6" fill="#fb923c" />
              {/* LEDs de Actividad */}
              <circle cx="118" cy="27" r="2.5" fill="#22c55e" />
              <circle cx="126" cy="27" r="2.5" fill="#ef4444" className={styles.pulseNode} />
              <circle cx="134" cy="27" r="2.5" fill="#f59e0b" />
              {/* Rejilla de ventilación */}
              <line x1="72" y1="23" x2="108" y2="23" stroke="#334155" strokeWidth="1.5" strokeDasharray="2 2" />
              <line x1="72" y1="29" x2="108" y2="29" stroke="#334155" strokeWidth="1.5" strokeDasharray="2 2" />

              {/* Patch Panel Central (Distribuidor de Fibra) */}
              <rect x="22" y="56" width="121" height="30" rx="4" fill="#0f172a" stroke="#475569" strokeWidth="1.5" />
              {/* 12 Puertos de Patch Panel */}
              <rect x="28" y="65" width="5" height="10" fill="#0284c7" />
              <rect x="36" y="65" width="5" height="10" fill="#0284c7" />
              <rect x="44" y="65" width="5" height="10" fill="#eab308" />
              <rect x="52" y="65" width="5" height="10" fill="#eab308" />
              <rect x="60" y="65" width="5" height="10" fill="#ea580c" />
              <rect x="68" y="65" width="5" height="10" fill="#ea580c" />
              <rect x="76" y="65" width="5" height="10" fill="#22c55e" />
              <rect x="84" y="65" width="5" height="10" fill="#22c55e" />
              <rect x="92" y="65" width="5" height="10" fill="#a855f7" />
              <rect x="100" y="65" width="5" height="10" fill="#a855f7" />
              <rect x="108" y="65" width="5" height="10" fill="#ef4444" />
              <rect x="116" y="65" width="5" height="10" fill="#ef4444" />

              {/* Servidor Blade 2 (Medio) */}
              <rect x="22" y="92" width="121" height="34" rx="4" fill="#1e293b" stroke="#64748b" strokeWidth="1.5" />
              <rect x="28" y="100" width="8" height="6" fill="#eab308" />
              <rect x="38" y="100" width="8" height="6" fill="#eab308" />
              <circle cx="120" cy="103" r="2.5" fill="#22c55e" />
              <circle cx="128" cy="103" r="2.5" fill="#22c55e" />
              <circle cx="136" cy="103" r="2.5" fill="#ef4444" className={styles.pulseNode} />

              {/* Servidor Blade 3 (Storage SAN) */}
              <rect x="22" y="132" width="121" height="34" rx="4" fill="#1e293b" stroke="#64748b" strokeWidth="1.5" />
              <rect x="28" y="140" width="18" height="18" rx="2" fill="#0f172a" stroke="#38bdf8" strokeWidth="1" />
              <rect x="50" y="140" width="18" height="18" rx="2" fill="#0f172a" stroke="#38bdf8" strokeWidth="1" />
              <rect x="72" y="140" width="18" height="18" rx="2" fill="#0f172a" stroke="#38bdf8" strokeWidth="1" />
              <circle cx="128" cy="149" r="3" fill="#f59e0b" />

              {/* Unidad de Energía UPS / Distribución */}
              <rect x="22" y="172" width="121" height="32" rx="4" fill="#0f172a" stroke="#334155" strokeWidth="1.5" />
              <text x="82" y="192" fill="#64748b" fontSize="8" fontFamily="monospace" textAnchor="middle">42U HARDWARE SAN</text>

              {/* SPAGHETTI DENSO DE CABLES DE FIBRA ÓPTICA Y COBRE */}
              {/* Cable 1: Fibra Naranja Multimodo */}
              <path d="M 52 30 C 8 70, 15 150, 48 185 S 150 140, 110 75" fill="none" stroke="url(#fiberGlowOrange)" strokeWidth="2.5" strokeLinecap="round" />
              {/* Cable 2: Fibra Cian Monomodo */}
              <path d="M 32 30 C 0 90, 8 180, 55 145 S 155 80, 72 75" fill="none" stroke="url(#fiberGlowCyan)" strokeWidth="2.5" strokeLinecap="round" />
              {/* Cable 3: Fibra Amarilla OS2 */}
              <path d="M 42 30 Q -10 120, 32 105 T 104 75" fill="none" stroke="url(#fiberGlowYellow)" strokeWidth="2.5" strokeLinecap="round" />
              {/* Cable 4: Cable Rojo Crítico */}
              <path d="M 62 30 C 160 50, 150 130, 76 145 S 15 170, 88 75" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
              {/* Cable 5: Enlace Verde */}
              <path d="M 32 106 Q 160 110, 80 185 T 112 75" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />
              {/* Cable 6: Cascada Externa de Cables */}
              <path d="M 112 75 C 175 110, 160 210, 125 225" fill="none" stroke="#ea580c" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M 96 75 C 165 130, 150 220, 100 225" fill="none" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" />
              <path d="M 80 75 C 145 150, 130 230, 75 225" fill="none" stroke="#eab308" strokeWidth="2" strokeLinecap="round" />

              {/* Etiqueta Inferior */}
              <rect x="12" y="206" width="141" height="18" rx="4" fill="rgba(239, 68, 68, 0.2)" stroke="#ef4444" strokeWidth="1" />
              <text x="82" y="218" fill="#fca5a5" fontSize="8" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                ⚠️ KM DE FIBRA & HARDWARE
              </text>
            </g>

            {/* 5.2 FLUJO DE TRANSFORMACIÓN DIGITAL (Centro) */}
            <g transform="translate(195, 100)">
              {/* Haz de Luz y Flecha de Virtualización */}
              <path d="M 0 35 L 75 35" stroke="url(#cloudOciGrad)" strokeWidth="12" strokeLinecap="round" />
              <path d="M 0 35 L 75 35" stroke="#d946ef" strokeWidth="3" strokeDasharray="5 4" className={styles.animatedPath} />
              <polygon points="75,25 92,35 75,45" fill="#d946ef" />

              {/* Badge de Software Defined */}
              <rect x="0" y="2" width="85" height="18" rx="9" fill="#0f172a" stroke="#d946ef" strokeWidth="1.2" />
              <text x="42" y="14" fill="#f0abfc" fontSize="7.5" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                SDN VIRTUAL
              </text>
            </g>

            {/* 5.3 ARQUITECTURA ORACLE CLOUD VIRTUAL (Derecha) */}
            <g transform="translate(305, 20)">
              {/* Contenedor Nube OCI con Aura */}
              <circle cx="110" cy="115" r="105" fill="rgba(6, 182, 212, 0.08)" stroke="#06b6d4" strokeWidth="1.5" strokeDasharray="6 4" />
              <circle cx="110" cy="115" r="75" fill="rgba(139, 92, 246, 0.12)" />

              {/* Silueta de Nube OCI */}
              <path
                d="M 60 140 L 160 140 C 180 140, 195 125, 195 105 C 195 88, 182 74, 165 72 C 160 50, 138 35, 110 35 C 84 35, 62 50, 56 73 C 40 76, 28 90, 28 108 C 28 126, 42 140, 60 140 Z"
                fill="url(#cloudOciGrad)"
                stroke="#22d3ee"
                strokeWidth="2.5"
              />

              {/* Instancias Virtuales Flotantes en la Nube */}
              <rect x="65" y="75" width="40" height="24" rx="5" fill="rgba(15, 23, 42, 0.9)" stroke="#38bdf8" strokeWidth="1.5" />
              <circle cx="75" cy="87" r="3" fill="#22c55e" />
              <text x="92" y="90" fill="#bae6fd" fontSize="8" fontFamily="monospace" fontWeight="bold">VM 1</text>

              <rect x="115" y="75" width="40" height="24" rx="5" fill="rgba(15, 23, 42, 0.9)" stroke="#c084fc" strokeWidth="1.5" />
              <circle cx="125" cy="87" r="3" fill="#22c55e" />
              <text x="142" y="90" fill="#e9d5ff" fontSize="8" fontFamily="monospace" fontWeight="bold">VM 2</text>

              {/* Enlace Virtual Inmediato */}
              <line x1="105" y1="87" x2="115" y2="87" stroke="#34d399" strokeWidth="2" strokeDasharray="2 2" className={styles.animatedPath} />

              {/* Subredes Virtuales Definidas por Software */}
              <rect x="65" y="105" width="90" height="22" rx="4" fill="rgba(16, 185, 129, 0.15)" stroke="#34d399" strokeWidth="1.5" />
              <text x="110" y="119" fill="#34d399" fontSize="8.5" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                VCN · PROVISIÓN EN 3s
              </text>

              {/* Badge Cero Mantenimiento Físico */}
              <rect x="25" y="206" width="170" height="18" rx="4" fill="rgba(52, 211, 153, 0.15)" stroke="#34d399" strokeWidth="1" />
              <text x="110" y="218" fill="#34d399" fontSize="8.5" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                ✨ 100% SOFTWARE · CERO CABLES
              </text>
            </g>
          </svg>
        )}

        {/* ============================================================
            6. TRÁFICO, FIREWALL STATEFUL & SECURITY LISTS
           ============================================================ */}
        {artwork === 'traffic_waf' && (
          <svg viewBox="0 0 480 230" style={{ width: '100%', maxWidth: '440px', height: 'auto' }}>
            <circle cx="65" cy="115" r="30" fill="rgba(6, 182, 212, 0.15)" stroke="#22d3ee" strokeWidth="2" />
            <text x="65" y="115" fill="#22d3ee" fontSize="10" textAnchor="middle" fontFamily="monospace" fontWeight="bold">PUERTO</text>
            <text x="65" y="127" fill="#22d3ee" fontSize="10" textAnchor="middle" fontFamily="monospace" fontWeight="bold">443</text>

            <path d="M 105 95 L 185 110 M 105 115 L 185 115 M 105 135 L 185 120" stroke="#38bdf8" strokeWidth="2.5" strokeDasharray="4 4" className={styles.animatedPath} />

            {/* Barrera Security List / Stateful Firewall */}
            <rect x="200" y="45" width="45" height="140" rx="12" fill="rgba(139, 92, 246, 0.35)" stroke="#8b5cf6" strokeWidth="2.5" />
            <line x1="222" y1="55" x2="222" y2="175" stroke="#f0abfc" strokeWidth="2" strokeDasharray="3 3" />
            <circle cx="222" cy="115" r="10" fill="#10b981" />

            {/* Tráfico Autorizado Bidireccional */}
            <path d="M 255 115 L 335 115" stroke="#34d399" strokeWidth="3.5" strokeDasharray="6 3" className={styles.animatedPath} />
            
            <rect x="345" y="70" width="90" height="90" rx="12" fill="rgba(16, 185, 129, 0.15)" stroke="#34d399" strokeWidth="2" />
            <text x="390" y="112" fill="#34d399" fontSize="11" textAnchor="middle" fontFamily="monospace" fontWeight="bold">SERVIDOR</text>
            <text x="390" y="126" fill="#94a3b8" fontSize="9" textAnchor="middle" fontFamily="monospace">PROTEGIDO</text>
          </svg>
        )}

        {/* ============================================================
            7. AUTONOMOUS DATABASE & ÁRBOL B-TREE AUTO-TUNING
           ============================================================ */}
        {artwork === 'database_btree_autotuning' && (
          <svg viewBox="0 0 480 240" style={{ width: '100%', maxWidth: '440px', height: 'auto' }}>
            {/* Cilindros Base de Datos */}
            <ellipse cx="120" cy="70" rx="55" ry="18" fill="rgba(139, 92, 246, 0.4)" stroke="#8b5cf6" strokeWidth="2" />
            <path d="M 65 70 L 65 140 C 65 155, 175 155, 175 140 L 175 70" fill="rgba(139, 92, 246, 0.2)" stroke="#8b5cf6" strokeWidth="2" />
            <ellipse cx="120" cy="105" rx="55" ry="16" fill="none" stroke="#8b5cf6" strokeWidth="1.5" strokeDasharray="4 4" />
            <ellipse cx="120" cy="140" rx="55" ry="16" fill="none" stroke="#8b5cf6" strokeWidth="2" />
            <text x="120" y="110" fill="#d8b4fe" fontSize="10" fontFamily="monospace" textAnchor="middle" fontWeight="bold">AUTONOMOUS DB</text>

            {/* Ramificaciones del Árbol B-Tree Creadas en Caliente */}
            <circle cx="270" cy="75" r="16" fill="#0891b2" stroke="#22d3ee" strokeWidth="2" />
            <text x="270" y="79" fill="#ffffff" fontSize="9" fontFamily="monospace" textAnchor="middle">Root</text>
            
            <line x1="270" y1="91" x2="230" y2="135" stroke="#22d3ee" strokeWidth="2" />
            <line x1="270" y1="91" x2="310" y2="135" stroke="#22d3ee" strokeWidth="2" />

            <circle cx="230" cy="135" r="14" fill="#0284c7" stroke="#38bdf8" strokeWidth="2" />
            <text x="230" y="139" fill="#ffffff" fontSize="8" fontFamily="monospace" textAnchor="middle">Idx 1</text>
            
            <circle cx="310" cy="135" r="14" fill="#0284c7" stroke="#38bdf8" strokeWidth="2" />
            <text x="310" y="139" fill="#ffffff" fontSize="8" fontFamily="monospace" textAnchor="middle">Idx 2</text>

            {/* Velocímetro de Optimización (1200ms -> 2ms) */}
            <rect x="365" y="70" width="95" height="85" rx="10" fill="rgba(16, 185, 129, 0.15)" stroke="#34d399" strokeWidth="2" />
            <text x="412" y="95" fill="#f43f5e" fontSize="9" textDecoration="line-through" fontFamily="monospace" textAnchor="middle">1200 ms</text>
            <text x="412" y="125" fill="#34d399" fontSize="16" fontWeight="bold" fontFamily="monospace" textAnchor="middle">2 ms</text>
            <text x="412" y="142" fill="#94a3b8" fontSize="8" fontFamily="sans-serif" textAnchor="middle">Auto-Tuning IA</text>
          </svg>
        )}

        {/* ============================================================
            8. DATA SAFE & ENMASCARAMIENTO DE TARJETAS PCI-DSS
           ============================================================ */}
        {artwork === 'data_masking_safe' && (
          <svg viewBox="0 0 480 230" style={{ width: '100%', maxWidth: '440px', height: 'auto' }}>
            <rect x="60" y="60" width="160" height="100" rx="12" fill="rgba(244, 63, 94, 0.15)" stroke="#f43f5e" strokeWidth="2" />
            <text x="140" y="90" fill="#f43f5e" fontSize="10" fontFamily="monospace" fontWeight="bold" textAnchor="middle">PRODUCCIÓN REAL</text>
            <text x="140" y="120" fill="#ffffff" fontSize="12" fontFamily="monospace" fontWeight="bold" textAnchor="middle">4532 8812 9012 8842</text>

            <path d="M 230 110 L 290 110" stroke="#34d399" strokeWidth="3.5" strokeDasharray="5 3" className={styles.animatedPath} />

            <rect x="300" y="60" width="160" height="100" rx="12" fill="rgba(16, 185, 129, 0.15)" stroke="#34d399" strokeWidth="2" />
            <text x="380" y="90" fill="#34d399" fontSize="10" fontFamily="monospace" fontWeight="bold" textAnchor="middle">DATA SAFE MASKED</text>
            <text x="380" y="120" fill="#34d399" fontSize="13" fontFamily="monospace" fontWeight="bold" textAnchor="middle">**** **** **** 8842</text>
            <text x="270" y="195" fill="#bae6fd" fontSize="11" fontFamily="sans-serif" textAnchor="middle">
              Cumplimiento PCI-DSS sin exposición de datos reales
            </text>
          </svg>
        )}

        {/* ============================================================
            9. ARQUITECTURA CLOUD GENERAL
           ============================================================ */}
        {artwork === 'cloud_architecture_topology' && (
          <svg viewBox="0 0 480 240" style={{ width: '100%', maxWidth: '440px', height: 'auto' }}>
            <path
              d="M 170 190 L 330 190 C 370 190, 400 160, 400 125 C 400 95, 375 70, 345 68 C 335 30, 295 10, 250 10 C 205 10, 170 30, 155 65 C 120 70, 95 98, 95 130 C 95 165, 125 190, 170 190 Z"
              fill="rgba(6, 182, 212, 0.2)"
              stroke="#22d3ee"
              strokeWidth="3"
            />
            <circle cx="200" cy="115" r="22" fill="rgba(139, 92, 246, 0.5)" stroke="#c084fc" strokeWidth="2" />
            <text x="200" y="119" fill="#ffffff" fontSize="9" fontFamily="monospace" textAnchor="middle">VM 1</text>
            <circle cx="300" cy="115" r="22" fill="rgba(139, 92, 246, 0.5)" stroke="#c084fc" strokeWidth="2" />
            <text x="300" y="119" fill="#ffffff" fontSize="9" fontFamily="monospace" textAnchor="middle">VM 2</text>
            <line x1="222" y1="115" x2="278" y2="115" stroke="#38bdf8" strokeWidth="2.5" strokeDasharray="4 4" className={styles.animatedPath} />
            <text x="250" y="225" fill="#67e8f9" fontSize="11" fontFamily="monospace" textAnchor="middle">Topología Cloud Virtualizada</text>
          </svg>
        )}

        {/* ============================================================
            10. BIOLOGÍA CELULAR & ADN
           ============================================================ */}
        {artwork === 'science_biology' && (
          <svg viewBox="0 0 420 240" style={{ width: '100%', maxWidth: '380px', height: 'auto', filter: 'drop-shadow(0 15px 35px rgba(16, 185, 129, 0.35))' }}>
            <circle cx="210" cy="120" r="85" fill="rgba(16, 185, 129, 0.08)" stroke="#10b981" strokeWidth="2" strokeDasharray="4 4" />
            <ellipse cx="210" cy="120" rx="95" ry="35" fill="none" stroke="#10b981" strokeWidth="2.5" transform={`rotate(${-30 + Math.sin(pulse * 0.05) * 8} 210 120)`} />
            <ellipse cx="210" cy="120" rx="95" ry="35" fill="none" stroke="#06b6d4" strokeWidth="2.5" transform={`rotate(${30 - Math.sin(pulse * 0.05) * 8} 210 120)`} />
            <circle cx="210" cy="120" r="24" fill="rgba(16, 185, 129, 0.4)" stroke="#34d399" strokeWidth="3" />
            <circle cx="210" cy="120" r="10" fill="#ffffff" />
            <text x="210" y="228" fill="#34d399" fontSize="11" fontFamily="sans-serif" textAnchor="middle">Célula & ADN</text>
          </svg>
        )}

        {/* ============================================================
            11. FÍSICA, ESPACIO & PLANETAS
           ============================================================ */}
        {artwork === 'science_physics_space' && (
          <svg viewBox="0 0 420 240" style={{ width: '100%', maxWidth: '380px', height: 'auto', filter: 'drop-shadow(0 15px 35px rgba(139, 92, 246, 0.4))' }}>
            <circle cx="210" cy="120" r="90" fill="rgba(139, 92, 246, 0.1)" />
            <ellipse cx="210" cy="120" rx="110" ry="40" fill="none" stroke="#8b5cf6" strokeWidth="2" transform={`rotate(${pulse * 1.5} 210 120)`} />
            <ellipse cx="210" cy="120" rx="80" ry="80" fill="none" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="6 6" />
            <circle cx="210" cy="120" r="30" fill="rgba(245, 158, 11, 0.8)" stroke="#fef08a" strokeWidth="3" />
            <circle cx="310" cy="120" r="10" fill="#38bdf8" stroke="#ffffff" strokeWidth="1.5" />
          </svg>
        )}

        {/* ============================================================
            12. LIBROS, LITERATURA & HISTORIA
           ============================================================ */}
        {artwork === 'book_literature' && (
          <svg viewBox="0 0 420 240" style={{ width: '100%', maxWidth: '380px', height: 'auto', filter: 'drop-shadow(0 15px 35px rgba(245, 158, 11, 0.35))' }}>
            <circle cx="210" cy="120" r="90" fill="rgba(245, 158, 11, 0.12)" />
            <path d="M 90 175 Q 210 195, 330 175 L 320 75 Q 210 95, 100 75 Z" fill="#78350f" stroke="#b45309" strokeWidth="2.5" />
            <path d="M 100 80 Q 210 95, 210 170 Q 150 160, 100 170 Z" fill="#fef3c7" stroke="#d97706" strokeWidth="2" />
            <path d="M 320 80 Q 210 95, 210 170 Q 270 160, 320 170 Z" fill="#fef3c7" stroke="#d97706" strokeWidth="2" />
            <line x1="120" y1="100" x2="190" y2="105" stroke="#92400e" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="120" y1="115" x2="185" y2="120" stroke="#92400e" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="230" y1="105" x2="300" y2="100" stroke="#92400e" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="235" y1="120" x2="300" y2="115" stroke="#92400e" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        )}

        {/* ============================================================
            13. MENTE, CEREBRO & INSIGHT
           ============================================================ */}
        {artwork === 'mind_insight' && (
          <svg viewBox="0 0 380 230" style={{ width: '100%', maxWidth: '340px', height: 'auto', filter: 'drop-shadow(0 10px 30px rgba(6, 182, 212, 0.35))' }}>
            <circle cx="190" cy="115" r="80" fill="rgba(6, 182, 212, 0.15)" />
            <path d="M 170 90 C 170 60, 210 60, 210 90 C 210 105, 200 115, 200 130 L 180 130 C 180 115, 170 105, 170 90 Z" fill="none" stroke="#67e8f9" strokeWidth="3.5" />
            <path d="M 180 135 L 200 135 M 182 141 L 198 141 M 185 147 L 195 147" stroke="#cbd5e1" strokeWidth="2.5" />
            <path d="M 185 100 L 190 80 L 195 100" fill="none" stroke="#fde047" strokeWidth="2.5" />
            <line x1="190" y1="40" x2="190" y2="20" stroke="#38bdf8" strokeWidth="3" strokeDasharray="4 4" />
          </svg>
        )}

        {/* ============================================================
            14. INTELIGENCIA ARTIFICIAL & ROBÓTICA
           ============================================================ */}
        {artwork === 'ai_robotics' && (
          <svg viewBox="0 0 420 240" style={{ width: '100%', maxWidth: '360px', height: 'auto', filter: 'drop-shadow(0 15px 35px rgba(217, 70, 239, 0.35))' }}>
            <circle cx="210" cy="120" r="80" fill="rgba(217, 70, 239, 0.12)" />
            <rect x="155" y="75" width="110" height="90" rx="20" fill="rgba(15, 23, 42, 0.9)" stroke="#d946ef" strokeWidth="3" />
            <circle cx="185" cy="110" r="10" fill="#38bdf8" />
            <circle cx="235" cy="110" r="10" fill="#38bdf8" />
            <path d="M 185 140 Q 210 155, 235 140" fill="none" stroke="#f0abfc" strokeWidth="3" strokeLinecap="round" />
            <line x1="210" y1="75" x2="210" y2="50" stroke="#d946ef" strokeWidth="3" />
            <circle cx="210" cy="45" r="6" fill="#fde047" />
          </svg>
        )}

        {/* ============================================================
            15. CÓDIGO & TERMINAL
           ============================================================ */}
        {artwork === 'coding_software' && (
          <svg viewBox="0 0 440 240" style={{ width: '100%', maxWidth: '380px', height: 'auto' }}>
            <rect x="70" y="45" width="300" height="150" rx="12" fill="rgba(15, 23, 42, 0.95)" stroke="#64748b" strokeWidth="2.5" />
            <circle cx="95" cy="65" r="4.5" fill="#ef4444" />
            <circle cx="110" cy="65" r="4.5" fill="#eab308" />
            <circle cx="125" cy="65" r="4.5" fill="#22c55e" />
            <line x1="70" y1="80" x2="370" y2="80" stroke="#334155" strokeWidth="1.5" />
            <text x="95" y="110" fill="#c084fc" fontSize="12" fontFamily="monospace">const concept = await learn();</text>
            <text x="95" y="130" fill="#38bdf8" fontSize="12" fontFamily="monospace">if (understood) &#123;</text>
            <text x="115" y="150" fill="#34d399" fontSize="12" fontFamily="monospace">return '¡Éxito Total!';</text>
            <text x="95" y="170" fill="#38bdf8" fontSize="12" fontFamily="monospace">&#125;</text>
          </svg>
        )}

        {/* ============================================================
            16. FINANZAS & ECONOMÍA
           ============================================================ */}
        {artwork === 'finance_economy' && (
          <svg viewBox="0 0 420 240" style={{ width: '100%', maxWidth: '360px', height: 'auto', filter: 'drop-shadow(0 15px 35px rgba(16, 185, 129, 0.35))' }}>
            <rect x="90" y="140" width="35" height="60" rx="6" fill="rgba(6, 182, 212, 0.4)" stroke="#06b6d4" strokeWidth="2" />
            <rect x="145" y="110" width="35" height="90" rx="6" fill="rgba(139, 92, 246, 0.4)" stroke="#8b5cf6" strokeWidth="2" />
            <rect x="200" y="70" width="35" height="130" rx="6" fill="rgba(16, 185, 129, 0.4)" stroke="#34d399" strokeWidth="2" />
            <path d="M 80 160 L 140 120 L 200 80 L 260 40" fill="none" stroke="#34d399" strokeWidth="3.5" strokeLinecap="round" />
            <circle cx="310" cy="110" r="32" fill="rgba(245, 158, 11, 0.8)" stroke="#fde047" strokeWidth="3" />
            <text x="310" y="118" fill="#78350f" fontSize="24" fontWeight="bold" textAnchor="middle">$</text>
          </svg>
        )}

        {/* ============================================================
            17. MEDICINA & SALUD
           ============================================================ */}
        {artwork === 'medicine_health' && (
          <svg viewBox="0 0 420 240" style={{ width: '100%', maxWidth: '360px', height: 'auto', filter: 'drop-shadow(0 15px 35px rgba(244, 63, 94, 0.4))' }}>
            <circle cx="210" cy="120" r="85" fill="rgba(244, 63, 94, 0.12)" />
            <path d="M 120 125 L 170 125 L 185 85 L 205 165 L 225 105 L 240 145 L 255 125 L 300 125" fill="none" stroke="#38bdf8" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M 210 65 L 210 95 M 195 80 L 225 80" stroke="#f43f5e" strokeWidth="4" strokeLinecap="round" />
          </svg>
        )}

        {/* ============================================================
            18. EDUCACIÓN & APRENDIZAJE
           ============================================================ */}
        {artwork === 'education_learning' && (
          <svg viewBox="0 0 420 240" style={{ width: '100%', maxWidth: '360px', height: 'auto', filter: 'drop-shadow(0 15px 35px rgba(139, 92, 246, 0.4))' }}>
            <polygon points="210,60 320,105 210,150 100,105" fill="rgba(139, 92, 246, 0.5)" stroke="#c084fc" strokeWidth="3" />
            <rect x="160" y="130" width="100" height="40" rx="8" fill="rgba(30, 41, 59, 0.9)" stroke="#8b5cf6" strokeWidth="2" />
            <line x1="320" y1="105" x2="320" y2="165" stroke="#fde047" strokeWidth="3" />
            <circle cx="320" cy="170" r="6" fill="#fde047" />
          </svg>
        )}

        {/* ============================================================
            19. JUSTICIA & LEY
           ============================================================ */}
        {artwork === 'law_justice' && (
          <svg viewBox="0 0 380 220" style={{ width: '100%', maxWidth: '340px', height: 'auto' }}>
            <line x1="190" y1="40" x2="190" y2="180" stroke="#cbd5e1" strokeWidth="3.5" />
            <polygon points="160,185 220,185 190,165" fill="#64748b" />
            <line x1="110" y1="70" x2="270" y2="70" stroke="#38bdf8" strokeWidth="3.5" />
            <path d="M 70 120 Q 110 145, 150 120 Z" fill="rgba(244, 63, 94, 0.3)" stroke="#fb7185" strokeWidth="2.5" />
            <path d="M 230 120 Q 270 145, 310 120 Z" fill="rgba(16, 185, 129, 0.3)" stroke="#34d399" strokeWidth="2.5" />
          </svg>
        )}

        {/* ============================================================
            20. NATURALEZA & ECOLOGÍA
           ============================================================ */}
        {artwork === 'nature_ecology' && (
          <svg viewBox="0 0 400 240" style={{ width: '100%', maxWidth: '360px', height: 'auto', filter: 'drop-shadow(0 15px 35px rgba(16, 185, 129, 0.4))' }}>
            <circle cx="200" cy="120" r="85" fill="rgba(16, 185, 129, 0.1)" />
            <path d="M 190 200 L 190 140 Q 190 120, 160 100 M 210 200 L 210 140 Q 210 120, 240 100" fill="none" stroke="#78350f" strokeWidth="4" strokeLinecap="round" />
            <circle cx="160" cy="90" r="30" fill="rgba(16, 185, 129, 0.4)" stroke="#34d399" strokeWidth="2.5" />
            <circle cx="240" cy="90" r="30" fill="rgba(16, 185, 129, 0.4)" stroke="#34d399" strokeWidth="2.5" />
            <circle cx="200" cy="70" r="35" fill="rgba(16, 185, 129, 0.6)" stroke="#34d399" strokeWidth="2.5" />
          </svg>
        )}

        {/* ============================================================
            21. MÚSICA & ARTE
           ============================================================ */}
        {artwork === 'music_arts' && (
          <svg viewBox="0 0 400 240" style={{ width: '100%', maxWidth: '360px', height: 'auto', filter: 'drop-shadow(0 15px 35px rgba(245, 158, 11, 0.4))' }}>
            <circle cx="200" cy="120" r="80" fill="rgba(245, 158, 11, 0.12)" />
            <ellipse cx="140" cy="160" rx="16" ry="12" fill="#f59e0b" transform="rotate(-20 140 160)" />
            <line x1="152" y1="155" x2="152" y2="75" stroke="#f59e0b" strokeWidth="3.5" />
            <ellipse cx="220" cy="140" rx="16" ry="12" fill="#f59e0b" transform="rotate(-20 220 140)" />
            <line x1="232" y1="135" x2="232" y2="55" stroke="#f59e0b" strokeWidth="3.5" />
            <path d="M 152 75 Q 192 50, 232 55" fill="none" stroke="#f59e0b" strokeWidth="4" />
            <circle cx="300" cy="110" r="28" fill="rgba(217, 70, 239, 0.3)" stroke="#f0abfc" strokeWidth="2" />
          </svg>
        )}

        {/* ============================================================
            22. MONTAÑA & CAMINO
           ============================================================ */}
        {artwork === 'journey_mountain' && (
          <svg viewBox="0 0 380 220" style={{ width: '100%', maxWidth: '340px', height: 'auto' }}>
            <circle cx="190" cy="70" r="40" fill="rgba(245, 158, 11, 0.2)" stroke="#f59e0b" strokeWidth="1.5" />
            <polygon points="50,180 140,80 230,180" fill="rgba(139, 92, 246, 0.15)" stroke="#8b5cf6" strokeWidth="1.5" />
            <polygon points="160,180 260,60 360,180" fill="rgba(6, 182, 212, 0.15)" stroke="#06b6d4" strokeWidth="1.5" />
            <path d="M 60 210 Q 180 170, 190 120 T 260 70" fill="none" stroke="#f0abfc" strokeWidth="3" strokeDasharray="6 4" className={styles.animatedPath} />
          </svg>
        )}

        {/* ============================================================
            23. TROFEO & CERTIFICACIÓN FINAL
           ============================================================ */}
        {artwork === 'badge_certification_trophy' && (
          <svg viewBox="0 0 420 240" style={{ width: '100%', maxWidth: '380px', height: 'auto', filter: 'drop-shadow(0 15px 35px rgba(245, 158, 11, 0.45))' }}>
            <circle cx="210" cy="115" r="75" fill="rgba(245, 158, 11, 0.12)" />
            <path d="M 160 65 L 260 65 L 245 130 C 245 155, 175 155, 175 130 Z" fill="rgba(245, 158, 11, 0.4)" stroke="#f59e0b" strokeWidth="2.5" />
            <path d="M 160 80 Q 130 90, 160 120" fill="none" stroke="#fbbf24" strokeWidth="2" />
            <path d="M 260 80 Q 290 90, 260 120" fill="none" stroke="#fbbf24" strokeWidth="2" />
            <rect x="195" y="150" width="30" height="25" fill="#ca8a04" stroke="#f59e0b" strokeWidth="1.5" />
            <polygon points="170,195 250,195 240,175 180,175" fill="#78350f" stroke="#f59e0b" strokeWidth="2" />
            <polygon points="210,80 216,95 232,95 219,105 224,120 210,110 196,120 201,105 188,95 204,95" fill="#fde047" stroke="#ffffff" strokeWidth="1" />
          </svg>
        )}

        {/* ============================================================
            24. PIPELINE SECUENCIAL 01 -> 02 -> 03
           ============================================================ */}
        {artwork === 'steps_flow_pipeline' && (
          <svg viewBox="0 0 460 220" style={{ width: '100%', maxWidth: '420px', height: 'auto' }}>
            <line x1="80" y1="110" x2="380" y2="110" stroke="#334155" strokeWidth="3" />
            <line x1="80" y1="110" x2="230" y2="110" stroke="#06b6d4" strokeWidth="3" className={styles.animatedPath} />
            <circle cx="80" cy="110" r="24" fill="rgba(6, 182, 212, 0.3)" stroke="#22d3ee" strokeWidth="2" />
            <text x="80" y="115" fill="#ffffff" fontSize="12" textAnchor="middle" fontWeight="bold">01</text>
            <circle cx="230" cy="110" r="28" fill="rgba(139, 92, 246, 0.4)" stroke="#c084fc" strokeWidth="2.5" />
            <text x="230" y="115" fill="#ffffff" fontSize="13" textAnchor="middle" fontWeight="bold">02</text>
            <circle cx="380" cy="110" r="24" fill="rgba(16, 185, 129, 0.25)" stroke="#34d399" strokeWidth="2" />
            <text x="380" y="115" fill="#ffffff" fontSize="12" textAnchor="middle" fontWeight="bold">03</text>
          </svg>
        )}

        {/* ============================================================
            25. GENERADOR UNIVERSAL DINÁMICO & AGNÓSTICO
           ============================================================ */}
        {artwork === 'universal_dynamic_infographic' && (() => {
          const AgnosticIcon = getAgnosticConceptIcon(scene);
          const points = scene.textoEnPantalla.puntosClave.filter(Boolean);
          const p1 = points[0] || scene.titulo;
          const p2 = points[1] || scene.conceptoPedagogico.slice(0, 30);

          return (
            <div
              style={{
                position: 'relative',
                width: '100%',
                maxWidth: '480px',
                height: '240px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* Círculos de Retícula & HUD Escáner */}
              <div
                style={{
                  position: 'absolute',
                  width: '190px',
                  height: '190px',
                  borderRadius: '50%',
                  border: '1.5px dashed rgba(56, 189, 248, 0.45)',
                  animation: 'spinClockwise 16s linear infinite',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  width: '140px',
                  height: '140px',
                  borderRadius: '50%',
                  border: '1px solid rgba(139, 92, 246, 0.5)',
                  boxShadow: '0 0 30px rgba(139, 92, 246, 0.25)',
                }}
              />

              {/* Núcleo Holográfico con Icono Semántico Agnóstico */}
              <div
                style={{
                  position: 'relative',
                  width: '84px',
                  height: '84px',
                  borderRadius: '24px',
                  background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.9) 100%)',
                  border: '2px solid #38bdf8',
                  boxShadow: '0 0 25px rgba(56, 189, 248, 0.5), inset 0 0 15px rgba(56, 189, 248, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 3,
                }}
              >
                <AgnosticIcon size={40} color="#38bdf8" />
              </div>

              {/* Tag Flotante Izquierdo: Punto Clave Real */}
              <div
                style={{
                  position: 'absolute',
                  left: '0px',
                  top: '40px',
                  maxWidth: '150px',
                  background: 'rgba(15, 23, 42, 0.92)',
                  border: '1px solid rgba(56, 189, 248, 0.4)',
                  borderRadius: '10px',
                  padding: '0.4rem 0.75rem',
                  fontSize: '0.75rem',
                  color: '#e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.4)',
                  backdropFilter: 'blur(8px)',
                  zIndex: 2,
                }}
              >
                <Target size={12} color="#38bdf8" />
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {p1.length > 20 ? p1.slice(0, 18) + '…' : p1}
                </span>
              </div>

              {/* Tag Flotante Derecho: Punto Clave Real */}
              <div
                style={{
                  position: 'absolute',
                  right: '0px',
                  bottom: '50px',
                  maxWidth: '150px',
                  background: 'rgba(15, 23, 42, 0.92)',
                  border: '1px solid rgba(139, 92, 246, 0.4)',
                  borderRadius: '10px',
                  padding: '0.4rem 0.75rem',
                  fontSize: '0.75rem',
                  color: '#e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.4)',
                  backdropFilter: 'blur(8px)',
                  zIndex: 2,
                }}
              >
                <CheckCircle2 size={12} color="#c084fc" />
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {p2.length > 20 ? p2.slice(0, 18) + '…' : p2}
                </span>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};

