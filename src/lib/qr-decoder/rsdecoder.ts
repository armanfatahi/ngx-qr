/*
  Ported to JavaScript by Lazar Laszlo 2011

  lazarsoft@gmail.com, www.lazarsoft.info

*/

/*
*
* Copyright 2007 ZXing authors
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*      http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/

import {GF256Poly, GF256} from './gf256';


export class ReedSolomonDecoder {
	field: any;

	constructor(field: any) {
		this.field = field;
	}


	decode(received: any,  twoS: any): void {
		const poly = new GF256Poly(this.field, received);
		const syndromeCoefficients = new Array(twoS);
		for (let i = 0; i < syndromeCoefficients.length; i++) {syndromeCoefficients[i] = 0; }
		const dataMatrix = false; // this.field.Equals(GF256.DATA_MATRIX_FIELD);
		let noError = true;
		for (let i = 0; i < twoS; i++) {
			// Thanks to sanfordsquires for this fix:
			const evalu = poly.evaluateAt(this.field.exp(dataMatrix ? i + 1 : i));
			syndromeCoefficients[syndromeCoefficients.length - 1 - i] = evalu;
			if (evalu != 0) {
				noError = false;
			}
		}
		if (noError) {
			return ;
		}
		const syndrome = new GF256Poly(this.field, syndromeCoefficients);
		const sigmaOmega = this.runEuclideanAlgorithm(this.field.buildMonomial(twoS, 1), syndrome, twoS);
		const sigma = sigmaOmega[0];
		const omega = sigmaOmega[1];
		const errorLocations = this.findErrorLocations(sigma);
		const errorMagnitudes = this.findErrorMagnitudes(omega, errorLocations, dataMatrix);
		for (let i = 0; i < errorLocations.length; i++) {
			const position = received.length - 1 - this.field.log(errorLocations[i]);
			if (position < 0) {
				throw new Error('ReedSolomonException Bad error location');
			}
			received[position] = GF256.addOrSubtract(received[position], errorMagnitudes[i]);
		}
	}

	runEuclideanAlgorithm( a: any,  b: any,  R: any): any {
		// Assume a's degree is >= b's
		if (a.Degree < b.Degree) {
			const temp = a;
			a = b;
			b = temp;
		}

		let rLast = a;
		let r = b;
		let sLast = this.field.One;
		let s = this.field.Zero;
		let tLast = this.field.Zero;
		let t = this.field.One;

		// Run Euclidean algorithm until r's degree is less than R/2
		while (r.Degree >= Math.floor(R / 2)) {
			const rLastLast = rLast;
			const sLastLast = sLast;
			const tLastLast = tLast;
			rLast = r;
			sLast = s;
			tLast = t;

			// Divide rLastLast by rLast, with quotient in q and remainder in r
			if (rLast.Zero) {
				// Oops, Euclidean algorithm already terminated?
				throw new Error('r_{i-1} was zero');
			}
			r = rLastLast;
			let q = this.field.Zero;
			const denominatorLeadingTerm = rLast.getCoefficient(rLast.Degree);
			const dltInverse = this.field.inverse(denominatorLeadingTerm);
			while (r.Degree >= rLast.Degree && !r.Zero) {
				const degreeDiff = r.Degree - rLast.Degree;
				const scale = this.field.multiply(r.getCoefficient(r.Degree), dltInverse);
				q = q.addOrSubtract(this.field.buildMonomial(degreeDiff, scale));
				r = r.addOrSubtract(rLast.multiplyByMonomial(degreeDiff, scale));
				// r.EXE();
			}

			s = q.multiply1(sLast).addOrSubtract(sLastLast);
			t = q.multiply1(tLast).addOrSubtract(tLastLast);
		}

		const sigmaTildeAtZero = t.getCoefficient(0);
		if (sigmaTildeAtZero == 0) {
			throw new Error('ReedSolomonException sigmaTilde(0) was zero');
		}

		const inverse = this.field.inverse(sigmaTildeAtZero);
		const sigma = t.multiply2(inverse);
		const omega = r.multiply2(inverse);
		return new Array(sigma, omega);
	}
	findErrorLocations( errorLocator: any ): any {
		// This is a direct application of Chien's search
		const numErrors = errorLocator.Degree;
		if (numErrors == 1) {
			// shortcut
			return new Array(errorLocator.getCoefficient(1));
		}
		const result = new Array(numErrors);
		let e = 0;
		for (let i = 1; i < 256 && e < numErrors; i++) {
			if (errorLocator.evaluateAt(i) == 0) {
				result[e] = this.field.inverse(i);
				e++;
			}
		}
		if (e != numErrors) {
			throw new Error('Error locator degree does not match number of roots');
		}
		return result;
	}
	findErrorMagnitudes( errorEvaluator: any,  errorLocations: any,  dataMatrix: any): any {
	// This is directly applying Forney's Formula
		const s = errorLocations.length;
		const result = new Array(s);
		for (let i = 0; i < s; i++) {
			const xiInverse = this.field.inverse(errorLocations[i]);
			let denominator = 1;
			for (let j = 0; j < s; j++) {
				if (i != j) {
					denominator = this.field.multiply(denominator, GF256.addOrSubtract(1, this.field.multiply(errorLocations[j], xiInverse)));
				}
			}
			result[i] = this.field.multiply(errorEvaluator.evaluateAt(xiInverse), this.field.inverse(denominator));
			// Thanks to sanfordsquires for this fix:
			if (dataMatrix) {
				result[i] = this.field.multiply(result[i], xiInverse);
			}
		}
		return result;
	}
}
