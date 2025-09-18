export default {
  navigation: {
    'analytics': 'Analíticas',
    'fleet-dashboard': 'Dashboard de Flota',
    'settings': 'Configuraciones',
    'reporter-vehiclestats-management': 'VehicleStatss',
  },
  dashboard: {
    title: 'Dashboard de Análisis de Flota',
    vehicle_types: 'Vehículos por Tipo',
    vehicle_decades: 'Vehículos por Década',
    horsepower_stats: 'Potencia (HP)',
    speed_classification: 'Clasificación por Velocidad',
    minimum: 'Mínimo',
    maximum: 'Máximo',
    average: 'Promedio',
    total_vehicles: 'Total de vehículos analizados',
    last_updated: 'Última actualización',
    loading_error: 'Error cargando estadísticas de flota',
    speed_classes: {
      LOW: 'Lento (<140 km/h)',
      MEDIUM: 'Normal (140-240 km/h)',
      HIGH: 'Rápido (>240 km/h)'
    }
  },
  vehiclestatss: {
    vehiclestatss: 'VehicleStatss',
    search: 'Búsqueda rápida por nombre',
    add_new_vehiclestats: 'Agregar Nueva',
    add_new_vehiclestats_short: 'Agregar',
    rows_per_page: 'Filas por página:',
    of: 'de',
    remove: 'Eliminar',
    table_colums: {
      name: 'Nombre',
      active: 'Activo'
    },
    remove_dialog_title: "¿Desea eliminar las vehicleStatss seleccionadas?",
    remove_dialog_description: "Esta acción no se puede deshacer",
    remove_dialog_no: "No",
    remove_dialog_yes: "Si",
    filters: {
      title: "Filtros",
      active: "Activo"
    }
  },
  vehiclestats: {
    vehiclestatss: 'VehicleStatss',
    vehiclestats_detail: 'Detalle de la VehicleStats',
    save: 'GUARDAR',
    basic_info: 'Información Básica',
    name: 'Nombre',
    description: 'Descripción',
    active: 'Activo',
    metadata_tab: 'Metadatos',
    metadata: {
      createdBy: 'Creado por',
      createdAt: 'Creado el',
      updatedBy: 'Modificado por',
      updatedAt: 'Modificado el',
    },
    not_found: 'Lo sentimos pero no pudimos encontrar la entidad que busca',
    internal_server_error: 'Error Interno del Servidor',
    update_success: 'VehicleStats ha sido actualizado',
    create_success: 'VehicleStats ha sido creado',
    form_validations: {
      name: {
        length: "El nombre debe tener al menos {len} caracteres",
        required: "El nombre es requerido",
      }
    },
  }
};