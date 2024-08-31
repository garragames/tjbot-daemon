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

import CommandCharacteristic from './characteristic-command.js';
import RequestCharacteristic from './characteristic-request.js';
import ResponseCharacteristic from './characteristic-response.js';
import ListenCharacteristic from './characteristic-listen.js';

const { PrimaryService } = bleno;

class CommandService extends PrimaryService {
    constructor(tjbot, name) {
        // Llama primero a `super()` para inicializar `this`
        super({
            uuid: '799d5f0d-0002-0000-a6a2-da053e2a640a',
            characteristics: [] // inicializa con un array vacío, y luego lo llenas
        });

        // Ahora puedes acceder a `this` de manera segura
        const commandCharacteristic = new CommandCharacteristic(tjbot, this);
        const requestCharacteristic = new RequestCharacteristic(tjbot, this, name);
        const responseCharacteristic = new ResponseCharacteristic(tjbot, this);
        const listenCharacteristic = new ListenCharacteristic(tjbot);

        // Asigna las características correctamente
        this.characteristics.push(commandCharacteristic);
        this.characteristics.push(requestCharacteristic);
        this.characteristics.push(responseCharacteristic);
        this.characteristics.push(listenCharacteristic);

        this.responseCharacteristic = responseCharacteristic;
        this.listenCharacteristic = listenCharacteristic;
    }

    // deliver responses to the responseCharacteristic
    writeResponseObject(obj) {
        this.responseCharacteristic.writeResponseObject(obj);
    }

    // deliver text from listen() to the listenCharacteristic
    receivedListenText(text) {
        this.listenCharacteristic.receivedListenText(text);
    }
}

export default CommandService;