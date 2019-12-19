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

export class GF256Poly {

	field: any;
	coefficients: any;
	constructor(field: any, coefficients: any) {
		if (coefficients == null || coefficients.length == 0) {
			throw new Error('System.ArgumentException');
		}
		this.field = field;
		const coefficientsLength = coefficients.length;
		if (coefficientsLength > 1 && coefficients[0] == 0) {
			// Leading term must be non-zero for anything except the constant polynomial "0"
			let firstNonZero = 1;
			while (firstNonZero < coefficientsLength && coefficients[firstNonZero] == 0) {
				firstNonZero++;
			}
			if (firstNonZero == coefficientsLength) {
				this.coefficients = field.Zero.coefficients;
			} else {
				this.coefficients = new Array(coefficientsLength - firstNonZero);
				for (let i = 0; i < this.coefficients.length; i++) {this.coefficients[i] = 0; }
				// Array.Copy(coefficients, firstNonZero, this.coefficients, 0, this.coefficients.length);
				for (let ci = 0; ci < this.coefficients.length; ci++) {this.coefficients[ci] = coefficients[firstNonZero + ci]; }
			}
		} else {
			this.coefficients = coefficients;
		}

	}

	get Zero(): any {
		return this.coefficients[0] == 0;
	}
	get Degree(): any {
		return this.coefficients.length - 1;
	}
	get Coefficients(): any {
		return this.coefficients;
	}

	getCoefficient( degree: any): any {
		return this.coefficients[this.coefficients.length - 1 - degree];
	}

	evaluateAt( a: any): any {
		if (a == 0) {
			// Just return the x^0 coefficient
			return this.getCoefficient(0);
		}
		const size = this.coefficients.length;
		if (a == 1) {
			// Just the sum of the coefficients
			let result = 0;
			for (let i = 0; i < size; i++) {
				result = GF256.addOrSubtract(result, this.coefficients[i]);
			}
			return result;
		}
		let result2 = this.coefficients[0];
		for (let i = 1; i < size; i++) {
			result2 = GF256.addOrSubtract(this.field.multiply(a, result2), this.coefficients[i]);
		}
		return result2;
	}

	addOrSubtract( other: any): any {
		if (this.field != other.field) {
			throw new Error('GF256Polys do not have same GF256 field');
		}
		if (this.Zero) {
			return other;
		}
		if (other.Zero) {
			return this;
		}

		let smallerCoefficients = this.coefficients;
		let largerCoefficients = other.coefficients;
		if (smallerCoefficients.length > largerCoefficients.length) {
			const temp = smallerCoefficients;
			smallerCoefficients = largerCoefficients;
			largerCoefficients = temp;
		}
		const sumDiff = new Array(largerCoefficients.length);
		const lengthDiff = largerCoefficients.length - smallerCoefficients.length;
		// Copy high-order terms only found in higher-degree polynomial's coefficients
		// Array.Copy(largerCoefficients, 0, sumDiff, 0, lengthDiff);
		for (let ci = 0; ci < lengthDiff; ci++) {sumDiff[ci] = largerCoefficients[ci]; }

		for (let i = lengthDiff; i < largerCoefficients.length; i++) {
			sumDiff[i] = GF256.addOrSubtract(smallerCoefficients[i - lengthDiff], largerCoefficients[i]);
		}

		return new GF256Poly(this.field, sumDiff);
	}
	multiply1( other: any): any {
		if (this.field != other.field) {
			throw new Error('GF256Polys do not have same GF256 field');
		}
		if (this.Zero || other.Zero) {
			return this.field.Zero;
		}
		const aCoefficients = this.coefficients;
		const aLength = aCoefficients.length;
		const bCoefficients = other.coefficients;
		const bLength = bCoefficients.length;
		const product = new Array(aLength + bLength - 1);
		for (let i = 0; i < aLength; i++) {
			const aCoeff = aCoefficients[i];
			for (let j = 0; j < bLength; j++) {
				product[i + j] = GF256.addOrSubtract(product[i + j], this.field.multiply(aCoeff, bCoefficients[j]));
			}
		}
		return new GF256Poly(this.field, product);
	}
	multiply2( scalar: any): any {
		if (scalar == 0) {
			return this.field.Zero;
		}
		if (scalar == 1) {
			return this;
		}
		const size = this.coefficients.length;
		const product = new Array(size);
		for (let i = 0; i < size; i++) {
			product[i] = this.field.multiply(this.coefficients[i], scalar);
		}
		return new GF256Poly(this.field, product);
	}
	multiplyByMonomial( degree: any,  coefficient: any): any {
		if (degree < 0) {
			throw new Error('System.ArgumentException');
		}
		if (coefficient == 0) {
			return this.field.Zero;
		}
		const size = this.coefficients.length;
		const product = new Array(size + degree);
		for (let i = 0; i < product.length; i++) {product[i] = 0; }
		for (let i = 0; i < size; i++) {
			product[i] = this.field.multiply(this.coefficients[i], coefficient);
		}
		return new GF256Poly(this.field, product);
	}
	divide = function( other: any): any {
		if (this.field != other.field) {
			throw new Error('GF256Polys do not have same GF256 field');
		}
		if (other.Zero) {
			throw new Error('Divide by 0');
		}

		let quotient = this.field.Zero;
		let remainder = this;

		const denominatorLeadingTerm = other.getCoefficient(other.Degree);
		const inverseDenominatorLeadingTerm = this.field.inverse(denominatorLeadingTerm);

		while (remainder.Degree >= other.Degree && !remainder.Zero) {
			const degreeDifference = remainder.Degree - other.Degree;
			const scale = this.field.multiply(remainder.getCoefficient(remainder.Degree), inverseDenominatorLeadingTerm);
			const term = other.multiplyByMonomial(degreeDifference, scale);
			const iterationQuotient = this.field.buildMonomial(degreeDifference, scale);
			quotient = quotient.addOrSubtract(iterationQuotient);
			remainder = remainder.addOrSubtract(term);
		}

		return new Array(quotient, remainder);
	};


}



export class GF256 {
	constructor(primitive: any) {
		let x = 1;
		for (let i = 0; i < 256; i++) {
			this.expTable[i] = x;
			x <<= 1; // x = x * 2; we're assuming the generator alpha is 2
			if (x >= 0x100) {
				x ^= primitive;
			}
		}
		for (let i = 0; i < 255; i++) {
			this.logTable[this.expTable[i]] = i;
		}
		// logTable[0] == 0 but this should never be used
		const at0 = new Array(1); at0[0] = 0;
		this.zero = new GF256Poly(this, new Array(at0));
		const at1 = new Array(1); at1[0] = 1;
		this.one = new GF256Poly(this, new Array(at1));
	}



	get Zero(): any {
		return this.zero;
	}
	get One(): any {
		return this.one;
	}

	static QR_CODE_FIELD = new GF256(0x011D);
	static DATA_MATRIX_FIELD = new GF256(0x012D);

	expTable = new Array(256);
	logTable = new Array(256);
	zero: any;
	one: any;

	static addOrSubtract( a: any,  b: any ): any {
	return a ^ b;
	}
	buildMonomial( degree: any,  coefficient: any): any {
		if (degree < 0) {
			throw new Error('System.ArgumentException');
		}
		if (coefficient == 0) {
			return this.zero;
		}
		const coefficients = new Array(degree + 1);
		for (let i = 0; i < coefficients.length; i++) {coefficients[i] = 0; }
		coefficients[0] = coefficient;
		return new GF256Poly(this, coefficients);
	}
	exp( a: any): any {
		return this.expTable[a];
	}
	log( a: any): any {
		if (a == 0) {
			throw new Error('System.ArgumentException');
		}
		return this.logTable[a];
	}
	inverse( a: any): any {
		if (a == 0) {
			throw new Error('System.ArithmeticException');
		}
		return this.expTable[255 - this.logTable[a]];
	}
	multiply( a: any,  b: any): any {
		if (a == 0 || b == 0) {
			return 0;
		}
		if (a == 1) {
			return b;
		}
		if (b == 1) {
			return a;
		}
		return this.expTable[(this.logTable[a] + this.logTable[b]) % 255];
	}
}


