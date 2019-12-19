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
import {ReedSolomonDecoder} from './rsdecoder';
import {GF256} from './gf256';
import {BitMatrixParser} from './bmparser';
import {DataBlock} from './datablock';
import {QRCodeDataBlockReader} from './databr';

export class Decoder {
	rsDecoder = new ReedSolomonDecoder(GF256.QR_CODE_FIELD);


	correctErrors( codewordBytes: any,  numDataCodewords: any): void {
		const numCodewords = codewordBytes.length;
		// First read into an array of ints
		const codewordsInts = new Array(numCodewords);
		for (let i = 0; i < numCodewords; i++) {
			codewordsInts[i] = codewordBytes[i] & 0xFF;
		}
		const numECCodewords = codewordBytes.length - numDataCodewords;
		try {
			this.rsDecoder.decode(codewordsInts, numECCodewords);
			// var corrector = new ReedSolomon(codewordsInts, numECCodewords);
			// corrector.correct();
		} catch ( rse) {
			throw rse;
		}
		// Copy back into array of bytes -- only need to worry about the bytes that were data
		// We don't care about errors in the error-correction codewords
		for (let i = 0; i < numDataCodewords; i++) {
			codewordBytes[i] =  codewordsInts[i];
		}
	}

	decode = function(bits: any) {
		const parser: BitMatrixParser = new BitMatrixParser(bits);
		const version = parser.readVersion();
		const ecLevel = parser.readFormatInformation().ErrorCorrectionLevel;

		// Read codewords
		const codewords = parser.readCodewords();

		// Separate into data blocks
		const dataBlocks = DataBlock.getDataBlocks(codewords, version, ecLevel);

		// Count total number of data bytes
		let totalBytes = 0;
		for (let i = 0; i < dataBlocks.length; i++) {
			totalBytes += dataBlocks[i].NumDataCodewords;
		}
		const resultBytes = new Array(totalBytes);
		let resultOffset = 0;

		// Error-correct and copy data blocks together into a stream of bytes
		for (let j = 0; j < dataBlocks.length; j++) {
			const dataBlock = dataBlocks[j];
			const codewordBytes = dataBlock.Codewords;
			const numDataCodewords = dataBlock.NumDataCodewords;
			this.correctErrors(codewordBytes, numDataCodewords);
			for (let i = 0; i < numDataCodewords; i++) {
				resultBytes[resultOffset++] = codewordBytes[i];
			}
		}

		// Decode the contents of that stream of bytes
		const reader = new QRCodeDataBlockReader(resultBytes, version.VersionNumber, ecLevel.Bits);
		return reader;
		// return DecodedBitStreamParser.decode(resultBytes, version, ecLevel);
	};
}
