package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type EventoAuditoria struct {
	ID               primitive.ObjectID `bson:"_id,omitempty" json:"id_auditoria"`
	IDTransaccion    string             `bson:"id_transaccion" json:"id_transaccion"`
	CuentaOrigen     string             `bson:"cuenta_origen" json:"cuenta_origen"`
	TipoOperacion    string             `bson:"tipo_operacion" json:"tipo_operacion"`
	Monto            float64            `bson:"monto" json:"monto"`
	HashOperacion    string             `bson:"hash_operacion" json:"hash_operacion"`
	OrigenIP         string             `bson:"origen_ip" json:"origen_ip"`
	NodoOrigen       string             `bson:"nodo_origen" json:"nodo_origen"`
	TimestampLlegada string             `bson:"timestamp_llegada" json:"timestamp_llegada"`
}

var coleccion *mongo.Collection

func registrarEvento(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	var evento EventoAuditoria
	if err := json.NewDecoder(r.Body).Decode(&evento); err != nil {
		http.Error(w, "Payload JSON inválido", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	resultado, err := coleccion.InsertOne(ctx, evento)
	if err != nil {
		http.Error(w, "Error al guardar en MongoDB: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"estado_auditoria": "REGISTRADO",
		"mongo_id":         resultado.InsertedID,
		"hash_operacion":   evento.HashOperacion,
	})
}

func main() {
	mongoURI := os.Getenv("MONGO_URI")
	if mongoURI == "" {
		mongoURI = "mongodb://db-nosql:27017"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	client, err := mongo.Connect(ctx, options.Client().ApplyURI(mongoURI))
	if err != nil {
		log.Fatalf("Error conectando a MongoDB: %v", err)
	}

	coleccion = client.Database("auditoria_db").Collection("eventos_auditoria")

	http.HandleFunc("/eventos", registrarEvento)
	log.Println("Módulo C (Servicio de Auditoría en Go) escuchando en puerto 6000")
	log.Fatal(http.ListenAndServe("0.0.0.0:6000", nil))
}