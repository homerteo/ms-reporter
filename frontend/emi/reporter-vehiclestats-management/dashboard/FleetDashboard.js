import React, { useState, useEffect } from 'react';
import { 
    Typography, 
    Grid, 
    Card, 
    CardContent, 
    LinearProgress, 
    Box,
    Chip,
    CircularProgress,
    Fade,
    Button
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { useQuery, useSubscription } from '@apollo/react-hooks';
import { useSelector } from 'react-redux';
import { ReporterFleetStatistics, onReporterVehicleStatsModified } from '../gql/VehicleStats';
import i18n from '../i18n';

const useStyles = makeStyles(theme => ({
    root: {
        padding: theme.spacing(3),
        animation: 'slideUp 0.3s ease-out',
    },
    '@keyframes slideUp': {
        from: {
            transform: 'translateY(20px)',
            opacity: 0,
        },
        to: {
            transform: 'translateY(0)',
            opacity: 1,
        },
    },
    card: {
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'all 0.3s ease-in-out',
        '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: theme.shadows[8],
        },
    },
    cardContent: {
        flexGrow: 1,
    },
    title: {
        fontSize: '1.8rem',
        fontWeight: 'bold',
        marginBottom: theme.spacing(3),
        color: theme.palette.primary.main,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: '1.1rem',
        color: theme.palette.text.secondary,
        marginBottom: theme.spacing(2),
        fontWeight: 600,
    },
    statValue: {
        fontSize: '2rem',
        fontWeight: 'bold',
        color: theme.palette.primary.main,
    },
    statLabel: {
        fontSize: '0.9rem',
        color: theme.palette.text.secondary,
    },
    progressBar: {
        marginTop: theme.spacing(1),
        marginBottom: theme.spacing(1),
        height: 8,
        borderRadius: 4,
    },
    chip: {
        margin: theme.spacing(0.5),
    },
    loadingContainer: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '200px',
        flexDirection: 'column',
    },
    errorContainer: {
        textAlign: 'center',
        padding: theme.spacing(3),
        color: theme.palette.error.main,
    },
    totalCard: {
        background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
        color: theme.palette.primary.contrastText,
        '& .MuiTypography-root': {
            color: theme.palette.primary.contrastText,
        }
    },
    demoButton: {
        marginTop: theme.spacing(2),
        marginBottom: theme.spacing(2),
    }
}));

const FleetDashboard = () => {
    const classes = useStyles();
    const [fleetStats, setFleetStats] = useState(null);
    const [useDemoData, setUseDemoData] = useState(false);
    
    // Obtener el idioma actual del Redux store de forma segura sin optional chaining
    const locale = useSelector(state => {
        try {
            return (state && state.i18n && state.i18n.language) || 
                   (state && state.settings && state.settings.language) || 
                   'es';
        } catch (error) {
            console.warn('No se pudo obtener el idioma del store, usando español por defecto');
            return 'es';
        }
    });
    
    const translations = i18n.get(locale);

    // Datos de demostración
    const demoData = {
        id: 'demo_fleet_stats',
        name: 'Estadísticas de Flota Demo',
        totalVehicles: 1250,
        vehiclesByType: JSON.stringify({
            'Automóviles': 850,
            'SUVs': 200,
            'Camionetas': 120,
            'Motos': 80
        }),
        vehiclesByDecade: JSON.stringify({
            '1990s': 150,
            '2000s': 300,
            '2010s': 500,
            '2020s': 300
        }),
        vehiclesBySpeedClass: JSON.stringify({
            'Lento': 400,
            'Normal': 650,
            'Rapido': 200
        }),
        hpStats: JSON.stringify({
            min: 85,
            max: 750,
            avg: 185.5
        }),
        lastUpdated: new Date().toISOString()
    };

    // Query para obtener estadísticas de flota usando apollo hooks
    const { data: queryData, loading: queryLoading, error: queryError, refetch } = useQuery(
        ReporterFleetStatistics({ id: 'fleet_stats' }).query,
        {
            variables: { id: 'fleet_stats' },
            fetchPolicy: 'network-only',
            errorPolicy: 'all',
            notifyOnNetworkStatusChange: true,
            skip: useDemoData // Saltar la consulta si estamos usando datos demo
        }
    );

    // Suscripción para actualizaciones en tiempo real
    const { data: subscriptionData } = useSubscription(
        onReporterVehicleStatsModified({ id: 'fleet_stats' })[0],
        {
            variables: { id: 'fleet_stats' },
            skip: useDemoData, // Saltar la suscripción si estamos usando datos demo
            onSubscriptionData: ({ subscriptionData }) => {
                console.log('Subscription data received:', subscriptionData);
            }
        }
    );

    // Actualizar estadísticas cuando llegan datos de la consulta
    useEffect(() => {
        if (queryData && queryData.ReporterVehicleStats) {
            console.log('Query data received:', queryData.ReporterVehicleStats);
            setFleetStats(queryData.ReporterVehicleStats);
            setUseDemoData(false);
        }
    }, [queryData]);

    // Actualizar estadísticas cuando llegan datos de la suscripción
    useEffect(() => {
        if (subscriptionData && subscriptionData.ReporterVehicleStatsModified) {
            console.log('Subscription update received:', subscriptionData.ReporterVehicleStatsModified);
            setFleetStats(subscriptionData.ReporterVehicleStatsModified);
        }
    }, [subscriptionData]);

    // Cargar datos demo si hay error en la consulta
    useEffect(() => {
        if (queryError && !useDemoData) {
            console.log('Error en consulta GraphQL, cargando datos demo');
            setFleetStats(demoData);
            setUseDemoData(true);
        }
    }, [queryError, useDemoData, demoData]);

    // Función para obtener traducción
    const t = (key, defaultValue = '') => {
        if (!translations) {
            return defaultValue || key;
        }
        
        const keys = key.split('.');
        let value = translations;
        
        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                return defaultValue || key;
            }
        }
        
        return value || defaultValue || key;
    };

    // Función para parsear datos JSON de forma segura
    const parseJsonField = (jsonString, defaultValue = {}) => {
        if (!jsonString) return defaultValue;
        try {
            return JSON.parse(jsonString);
        } catch (error) {
            console.error('Error parsing JSON field:', error);
            return defaultValue;
        }
    };

    // Función para calcular porcentaje
    const calculatePercentage = (value, total) => {
        if (!total || total === 0) return 0;
        return Math.round((value / total) * 100);
    };

    // Función para formatear números con separadores de miles
    const formatNumber = (number) => {
        if (typeof number !== 'number') return '0';
        return new Intl.NumberFormat().format(number);
    };

    // Función para cargar datos demo manualmente
    const loadDemoData = () => {
        setFleetStats(demoData);
        setUseDemoData(true);
    };

    // Componente para renderizar las estadísticas
    const renderStatistics = (fleetStats) => {
        if (!fleetStats) {
            return (
                <div className={classes.errorContainer}>
                    <Typography variant="h6">
                        No hay datos disponibles
                    </Typography>
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={loadDemoData}
                        className={classes.demoButton}
                    >
                        Cargar Datos de Demostración
                    </Button>
                    {!useDemoData && (
                        <Button
                            variant="outlined"
                            color="primary"
                            onClick={() => refetch()}
                            className={classes.demoButton}
                        >
                            Reintentar Consulta
                        </Button>
                    )}
                </div>
            );
        }

        // Parsear datos de estadísticas
        const vehiclesByType = parseJsonField(fleetStats.vehiclesByType, {});
        const vehiclesByDecade = parseJsonField(fleetStats.vehiclesByDecade, {});
        const vehiclesBySpeedClass = parseJsonField(fleetStats.vehiclesBySpeedClass, {});
        const hpStats = parseJsonField(fleetStats.hpStats, { min: 0, max: 0, avg: 0 });
        const totalVehicles = fleetStats.totalVehicles || 0;

        return (
            <Fade in={true} timeout={500}>
                <Grid container spacing={3}>
                    {/* Indicador de datos demo */}
                    {useDemoData && (
                        <Grid item xs={12}>
                            <Box mb={2}>
                                <Chip 
                                    label="Mostrando datos de demostración"
                                    color="secondary"
                                    variant="outlined"
                                />
                                <Button
                                    variant="outlined"
                                    size="small"
                                    onClick={() => {
                                        setUseDemoData(false);
                                        refetch();
                                    }}
                                    style={{ marginLeft: 8 }}
                                >
                                    Intentar cargar datos reales
                                </Button>
                            </Box>
                        </Grid>
                    )}

                    {/* Total de Vehículos - Destacado al inicio */}
                    <Grid item xs={12}>
                        <Card className={`${classes.card} ${classes.totalCard}`}>
                            <CardContent>
                                <Box display="flex" justifyContent="space-between" alignItems="center">
                                    <Box>
                                        <Typography variant="h2" className={classes.statValue}>
                                            {formatNumber(totalVehicles)}
                                        </Typography>
                                        <Typography variant="h5" className={classes.statLabel}>
                                            {t('dashboard.total_vehicles', 'Total de Vehículos')}
                                        </Typography>
                                    </Box>
                                    <Box textAlign="right">
                                        <Chip 
                                            label={`${t('dashboard.last_updated', 'Última actualización')}: ${fleetStats.lastUpdated ? new Date(fleetStats.lastUpdated).toLocaleString() : 'N/A'}`}
                                            variant="outlined"
                                            size="small"
                                            className={classes.chip}
                                            style={{ color: 'white', borderColor: 'white' }}
                                        />
                                    </Box>
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>

                    {/* Vehículos por Tipo */}
                    <Grid item xs={12} md={4}>
                        <Card className={classes.card}>
                            <CardContent className={classes.cardContent}>
                                <Typography variant="h6" className={classes.subtitle}>
                                    {t('dashboard.vehicle_types', 'Vehículos por Tipo')}
                                </Typography>
                                {Object.entries(vehiclesByType).length > 0 ? (
                                    Object.entries(vehiclesByType).map(([type, count]) => {
                                        const percentage = calculatePercentage(count, totalVehicles);
                                        return (
                                            <Box key={type} mb={2}>
                                                <Box display="flex" justifyContent="space-between" alignItems="center">
                                                    <Typography variant="body1" style={{ fontWeight: 500 }}>
                                                        {type}
                                                    </Typography>
                                                    <Typography variant="body2" className={classes.statLabel}>
                                                        {formatNumber(count)} ({percentage}%)
                                                    </Typography>
                                                </Box>
                                                <LinearProgress
                                                    variant="determinate"
                                                    value={percentage}
                                                    className={classes.progressBar}
                                                    color="primary"
                                                />
                                            </Box>
                                        );
                                    })
                                ) : (
                                    <Typography variant="body2" className={classes.statLabel}>
                                        No hay datos disponibles
                                    </Typography>
                                )}
                            </CardContent>
                        </Card>
                    </Grid>

                    {/* Vehículos por Década */}
                    <Grid item xs={12} md={4}>
                        <Card className={classes.card}>
                            <CardContent className={classes.cardContent}>
                                <Typography variant="h6" className={classes.subtitle}>
                                    {t('dashboard.vehicle_decades', 'Vehículos por Década')}
                                </Typography>
                                {Object.entries(vehiclesByDecade).length > 0 ? (
                                    Object.entries(vehiclesByDecade)
                                        .sort(([a], [b]) => a.localeCompare(b))
                                        .map(([decade, count]) => {
                                            const percentage = calculatePercentage(count, totalVehicles);
                                            return (
                                                <Box key={decade} mb={2}>
                                                    <Box display="flex" justifyContent="space-between" alignItems="center">
                                                        <Typography variant="body1" style={{ fontWeight: 500 }}>
                                                            {decade}
                                                        </Typography>
                                                        <Typography variant="body2" className={classes.statLabel}>
                                                            {formatNumber(count)} ({percentage}%)
                                                        </Typography>
                                                    </Box>
                                                    <LinearProgress
                                                        variant="determinate"
                                                        value={percentage}
                                                        className={classes.progressBar}
                                                        color="secondary"
                                                    />
                                                </Box>
                                            );
                                        })
                                ) : (
                                    <Typography variant="body2" className={classes.statLabel}>
                                        No hay datos disponibles
                                    </Typography>
                                )}
                            </CardContent>
                        </Card>
                    </Grid>

                    {/* Estadísticas de Potencia */}
                    <Grid item xs={12} md={4}>
                        <Card className={classes.card}>
                            <CardContent className={classes.cardContent}>
                                <Typography variant="h6" className={classes.subtitle}>
                                    {t('dashboard.horsepower_stats', 'Estadísticas de Potencia (HP)')}
                                </Typography>
                                <Grid container spacing={2}>
                                    <Grid item xs={4}>
                                        <Box textAlign="center">
                                            <Typography variant="h4" className={classes.statValue}>
                                                {formatNumber(hpStats.min)}
                                            </Typography>
                                            <Typography variant="body2" className={classes.statLabel}>
                                                {t('dashboard.minimum', 'Mínimo')}
                                            </Typography>
                                        </Box>
                                    </Grid>
                                    <Grid item xs={4}>
                                        <Box textAlign="center">
                                            <Typography variant="h4" className={classes.statValue}>
                                                {formatNumber(hpStats.max)}
                                            </Typography>
                                            <Typography variant="body2" className={classes.statLabel}>
                                                {t('dashboard.maximum', 'Máximo')}
                                            </Typography>
                                        </Box>
                                    </Grid>
                                    <Grid item xs={4}>
                                        <Box textAlign="center">
                                            <Typography variant="h4" className={classes.statValue}>
                                                {formatNumber(Math.round(hpStats.avg || 0))}
                                            </Typography>
                                            <Typography variant="body2" className={classes.statLabel}>
                                                {t('dashboard.average', 'Promedio')}
                                            </Typography>
                                        </Box>
                                    </Grid>
                                </Grid>
                            </CardContent>
                        </Card>
                    </Grid>

                    {/* Clasificación por Velocidad */}
                    <Grid item xs={12}>
                        <Card className={classes.card}>
                            <CardContent className={classes.cardContent}>
                                <Typography variant="h6" className={classes.subtitle}>
                                    {t('dashboard.speed_classification', 'Clasificación por Velocidad')}
                                </Typography>
                                {Object.entries(vehiclesBySpeedClass).length > 0 ? (
                                    <Grid container spacing={3}>
                                        {Object.entries(vehiclesBySpeedClass).map(([speedClass, count]) => {
                                            const percentage = calculatePercentage(count, totalVehicles);
                                            let speedLabel = speedClass;
                                            
                                            // Mapear las clases de velocidad a las traducciones
                                            if (speedClass === 'Lento') {
                                                speedLabel = t('dashboard.speed_classes.LOW', 'Lento (<140 km/h)');
                                            } else if (speedClass === 'Normal') {
                                                speedLabel = t('dashboard.speed_classes.MEDIUM', 'Normal (140-240 km/h)');
                                            } else if (speedClass === 'Rapido') {
                                                speedLabel = t('dashboard.speed_classes.HIGH', 'Rápido (>240 km/h)');
                                            }

                                            return (
                                                <Grid item xs={12} sm={4} key={speedClass}>
                                                    <Box textAlign="center" p={2}>
                                                        <Typography variant="h4" className={classes.statValue}>
                                                            {formatNumber(count)}
                                                        </Typography>
                                                        <Typography variant="h6" className={classes.statLabel}>
                                                            ({percentage}%)
                                                        </Typography>
                                                        <Typography variant="body1" className={classes.statLabel} style={{ marginTop: 8 }}>
                                                            {speedLabel}
                                                        </Typography>
                                                        <LinearProgress
                                                            variant="determinate"
                                                            value={percentage}
                                                            className={classes.progressBar}
                                                            style={{ marginTop: 16 }}
                                                        />
                                                    </Box>
                                                </Grid>
                                            );
                                        })}
                                    </Grid>
                                ) : (
                                    <Typography variant="body2" className={classes.statLabel}>
                                        No hay datos disponibles
                                    </Typography>
                                )}
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            </Fade>
        );
    };

    if (queryLoading && !useDemoData) {
        return (
            <div className={classes.root}>
                <Typography variant="h4" className={classes.title}>
                    {t('dashboard.title', 'Dashboard de Análisis de Flota')}
                </Typography>
                <div className={classes.loadingContainer}>
                    <CircularProgress size={60} />
                    <Typography variant="h6" style={{ marginTop: 16 }}>
                        Cargando estadísticas...
                    </Typography>
                    <Button
                        variant="outlined"
                        color="primary"
                        onClick={loadDemoData}
                        className={classes.demoButton}
                    >
                        Usar Datos de Demostración
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className={classes.root}>
            <Typography variant="h4" className={classes.title}>
                {t('dashboard.title', 'Dashboard de Análisis de Flota')}
            </Typography>
            {renderStatistics(fleetStats)}
        </div>
    );
};

export default FleetDashboard;