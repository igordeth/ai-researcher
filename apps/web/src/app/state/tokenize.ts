/**
 * Parte o texto nas unidades que a revelação mostra uma a uma: cada palavra com o espaço que vem a
 * seguir. O espaço vai colado à palavra, e não como token próprio, para cada passo da revelação
 * acrescentar uma palavra visível, e não às vezes só um espaço.
 *
 * Nada se perde: juntar os tokens devolve o texto original, com as quebras de linha e os espaços
 * do início. Um texto vazio, ou só com espaços, não tem palavra nenhuma e devolve [].
 */
export function tokenize(text: string): string[] {
  // \s* no início só apanha alguma coisa no primeiro token: os seguintes começam logo na palavra,
  // porque o \s* do fim do token anterior já consumiu o espaço.
  return text.match(/\s*\S+\s*/g) ?? [];
}
