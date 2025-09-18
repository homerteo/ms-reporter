import { gql } from 'apollo-boost';

export const ReporterVehicleStatsListing = (variables) => ({
    query: gql`
        query ReporterVehicleStatsListing(
            $filterInput: ReporterVehicleStatsFilterInput
            $paginationInput: ReporterVehicleStatsPaginationInput
            $sortInput: ReporterVehicleStatsSortInput
        ) {
            ReporterVehicleStatsListing(
                filterInput: $filterInput
                paginationInput: $paginationInput
                sortInput: $sortInput
            ) {
                listing {
                    id
                    name
                    active
                    totalVehicles
                    vehiclesByType
                    vehiclesByDecade
                    vehiclesBySpeedClass
                    hpStats
                    lastUpdated
                }
                queryTotalResultCount
            }
        }
    `,
    variables,
    fetchPolicy: "network-only",
});

export const ReporterVehicleStats = (variables) => ({
    query: gql`
        query ReporterVehicleStats($id: ID!, $organizationId: String) {
            ReporterVehicleStats(id: $id, organizationId: $organizationId) {
                id
                name
                description
                active
                organizationId
                totalVehicles
                vehiclesByType
                vehiclesByDecade
                vehiclesBySpeedClass
                hpStats
                lastUpdated
                metadata {
                    createdBy
                    createdAt
                    updatedBy
                    updatedAt
                }
            }
        }
    `,
    variables,
    fetchPolicy: "network-only",
});

// Query específica para estadísticas de flota
export const ReporterFleetStatistics = (variables) => ({
    query: gql`
        query ReporterFleetStatistics($id: ID!) {
            ReporterVehicleStats(id: $id) {
                id
                name
                totalVehicles
                vehiclesByType
                vehiclesByDecade
                vehiclesBySpeedClass
                hpStats
                lastUpdated
            }
        }
    `,
    variables,
    fetchPolicy: "network-only",
});

export const ReporterCreateVehicleStats = (variables) => ({
    mutation: gql`
        mutation ReporterCreateVehicleStats($input: ReporterVehicleStatsInput!) {
            ReporterCreateVehicleStats(input: $input) {
                id
                name
                description
                active
                organizationId
                metadata {
                    createdBy
                    createdAt
                    updatedBy
                    updatedAt
                }
            }
        }
    `,
    variables
});

export const ReporterDeleteVehicleStats = (variables) => ({
    mutation: gql`
        mutation ReporterDeleteVehicleStats($ids: [ID]!) {
            ReporterDeleteVehicleStats(ids: $ids) {
                code
                message
            }
        }
    `,
    variables
});

export const ReporterUpdateVehicleStats = (variables) => ({
    mutation: gql`
        mutation ReporterUpdateVehicleStats($id: ID!, $input: ReporterVehicleStatsInput!, $merge: Boolean!) {
            ReporterUpdateVehicleStats(id: $id, input: $input, merge: $merge) {
                id
                organizationId
                name
                description
                active
                totalVehicles
                vehiclesByType
                vehiclesByDecade
                vehiclesBySpeedClass
                hpStats
                lastUpdated
            }
        }
    `,
    variables
});

export const onReporterVehicleStatsModified = (variables) => ([
    gql`
        subscription onReporterVehicleStatsModified($id: ID!) {
            ReporterVehicleStatsModified(id: $id) {
                id
                organizationId
                name
                description
                active
                totalVehicles
                vehiclesByType
                vehiclesByDecade
                vehiclesBySpeedClass
                hpStats
                lastUpdated
                metadata {
                    createdBy
                    createdAt
                    updatedBy
                    updatedAt
                }
            }
        }
    `,
    { variables }
]);