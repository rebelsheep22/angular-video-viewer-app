import { Component, ElementRef, Input, ViewChild } from '@angular/core';

@Component({
  selector: 'app-video-player',
  standalone: true,
  imports: [],
  templateUrl: './video-player.component.html',
  styleUrl: './video-player.component.scss'
})
export class VideoPlayerComponent {
  @Input() videoSrc: string = '';
  @ViewChild('videoPlayer') videoPlayer!: ElementRef;

  playVideo() {
    this.videoPlayer.nativeElement.play();
  }

  pauseVideo() {
    this.videoPlayer.nativeElement.pause();
  }

  muteVideo() {
    this.videoPlayer.nativeElement.muted = true;
  }

  unmuteVideo() {
    this.videoPlayer.nativeElement.muted = false;
  }

  adjustVolume(event: any) {
    this.videoPlayer.nativeElement.volume = event.target.value;
  }
}
