import { Component, inject, resource } from '@angular/core';
import { HealthService } from '../api/health.service';

/**
 * Página /health: o status da API e do banco, vindo de /api/health. É o walking skeleton do
 * Bloco C, que antes ficava solto no app.html: a prova de que o front alcança a API pelo proxy.
 */
@Component({
  selector: 'app-health',
  imports: [],
  templateUrl: './health.html',
  styleUrl: './health.scss',
})
export class Health {
  private readonly healthService = inject(HealthService);

  protected readonly health = resource({
    loader: () => this.healthService.fetchHealth(),
  });
}
