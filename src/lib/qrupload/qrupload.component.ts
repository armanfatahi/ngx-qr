import { Component, Output, EventEmitter, ViewEncapsulation, Input } from '@angular/core';
import { QRCode } from '../qr-decoder/qrcode';

@Component({
  selector: 'app-qrupload',
  templateUrl: './qrupload.component.html',
  styleUrls: ['./qrupload.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class QrUploadComponent {

  _value: string;
  set value(value) {
    this._value = value;
    this.valueChange.emit(value);
  }
  get value(): string {
    return this._value;
  }

  qrCode = new QRCode();

  @Output() valueChange = new EventEmitter<string>();
  @Input() buttonClass: any;
  @Input() title: string;
  acceptedMimeTypes = [
    'image/gif',
    'image/jpeg',
    'image/png'
  ];
  img = new Image();

  constructor() {  }

  pick(evt) {
    const file = (evt.target.files[0] as File);
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = (event: any) => {
      const target = event.target;
      const url = target.result;
      this.read(url);
    };
    reader.readAsDataURL(file);
  }

  async read(url: string) {
    this.img.onload = () => {
      try {
        const qrCanvas = document.createElement('canvas');
        qrCanvas.width = this.img.width;
        qrCanvas.height = this.img.height;
        const gCtx = qrCanvas.getContext('2d');
        gCtx.drawImage(this.img, 0, 0);
        const decoded = this.qrCode.decode(qrCanvas);
        this.value = decoded;
      } catch (error) {
        this.value = undefined;
      }
    };
    this.img.src = url;
  }

}
