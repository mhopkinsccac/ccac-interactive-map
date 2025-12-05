// Map Component - Handles Mapbox GL JS map initialization and interactions
class MapComponent {
    constructor(containerId, mapboxToken, stateManager) {
        this.containerId = containerId;
        this.mapboxToken = mapboxToken;
        this.stateManager = stateManager;
        this.map = null;
        this.minimap = null;
        this.currentPitch = 45;
        this.currentBearing = -17.6;
        this.loadedLayers = new Set();
    }

    async init() {
        try {
            console.log('🗺️ Initializing Mapbox map...');

            // Set Mapbox access token
            mapboxgl.accessToken = this.mapboxToken;

            // Initialize map with 3D style
            this.map = new mapboxgl.Map({
                container: this.containerId,
                style: 'mapbox://styles/mapbox/streets-v12',
                center: [-87.6298, 41.8], // Chicago center
                zoom: 10.5,
                pitch: this.currentPitch,
                bearing: this.currentBearing,
                antialias: true
            });

            // Wait for map to load
            await new Promise((resolve) => {
                this.map.on('load', resolve);
            });

            // Set up 3D buildings
            this.setup3DBuildings();

            // Set up map event listeners
            this.setupEventListeners();

            console.log('✅ Map initialized successfully');

        } catch (error) {
            console.error('❌ Map initialization failed:', error);
            throw error;
        }
    }

    setup3DBuildings() {
        // Add 3D buildings layer
        this.map.addLayer({
            'id': '3d-buildings',
            'source': 'composite',
            'source-layer': 'building',
            'filter': ['==', 'extrude', 'true'],
            'type': 'fill-extrusion',
            'minzoom': 15,
            'paint': {
                'fill-extrusion-color': '#aaa',
                'fill-extrusion-height': {
                    'type': 'identity',
                    'property': 'height'
                },
                'fill-extrusion-base': {
                    'type': 'identity',
                    'property': 'min_height'
                },
                'fill-extrusion-opacity': 0.8
            }
        });
    }

    setupEventListeners() {
        // Mouse move for coordinate display
        this.map.on('mousemove', (e) => {
            const coords = e.lngLat;
            // Update coordinate display if element exists
            const coordDisplay = document.querySelector('.coordinate-display');
            if (coordDisplay) {
                coordDisplay.textContent = `${coords.lng.toFixed(4)}, ${coords.lat.toFixed(4)}`;
            }
        });

        // Click events for popups
        this.map.on('click', (e) => {
            this.handleMapClick(e);
        });

        // Hover effects
        this.map.on('mouseenter', 'segments-layer', () => {
            this.map.getCanvas().style.cursor = 'pointer';
        });

        this.map.on('mouseleave', 'segments-layer', () => {
            this.map.getCanvas().style.cursor = '';
        });
    }

    handleMapClick(e) {
        // Query features at click point, but only from our loaded layers
        const features = this.map.queryRenderedFeatures(e.point, {
            layers: Array.from(this.loadedLayers)
        });

        if (features.length > 0) {
            const feature = features[0];
            this.showPopup(e.lngLat, feature);
        }
    }

    showPopup(lngLat, feature) {
        // Create popup content
        const properties = feature.properties;
        let content = `<div class="popup-header">${feature.layer.id}</div>`;

        // Display properties in a clean format
        Object.keys(properties).forEach(key => {
            if (properties[key] !== null && properties[key] !== undefined) {
                content += `
                    <div class="popup-property">
                        <span class="popup-property-name">${key}:</span>
                        <span class="popup-property-value">${properties[key]}</span>
                    </div>
                `;
            }
        });

        // Create and show popup
        new mapboxgl.Popup()
            .setLngLat(lngLat)
            .setHTML(content)
            .addTo(this.map);
    }

    rotateView() {
        this.currentBearing += 45;
        if (this.currentBearing >= 360) {
            this.currentBearing = 0;
        }

        this.map.easeTo({
            bearing: this.currentBearing,
            duration: 500
        });
    }

    togglePitch() {
        this.currentPitch = this.currentPitch === 0 ? 60 : 0;

        this.map.easeTo({
            pitch: this.currentPitch,
            duration: 500
        });
    }

    getZoningColor(zoneClass) {
        // Returns color based on LBCS standards
        if (!zoneClass) return '#cccccc';

        const zone = zoneClass.toUpperCase();

        // Residential (RS, RT, RM) - Yellow (LBCS 1000)
        if (/^R[SMT]/.test(zone)) return '#FFFF00';

        // Business & Commercial (B1-B3, C1-C3) - Red (LBCS 2000)
        if (/^B[123]/.test(zone)) return '#FF0000';
        if (/^C[123]/.test(zone)) return '#FF0000';

        // Downtown (DC, DR, DS, DX) - Red (LBCS 2000 commercial core)
        if (/^D[CRSX]/.test(zone)) return '#FF0000';

        // Industrial (M1, M2, M3) - Purple (LBCS 3000)
        if (/^M[123]/.test(zone)) return '#A020F0';

        // Planned Development - Beige for PD, Purple for PMD
        if (/^PMD/.test(zone)) return '#A020F0';  // LBCS industrial/manufacturing
        if (/^PD/.test(zone)) return '#F5F5DC';   // LBCS developing site

        // Parks (POS) - Light Green (LBCS 7000)
        if (/^POS/.test(zone)) return '#90EE90';

        // Transportation (T) - Gray (LBCS 4000/5000)
        if (/^T-/.test(zone) || zone === 'T') return '#BEBEBE';

        // Default for unknown zones
        return '#BDC3C7';
    }

    async addDataLayer(layerConfig) {
        try {
            const { id, data, geometryType, style } = layerConfig;

            // Add source
            this.map.addSource(id, {
                type: 'geojson',
                data: data
            });

            // Add layer based on geometry type
            let mapboxLayer = null;

            switch (geometryType) {
                case 'Point':
                case 'MultiPoint':
                    mapboxLayer = {
                        id: id,
                        type: 'circle',
                        source: id,
                        paint: {
                            'circle-color': style.fillColor || '#007bff',
                            'circle-radius': style.radius || 5,
                            'circle-opacity': style.fillOpacity || 0.8,
                            'circle-stroke-color': style.strokeColor || '#ffffff',
                            'circle-stroke-width': style.strokeWidth || 1
                        }
                    };
                    break;

                case 'LineString':
                case 'MultiLineString':
                    mapboxLayer = {
                        id: id,
                        type: 'line',
                        source: id,
                        paint: {
                            'line-color': style.color || '#007bff',
                            'line-width': style.weight || 2,
                            'line-opacity': style.opacity || 0.8
                        }
                    };
                    break;

                case 'Polygon':
                case 'MultiPolygon':
                    // Special handling for block group visualizations - use gradient styling
                    if (id === 'block_groups_adi') {
                        mapboxLayer = {
                            id: id,
                            type: 'fill',
                            source: id,
                            paint: {
                                'fill-color': [
                                    'interpolate',
                                    ['linear'],
                                    ['to-number', ['get', 'adi']],
                                    0, '#22c55e',   // Green (low deprivation)
                                    50, '#fbbf24',  // Yellow (moderate)
                                    100, '#ef4444'  // Red (high deprivation)
                                ],
                                'fill-opacity': 0.6
                            }
                        };

                        const strokeLayer = {
                            id: `${id}-stroke`,
                            type: 'line',
                            source: id,
                            paint: {
                                'line-color': '#333333',
                                'line-width': 0.5,
                                'line-opacity': 0.5
                            }
                        };

                        this.map.addLayer(mapboxLayer);
                        this.map.addLayer(strokeLayer);
                        this.loadedLayers.add(id);
                        this.loadedLayers.add(`${id}-stroke`);
                        return;
                    }

                    if (id === 'block_groups_crashes') {
                        mapboxLayer = {
                            id: id,
                            type: 'fill',
                            source: id,
                            paint: {
                                'fill-color': [
                                    'interpolate',
                                    ['linear'],
                                    ['get', 'crash_count'],
                                    0, '#22c55e',    // Green (low crashes)
                                    1250, '#fbbf24', // Yellow (moderate)
                                    2500, '#ef4444'  // Red (high crashes)
                                ],
                                'fill-opacity': 0.6
                            }
                        };

                        const strokeLayer = {
                            id: `${id}-stroke`,
                            type: 'line',
                            source: id,
                            paint: {
                                'line-color': '#333333',
                                'line-width': 0.5,
                                'line-opacity': 0.5
                            }
                        };

                        this.map.addLayer(mapboxLayer);
                        this.map.addLayer(strokeLayer);
                        this.loadedLayers.add(id);
                        this.loadedLayers.add(`${id}-stroke`);
                        return;
                    }

                    // Special handling for zoning districts - use LBCS color standards
                    if (id === 'zoning_districts') {
                        mapboxLayer = {
                            id: id,
                            type: 'fill',
                            source: id,
                            paint: {
                                'fill-color': [
                                    'case',
                                    // Residential (RS, RT, RM) - Yellow (LBCS 1000)
                                    ['any',
                                        ['==', ['slice', ['get', 'zone_class'], 0, 2], 'RS'],
                                        ['==', ['slice', ['get', 'zone_class'], 0, 2], 'RT'],
                                        ['==', ['slice', ['get', 'zone_class'], 0, 2], 'RM']
                                    ], '#FFFF00',
                                    // Business (B1, B2, B3) - Red (LBCS 2000)
                                    ['any',
                                        ['==', ['slice', ['get', 'zone_class'], 0, 2], 'B1'],
                                        ['==', ['slice', ['get', 'zone_class'], 0, 2], 'B2'],
                                        ['==', ['slice', ['get', 'zone_class'], 0, 2], 'B3']
                                    ], '#FF0000',
                                    // Commercial (C1, C2, C3) - Red (LBCS 2000)
                                    ['any',
                                        ['==', ['slice', ['get', 'zone_class'], 0, 2], 'C1'],
                                        ['==', ['slice', ['get', 'zone_class'], 0, 2], 'C2'],
                                        ['==', ['slice', ['get', 'zone_class'], 0, 2], 'C3']
                                    ], '#FF0000',
                                    // Downtown (DC, DR, DS, DX) - Red (LBCS 2000 commercial core)
                                    ['any',
                                        ['==', ['slice', ['get', 'zone_class'], 0, 2], 'DC'],
                                        ['==', ['slice', ['get', 'zone_class'], 0, 2], 'DR'],
                                        ['==', ['slice', ['get', 'zone_class'], 0, 2], 'DS'],
                                        ['==', ['slice', ['get', 'zone_class'], 0, 2], 'DX']
                                    ], '#FF0000',
                                    // Industrial (M1, M2, M3) - Purple (LBCS 3000)
                                    ['any',
                                        ['==', ['slice', ['get', 'zone_class'], 0, 2], 'M1'],
                                        ['==', ['slice', ['get', 'zone_class'], 0, 2], 'M2'],
                                        ['==', ['slice', ['get', 'zone_class'], 0, 2], 'M3']
                                    ], '#A020F0',
                                    // PMD - Purple (LBCS 3000 industrial/manufacturing)
                                    ['==', ['slice', ['get', 'zone_class'], 0, 3], 'PMD'], '#A020F0',
                                    // PD - Beige (LBCS developing site)
                                    ['==', ['slice', ['get', 'zone_class'], 0, 2], 'PD'], '#F5F5DC',
                                    // Parks (POS) - Light Green (LBCS 7000)
                                    ['==', ['slice', ['get', 'zone_class'], 0, 3], 'POS'], '#90EE90',
                                    // Transportation (T) - Gray (LBCS 4000/5000)
                                    ['==', ['slice', ['get', 'zone_class'], 0, 1], 'T'], '#BEBEBE',
                                    // Default
                                    '#BDC3C7'
                                ],
                                'fill-opacity': 0.5
                            }
                        };

                        const strokeLayer = {
                            id: `${id}-stroke`,
                            type: 'line',
                            source: id,
                            paint: {
                                'line-color': '#666666',
                                'line-width': 0.5,
                                'line-opacity': 0.8
                            }
                        };

                        this.map.addLayer(mapboxLayer);
                        this.map.addLayer(strokeLayer);
                        this.loadedLayers.add(id);
                        this.loadedLayers.add(`${id}-stroke`);
                        return;
                    }

                    // Default polygon styling for other datasets
                    mapboxLayer = {
                        id: id,
                        type: 'fill',
                        source: id,
                        paint: {
                            'fill-color': style.fillColor || '#007bff',
                            'fill-opacity': style.fillOpacity || 0.3
                        }
                    };

                    // Add stroke layer
                    const strokeLayer = {
                        id: `${id}-stroke`,
                        type: 'line',
                        source: id,
                        paint: {
                            'line-color': style.strokeColor || '#007bff',
                            'line-width': style.strokeWidth || 1,
                            'line-opacity': style.strokeOpacity || 1
                        }
                    };

                    this.map.addLayer(mapboxLayer);
                    this.map.addLayer(strokeLayer);
                    this.loadedLayers.add(id);
                    this.loadedLayers.add(`${id}-stroke`);
                    return;
            }

            if (mapboxLayer) {
                this.map.addLayer(mapboxLayer);
                this.loadedLayers.add(id);
            }

        } catch (error) {
            console.error(`❌ Failed to add layer ${layerConfig.id}:`, error);
            throw error;
        }
    }

    removeDataLayer(layerId) {
        try {
            if (this.map.getLayer(layerId)) {
                this.map.removeLayer(layerId);
            }
            if (this.map.getLayer(`${layerId}-stroke`)) {
                this.map.removeLayer(`${layerId}-stroke`);
            }
            if (this.map.getSource(layerId)) {
                this.map.removeSource(layerId);
            }

            this.loadedLayers.delete(layerId);
            this.loadedLayers.delete(`${layerId}-stroke`);
        } catch (error) {
            console.error(`❌ Failed to remove layer ${layerId}:`, error);
        }
    }

    toggleLayerVisibility(layerId, visible) {
        try {
            const visibility = visible ? 'visible' : 'none';

            if (this.map.getLayer(layerId)) {
                this.map.setLayoutProperty(layerId, 'visibility', visibility);
            }
            if (this.map.getLayer(`${layerId}-stroke`)) {
                this.map.setLayoutProperty(`${layerId}-stroke`, 'visibility', visibility);
            }
        } catch (error) {
            console.error(`❌ Failed to toggle layer visibility ${layerId}:`, error);
        }
    }

    updateLayerStyle(layerId, style) {
        try {
            if (!this.map.getLayer(layerId)) return;

            const layer = this.map.getLayer(layerId);

            switch (layer.type) {
                case 'circle':
                    if (style.fillColor) this.map.setPaintProperty(layerId, 'circle-color', style.fillColor);
                    if (style.radius) this.map.setPaintProperty(layerId, 'circle-radius', style.radius);
                    break;

                case 'line':
                    if (style.color) this.map.setPaintProperty(layerId, 'line-color', style.color);
                    if (style.weight) this.map.setPaintProperty(layerId, 'line-width', style.weight);
                    break;

                case 'fill':
                    if (style.fillColor) this.map.setPaintProperty(layerId, 'fill-color', style.fillColor);
                    if (style.fillOpacity) this.map.setPaintProperty(layerId, 'fill-opacity', style.fillOpacity);
                    break;
            }
        } catch (error) {
            console.error(`❌ Failed to update layer style ${layerId}:`, error);
        }
    }

    flyToFeature(feature) {
        try {
            // Calculate bounds for the feature
            const bounds = turf.bbox(feature);

            this.map.fitBounds(bounds, {
                padding: 50,
                duration: 1000
            });
        } catch (error) {
            console.error('❌ Failed to fly to feature:', error);
        }
    }

    highlightFeature(layerId, featureId) {
        try {
            // Set filter to highlight specific feature
            if (this.map.getLayer(layerId)) {
                this.map.setFilter(layerId, ['==', ['get', 'id'], featureId]);
            }
        } catch (error) {
            console.error(`❌ Failed to highlight feature ${featureId}:`, error);
        }
    }

    clearHighlight(layerId) {
        try {
            if (this.map.getLayer(layerId)) {
                this.map.setFilter(layerId, null);
            }
        } catch (error) {
            console.error(`❌ Failed to clear highlight:`, error);
        }
    }

    // Minimap functionality for segment details panel
    async initMiniMap(containerId, allSegments) {
        try {
            console.log('🗺️ Initializing minimap with all segments...');

            // Create minimap instance - straight down view, north-up orientation
            this.minimap = new mapboxgl.Map({
                container: containerId,
                style: 'mapbox://styles/mapbox/streets-v12',
                center: [-87.68, 41.9], // Chicago center, slightly north and west
                zoom: 9.5, // Zoomed out more to see whole city
                pitch: 0, // Looking straight down
                bearing: 0, // North is up (true north)
                interactive: true, // Enable user interaction (pan, zoom)
                attributionControl: false,
                preserveDrawingBuffer: true
            });

            // Wait for minimap to load
            await new Promise((resolve) => {
                this.minimap.on('load', resolve);
            });

            // Create GeoJSON features from all segments with score-based colors
            const allSegmentsFeatures = allSegments.map(segment => {
                // segment.geometry is already a Turf polygon, extract the geometry part
                const geom = segment.geometry.geometry ? segment.geometry.geometry : segment.geometry;

                return {
                    type: 'Feature',
                    properties: {
                        id: segment.id,
                        score: segment.score,
                        scoreColor: this.getScoreColorForMinimap(segment.score)
                    },
                    geometry: geom
                };
            });

            // Add source with all segments
            this.minimap.addSource('minimap-segments', {
                type: 'geojson',
                data: {
                    type: 'FeatureCollection',
                    features: allSegmentsFeatures
                }
            });

            // Add layer for all segments with score-based heatmap colors (no borders, seamless)
            this.minimap.addLayer({
                id: 'minimap-segments-layer',
                type: 'fill',
                source: 'minimap-segments',
                paint: {
                    'fill-color': ['get', 'scoreColor'],
                    'fill-opacity': 0.9
                }
            });

            // Add thick outline layer using same color as fill (makes segments visible from far away)
            this.minimap.addLayer({
                id: 'minimap-segments-outline',
                type: 'line',
                source: 'minimap-segments',
                paint: {
                    'line-color': ['get', 'scoreColor'],
                    'line-width': 10,
                    'line-opacity': 1
                }
            });

            // Add empty source for selected segment point marker
            this.minimap.addSource('minimap-selected-point', {
                type: 'geojson',
                data: {
                    type: 'FeatureCollection',
                    features: []
                }
            });

            // Add point marker for selected segment (transparent center with blue outline)
            this.minimap.addLayer({
                id: 'minimap-selected-point-layer',
                type: 'circle',
                source: 'minimap-selected-point',
                paint: {
                    'circle-radius': 12,
                    'circle-color': '#ffffff',
                    'circle-stroke-width': 4,
                    'circle-stroke-color': '#2563eb',  // Blue outline
                    'circle-opacity': 0  // Transparent/see-through center
                }
            });

            console.log('✅ Minimap initialized successfully');

            // Trigger resize after a short delay to ensure proper rendering
            setTimeout(() => this.minimap.resize(), 100);

        } catch (error) {
            console.error('❌ Minimap initialization failed:', error);
        }
    }

    updateMinimapHighlight(selectedSegment) {
        if (!this.minimap || !selectedSegment) {
            return;
        }

        try {
            console.log(`🗺️ Updating minimap point for segment: ${selectedSegment.id}`);

            // Get the center point of the segment
            const [lng, lat] = selectedSegment.center;

            // Center the minimap on the selected segment
            this.minimap.flyTo({
                center: [lng, lat],
                zoom: 9,
                duration: 1000,
                essential: true
            });

            // Update point marker at segment center
            this.minimap.getSource('minimap-selected-point').setData({
                type: 'Feature',
                properties: { id: selectedSegment.id },
                geometry: {
                    type: 'Point',
                    coordinates: [lng, lat]
                }
            });

        } catch (error) {
            console.error('❌ Failed to update minimap point:', error);
        }
    }

    getScoreColorForMinimap(score) {
        // Red (low) to Yellow to Green (high) gradient
        // Score is 0-100
        if (score >= 70) {
            // Green gradient (70-100)
            const ratio = (score - 70) / 30;
            const r = Math.round(144 - 144 * ratio); // 144 -> 0
            const g = Math.round(238); // Stay at 238
            const b = Math.round(144 - 144 * ratio); // 144 -> 0
            return `rgb(${r}, ${g}, ${b})`;
        } else if (score >= 40) {
            // Yellow gradient (40-70)
            const ratio = (score - 40) / 30;
            const r = Math.round(251 - 107 * ratio); // 251 -> 144
            const g = Math.round(191 + 47 * ratio); // 191 -> 238
            const b = Math.round(36 + 108 * ratio); // 36 -> 144
            return `rgb(${r}, ${g}, ${b})`;
        } else {
            // Red gradient (0-40)
            const ratio = score / 40;
            const r = Math.round(220 + 31 * ratio); // 220 -> 251
            const g = Math.round(38 + 153 * ratio); // 38 -> 191
            const b = Math.round(38 - 2 * ratio); // 38 -> 36
            return `rgb(${r}, ${g}, ${b})`;
        }
    }

    destroyMiniMap() {
        if (this.minimap) {
            console.log('🗺️ Destroying minimap...');
            this.minimap.remove();
            this.minimap = null;
        }
    }

    hasMiniMap() {
        return this.minimap !== null;
    }

    getMap() {
        return this.map;
    }
}

export default MapComponent;