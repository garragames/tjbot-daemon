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
//import mkdirp from 'mkdirp';
import { mkdirp } from 'mkdirp';
import { spawn } from 'child_process';
import bleno from 'bleno';
//import utilities from '../utilities.js';

const { Characteristic, Descriptor } = bleno;

class RequestCharacteristic extends Characteristic {
    constructor(tjbot, commandService, name) {
        super({
            uuid: '799d5f0d-0002-0002-a6a2-da053e2a640a',
            properties: ['write'],
            descriptors: [
                new Descriptor({
                    uuid: '0202',
                    value: 'TJBot Request channel for making requests with responses'
                })
            ]
        });

        this.tjbot = tjbot;
        this.commandService = commandService;
        this.hostname = name.toLowerCase();
        this.port = 9080;
        this.photoDir = '/tmp/tjbot-photo/';

        winston.verbose(`Creating photo directory (if needed) at ${this.photoDir}`);
        mkdirp.sync(this.photoDir);

        winston.verbose(`Starting web service for ${this.photoDir}`);
        this.httpServer = spawn('node_modules/http-server/bin/http-server', [this.photoDir, '-p', this.port, '-d', 'false']);
        this.httpServer.on('error', (err) => {
            winston.error("Error spawning http-server process");
            throw err;
        });

        // terminate the child process when we end
        process.on('SIGINT', () => {
            winston.verbose("Stopping web service");
            this.httpServer.kill('SIGHUP');
            process.nextTick(() => {
                process.exit(0);
            });
        });
    }

    onWriteRequest(data, offset, withoutResponse, callback) {
        winston.silly("Received request data", data, offset);

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
            winston.silly("Received full request packet: ", packet);

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
        let request = {};
        try {
            request = JSON.parse(packet.toString());
        } catch (err) {
            winston.error("Could not decode JSON from packet: ", packet.toString());
        }

        winston.verbose("Received request", request);

        if (!request.hasOwnProperty('cmd')) {
            const err = new Error("Expected 'cmd' in request");
            this.commandService.writeResponseObject(err);
            callback(this.RESULT_UNLIKELY_ERROR);
            return;
        }

        let args = {};
        if (request.hasOwnProperty('args')) {
            args = request['args'];
        }

        let error = undefined;

        switch (request['cmd']) {
            case "analyzeTone":
                if (args['text'] !== undefined) {
                    const text = args['text'];
                    try {
                        this.tjbot.analyzeTone(text).then((tone) => {
                            this.commandService.writeResponseObject(tone);
                        });
                    } catch (err) {
                        winston.error("TJBot threw an error:", err);
                        error = err;
                    }
                } else {
                    error = new Error("Expected 'text' in args");
                }
                break;
            case "converse":
                if (args['workspaceId'] !== undefined && args['message'] !== undefined) {
                    const workspaceId = args['workspaceId'];
                    const message = args['message'];
                    try {
                        this.tjbot.converse(workspaceId, message, (response) => {
                            this.commandService.writeResponseObject(response);
                        });
                    } catch (err) {
                        winston.error("TJBot threw an error:", err);
                        error = err;
                    }
                } else {
                    error = new Error("Expected 'workspaceId' and 'message' in args");
                }
                break;
            case "see":
                const filePathSee = this.photoDir + 'photo.jpg';
                try {
                    this.tjbot.takePhoto(filePathSee).then(() => {
                        winston.debug("Sending image to Watson Visual Recognition");
                        this.tjbot.recognizeObjectsInPhoto(filePathSee).then((objects) => {
                            const imageURL = `http://${this.hostname}.local:${this.port}/photo.jpg`;
                            const response = { objects: objects, imageURL: imageURL };
                            this.commandService.writeResponseObject(response);
                        });
                    });
                } catch (err) {
                    winston.error("TJBot threw an error:", err);
                    error = err;
                }
                break;
            case "read":
                const filePathRead = this.photoDir + 'photo.jpg';
                try {
                    this.tjbot.takePhoto(filePathRead).then(() => {
                        winston.debug("Sending image to Watson Visual Recognition");
                        this.tjbot.recognizeTextInPhoto(filePathRead).then((objects) => {
                            const imageURL = `http://${this.hostname}.local:${this.port}/photo.jpg`;
                            const response = { objects: objects, imageURL: imageURL };
                            this.commandService.writeResponseObject(response);
                        });
                    });
                } catch (err) {
                    winston.error("TJBot threw an error:", err);
                    error = err;
                }
                break;
            case "shineColors":
                try {
                    const result = this.tjbot.shineColors();
                    this.commandService.writeResponseObject(result);
                } catch (err) {
                    winston.error("TJBot threw an error:", err);
                    error = err;
                }
                break;
            case "randomColor":
                try {
                    const result = this.tjbot.randomColor();
                    this.commandService.writeResponseObject(result);
                } catch (err) {
                    winston.error("TJBot threw an error:", err);
                    error = err;
                }
                break;
            case "speak":
                if (args['message'] !== undefined) {
                    const message = args['message'];
                    try {
                        this.tjbot.speak(message).then(() => {
                            this.commandService.writeResponseObject({ message: message });
                        });
                    } catch (err) {
                        winston.error("TJBot threw an error:", err);
                        error = err;
                    }
                } else {
                    error = new Error("Expected 'message' in args");
                }
                break;
            case "play":
                if (args['soundFile'] !== undefined) {
                    const soundFile = args['soundFile'];
                    try {
                        this.tjbot.play(soundFile).then(() => {
                            this.commandService.writeResponseObject(soundFile);
                        });
                    } catch (err) {
                        winston.error("TJBot threw an error:", err);
                        error = err;
                    }
                } else {
                    error = new Error("Expected 'soundFile' in args");
                }
                break;
            case "translate":
                if (args['text'] !== undefined && args['sourceLanguage'] !== undefined && args['targetLanguage'] !== undefined) {
                    const text = args['text'];
                    const sourceLanguage = args['sourceLanguage'];
                    const targetLanguage = args['targetLanguage'];
                    try {
                        this.tjbot.translate(text, sourceLanguage, targetLanguage).then((translation) => {
                            this.commandService.writeResponseObject(translation);
                        });
                    } catch (err) {
                        winston.error("TJBot threw an error:", err);
                        error = err;
                    }
                } else {
                    error = new Error("Expected 'text', 'sourceLanguage', and 'targetLanguage' in args");
                }
                break;
            case "identifyLanguage":
                if (args['text'] !== undefined) {
                    const text = args['text'];
                    try {
                        this.tjbot.identifyLanguage(text).then((languages) => {
                            const langObj = { languages: [] };
                            const length = Math.min(languages.languages.length, 5);

                            for (let i = 0; i < length; i++) {
                                langObj.languages.push(languages.languages[i]);
                            }

                            this.commandService.writeResponseObject(langObj);
                        });
                    } catch (err) {
                        winston.error("TJBot threw an error:", err);
                        error = err;
                    }
                } else {
                    error = new Error("Expected 'text' in args");
                }
                break;
            case "isTranslatable":
                if (args['sourceLanguage'] !== undefined && args['targetLanguage'] !== undefined) {
                    const sourceLanguage = args['sourceLanguage'];
                    const targetLanguage = args['targetLanguage'];
                    try {
                        this.tjbot.isTranslatable(sourceLanguage, targetLanguage).then((result) => {
                            this.commandService.writeResponseObject(result);
                        });
                    } catch (err) {
                        winston.error("TJBot threw an error:", err);
                        error = err;
                    }
                } else {
                    error = new Error("Expected 'sourceLanguage' and 'targetLanguage' in args");
                }
                break;
                default:
                    error = new Error("Unknown command received: " + request['cmd']);
                    break;
            }
    
            // something bad happened, so just return an empty object as the response
            if (error !== undefined) {
                this.commandService.writeResponseObject({ 'error': error.toString() });
            }
    
            // always use RESULT_SUCCESS because otherwise the client doesn't see an ACK
            // that their writeData() was successful
            callback(this.RESULT_SUCCESS);
        }
    }
    
    export default RequestCharacteristic;