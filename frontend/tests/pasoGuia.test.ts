/**
 * Guía paso a paso: el terminal solo para comandos reales; la prosa va como texto.
 * Los casos salen de las muestras pregeneradas (frontend/public/ejemplos).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esComando, tituloSinPaso } from '../src/utils/pasoGuia.ts';

test('el título del paso pierde el «Paso N:» repetido', () => {
  assert.equal(tituloSinPaso('Paso 1: Identificar la estructura general'), 'Identificar la estructura general');
  assert.equal(tituloSinPaso('Reserva de espacio en disco'), 'Reserva de espacio en disco');
  assert.equal(tituloSinPaso('Paso 2'), 'Paso 2');
});

test('los comandos de shell y SQL se reconocen', () => {
  assert.equal(esComando('sudo fallocate -l 4G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=4096'), true);
  assert.equal(esComando('sudo chmod 600 /swapfile'), true);
  assert.equal(esComando('SELECT * FROM my_table AT(OFFSET => -60*5);'), true);
  assert.equal(esComando('UNDROP DATABASE important_db;'), true);
});

test('la prosa del documento no se presenta como comando', () => {
  assert.equal(esComando('Sancho se convierte en gobernador de una ínsula llamada Barataria que le otorgan los duques'), false);
  assert.equal(esComando('El título de esta fue El ingenioso caballero don Quijote de la Mancha y consta de 74 capítulos.'), false);
  assert.equal(esComando('Verificar la presencia de servidores configurados como brokers en la infraestructura del clúster.'), false);
});

test('una frase con símbolos sigue siendo prosa', () => {
  assert.equal(esComando('Los **brokers** almacenan los eventos de forma duradera en el clúster.'), false);
  assert.equal(esComando('Los producers envían eventos -> los consumers los leen en orden.'), false);
  assert.equal(esComando('La retención se define con retention.ms=604800000 en cada topic.'), false);
  assert.equal(esComando('Revisar el capítulo tres'), true);  // corta: se trata como comando
});

test('un texto vacío no es comando', () => {
  assert.equal(esComando('   '), false);
});
