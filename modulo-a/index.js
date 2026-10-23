const express = require('express');
const crypto = require('crypto');
const http = require('http');

const app = express();
app.use(express.json());

const MODULO_B_URL = process.env.MODULO_B_URL || 'http://modulo-b:5000';
const MODULO_C_URL = process.env.MODULO_C_URL || 'http://modulo-c:6000';

// Cliente HTTP nativo: fetch (undici) bloquea puertos como 6000 por la lista
// de puertos prohibidos del estándar Fetch, por eso se usa http.request.
function postJson(urlString, payload, servicio) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const data = JSON.stringify(payload);

    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      },
      (resp) => {
        let raw = '';
        resp.setEncoding('utf8');
        resp.on('data', (chunk) => { raw += chunk; });
        resp.on('end', () => {
          let parsed = null;
          try {
            parsed = raw ? JSON.parse(raw) : null;
          } catch (_) {
            parsed = raw;
          }

          if (resp.statusCode < 200 || resp.statusCode >= 300) {
            return reject(new Error(`Error en ${servicio} (${resp.statusCode}): ${raw}`));
          }

          resolve(parsed);
        });
      }
    );

    req.on('error', (error) => {
      reject(new Error(`Error en ${servicio}: ${error.message}`));
    });

    req.setTimeout(10000, () => {
      req.destroy(new Error('tiempo de espera agotado'));
    });

    req.write(data);
    req.end();
  });
}

app.post('/api/transacciones', async (req, res) => {
  const { cuenta_origen, monto, tipo } = req.body;

  // 1. Validación estricta de estructura y tipos en el Gateway
  if (!cuenta_origen || typeof monto !== 'number' || monto <= 0 || !tipo) {
    return res.status(400).json({
      error: 'Payload inválido. Se requiere cuenta_origen (string), monto (number > 0) y tipo (string).'
    });
  }

  try {
    // 2. Despacho al Módulo B (Servicio de Dominio / Core Transaccional)
    const dataB = await postJson(
      `${MODULO_B_URL}/transacciones`,
      { cuenta_origen, monto, tipo },
      'Módulo B'
    );

    // 3. Generación de hash y notificación al Módulo C (Servicio de Auditoría)
    const timestamp = new Date().toISOString();
    const rawString = `${dataB.id_transaccion}-${cuenta_origen}-${monto}-${tipo}-${timestamp}`;
    const hashOperacion = crypto.createHash('sha256').update(rawString).digest('hex');

    const dataC = await postJson(
      `${MODULO_C_URL}/eventos`,
      {
        id_transaccion: dataB.id_transaccion,
        cuenta_origen,
        tipo_operacion: tipo,
        monto,
        hash_operacion: hashOperacion,
        origen_ip: req.ip || req.socket.remoteAddress || 'desconocido',
        nodo_origen: 'modulo-a-gateway',
        timestamp_llegada: timestamp
      },
      'Módulo C'
    );

    // 4. Respuesta consolidada al cliente
    return res.status(200).json({
      mensaje: 'Transacción procesada y auditada exitosamente',
      transaccion: dataB,
      auditoria: dataC
    });

  } catch (error) {
    console.error('[Gateway Error]:', error.message);
    return res.status(502).json({
      error: 'Error en el flujo distribuido interno',
      detalle: error.message
    });
  }
});

app.listen(8080, '0.0.0.0', () => {
  console.log('Módulo A (API Gateway) escuchando en puerto 8080');
});