import { Component, ViewChild, ViewEncapsulation, OnInit, AfterViewInit } from '@angular/core';
@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss'],
    encapsulation: ViewEncapsulation.None,
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
