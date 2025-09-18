'use strict'

const { iif, Subject, of, forkJoin, defer, timer } = require("rxjs");
const { tap, bufferTime, filter, mergeMap, catchError, map, delay } = require('rxjs/operators');
const { ConsoleLogger } = require('@nebulae/backend-node-tools').log;
const { brokerFactory } = require("@nebulae/backend-node-tools").broker;

const VehicleStatsDA = require("./data-access/VehicleStatsDA");

const broker = brokerFactory();
const MATERIALIZED_VIEW_TOPIC = "emi-gateway-materialized-view-updates";

/**
 * Singleton instance
 * @type { VehicleStatsES }
 */
let instance;

class VehicleStatsES {

    constructor() {
        this.vehicleEvents$ = new Subject();
    }

    /**
     * Test method to manually inject vehicle events for debugging
     */
    testFleetProcessor$() {
        return timer(2000).pipe( // Wait 2 seconds for everything to initialize
            tap(() => {
                ConsoleLogger.i("VehicleStatsES: Injecting test vehicle events");
                
                // Inject some test events directly into the subject
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
                    this.vehicleEvents$.next(event);
                });
            })
        );
    }    /**
     * Sets up the batch processor using bufferTime(1000)
     * This will collect events for 1 second and then process them as a batch
     */
    initializeBatchProcessor$() {
        return of("VehicleStatsES: Initializing batch processor").pipe(
            tap(() => {
                this.vehicleEvents$.pipe(
                    tap(event => ConsoleLogger.i("VehicleStatsES: Event received in subject", { aid: event.aid })),
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
                // Usar el método correcto del broker para suscribirse a un tópico
                broker.getMessageListener$([MATERIALIZED_VIEW_TOPIC], []).subscribe(
                    message => {
                        try {
                            // Parsear el mensaje MQTT
                            const event = typeof message.data === 'string' ? JSON.parse(message.data) : message.data;
                            
                            // Validar que el evento sea del tipo correcto
                            if (event.at === "Vehicle" && event.et === "Generated") {
                                ConsoleLogger.d("VehicleStatsES: Received vehicle event", { aid: event.aid });
                                this.vehicleEvents$.next(event);
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
     * Implements idempotency by filtering already processed vehicles
     * @param {Array} eventsBatch 
     */
    processBatch$(eventsBatch) {
        ConsoleLogger.i(`VehicleStatsES: Processing batch of ${eventsBatch.length} events`);
        
        // Extract AIDs from the batch
        const aids = eventsBatch.map(event => event.aid);
        
        return VehicleStatsDA.checkProcessedVehicles$(aids).pipe(
            mergeMap(processedAids => {
                // Filter out already processed events
                const newEvents = eventsBatch.filter(event => !processedAids.includes(event.aid));
                
                if (newEvents.length === 0) {
                    ConsoleLogger.i("VehicleStatsES: No new vehicles to process (all already processed)");
                    return of({ processedCount: 0 });
                }
                
                ConsoleLogger.i(`VehicleStatsES: Processing ${newEvents.length} new vehicles (${processedAids.length} already processed)`);
                
                // Extract vehicle data from events
                const vehicles = newEvents.map(event => event.data);
                const newAids = newEvents.map(event => event.aid);
                
                // Update fleet statistics
                return VehicleStatsDA.updateFleetStatistics$(vehicles).pipe(
                    mergeMap(updatedStats => {
                        // Mark vehicles as processed
                        return VehicleStatsDA.markVehiclesAsProcessed$(newAids).pipe(
                            mergeMap(() => {
                                // Send updated statistics to frontend via WebSocket
                                return this.notifyFrontend$(updatedStats);
                            }),
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
     * @param {*} stats 
     */
    notifyFrontend$(stats) {
        if (!stats) return of(null);
        
        return of("VehicleStatsES: Notifying frontend").pipe(
            tap(() => {
                // Enviar notificación de actualización a través del broker
                const notification = {
                    type: "ReporterVehicleStatsModified",
                    data: {
                        id: "fleet_stats",
                        ...stats
                    }
                };
                
                // Publicar la notificación
                broker.send$(MATERIALIZED_VIEW_TOPIC, notification).subscribe(
                    () => ConsoleLogger.d("VehicleStatsES: Frontend notification sent"),
                    error => ConsoleLogger.e("VehicleStatsES: Error sending frontend notification", error)
                );
            })
        );
    }

    /**
     * Starts fleet statistics processor
     * @returns {Observable}
     */
    startFleetStatisticsProcessor$() {
        ConsoleLogger.i("VehicleStatsES: Starting fleet statistics processor");
        
        return forkJoin({
            listener: this.subscribeToMQTTEvents$(),
            processor: this.initializeBatchProcessor$()
        }).pipe(
            tap(() => ConsoleLogger.i("VehicleStatsES: Fleet statistics processor started successfully")),
            // Add test after initialization
            mergeMap(() => this.testFleetProcessor$())
        );
    }

    /**
     * Generate Event Processor Map
     */
    generateEventProcessorMap() {
        return {};
    }
}

/**
 * @returns {VehicleStatsES}
 */
module.exports = () => {
    if (!instance) {
        instance = new VehicleStatsES();
        ConsoleLogger.i(`${instance.constructor.name} Singleton created`);
    }
    return instance;
};