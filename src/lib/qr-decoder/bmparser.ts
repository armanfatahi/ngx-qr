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

import {BitMatrix} from './bitmat';
import {DataMask} from './datamask';
import {FormatInformation} from './formatinf';
import {Version} from './version';


export class BitMatrixParser {
	bitMatrix: BitMatrix;
	parsedVersion: any;
	parsedFormatInfo: any;

	constructor(bitmatrix: BitMatrix) {
		const dimension = bitmatrix.Dimension;
		if (dimension < 21 || (dimension & 0x03) != 1) {
			throw new Error('Error BitMatrixParser');
		}
		this.bitMatrix = bitmatrix;
	}

	copyBit( i: any,  j: any,  versionBits: any): any {
		return this.bitMatrix.get_Renamed(i, j) ? (versionBits << 1) | 0x1 : versionBits << 1;
	}

	readFormatInformation(): any {
		if (this.parsedFormatInfo != null) {
			return this.parsedFormatInfo;
		}

		// Read top-left format info bits
		let formatInfoBits = 0;
		for (let i = 0; i < 6; i++) {
			formatInfoBits = this.copyBit(i, 8, formatInfoBits);
		}
		// .. and skip a bit in the timing pattern ...
		formatInfoBits = this.copyBit(7, 8, formatInfoBits);
		formatInfoBits = this.copyBit(8, 8, formatInfoBits);
		formatInfoBits = this.copyBit(8, 7, formatInfoBits);
		// .. and skip a bit in the timing pattern ...
		for (let j = 5; j >= 0; j--) {
			formatInfoBits = this.copyBit(8, j, formatInfoBits);
		}

		this.parsedFormatInfo = FormatInformation.decodeFormatInformation(formatInfoBits);
		if (this.parsedFormatInfo != null) {
			return this.parsedFormatInfo;
		}

		// Hmm, failed. Try the top-right/bottom-left pattern
		const dimension = this.bitMatrix.Dimension;
		formatInfoBits = 0;
		const iMin = dimension - 8;
		for (let i = dimension - 1; i >= iMin; i--) {
			formatInfoBits = this.copyBit(i, 8, formatInfoBits);
		}
		for (let j = dimension - 7; j < dimension; j++) {
			formatInfoBits = this.copyBit(8, j, formatInfoBits);
		}

		this.parsedFormatInfo = FormatInformation.decodeFormatInformation(formatInfoBits);
		if (this.parsedFormatInfo != null) {
			return this.parsedFormatInfo;
		}
		throw new Error('Error readFormatInformation');
	}
	readVersion(): any {

		if (this.parsedVersion != null) {
			return this.parsedVersion;
		}

		const dimension = this.bitMatrix.Dimension;

		const provisionalVersion = (dimension - 17) >> 2;
		if (provisionalVersion <= 6) {
			return Version.getVersionForNumber(provisionalVersion);
		}

		// Read top-right version info: 3 wide by 6 tall
		let versionBits = 0;
		const ijMin = dimension - 11;
		for (let j = 5; j >= 0; j--) {
			for (let i = dimension - 9; i >= ijMin; i--) {
				versionBits = this.copyBit(i, j, versionBits);
			}
		}

		this.parsedVersion = Version.decodeVersionInformation(versionBits);
		if (this.parsedVersion != null && this.parsedVersion.DimensionForVersion == dimension) {
			return this.parsedVersion;
		}

		// Hmm, failed. Try bottom left: 6 wide by 3 tall
		versionBits = 0;
		for (let i = 5; i >= 0; i--) {
			for (let j = dimension - 9; j >= ijMin; j--) {
				versionBits = this.copyBit(i, j, versionBits);
			}
		}

		this.parsedVersion = Version.decodeVersionInformation(versionBits);
		if (this.parsedVersion != null && this.parsedVersion.DimensionForVersion == dimension) {
			return this.parsedVersion;
		}
		throw new Error('Error readVersion');
	}
	readCodewords(): any {

		const formatInfo = this.readFormatInformation();
		const version = this.readVersion();

		// Get the data mask for the format used in this QR Code. This will exclude
		// some bits from reading as we wind through the bit matrix.
		const dataMask = DataMask.forReference( formatInfo.DataMask);
		const dimension = this.bitMatrix.Dimension;
		dataMask.unmaskBitMatrix(this.bitMatrix, dimension);

		const functionPattern = version.buildFunctionPattern();

		let readingUp = true;
		const result = new Array(version.TotalCodewords);
		let resultOffset = 0;
		let currentByte = 0;
		let bitsRead = 0;
		// Read columns in pairs, from right to left
		for (let j = dimension - 1; j > 0; j -= 2) {
			if (j == 6) {
				// Skip whole column with vertical alignment pattern;
				// saves time and makes the other code proceed more cleanly
				j--;
			}
			// Read alternatingly from bottom to top then top to bottom
			for (let count = 0; count < dimension; count++) {
				const i = readingUp ? dimension - 1 - count : count;
				for (let col = 0; col < 2; col++) {
					// Ignore bits covered by the function pattern
					if (!functionPattern.get_Renamed(j - col, i)) {
						// Read a bit
						bitsRead++;
						currentByte <<= 1;
						if (this.bitMatrix.get_Renamed(j - col, i)) {
							currentByte |= 1;
						}
						// If we've made a whole byte, save it off
						if (bitsRead == 8) {
							result[resultOffset++] =  currentByte;
							bitsRead = 0;
							currentByte = 0;
						}
					}
				}
			}
			readingUp = !readingUp; // readingUp = !readingUp; // switch directions
		}
		if (resultOffset != version.TotalCodewords) {
			throw new Error('Error readCodewords');
		}
		return result;
	}
}
