const express = require('express');
const crypto = require('crypto');

const app = express();
app.use(express.json());

const MODULO_B_URL = process.env.MODULO_B_URL || 'http://modulo-b:5000';
const MODULO_C_URL = process.env.MODULO_C_URL || 'http://modulo-c:6000';

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
    const respB = await fetch(`${MODULO_B_URL}/transacciones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cuenta_origen, monto, tipo })
    });

    if (!respB.ok) {
      const errorText = await respB.text();
      throw new Error(`Error en Módulo B (${respB.status}): ${errorText}`);
    }

    const dataB = await respB.json();

    // 3. Generación de hash y notificación al Módulo C (Servicio de Auditoría)
    const timestamp = new Date().toISOString();
    const rawString = `${dataB.id_transaccion}-${cuenta_origen}-${monto}-${tipo}-${timestamp}`;
    const hashOperacion = crypto.createHash('sha256').update(rawString).digest('hex');

    const respC = await fetch(`${MODULO_C_URL}/eventos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_transaccion: dataB.id_transaccion,
        cuenta_origen,
        tipo_operacion: tipo,
        monto,
        hash_operacion: hashOperacion,
        origen_ip: req.ip || req.socket.remoteAddress || 'desconocido',
        nodo_origen: 'modulo-a-gateway',
        timestamp_llegada: timestamp
      })
    });

    if (!respC.ok) {
      const errorText = await respC.text();
      throw new Error(`Error en Módulo C (${respC.status}): ${errorText}`);
    }

    const dataC = await respC.json();

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