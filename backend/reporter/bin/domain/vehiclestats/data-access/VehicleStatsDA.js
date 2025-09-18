"use strict";

let mongoDB = undefined;
const { map, mapTo, mergeMap, tap, catchError } = require("rxjs/operators");
const { of, Observable, defer } = require("rxjs");

const { CustomError } = require("@nebulae/backend-node-tools").error;
const { ConsoleLogger } = require('@nebulae/backend-node-tools').log;

const CollectionName = 'VehicleStats';
const FleetStatisticsCollectionName = 'FleetStatistics';
const ProcessedVehiclesCollectionName = 'ProcessedVehicles';

// Constants for the collections
const COLLECTION_VEHICLE_STATS = CollectionName;
const COLLECTION_FLEET_STATISTICS = FleetStatisticsCollectionName;
const COLLECTION_PROCESSED_VEHICLES = ProcessedVehiclesCollectionName;

class VehicleStatsDA {
  static start$(mongoDbInstance) {
    return Observable.create(observer => {
      if (mongoDbInstance) {
        mongoDB = mongoDbInstance;
        observer.next(`${this.name} using given mongo instance`);
      } else {
        mongoDB = require("../../../tools/mongo-db/MongoDB").singleton();
        observer.next(`${this.name} using singleton system-wide mongo instance`);
      }
      observer.next(`${this.name} started`);
      observer.complete();
    });
  }

  /**
   * Gets an user by its username
   */
  static getVehicleStats$(id, organizationId) {
    const collection = mongoDB.db.collection(CollectionName);

    // Si el ID es 'fleet_stats', devolver las estadísticas de flota
    if (id === 'fleet_stats') {
      return this.getFleetStatistics$();
    }

    const query = {
      _id: id, organizationId
    };
    return defer(() => collection.findOne(query)).pipe(
      map((res) => {
        return res !== null
          ? { ...res, id: res._id }
          : {}
      })
    );
  }

  static generateListingQuery(filter) {
    const query = {};
    if (filter.name) {
      query["name"] = { $regex: filter.name, $options: "i" };
    }
    if (filter.organizationId) {
      query["organizationId"] = filter.organizationId;
    }
    if (filter.active !== undefined) {
      query["active"] = filter.active;
    }
    return query;
  }

  static getVehicleStatsList$(filter = {}, pagination = {}, sortInput) {
    const collection = mongoDB.db.collection(CollectionName);
    const { page = 0, count = 10 } = pagination;

    const query = this.generateListingQuery(filter);    
    const projection = { name: 1, active: 1 };

    let cursor = collection
      .find(query, { projection })
      .skip(count * page)
      .limit(count);

    const sort = {};
    if (sortInput) {
      sort[sortInput.field] = sortInput.asc ? 1 : -1;
    } else {
      sort["metadata.createdAt"] = -1;
    }
    cursor = cursor.sort(sort);


    return mongoDB.extractAllFromMongoCursor$(cursor).pipe(
      map(res => ({ ...res, id: res._id }))
    );
  }

  static getVehicleStatsSize$(filter = {}) {
    const collection = mongoDB.db.collection(CollectionName);
    const query = this.generateListingQuery(filter);    
    return defer(() => collection.countDocuments(query));
  }

  /**
  * creates a new VehicleStats 
  * @param {*} id VehicleStats ID
  * @param {*} VehicleStats properties
  */
  static createVehicleStats$(_id, properties, createdBy) {

    const metadata = { createdBy, createdAt: Date.now(), updatedBy: createdBy, updatedAt: Date.now() };
    const collection = mongoDB.db.collection(CollectionName);
    return defer(() => collection.insertOne({
      _id,
      ...properties,
      metadata,
    })).pipe(
      map(({ insertedId }) => ({ id: insertedId, ...properties, metadata }))
    );
  }

  /**
  * modifies the VehicleStats properties
  * @param {String} id  VehicleStats ID
  * @param {*} VehicleStats properties to update
  */
  static updateVehicleStats$(_id, properties, updatedBy) {
    const collection = mongoDB.db.collection(CollectionName);
    return defer(() =>
      collection.findOneAndUpdate(
        { _id },
        {
          $set: {
            ...properties,
            "metadata.updatedBy": updatedBy, "metadata.updatedAt": Date.now()
          }
        },
        {
          returnOriginal: false,
        }
      )
    ).pipe(
      map(result => result && result.value ? { ...result.value, id: result.value._id } : undefined)
    );
  }

  /**
  * modifies the VehicleStats properties
  * @param {String} id  VehicleStats ID
  * @param {*} VehicleStats properties to update
  */
  static updateVehicleStatsFromRecovery$(_id, properties, av) {
    const collection = mongoDB.db.collection(CollectionName);
    return defer(() =>
      collection.updateOne(
        {
          _id,
        },
        { $set: { ...properties } },
        {
          returnOriginal: false,
          upsert: true
        }
      )
    ).pipe(
      map(result => result && result.value ? { ...result.value, id: result.value._id } : undefined)
    );
  }

  /**
  * modifies the VehicleStats properties
  * @param {String} id  VehicleStats ID
  * @param {*} VehicleStats properties to update
  */
  static replaceVehicleStats$(_id, properties) {
    const collection = mongoDB.db.collection(CollectionName);
    return defer(() =>
      collection.replaceOne(
        { _id },
        properties,
      )
    ).pipe(
      mapTo({ id: _id, ...properties })
    );
  }

  /**
    * deletes an VehicleStats 
    * @param {*} _id  VehicleStats ID
  */
  static deleteVehicleStats$(_id) {
    const collection = mongoDB.db.collection(CollectionName);
    return defer(() =>
      collection.deleteOne({ _id })
    );
  }

  /**
    * deletes multiple VehicleStats at once
    * @param {*} _ids  VehicleStats IDs array
  */
  static deleteVehicleStatss$(_ids) {
    const collection = mongoDB.db.collection(CollectionName);
    return defer(() =>
      collection.deleteMany({ _id: { $in: _ids } })
    ).pipe(
      map(({ deletedCount }) => deletedCount > 0)
    );
  }

  // FLEET STATISTICS METHODS

  /**
   * Gets the current fleet statistics
   */
  static getFleetStatistics$() {
    const collection = mongoDB.db.collection(FleetStatisticsCollectionName);
    
    return defer(() => collection.findOne({ _id: "real_time_fleet_stats" })).pipe(
      map((res) => {
        const defaultStats = {
          id: "fleet_stats",
          name: "Fleet Statistics",
          organizationId: "global",
          description: "Real-time fleet statistics",
          active: true,
          totalVehicles: 0,
          vehiclesByType: JSON.stringify({ SUV: 0, PickUp: 0, Sedan: 0 }),
          vehiclesByDecade: JSON.stringify({ "1980s": 0, "1990s": 0, "2000s": 0, "2010s": 0, "2020s": 0 }),
          vehiclesBySpeedClass: JSON.stringify({ Lento: 0, Normal: 0, Rapido: 0 }),
          hpStats: JSON.stringify({ min: 0, max: 0, sum: 0, count: 0, avg: 0 }),
          lastUpdated: new Date().toISOString()
        };

        if (res === null) {
          return defaultStats;
        }

        return {
          id: "fleet_stats",
          name: "Fleet Statistics",
          organizationId: "global",
          description: "Real-time fleet statistics",
          active: true,
          totalVehicles: res.totalVehicles || 0,
          vehiclesByType: JSON.stringify(res.vehiclesByType || { SUV: 0, PickUp: 0, Sedan: 0 }),
          vehiclesByDecade: JSON.stringify(res.vehiclesByDecade || { "1980s": 0, "1990s": 0, "2000s": 0, "2010s": 0, "2020s": 0 }),
          vehiclesBySpeedClass: JSON.stringify(res.vehiclesBySpeedClass || { Lento: 0, Normal: 0, Rapido: 0 }),
          hpStats: JSON.stringify({
            min: res.hpStats?.min || 0,
            max: res.hpStats?.max || 0,
            sum: res.hpStats?.sum || 0,
            count: res.hpStats?.count || 0,
            avg: res.hpStats?.count > 0 ? (res.hpStats.sum / res.hpStats.count) : 0
          }),
          lastUpdated: res.lastUpdated || new Date().toISOString()
        };
      })
    );
  }

    /**
     * Check if vehicles have been processed to avoid duplicates
     * @param {string[]} vehicleAids Array of vehicle AIDs to check
     * @returns {Observable} Observable with array of unprocessed vehicle AIDs
     */
    static checkProcessedVehicles$(vehicleAids) {
        ConsoleLogger.d("VehicleStatsDA: Checking processed vehicles", { count: vehicleAids.length });
        
        return defer(() => mongoDB.getHistoricalDB$(COLLECTION_PROCESSED_VEHICLES)).pipe(
            mergeMap(collection => {
                const query = { _id: { $in: vehicleAids } };
                return collection.find(query).toArray();
            }),
            map(processedVehicles => {
                const processedIds = processedVehicles.map(v => v._id);
                const unprocessedIds = vehicleAids.filter(aid => !processedIds.includes(aid));
                ConsoleLogger.d("VehicleStatsDA: Vehicle processing check", { 
                    total: vehicleAids.length, 
                    processed: processedIds.length, 
                    unprocessed: unprocessedIds.length 
                });
                return unprocessedIds;
            }),
            catchError(err => {
                ConsoleLogger.e("VehicleStatsDA: Error checking processed vehicles", err);
                return of([]);
            })
        );
    }  /**
   * Mark vehicles as processed
   * @param {Array} aids Array of aggregate IDs to mark as processed
   */
  static markVehiclesAsProcessed$(aids) {
    ConsoleLogger.d("VehicleStatsDA: Marking vehicles as processed", { count: aids.length });
    
    if (aids.length === 0) {
      ConsoleLogger.w("VehicleStatsDA: No vehicle AIDs to mark as processed");
      return of([]);
    }
    
    const collection = mongoDB.db.collection(ProcessedVehiclesCollectionName);
    const documents = aids.map(aid => ({ _id: aid, processedAt: new Date() }));
    
    ConsoleLogger.d("VehicleStatsDA: Inserting processed vehicle records", { documentCount: documents.length });
    
    return defer(() => collection.insertMany(documents, { ordered: false })).pipe(
      map(result => {
        ConsoleLogger.d("VehicleStatsDA: Vehicles marked as processed", {
          inserted: Object.keys(result.insertedIds).length,
          total: aids.length
        });
        return result.insertedIds;
      }),
      catchError(err => {
        // Ignore duplicate key errors (vehicles already processed)
        if (err.code === 11000) {
          ConsoleLogger.d("VehicleStatsDA: Some vehicles were already processed (duplicate key ignored)");
          return of([]);
        }
        ConsoleLogger.e("VehicleStatsDA: Error marking vehicles as processed", err);
        return of([]);
      })
    );
  }

  /**
   * Calculate decade from year
   * @param {number} year 
   */
  static getDecadeFromYear(year) {
    if (year >= 1980 && year < 1990) return "1980s";
    if (year >= 1990 && year < 2000) return "1990s";
    if (year >= 2000 && year < 2010) return "2000s";
    if (year >= 2010 && year < 2020) return "2010s";
    if (year >= 2020 && year < 2030) return "2020s";
    return "2020s"; // Default for out of range
  }

  /**
   * Calculate speed class from top speed
   * @param {number} topSpeed 
   */
  static getSpeedClass(topSpeed) {
    if (topSpeed < 150) return "Lento";
    if (topSpeed >= 150 && topSpeed <= 200) return "Normal";
    return "Rapido";
  }

    /**
     * Update fleet statistics with batch of vehicles
     * @param {Object[]} vehicles Array of vehicle data
     * @returns {Observable}
     */
    static updateFleetStatistics$(vehicles) {
        ConsoleLogger.i("VehicleStatsDA: Updating fleet statistics", { vehicleCount: vehicles.length });
        
        if (!vehicles || vehicles.length === 0) {
            ConsoleLogger.w("VehicleStatsDA: No vehicles to process");
            return of({ processedCount: 0 });
        }

        // Calculate increments for each category
        const totalIncrement = vehicles.length;
        const vehiclesByType = {};
        const vehiclesByDecade = {};
        const vehiclesBySpeedClass = {};
        
        let totalHp = 0;
        let hpCount = 0;

        vehicles.forEach(vehicle => {
            const data = vehicle.data || vehicle;
            
            // Count by type
            const type = data.vehicleType || 'UNKNOWN';
            vehiclesByType[type] = (vehiclesByType[type] || 0) + 1;
            
            // Count by decade
            if (data.year) {
                const decade = Math.floor(data.year / 10) * 10;
                vehiclesByDecade[decade] = (vehiclesByDecade[decade] || 0) + 1;
            }
            
            // Count by speed class
            if (data.maxSpeed) {
                let speedClass = 'LOW';
                if (data.maxSpeed > 200) speedClass = 'HIGH';
                else if (data.maxSpeed > 120) speedClass = 'MEDIUM';
                
                vehiclesBySpeedClass[speedClass] = (vehiclesBySpeedClass[speedClass] || 0) + 1;
            }
            
            // Accumulate HP for average
            if (data.horsePower) {
                totalHp += data.horsePower;
                hpCount++;
            }
        });

        ConsoleLogger.d("VehicleStatsDA: Calculated increments", {
            totalIncrement,
            vehiclesByType,
            vehiclesByDecade,
            vehiclesBySpeedClass,
            avgHpData: { totalHp, hpCount }
        });

        // Build update operations
        const updateOps = {
            $inc: {
                totalVehicles: totalIncrement
            },
            $set: {
                lastUpdated: new Date()
            }
        };

        // Add increments for each category
        Object.keys(vehiclesByType).forEach(type => {
            updateOps.$inc[`vehiclesByType.${type}`] = vehiclesByType[type];
        });
        
        Object.keys(vehiclesByDecade).forEach(decade => {
            updateOps.$inc[`vehiclesByDecade.${decade}`] = vehiclesByDecade[decade];
        });
        
        Object.keys(vehiclesBySpeedClass).forEach(speedClass => {
            updateOps.$inc[`vehiclesBySpeedClass.${speedClass}`] = vehiclesBySpeedClass[speedClass];
        });

        return defer(() => mongoDB.getHistoricalDB$(COLLECTION_FLEET_STATISTICS)).pipe(
            mergeMap(collection => {
                const query = { _id: 'fleet_stats' };
                
                ConsoleLogger.d("VehicleStatsDA: Executing MongoDB update", { query, updateOps });
                
                return collection.updateOne(query, updateOps, { upsert: true });
            }),
            tap(result => {
                ConsoleLogger.i("VehicleStatsDA: Fleet statistics updated", {
                    matched: result.matchedCount,
                    modified: result.modifiedCount,
                    upserted: result.upsertedCount
                });
            }),
            // Update HP average separately if we have HP data
            mergeMap(result => {
                if (hpCount > 0) {
                    ConsoleLogger.d("VehicleStatsDA: Updating HP average", { totalHp, hpCount });
                    
                    return collection.findOne({ _id: 'fleet_stats' }).then(stats => {
                        if (stats) {
                            const currentTotal = (stats.hpStats?.total || 0) + totalHp;
                            const currentCount = (stats.hpStats?.count || 0) + hpCount;
                            const newAverage = currentTotal / currentCount;
                            
                            ConsoleLogger.d("VehicleStatsDA: New HP average calculated", {
                                currentTotal,
                                currentCount,
                                newAverage
                            });
                            
                            return collection.updateOne(
                                { _id: 'fleet_stats' },
                                {
                                    $set: {
                                        'hpStats.average': newAverage,
                                        'hpStats.total': currentTotal,
                                        'hpStats.count': currentCount
                                    }
                                }
                            );
                        }
                        return result;
                    });
                }
                return of(result);
            }),
            map(() => ({ processedCount: vehicles.length })),
            catchError(err => {
                ConsoleLogger.e("VehicleStatsDA: Error updating fleet statistics", err);
                return of({ processedCount: 0, error: err.message });
            })
        );
    }}
/**
 * @returns {VehicleStatsDA}
 */
module.exports = VehicleStatsDA;
