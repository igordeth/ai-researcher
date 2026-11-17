import { ComponentFixture, TestBed } from '@angular/core/testing';

import type { GraphEvent } from '../../api/chat.service';
import { GraphStore } from '../../state/graph-store';
import { GraphPanel } from './graph-panel';

const RETRIEVE: GraphEvent = { type: 'retrieve', documents: [] };
const WEB_SEARCH: GraphEvent = { type: 'webSearch' };

function grade(sufficient: boolean, iterations: number): GraphEvent {
  return { type: 'grade', sufficient, missingAspects: [], iterations };
}

describe('GraphPanel', () => {
  let fixture: ComponentFixture<GraphPanel>;
  let elemento: HTMLElement;
  let store: GraphStore;

  beforeEach(async () => {
    vi.useFakeTimers({ now: 0 });
    await TestBed.configureTestingModule({ imports: [GraphPanel] }).compileComponents();

    store = TestBed.inject(GraphStore);
    fixture = TestBed.createComponent(GraphPanel);
    elemento = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function atualizar(): void {
    fixture.detectChanges();
  }

  function etapas(): HTMLElement[] {
    return Array.from(elemento.querySelectorAll<HTMLElement>('li.etapa'));
  }

  function texto(etapa: HTMLElement, seletor: string): string {
    return etapa.querySelector(seletor)?.textContent?.trim() ?? '';
  }

  it('é conteúdo complementar, com o título como nome acessível', () => {
    expect(elemento.getAttribute('role')).toBe('complementary');
    expect(elemento.getAttribute('aria-labelledby')).toBe('pipeline-titulo');
    expect(elemento.querySelector('#pipeline-titulo')?.textContent).toContain(
      'Pipeline de raciocínio',
    );
  });

  it('antes da primeira pergunta, avisa que as etapas aparecem ali', () => {
    expect(etapas()).toHaveLength(0);
    expect(elemento.querySelector('.vazio')).not.toBeNull();
  });

  it('a etapa em execução tem o spinner, o rótulo, a descrição e a tag Em execução', () => {
    store.start();
    atualizar();
    const [retrieve] = etapas();

    expect(retrieve.getAttribute('data-estado')).toBe('running');
    expect(retrieve.querySelector('.etapa__spinner')).not.toBeNull();
    expect(texto(retrieve, '.etapa__nome')).toBe('Retrieve');
    expect(texto(retrieve, '.etapa__descricao')).toContain('Busca vetorial');
    expect(texto(retrieve, '.etapa__tag')).toBe('Em execução');
    expect(elemento.querySelector('.vazio')).toBeNull();
  });

  it('a etapa concluída troca o spinner pelo check e mostra a duração', () => {
    store.start();
    vi.advanceTimersByTime(850);
    store.apply(RETRIEVE);
    atualizar();
    const [retrieve, grade] = etapas();

    expect(retrieve.getAttribute('data-estado')).toBe('done');
    expect(retrieve.querySelector('.etapa__spinner')).toBeNull();
    expect(retrieve.querySelector('polyline')).not.toBeNull();
    expect(texto(retrieve, '.etapa__tag')).toBe('Concluído');
    expect(texto(retrieve, '.etapa__duracao')).toBe('· 850 ms');

    // A seguinte, ainda a correr, não tem duração.
    expect(grade.getAttribute('data-estado')).toBe('running');
    expect(grade.querySelector('.etapa__duracao')).toBeNull();
  });

  it('sem webSearch, não mostra o aviso de contexto insuficiente', () => {
    store.start();
    store.apply(RETRIEVE);
    store.apply(grade(true, 1));
    atualizar();

    expect(elemento.querySelector('.aviso-web')).toBeNull();
  });

  it('com webSearch, mostra o aviso e marca a etapa como fallback', () => {
    store.start();
    store.apply(RETRIEVE);
    store.apply(grade(false, 1));
    atualizar();

    expect(elemento.querySelector('.aviso-web')?.textContent).toContain(
      'Contexto local insuficiente',
    );
    const search = etapas()[2];
    expect(texto(search, '.etapa__nome')).toBe('Search');
    expect(texto(search, '.etapa__tag')).toBe('Fallback ativo');

    store.apply(WEB_SEARCH);
    atualizar();
    expect(texto(etapas()[2], '.etapa__tag')).toBe('Fallback usado');
  });

  it('a volta pela web abre a 2ª rodada abaixo da primeira, sem a sobrescrever', () => {
    store.start();
    for (const event of [RETRIEVE, grade(false, 1), WEB_SEARCH, RETRIEVE]) store.apply(event);
    atualizar();

    expect(etapas().map((etapa) => texto(etapa, '.etapa__nome'))).toEqual([
      'Retrieve',
      'Grade',
      'Search',
      'Retrieve',
      'Grade',
    ]);
    const rodadas = Array.from(elemento.querySelectorAll('li.rodada'));
    expect(rodadas.map((rodada) => rodada.textContent?.trim())).toEqual(['2ª rodada']);
  });

  it('a etapa interrompida perde o spinner e mostra a tag Interrompido', () => {
    store.start();
    store.interrupt();
    atualizar();
    const [retrieve] = etapas();

    expect(retrieve.getAttribute('data-estado')).toBe('interrupted');
    expect(retrieve.querySelector('.etapa__spinner')).toBeNull();
    expect(texto(retrieve, '.etapa__tag')).toBe('Interrompido');
    expect(retrieve.querySelector('.etapa__duracao')).toBeNull();
  });
});
