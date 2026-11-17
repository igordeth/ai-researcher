import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Health } from './health';

describe('Health', () => {
  let fixture: ComponentFixture<Health>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Health],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Health);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  async function texto(): Promise<string> {
    await fixture.whenStable();
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('renderiza o status vindo de /api/health, sem tocar rede de verdade', async () => {
    httpMock.expectOne('/api/health').flush({ status: 'ok', database: 'ok' });

    const conteudo = await texto();

    expect(conteudo).toContain('status: ok');
    expect(conteudo).toContain('database: ok');
  });

  it('mostra o degraded quando o banco falha', async () => {
    httpMock.expectOne('/api/health').flush({ status: 'degraded', database: 'error' });

    expect(await texto()).toContain('status: degraded · database: error');
  });

  it('avisa quando não consegue consultar a API', async () => {
    httpMock
      .expectOne('/api/health')
      .flush('erro', { status: 503, statusText: 'Service Unavailable' });

    expect(await texto()).toContain('Não foi possível consultar /api/health.');
  });
});
