# Proyecto-SO-Unidad-2
El Proyecto trata de un sistema distribuido heterogéneo 

## 1. Arquitectura y Topología
El sistema implementa una arquitectura de microservicios políglota y persistencia heterogénea sobre una red virtual aislada (`isolated-network`):
- **Módulo A (Gateway / Ingesta):** Node.js + Express (Expuesto en `localhost:8080`).
- **Módulo B (Servicio de Dominio):** Python + FastAPI (Red interna `http://modulo-b:5000`).
- **Módulo C (Servicio de Auditoría):** Go (Red interna `http://modulo-c:6000`).
- **Motor BD 1 (Relacional):** PostgreSQL 15 (`db-relacional:5432`).
- **Motor BD 2 (Documental):** MongoDB 6 (`db-nosql:27017`).
