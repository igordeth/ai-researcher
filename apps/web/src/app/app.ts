import { Component } from '@angular/core';
import { Chat } from './chat/chat';

@Component({
  selector: 'app-root',
  imports: [Chat],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
