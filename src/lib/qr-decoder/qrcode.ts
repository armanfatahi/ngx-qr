import {Detector} from './detector';
import {Decoder} from './decoder';
/*
   Copyright 2011 Lazar Laszlo (lazarsoft@gmail.com, www.lazarsoft.info)

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/

export class QRCode  {
    imagedata: ImageData;
    width: number;
    height: number;
    debug = false;
    maxImgSize: number = 1024 * 1024;
    sizeOfDataLengthInfo =  [  [ 10, 9, 8, 8 ],  [ 12, 11, 16, 10 ],  [ 14, 13, 16, 12 ] ];
    result: string;

    public myCallback: (qrText: string) => void;

    public decode(canvas: HTMLCanvasElement): string {

        const context = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;
        this.imagedata = context.getImageData(0, 0, this.width, this.height);
        this.result = this.process(context);
        if (this.myCallback != null) {
            this.myCallback(this.result);
        }
        return this.result;
    }

    process(context: CanvasRenderingContext2D): string {
        const start = new Date().getTime();
        const image = this.grayScaleToBitmap(this.grayscale());

        if (this.debug) {
            for (let y = 0; y < this.height; y++) {
                for (let x = 0; x < this.width; x++) {
                    const point = (x * 4) + (y * this.width * 4);
                    this.imagedata.data[point] = image[x + y * this.width] ? 0 : 0;
                    this.imagedata.data[point + 1] = image[x + y * this.width] ? 0 : 0;
                    this.imagedata.data[point + 2] = image[x + y * this.width] ? 255 : 0;
                }
            }
            context.putImageData(this.imagedata, 0, 0);
        }

        const detector = new Detector(image, this.imagedata, this.width, this.height);

        const qRCodeMatrix = detector.detect();
        if (this.debug) {
            context.putImageData(this.imagedata, 0, 0);
        }
        const decoder  = new Decoder();
        const reader = decoder.decode(qRCodeMatrix.bits);
        const data = reader.DataByte;
        let str = '';
        for (let i = 0; i < data.length; i++) {
            for (let j = 0; j < data[i].length; j++) {
                str += String.fromCharCode(data[i][j]);
            }
        }

        const end = new Date().getTime();
        const time = end - start;
        console.log(time);

        return str;
    }

    grayScaleToBitmap(grayScale: Array<number>): Array<number> {
        const middle = this.getMiddleBrightnessPerArea(grayScale);
        const sqrtNumArea = middle.length;
        const areaWidth = Math.floor(this.width / sqrtNumArea);
        const areaHeight = Math.floor(this.height / sqrtNumArea);
        const bitmap = new Array(this.height * this.width);

        for (let ay = 0; ay < sqrtNumArea; ay++) {
            for (let ax = 0; ax < sqrtNumArea; ax++) {
                for (let dy = 0; dy < areaHeight; dy++) {
                    for (let dx = 0; dx < areaWidth; dx++) {
                        bitmap[areaWidth * ax + dx + (areaHeight * ay + dy) * this.width] = (grayScale[areaWidth * ax + dx + (areaHeight * ay + dy) * this.width] < middle[ax][ay]) ? true : false;
                    }
                }
            }
        }
        return bitmap;
    }

    grayscale(): Array<number> {
        const ret = new Array(this.width * this.height);
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const gray = this.getPixel(x, y);

                ret[x + y * this.width] = gray;
            }
        }
        return ret;
    }

    getPixel(x: number, y: number): number {
        if (this.width < x) {
            throw new Error('point error');
        }
        if (this.height < y) {
            throw new Error('point error');
        }
        const point = (x * 4) + (y * this.width * 4);
        const p = (this.imagedata.data[point] * 33 + this.imagedata.data[point + 1] * 34 + this.imagedata.data[point + 2] * 33) / 100;
        return p;
    }

    getMiddleBrightnessPerArea(image: Array<number>): Array<Array<number>> {
        const numSqrtArea = 4;
        // obtain middle brightness((min + max) / 2) per area
        const areaWidth = Math.floor(this.width / numSqrtArea);
        const areaHeight = Math.floor(this.height / numSqrtArea);
        const minmax = new Array(numSqrtArea);
        for (let i = 0; i < numSqrtArea; i++) {
            minmax[i] = new Array(numSqrtArea);
            for (let i2 = 0; i2 < numSqrtArea; i2++) {
                minmax[i][i2] = new Array(0, 0);
            }
        }
        for (let ay = 0; ay < numSqrtArea; ay++) {
            for (let ax = 0; ax < numSqrtArea; ax++) {
                minmax[ax][ay][0] = 0xFF;
                for (let dy = 0; dy < areaHeight; dy++) {
                    for (let dx = 0; dx < areaWidth; dx++) {
                        const target = image[areaWidth * ax + dx + (areaHeight * ay + dy) * this.width];
                        if (target < minmax[ax][ay][0]) {
                            minmax[ax][ay][0] = target;
                        }
                        if (target > minmax[ax][ay][1]) {
                            minmax[ax][ay][1] = target;
                        }
                    }
                }
                // minmax[ax][ay][0] = (minmax[ax][ay][0] + minmax[ax][ay][1]) / 2;
            }
        }
        const middle = new Array(numSqrtArea);
        for (let i3 = 0; i3 < numSqrtArea; i3++) {
            middle[i3] = new Array(numSqrtArea);
        }
        for (let ay = 0; ay < numSqrtArea; ay++) {
            for (let ax = 0; ax < numSqrtArea; ax++) {
                middle[ax][ay] = Math.floor((minmax[ax][ay][0] + minmax[ax][ay][1]) / 2);
                // Console.out.print(middle[ax][ay] + ",");
            }
            // Console.out.println("");
        }
        // Console.out.println("");

        return middle;
    }
}






//
//
// Array.prototype.remove = function(from, to) {
//   var rest = this.slice((to || from) + 1 || this.length);
//   this.length = from < 0 ? this.length + from : from;
//   return this.push.apply(this, rest);
// };
