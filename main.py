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
