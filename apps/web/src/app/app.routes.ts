import type { Routes } from '@angular/router';
import { Chat } from './chat/chat';
import { Health } from './health/health';

export const routes: Routes = [
  { path: '', component: Chat },
  { path: 'health', component: Health },
];
