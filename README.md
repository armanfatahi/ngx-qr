# ngx-qr
QrScanner will scan for a QRCode from your Web-cam and return its string.

### usage
```bash
$ npm install --save ngx-qr
```

```typescript
// app.module.ts
import { NgQrScannerModule } from 'ngx-qr';
@NgModule({
  // ...
  imports: [
    // ...
    NgQrScannerModule,
  ],
  // ...
})
export class AppModule { }
```

```html
<!-- app.component.html -->
<qr-scanner [capturedQr]="capturedQr($event)"></qr-scanner>

```

```typescript
// app.component.ts
import { Component, OnInit, AfterViewInit } from '@angular/core';
@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit, AfterViewInit {

    ngOnInit() {
    }

    capturedQr(result: string) {
        console.log(result);
    }

    ngAfterViewInit() {
    }
}

```

#### Translation

Provide the following texts:

```html
<!-- app.component.html -->
<qr-scanner 
    [capturedQr]="capturedQr($event)"
    [texts]="{
        NotSupportedHTML: `You are using an <strong>outdated</strong> browser.`,
        DeviceDefaultPrefix: `Camera`,
        StopCameraText: `Stop Camera` }"    
></qr-scanner>

```

#### Styling

Button styles can be changed:

```html
<!-- app.component.html -->
<qr-scanner 
    [capturedQr]="capturedQr($event)"
    [buttonClass]="'ngClassForButtons'"    
></qr-scanner>

```
