// UI Controller - Manages all user interface interactions and updates
class UIController {
    constructor(mapComponent, stateManager) {
        this.mapComponent = mapComponent;
        this.stateManager = stateManager;
        this.datasetCatalog = null;
        this.loadingStates = new Map();

        // Scenario configurations
        this.scenarios = {
            'best-overall': {
                name: 'Best Overall',
                description: 'Results from a survey on desirable traits, answered by CCAC staff.',
                requirements: {},
                features: {
                    ctaStations: 9, metraStations: 8, amtrakStations: 7, parks: 6,
                    transitDensity: 7, bikeNetwork: 5, population: 7, householdSize: 4,
                    income: 5, adi: 8, crashes: 5, permits: 5, hospitals: 4,
                    publicSchools: 4, privateSchools: 4, colleges: 5, landmarks: 2,
                    stadiums: 5, bridges: 9, ssa: 5, tif: 5, medicalDistrict: 4,
                    neighborhoodCenter: 5
                }
            },
            'equity': {
                name: 'Scenario 1: Equity and Community Impact',
                description: [
                    'Scenario 1: Equity and Community Impact - direct caps to places with the greatest need and highest reconnection opportunity.',
                    '• Area Deprivation Index: higher is better, high priority - focus on socioeconomically disadvantaged areas',
                    '• Crash Frequency: higher is better, high priority - most opportunity for safety improvement through rebuilding',
                    '• Proximity to Public Schools: high priority',
                    '• Proximity to Neighborhood Centers: medium priority - focus on reconnecting neighborhoods which are currently split in half by the highway',
                    '• Proximity to Parks: high priority - if there isn\'t necessarily room to build a park on the cap, how can we make parks more accessible'
                ],
                requirements: {},
                features: {
                    adi: 10, crashes: 10, publicSchools: 10, parks: 10, neighborhoodCenter: 5,
                    ctaStations: 0, metraStations: 0, amtrakStations: 0, transitDensity: 0,
                    bikeNetwork: 0, population: 0, householdSize: 0, income: 0, permits: 0,
                    hospitals: 0, privateSchools: 0, colleges: 0, landmarks: 0, stadiums: 0,
                    bridges: 0, ssa: 0, tif: 0, medicalDistrict: 0
                },
                directions: {
                    crashes: 'higher'
                }
            },
            'cap-ready': {
                name: 'Scenario 2: Cap-Ready/Implementation Feasibility',
                description: [
                    'Scenario 2: Cap-Ready/Implementation Feasibility - direct caps to where construction is most straightforward and financially-incentivized.',
                    '• Station-Proximity Gate: within a half mile of a CTA, Metra, or Amtrak station - allows for access to related financing',
                    '• Proximity to Existing Bridges: high priority - leverage existing infrastructure',
                    '• Closest Bridge Age: exclude segments where the nearest bridge is more than 75 years old',
                    '• Proximity to TIF Districts and SSAs: medium to high priority - potential for additional financial resources'
                ],
                requirements: {
                    stationProximity: { enabled: true, distance: 0.5 },
                    bridgeAge: { enabled: true, threshold: 75 }
                },
                features: {
                    bridges: 10, ssa: 8, tif: 8,
                    ctaStations: 0, metraStations: 0, amtrakStations: 0, parks: 0,
                    transitDensity: 0, bikeNetwork: 0, population: 0, householdSize: 0,
                    income: 0, adi: 0, crashes: 0, permits: 0, hospitals: 0,
                    publicSchools: 0, privateSchools: 0, colleges: 0, landmarks: 0,
                    stadiums: 0, medicalDistrict: 0, neighborhoodCenter: 0
                }
            },
            'transit': {
                name: 'Scenario 3: Transit-Oriented Development',
                description: [
                    'Scenario 3: Transit-Oriented Development - direct caps to where they can act as a transportation hub.',
                    '• Zoning allow-list: Business, Commercial, Downtown, and PD - transit plazas and TOD-compatible',
                    '• Proximity to CTA Rail Stations, Metra Stations, and Amtrak Train Stations: high priority',
                    '• Transit Stop Density (Bus): higher is better, high priority'
                ],
                requirements: {
                    zoning: {
                        enabled: true,
                        allowed: ['business', 'commercial', 'downtown', 'planned']
                    }
                },
                features: {
                    ctaStations: 10, metraStations: 10, amtrakStations: 10, transitDensity: 10,
                    parks: 0, bikeNetwork: 0, population: 0, householdSize: 0, income: 0,
                    adi: 0, crashes: 0, permits: 0, hospitals: 0, publicSchools: 0,
                    privateSchools: 0, colleges: 0, landmarks: 0, stadiums: 0, bridges: 0,
                    ssa: 0, tif: 0, medicalDistrict: 0, neighborhoodCenter: 0
                }
            },
            'safe-routes': {
                name: 'Scenario 4: Safe Routes',
                description: [
                    'Scenario 4: Safe Routes - direct caps to deliver open space and safe crossings near schools and hospitals.',
                    '• Proximity to Hospitals: high priority',
                    '• Proximity to Public and Private Schools: high priority',
                    '• Crash Frequency: higher is better, high priority - most opportunity for safety improvement through rebuilding'
                ],
                requirements: {},
                features: {
                    hospitals: 10, publicSchools: 10, privateSchools: 10, crashes: 10,
                    ctaStations: 0, metraStations: 0, amtrakStations: 0, parks: 0,
                    transitDensity: 0, bikeNetwork: 0, population: 0, householdSize: 0,
                    income: 0, adi: 0, permits: 0, colleges: 0, landmarks: 0, stadiums: 0,
                    bridges: 0, ssa: 0, tif: 0, medicalDistrict: 0, neighborhoodCenter: 0
                },
                directions: {
                    crashes: 'higher'
                }
            }
        };
    }

    async init() {
        try {
            console.log('🎨 Initializing UI controller...');

            // Load datasets catalog
            await this.loadDatasetCatalog();

            // Set up event listeners
            this.setupEventListeners();

            // Initialize UI state
            this.initializeUI();

            console.log('✅ UI controller initialized');

        } catch (error) {
            console.error('❌ UI controller initialization failed:', error);
            throw error;
        }
    }

    async loadDatasetCatalog() {
        try {
            const response = await fetch('data_ready/datasets_catalog.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const catalogArray = await response.json();

            // Convert array format to object format
            this.datasetCatalog = {};
            catalogArray.forEach(dataset => {
                if (dataset.key && !this.datasetCatalog[dataset.key]) { // Avoid duplicates
                    this.datasetCatalog[dataset.key] = {
                        friendly_name: dataset.friendly_name,
                        path: dataset.path,
                        geometry: dataset.geometry,
                        default_style: dataset.default_style
                    };
                }
            });

            console.log(`📊 Loaded ${Object.keys(this.datasetCatalog).length} datasets from catalog`);
        } catch (error) {
            console.error('❌ Failed to load datasets catalog:', error);
            // Create a minimal fallback catalog
            this.datasetCatalog = {
                'freeways': {
                    friendly_name: 'Freeway Centerlines',
                    path: 'freeways.geojson',
                    geometry: 'LineString'
                },
                'cta_rail_stations': {
                    friendly_name: 'CTA Rail Stations',
                    path: 'cta_rail_stations.geojson',
                    geometry: 'Point'
                },
                'parks': {
                    friendly_name: 'Parks',
                    path: 'parks.geojson',
                    geometry: 'Polygon'
                },
                'hospitals': {
                    friendly_name: 'Hospitals',
                    path: 'hospitals.geojson',
                    geometry: 'Point'
                },
                'block_groups_with_census': {
                    friendly_name: 'Census Block Groups (Population)',
                    path: 'block_groups_with_census.geojson',
                    geometry: 'Polygon'
                }
            };
        }
    }

    setupEventListeners() {
        // Tab switching
        document.getElementById('explore-tab').addEventListener('click', () => {
            this.switchToTab('explore');
        });

        document.getElementById('analyze-tab').addEventListener('click', () => {
            // Don't do anything if already showing results
            const currentView = this.stateManager.get('currentView');
            const hasResults = this.stateManager.get('analysisResults') !== null;

            if (currentView === 'results' && hasResults) {
                // Already showing results - do nothing
                console.log('Already showing results, ignoring analyze tab click');
                return;
            }

            this.switchToTab('analyze');
        });


        // Scenario selection buttons
        document.querySelectorAll('.scenario-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const scenarioId = e.target.dataset.scenario;
                this.applyScenario(scenarioId);
            });
        });

        // Preferences controls
        document.getElementById('segment-length').addEventListener('input', (e) => {
            this.stateManager.setSegmentLength(parseInt(e.target.value));
        });

        // Freeway selection in preferences
        document.getElementById('pref-i90').addEventListener('change', (e) => {
            this.stateManager.toggleFreewaySelection('I-90/94', e.target.checked);
        });

        document.getElementById('pref-i290').addEventListener('change', (e) => {
            this.stateManager.toggleFreewaySelection('I-290', e.target.checked);
        });

        document.getElementById('pref-i55').addEventListener('change', (e) => {
            this.stateManager.toggleFreewaySelection('I-55', e.target.checked);
        });

        document.getElementById('pref-i90-dan-ryan').addEventListener('change', (e) => {
            this.stateManager.toggleFreewaySelection('I-90/94-Dan-Ryan', e.target.checked);
        });

        document.getElementById('pref-i57').addEventListener('change', (e) => {
            this.stateManager.toggleFreewaySelection('I-57', e.target.checked);
        });

        // Station-Proximity Gate controls
        document.getElementById('station-gate-enabled').addEventListener('change', (e) => {
            this.stateManager.updateRequirement('stationProximity', { enabled: e.target.checked });
            this.toggleStationGateControls(e.target.checked);
        });

        document.getElementById('station-gate-distance').addEventListener('input', (e) => {
            this.stateManager.updateRequirement('stationProximity', { distance: parseFloat(e.target.value) });
        });

        // Neighborhood filter controls
        document.getElementById('neighborhood-filter').addEventListener('change', (e) => {
            const selected = Array.from(e.target.selectedOptions).map(option => option.value);
            this.stateManager.updateRequirement('neighborhoods', {
                enabled: selected.length > 0,
                selected: selected
            });
        });

        // Zoning allowlist controls
        const zoningCheckboxes = [
            'zoning-residential', 'zoning-business', 'zoning-commercial',
            'zoning-downtown', 'zoning-industrial', 'zoning-planned', 'zoning-other'
        ];

        zoningCheckboxes.forEach(checkboxId => {
            document.getElementById(checkboxId).addEventListener('change', () => {
                this.updateZoningAllowlist();
            });
        });

        // Funding alignment gate controls
        document.getElementById('require-ssa').addEventListener('change', (e) => {
            this.stateManager.updateRequirement('ssa', { enabled: e.target.checked });
        });

        document.getElementById('require-tif').addEventListener('change', (e) => {
            this.stateManager.updateRequirement('tif', { enabled: e.target.checked });
        });

        // Bridge condition gate controls
        document.getElementById('require-bridge-condition').addEventListener('change', (e) => {
            const enabled = e.target.checked;
            this.stateManager.updateRequirement('bridgeAge', { enabled });

            // Show/hide age threshold controls
            const ageControls = document.getElementById('bridge-age-controls');
            ageControls.style.display = enabled ? 'block' : 'none';
        });

        document.getElementById('bridge-age-threshold').addEventListener('change', (e) => {
            const threshold = parseInt(e.target.value);
            this.stateManager.updateRequirement('bridgeAge', { threshold });
        });

        // Feature weight controls
        this.setupFeatureWeightControls();

        // Analysis button
        document.getElementById('initiate-analysis').addEventListener('click', () => {
            this.initiateAnalysis();
        });

        // Update preferences button
        document.getElementById('update-preferences').addEventListener('click', () => {
            this.stateManager.resetToExplore();
            this.clearAnalysisResults();
            this.switchToTab('analyze');
            // Force preferences view since we just cleared results
            this.stateManager.setCurrentView('preferences');
        });

        // Right panel close
        document.getElementById('close-right-panel').addEventListener('click', () => {
            this.stateManager.toggleRightPanel(false);
            // Note: Don't destroy minimap here - it should persist for other segment selections
        });

        // State change listeners
        this.setupStateListeners();
    }

    setupFeatureWeightControls() {
        // CTA Stations weight
        const ctaSlider = document.getElementById('cta-weight');
        const ctaValue = document.getElementById('cta-weight-value');

        ctaSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            ctaValue.textContent = value;
            this.stateManager.updateFeature('ctaStations', { weight: value });
        });

        // Metra Stations weight
        const metraStationsSlider = document.getElementById('metra-stations-weight');
        const metraStationsValue = document.getElementById('metra-stations-weight-value');
        metraStationsSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            metraStationsValue.textContent = value;
            this.stateManager.updateFeature('metraStations', { weight: value });
        });

        // Amtrak Stations weight
        const amtrakStationsSlider = document.getElementById('amtrak-stations-weight');
        const amtrakStationsValue = document.getElementById('amtrak-stations-weight-value');
        amtrakStationsSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            amtrakStationsValue.textContent = value;
            this.stateManager.updateFeature('amtrakStations', { weight: value });
        });

        // Parks weight
        const parksSlider = document.getElementById('parks-weight');
        const parksValue = document.getElementById('parks-weight-value');

        parksSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            parksValue.textContent = value;
            this.stateManager.updateFeature('parks', { weight: value });
        });

        // Public Schools weight
        const publicSchoolsSlider = document.getElementById('public-schools-weight');
        const publicSchoolsValue = document.getElementById('public-schools-weight-value');
        publicSchoolsSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            publicSchoolsValue.textContent = value;
            this.stateManager.updateFeature('publicSchools', { weight: value });
        });

        // Private Schools weight
        const privateSchoolsSlider = document.getElementById('private-schools-weight');
        const privateSchoolsValue = document.getElementById('private-schools-weight-value');
        privateSchoolsSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            privateSchoolsValue.textContent = value;
            this.stateManager.updateFeature('privateSchools', { weight: value });
        });

        // Colleges weight
        const collegesSlider = document.getElementById('colleges-weight');
        const collegesValue = document.getElementById('colleges-weight-value');
        collegesSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            collegesValue.textContent = value;
            this.stateManager.updateFeature('colleges', { weight: value });
        });

        // Hospitals weight
        const hospitalsSlider = document.getElementById('hospitals-weight');
        const hospitalsValue = document.getElementById('hospitals-weight-value');
        hospitalsSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            hospitalsValue.textContent = value;
            this.stateManager.updateFeature('hospitals', { weight: value });
        });

        // Landmarks weight
        const landmarksSlider = document.getElementById('landmarks-weight');
        const landmarksValue = document.getElementById('landmarks-weight-value');
        landmarksSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            landmarksValue.textContent = value;
            this.stateManager.updateFeature('landmarks', { weight: value });
        });

        // Stadiums weight
        const stadiumsSlider = document.getElementById('stadiums-weight');
        const stadiumsValue = document.getElementById('stadiums-weight-value');
        stadiumsSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            stadiumsValue.textContent = value;
            this.stateManager.updateFeature('stadiums', { weight: value });
        });

        // SSA weight
        const ssaSlider = document.getElementById('ssa-weight');
        const ssaValue = document.getElementById('ssa-weight-value');
        ssaSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            ssaValue.textContent = value;
            this.stateManager.updateFeature('ssa', { weight: value });
        });

        // TIF weight
        const tifSlider = document.getElementById('tif-weight');
        const tifValue = document.getElementById('tif-weight-value');
        tifSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            tifValue.textContent = value;
            this.stateManager.updateFeature('tif', { weight: value });
        });

        // Medical District weight
        const medicalDistrictSlider = document.getElementById('medical-district-weight');
        const medicalDistrictValue = document.getElementById('medical-district-weight-value');
        medicalDistrictSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            medicalDistrictValue.textContent = value;
            this.stateManager.updateFeature('medicalDistrict', { weight: value });
        });

        // Neighborhood Center weight
        const neighborhoodCenterSlider = document.getElementById('neighborhood-center-weight');
        const neighborhoodCenterValue = document.getElementById('neighborhood-center-weight-value');
        neighborhoodCenterSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            neighborhoodCenterValue.textContent = value;
            this.stateManager.updateFeature('neighborhoodCenter', { weight: value });
        });

        // Bridges weight
        const bridgesSlider = document.getElementById('bridges-weight');
        const bridgesValue = document.getElementById('bridges-weight-value');
        bridgesSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            bridgesValue.textContent = value;
            this.stateManager.updateFeature('bridges', { weight: value });
        });

        // ADI weight
        const adiSlider = document.getElementById('adi-weight');
        const adiValue = document.getElementById('adi-weight-value');
        adiSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            adiValue.textContent = value;
            this.stateManager.updateFeature('adi', { weight: value });
        });

        // ADI direction toggle
        const adiHigher = document.getElementById('adi-higher');
        const adiLower = document.getElementById('adi-lower');
        adiHigher.addEventListener('change', (e) => {
            if (e.target.checked) {
                this.stateManager.updateFeature('adi', { direction: 'higher' });
            }
        });
        adiLower.addEventListener('change', (e) => {
            if (e.target.checked) {
                this.stateManager.updateFeature('adi', { direction: 'lower' });
            }
        });

        // Crashes weight
        const crashesSlider = document.getElementById('crashes-weight');
        const crashesValue = document.getElementById('crashes-weight-value');
        crashesSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            crashesValue.textContent = value;
            this.stateManager.updateFeature('crashes', { weight: value });
        });

        // Crashes direction toggle
        const crashesLower = document.getElementById('crashes-lower');
        const crashesHigher = document.getElementById('crashes-higher');
        crashesLower.addEventListener('change', (e) => {
            if (e.target.checked) {
                this.stateManager.updateFeature('crashes', { direction: 'lower' });
            }
        });
        crashesHigher.addEventListener('change', (e) => {
            if (e.target.checked) {
                this.stateManager.updateFeature('crashes', { direction: 'higher' });
            }
        });

        // Transit Stop Density weight
        const transitDensitySlider = document.getElementById('transit-density-weight');
        const transitDensityValue = document.getElementById('transit-density-weight-value');
        transitDensitySlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            transitDensityValue.textContent = value;
            this.stateManager.updateFeature('transitDensity', { weight: value });
        });

        // Transit Stop Density direction toggle
        const transitDensityHigher = document.getElementById('transit-density-higher');
        const transitDensityLower = document.getElementById('transit-density-lower');
        transitDensityHigher.addEventListener('change', (e) => {
            if (e.target.checked) {
                this.stateManager.updateFeature('transitDensity', { direction: 'higher' });
            }
        });
        transitDensityLower.addEventListener('change', (e) => {
            if (e.target.checked) {
                this.stateManager.updateFeature('transitDensity', { direction: 'lower' });
            }
        });

        // Bike Network Connectivity weight
        const bikeNetworkSlider = document.getElementById('bike-network-weight');
        const bikeNetworkValue = document.getElementById('bike-network-weight-value');
        bikeNetworkSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            bikeNetworkValue.textContent = value;
            this.stateManager.updateFeature('bikeNetwork', { weight: value });
        });

        // Bike Network Connectivity direction toggle
        const bikeNetworkHigher = document.getElementById('bike-network-higher');
        const bikeNetworkLower = document.getElementById('bike-network-lower');
        bikeNetworkHigher.addEventListener('change', (e) => {
            if (e.target.checked) {
                this.stateManager.updateFeature('bikeNetwork', { direction: 'higher' });
            }
        });
        bikeNetworkLower.addEventListener('change', (e) => {
            if (e.target.checked) {
                this.stateManager.updateFeature('bikeNetwork', { direction: 'lower' });
            }
        });

    }

    applyScenario(scenarioId) {
        console.log(`Applying scenario: ${scenarioId}`);
        const scenario = this.scenarios[scenarioId];

        if (!scenario) {
            console.error(`Unknown scenario: ${scenarioId}`);
            return;
        }

        // Update state
        this.stateManager.set('defaultScenario', scenarioId);

        // Update info box
        const infoBox = document.getElementById('scenario-info-box');
        if (Array.isArray(scenario.description)) {
            // Join array elements with line breaks
            infoBox.innerHTML = scenario.description.map(line => {
                return `<div class="mb-1">${line}</div>`;
            }).join('');
        } else {
            infoBox.textContent = scenario.description;
        }

        // Update button active states
        document.querySelectorAll('.scenario-btn').forEach(btn => {
            if (btn.dataset.scenario === scenarioId) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Apply requirements
        // Reset all requirements first (for best-overall and scenarios without specific requirements)
        this.stateManager.updateRequirement('stationProximity', { enabled: false, distance: 0.5 });
        this.stateManager.updateRequirement('bridgeAge', { enabled: false, threshold: 80 });
        this.stateManager.updateRequirement('neighborhoods', { enabled: false, selected: [] });
        this.stateManager.updateRequirement('zoning', { enabled: false, allowed: [] });
        this.stateManager.updateRequirement('ssa', { enabled: false });
        this.stateManager.updateRequirement('tif', { enabled: false });

        // Apply scenario-specific requirements
        if (scenario.requirements.stationProximity) {
            this.stateManager.updateRequirement('stationProximity', scenario.requirements.stationProximity);
            document.getElementById('station-gate-enabled').checked = true;
            document.getElementById('station-gate-distance').value = scenario.requirements.stationProximity.distance;
            this.toggleStationGateControls(true);
        } else {
            document.getElementById('station-gate-enabled').checked = false;
            this.toggleStationGateControls(false);
        }

        if (scenario.requirements.bridgeAge) {
            this.stateManager.updateRequirement('bridgeAge', scenario.requirements.bridgeAge);
            document.getElementById('require-bridge-condition').checked = true;
            document.getElementById('bridge-age-threshold').value = scenario.requirements.bridgeAge.threshold;
            document.getElementById('bridge-age-controls').style.display = 'block';
        } else {
            document.getElementById('require-bridge-condition').checked = false;
            document.getElementById('bridge-age-controls').style.display = 'none';
        }

        if (scenario.requirements.zoning) {
            this.stateManager.updateRequirement('zoning', scenario.requirements.zoning);
            // Update zoning checkboxes
            const allowedZones = scenario.requirements.zoning.allowed || [];
            document.getElementById('zoning-residential').checked = allowedZones.includes('residential');
            document.getElementById('zoning-business').checked = allowedZones.includes('business');
            document.getElementById('zoning-commercial').checked = allowedZones.includes('commercial');
            document.getElementById('zoning-downtown').checked = allowedZones.includes('downtown');
            document.getElementById('zoning-industrial').checked = allowedZones.includes('industrial');
            document.getElementById('zoning-planned').checked = allowedZones.includes('planned');
            document.getElementById('zoning-other').checked = allowedZones.includes('other');
            this.updateZoningAllowlist();
        } else {
            // Reset to all checked
            document.getElementById('zoning-residential').checked = true;
            document.getElementById('zoning-business').checked = true;
            document.getElementById('zoning-commercial').checked = true;
            document.getElementById('zoning-downtown').checked = true;
            document.getElementById('zoning-industrial').checked = true;
            document.getElementById('zoning-planned').checked = true;
            document.getElementById('zoning-other').checked = true;
            this.updateZoningAllowlist();
        }

        // Apply feature weights
        Object.entries(scenario.features).forEach(([featureKey, weight]) => {
            this.stateManager.updateFeature(featureKey, { weight });

            // Update UI sliders and values
            const sliderIdMap = {
                ctaStations: 'cta-weight',
                metraStations: 'metra-stations-weight',
                amtrakStations: 'amtrak-stations-weight',
                parks: 'parks-weight',
                publicSchools: 'public-schools-weight',
                privateSchools: 'private-schools-weight',
                colleges: 'colleges-weight',
                hospitals: 'hospitals-weight',
                landmarks: 'landmarks-weight',
                stadiums: 'stadiums-weight',
                bridges: 'bridges-weight',
                ssa: 'ssa-weight',
                tif: 'tif-weight',
                medicalDistrict: 'medical-district-weight',
                neighborhoodCenter: 'neighborhood-center-weight',
                adi: 'adi-weight',
                crashes: 'crashes-weight',
                transitDensity: 'transit-density-weight',
                bikeNetwork: 'bike-network-weight'
            };

            const sliderId = sliderIdMap[featureKey];
            if (sliderId) {
                const slider = document.getElementById(sliderId);
                const valueSpan = document.getElementById(sliderId + '-value');
                if (slider && valueSpan) {
                    slider.value = weight;
                    valueSpan.textContent = weight;
                }
            }
        });

        // Apply direction settings (for features with directional toggles)
        if (scenario.directions) {
            Object.entries(scenario.directions).forEach(([featureKey, direction]) => {
                this.stateManager.updateFeature(featureKey, { direction });

                // Update UI radio buttons
                const directionIdMap = {
                    crashes: { higher: 'crashes-higher', lower: 'crashes-lower' },
                    adi: { higher: 'adi-higher', lower: 'adi-lower' },
                    transitDensity: { higher: 'transit-density-higher', lower: 'transit-density-lower' }
                };

                const radioIds = directionIdMap[featureKey];
                if (radioIds) {
                    const higherRadio = document.getElementById(radioIds.higher);
                    const lowerRadio = document.getElementById(radioIds.lower);

                    if (higherRadio && lowerRadio) {
                        if (direction === 'higher') {
                            higherRadio.checked = true;
                        } else {
                            lowerRadio.checked = true;
                        }
                    }
                }
            });
        }

        console.log(`✅ Applied scenario: ${scenario.name}`);
    }

    setupStateListeners() {
        // Current view changes
        this.stateManager.subscribe('currentView', (view) => {
            this.updateViewDisplay(view);
        });


        // Dataset visibility changes
        this.stateManager.subscribe('visibleDatasets', (datasets) => {
            this.updateDatasetCheckboxes(datasets);
        });

        // Analysis progress
        this.stateManager.subscribe('analysisProgress', (progress) => {
            this.updateAnalysisProgress(progress);
        });

        // Right panel visibility
        this.stateManager.subscribe('showRightPanel', (show) => {
            this.updateRightPanelVisibility(show);
        });

        // Selected segment
        this.stateManager.subscribe('selectedSegment', (segmentId) => {
            this.updateSelectedSegment(segmentId);
        });
    }

    initializeUI() {
        // Populate dataset list
        this.populateDatasetList();

        // Populate neighborhood dropdown
        this.populateNeighborhoodList();

        // Set initial tab
        this.switchToTab('explore');

        // Initialize weight displays
        document.getElementById('cta-weight-value').textContent =
            this.stateManager.get('features.ctaStations.weight');
        document.getElementById('metra-stations-weight-value').textContent =
            this.stateManager.get('features.metraStations.weight');
        document.getElementById('amtrak-stations-weight-value').textContent =
            this.stateManager.get('features.amtrakStations.weight');
        document.getElementById('parks-weight-value').textContent =
            this.stateManager.get('features.parks.weight');
        document.getElementById('public-schools-weight-value').textContent =
            this.stateManager.get('features.publicSchools.weight');
        document.getElementById('private-schools-weight-value').textContent =
            this.stateManager.get('features.privateSchools.weight');
        document.getElementById('colleges-weight-value').textContent =
            this.stateManager.get('features.colleges.weight');
        document.getElementById('hospitals-weight-value').textContent =
            this.stateManager.get('features.hospitals.weight');
        document.getElementById('landmarks-weight-value').textContent =
            this.stateManager.get('features.landmarks.weight');
        document.getElementById('stadiums-weight-value').textContent =
            this.stateManager.get('features.stadiums.weight');
        document.getElementById('ssa-weight-value').textContent =
            this.stateManager.get('features.ssa.weight');
        document.getElementById('tif-weight-value').textContent =
            this.stateManager.get('features.tif.weight');
        document.getElementById('medical-district-weight-value').textContent =
            this.stateManager.get('features.medicalDistrict.weight');
        document.getElementById('neighborhood-center-weight-value').textContent =
            this.stateManager.get('features.neighborhoodCenter.weight');
        document.getElementById('bridges-weight-value').textContent =
            this.stateManager.get('features.bridges.weight');
        document.getElementById('adi-weight-value').textContent =
            this.stateManager.get('features.adi.weight');
        document.getElementById('crashes-weight-value').textContent =
            this.stateManager.get('features.crashes.weight');
        document.getElementById('transit-density-weight-value').textContent =
            this.stateManager.get('features.transitDensity.weight');
        document.getElementById('bike-network-weight-value').textContent =
            this.stateManager.get('features.bikeNetwork.weight');

        // Initialize direction toggles
        const adiDirection = this.stateManager.get('features.adi.direction');
        document.getElementById('adi-higher').checked = (adiDirection === 'higher');
        document.getElementById('adi-lower').checked = (adiDirection === 'lower');

        const crashesDirection = this.stateManager.get('features.crashes.direction');
        document.getElementById('crashes-lower').checked = (crashesDirection === 'lower');
        document.getElementById('crashes-higher').checked = (crashesDirection === 'higher');

        const transitDensityDirection = this.stateManager.get('features.transitDensity.direction');
        document.getElementById('transit-density-higher').checked = (transitDensityDirection === 'higher');
        document.getElementById('transit-density-lower').checked = (transitDensityDirection === 'lower');

        const bikeNetworkDirection = this.stateManager.get('features.bikeNetwork.direction');
        document.getElementById('bike-network-higher').checked = (bikeNetworkDirection === 'higher');
        document.getElementById('bike-network-lower').checked = (bikeNetworkDirection === 'lower');
    }

    getDatasetColor(key) {
        // Returns dataset-specific colors matching the Segment Details panel
        // This ensures color consistency between Explore and Results views
        const colorMap = {
            // Transit (matching Results panel colors)
            'cta_rail_stations': '#1f77b4',      // Blue - CTA Rail Stations
            'metra_stations': '#ff6b6b',         // Red-orange - Metra Stations
            'amtrak_stations': '#4ecdc4',        // Teal - Amtrak Stations
            'cta_bus_stops': '#3498db',          // Blue - Transit Stop Density
            'pace_bus_stops': '#3498db',         // Blue - Transit Stop Density

            // Education (matching Results panel colors)
            'public_schools': '#ff7f0e',         // Orange - Public Schools
            'private_schools': '#d62728',        // Red - Private Schools
            'colleges_universities': '#9467bd',  // Purple - Colleges

            // Healthcare (matching Results panel colors)
            'hospitals': '#8c564b',              // Brown - Hospitals
            'medical_district': '#8c564b',       // Brown - same as Hospitals per instructions

            // Infrastructure (matching Results panel colors)
            'bridges': '#95a5a6',                // Gray - Bridges

            // Recreation (matching Results panel colors)
            'parks': '#2ca02c',                  // Green - Parks (already both green)

            // Points of Interest (matching Results panel colors)
            'landmarks': '#e377c2',              // Pink - Landmarks
            'stadiums': '#7f7f7f',               // Gray - Stadiums

            // Planning (matching Results panel colors)
            'neighborhoods': '#c5b0d5',          // Light purple - Neighborhood Center
            'special_service_areas': '#bcbd22',  // Yellow-green - SSA
            'tif_districts': '#17becf',          // Cyan - TIF

            // Foundation
            'chicago_boundary': '#007bff',       // Blue for city boundaries
            'freeways': '#28a745'                // Green for freeway centerlines
        };

        return colorMap[key] || null;
    }

    populateDatasetList() {
        const listContainer = document.getElementById('dataset-list');
        listContainer.innerHTML = '';

        // Group datasets by category and render them
        const categorizedDatasets = this.categorizeDatasets();

        // Define category display order and colors (matching reference LayerManager)
        const categoryConfig = {
            'foundation': { label: 'Foundation', color: '#6f42c1' },
            'transit': { label: 'Transit', color: '#007bff' },
            'transportation': { label: 'Transportation', color: '#28a745' },
            'infrastructure': { label: 'Infrastructure', color: '#ffc107' },
            'healthcare': { label: 'Healthcare', color: '#dc3545' },
            'education': { label: 'Education', color: '#17a2b8' },
            'recreation': { label: 'Recreation', color: '#28a745' },
            'points_of_interest': { label: 'Points of Interest', color: '#fd7e14' },
            'planning': { label: 'Planning', color: '#6610f2' },
            'block_groups': { label: 'Block Groups', color: '#e83e8c' },
            'development': { label: 'Development', color: '#6c757d' }
        };

        // Define category display order (Foundation first, then alphabetical)
        const categoryOrder = [
            'foundation',
            'block_groups',
            'education',
            'healthcare',
            'infrastructure',
            'planning',
            'points_of_interest',
            'recreation',
            'transit',
            'transportation',
            'development'
        ];

        // Render each category in the specified order
        categoryOrder.forEach(categoryId => {
            if (categorizedDatasets[categoryId]) {
                const datasets = categorizedDatasets[categoryId];
                const config = categoryConfig[categoryId] || { label: 'Other', color: '#868e96' };
                this.renderDatasetCategory(listContainer, categoryId, config, datasets);
            }
        });
    }

    categorizeDatasets() {
        const categories = {
            'foundation': [],
            'transit': [],
            'transportation': [],
            'infrastructure': [],
            'healthcare': [],
            'education': [],
            'recreation': [],
            'points_of_interest': [],
            'planning': [],
            'block_groups': []
        };

        Object.entries(this.datasetCatalog).forEach(([key, dataset]) => {
            // Skip block_groups_with_census as we'll add virtual entries manually
            if (key === 'block_groups_with_census') {
                return;
            }

            // Categorize datasets based on their key/name
            if (key.includes('cta_') || key.includes('metra') || key.includes('amtrak') || key.includes('bus')) {
                categories.transit.push({ key, dataset });
            } else if (key.includes('bike') || key.includes('sidewalk')) {
                categories.transportation.push({ key, dataset });
            } else if (key.includes('freeway')) {
                // Moved Freeway Centerlines to Foundation category
                categories.foundation.push({ key, dataset });
            } else if (key.includes('hospital') || key.includes('medical_district')) {
                // Moved Illinois Medical District to Healthcare category (same color as Hospitals)
                categories.healthcare.push({ key, dataset });
            } else if (key.includes('school') || key.includes('college') || key.includes('universities')) {
                categories.education.push({ key, dataset });
            } else if (key.includes('park')) {
                categories.recreation.push({ key, dataset });
            } else if (key.includes('landmarks') || key.includes('stadium')) {
                categories.points_of_interest.push({ key, dataset });
            } else if (key.includes('zoning') || key.includes('special_service') || key.includes('tif') || key.includes('neighborhoods')) {
                categories.planning.push({ key, dataset });
            } else if (key.includes('bridge')) {
                categories.infrastructure.push({ key, dataset });
            } else {
                categories.foundation.push({ key, dataset });
            }
        });

        // Add virtual block group datasets
        if (this.datasetCatalog['block_groups_with_census']) {
            categories.block_groups.push({
                key: 'block_groups_adi',
                dataset: {
                    friendly_name: 'Area Deprivation Index (Socioeconomic Indicator)',
                    path: 'block_groups_with_census.geojson',
                    geometry: 'Polygon'
                }
            });
            categories.block_groups.push({
                key: 'block_groups_crashes',
                dataset: {
                    friendly_name: 'Crash Frequency',
                    path: 'block_groups_with_census.geojson',
                    geometry: 'Polygon'
                }
            });
        }

        // Remove empty categories
        Object.keys(categories).forEach(categoryId => {
            if (categories[categoryId].length === 0) {
                delete categories[categoryId];
            }
        });

        return categories;
    }

    renderDatasetCategory(container, categoryId, config, datasets) {
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'dataset-category mb-4';

        // Category header
        const header = document.createElement('h4');
        header.textContent = config.label;
        header.className = 'text-sm font-semibold text-gray-700 mb-2 pl-2';
        header.style.borderLeftColor = config.color;
        header.style.borderLeftWidth = '3px';
        header.style.borderLeftStyle = 'solid';
        header.style.paddingLeft = '0.5rem';
        categoryDiv.appendChild(header);

        // Dataset items
        const itemsContainer = document.createElement('div');
        itemsContainer.className = 'space-y-1 ml-2';

        datasets.forEach(({ key, dataset }) => {
            // Use dataset-specific color if available, otherwise fall back to category color
            const datasetColor = this.getDatasetColor(key) || config.color;
            const datasetItem = this.createDatasetItem(key, dataset, datasetColor);
            itemsContainer.appendChild(datasetItem);
        });

        categoryDiv.appendChild(itemsContainer);
        container.appendChild(categoryDiv);
    }

    createDatasetItem(key, dataset, categoryColor) {
        const container = document.createElement('div');

        const item = document.createElement('div');
        item.className = 'dataset-item flex items-center space-x-2 p-2 rounded hover:bg-gray-50';
        item.dataset.key = key;
        item.dataset.categoryColor = categoryColor;

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `dataset-${key}`;
        checkbox.className = 'mr-2';
        checkbox.addEventListener('change', (e) => {
            this.toggleDataset(key, e.target.checked);
            // Show/hide zoning legend if this is zoning districts
            if (key === 'zoning_districts') {
                this.toggleZoningLegend(e.target.checked);
            }
        });

        const label = document.createElement('label');
        label.htmlFor = `dataset-${key}`;
        label.textContent = dataset.friendly_name;
        label.className = 'flex-1 text-sm text-gray-700 cursor-pointer';

        // Add a colored indicator dot
        const colorDot = document.createElement('div');
        colorDot.className = 'w-3 h-3 rounded-full ml-auto';
        colorDot.style.backgroundColor = categoryColor;

        item.appendChild(checkbox);
        item.appendChild(label);
        item.appendChild(colorDot);

        container.appendChild(item);

        // Add zoning legend for zoning districts
        if (key === 'zoning_districts') {
            const legend = this.createZoningLegend();
            container.appendChild(legend);
        }

        return container;
    }

    createZoningLegend() {
        const legend = document.createElement('div');
        legend.id = 'zoning-legend';
        legend.className = 'ml-8 mt-2 mb-2 text-xs hidden';
        legend.style.maxHeight = '0';
        legend.style.overflow = 'hidden';
        legend.style.transition = 'max-height 0.3s ease-out';

        const title = document.createElement('div');
        title.className = 'font-semibold text-gray-600 mb-1';
        title.textContent = 'Zone Types:';
        legend.appendChild(title);

        const zones = [
            { label: 'Residential (RS, RT, RM)', color: '#FFFF00' },
            { label: 'Business (B1, B2, B3)', color: '#FF0000' },
            { label: 'Commercial (C1, C2, C3)', color: '#FF0000' },
            { label: 'Downtown (DC, DR, DS, DX)', color: '#FF0000' },
            { label: 'Industrial (M1, M2, M3)', color: '#A020F0' },
            { label: 'Planned Dev. (PD)', color: '#F5F5DC' },
            { label: 'Planned Manuf. (PMD)', color: '#A020F0' },
            { label: 'Parks (POS)', color: '#90EE90' },
            { label: 'Transportation (T)', color: '#BEBEBE' }
        ];

        zones.forEach(zone => {
            const item = document.createElement('div');
            item.className = 'flex items-center space-x-2 py-1';

            const colorBox = document.createElement('div');
            colorBox.className = 'w-4 h-4 rounded border border-gray-400';
            colorBox.style.backgroundColor = zone.color;

            const text = document.createElement('span');
            text.className = 'text-gray-600';
            text.textContent = zone.label;

            item.appendChild(colorBox);
            item.appendChild(text);
            legend.appendChild(item);
        });

        return legend;
    }

    toggleZoningLegend(visible) {
        const legend = document.getElementById('zoning-legend');
        if (legend) {
            if (visible) {
                legend.classList.remove('hidden');
                // Use setTimeout to allow the display change to take effect before animating
                setTimeout(() => {
                    legend.style.maxHeight = legend.scrollHeight + 'px';
                }, 10);
            } else {
                legend.style.maxHeight = '0';
                setTimeout(() => {
                    legend.classList.add('hidden');
                }, 300);
            }
        }
    }

    async toggleDataset(key, visible) {
        const item = document.querySelector(`.dataset-item[data-key="${key}"]`);

        if (visible) {
            // Handle mutual exclusivity for block group visualizations
            if (key === 'block_groups_adi') {
                const crashesCheckbox = document.getElementById('dataset-block_groups_crashes');
                if (crashesCheckbox && crashesCheckbox.checked) {
                    crashesCheckbox.checked = false;
                    await this.toggleDataset('block_groups_crashes', false);
                }
            } else if (key === 'block_groups_crashes') {
                const adiCheckbox = document.getElementById('dataset-block_groups_adi');
                if (adiCheckbox && adiCheckbox.checked) {
                    adiCheckbox.checked = false;
                    await this.toggleDataset('block_groups_adi', false);
                }
            }

            // Show loading state
            item.classList.add('loading');
            this.loadingStates.set(key, true);

            try {
                // Load the dataset if not already loaded
                if (!this.stateManager.get('loadedDatasets').has(key)) {
                    // Handle virtual block group datasets
                    let dataset, dataPath;
                    if (key === 'block_groups_adi' || key === 'block_groups_crashes') {
                        dataset = {
                            friendly_name: key === 'block_groups_adi'
                                ? 'Area Deprivation Index (Socioeconomic Indicator)'
                                : 'Crash Frequency',
                            path: 'block_groups_with_census.geojson',
                            geometry: 'Polygon'
                        };
                        dataPath = 'block_groups_with_census.geojson';
                    } else {
                        dataset = this.datasetCatalog[key];
                        dataPath = dataset.path;
                    }

                    const data = await this.loadGeoJSONData(dataPath);

                    // Get category color for this dataset
                    const categoryColor = item.dataset.categoryColor;

                    // Add to map
                    const layerConfig = {
                        id: key,
                        data: data,
                        geometryType: this.determineGeometryType(data),
                        style: this.getDefaultStyle(dataset.geometry, dataset.default_style, categoryColor),
                        visualizationType: key === 'block_groups_adi' ? 'adi' :
                                         key === 'block_groups_crashes' ? 'crashes' : null
                    };

                    await this.mapComponent.addDataLayer(layerConfig);
                    this.stateManager.markDatasetLoaded(key);
                } else {
                    // Just toggle visibility
                    this.mapComponent.toggleLayerVisibility(key, true);
                }

                this.stateManager.toggleDataset(key, true);
                item.classList.remove('loading');
                item.classList.add('active');

            } catch (error) {
                console.error(`Failed to load dataset ${key}:`, error);
                item.classList.remove('loading');
                item.classList.add('error');

                // Uncheck the checkbox
                const checkbox = item.querySelector('input[type="checkbox"]');
                checkbox.checked = false;
            }

            this.loadingStates.set(key, false);

        } else {
            // Hide layer
            this.mapComponent.toggleLayerVisibility(key, false);
            this.stateManager.toggleDataset(key, false);
            item.classList.remove('active');
        }
    }

    async loadGeoJSONData(path) {
        const response = await fetch(`data_ready/${path}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    }

    determineGeometryType(geojsonData) {
        if (!geojsonData.features || geojsonData.features.length === 0) {
            return 'unknown';
        }

        const firstGeometry = geojsonData.features[0].geometry;
        return firstGeometry ? firstGeometry.type : 'unknown';
    }

    getDefaultStyle(geometryType, defaultStyleFromCatalog = null, categoryColor = null) {
        // Use category color if available, otherwise use default colors
        const color = categoryColor || '#007bff';

        // Use catalog style if available but override with category color and bigger sizes
        if (defaultStyleFromCatalog && defaultStyleFromCatalog.paint) {
            return this.convertCatalogStyleToMapStyle(defaultStyleFromCatalog, geometryType, color);
        }

        // Fallback to default styles with enhanced sizing
        switch (geometryType) {
            case 'Point':
            case 'MultiPoint':
                return {
                    fillColor: color,
                    strokeColor: '#ffffff',
                    radius: 8, // Bigger dots (was 5)
                    fillOpacity: 0.9,
                    strokeWidth: 2
                };
            case 'LineString':
            case 'MultiLineString':
                return {
                    color: color,
                    weight: 4, // Thicker lines (was 2)
                    opacity: 0.9
                };
            case 'Polygon':
            case 'MultiPolygon':
                return {
                    fillColor: color,
                    strokeColor: color,
                    fillOpacity: 0.4,
                    strokeWidth: 2,
                    strokeOpacity: 1
                };
            default:
                return {
                    color: color,
                    weight: 4,
                    fillOpacity: 0.6,
                    opacity: 0.9
                };
        }
    }

    convertCatalogStyleToMapStyle(catalogStyle, geometryType, categoryColor = null) {
        const paint = catalogStyle.paint || {};
        const color = categoryColor || '#007bff';

        switch (geometryType) {
            case 'Point':
            case 'MultiPoint':
                return {
                    fillColor: color,
                    strokeColor: paint['circle-stroke-color'] || '#ffffff',
                    radius: Math.max((paint['circle-radius'] || 5) * 1.5, 8), // Make bigger
                    fillOpacity: paint['circle-opacity'] || 0.9,
                    strokeWidth: paint['circle-stroke-width'] || 2
                };
            case 'LineString':
            case 'MultiLineString':
                return {
                    color: color,
                    weight: Math.max((paint['line-width'] || 2) * 1.5, 4), // Make thicker
                    opacity: paint['line-opacity'] || 0.9
                };
            case 'Polygon':
            case 'MultiPolygon':
                return {
                    fillColor: color,
                    strokeColor: color,
                    fillOpacity: paint['fill-opacity'] || 0.4,
                    strokeWidth: 2,
                    strokeOpacity: 1
                };
            default:
                return this.getDefaultStyle(geometryType, null, color);
        }
    }

    switchToTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('[data-tab]').forEach(tab => {
            if (tab.dataset.tab === tabName) {
                tab.className = tab.className.replace('tab-inactive', 'tab-active');
                tab.classList.add('text-blue-600', 'bg-blue-50', 'border-b-2', 'border-blue-600');
                tab.classList.remove('text-gray-600', 'bg-gray-50');
            } else {
                tab.className = tab.className.replace('tab-active', 'tab-inactive');
                tab.classList.remove('text-blue-600', 'bg-blue-50', 'border-b-2', 'border-blue-600');
                tab.classList.add('text-gray-600', 'bg-gray-50');
            }
        });

        // Update content visibility
        document.getElementById('explore-content').classList.toggle('hidden', tabName !== 'explore');
        document.getElementById('analyze-content').classList.toggle('hidden', tabName !== 'analyze');

        // Determine the appropriate view state
        let viewState;
        if (tabName === 'explore') {
            viewState = 'explore';
        } else if (tabName === 'analyze') {
            // Check if analysis results exist - if so, show results, otherwise show preferences
            const hasAnalysisResults = this.stateManager.get('analysisResults') !== null;
            viewState = hasAnalysisResults ? 'results' : 'preferences';
        }

        // Update state
        this.stateManager.setCurrentView(viewState);

        // Expand/collapse sidebar - only expand for preferences view, not results
        const sidebar = document.getElementById('sidebar');
        if (tabName === 'analyze' && viewState === 'preferences') {
            sidebar.classList.add('expanded');
        } else {
            sidebar.classList.remove('expanded');
        }
    }

    updateViewDisplay(view) {
        const sidebar = document.getElementById('sidebar');

        // Hide all view content
        document.getElementById('explore-content').classList.add('hidden');
        document.getElementById('analyze-content').classList.add('hidden');
        document.getElementById('analysis-progress').classList.add('hidden');
        document.getElementById('results-content').classList.add('hidden');

        // Reset sidebar state
        sidebar.classList.remove('expanded');

        // Show appropriate content and adjust layout
        switch (view) {
            case 'explore':
                document.getElementById('explore-content').classList.remove('hidden');
                this.showExploreLayers();
                break;
            case 'preferences':
                document.getElementById('analyze-content').classList.remove('hidden');
                // Expand sidebar for preferences
                sidebar.classList.add('expanded');
                this.showExploreLayers();
                break;
            case 'analysis':
                document.getElementById('analysis-progress').classList.remove('hidden');
                // Keep sidebar normal width during analysis to show map
                // Hide all explore data layers during analysis
                this.hideExploreLayers();
                break;
            case 'results':
                document.getElementById('results-content').classList.remove('hidden');
                // Keep explore layers hidden during results
                this.hideExploreLayers();
                break;
        }
    }


    updateDatasetCheckboxes(visibleDatasets) {
        document.querySelectorAll('.dataset-item').forEach(item => {
            const key = item.dataset.key;
            const checkbox = item.querySelector('input[type="checkbox"]');
            const isVisible = visibleDatasets.has(key);

            checkbox.checked = isVisible;
            item.classList.toggle('active', isVisible);
        });
    }

    async initiateAnalysis() {
        if (!this.stateManager.isValidForAnalysis()) {
            alert('Please ensure at least one freeway is selected and segment length is between 100-1500 feet.');
            return;
        }

        // Switch to analysis view
        this.stateManager.setCurrentView('analysis');
        this.stateManager.startAnalysis();

        console.log('🔄 Starting analysis...');
        console.log('Configuration:', this.stateManager.getAnalysisConfiguration());

        // Start actual analysis with web worker
        await this.runAnalysisWithWorker();
    }

    async runAnalysisWithWorker() {
        try {
            // Create web worker
            const worker = new Worker('js/analysis-worker.js');

            // Set up worker message handlers
            worker.onmessage = (e) => {
                const { type, data } = e.data;

                switch (type) {
                    case 'progress':
                        this.stateManager.updateAnalysisProgress(data.percentage, data.currentSegment);
                        this.updateCurrentAnalysisInfo(data.message);

                        // Animate current segment if provided
                        if (data.currentSegment && data.segmentCenter && data.randomFeatures) {
                            this.animateSegmentAnalysis(data.segmentCenter, data.randomFeatures);
                            // Fly to current segment being analyzed
                            this.flyToSegment({ center: data.segmentCenter });
                        }
                        break;

                    case 'complete':
                        this.stateManager.completeAnalysis(data);
                        this.populateResults(data);
                        worker.terminate();
                        break;

                    case 'error':
                        console.error('Analysis worker error:', data);
                        alert(`Analysis failed: ${data.message}`);
                        this.stateManager.resetAnalysisState();
                        worker.terminate();
                        break;
                }
            };

            worker.onerror = (error) => {
                console.error('Worker error:', error);
                alert('Analysis worker failed to start');
                this.stateManager.resetAnalysisState();
                worker.terminate();
            };

            // Gather required datasets
            const datasets = await this.gatherDatasetsForAnalysis();

            // Start analysis
            worker.postMessage({
                type: 'start',
                data: {
                    config: this.stateManager.getAnalysisConfiguration(),
                    datasets: datasets
                }
            });

        } catch (error) {
            console.error('Failed to start analysis:', error);
            alert(`Failed to start analysis: ${error.message}`);
            this.stateManager.resetAnalysisState();
        }
    }

    async gatherDatasetsForAnalysis() {
        const datasets = {};

        // Required datasets for analysis
        const requiredDatasets = [
            'freeways',
            'cta_rail_stations',
            'metra_stations',
            'amtrak_stations',
            'parks',
            'public_schools',
            'private_schools',
            'colleges_universities',
            'hospitals',
            'landmarks',
            'stadiums',
            'special_service_areas',
            'tif_districts',
            'medical_district',
            'neighborhoods',
            'zoning_districts',
            'bridges',
            'block_groups_with_census',
            'cta_bus_stops',
            'pace_bus_stops',
            'bike_routes'
        ];

        for (const datasetKey of requiredDatasets) {
            if (this.datasetCatalog[datasetKey]) {
                try {
                    const data = await this.loadGeoJSONData(this.datasetCatalog[datasetKey].path);
                    datasets[datasetKey] = data;
                } catch (error) {
                    console.warn(`Failed to load dataset ${datasetKey}:`, error);
                }
            }
        }

        return datasets;
    }

    updateCurrentAnalysisInfo(message) {
        const currentAnalysisDiv = document.getElementById('current-analysis');
        if (currentAnalysisDiv) {
            currentAnalysisDiv.textContent = message;
        }
    }

    animateSegmentAnalysis(segmentCenter, randomFeatures = []) {
        // Fast animated lines shooting out to random features
        if (!this.mapComponent || !segmentCenter || randomFeatures.length === 0) return;

        try {
            const map = this.mapComponent.getMap();

            // Track animation layers for cleanup
            if (!this.animationLayers) {
                this.animationLayers = [];
            }

            // Color palette - various shades of blue and green
            const colors = [
                '#3b82f6', // bright blue
                '#2563eb', // darker blue
                '#06b6d4', // cyan
                '#10b981', // emerald green
                '#14b8a6', // teal
                '#22c55e'  // bright green
            ];

            // Create fast animated lines to random features
            randomFeatures.forEach((featureCoord, index) => {
                const lineId = `analysis-line-${Date.now()}-${Math.random()}`;
                this.animationLayers.push(lineId);

                // Pick a random color
                const color = colors[Math.floor(Math.random() * colors.length)];

                // Animate line growth using CSS/Mapbox transitions
                // Start with zero-length line (just the starting point)
                const startData = {
                    type: 'FeatureCollection',
                    features: [{
                        type: 'Feature',
                        geometry: {
                            type: 'LineString',
                            coordinates: [segmentCenter, segmentCenter] // Zero length
                        },
                        properties: {}
                    }]
                };

                // Full-length line
                const endData = {
                    type: 'FeatureCollection',
                    features: [{
                        type: 'Feature',
                        geometry: {
                            type: 'LineString',
                            coordinates: [segmentCenter, featureCoord]
                        },
                        properties: {}
                    }]
                };

                // Add source starting with zero-length line
                map.addSource(lineId, {
                    type: 'geojson',
                    data: startData
                });

                // Add line layer with random blue/green color
                map.addLayer({
                    id: lineId,
                    type: 'line',
                    source: lineId,
                    paint: {
                        'line-color': color,
                        'line-width': 2,
                        'line-opacity': 0.8
                    },
                    layout: {
                        'line-cap': 'round',
                        'line-join': 'round'
                    }
                });

                // Immediately start growing the line (fast!)
                setTimeout(() => {
                    if (map.getSource(lineId)) {
                        map.getSource(lineId).setData(endData);
                    }
                }, 10);

                // Remove immediately after reaching the target (300ms total animation time)
                setTimeout(() => {
                    try {
                        if (map.getLayer(lineId)) {
                            map.removeLayer(lineId);
                        }
                        if (map.getSource(lineId)) {
                            map.removeSource(lineId);
                        }
                        // Remove from tracking array
                        const idx = this.animationLayers.indexOf(lineId);
                        if (idx > -1) {
                            this.animationLayers.splice(idx, 1);
                        }
                    } catch (error) {
                        // Ignore cleanup errors
                    }
                }, 300);
            });

        } catch (error) {
            console.warn('Failed to animate segment analysis:', error);
        }
    }

    generateMockResults() {
        const results = [];
        for (let i = 0; i < 50; i++) {
            results.push({
                id: `segment-${i}`,
                score: Math.random() * 100,
                rank: i + 1,
                freeway: ['I-90/94', 'I-290', 'I-55'][Math.floor(Math.random() * 3)],
                features: {
                    ctaStations: Math.random() * 10,
                    parks: Math.random() * 10
                }
            });
        }
        return results.sort((a, b) => b.score - a.score).map((segment, index) => ({
            ...segment,
            rank: index + 1
        }));
    }

    updateAnalysisProgress(progress) {
        const progressBar = document.getElementById('progress-bar');
        const progressText = document.getElementById('progress-percentage');

        if (progressBar) {
            progressBar.style.width = `${progress}%`;
        }

        if (progressText) {
            progressText.textContent = `${Math.round(progress)}%`;
        }
    }

    clearAllAnimations() {
        // Immediately remove all animation layers and cleanup
        if (!this.animationLayers || !this.mapComponent) return;

        const map = this.mapComponent.getMap();

        // Remove all tracked animation layers
        this.animationLayers.forEach(lineId => {
            try {
                if (map.getLayer(lineId)) {
                    map.removeLayer(lineId);
                }
                if (map.getSource(lineId)) {
                    map.removeSource(lineId);
                }
            } catch (error) {
                // Ignore errors during cleanup
            }
        });

        // Clear the tracking array
        this.animationLayers = [];
    }

    populateResults(results) {
        // Clean up all animations immediately when results appear
        this.clearAllAnimations();

        // Zoom back out to original Chicago view
        this.mapComponent.getMap().flyTo({
            center: [-87.6298, 41.8], // Chicago center
            zoom: 10.5,
            pitch: 45,
            bearing: -17.6,
            duration: 2000
        });

        const resultsList = document.getElementById('results-list');
        resultsList.innerHTML = '';

        // Calculate min and max scores for gradient
        const scores = results.segments.map(s => s.score);
        const minScore = Math.min(...scores);
        const maxScore = Math.max(...scores);

        // Store these values for use in other methods
        this.analysisMinScore = minScore;
        this.analysisMaxScore = maxScore;

        // Add Rankings/Methodology selector
        const viewSelectorDiv = document.createElement('div');
        viewSelectorDiv.className = 'mb-4';
        viewSelectorDiv.innerHTML = `
            <div class="flex gap-2">
                <button id="results-rankings-btn"
                        class="results-view-btn flex-1 px-3 py-1.5 text-xs font-medium rounded border transition-colors active"
                        data-view="rankings">
                    Rankings
                </button>
                <button id="results-methodology-btn"
                        class="results-view-btn flex-1 px-3 py-1.5 text-xs font-medium rounded border transition-colors"
                        data-view="methodology">
                    Methodology
                </button>
            </div>
        `;
        resultsList.appendChild(viewSelectorDiv);

        // Container for view content
        const viewContentDiv = document.createElement('div');
        viewContentDiv.id = 'results-view-content';
        resultsList.appendChild(viewContentDiv);

        // Add event listeners for view selector
        const rankingsBtn = viewSelectorDiv.querySelector('#results-rankings-btn');
        const methodologyBtn = viewSelectorDiv.querySelector('#results-methodology-btn');

        rankingsBtn.addEventListener('click', () => {
            this.stateManager.set('resultsView', 'rankings');
            this.renderResultsView();
        });

        methodologyBtn.addEventListener('click', () => {
            this.stateManager.set('resultsView', 'methodology');
            this.renderResultsView();
        });

        // Initial render
        this.renderResultsView();

        // Add segments to map
        this.addSegmentsToMap(results.segments, minScore, maxScore);
    }

    renderResultsView() {
        const viewContent = document.getElementById('results-view-content');
        if (!viewContent) return;

        const currentView = this.stateManager.get('resultsView');
        const results = this.stateManager.get('analysisResults');

        // Update button styles
        const rankingsBtn = document.getElementById('results-rankings-btn');
        const methodologyBtn = document.getElementById('results-methodology-btn');

        if (rankingsBtn && methodologyBtn) {
            if (currentView === 'rankings') {
                rankingsBtn.classList.add('active');
                methodologyBtn.classList.remove('active');
            } else {
                rankingsBtn.classList.remove('active');
                methodologyBtn.classList.add('active');
            }
        }

        // Clear existing content
        viewContent.innerHTML = '';

        if (currentView === 'rankings') {
            // Add results summary at top of rankings view
            const summaryDiv = document.createElement('div');
            summaryDiv.className = 'mb-4 p-3 bg-gray-50 rounded text-sm';
            summaryDiv.innerHTML = `
                <div class="font-medium text-gray-700 mb-1">Analysis Complete</div>
                <div class="text-gray-600">
                    ${results.segments.length} segments analyzed<br>
                    Top score: ${this.analysisMaxScore.toFixed(1)}<br>
                    Bottom score: ${this.analysisMinScore.toFixed(1)}
                </div>
            `;
            viewContent.appendChild(summaryDiv);

            // Render rankings list
            results.segments.forEach(segment => {
                const resultItem = this.createResultItem(segment, this.analysisMinScore, this.analysisMaxScore);
                viewContent.appendChild(resultItem);
            });
        } else {
            // Render methodology view
            this.renderMethodologyView(viewContent);
        }
    }

    renderMethodologyView(container) {
        // Scoring methodology box
        const scoringBox = document.createElement('div');
        scoringBox.className = 'mb-4 p-3 bg-blue-50 border border-blue-200 rounded';
        scoringBox.innerHTML = `
            <div class="font-medium text-gray-700 mb-1" style="font-size: 0.7rem;">Scoring</div>
            <div class="text-gray-600 space-y-1" style="font-size: 0.7rem; line-height: 1.3;">
                <p>The analysis engine scores freeway segments on various features using a 0-10 scale. Features are weighted and combined into a final composite score.</p>

                <p><strong>Proximity metrics:</strong><br>
                1. Find the nearest feature within the standard radius (1 mile)<br>
                2. Calculate distance from segment boundary to feature<br>
                3. Apply linear decay: score = max(0, 1 - distance/radius) × 10<br>
                4. Score of 10 = feature touches segment, score of 0 = feature at radius edge or beyond</p>

                <p><strong>Density metrics</strong> (transit stops, bike routes) count features within a circular buffer and normalize against fixed maximums.</p>

                <p><strong>Block group metrics</strong> (ADI, crashes) use the census block group containing the segment center, and normalize with fixed maximums.</p>
            </div>
        `;
        container.appendChild(scoringBox);

        // Check if a specific scenario is selected (not 'best-overall')
        const currentScenario = this.stateManager.get('defaultScenario');

        if (currentScenario && currentScenario !== 'best-overall') {
            // Get scenario configuration
            const scenario = this.scenarios[currentScenario];

            if (scenario) {
                const scenarioBox = document.createElement('div');
                scenarioBox.className = 'mb-4 p-3 bg-green-50 border border-green-200 rounded';

                // Separate description (first line) from bullet points (rest)
                const description = scenario.description[0];
                const bulletPoints = scenario.description.slice(1);

                // Remove scenario name prefix from description if it exists
                // Pattern matches "Scenario X: <anything> - " (non-greedy match up to " - ")
                const cleanDescription = description
                    .replace(/^Scenario \d+: .+? - /, '')
                    .replace(/^direct/, 'Direct'); // Capitalize "direct" at the beginning

                scenarioBox.innerHTML = `
                    <div class="font-medium text-gray-700 mb-1" style="font-size: 0.7rem;">${scenario.name}</div>
                    <div class="text-gray-600 space-y-0.5" style="font-size: 0.7rem; line-height: 1.3;">
                        <div class="italic mb-1">${cleanDescription}</div>
                        ${bulletPoints.map(line => `<div>• ${line.replace(/^•\s*/, '')}</div>`).join('')}
                    </div>
                `;
                container.appendChild(scenarioBox);
            }
        }
    }

    createResultItem(segment, minScore = null, maxScore = null) {
        const item = document.createElement('div');
        item.className = 'result-item border-b border-gray-200';
        item.dataset.segmentId = segment.id;

        // Create score color based on gradient from min to max
        const scoreColor = this.getScoreColor(segment.score, minScore, maxScore);

        item.innerHTML = `
            <div class="flex justify-between items-center mb-2">
                <div class="result-rank text-gray-500">#${segment.rank}</div>
                <div class="result-score font-bold" style="color: ${scoreColor}">${segment.score.toFixed(1)}</div>
            </div>
            <div class="text-sm text-gray-700 font-medium">
                ${segment.freeway}
            </div>
            <div class="text-xs text-gray-500 mt-1">
                ${Math.round(segment.length_ft)}ft segment
            </div>
        `;

        // Add hover effects
        item.addEventListener('mouseenter', () => {
            this.highlightSegmentOnMap(segment.id);
        });

        item.addEventListener('mouseleave', () => {
            this.clearSegmentHighlight();
        });

        item.addEventListener('click', () => {
            this.stateManager.selectSegment(segment.id);
            this.flyToSegment(segment);
        });

        return item;
    }

    getScoreColor(score, minScore = null, maxScore = null) {
        // If min/max are provided, use gradient from worst to best
        if (minScore !== null && maxScore !== null && maxScore > minScore) {
            // Normalize score to 0-1 range based on actual min/max
            const normalizedScore = (score - minScore) / (maxScore - minScore);
            return this.interpolateColor(normalizedScore);
        }

        // Fallback to original discrete system if min/max not provided
        if (score >= 70) return '#22c55e'; // Green
        if (score >= 40) return '#eab308'; // Yellow
        return '#ef4444'; // Red
    }

    interpolateColor(normalizedScore) {
        // Clamp the normalized score between 0 and 1
        const t = Math.max(0, Math.min(1, normalizedScore));

        // Red to green gradient
        // Red: rgb(239, 68, 68) = #ef4444
        // Yellow: rgb(234, 179, 8) = #eab308
        // Green: rgb(34, 197, 94) = #22c55e

        if (t <= 0.5) {
            // Interpolate from red to yellow
            const localT = t * 2; // 0 to 1
            const r = Math.round(239 + (234 - 239) * localT);
            const g = Math.round(68 + (179 - 68) * localT);
            const b = Math.round(68 + (8 - 68) * localT);
            return `rgb(${r}, ${g}, ${b})`;
        } else {
            // Interpolate from yellow to green
            const localT = (t - 0.5) * 2; // 0 to 1
            const r = Math.round(234 + (34 - 234) * localT);
            const g = Math.round(179 + (197 - 179) * localT);
            const b = Math.round(8 + (94 - 8) * localT);
            return `rgb(${r}, ${g}, ${b})`;
        }
    }

    addSegmentsToMap(segments, minScore = null, maxScore = null) {
        // Remove existing segments layer
        if (this.mapComponent.getMap().getSource('analysis-segments')) {
            this.mapComponent.removeDataLayer('analysis-segments');
        }

        // Create GeoJSON for segments
        const segmentsGeoJSON = {
            type: 'FeatureCollection',
            features: segments.map(segment => ({
                type: 'Feature',
                geometry: segment.geometry.geometry,
                properties: {
                    id: segment.id,
                    score: segment.score,
                    rank: segment.rank,
                    freeway: segment.freeway,
                    scoreColor: this.getScoreColor(segment.score, minScore, maxScore)
                }
            }))
        };

        // Add segments to map with score-based styling
        const layerConfig = {
            id: 'analysis-segments',
            data: segmentsGeoJSON,
            geometryType: 'Polygon',
            style: {
                fillColor: ['get', 'scoreColor'],
                strokeColor: ['get', 'scoreColor'],
                fillOpacity: 0.9,
                strokeWidth: 10,
                strokeOpacity: 1
            }
        };

        this.mapComponent.addDataLayer(layerConfig);
    }

    highlightSegmentOnMap(segmentId) {
        try {
            if (this.mapComponent.getMap().getLayer('analysis-segments')) {
                // Highlight specific segment
                this.mapComponent.getMap().setFilter('analysis-segments', [
                    'case',
                    ['==', ['get', 'id'], segmentId],
                    true,
                    ['!=', ['get', 'id'], segmentId]
                ]);

                // Add highlight stroke
                this.mapComponent.updateLayerStyle('analysis-segments', {
                    strokeWidth: ['case', ['==', ['get', 'id'], segmentId], 3, 1],
                    strokeColor: ['case', ['==', ['get', 'id'], segmentId], '#ffffff', '#333333']
                });
            }
        } catch (error) {
            console.warn('Failed to highlight segment:', error);
        }
    }

    clearSegmentHighlight() {
        try {
            if (this.mapComponent.getMap().getLayer('analysis-segments')) {
                // Clear filters and reset styling
                this.mapComponent.getMap().setFilter('analysis-segments', null);
                this.mapComponent.updateLayerStyle('analysis-segments', {
                    strokeWidth: 1,
                    strokeColor: '#333333'
                });
            }
        } catch (error) {
            console.warn('Failed to clear segment highlight:', error);
        }
    }

    highlightSelectedSegment(segmentId) {
        try {
            // Remove existing selection layer if it exists
            if (this.mapComponent.getMap().getSource('selected-segment')) {
                this.mapComponent.removeDataLayer('selected-segment');
            }

            // Find the selected segment data
            const analysisResults = this.stateManager.get('analysisResults');
            const segment = analysisResults?.segments?.find(s => s.id === segmentId);

            if (!segment) return;

            // Create selection highlight layer with light blue color
            const selectionData = {
                type: 'FeatureCollection',
                features: [{
                    type: 'Feature',
                    geometry: segment.geometry.geometry,
                    properties: {
                        id: segment.id,
                        selected: true
                    }
                }]
            };

            const layerConfig = {
                id: 'selected-segment',
                data: selectionData,
                geometryType: 'Polygon',
                style: {
                    fillColor: '#87ceeb', // Light blue
                    strokeColor: '#4682b4', // Steel blue
                    fillOpacity: 0.7,
                    strokeWidth: 3,
                    strokeOpacity: 1
                }
            };

            this.mapComponent.addDataLayer(layerConfig);

            // Move selection layer above analysis segments layer to ensure it's visible
            const map = this.mapComponent.getMap();
            try {
                map.moveLayer('selected-segment');
            } catch (error) {
                // Layer might not exist yet, ignore
            }
        } catch (error) {
            console.warn('Failed to highlight selected segment:', error);
        }
    }

    clearSegmentSelection() {
        try {
            if (this.mapComponent.getMap().getSource('selected-segment')) {
                this.mapComponent.removeDataLayer('selected-segment');
            }
        } catch (error) {
            console.warn('Failed to clear segment selection:', error);
        }
    }

    flyToSegment(segment) {
        if (segment.center) {
            this.mapComponent.getMap().flyTo({
                center: segment.center,
                zoom: 16,
                duration: 1000
            });
        }
    }

    hideExploreLayers() {
        // Hide all dataset layers that were visible in explore mode
        const visibleDatasets = this.stateManager.get('visibleDatasets');
        visibleDatasets.forEach(datasetKey => {
            this.mapComponent.toggleLayerVisibility(datasetKey, false);
        });
    }

    showExploreLayers() {
        // Restore visible dataset layers when returning to explore mode
        const visibleDatasets = this.stateManager.get('visibleDatasets');
        visibleDatasets.forEach(datasetKey => {
            this.mapComponent.toggleLayerVisibility(datasetKey, true);
        });
    }

    clearAnalysisResults() {
        // Remove segments layer from map
        if (this.mapComponent.getMap().getSource('analysis-segments')) {
            this.mapComponent.removeDataLayer('analysis-segments');
        }

        // Clear any analysis highlights
        if (this.mapComponent.getMap().getSource('analysis-highlight')) {
            this.mapComponent.removeDataLayer('analysis-highlight');
        }

        // Clear segment selection
        this.clearSegmentSelection();

        // Clear stored min/max scores
        this.analysisMinScore = null;
        this.analysisMaxScore = null;

        // Destroy minimap so new analysis creates fresh one
        this.mapComponent.destroyMiniMap();
    }

    updateRightPanelVisibility(show) {
        const rightPanel = document.getElementById('right-panel');
        rightPanel.classList.toggle('hidden', !show);
    }

    updateSelectedSegment(segmentId) {
        // Update result item selection
        document.querySelectorAll('.result-item').forEach(item => {
            item.classList.toggle('selected', item.dataset.segmentId === segmentId);
        });

        // Clear any existing selection highlight
        this.clearSegmentSelection();

        if (segmentId) {
            // Add light blue highlight to selected segment
            this.highlightSelectedSegment(segmentId);
            // Update right panel with segment details
            this.updateSegmentDetails(segmentId);
        }
    }

    updateSegmentDetails(segmentId) {
        const detailsContainer = document.getElementById('segment-details');

        // Find the segment data
        const analysisResults = this.stateManager.get('analysisResults');
        const segment = analysisResults?.segments?.find(s => s.id === segmentId);

        if (!segment) {
            detailsContainer.innerHTML = '<div class="text-gray-500">Segment not found</div>';
            return;
        }

        const scoreColor = this.getScoreColor(segment.score, this.analysisMinScore, this.analysisMaxScore);

        // Define feature metadata mapping
        const featureMetadata = [
            { key: 'ctaStations', label: 'CTA Rail Stations', color: '#1f77b4' },
            { key: 'metraStations', label: 'Metra Stations', color: '#ff6b6b' },
            { key: 'amtrakStations', label: 'Amtrak Stations', color: '#4ecdc4' },
            { key: 'parks', label: 'Parks', color: '#2ca02c' },
            { key: 'publicSchools', label: 'Public Schools', color: '#ff7f0e' },
            { key: 'privateSchools', label: 'Private Schools', color: '#d62728' },
            { key: 'colleges', label: 'Colleges', color: '#9467bd' },
            { key: 'hospitals', label: 'Hospitals', color: '#8c564b' },
            { key: 'landmarks', label: 'Landmarks', color: '#e377c2' },
            { key: 'stadiums', label: 'Stadiums', color: '#7f7f7f' },
            { key: 'ssa', label: 'SSA', color: '#bcbd22' },
            { key: 'tif', label: 'TIF', color: '#17becf' },
            { key: 'medicalDistrict', label: 'Medical District', color: '#ff9896' },
            { key: 'neighborhoodCenter', label: 'Neighborhood Center', color: '#c5b0d5' },
            { key: 'bridges', label: 'Bridges', color: '#95a5a6' },
            { key: 'adi', label: 'ADI of Block Group', color: '#e74c3c' },
            { key: 'crashes', label: 'Crash Frequency', color: '#f39c12' },
            { key: 'transitDensity', label: 'Transit Stop Density', color: '#3498db' },
            { key: 'bikeNetwork', label: 'Bike Network Connectivity', color: '#27ae60' }
        ];

        // Get feature weights from state
        const features = this.stateManager.get('features') || {};

        // Sort features by weight (highest to lowest) and filter out 0-weighted features
        const sortedFeatures = featureMetadata
            .map(meta => ({
                ...meta,
                weight: features[meta.key]?.weight || 0,
                score: segment.featureScores[meta.key] || 0
            }))
            .filter(feature => feature.weight > 0)
            .sort((a, b) => b.weight - a.weight);

        // Generate feature score bars in sorted order
        const featureScoreBars = sortedFeatures
            .map(feature => this.createFeatureScoreBar(feature.label, feature.score, feature.color))
            .join('');

        // Check if this is first render or update
        const isFirstRender = !document.getElementById('minimap-container');

        if (isFirstRender) {
            // First time - render everything including minimap container
            detailsContainer.innerHTML = `
                <div id="segment-info-section" class="mb-4">
                    <h4 class="text-lg font-medium text-gray-900 mb-2">
                        ${segment.freeway} Segment
                    </h4>
                    <div class="text-2xl font-bold mb-2" style="color: ${scoreColor}">
                        ${segment.score.toFixed(1)}/100
                    </div>
                    <div class="text-sm text-gray-600">
                        Rank: #${segment.rank} of ${analysisResults.segments.length}<br>
                        Length: ${Math.round(segment.length_ft)} feet<br>
                        Center: ${segment.center[1].toFixed(4)}, ${segment.center[0].toFixed(4)}
                    </div>
                </div>

                <div id="feature-scores-section" class="mb-4">
                    <h5 class="text-sm font-medium text-gray-700 mb-2">Feature Scores</h5>
                    <div class="space-y-3">
                        ${featureScoreBars}
                    </div>
                </div>

                <div class="flex-1 flex flex-col min-h-0">
                    <h5 class="text-sm font-medium text-gray-700 mb-2">Location Overview</h5>
                    <div id="minimap-container" class="w-full border border-gray-300 rounded flex-1"></div>
                </div>
            `;
        } else {
            // Update only - replace content but preserve minimap container
            document.getElementById('segment-info-section').innerHTML = `
                <h4 class="text-lg font-medium text-gray-900 mb-2">
                    ${segment.freeway} Segment
                </h4>
                <div class="text-2xl font-bold mb-2" style="color: ${scoreColor}">
                    ${segment.score.toFixed(1)}/100
                </div>
                <div class="text-sm text-gray-600">
                    Rank: #${segment.rank} of ${analysisResults.segments.length}<br>
                    Length: ${Math.round(segment.length_ft)} feet<br>
                    Center: ${segment.center[1].toFixed(4)}, ${segment.center[0].toFixed(4)}
                </div>
            `;

            document.getElementById('feature-scores-section').innerHTML = `
                <h5 class="text-sm font-medium text-gray-700 mb-2">Feature Scores</h5>
                <div class="space-y-3">
                    ${featureScoreBars}
                </div>
            `;
        }

        // Initialize or update minimap
        this.initOrUpdateMinimap(segment, analysisResults.segments);
    }

    async initOrUpdateMinimap(selectedSegment, allSegments) {
        // Wait for DOM to be ready
        await new Promise(resolve => setTimeout(resolve, 50));

        // Check if minimap exists
        if (this.mapComponent.hasMiniMap()) {
            // Minimap exists - just update the point marker
            this.mapComponent.updateMinimapHighlight(selectedSegment);
        } else {
            // First time - initialize minimap with all segments
            await this.mapComponent.initMiniMap('minimap-container', allSegments);
            // Then highlight the selected segment
            this.mapComponent.updateMinimapHighlight(selectedSegment);
        }
    }

    createFeatureScoreBar(label, score, color) {
        const percentage = Math.min(100, Math.max(0, score * 10)); // Convert 0-10 scale to 0-100%

        return `
            <div class="feature-score-bar">
                <div class="flex justify-between items-center mb-1">
                    <div class="feature-score-label text-xs text-gray-600">${label}</div>
                    <div class="feature-score-value text-xs font-medium text-gray-800">${score.toFixed(1)}</div>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-2">
                    <div class="h-2 rounded-full transition-all duration-300"
                         style="width: ${percentage}%; background-color: ${color}"></div>
                </div>
            </div>
        `;
    }

    // Toggle station gate controls enabled/disabled state
    toggleStationGateControls(enabled) {
        const controls = document.getElementById('station-gate-controls');
        if (enabled) {
            controls.classList.remove('opacity-50', 'pointer-events-none');
        } else {
            controls.classList.add('opacity-50', 'pointer-events-none');
        }
    }

    // Update zoning allowlist based on checkbox selections
    updateZoningAllowlist() {
        const allowedCategories = [];

        if (document.getElementById('zoning-residential').checked) allowedCategories.push('residential');
        if (document.getElementById('zoning-business').checked) allowedCategories.push('business');
        if (document.getElementById('zoning-commercial').checked) allowedCategories.push('commercial');
        if (document.getElementById('zoning-downtown').checked) allowedCategories.push('downtown');
        if (document.getElementById('zoning-industrial').checked) allowedCategories.push('industrial');
        if (document.getElementById('zoning-planned').checked) allowedCategories.push('planned');
        if (document.getElementById('zoning-other').checked) allowedCategories.push('other');

        this.stateManager.updateRequirement('zoning', {
            enabled: allowedCategories.length < 7, // enabled if not all categories selected
            allowed: allowedCategories
        });
    }

    // Populate neighborhood dropdown with available neighborhoods
    async populateNeighborhoodList() {
        try {
            // Load neighborhoods dataset to get list of neighborhood names
            const response = await fetch('data_ready/neighborhoods.geojson');
            if (!response.ok) {
                console.warn('Neighborhoods dataset not available for filtering');
                return;
            }

            const data = await response.json();
            const select = document.getElementById('neighborhood-filter');

            // Extract unique neighborhood names
            const neighborhoods = new Set();
            data.features.forEach(feature => {
                const name = feature.properties.pri_neigh ||
                           feature.properties.neighborhood ||
                           feature.properties.name ||
                           feature.properties.COMMUNITY ||
                           feature.properties.PRI_NEIGH ||
                           `Neighborhood ${feature.properties.OBJECTID || ''}`;

                if (name && name.trim()) {
                    neighborhoods.add(name.trim());
                }
            });

            // Sort neighborhoods alphabetically
            const sortedNeighborhoods = Array.from(neighborhoods).sort();

            // Populate dropdown
            select.innerHTML = '';
            sortedNeighborhoods.forEach(neighborhood => {
                const option = document.createElement('option');
                option.value = neighborhood;
                option.textContent = neighborhood;
                select.appendChild(option);
            });

            console.log(`Populated ${sortedNeighborhoods.length} neighborhoods for filtering`);

        } catch (error) {
            console.warn('Failed to load neighborhoods for filtering:', error);

            // Add a fallback message
            const select = document.getElementById('neighborhood-filter');
            select.innerHTML = '<option disabled>Neighborhoods data not available</option>';
        }
    }
}

export default UIController;