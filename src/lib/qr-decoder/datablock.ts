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

export class DataBlock {
	numDataCodewords: any;
	codewords: any;

	constructor(numDataCodewords: any,  codewords: any) {
		this.numDataCodewords = numDataCodewords;
		this.codewords = codewords;
	}

	get NumDataCodewords(): any {
		return this.numDataCodewords;
	}

	get Codewords(): any {
		return this.codewords;
	}

	static getDataBlocks(rawCodewords: any,  version: any,  ecLevel: any) {

		if (rawCodewords.length != version.TotalCodewords) {
			throw new Error('ArgumentException');
		}

		// Figure out the number and size of data blocks used by this version and
		// error correction level
		const ecBlocks = version.getECBlocksForLevel(ecLevel);

		// First count the total number of data blocks
		let totalBlocks = 0;
		const ecBlockArray = ecBlocks.getECBlocks();
		for (let i = 0; i < ecBlockArray.length; i++) {
			totalBlocks += ecBlockArray[i].Count;
		}

		// Now establish DataBlocks of the appropriate size and number of data codewords
		const result = new Array(totalBlocks);
		let numResultBlocks = 0;
		for (let j = 0; j < ecBlockArray.length; j++) {
			const ecBlock = ecBlockArray[j];
			for (let i = 0; i < ecBlock.Count; i++) {
				const numDataCodewords = ecBlock.DataCodewords;
				const numBlockCodewords = ecBlocks.ECCodewordsPerBlock + numDataCodewords;
				result[numResultBlocks++] = new DataBlock(numDataCodewords, new Array(numBlockCodewords));
			}
		}

		// All blocks have the same amount of data, except that the last n
		// (where n may be 0) have 1 more byte. Figure out where these start.
		const shorterBlocksTotalCodewords = result[0].codewords.length;
		let longerBlocksStartAt = result.length - 1;
		while (longerBlocksStartAt >= 0) {
			const numCodewords = result[longerBlocksStartAt].codewords.length;
			if (numCodewords == shorterBlocksTotalCodewords) {
				break;
			}
			longerBlocksStartAt--;
		}
		longerBlocksStartAt++;

		const shorterBlocksNumDataCodewords = shorterBlocksTotalCodewords - ecBlocks.ECCodewordsPerBlock;
		// The last elements of result may be 1 element longer;
		// first fill out as many elements as all of them have
		let rawCodewordsOffset = 0;
		for (let i = 0; i < shorterBlocksNumDataCodewords; i++) {
			for (let j = 0; j < numResultBlocks; j++) {
				result[j].codewords[i] = rawCodewords[rawCodewordsOffset++];
			}
		}
		// Fill out the last data block in the longer ones
		for (let j = longerBlocksStartAt; j < numResultBlocks; j++) {
			result[j].codewords[shorterBlocksNumDataCodewords] = rawCodewords[rawCodewordsOffset++];
		}
		// Now add in error correction blocks
		const max = result[0].codewords.length;
		for (let i = shorterBlocksNumDataCodewords; i < max; i++) {
			for (let j = 0; j < numResultBlocks; j++) {
				const iOffset = j < longerBlocksStartAt ? i : i + 1;
				result[j].codewords[iOffset] = rawCodewords[rawCodewordsOffset++];
			}
		}
		return result;
	}
}

