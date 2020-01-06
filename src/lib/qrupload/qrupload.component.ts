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


  constructor() {
    this.img.width = 555;
    this.img.height = 555;

  }

  pick(evt) {
    const file = (evt.target.files[0] as File);
    if (!file) {
      return;
    }
    const that = this;
    const reader = new FileReader();
    reader.onload = function (event: any) {
      const target = event.target;
      const url = target.result;
      that.read(url);
    };
    reader.readAsDataURL(file);
  }


  async read(url: string) {
    this.img.onload = () => {
      try {
        const qrCanvas = document.createElement('canvas');
        qrCanvas.width = 555;
        qrCanvas.height = 555;
        const gCtx = qrCanvas.getContext('2d');
        gCtx.drawImage(this.img, 0, 0);
        const decoded = this.qrCode.decode(qrCanvas);
        if (decoded) {
          this.value = decoded;
        } else {
          console.log('Invalid QR');
        }
      } catch (error) {
        console.log(error);
        console.log('Invalid QR');
      }
    };
    this.img.src = url;
  }

}
