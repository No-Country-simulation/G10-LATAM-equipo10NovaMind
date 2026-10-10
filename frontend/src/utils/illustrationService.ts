/**
 * Illustration Service — NuevaMente Video Studio
 * Generador dinámico agnóstico de ilustraciones para microclases audiovisuales estilo NotebookLM.
 * Genera prompts descriptivos e imágenes adaptadas al 100% al Storyboard Visual (Indicación de Escena)
 * y al Teleprompter (Guion Docente) de cualquier documento ingerido, con adaptación precisa de dominio
 * para evitar alucinaciones visuales (por ejemplo, interpretar metáforas de DDoS como montañas).
 */

class IllustrationService {
  private cache: Map<string, string> = new Map();

  /**
   * Determina el dominio temático de la escena para aplicar el estilo visual y el entorno
   * correcto, evitando que conceptos técnicos se ilustren con paisajes de naturaleza.
   */
  private detectVisualDomain(corpus: string): 'cybersecurity' | 'cloud_it' | 'biology_medical' | 'animal' | 'fairytale_medieval' | 'finance_law_edu' | 'general' {
    const text = corpus.toLowerCase();

    // 1. Ciberseguridad, Amenazas, DDoS, Ransomware, Malware, Hackers, Cifrado
    if (
      text.includes('ddos') ||
      text.includes('ransomware') ||
      text.includes('malware') ||
      text.includes('ciberamenaza') ||
      text.includes('ciberataque') ||
      text.includes('ciberseguridad') ||
      text.includes('hacker') ||
      text.includes('phishing') ||
      text.includes('vulnerabilidad') ||
      text.includes('enisa') ||
      text.includes('firewall') ||
      text.includes('cortafuegos') ||
      text.includes('waf') ||
      text.includes('cifrado') ||
      text.includes('secuestro de datos') ||
      text.includes('denegación de servicio') ||
      text.includes('troyano') ||
      text.includes('botnet')
    ) {
      return 'cybersecurity';
    }

    // 2. Cloud Computing, Datacenters, Redes, Servidores, DevOps, Bases de Datos
    if (
      text.includes('nube') ||
      text.includes('cloud') ||
      text.includes('vcn') ||
      text.includes('subred') ||
      text.includes('datacenter') ||
      text.includes('rack') ||
      text.includes('fibra óptica') ||
      text.includes('base de datos') ||
      text.includes('database') ||
      text.includes('autonomous database') ||
      text.includes('sql') ||
      text.includes('código') ||
      text.includes('programación') ||
      text.includes('software') ||
      text.includes('terminal') ||
      text.includes('servidor')
    ) {
      return 'cloud_it';
    }

    // 3. Biología, Medicina, Salud, Células, ADN, Genética
    if (
      text.includes('célula') ||
      text.includes('adn') ||
      text.includes('genétic') ||
      text.includes('biolog') ||
      text.includes('médic') ||
      text.includes('salud') ||
      text.includes('paciente') ||
      text.includes('enfermedad') ||
      text.includes('hospital') ||
      text.includes('diagnóstico') ||
      text.includes('virus biológico') ||
      text.includes('bacteria') ||
      text.includes('organismo') ||
      text.includes('fotosíntesis') ||
      text.includes('clorofila')
    ) {
      return 'biology_medical';
    }

    // 4. Animales, Mascotas, Caninos, Rasgos
    if (
      text.includes('perro') ||
      text.includes('canino') ||
      text.includes('mascota') ||
      text.includes('gato') ||
      text.includes('felino') ||
      text.includes('veterinari') ||
      (text.includes('rasgos') && (text.includes('oreja') || text.includes('mirada') || text.includes('hocico')))
    ) {
      return 'animal';
    }

    // 5. Narrativas Medievales, Cuentos, Fantasía, Caballeros, Merlín
    if (
      text.includes('caballero') ||
      text.includes('armadura') ||
      text.includes('yelmo') ||
      text.includes('merlín') ||
      text.includes('mago') ||
      text.includes('herrero') ||
      text.includes('espada') ||
      text.includes('castillo') ||
      text.includes('escudero') ||
      text.includes('medieval')
    ) {
      return 'fairytale_medieval';
    }

    // 6. Finanzas, Negocios, Leyes, Justicia, Educación
    if (
      text.includes('finanz') ||
      text.includes('econom') ||
      text.includes('dinero') ||
      text.includes('inversi') ||
      text.includes('bolsa') ||
      text.includes('justicia') ||
      text.includes('ley') ||
      text.includes('derecho') ||
      text.includes('juez') ||
      text.includes('educaci') ||
      text.includes('escuela') ||
      text.includes('pedagog')
    ) {
      return 'finance_law_edu';
    }

    return 'general';
  }

  /**
   * Traduce y enriquece de forma agnóstica la descripción visual de la escena,
   * desambiguando metáforas técnicas para que la IA generadora no confunda términos.
   */
  private translateAndEnrichStoryboard(
    storyboardVisual: string,
    script: string,
    sceneTitle: string,
    topicTitle: string
  ): string {
    let text = `${storyboardVisual || ''} ${script || ''}`.trim();
    if (!text) {
      text = `${sceneTitle} ${topicTitle}`.trim();
    }

    // 1. Limpiar prefijos de dirección
    text = text
      .replace(/^(animación de|gráfico animado de|ilustración de|plano de|esquema de|transición hacia|visualización de|primer plano de|se observa|se muestra|vemos a|muestra a|aparece|escena que muestra)\s+/gi, '')
      .replace(/^(estilo blueprint|estilo isometrico|en pantalla|en memoria)\s*/gi, '')
      .replace(/["“”]/g, '')
      .trim();

    // 2. Diccionario exhaustivo de traducción y desambiguación semántica
    const semanticMap: [RegExp, string][] = [
      // --- CIBERSEGURIDAD, DDOS, RANSOMWARE & REDES (Evitar confusiones con naturaleza) ---
      [/\bpantalla dividida\b/gi, 'split-screen visual comparison, left and right contrasting panels'],
      [/\bavalancha de paquetes\b/gi, 'massive flood of glowing malicious cyber data packets bombardment overloading a digital server'],
      [/\bavalancha de tráfico\b/gi, 'intense massive flood of malicious network data streams overloading web servers'],
      [/\bavalancha\b/gi, 'massive overwhelming flood of cyber data packets'],
      [/\bsaturando un servidor\b/gi, 'overloading and crashing a high-tech datacenter server rack with red warning alerts'],
      [/\bsaturar un servicio\b/gi, 'overwhelming and knocking offline a web service with malicious traffic'],
      [/\bcandado digital\b/gi, 'glowing red cybersecurity padlock AES-256 encryption locking computer files with extortion message'],
      [/\bpedido de rescate\b/gi, 'ransomware extortion warning message interface with locked data vault'],
      [/\bsecuestro de datos\b/gi, 'ransomware cyber extortion locking critical corporate database files'],
      [/\bsecuestro\b/gi, 'ransomware cyber lockout of digital assets'],
      [/\bddos\b/gi, 'DDoS distributed denial of service cyber attack with glowing malicious packet flood bombardment'],
      [/\bdenegación de servicio\b/gi, 'server denial of service outage caused by malicious network flood'],
      [/\bransomware\b/gi, 'cybersecurity ransomware malware with locked encrypted files and glowing red cyber padlock'],
      [/\bmalware\b/gi, 'malicious software cyber virus infection invading a computer network'],
      [/\bciberataque\b/gi, 'cybersecurity attack on digital infrastructure with glowing laser code streams'],
      [/\bciberseguridad\b/gi, 'cybersecurity defense operations with holographic shields and firewall barriers'],
      [/\bhacker\b/gi, 'cyber hacker silhouette with glowing green terminal code streams'],
      [/\btráfico falso\b/gi, 'botnet fake data packet traffic flooding the target server'],
      [/\bpuerto 443\b/gi, 'secure network port 443 with TLS encryption stream'],
      [/\bpuerto\b/gi, 'network communication port socket'],
      [/\bvector de ataque\b/gi, 'cyber attack trajectory arrow penetrating security boundaries'],
      [/\bradar de vulnerabilidades\b/gi, 'cyber threat radar scope detecting malicious exploits'],
      [/\bbarrio cerrado\b/gi, 'gated secure residential community architecture (VCN metaphor) with security gate'],
      [/\bgarita de seguridad\b/gi, 'secure entrance gateway booth with barrier (Internet Gateway)'],
      [/\bsubred pública\b/gi, 'public commercial entrance subnet area with web catalog server'],
      [/\bsubred privada\b/gi, 'private protected residential subnet with database vault'],
      [/\brack de servidores\b/gi, 'high-tech datacenter server rack cabinets with glowing LEDs and fiber optic patch panels'],
      [/\bfibra óptica\b/gi, 'glowing neon fiber optic cables carrying high-speed data'],
      [/\bbase de datos\b/gi, 'high-tech cylindrical database vault with glowing queries'],
      [/\bauto-tuning\b/gi, 'AI auto-tuning database optimization gauge and index branches'],
      [/\bcódigo\b/gi, 'clean syntax highlighted code on floating glass screen'],

      // --- NARRATIVA, LITERATURA & PERSONAJES ---
      [/\bmerlín\b/gi, 'wise wizard Merlin with pointed star hat and mystical robes'],
      [/\bmago\b/gi, 'wise elder wizard holding a glowing crystalline magic staff'],
      [/\bcaballero brillante\b/gi, 'gallant medieval knight in shining polished steel armor'],
      [/\bcaballero\b/gi, 'medieval knight with steel armor and cape'],
      [/\barmadura oxidada\b/gi, 'rusted antique iron plate armor'],
      [/\barmadura\b/gi, 'medieval plate armor suit'],
      [/\byelmo oxidado\b/gi, 'stuck rusted iron knight helmet'],
      [/\byelmo\b/gi, 'iron knight helmet with visor'],
      [/\bherrero\b/gi, 'sturdy blacksmith with heavy iron hammer at a forge anvil with golden sparks'],
      [/\bescudero\b/gi, 'young faithful medieval squire'],
      [/\bperro\b/gi, 'expressive friendly dog with alert perked ears and curious warm eyes'],
      [/\bcanino\b/gi, 'canine portrait with perked ears and attentive gaze'],
      [/\banimales del bosque\b/gi, 'friendly woodland animals, squirrels, rabbits and birds'],
      [/\bbúho\b/gi, 'wise feathered owl on a branch'],
      [/\bsentado bajo un árbol\b/gi, 'sitting serenely beneath a giant ancient leafy tree'],
      [/\bhablando con el caballero\b/gi, 'having a deep thoughtful conversation with the knight'],
      [/\benseña que el miedo\b/gi, 'gently explaining that fear created the armor, transmuting into self-knowledge'],
      [/\bgolpeando el yelmo\b/gi, 'hammering the stuck helmet on the iron anvil with bright sparks'],
      [/\bsendero de la verdad\b/gi, 'winding mystical mountain trail of truth ascending through mountain peaks'],
      [/\bcastillo del silencio\b/gi, 'ancient peaceful stone castle under a starry twilight night sky'],
      [/\bcastillo del conocimiento\b/gi, 'illuminated grand castle of knowledge and wisdom'],
      [/\bcastillo de la valentía\b/gi, 'towering castle of courage on a rocky cliff'],
      [/\byunque\b/gi, 'heavy iron blacksmith anvil with glowing forge embers'],
      [/\bmartillo\b/gi, 'forging hammer with golden impact sparks'],
      [/\bespada\b/gi, 'gleaming steel medieval sword with golden hilt'],
      [/\bcorazón radiante\b/gi, 'radiant glowing heart shining warmly with inner peace and freedom'],
      [/\blágrimas\b/gi, 'glowing tears melting away the rusted armor'],
      [/\bdeshacer la armadura\b/gi, 'the rusted armor breaking apart and dissolving into golden light particles'],

      // --- CIENCIAS, BIOLOGÍA & MEDICINA ---
      [/\bcélula\b/gi, 'vibrant biological cell with glowing organelles'],
      [/\badn\b/gi, 'illuminated glowing DNA double helix strand'],
      [/\bmédico\b/gi, 'doctor in medical lab coat with stethoscope'],
      [/\bpaciente\b/gi, 'patient in modern health clinic'],
      [/\belectrocardiograma\b/gi, 'glowing medical heartbeat ECG pulse monitor line'],
      [/\bprofesor\b/gi, 'inspiring teacher at classroom blackboard'],
      [/\balumno\b/gi, 'attentive student engaged in learning'],
      [/\bjuez\b/gi, 'judge in formal court robe with gavel'],
      [/\bbalanza de justicia\b/gi, 'balanced golden scales of justice in classical architecture'],
      [/\bfinanzas\b/gi, 'ascending financial stock chart with glowing gold and green trendlines'],
    ];

    let translated = text;
    for (const [pattern, replacement] of semanticMap) {
      translated = translated.replace(pattern, replacement);
    }

    return translated;
  }

  /**
   * Construye un prompt descriptivo en inglés de alta fidelidad para el modelo generador
   * basándose estrictamente en el Storyboard Visual, el Guion Docente y el Dominio Temático.
   */
  public buildPrompt(
    sceneTitle: string,
    storyboardVisual: string = '',
    topicTitle: string = '',
    script: string = '',
    pedagogicalTip: string = ''
  ): string {
    const combinedCorpus = `${topicTitle} ${sceneTitle} ${storyboardVisual} ${script} ${pedagogicalTip}`;
    const domain = this.detectVisualDomain(combinedCorpus);

    const visualContent = this.translateAndEnrichStoryboard(
      storyboardVisual,
      script,
      sceneTitle,
      topicTitle
    );

    // Modificadores de estilo específicos por dominio para evitar contaminación visual
    let domainStyle = '';

    if (domain === 'cybersecurity') {
      domainStyle = [
        'futuristic high-tech cybersecurity digital 3D graphic illustration',
        'dark sleek cyberspace command center background',
        'glowing neon cyan and red data streams and cyber HUD overlays',
        'glowing server racks under attack and locked cyber padlock encryption visual',
        'modern technology explainer aesthetic',
        'dramatic volumetric cyber lighting',
        '16:9 cinematic widescreen composition',
        'crisp 3D digital render',
        'no mountains, no nature, no outdoor landscapes, no trees',
        'no text overlays, no watermark',
      ].join(', ');
    } else if (domain === 'cloud_it') {
      domainStyle = [
        'modern isometric cloud computing architecture illustration',
        'glowing virtual server nodes and cyber data highways',
        'dark high-tech server room background',
        'sleek digital technology explainer aesthetic',
        '16:9 cinematic widescreen composition',
        'no outdoor landscapes, no mountains, no trees',
        'no text overlays, no watermark',
      ].join(', ');
    } else if (domain === 'biology_medical') {
      domainStyle = [
        'vibrant modern scientific 3D biological and medical illustration',
        'glowing microscopic cell structures and illuminated DNA double helix',
        'clean modern laboratory and clinical lighting',
        '16:9 cinematic widescreen composition',
        'no text overlays, no watermark',
      ].join(', ');
    } else if (domain === 'animal') {
      domainStyle = [
        'charming modern digital character illustration of expressive animals',
        'clean studio background with warm soft volumetric lighting',
        'vibrant harmonious color palette',
        '16:9 widescreen composition',
        'no text overlays, no watermark',
      ].join(', ');
    } else if (domain === 'fairytale_medieval') {
      domainStyle = [
        'charming modern editorial fairytale storybook illustration',
        'warm glowing lighting and painterly storybook textures',
        'expressive characters and clean contours',
        '16:9 widescreen composition',
        'no text overlays, no watermark',
      ].join(', ');
    } else {
      domainStyle = [
        'clean modern editorial conceptual explainer illustration',
        'refined harmonious color palette and soft volumetric lighting',
        'modern educational explainer aesthetic',
        '16:9 cinematic widescreen composition',
        'crisp lines, highly detailed',
        'no text overlays, no watermark',
      ].join(', ');
    }

    return `An artistic ${domainStyle} depicting: ${visualContent}. Context: "${topicTitle} - ${sceneTitle}".`;
  }

  /**
   * Obtiene la URL de la imagen ilustrada generada con IA para la escena
   */
  public getIllustrationUrl(prompt: string, seed: number = 100): string {
    if (this.cache.has(prompt)) {
      return this.cache.get(prompt)!;
    }

    const encodedPrompt = encodeURIComponent(prompt);
    // Endpoint de alta resolución 16:9 (1024x576) con Flux en Pollinations
    const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=576&nologo=true&seed=${seed}&model=flux`;

    this.cache.set(prompt, url);
    return url;
  }

  /**
   * Precarga una imagen en el navegador para transiciones suaves entre escenas
   */
  public preloadImage(url: string): Promise<boolean> {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = url;
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
    });
  }
}

export const illustrationService = new IllustrationService();
