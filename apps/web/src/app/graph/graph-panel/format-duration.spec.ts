import { formatDuration } from './format-duration';

describe('formatDuration', () => {
  it('abaixo de um segundo, em milissegundos inteiros', () => {
    expect(formatDuration(0)).toBe('0 ms');
    expect(formatDuration(849.6)).toBe('850 ms');
    expect(formatDuration(999)).toBe('999 ms');
  });

  it('até um minuto, em segundos com uma casa e vírgula decimal', () => {
    expect(formatDuration(1_000)).toBe('1,0 s');
    expect(formatDuration(1_240)).toBe('1,2 s');
    expect(formatDuration(59_940)).toBe('59,9 s');
  });

  it('a partir de um minuto, em minutos e segundos', () => {
    expect(formatDuration(59_960)).toBe('1 min 00 s');
    expect(formatDuration(65_000)).toBe('1 min 05 s');
    expect(formatDuration(125_400)).toBe('2 min 05 s');
  });

  it('uma duração negativa (relógio do sistema ajustado a meio) conta como zero', () => {
    expect(formatDuration(-20)).toBe('0 ms');
  });
});
