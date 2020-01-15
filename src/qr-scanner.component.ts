import {
  AfterViewInit,
  Component, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output,
  ViewChild, Renderer2, ViewEncapsulation
} from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import { QRCode } from './lib/qr-decoder/qrcode';

enum State {
  NotSupported = 'NotSupported',
  SelectCamera = 'SelectCamera',
  Scan = 'Scan',
}

export interface QrScannerTexts {
  NotSupportedHTML: string;
  DeviceDefaultPrefix: string;
  StopCameraText: string;
  OpenButtonText: string;
}

@Component({
  selector: 'qr-scanner',
  styles: [
    ':host video {height: auto; width: 100%;}',
    ':host .mirrored { transform: rotateY(180deg); -webkit-transform:rotateY(180deg); -moz-transform:rotateY(180deg); }',
    ':host {}',
    '.cameraButtonDiv { position: absolute;align-content: center;width: 100%;padding: 5px 0px; z-index: 1000; }',
    '.buttonDiv { margin: 20px 0px;}'
  ],
  template: `
    <div style="text-align: -webkit-center;">
      <div [ngStyle]="{display: state === State.NotSupported ? 'block' : 'none'}">
        <p [innerHTML]="texts.NotSupportedHTML"></p>
      </div>
      <div class="cameraButtonDiv" [ngStyle]="{display: state === State.SelectCamera ? 'block' : 'none'}" *ngIf="allowUpload">
        <div class="buttonDiv">
          <app-qrupload [title]="texts.OpenButtonText"
          (error)="onUploadError($event)" (valueChange)="scanned($event)" [buttonClass]='buttonClass'></app-qrupload>
        </div>
        <div *ngIf="!disableScan">
          <div *ngFor="let device of cameraList; let i = index;" class="buttonDiv">
            <button (click)="changeCamera(device)" [ngClass]="buttonClass">
              {{ getLabel(device, i + 1) }}
            </button>
          </div>
        </div>
      </div>
      <div [ngStyle]="{display: state === State.Scan ? 'block' : 'none'}">
        <div class="cameraButtonDiv">
          <button (click)="stop()" [ngClass]="buttonClass">
            {{ texts.StopCameraText }}
          </button>
        </div>
        <div #videoWrapper [ngStyle]="{'maxWidth.px': canvasWidth, 'maxHeight.px': canvasHeight}">
        </div>
        <canvas #qrCanvas
        [ngStyle]="{'maxWidth.px': canvasWidth, 'maxHeight.px': canvasHeight}"
        [hidden]="true" [width]="canvasWidth" [height]="canvasHeight"></canvas>
      </div>
    </div>
      `,
  encapsulation: ViewEncapsulation.None
})
export class QrScannerComponent implements OnInit, OnDestroy, AfterViewInit {

  canvasWidth: number;
  canvasHeight: number;
  debug = false;
  updateTime = 300;
  showCanvas = false;
  state: State = State.SelectCamera;
  State = State;
  @Input() texts: QrScannerTexts = {
    NotSupportedHTML: `You are using an <strong>outdated</strong> browser.
    Please <a href="http://browsehappy.com/">upgrade your browser</a> to improve your experience.`,
    DeviceDefaultPrefix: `Camera`,
    StopCameraText: `Stop Camera`,
    OpenButtonText: `Select QR Code File...`
  };
  @Input() buttonClass: any;
  @Input() allowUpload = false;
  @Input() disableScan = false;

  @Output() capturedQr: EventEmitter<string> = new EventEmitter();
  @Output() error: EventEmitter<any> = new EventEmitter();
  @ViewChild('videoWrapper', { static: false }) videoWrapper: ElementRef;
  @ViewChild('qrCanvas', { static: false }) qrCanvas: ElementRef;

  chooseCamera: Subject<MediaDeviceInfo> = new Subject();

  private chooseCamera$: Subscription;
  public cameraList: MediaDeviceInfo[] = [];

  public gCtx: CanvasRenderingContext2D;
  public videoElement: HTMLVideoElement;
  public qrCode: QRCode;
  public stream: MediaStream;
  public captureTimeout: any;
  public canvasHidden = true;
  get isCanvasSupported(): boolean {
    const canvas = this.renderer.createElement('canvas');
    return !!(canvas.getContext && canvas.getContext('2d'));
  }

  constructor(private renderer: Renderer2) {
    this.canvasWidth = this.canvasWidth || Math.min(window.innerWidth, 640);
    this.canvasHeight = this.canvasHeight || Math.min(window.innerHeight, 480);
  }

  ngOnInit() {
  }

  onUploadError(error) {
    this.error.emit(error);
  }

  ngOnDestroy() {
    this.chooseCamera$.unsubscribe();
    this.stopScanning();
  }

  ngAfterViewInit() {
    if (this.debug) { console.log('[QrScanner] ViewInit, isSupported: ', this.isCanvasSupported); }
    if (this.isCanvasSupported) {
      this.state = State.SelectCamera;
      this.gCtx = this.qrCanvas.nativeElement.getContext('2d');
      this.gCtx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
      this.qrCode = new QRCode();
      if (this.debug) { this.qrCode.debug = true; }
      this.qrCode.myCallback = (decoded: string) => this.QrDecodeCallback(decoded);
    } else {
      this.state = State.NotSupported;
    }
    this.chooseCamera$ = this.chooseCamera.subscribe((camera: MediaDeviceInfo) => this.useDevice(camera));
    this.getMediaDevices().then(devices => {
      const mediaVideoKind = 'videoinput';

      this.cameraList = devices.filter((d: MediaDeviceInfo) => d && d.kind === mediaVideoKind);
    });
  }

  stop() {
    this.stopScanning();
    this.state = State.SelectCamera;
  }

  getLabel(device: MediaDeviceInfo, index: number) {
    const label = device.label;
    if (!(label.trim().length > 0)) {
      return `${this.texts.DeviceDefaultPrefix} ${index}`;
    }
    return label;
  }

  changeCamera(device: MediaDeviceInfo) {
    try {
      this.chooseCamera.next(device);
      this.state = State.Scan;
    } catch (err) {
      this.error.emit(err);
    }
  }

  startScanning(device: MediaDeviceInfo) {
    try {
      this.useDevice(device);
    } catch (error) {
      this.error.emit(error);
    }
  }

  stopScanning() {

    if (this.captureTimeout) {
      clearTimeout(this.captureTimeout);
      this.captureTimeout = 0;
    }
    this.canvasHidden = false;

    const stream = this.stream && this.stream.getTracks().length && this.stream;
    if (stream) {
      stream.getTracks().forEach(track => track.enabled && track.stop());
      this.stream = null;
    }
  }

  getMediaDevices(): Promise<MediaDeviceInfo[]> {
    try {

      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) { return Promise.resolve([]); }
      return navigator.mediaDevices.enumerateDevices()
        .then((devices: MediaDeviceInfo[]) => devices)
        .catch((error: any): any[] => {
          if (this.debug) { console.warn('Error', error); }
          return [];
        });
    } catch (err) {
      this.error.emit(err);
    }

  }

  public QrDecodeCallback(decoded: string) {
    this.stopScanning();
    this.capturedQr.next(decoded);
    this.state = State.SelectCamera;
  }


  async scanned(decoded: string) {
    this.stopScanning();
    this.capturedQr.next(decoded);
    this.state = State.SelectCamera;
  }

  private captureToCanvas() {
    try {
      this.gCtx.drawImage(this.videoElement, 0, 0, this.canvasWidth, this.canvasHeight);

      this.qrCode.decode(this.qrCanvas.nativeElement);
    } catch (e) {
      this.error.emit(e);
      if (this.debug) { console.log('[QrScanner] Thrown', e); }
      if (!this.stream) { return; }
      this.captureTimeout = setTimeout(() => this.captureToCanvas(), this.updateTime);
    }
  }

  private setStream(stream: any) {
    this.canvasHidden = true;
    this.gCtx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
    this.stream = stream;
    this.videoElement.srcObject = stream;
    this.captureTimeout = setTimeout(() => this.captureToCanvas(), this.updateTime);
  }

  private useDevice(_device: MediaDeviceInfo) {
    try {

      const _navigator: any = navigator;

      if (this.captureTimeout) {
        this.stopScanning();
      }

      if (!this.videoElement) {
        this.videoElement = this.renderer.createElement('video');
        this.videoElement.setAttribute('autoplay', 'true');
        this.videoElement.setAttribute('muted', 'true');
        this.renderer.appendChild(this.videoWrapper.nativeElement, this.videoElement);
      }
      const self = this;

      let constraints: MediaStreamConstraints;
      if (_device) {
        constraints = { audio: false, video: { deviceId: _device.deviceId } };
      } else {

        constraints = { audio: false, video: true };
      }
      _navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {
        self.setStream(stream);
      }).catch(function (err) {
        return self.debug && console.warn('Error', err);
      });
    } catch (err) {
      this.error.emit(err);
    }
  }

}
