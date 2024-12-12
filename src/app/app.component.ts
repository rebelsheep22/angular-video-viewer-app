import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import VideoEditorComponent from './components/video-editor/video-editor.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [VideoEditorComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'angular-video-viewer-app';
}
