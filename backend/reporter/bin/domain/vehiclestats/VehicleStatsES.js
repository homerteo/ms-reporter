'use strict'

const { iif, Subject, of, forkJoin, defer, timer } = require("rxjs");
const { tap, bufferTime, filter, mergeMap, catchError, map, delay } = require('rxjs/operators');
const { ConsoleLogger } = require('@nebulae/backend-node-tools').log;
const { brokerFactory } = require("@nebulae/backend-node-tools").broker;

const VehicleStatsDA = require("./data-access/VehicleStatsDA");

const broker = brokerFactory();
const MATERIALIZED_VIEW_TOPIC = "emi-gateway-materialized-view-updates";

// Subject a nivel de dominio (SINGLETON)
const vehicleStatsEventSubject = new Subject();

/**
 * Singleton instance
 * @type { VehicleStatsES }
 */
let instance;

class VehicleStatsES {

    constructor() {
        this.vehicleEvents$ = vehicleStatsEventSubject;
    }

    /**
     * Test method to manually inject vehicle events for debugging
     */
    testFleetProcessor$() {
        return timer(2000).pipe(
            tap(() => {
                ConsoleLogger.i("VehicleStatsES: Injecting test vehicle events");
                
                const testEvents = [
                    {
                        aid: "test-vehicle-001",
                        data: {
                            year: 2020,
                            vehicleType: "CAR",
                            horsePower: 200,
                            maxSpeed: 180
                        }
                    },
                    {
                        aid: "test-vehicle-002", 
                        data: {
                            year: 2015,
                            vehicleType: "TRUCK",
                            horsePower: 300,
                            maxSpeed: 120
                        }
                    }
                ];

                testEvents.forEach(event => {
                    ConsoleLogger.i("VehicleStatsES: Injecting test event", { aid: event.aid });
                    vehicleStatsEventSubject.next(event);
                });
            })
        );
    }

    /**
     * Sets up the batch processor using bufferTime(1000)
     */
    initializeBatchProcessor$() {
        return of("VehicleStatsES: Initializing batch processor").pipe(
            tap(() => {
                // Usar el Subject del dominio
                vehicleStatsEventSubject.pipe(
                    tap(event => ConsoleLogger.i("VehicleStatsES: Event received in domain subject", { aid: event.aid })),
                    bufferTime(1000),
                    tap(buffer => ConsoleLogger.i(`VehicleStatsES: Buffer collected ${buffer.length} events`)),
                    filter(buffer => buffer.length > 0),
                    mergeMap(eventsBatch => this.processBatch$(eventsBatch)),
                    catchError(error => {
                        ConsoleLogger.e("VehicleStatsES: Error in batch processor", error);
                        return of(null);
                    })
                ).subscribe(
                    result => {
                        if (result) {
                            ConsoleLogger.i(`VehicleStatsES: Processed batch of ${result.processedCount} vehicles`);
                        }
                    },
                    error => ConsoleLogger.e("VehicleStatsES: Subscription error", error)
                );
            })
        );
    }

    /**
     * Subscribe to MQTT events for vehicle generation
     */
    subscribeToMQTTEvents$() {
        return of("VehicleStatsES: Subscribing to MQTT events").pipe(
            tap(() => {
                broker.getMessageListener$([MATERIALIZED_VIEW_TOPIC], []).subscribe(
                    message => {
                        try {
                            // Parsear el mensaje MQTT
                            const event = typeof message.data === 'string' ? JSON.parse(message.data) : message.data;
                            
                            ConsoleLogger.d("VehicleStatsES: MQTT event received", { 
                                type: event.et, 
                                aggregate: event.at, 
                                aid: event.aid 
                            });

                            // Emitir todos los eventos MQTT al Subject del dominio
                            vehicleStatsEventSubject.next(event);
                            
                            // Filtro adicional solo para procesamiento de vehículos
                            if (event.at === "Vehicle" && event.et === "Generated") {
                                ConsoleLogger.d("VehicleStatsES: Vehicle generation event processed", { aid: event.aid });
                            }
                            
                        } catch (error) {
                            ConsoleLogger.e("VehicleStatsES: Error parsing MQTT message", error);
                        }
                    },
                    error => {
                        ConsoleLogger.e("VehicleStatsES: MQTT subscription error", error);
                    }
                );
            })
        );
    }

    /**
     * Process a batch of vehicle events
     */
    processBatch$(eventsBatch) {
        ConsoleLogger.i(`VehicleStatsES: Processing batch of ${eventsBatch.length} events`);
        
        // Filtrar solo eventos de vehículos para estadísticas
        const vehicleEvents = eventsBatch.filter(event => 
            event.at === "Vehicle" && event.et === "Generated"
        );
        
        if (vehicleEvents.length === 0) {
            ConsoleLogger.i("VehicleStatsES: No vehicle events in batch");
            return of({ processedCount: 0 });
        }
        
        const aids = vehicleEvents.map(event => event.aid);
        
        return VehicleStatsDA.checkProcessedVehicles$(aids).pipe(
            mergeMap(processedAids => {
                const newEvents = vehicleEvents.filter(event => !processedAids.includes(event.aid));
                
                if (newEvents.length === 0) {
                    ConsoleLogger.i("VehicleStatsES: No new vehicles to process (all already processed)");
                    return of({ processedCount: 0 });
                }
                
                ConsoleLogger.i(`VehicleStatsES: Processing ${newEvents.length} new vehicles`);
                
                const vehicles = newEvents.map(event => event.data);
                const newAids = newEvents.map(event => event.aid);
                
                return VehicleStatsDA.updateFleetStatistics$(vehicles).pipe(
                    mergeMap(updatedStats => {
                        return VehicleStatsDA.markVehiclesAsProcessed$(newAids).pipe(
                            mergeMap(() => this.notifyFrontend$(updatedStats)),
                            map(() => ({ processedCount: newEvents.length, updatedStats }))
                        );
                    })
                );
            }),
            catchError(error => {
                ConsoleLogger.e("VehicleStatsES: Error processing batch", error);
                return of({ processedCount: 0, error: error.message });
            })
        );
    }

    /**
     * Notify frontend via WebSocket about updated statistics
     */
    notifyFrontend$(stats) {
        if (!stats) return of(null);
        
        return of("VehicleStatsES: Notifying frontend").pipe(
            tap(() => {
                const notification = {
                    type: "ReporterVehicleStatsModified",
                    data: {
                        id: "fleet_stats",
                        ...stats
                    }
                };
                
                broker.send$(MATERIALIZED_VIEW_TOPIC, notification).subscribe(
                    () => ConsoleLogger.d("VehicleStatsES: Frontend notification sent"),
                    error => ConsoleLogger.e("VehicleStatsES: Error sending frontend notification", error)
                );
            })
        );
    }

    /**
     * Starts fleet statistics processor
     */
    startFleetStatisticsProcessor$() {
        ConsoleLogger.i("VehicleStatsES: Starting fleet statistics processor");
        
        return forkJoin({
            listener: this.subscribeToMQTTEvents$(),
            processor: this.initializeBatchProcessor$()
        }).pipe(
            tap(() => ConsoleLogger.i("VehicleStatsES: Fleet statistics processor started successfully")),
            mergeMap(() => this.testFleetProcessor$())
        );
    }

    /**
     * Método para acceder al Subject desde otros módulos
     */
    static getDomainSubject() {
        return vehicleStatsEventSubject;
    }

    /**
     * Generate Event Processor Map
     */
    generateEventProcessorMap() {
        return {};
    }
}

// Exportar también el Subject para uso externo
module.exports = () => {
    if (!instance) {
        instance = new VehicleStatsES();
        ConsoleLogger.i(`${instance.constructor.name} Singleton created`);
    }
    return instance;
};

// Exportar el Subject del dominio
module.exports.vehicleStatsEventSubject = vehicleStatsEventSubject;