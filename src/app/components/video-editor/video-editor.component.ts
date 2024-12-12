// video-editor.component.ts
import { Component, ViewChild, ElementRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
interface AudioEffect {
  name: string;
  apply: (audioContext: AudioContext, sourceNode: MediaElementAudioSourceNode) => AudioNode[];
}
@Component({
  selector: 'app-video-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './video-editor.component.html',
  styleUrl: './video-editor.component.scss'
})
export class VideoEditorComponent {
  @ViewChild('videoPlayer') videoPlayer!: ElementRef<HTMLVideoElement>;
  @ViewChild('audioVisualizerCanvas') audioVisualizerCanvas!: ElementRef<HTMLCanvasElement>;

  videoSrc = signal<string | null>(null);
  clippedVideoSrc = signal<string | null>(null);
  videoDuration = signal<number>(0);
  playbackSpeed = signal<number>(1);
  clipStart = signal<number>(0);
  clipEnd = signal<number>(0);
  audioVolume = signal<number>(1);
  selectedAudioEffect = signal<string>('');

  private audioContext: AudioContext | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private activeEffectNodes: AudioNode[] = [];
  
  onVideoUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      this.videoSrc.set(URL.createObjectURL(file));
    }
  }

  onVideoMetadataLoaded(event: Event) {
    const video = event.target as HTMLVideoElement;
    this.videoDuration.set(video.duration);
    this.clipEnd.set(video.duration);
    this.setupAudioContext(video);

  }

  createClip() {
    if (!this.videoSrc()) return;

    const video = this.videoPlayer.nativeElement;
    const start = this.clipStart();
    const end = this.clipEnd();

    // Reset video to start of clip
    video.currentTime = start;

    // Create a temporary canvas to draw video frames
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return;

    // Array to store video chunks
    const chunks: Blob[] = [];

    // Create media recorder
    const stream = canvas.captureStream();
    const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      // Combine chunks into a single blob
      const blob = new Blob(chunks, { type: 'video/webm' });
      const videoURL = URL.createObjectURL(blob);
      this.clippedVideoSrc.set(videoURL);
    };

    // Start recording
    mediaRecorder.start();

    const drawFrame = () => {
      if (video.currentTime >= end) {
        mediaRecorder.stop();
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      video.requestVideoFrameCallback(drawFrame);
    };

    video.requestVideoFrameCallback(drawFrame);
  }

  downloadClip() {
    if (!this.clippedVideoSrc()) return;

    const link = document.createElement('a');
    link.href = this.clippedVideoSrc()!;
    link.download = 'video_clip.webm';
    link.click();
  }

  private audioEffects: { [key: string]: AudioEffect } = {
    lowPass: {
      name: 'Low Pass Filter',
      apply: (audioContext, sourceNode) => {
        const filter = audioContext.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1000, audioContext.currentTime);
        sourceNode.connect(filter);
        return [filter];
      }
    },
    highPass: {
      name: 'High Pass Filter',
      apply: (audioContext, sourceNode) => {
        const filter = audioContext.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(1000, audioContext.currentTime);
        sourceNode.connect(filter);
        return [filter];
      }
    },
    distortion: {
      name: 'Audio Distortion',
      apply: (audioContext, sourceNode) => {
        const distortion = audioContext.createWaveShaper();
        distortion.curve = this.makeDistortionCurve(400);
        sourceNode.connect(distortion);
        return [distortion];
      }
    },
  };
  setupAudioContext(videoElement: HTMLVideoElement) {
    // Create audio context
    this.audioContext = new AudioContext();
    
    // Create source node from video
    this.sourceNode = this.audioContext.createMediaElementSource(videoElement);
    
    // Create analyser for visualization
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;

    // Connect nodes
    this.sourceNode.connect(this.analyser);
    this.analyser.connect(this.audioContext.destination);
  }
  adjustVolume(volume: number) {
    this.audioVolume.set(volume);
    
    // If audio context exists, modify gain
    if (this.sourceNode) {
      const gainNode = this.audioContext!.createGain();
      gainNode.gain.setValueAtTime(volume, this.audioContext!.currentTime);
      
      // Reconnect audio path with new gain
      this.sourceNode.disconnect();
      this.sourceNode.connect(gainNode);
      gainNode.connect(this.audioContext!.destination);
    }
  }
  applyAudioEffect() {
    // Clear previous effects
    this.clearAudioEffects();

    const effectName = this.selectedAudioEffect();
    if (!effectName || !this.sourceNode || !this.audioContext) return;

    // Apply selected effect
    const effect = this.audioEffects[effectName];
    if (effect) {
      this.activeEffectNodes = effect.apply(this.audioContext, this.sourceNode);
      
      // Reconnect to destination
      const lastNode = this.activeEffectNodes[this.activeEffectNodes.length - 1];
      lastNode.connect(this.audioContext.destination);
    }
  }
  clearAudioEffects() {
    if (this.activeEffectNodes.length && this.sourceNode) {
      this.activeEffectNodes.forEach(node => {
        try {
          node.disconnect();
        } catch (error) {
          console.warn('Error disconnecting audio node', error);
        }
      });
      this.activeEffectNodes = [];
    }
  }

  visualizeAudio() {
    if (!this.analyser) return;

    const canvas = this.audioVisualizerCanvas.nativeElement;
    const canvasCtx = canvas.getContext('2d');
    if (!canvasCtx) return;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const WIDTH = canvas.width;
    const HEIGHT = canvas.height;

    canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);

    const draw = () => {
      requestAnimationFrame(draw);

      this.analyser!.getByteFrequencyData(dataArray);

      canvasCtx.fillStyle = 'rgb(0, 0, 0)';
      canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

      const barWidth = (WIDTH / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for(let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i] / 2;

        canvasCtx.fillStyle = `rgb(${barHeight + 100},50,50)`;
        canvasCtx.fillRect(x, HEIGHT - barHeight, barWidth, barHeight);

        x += barWidth + 1;
      }
    };

    draw();
  }

  private makeDistortionCurve(amount: number) {
    const samples = 44100;
    const curve = new Float32Array(samples);
    const deg = Math.PI / 180;

    for (let i = 0; i < samples; ++i ) {
      const x = i * 2 / samples - 1;
      curve[i] = (3 + amount) * x * 20 * deg / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  }

}






export default VideoEditorComponent;