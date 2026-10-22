FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod main.go ./
RUN go mod tidy
RUN go build -o servidor-auditoria main.go

FROM alpine:3.19
WORKDIR /app
COPY --from=builder /app/servidor-auditoria .
EXPOSE 6000
CMD ["./servidor-auditoria"]