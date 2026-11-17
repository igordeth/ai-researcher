import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ConsumoDiarioDeTokens } from './consumo-diario.js';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ConsumoDiarioDeTokens', () => {
  it('soma os tokens do dia', () => {
    vi.setSystemTime(new Date('2026-11-17T10:00:00Z'));
    const consumo = new ConsumoDiarioDeTokens();

    consumo.somar(1050);
    consumo.somar(3600);

    expect(consumo.tokensHoje()).toBe(4650);
  });

  it('zera na virada do dia UTC, e não na meia-noite de Brasília', () => {
    // 02:00 UTC do dia 17 ainda é 23:00 do dia 16 em Brasília (UTC-3).
    vi.setSystemTime(new Date('2026-11-17T02:00:00Z'));
    const consumo = new ConsumoDiarioDeTokens();
    consumo.somar(1000);

    // Passou a meia-noite de Brasília (00:30 do dia 17 lá), mas o dia UTC é o mesmo: não zera.
    vi.setSystemTime(new Date('2026-11-17T03:30:00Z'));
    expect(consumo.tokensHoje()).toBe(1000);
    vi.setSystemTime(new Date('2026-11-17T23:59:59.999Z'));
    expect(consumo.tokensHoje()).toBe(1000);

    vi.setSystemTime(new Date('2026-11-18T00:00:00Z'));
    expect(consumo.tokensHoje()).toBe(0);
  });

  it('o primeiro somar depois da virada já conta no dia novo', () => {
    vi.setSystemTime(new Date('2026-11-17T20:00:00Z'));
    const consumo = new ConsumoDiarioDeTokens();
    consumo.somar(1000);

    vi.setSystemTime(new Date('2026-11-18T08:00:00Z'));
    consumo.somar(50);

    expect(consumo.tokensHoje()).toBe(50);
  });

  it('diz quantos segundos faltam para a meia-noite UTC', () => {
    vi.setSystemTime(new Date('2026-11-17T23:59:00Z'));
    expect(new ConsumoDiarioDeTokens().segundosAteZerar()).toBe(60);

    vi.setSystemTime(new Date('2026-11-17T00:00:00Z'));
    expect(new ConsumoDiarioDeTokens().segundosAteZerar()).toBe(24 * 60 * 60);
  });
});
