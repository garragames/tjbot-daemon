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
import bleno from 'bleno';

const { Characteristic, Descriptor } = bleno;

class CommandCharacteristic extends Characteristic {
    constructor(tjbot, commandService) {
        super({
            uuid: '799d5f0d-0002-0001-a6a2-da053e2a640a',
            properties: ['write'],
            descriptors: [
                new Descriptor({
                    uuid: '0201',
                    value: 'TJBot Command channel for sending commands with no response'
                })
            ]
        });

        this.tjbot = tjbot;
        this.commandService = commandService;
    }

    onWriteRequest(data, offset, withoutResponse, callback) {
        winston.silly("Received command data", data, offset);

        // do a buffered read
        if (this._readBuffer === undefined) {
            this._readBuffer = "";
        }

        // append to the buffer
        this._readBuffer = this._readBuffer.concat(data);

        // see if we have a complete packet
        const nullIndex = this._readBuffer.indexOf('\0');
        if (nullIndex >= 0) {
            // peel off the packet
            const packet = this._readBuffer.substring(0, nullIndex);
            winston.silly("Received full command packet: ", packet);

            // remove it from the buffer
            this._readBuffer = this._readBuffer.substring(nullIndex + 1);

            // and process it
            this.processPacket(packet, callback);
        } else {
            // send an ACK to get the next packet
            callback(this.RESULT_SUCCESS);
        }
    }

    processPacket(packet, callback) {
        let command = {};
        try {
            command = JSON.parse(packet.toString());
        } catch (err) {
            winston.error("Could not decode JSON from packet: ", packet.toString());
        }

        winston.verbose("Received command", command);

        if (!command.hasOwnProperty('cmd')) {
            callback(this.RESULT_UNLIKELY_ERROR);
            return;
        }

        let args = {};
        if (command.hasOwnProperty('args')) {
            args = command['args'];
        }

        switch (command['cmd']) {
            case "sleep":
                if (args['msec'] !== undefined) {
                    const msec = args['msec'];
                    this.tjbot.sleep(msec);
                } else {
                    callback(this.RESULT_UNLIKELY_ERROR);
                    return;
                }
                break;
            case "listen":
                if (this.commandService === undefined) {
                    callback(this.RESULT_UNLIKELY_ERROR);
                    return;
                }

                this.tjbot.listen((text) => {
                    const trimmed = text.trim();
                    this.commandService.receivedListenText(trimmed);
                });
                break;
            case "pauseListening":
                this.tjbot.pauseListening();
                break;
            case "resumeListening":
                this.tjbot.resumeListening();
                break;
            case "stopListening":
                this.tjbot.stopListening();
                break;
            case "shine":
                if (args['color'] !== undefined) {
                    const color = args['color'];
                    this.tjbot.shine(color);
                } else {
                    callback(this.RESULT_UNLIKELY_ERROR);
                    return;
                }
                break;
            case "pulse":
                if (args['color'] !== undefined && args['duration'] !== undefined) {
                    let color = args['color'];
                    let duration = args['duration'];

                    duration = Math.min(Math.max(duration, 0.5), 3.0);

                    try {
                        this.tjbot.pulse(color, duration);
                    } catch (err) {
                        winston.error("Error while pulsing: ", err);
                    }
                } else {
                    callback(this.RESULT_UNLIKELY_ERROR);
                    return;
                }
                break;
            case "armBack":
                this.tjbot.armBack();
                break;
            case "raiseArm":
                this.tjbot.raiseArm();
                break;
            case "lowerArm":
                this.tjbot.lowerArm();
                break;
            case "wave":
                this.tjbot.wave();
                break;
            default:
                callback(this.RESULT_UNLIKELY_ERROR);
                return;
        }

        callback(this.RESULT_SUCCESS);
    }
}

export default CommandCharacteristic;