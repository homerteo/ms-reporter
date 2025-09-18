export default {
  navigation: {
    'analytics': 'Analytics',
    'fleet-dashboard': 'Fleet Dashboard',
    'settings': 'Settings',
    'reporter-vehiclestats-management': 'VehicleStatss',
  },
  dashboard: {
    title: 'Fleet Analysis Dashboard',
    vehicle_types: 'Vehicles by Type',
    vehicle_decades: 'Vehicles by Decade',
    horsepower_stats: 'Horsepower (HP)',
    speed_classification: 'Speed Classification',
    minimum: 'Minimum',
    maximum: 'Maximum',
    average: 'Average',
    total_vehicles: 'Total vehicles analyzed',
    last_updated: 'Last updated',
    loading_error: 'Error loading fleet statistics',
    speed_classes: {
      LOW: 'Slow (<140 km/h)',
      MEDIUM: 'Normal (140-240 km/h)',
      HIGH: 'Fast (>240 km/h)'
    }
  },
  vehiclestatss: {
    vehiclestatss: 'VehicleStatss',
    search: 'Quick search by name',
    add_new_vehiclestats: 'ADD NEW',
    add_new_vehiclestats_short: 'NEW',
    rows_per_page: 'Rows per page:',
    of: 'of',
    remove: 'Remove',
    table_colums: {
      name: 'Name',
      active: 'Active'
    },
    remove_dialog_title: "Do you want to delete the selected VehicleStatss??",
    remove_dialog_description: "This action can not be undone",
    remove_dialog_no: "No",
    remove_dialog_yes: "Yes",
    filters: {
      title: "Filters",
      active: "Active"
    }
  },
  vehiclestats: {
    vehiclestatss: 'VehicleStatss',
    vehiclestats_detail: 'VehicleStats detail',
    save: 'SAVE',
    basic_info: 'Basic Info',
    name: 'Name',
    description: 'Description',
    active: 'Active',
    metadata_tab: 'Metadata',
    metadata: {
      createdBy: 'Created by',
      createdAt: 'Created at',
      updatedBy: 'Modified by',
      updatedAt: 'Modified at',
    },
    not_found: 'Sorry but we could not find the entity you are looking for',
    internal_server_error: 'Internal Server Error',
    update_success: 'VehicleStats has been updated',
    create_success: 'VehicleStats has been created',
    form_validations: {
      name: {
        length: "Name must be at least {len} characters",
        required: "Name is required",
      }
    },
  }
};