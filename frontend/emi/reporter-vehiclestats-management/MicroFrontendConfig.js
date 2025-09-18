import React from 'react';
import { Redirect } from 'react-router-dom';
import i18n from './i18n'

const auth = ["VEHICLESTATS_READ"];

export const MicroFrontendConfig = {
    settings: {
        layout: {}
    },
    auth,
    routes: [
        { 
            path: '/vehiclestats-mng/vehiclestatss/:vehicleStatsId/:vehicleStatsHandle?',
            component: React.lazy(() => import('./vehiclestats/VehicleStats'))
        },
        {
            path: '/vehiclestats-mng/vehiclestatss',
            component: React.lazy(() => import('./vehiclestatss/VehicleStatss'))
        },
        {
            path: '/vehiclestats-mng/dashboard',
            component: React.lazy(() => import('./dashboard/FleetDashboard'))
        },
        {
            path: '/vehiclestats-mng',
            component: () => <Redirect to="/vehiclestats-mng/dashboard" />
        }
    ],
    navigationConfig: [
        {
            'id': 'analytics',
            'type': 'collapse',
            'icon': 'dashboard',
            'priority': 50,
            children: [{
                'id': 'fleet-dashboard',
                'type': 'item',
                'icon': 'analytics',
                'url': '/vehiclestats-mng/dashboard',
                'priority': 1000,
                auth
            }]
        },
        {
            'id': 'settings',
            'type': 'collapse',
            'icon': 'settings',
            'priority': 100,
            children: [{
                'id': 'reporter-vehiclestats-management',
                'type': 'item',
                'icon': 'business',
                'url': '/vehiclestats-mng/vehiclestatss',
                'priority': 2000,
                auth
            }]
        }
    ],
    i18nLocales: i18n.locales
};

