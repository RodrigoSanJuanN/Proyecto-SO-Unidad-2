import os
import uuid
from datetime import datetime, timezone
import psycopg2
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="Módulo B - Servicio de Dominio Transaccional")

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://admin:password123@db-relacional:5432/banco_db")

def get_db_connection():
    return psycopg2.connect(DATABASE_URL)

@app.on_event("startup")
def init_db():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS transacciones (
            id_transaccion VARCHAR(36) PRIMARY KEY,
            cuenta_origen VARCHAR(100) NOT NULL,
            monto NUMERIC(12, 2) NOT NULL,
            tipo VARCHAR(50) NOT NULL,
            estado VARCHAR(20) NOT NULL,
            fecha_creacion TIMESTAMP NOT NULL
        );
    """)
    conn.commit()
    cur.close()
    conn.close()

class TransaccionInput(BaseModel):
    cuenta_origen: str
    monto: float
    tipo: str

@app.post("/transacciones")
def crear_transaccion(tx: TransaccionInput):
    id_tx = str(uuid.uuid4())
    estado = "RECIBIDO"
    ahora = datetime.now(timezone.utc)

    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO transacciones (id_transaccion, cuenta_origen, monto, tipo, estado, fecha_creacion)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (id_tx, tx.cuenta_origen, tx.monto, tx.tipo, estado, ahora)
        )
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en base de datos relacional: {str(e)}")

    return {
        "id_transaccion": id_tx,
        "cuenta_origen": tx.cuenta_origen,
        "monto": tx.monto,
        "tipo": tx.tipo,
        "estado": estado,
        "timestamp": ahora.isoformat()
    }