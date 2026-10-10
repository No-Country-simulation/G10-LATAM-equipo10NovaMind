import type {
  AudiovisualStoryboard,
  AudiovisualScene,
  VideoExportProgress,
} from '../types/videoStudio';
import {
  detectArtworkType,
} from '../components/VideoStudio/graphics/ConceptIllustrationGraphic';

export class VideoExporter {
  private isCancelled = false;
  private imageCache: Map<string, HTMLImageElement> = new Map();

  public cancel(): void {
    this.isCancelled = true;
  }

  public async exportStoryboardToVideo(
    storyboard: AudiovisualStoryboard,
    voiceUri: string,
    onProgress: (progress: VideoExportProgress) => void
  ): Promise<{ blob: Blob; filename: string; durationSeconds: number }> {
    this.isCancelled = false;

    onProgress({
      estado: 'preparando',
      porcentaje: 5,
      mensaje: 'Inicializando motor de renderizado y canvas gráfico 16:9...',
    });

    // Precargar imágenes de las escenas en segundo plano para exportación con alta fidelidad
    for (const sc of storyboard.escenas) {
      if (sc.imagenUrl && !this.imageCache.has(sc.imagenUrl)) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = sc.imagenUrl;
        this.imageCache.set(sc.imagenUrl, img);
      }
    }

    const width = 1280;
    const height = 720;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('No se pudo inicializar el contexto 2D de Canvas para la exportación.');
    }

    // Audio Context para mezclar audio de fondo o chime
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const audioCtx = new AudioContextClass();
    const dest = audioCtx.createMediaStreamDestination();

    // Crear un MediaStream combinando el video del canvas y el audio
    const canvasStream = canvas.captureStream(30); // 30 FPS
    const combinedTracks = [...canvasStream.getVideoTracks(), ...dest.stream.getAudioTracks()];
    const combinedStream = new MediaStream(combinedTracks);

    let mimeType = 'video/webm;codecs=vp9,opus';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/mp4';
      }
    }

    const mediaRecorder = new MediaRecorder(combinedStream, {
      mimeType: MediaRecorder.isTypeSupported(mimeType) ? mimeType : undefined,
      videoBitsPerSecond: 3000000, // 3 Mbps para alta calidad
    });

    const recordedChunks: Blob[] = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        recordedChunks.push(e.data);
      }
    };

    mediaRecorder.start(100);

    onProgress({
      estado: 'grabando',
      porcentaje: 15,
      mensaje: 'Grabando y sintetizando escenas audiovisuales...',
    });

    const totalScenes = storyboard.escenas.length;
    let currentOverallProgress = 15;

    try {
      for (let scIdx = 0; scIdx < totalScenes; scIdx++) {
        if (this.isCancelled) {
          mediaRecorder.stop();
          throw new Error('Exportación cancelada por el usuario.');
        }

        const scene = storyboard.escenas[scIdx];
        const sceneDurationMs = Math.max(5000, scene.duracionEstimada * 1000);
        const startTime = Date.now();

        // Tocar un sutil chime didáctico en audioCtx al inicio de cada escena
        try {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(440 + scIdx * 60, audioCtx.currentTime);
          gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.5);
          osc.connect(gain);
          gain.connect(dest);
          osc.start();
          osc.stop(audioCtx.currentTime + 0.5);
        } catch {
          // ignore audio context glitches
        }

        // Sintetizar voz en off en vivo para la escena
        ttsService.speak(scene.narracion, {
          voiceUri,
          rate: 1.0,
        });

        // Loop de renderizado de frames en canvas para la escena
        while (Date.now() - startTime < sceneDurationMs) {
          if (this.isCancelled) {
            mediaRecorder.stop();
            ttsService.stop();
            throw new Error('Exportación cancelada.');
          }

          const elapsedScene = Date.now() - startTime;
          const sceneProgress = elapsedScene / sceneDurationMs;

          this.drawCanvasFrame(ctx, width, height, storyboard, scene, scIdx, totalScenes, sceneProgress);

          const overall = 15 + Math.round(((scIdx + sceneProgress) / totalScenes) * 75);
          if (overall !== currentOverallProgress) {
            currentOverallProgress = overall;
            onProgress({
              estado: 'grabando',
              porcentaje: overall,
              mensaje: `Renderizando Escena 0${scIdx + 1}/${totalScenes}: "${scene.titulo}"...`,
            });
          }

          await new Promise((r) => setTimeout(r, 33)); // ~30 FPS
        }

        ttsService.stop();
      }

      onProgress({
        estado: 'renderizando',
        porcentaje: 92,
        mensaje: 'Empaquetando pistas de video y codificando MP4/WebM...',
      });

      await new Promise<void>((resolve) => {
        mediaRecorder.onstop = () => resolve();
        mediaRecorder.stop();
      });

      audioCtx.close();

      const blob = new Blob(recordedChunks, { type: mimeType });
      const filename = `nuevamente-microclase-${storyboard.escenas[0]?.titulo.slice(0, 20).replace(/\s+/g, '_') || 'video'}.webm`;

      onProgress({
        estado: 'completado',
        porcentaje: 100,
        mensaje: '¡Video generado exitosamente! Listo para previsualizar o descargar.',
        archivoUrl: URL.createObjectURL(blob),
        nombreArchivo: filename,
        tamanoBytes: blob.size,
      });

      return {
        blob,
        filename,
        durationSeconds: storyboard.duracionTotalEstimada,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      onProgress({
        estado: 'error',
        porcentaje: 0,
        mensaje: `Fallo en exportación: ${errorMsg}`,
        error: errorMsg,
      });
      throw err;
    }
  }

  private drawCanvasFrame(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    storyboard: AudiovisualStoryboard,
    scene: AudiovisualScene,
    scIdx: number,
    totalScenes: number,
    progress: number
  ): void {
    // 1. Fondo Oscuro Deep Void
    ctx.fillStyle = '#07090e';
    ctx.fillRect(0, 0, w, h);

    // 2. Grid de fondo con gradientes
    const grad = ctx.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, w * 0.7);
    grad.addColorStop(0, 'rgba(139, 92, 246, 0.12)');
    grad.addColorStop(0.5, 'rgba(6, 182, 212, 0.08)');
    grad.addColorStop(1, 'rgba(7, 9, 14, 0.95)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Lineas sutiles de grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // 3. Header Superior del Video
    ctx.fillStyle = '#f0abfc';
    ctx.font = 'bold 16px "JetBrains Mono", monospace';
    ctx.fillText('NUEVAMENTE VIDEO STUDIO · MICROCLASE IA', 60, 50);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`Perfil: ${storyboard.perfilAudiencia} | OCI Always Free`, w - 380, 50);

    // 4. Titular de la Escena
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px "Syne", sans-serif';
    ctx.fillText(`0${scIdx + 1}. ${scene.titulo}`, 60, 95);

    // 5. Marco Central de Animación Visual
    const cardX = 60;
    const cardY = 120;
    const cardW = w - 120;
    const cardH = h - 260;

    ctx.fillStyle = 'rgba(13, 17, 26, 0.85)';
    ctx.strokeStyle = 'rgba(139, 92, 246, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, 20);
    ctx.fill();
    ctx.stroke();

    // Dibujar elementos centrales adaptados al concepto
    this.drawCentralIllustration(ctx, cardX, cardY, cardW, cardH, scene, progress);

    // 6. Subtítulos / Franja Narrativa Inferior (Glassmorphism)
    const subX = 60;
    const subY = h - 120;
    const subW = w - 120;
    const subH = 80;

    ctx.fillStyle = 'rgba(13, 17, 26, 0.92)';
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(subX, subY, subW, subH, 14);
    ctx.fill();
    ctx.stroke();

    // Texto de narración en subtítulo
    ctx.fillStyle = '#67e8f9';
    ctx.font = 'bold 12px "JetBrains Mono", monospace';
    ctx.fillText('NARRACIÓN DOCENTE', subX + 20, subY + 25);

    ctx.fillStyle = '#f8fafc';
    ctx.font = '16px "Plus Jakarta Sans", sans-serif';
    const cleanSub = `"${scene.narracion.length > 130 ? scene.narracion.slice(0, 130) + '...' : scene.narracion}"`;
    ctx.fillText(cleanSub, subX + 20, subY + 55);

    // 7. Barra de Progreso Global del Video
    const totalProgress = (scIdx + progress) / totalScenes;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(0, h - 6, w, 6);

    ctx.fillStyle = '#8b5cf6';
    ctx.fillRect(0, h - 6, w * totalProgress, 6);
  }

  private drawCentralIllustration(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    scene: AudiovisualScene,
    progress: number
  ): void {
    const centerX = x + w / 2;
    const centerY = y + h / 2 - 20;

    const artwork = detectArtworkType(scene);

    // Foco de luz y gradiente de fondo en canvas
    const spotlight = ctx.createRadialGradient(centerX, centerY, 20, centerX, centerY, w * 0.45);
    spotlight.addColorStop(0, 'rgba(139, 92, 246, 0.25)');
    spotlight.addColorStop(0.4, 'rgba(6, 182, 212, 0.12)');
    spotlight.addColorStop(1, 'transparent');
    ctx.fillStyle = spotlight;
    ctx.fillRect(x + 10, y + 10, w - 20, h - 20);


    // 0.0 Animales & Rasgos Caninos (Orejas, Mirada, Atención)
    if (artwork === 'animal_canine_features') {
      ctx.save();
      // Silueta / Cabeza Canina
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;

      // Oreja Izquierda
      ctx.beginPath();
      ctx.moveTo(centerX - 35, centerY - 10);
      ctx.lineTo(centerX - 55, centerY - 75);
      ctx.lineTo(centerX - 15, centerY - 40);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Oreja Derecha
      ctx.beginPath();
      ctx.moveTo(centerX + 35, centerY - 10);
      ctx.lineTo(centerX + 55, centerY - 75);
      ctx.lineTo(centerX + 15, centerY - 40);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Ondas de atención en orejas
      ctx.strokeStyle = '#67e8f9';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(centerX - 55, centerY - 75, 15, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(centerX + 55, centerY - 75, 15, Math.PI / 2, (3 * Math.PI) / 2);
      ctx.stroke();

      // Cara & Hocico
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#818cf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, 45, 40, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Ojos con brillo
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(centerX - 18, centerY - 10, 6, 0, Math.PI * 2);
      ctx.arc(centerX + 18, centerY - 10, 6, 0, Math.PI * 2);
      ctx.fill();

      // Nariz
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.arc(centerX, centerY + 18, 7, 0, Math.PI * 2);
      ctx.fill();

      // Rayo de Foco Visual
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(centerX - 18, centerY - 10);
      ctx.lineTo(centerX - 85, centerY - 10);
      ctx.moveTo(centerX + 18, centerY - 10);
      ctx.lineTo(centerX + 85, centerY - 10);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.restore();
    }
    // 0.01 Visión & Mirada
    else if (artwork === 'vision_gaze_facial') {
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;

      // Contorno de ojo
      ctx.beginPath();
      ctx.moveTo(centerX - 60, centerY);
      ctx.quadraticCurveTo(centerX, centerY - 45, centerX + 60, centerY);
      ctx.quadraticCurveTo(centerX, centerY + 45, centerX - 60, centerY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Iris
      ctx.fillStyle = '#818cf8';
      ctx.beginPath();
      ctx.arc(centerX, centerY, 24, 0, Math.PI * 2);
      ctx.fill();

      // Pupila
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(centerX, centerY, 10, 0, Math.PI * 2);
      ctx.fill();

      // Retícula de enfoque
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(centerX - 35, centerY - 35, 70, 70);
      ctx.setLineDash([]);

      ctx.restore();
    }
    // 0.02 Botánica & Plantas
    else if (artwork === 'botany_nature_plants') {
      ctx.save();
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY + 50);
      ctx.lineTo(centerX, centerY - 40);
      ctx.stroke();

      // Hojas
      ctx.fillStyle = 'rgba(34, 197, 94, 0.4)';
      ctx.beginPath();
      ctx.ellipse(centerX - 25, centerY - 15, 25, 12, -Math.PI / 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.ellipse(centerX + 25, centerY - 25, 25, 12, Math.PI / 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    }
    // 0.03 Gastronomía & Cocina
    else if (artwork === 'culinary_gastronomy_food') {
      ctx.save();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2.5;
      ctx.fillStyle = 'rgba(245, 158, 11, 0.2)';
      ctx.beginPath();
      ctx.arc(centerX, centerY + 10, 45, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(centerX, centerY - 38, 7, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
    // 0.04 Automotriz & Mecánica
    else if (artwork === 'automotive_mechanics_engineering') {
      ctx.save();
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2.5;
      ctx.fillStyle = 'rgba(6, 182, 212, 0.15)';
      ctx.beginPath();
      ctx.arc(centerX - 20, centerY - 10, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = '#a855f7';
      ctx.beginPath();
      ctx.arc(centerX + 25, centerY + 15, 22, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    }
    // 0.05 Matemáticas & Geometría
    else if (artwork === 'math_geometry_calculus') {
      ctx.save();
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(centerX - 60, centerY);
      ctx.lineTo(centerX + 60, centerY);
      ctx.moveTo(centerX, centerY - 50);
      ctx.lineTo(centerX, centerY + 50);
      ctx.stroke();

      // Curva senoidal
      ctx.strokeStyle = '#ec4899';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = -60; i <= 60; i += 5) {
        const py = centerY - Math.sin((i / 60) * Math.PI * 2) * 30;
        if (i === -60) ctx.moveTo(centerX + i, py);
        else ctx.lineTo(centerX + i, py);
      }
      ctx.stroke();

      ctx.restore();
    }
    // 0.06 Arte & Pintura
    else if (artwork === 'art_design_painting') {
      ctx.save();
      ctx.strokeStyle = '#e879f9';
      ctx.lineWidth = 2.5;
      ctx.fillStyle = 'rgba(217, 70, 239, 0.2)';
      ctx.beginPath();
      ctx.arc(centerX, centerY, 40, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.arc(centerX - 15, centerY - 10, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(centerX + 15, centerY - 10, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(centerX, centerY + 15, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
    // 0.1 Ciberseguridad & Ransomware
    else if (artwork === 'cybersecurity_ransomware') {
      ctx.save();
      // Escudo de Amenaza
      ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY - 80);
      ctx.lineTo(centerX + 65, centerY - 50);
      ctx.lineTo(centerX + 50, centerY + 30);
      ctx.quadraticCurveTo(centerX, centerY + 75, centerX, centerY + 75);
      ctx.quadraticCurveTo(centerX, centerY + 75, centerX - 50, centerY + 30);
      ctx.lineTo(centerX - 65, centerY - 50);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Candado
      ctx.fillStyle = '#b91c1c';
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(centerX - 30, centerY - 15, 60, 45, 8);
      ctx.fill();
      ctx.stroke();

      // Grillete
      ctx.strokeStyle = '#fecdd3';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(centerX, centerY - 15, 18, Math.PI, 0);
      ctx.stroke();

      // Ojo de cerradura
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(centerX, centerY + 3, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
    // 0.2 Ciudad Digital & Red Conectada
    else if (artwork === 'digital_city_network') {
      ctx.save();
      // Edificios
      ctx.fillStyle = '#0e7490';
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 1.5;
      ctx.fillRect(centerX - 70, centerY - 20, 30, 70);
      ctx.strokeRect(centerX - 70, centerY - 20, 30, 70);

      ctx.fillStyle = '#1e1b4b';
      ctx.strokeStyle = '#818cf8';
      ctx.lineWidth = 2;
      ctx.fillRect(centerX - 30, centerY - 55, 40, 105);
      ctx.strokeRect(centerX - 30, centerY - 55, 40, 105);

      ctx.fillStyle = '#083344';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.fillRect(centerX + 20, centerY - 35, 35, 85);
      ctx.strokeRect(centerX + 20, centerY - 35, 35, 85);

      // Línea de red animada
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(centerX - 90, centerY + 50);
      ctx.lineTo(centerX + 90, centerY + 50);
      ctx.stroke();
      ctx.setLineDash([]);

      // Faro de conexión
      ctx.fillStyle = '#67e8f9';
      ctx.beginPath();
      ctx.arc(centerX - 10, centerY - 65, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
    // 0.3 Radar de Amenazas / ENISA
    else if (artwork === 'threats_vulnerability_radar') {
      ctx.save();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.fillStyle = 'rgba(245, 158, 11, 0.08)';
      ctx.beginPath();
      ctx.arc(centerX, centerY, 65, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(centerX, centerY, 40, 0, Math.PI * 2);
      ctx.stroke();

      // Haz giratorio
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      const angle = progress * Math.PI * 4;
      ctx.lineTo(centerX + Math.cos(angle) * 65, centerY + Math.sin(angle) * 65);
      ctx.stroke();

      // Amenaza detectada
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(centerX + 28, centerY - 25, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
    // 1.0 Mago Merlín & Sabiduría Interior ("El miedo creó la armadura")
    else if (artwork === 'merlin_wizard_wisdom') {
      ctx.save();
      // Aura mística de sabiduría
      const aura = ctx.createRadialGradient(centerX, centerY, 10, centerX, centerY, 80);
      aura.addColorStop(0, 'rgba(192, 132, 252, 0.35)');
      aura.addColorStop(0.7, 'rgba(56, 189, 248, 0.15)');
      aura.addColorStop(1, 'transparent');
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 80, 0, Math.PI * 2);
      ctx.fill();

      // Túnica Mágica de Merlín
      ctx.fillStyle = '#6366f1';
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(centerX - 25, centerY);
      ctx.lineTo(centerX - 45, centerY + 65);
      ctx.lineTo(centerX + 45, centerY + 65);
      ctx.lineTo(centerX + 25, centerY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Barba Blanca de Sabiduría
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.moveTo(centerX - 15, centerY - 10);
      ctx.quadraticCurveTo(centerX, centerY + 30, centerX + 15, centerY - 10);
      ctx.closePath();
      ctx.fill();

      // Sombrero Puntiagudo de Mago
      ctx.fillStyle = '#7c3aed';
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY - 75);
      ctx.lineTo(centerX - 35, centerY - 25);
      ctx.lineTo(centerX + 35, centerY - 25);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Báculo Mágico de Madera con Cristal
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(centerX + 55, centerY + 65);
      ctx.lineTo(centerX + 55, centerY - 45);
      ctx.stroke();

      // Cristal de Luz en la Punta
      ctx.fillStyle = '#67e8f9';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(centerX + 55, centerY - 50, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Badge Miedo = Armadura -> Autoconocimiento
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = '#818cf8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(centerX - 110, centerY + 75, 220, 26, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 11px "JetBrains Mono"';
      ctx.textAlign = 'center';
      ctx.fillText('✨ MERLÍN: EL MIEDO CREÓ LA ARMADURA', centerX, centerY + 92);
      ctx.restore();
    }
    // 1.1 El Herrero & El Dilema del Yelmo
    else if (artwork === 'blacksmith_helmet_dilemma') {
      ctx.save();
      // Yunque
      ctx.fillStyle = '#334155';
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 2;
      ctx.fillRect(centerX - 60, centerY + 15, 120, 45);
      ctx.strokeRect(centerX - 60, centerY + 15, 120, 45);

      // Yelmo oxidado sobre el yunque
      ctx.fillStyle = '#78350f';
      ctx.strokeStyle = '#ea580c';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(centerX - 25, centerY - 25, 50, 40, [15, 15, 3, 3]);
      ctx.fill();
      ctx.stroke();

      // Martillo del herrero golpeando
      ctx.save();
      ctx.translate(centerX + 35, centerY - 45);
      ctx.rotate((-15 * Math.PI) / 180);
      ctx.fillStyle = '#475569';
      ctx.fillRect(-15, -10, 30, 20);
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(15, 0);
      ctx.lineTo(55, -20);
      ctx.stroke();
      ctx.restore();

      // Chispas de impacto
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(centerX + 5, centerY - 30, 3, 0, Math.PI * 2);
      ctx.arc(centerX - 10, centerY - 35, 2.5, 0, Math.PI * 2);
      ctx.arc(centerX + 15, centerY - 20, 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 12px "JetBrains Mono"';
      ctx.textAlign = 'center';
      ctx.fillText('El Dilema del Yelmo · La Forja', centerX, centerY + 85);
      ctx.restore();
    }
    // 1.2 El Sendero de la Verdad & Los Castillos
    else if (artwork === 'truth_path_castles') {
      ctx.save();
      // Sol en la cima
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(centerX + 70, centerY - 55, 18, 0, Math.PI * 2);
      ctx.fill();

      // Montañas
      ctx.fillStyle = '#1e1b4b';
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(centerX - 90, centerY + 65);
      ctx.lineTo(centerX - 20, centerY - 20);
      ctx.lineTo(centerX + 50, centerY + 65);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(centerX - 10, centerY + 65);
      ctx.lineTo(centerX + 70, centerY - 50);
      ctx.lineTo(centerX + 130, centerY + 65);
      ctx.fill();
      ctx.stroke();

      // Sendero serpenteante
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(centerX - 80, centerY + 60);
      ctx.quadraticCurveTo(centerX - 30, centerY + 30, centerX - 10, centerY + 10);
      ctx.quadraticCurveTo(centerX + 30, centerY - 10, centerX + 70, centerY - 45);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#67e8f9';
      ctx.font = 'bold 12px "JetBrains Mono"';
      ctx.textAlign = 'center';
      ctx.fillText('Sendero de la Verdad · 3 Castillos', centerX, centerY + 85);
      ctx.restore();
    }
    // 1.3 Caballero Medieval / Armadura / Yelmo / Liberación / Castillo
    else if (artwork === 'knight_armor' || artwork === 'knight_liberation' || artwork === 'castle_silence') {
      ctx.save();
      // Halo Dorado
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 80, 0, Math.PI * 2);
      ctx.stroke();

      // Coraza de Armadura
      ctx.fillStyle = 'rgba(148, 163, 184, 0.4)';
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(centerX - 50, centerY - 30);
      ctx.lineTo(centerX + 50, centerY - 30);
      ctx.lineTo(centerX + 35, centerY + 55);
      ctx.lineTo(centerX, centerY + 75);
      ctx.lineTo(centerX - 35, centerY + 55);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Yelmo
      ctx.fillStyle = 'rgba(71, 85, 105, 0.6)';
      ctx.beginPath();
      ctx.roundRect(centerX - 30, centerY - 80, 60, 45, [20, 20, 5, 5]);
      ctx.fill();
      ctx.stroke();

      // Visor con destello azul
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(centerX - 20, centerY - 62, 40, 7);

      // Corazón palpitante dentro
      const heartPulse = 1 + Math.sin(progress * Math.PI * 4) * 0.15;
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.arc(centerX, centerY + 15, 12 * heartPulse, 0, Math.PI * 2);
      ctx.fill();

      // Texto de emblema
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 13px "JetBrains Mono"';
      ctx.textAlign = 'center';
      const label = artwork === 'knight_liberation' ? 'Corazón Libre' : artwork === 'castle_silence' ? 'Castillo del Silencio' : 'El Caballero y la Armadura';
      ctx.fillText(label, centerX, centerY + 115);
      ctx.restore();
    }
    // 2. Dominio: Barrio Cerrado & Subredes (Metáfora VCN)
    else if (artwork === 'gated_community_subnets') {
      ctx.save();
      // Perímetro VCN
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(centerX - 170, centerY - 70, 340, 140);
      ctx.setLineDash([]);

      // Garita de Entrada (IGW)
      ctx.fillStyle = '#0284c7';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.fillRect(centerX - 150, centerY - 40, 70, 80);
      ctx.strokeRect(centerX - 150, centerY - 40, 70, 80);
      ctx.fillStyle = '#bae6fd';
      ctx.font = 'bold 9px "JetBrains Mono"';
      ctx.fillText('GARITA (IGW)', centerX - 115, centerY + 25);

      // Subred Pública
      ctx.fillStyle = 'rgba(6, 182, 212, 0.2)';
      ctx.strokeStyle = '#06b6d4';
      ctx.fillRect(centerX - 60, centerY - 50, 95, 100);
      ctx.strokeRect(centerX - 60, centerY - 50, 95, 100);
      ctx.fillStyle = '#67e8f9';
      ctx.fillText('SUBRED PÚBLICA', centerX - 12, centerY - 30);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '8px sans-serif';
      ctx.fillText('Catálogo Web', centerX - 12, centerY + 10);

      // Subred Privada
      ctx.fillStyle = 'rgba(139, 92, 246, 0.25)';
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 2;
      ctx.fillRect(centerX + 55, centerY - 50, 95, 100);
      ctx.strokeRect(centerX + 55, centerY - 50, 95, 100);
      ctx.fillStyle = '#e9d5ff';
      ctx.font = 'bold 9px "JetBrains Mono"';
      ctx.fillText('SUBRED PRIVADA', centerX + 102, centerY - 30);
      ctx.fillStyle = '#34d399';
      ctx.font = '8px sans-serif';
      ctx.fillText('DBs Protegidas', centerX + 102, centerY + 10);

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 12px "JetBrains Mono"';
      ctx.textAlign = 'center';
      ctx.fillText('Metáfora Barrio Cerrado & Subredes (VCN)', centerX, centerY + 95);
      ctx.restore();
    }
    // 3. Dominio: Rack Físico & Caos de Cables de Fibra vs Nube OCI
    else if (artwork === 'server_rack_cables') {
      ctx.save();
      // Rack Metálico 42U
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
      ctx.strokeRect(centerX - 160, centerY - 65, 110, 130);
      ctx.fillRect(centerX - 160, centerY - 65, 110, 130);

      // Blades y Patch Panel
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(centerX - 150, centerY - 55, 90, 24);
      ctx.fillRect(centerX - 150, centerY - 25, 90, 22);
      ctx.fillRect(centerX - 150, centerY + 5, 90, 24);
      ctx.fillRect(centerX - 150, centerY + 35, 90, 20);

      // LEDs
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(centerX - 75, centerY - 48, 5, 5);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(centerX - 68, centerY - 48, 5, 5);

      // Spaghetti de cables de fibra óptica densos
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ea580c';
      ctx.beginPath();
      ctx.moveTo(centerX - 130, centerY - 45);
      ctx.bezierCurveTo(centerX - 170, centerY - 10, centerX - 140, centerY + 30, centerX - 100, centerY - 15);
      ctx.stroke();

      ctx.strokeStyle = '#06b6d4';
      ctx.beginPath();
      ctx.moveTo(centerX - 110, centerY - 45);
      ctx.bezierCurveTo(centerX - 180, centerY + 10, centerX - 110, centerY + 50, centerX - 80, centerY - 15);
      ctx.stroke();

      ctx.strokeStyle = '#eab308';
      ctx.beginPath();
      ctx.moveTo(centerX - 140, centerY - 15);
      ctx.bezierCurveTo(centerX - 160, centerY + 40, centerX - 90, centerY + 60, centerX - 70, centerY + 15);
      ctx.stroke();

      // Flecha de Virtualización SDN
      ctx.strokeStyle = '#d946ef';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(centerX - 35, centerY);
      ctx.lineTo(centerX + 25, centerY);
      ctx.stroke();

      // Nube OCI Inmediata
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2.5;
      ctx.fillStyle = 'rgba(6, 182, 212, 0.2)';
      ctx.beginPath();
      ctx.arc(centerX + 85, centerY - 5, 38, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 9px "JetBrains Mono"';
      ctx.fillText('KM DE FIBRA & HARDWARE', centerX - 105, centerY + 80);

      ctx.fillStyle = '#34d399';
      ctx.fillText('NUBE OCI (3s)', centerX + 85, centerY + 55);

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 12px "JetBrains Mono"';
      ctx.textAlign = 'center';
      ctx.fillText('Centro de Datos Físico vs Virtualización OCI', centerX, centerY + 105);
      ctx.restore();
    }
    // 4. Dominio: Nube & Cloud Networking General
    else if (artwork === 'cloud_architecture_topology' || artwork === 'traffic_waf') {
      ctx.save();
      // Nube Central
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 3;
      ctx.fillStyle = 'rgba(6, 182, 212, 0.15)';
      ctx.beginPath();
      ctx.arc(centerX - 40, centerY - 10, 45, 0, Math.PI * 2);
      ctx.arc(centerX + 40, centerY - 10, 45, 0, Math.PI * 2);
      ctx.arc(centerX, centerY - 35, 55, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Subred Privada con Candado
      ctx.strokeStyle = '#f0abfc';
      ctx.fillStyle = 'rgba(217, 70, 239, 0.25)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(centerX - 45, centerY - 15, 90, 60, 10);
      ctx.fill();
      ctx.stroke();

      // Candado
      ctx.fillStyle = '#f0abfc';
      ctx.fillRect(centerX - 12, centerY + 5, 24, 20);
      ctx.strokeStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(centerX, centerY + 5, 8, Math.PI, 0);
      ctx.stroke();

      // Partícula viajera
      const packetX = centerX - 120 + ((progress * 2) % 1) * 240;
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(packetX, centerY + 15, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#22d3ee';
      ctx.font = 'bold 13px "JetBrains Mono"';
      ctx.textAlign = 'center';
      ctx.fillText('Arquitectura Cloud & Redes', centerX, centerY + 115);
      ctx.restore();
    }
    // 4. Dominio: Base de Datos & Auto-Tuning
    else if (artwork === 'database_btree_autotuning' || artwork === 'data_masking_safe') {
      ctx.save();
      // Cilindro DB
      ctx.strokeStyle = '#8b5cf6';
      ctx.fillStyle = 'rgba(139, 92, 246, 0.25)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(centerX - 80, centerY - 30, 45, 15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeRect(centerX - 125, centerY - 30, 90, 60);

      // Velocidad
      ctx.fillStyle = '#34d399';
      ctx.font = 'bold 18px "JetBrains Mono"';
      ctx.fillText('2 ms', centerX + 60, centerY - 10);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px sans-serif';
      ctx.fillText('Auto-Tuning B-Tree', centerX + 60, centerY + 15);

      ctx.fillStyle = '#a855f7';
      ctx.font = 'bold 13px "JetBrains Mono"';
      ctx.textAlign = 'center';
      ctx.fillText('Autonomous Database & Data Safe', centerX, centerY + 95);
      ctx.restore();
    }
    // 3. Dominio: Biología, ADN & Células
    else if (artwork === 'science_biology') {
      ctx.save();
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 3;
      ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
      ctx.beginPath();
      ctx.arc(centerX, centerY, 70, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Órbitas / ADN
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, 80, 30, (progress * Math.PI), 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(centerX, centerY, 15, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#34d399';
      ctx.font = 'bold 13px "JetBrains Mono"';
      ctx.textAlign = 'center';
      ctx.fillText('Biología & Ciencia Celular', centerX, centerY + 115);
      ctx.restore();
    }
    // 4. Dominio: Libros & Literatura
    else if (artwork === 'book_literature') {
      ctx.save();
      ctx.fillStyle = '#fef3c7';
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 2.5;
      // Libro Abierto
      ctx.beginPath();
      ctx.moveTo(centerX - 70, centerY + 40);
      ctx.quadraticCurveTo(centerX, centerY + 20, centerX + 70, centerY + 40);
      ctx.lineTo(centerX + 65, centerY - 35);
      ctx.quadraticCurveTo(centerX, centerY - 55, centerX - 65, centerY - 35);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 13px "JetBrains Mono"';
      ctx.textAlign = 'center';
      ctx.fillText('Literatura & Narrativa', centerX, centerY + 115);
      ctx.restore();
    }
    // 5. Dominio: Trofeo, Logro & Certificación
    else if (artwork === 'badge_certification_trophy') {
      ctx.save();
      ctx.fillStyle = 'rgba(245, 158, 11, 0.4)';
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(centerX - 40, centerY - 40);
      ctx.lineTo(centerX + 40, centerY - 40);
      ctx.lineTo(centerX + 25, centerY + 20);
      ctx.quadraticCurveTo(centerX, centerY + 45, centerX - 25, centerY + 20);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(centerX, centerY - 10, 10, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 13px "JetBrains Mono"';
      ctx.textAlign = 'center';
      ctx.fillText('Síntesis & Certificación', centerX, centerY + 115);
      ctx.restore();
    }
    // 6. Dominio General: Generador Conceptual Dinámico
    // Universal: HUD Escáner Agnóstico Dinámico
    else {
      ctx.save();
      // Retícula circular exterior
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.arc(centerX, centerY, 65, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Círculo interior
      ctx.strokeStyle = '#8b5cf6';
      ctx.lineWidth = 2;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.beginPath();
      ctx.arc(centerX, centerY, 38, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Cruz de radar
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(centerX - 50, centerY);
      ctx.lineTo(centerX + 50, centerY);
      ctx.moveTo(centerX, centerY - 50);
      ctx.lineTo(centerX, centerY + 50);
      ctx.stroke();

      // Destello central
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(centerX, centerY, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // Puntos clave didácticos en recuadro
    if (scene.textoEnPantalla.puntosClave.length > 0) {
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '13px "Plus Jakarta Sans"';
      ctx.textAlign = 'left';
      scene.textoEnPantalla.puntosClave.slice(0, 2).forEach((pt: string, i: number) => {
        ctx.fillText(`● ${pt}`, x + 30, y + h - 35 + i * 20);
      });
    }
  }
}

export const videoExporter = new VideoExporter();

