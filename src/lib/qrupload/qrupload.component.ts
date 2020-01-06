import { Component, OnInit, Output, EventEmitter, ViewEncapsulation, Input } from '@angular/core';
import { QRCodeDecode } from './qrcodedecode';

@Component({
  selector: 'app-qrupload',
  templateUrl: './qrupload.component.html',
  styleUrls: ['./qrupload.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class QrUploadComponent implements OnInit {

  _value: string;
  set value(value) {
    this._value = value;
    this.valueChange.emit(value);
  }
  get value(): string {
    return this._value;
  }

  @Output() valueChange = new EventEmitter<string>();
  @Input() buttonClass: any;
  @Input() title: string;
  url: string;
  fileName: string;
  fileNameDisplay: string;
  appWidth = 100;
  appHeight = 50;
  appUploading: false;
  hasPhoto = false;
  isEditingName = false;
  original_name: string;
  acceptedMimeTypes = [
    'image/gif',
    'image/jpeg',
    'image/png'
  ];


  src: string;
  ocanvas = document.createElement('canvas');
  octx = this.ocanvas.getContext('2d');
  img = new Image();
  qr = new QRCodeDecode();


  constructor() {
    this.ocanvas.width = 555;
    this.ocanvas.height = 555;

    this.img.width = 555;
    this.img.height = 555;

  }

  pick(evt) {
    const file = (evt.target.files[0] as File);
    if (!file) {
      return;
    }
    this.fileName = file.name;
    this.fileNameDisplay = this.trimFileName(file.name);
    const that = this;
    const reader = new FileReader();
    reader.onload = function (event: any) {
      const target = event.target;
      const url = target.result;
      // that.url = url;
      that.hasPhoto = true;
      that.read(url);
    };
    reader.readAsDataURL(file);
  }


  async read(url: string) {
    this.img.onload = () => {
      try {

        this.octx.drawImage(this.img, 0, 0);
        const imagedata = this.octx.getImageData(0, 0, 555, 555);
        const decoded = this.qr.decodeImageDataInsideBordersWithMaxVersion(imagedata, 555, 555, 60, 494, 60, 494, 5);
        if (decoded) {
          this.url = this.ocanvas.toDataURL();
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

  trimFileName(name: string): string {
    if (name.length < 30) {
      return name;
    } else {
      let tempName = name.substring(0, 15);
      tempName += '...';
      tempName += name.substring(name.length - 7, name.length);
      return tempName;
    }

  }

  private validateFile(file) {
    const _1MB = 1024 * 1024;
    const limit = _1MB * 10;
    return this.acceptedMimeTypes.includes(file.type) && file.size < limit;
  }

  onPhotoError() {
    this.hasPhoto = false;
  }

  ngOnInit() {

  }

}
