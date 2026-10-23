# Proyecto SO - Unidad 2

## Sistema distribuido heterogéneo

Este proyecto implementa un sistema distribuido basado en microservicios. El
sistema recibe una transacción, la registra en una base de datos relacional y
guarda su evento de auditoría en una base de datos documental.

El proyecto es **heterogéneo** porque combina tres lenguajes de programación,
dos tipos de bases de datos y varios servicios independientes que se
comunican mediante HTTP y JSON.

## Objetivos

- Aplicar una arquitectura de microservicios.
- Demostrar la comunicación entre servicios mediante APIs REST.
- Utilizar diferentes lenguajes según la responsabilidad de cada componente.
- Separar los datos transaccionales de los datos de auditoría.
- Ejecutar todo el sistema de forma reproducible con Docker Compose.
- Aislar los servicios en una red virtual privada.

## Arquitectura y topología

```text
Cliente
   |
   v
Módulo A - Gateway Node.js :8080
   |
   +----> Módulo B - Servicio transaccional Python :5000
   |             |
   |             v
   |        PostgreSQL :5432
   |
   +----> Módulo C - Servicio de auditoría Go :6000
                 |
                 v
             MongoDB :27017
```

Los servicios se ejecutan dentro de la red Docker `isolated-network`. Solo el
Módulo A publica un puerto hacia el equipo anfitrión; los módulos B y C se
comunican internamente mediante los nombres de servicio de Docker.

## Componentes

| Componente | Tecnología | Responsabilidad | Acceso |
|---|---|---|---|
| Módulo A | Node.js + Express | Validar, coordinar y consolidar la operación | `http://localhost:8080` |
| Módulo B | Python + FastAPI | Registrar la transacción principal | `http://modulo-b:5000` |
| Módulo C | Go | Registrar el evento de auditoría | `http://modulo-c:6000` |
| Base relacional | PostgreSQL 15 | Persistir transacciones estructuradas | `db-relacional:5432` |
| Base documental | MongoDB 6 | Persistir eventos de auditoría | `db-nosql:27017` |

### Módulo A: Gateway

Archivo principal: [`modulo-a/index.js`](modulo-a/index.js)

Expone `POST /api/transacciones`. Valida el cuerpo de la solicitud, envía la
transacción al Módulo B, genera un hash SHA-256 de la operación y envía los
datos de auditoría al Módulo C. Finalmente devuelve una respuesta consolidada
con el resultado de ambos servicios.

Se utiliza Node.js porque el gateway realiza principalmente operaciones de
entrada, comunicación y coordinación asíncrona entre servicios. Express
simplifica la creación de la API HTTP.

### Módulo B: Servicio de dominio transaccional

Archivo principal: [`modulo-b/main.py`](modulo-b/main.py)

Expone `POST /transacciones`. Genera un UUID, asigna el estado inicial
`RECIBIDO` y guarda la operación en la tabla `transacciones` de PostgreSQL.
FastAPI y Pydantic validan el modelo de entrada, mientras que `psycopg2`
permite la conexión con PostgreSQL.

PostgreSQL se utiliza porque las transacciones tienen una estructura definida y
requieren persistencia organizada en tablas.

### Módulo C: Servicio de auditoría

Archivo principal: [`modulo-c/main.go`](modulo-c/main.go)

Expone `POST /eventos`. Recibe el resultado de la operación y lo guarda como
un documento en la colección `eventos_auditoria` de la base `auditoria_db`.

Go es adecuado para este servicio por su bajo consumo de recursos y su buen
rendimiento en aplicaciones de red. MongoDB permite almacenar eventos
documentales flexibles y separados de la información transaccional.

## Flujo de una transacción

1. El cliente envía una solicitud al Módulo A.
2. El gateway valida `cuenta_origen`, `monto` y `tipo`.
3. El Módulo A envía la operación al Módulo B.
4. El Módulo B genera el identificador y persiste la transacción en PostgreSQL.
5. El gateway genera el hash de la operación.
6. El Módulo A envía el evento al Módulo C.
7. El Módulo C registra la auditoría en MongoDB.
8. El gateway informa al cliente el resultado consolidado.

## API principal

### Crear una transacción

**Solicitud**

```http
POST http://localhost:8080/api/transacciones
Content-Type: application/json
```

```json
{
  "cuenta_origen": "123456789",
  "monto": 1500.50,
  "tipo": "TRANSFERENCIA"
}
```

**Respuesta exitosa**

La respuesta incluye:

- `mensaje`: confirmación del flujo.
- `transaccion`: datos generados por el Módulo B.
- `auditoria`: confirmación del registro en el Módulo C.

Si los datos de entrada son inválidos, el gateway responde con HTTP `400`. Si
falla la comunicación con un servicio interno, responde con HTTP `502`.

## Requisitos

- Docker Desktop con Docker Compose.
- Puertos `8080`, `5432` y `27017` disponibles si se accede a las bases desde
  el equipo anfitrión.
- Conexión a Internet durante la primera construcción, para descargar imágenes
  y dependencias.

No es necesario instalar Node.js, Python, Go, PostgreSQL ni MongoDB localmente,
porque cada componente se ejecuta dentro de su contenedor.

## Ejecución

Desde la raíz del proyecto:

```bash
docker compose up --build
```

Para ejecutar los servicios en segundo plano:

```bash
docker compose up --build -d
```

Para consultar el estado:

```bash
docker compose ps
```

Para detener los contenedores sin eliminar los datos:

```bash
docker compose down
```

Para detenerlos y eliminar también los volúmenes persistentes:

```bash
docker compose down -v
```

> `docker compose down -v` elimina los datos almacenados en PostgreSQL y
> MongoDB. Debe utilizarse solo cuando se desea reiniciar completamente el
> entorno.

## Prueba rápida

Con los contenedores ejecutándose, se puede probar el endpoint desde
PowerShell:

```powershell
Invoke-RestMethod `
  -Uri "http://localhost:8080/api/transacciones" `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"cuenta_origen":"123456789","monto":1500.50,"tipo":"TRANSFERENCIA"}'
```

También se puede utilizar Postman, Insomnia o cualquier cliente HTTP.

## Persistencia y configuración

Docker Compose define dos volúmenes:

- `pg_data`: datos de PostgreSQL.
- `mongo_data`: datos de MongoDB.

Las variables utilizadas para conectar los servicios son:

| Variable | Uso |
|---|---|
| `DATABASE_URL` | Conexión del Módulo B con PostgreSQL |
| `MONGO_URI` | Conexión del Módulo C con MongoDB |
| `MODULO_B_URL` | URL interna del Módulo B usada por el gateway |
| `MODULO_C_URL` | URL interna del Módulo C usada por el gateway |

Antes de ejecutar el proyecto, se debe verificar que `DATABASE_URL` tenga un
formato válido para PostgreSQL, por ejemplo:

```text
postgresql://admin:password123@db-relacional:5432/banco_db
```

Las credenciales incluidas en `docker-compose.yml` son únicamente de
demostración. En un entorno real deben gestionarse mediante variables de
entorno o secretos y no escribirse directamente en el repositorio.

## Estructura del repositorio

```text
.
├── docker-compose.yml       # Orquestación de todos los contenedores
├── README.md                # Documentación del proyecto
├── modulo-a/
│   ├── index.js             # Gateway y endpoint público
│   ├── package.json         # Dependencias de Node.js
│   ├── Dockerfile           # Imagen del gateway
│   └── .dockerignore
├── modulo-b/
│   ├── main.py              # Servicio transaccional
│   ├── requirements.txt     # Dependencias de Python
│   ├── Dockerfile           # Imagen del servicio transaccional
│   └── .dockerignore
└── modulo-c/
    ├── main.go              # Servicio de auditoría
    ├── go.mod               # Módulo y dependencia de MongoDB
    ├── Dockerfile           # Compilación e imagen del servicio
    └── .dockerignore
```

## Consideraciones técnicas

- La transacción y la auditoría se guardan en bases separadas. Si PostgreSQL
  confirma la operación pero MongoDB falla, puede existir una transacción sin
  auditoría; una versión avanzada podría incorporar reintentos, una cola de
  mensajes o el patrón Outbox.
- El Módulo A es el único punto de entrada público, lo que reduce la
  exposición directa de los servicios internos.
- Los healthchecks de las bases de datos permiten que los módulos B y C
  esperen a que sus dependencias estén disponibles.
- Para producción se deberían agregar autenticación, validación más estricta,
  manejo de secretos, logs estructurados y endpoints de salud para los
  microservicios.

## Conclusión

El proyecto demuestra una arquitectura distribuida y políglota en la que cada
componente tiene una responsabilidad específica. Node.js coordina el flujo,
Python administra la operación transaccional, PostgreSQL conserva los datos
estructurados, Go registra la auditoría y MongoDB almacena los eventos
documentales. Docker Compose integra todos los componentes en un entorno
reproducible y aislado.

