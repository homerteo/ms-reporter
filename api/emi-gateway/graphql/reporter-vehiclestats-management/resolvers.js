const withFilter = require("graphql-subscriptions").withFilter;
const PubSub = require("graphql-subscriptions").PubSub;
const pubsub = new PubSub();
const { of } = require("rxjs");
const { tap, map, mergeMap, catchError } = require('rxjs/operators');
let broker = require("../../broker/BrokerFactory")();
broker = broker.secondaryBroker ? broker.secondaryBroker : broker;
const RoleValidator = require('../../tools/RoleValidator');
const { handleError$ } = require('../../tools/GraphqlResponseTools');

const INTERNAL_SERVER_ERROR_CODE = 1;
const PERMISSION_DENIED_ERROR_CODE = 2;
const CONTEXT_NAME = "reporter";

const READ_ROLES = ["VEHICLESTATS_READ"];
const WRITE_ROLES = ["VEHICLESTATS_WRITE"];

// Development bypass for authentication
const DISABLE_AUTH_FOR_DEVELOPMENT = process.env.DISABLE_AUTH_FOR_DEVELOPMENT === 'true';

function getResponseFromBackEnd$(response) {
    return of(response)
        .pipe(
            map(resp => {
                if (resp.result.code != 200) {
                    const err = new Error();
                    err.name = 'Error';
                    err.message = resp.result.error;
                    // this[Symbol()] = resp.result.error;
                    Error.captureStackTrace(err, 'Error');
                    throw err;
                }
                return resp.data;
            })
        );
}

/**
 * Validate user roles and send request to backend handler
 * @param {object} root root of GraphQl
 * @param {object} OperationArguments arguments for query or mutation
 * @param {object} context graphQl context
 * @param { Array } requiredRoles Roles required to use the query or mutation
 * @param {string} operationType  sample: query || mutation
 * @param {string} aggregateName sample: Vehicle, Client, FixedFile 
 * @param {string} methodName method name
 * @param {number} timeout timeout for query or mutation in milliseconds
 */
function sendToBackEndHandler$(root, OperationArguments, context, requiredRoles, operationType, aggregateName, methodName, timeout = 2000) {
    // Bypass authentication for development
    if (DISABLE_AUTH_FOR_DEVELOPMENT) {
        console.log(`Development mode: Bypassing authentication for ${methodName}`);
        
        // Create a mock JWT context for development
        const mockContext = {
            authToken: {
                realm_access: { roles: [...READ_ROLES, ...WRITE_ROLES] },
                preferred_username: 'dev-user'
            },
            encodedToken: 'mock-jwt-token-for-development'
        };
        
        return broker.forwardAndGetReply$(
            aggregateName,
            `emigateway.graphql.${operationType}.${methodName}`,
            { root, args: OperationArguments, jwt: mockContext.encodedToken },
            timeout
        ).pipe(
            catchError(err => handleError$(err, methodName)),
            mergeMap(response => getResponseFromBackEnd$(response))
        );
    }
    
    // Normal authentication flow for production
    return RoleValidator.checkPermissions$(
        context.authToken.realm_access.roles,
        CONTEXT_NAME,
        methodName,
        PERMISSION_DENIED_ERROR_CODE,
        "Permission denied",
        requiredRoles
    )
        .pipe(
            mergeMap(() =>
                broker.forwardAndGetReply$(
                    aggregateName,
                    `emigateway.graphql.${operationType}.${methodName}`,
                    { root, args: OperationArguments, jwt: context.encodedToken },
                    timeout
                )
            ),
            catchError(err => handleError$(err, methodName)),
            mergeMap(response => getResponseFromBackEnd$(response))
        )
}


module.exports = {

    //// QUERY ///////
    Query: {
        ReporterVehicleStatsListing(root, args, context) {
            return sendToBackEndHandler$(root, args, context, READ_ROLES, 'query', 'VehicleStats', 'ReporterVehicleStatsListing').toPromise();
        },
        ReporterVehicleStats(root, args, context) {
            // Handle fleet_stats ID case for fleet statistics queries
            if (args.id === 'fleet_stats') {
                return sendToBackEndHandler$(root, args, context, READ_ROLES, 'query', 'VehicleStats', 'ReporterFleetStatistics').toPromise();
            }
            return sendToBackEndHandler$(root, args, context, READ_ROLES, 'query', 'VehicleStats', 'ReporterVehicleStats').toPromise();
        }
    },

    //// MUTATIONS ///////
    Mutation: {
        ReporterCreateVehicleStats(root, args, context) {
            return sendToBackEndHandler$(root, args, context, WRITE_ROLES, 'mutation', 'VehicleStats', 'ReporterCreateVehicleStats').toPromise();
        },
        ReporterUpdateVehicleStats(root, args, context) {
            return sendToBackEndHandler$(root, args, context, WRITE_ROLES, 'mutation', 'VehicleStats', 'ReporterUpdateVehicleStats').toPromise();
        },
        ReporterDeleteVehicleStatss(root, args, context) {
            return sendToBackEndHandler$(root, args, context, WRITE_ROLES, 'mutation', 'VehicleStats', 'ReporterDeleteVehicleStatss').toPromise();
        },
    },

    //// SUBSCRIPTIONS ///////
    Subscription: {
        ReporterVehicleStatsModified: {
            subscribe: withFilter(
                (payload, variables, context, info) => {
                    // Bypass authentication for development
                    if (DISABLE_AUTH_FOR_DEVELOPMENT) {
                        console.log(`Development mode: Bypassing subscription authentication`);
                        return pubsub.asyncIterator("ReporterVehicleStatsModified");
                    }
                    
                    //Checks the roles of the user, if the user does not have at least one of the required roles, an error will be thrown
                    RoleValidator.checkAndThrowError(
                        context.authToken.realm_access.roles,
                        READ_ROLES,
                        "Reporter",
                        "ReporterVehicleStatsModified",
                        PERMISSION_DENIED_ERROR_CODE,
                        "Permission denied"
                    );
                    return pubsub.asyncIterator("ReporterVehicleStatsModified");
                },
                (payload, variables, context, info) => {
                    return payload
                        ? (payload.ReporterVehicleStatsModified.id === variables.id) || (variables.id === "ANY")
                        : false;
                }
            )
        }
    }
};


//// SUBSCRIPTIONS SOURCES ////

const eventDescriptors = [
    {
        backendEventName: "ReporterVehicleStatsModified",
        gqlSubscriptionName: "ReporterVehicleStatsModified",
        dataExtractor: evt => evt.data, // OPTIONAL, only use if needed
        onError: (error, descriptor) =>
            console.log(`Error processing ${descriptor.backendEventName}`), // OPTIONAL, only use if needed
        onEvent: (evt, descriptor) =>
            console.log(`Event of type  ${descriptor.backendEventName} arrived`) // OPTIONAL, only use if needed
    }
];

/**
 * Connects every backend event to the right GQL subscription
 */
eventDescriptors.forEach(descriptor => {
    broker.getMaterializedViewsUpdates$([descriptor.backendEventName]).subscribe(
        evt => {
            if (descriptor.onEvent) {
                descriptor.onEvent(evt, descriptor);
            }
            const payload = {};
            payload[descriptor.gqlSubscriptionName] = descriptor.dataExtractor
                ? descriptor.dataExtractor(evt)
                : evt.data;
            pubsub.publish(descriptor.gqlSubscriptionName, payload);
        },

        error => {
            if (descriptor.onError) {
                descriptor.onError(error, descriptor);
            }
            console.error(`Error listening ${descriptor.gqlSubscriptionName}`, error);
        },

        () => console.log(`${descriptor.gqlSubscriptionName} listener STOPED.`)
    );
});