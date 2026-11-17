import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { App } from './app';
import { routes } from './app.routes';

describe('rotas do App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('o App só tem o router-outlet', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).not.toBeNull();
    expect(compiled.querySelector('app-chat')).toBeNull();
  });

  it("'' abre o chat", async () => {
    const harness = await RouterTestingHarness.create('');

    expect(harness.routeNativeElement?.querySelector('.wordmark')?.textContent?.trim()).toBe(
      'AI RESEARCHER',
    );
  });

  it("'health' abre a página de status, que consulta /api/health", async () => {
    const harness = await RouterTestingHarness.create('/health');
    const httpMock = TestBed.inject(HttpTestingController);

    httpMock.expectOne('/api/health').flush({ status: 'ok', database: 'ok' });
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(harness.routeNativeElement?.textContent).toContain('status: ok · database: ok');
    httpMock.verify();
  });

  it('o chat não consulta /api/health', async () => {
    await RouterTestingHarness.create('');

    TestBed.inject(HttpTestingController).verify();
  });
});
