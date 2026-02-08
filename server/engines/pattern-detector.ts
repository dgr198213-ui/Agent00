/**
 * Detector de Patrones Multi-Dimensional
 * Detecta patrones secuenciales, temporales, de frecuencia y contextuales
 */

import type { Interaction, Pattern, Rule } from "@shared/types";
import { PatternType } from "@shared/types";
import { nanoid } from "nanoid";

// ============================================================================
// TIPOS INTERNOS
// ============================================================================

interface SequentialPatternData {
  sequence: string[];
  averageTimeBetweenActions: number;
}

interface TemporalPatternData {
  timeSlot: 'morning' | 'afternoon' | 'evening' | 'night';
  concentrationPercentage: number;
}

interface FrequencyPatternData {
  actionType: string;
  averagePerDay: number;
}

interface ContextualPatternData {
  keywords: string[];
  relatedActions: string[];
}

// ============================================================================
// PATTERN DETECTOR
// ============================================================================

export class PatternDetector {
  private readonly SEQUENTIAL_WINDOW = 100; // Últimas 100 interacciones
  private readonly MIN_OCCURRENCES = 3;
  private readonly MIN_CONFIDENCE = 0.6;
  private readonly SEQUENCE_LENGTH_RANGE = [2, 4]; // 2-4 acciones

  detectPatterns(interactions: Interaction[]): Pattern[] {
    if (interactions.length === 0) return [];

    const patterns: Pattern[] = [];

    // Detectar patrones secuenciales
    patterns.push(...this.detectSequentialPatterns(interactions));

    // Detectar patrones temporales
    patterns.push(...this.detectTemporalPatterns(interactions));

    // Detectar patrones de frecuencia
    patterns.push(...this.detectFrequencyPatterns(interactions));

    // Detectar patrones contextuales
    patterns.push(...this.detectContextualPatterns(interactions));

    // Filtrar por calidad
    return patterns.filter(p => p.confidence >= this.MIN_CONFIDENCE && p.occurrences >= this.MIN_OCCURRENCES);
  }

  private detectSequentialPatterns(interactions: Interaction[]): Pattern[] {
    const patterns: Pattern[] = [];
    const recentInteractions = interactions.slice(-this.SEQUENTIAL_WINDOW);

    if (recentInteractions.length < 2) return patterns;

    // Buscar secuencias de 2-4 acciones
    for (let seqLen = this.SEQUENCE_LENGTH_RANGE[0]; seqLen <= this.SEQUENCE_LENGTH_RANGE[1]; seqLen++) {
      const sequenceMap = new Map<string, { count: number; times: number[] }>();

      for (let i = 0; i <= recentInteractions.length - seqLen; i++) {
        const sequence = recentInteractions
          .slice(i, i + seqLen)
          .map(int => int.type)
          .join(' → ');

        const times = [];
        for (let j = 1; j < seqLen; j++) {
          const timeDiff = recentInteractions[i + j].timestamp.getTime() - recentInteractions[i + j - 1].timestamp.getTime();
          times.push(timeDiff);
        }

        if (!sequenceMap.has(sequence)) {
          sequenceMap.set(sequence, { count: 0, times: [] });
        }

        const entry = sequenceMap.get(sequence)!;
        entry.count++;
        entry.times = entry.times.concat(times);
      }

      // Crear patrones para secuencias frecuentes
      const seqEntries = Array.from(sequenceMap.entries());
      for (const seqEntry of seqEntries) {
        const sequence = seqEntry[0];
        const data = seqEntry[1];
        if (data.count >= this.MIN_OCCURRENCES) {
          const confidence = Math.min(1, data.count / (recentInteractions.length / seqLen));
          const avgTime = data.times.reduce((a: number, b: number) => a + b, 0) / data.times.length;

          const sequenceParts = sequence.split(' → ');
          const patternData: SequentialPatternData = {
            sequence: sequenceParts,
            averageTimeBetweenActions: avgTime,
          };

          patterns.push({
            id: nanoid(),
            type: PatternType.SEQUENTIAL,
            name: `Secuencia: ${sequence}`,
            description: `El usuario realiza ${sequence} consistentemente`,
            confidence,
            occurrences: data.count,
            lastDetected: new Date(),
            suggestedRule: this.generateRuleFromSequence(sequenceParts, confidence),
            metadata: patternData as unknown as Record<string, unknown>,
          });
        }
      }
    }

    return patterns;
  }

  private detectTemporalPatterns(interactions: Interaction[]): Pattern[] {
    const patterns: Pattern[] = [];

    if (interactions.length === 0) return patterns;

    // Agrupar por tipo de acción y horario
    const actionTimeMap = new Map<string, { morning: number; afternoon: number; evening: number; night: number }>();

    for (const interaction of interactions) {
      const hour = interaction.timestamp.getHours();
      let timeSlot: 'morning' | 'afternoon' | 'evening' | 'night';

      if (hour >= 6 && hour < 12) timeSlot = 'morning';
      else if (hour >= 12 && hour < 18) timeSlot = 'afternoon';
      else if (hour >= 18 && hour < 21) timeSlot = 'evening';
      else timeSlot = 'night';

      if (!actionTimeMap.has(interaction.type)) {
        actionTimeMap.set(interaction.type, { morning: 0, afternoon: 0, evening: 0, night: 0 });
      }

      const entry = actionTimeMap.get(interaction.type)!;
      entry[timeSlot]++;
    }

    // Crear patrones para acciones con concentración temporal
    const actionEntries = Array.from(actionTimeMap.entries());
    for (const actionEntry of actionEntries) {
      const actionType = actionEntry[0];
      const distribution = actionEntry[1];
      const total = distribution.morning + distribution.afternoon + distribution.evening + distribution.night;
      const slots = Object.entries(distribution) as Array<[string, number]>;

      for (const slotEntry of slots) {
        const [slotStr, count] = slotEntry;
        const percentage = (count / total) * 100;

        if (percentage >= 60) {
          const confidence = Math.min(1, percentage / 100);
          const slot = slotStr as 'morning' | 'afternoon' | 'evening' | 'night';

          const patternData: TemporalPatternData = {
            timeSlot: slot,
            concentrationPercentage: percentage,
          };

          patterns.push({
            id: nanoid(),
            type: PatternType.TEMPORAL,
            name: `Rutina: ${actionType}`,
            description: `${actionType} ocurre principalmente en ${this.getTimeSlotName(slot)}`,
            confidence,
            occurrences: count,
            lastDetected: new Date(),
            metadata: patternData as unknown as Record<string, unknown>,
          });
        }
      }
    }

    return patterns;
  }

  private detectFrequencyPatterns(interactions: Interaction[]): Pattern[] {
    const patterns: Pattern[] = [];

    if (interactions.length === 0) return patterns;

    // Calcular frecuencia por día
    const dayMap = new Map<string, Map<string, number>>();

    for (const interaction of interactions) {
      const dateKey = interaction.timestamp.toISOString().split('T')[0];

      if (!dayMap.has(dateKey)) {
        dayMap.set(dateKey, new Map());
      }

      const dayActions = dayMap.get(dateKey)!;
      dayActions.set(interaction.type, (dayActions.get(interaction.type) || 0) + 1);
    }

    // Calcular promedio por acción
    const actionFrequency = new Map<string, number[]>();

    const dayEntries = Array.from(dayMap.values());
    for (const dayActions of dayEntries) {
      const actionEntries = Array.from(dayActions.entries());
      for (const actionEntry of actionEntries) {
        const actionType = actionEntry[0];
        const count = actionEntry[1];
        if (!actionFrequency.has(actionType)) {
          actionFrequency.set(actionType, []);
        }
        actionFrequency.get(actionType)!.push(count);
      }
    }

    // Crear patrones para acciones de alta frecuencia
    const freqEntries = Array.from(actionFrequency.entries());
    for (const freqEntry of freqEntries) {
      const actionType = freqEntry[0];
      const frequencies = freqEntry[1];
      const averagePerDay = frequencies.reduce((a: number, b: number) => a + b, 0) / frequencies.length;

      if (averagePerDay > 1) {
        const confidence = Math.min(1, averagePerDay / 10); // Normalizar a máximo 10/día

        const patternData: FrequencyPatternData = {
          actionType,
          averagePerDay,
        };

        patterns.push({
          id: nanoid(),
          type: PatternType.FREQUENCY,
          name: `Frecuencia: ${actionType}`,
          description: `${actionType} ocurre ~${averagePerDay.toFixed(1)} veces/día`,
          confidence,
          occurrences: frequencies.length,
          lastDetected: new Date(),
          metadata: patternData as unknown as Record<string, unknown>,
        });
      }
    }

    return patterns;
  }

  private detectContextualPatterns(interactions: Interaction[]): Pattern[] {
    const patterns: Pattern[] = [];

    if (interactions.length === 0) return patterns;

    // Extraer keywords de descripciones
    const keywordMap = new Map<string, { actions: Set<string>; count: number }>();

    for (const interaction of interactions) {
      const keywords = this.extractKeywords(interaction.description);

      for (const keyword of keywords) {
        if (!keywordMap.has(keyword)) {
          keywordMap.set(keyword, { actions: new Set(), count: 0 });
        }

        const entry = keywordMap.get(keyword)!;
        entry.actions.add(interaction.type);
        entry.count++;
      }
    }

    // Crear patrones para keywords frecuentes
    const keywordEntries = Array.from(keywordMap.entries());
    for (const entry of keywordEntries) {
      const keyword = entry[0];
      const data = entry[1];
      if (data.count >= this.MIN_OCCURRENCES) {
        const confidence = Math.min(1, data.count / interactions.length);

        const patternData: ContextualPatternData = {
          keywords: [keyword],
          relatedActions: Array.from(data.actions) as string[],
        };

        patterns.push({
          id: nanoid(),
          type: PatternType.CONTEXTUAL,
          name: `Contexto: ${keyword}`,
          description: `Acciones relacionadas con "${keyword}"`,
          confidence,
          occurrences: data.count,
          lastDetected: new Date(),
          metadata: patternData as unknown as Record<string, unknown>,
        });
      }
    }

    return patterns;
  }

  private extractKeywords(text: string): string[] {
    // Palabras comunes a ignorar
    const stopwords = new Set(['el', 'la', 'de', 'a', 'en', 'y', 'o', 'un', 'una', 'los', 'las', 'del', 'al', 'es', 'son', 'está', 'están']);

    const words = text.toLowerCase().split(/\W+/).filter(w => w.length > 3 && !stopwords.has(w));

    return Array.from(new Set(words));
  }

  private generateRuleFromSequence(sequence: string[], confidence: number): Partial<Rule> {
    const condition = sequence.map(action => `action.type == '${action}'`).join(' or ');

    return {
      name: `Auto-generada: ${sequence.join(' → ')}`,
      description: `Regla generada automáticamente desde patrón detectado`,
      condition,
      behavior: `Ejecutar secuencia: ${sequence.join(' → ')}`,
      priority: Math.round(confidence * 100),
      confidence,
    };
  }

  private getTimeSlotName(slot: 'morning' | 'afternoon' | 'evening' | 'night'): string {
    const names: Record<string, string> = {
      morning: 'la mañana',
      afternoon: 'la tarde',
      evening: 'la noche',
      night: 'la madrugada',
    };
    return names[slot];
  }
}
