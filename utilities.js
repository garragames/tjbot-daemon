/**
 * Copyright 2017 IBM Corp. All Rights Reserved.
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

import winston from 'winston';

function chunkedWrite(writeFunc, data, chunkSize) {
    winston.verbose(`Writing BLE data (${data.length} bytes in chunks of size ${chunkSize} bytes)`);

    let chunkIdx = 1;
    for (let start = 0; start < data.length; start += chunkSize) {
        let end = start + chunkSize;
        if (end >= data.length) {
            end = data.length;
        }
        winston.verbose(` > sending chunk #${chunkIdx} (start: ${start}, end: ${end})`);
        const dataSlice = data.slice(start, end);
        writeFunc(dataSlice);
        chunkIdx++;
    }

    // conclude with null byte terminator to signal the client that the write is finished
    const nullByte = Buffer.from('\0');
    winston.verbose(" > sending null byte to indicate write is complete");
    writeFunc(nullByte);
}

//export { chunkedWrite };
export default chunkedWrite;