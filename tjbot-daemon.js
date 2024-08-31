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

import os from 'os';
import bleno from 'bleno';
import winston from 'winston';

import TJBot from 'tjbot';
import config from './config.js';

import ConfigurationService from './service-configuration/service-configuration.js';
import CommandService from './service-command/service-command.js';

const TJBOT_SERVICE_UUID = "799d5f0d-0000-0000-a6a2-da053e2a640a";

// obtener la configuración de hardware desde config.js
const hardware = config.hardware;

// obtener la configuración de TJBot desde config.js
const tjConfig = config.tjConfig;

// obtener las credenciales desde config.js
const credentials = config.credentials;

// instanciar TJBot
const tj = new TJBot(config, credentials);

// configurar el hardware
tj.initialize(hardware);


// instanciar bleno
let name = os.hostname();
name = name.substring(0, 26); // El nombre BLE solo puede tener 26 bytes

// registro detallado (verbose)
winston.level = 'silly';

// Una vez que bleno comienza, comenzar a anunciar nuestra dirección BLE
bleno.on('stateChange', (state) => {
    winston.verbose('BLE state change: ' + state);
    if (state === 'poweredOn') {
        winston.verbose('Advertising on BLE as: ' + name);
        bleno.startAdvertising(name, [TJBOT_SERVICE_UUID], (error) => {
            if (error) {
                winston.error("Error in advertising: ", error);
            }
        });
    } else {
        bleno.stopAdvertising();
    }
});

// Notificar en la consola que hemos aceptado una conexión
bleno.on('accept', (clientAddress) => {
    winston.verbose("Accepted connection from address: " + clientAddress);

    // reproducir un sonido que signifique que un cliente se ha conectado
    try {
        tj.play('./sounds/connect.wav');
    } catch (err) {
        winston.error("Error playing connect sound: ", err);
    }
});

// Notificar en la consola que nos hemos desconectado de un cliente
bleno.on('disconnect', (clientAddress) => {
    winston.verbose("Disconnected from address: " + clientAddress);

    // detener la escucha en caso de que TJBot esté escuchando
    // (y pasar por alto la comprobación de capacidad en caso de que
    // este TJBot no tenga micrófono)
    //tj._stopListening();

    // reproducir un sonido que signifique que un cliente se ha desconectado
    try {
        tj.play('./sounds/disconnect.wav');
    } catch (err) {
        winston.error("Error playing disconnect sound: ", err);
    }
});

// Cuando comenzamos a anunciar, crear un nuevo servicio y característica
bleno.on('advertisingStart', (error) => {
    if (error) {
        winston.error("Advertising start error:", error);
    } else {
        winston.verbose("Advertising started");
        bleno.setServices([
            new ConfigurationService(tj, name),
            new CommandService(tj, name)
        ]);
    }
});