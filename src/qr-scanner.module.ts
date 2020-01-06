import {ModuleWithProviders, NgModule} from '@angular/core';
import { CommonModule } from '@angular/common';
import { QrScannerComponent } from './qr-scanner.component';
import { QrUploadComponent } from './lib/qrupload/qrupload.component';

@NgModule({
  imports: [
    CommonModule
  ],
  declarations: [QrScannerComponent, QrUploadComponent],
  exports: [QrScannerComponent]
})
export class NgQrScannerModule {
  static forRoot(): ModuleWithProviders {
    return {
      ngModule: NgQrScannerModule
    };
  }
}
