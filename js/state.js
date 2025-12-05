// State Manager - Centralized state management using simple publish/subscribe pattern
class StateManager {
    constructor() {
        this.state = {
            // Current view
            currentView: 'explore', // 'explore', 'preferences', 'analysis', 'results'

            // Explore state
            selectedHighways: ['I-90/94', 'I-290', 'I-55', 'I-90/94-Dan-Ryan', 'I-57'],
            bufferDistance: 0.5,
            showBuffer: false,
            visibleDatasets: new Set(),
            loadedDatasets: new Set(),

            // Preferences state
            defaultScenario: 'best-overall',
            segmentLength: 300, // feet
            selectedFreeways: ['I-90/94', 'I-290', 'I-55', 'I-90/94-Dan-Ryan', 'I-57'],
            requirements: {
                globalBuffer: { enabled: false, distance: 0.5 },
                stationProximity: { enabled: false, distance: 0.5 },
                neighborhoods: { enabled: false, selected: [] },
                zoning: { enabled: false, allowed: [] },
                ssa: { enabled: false },
                tif: { enabled: false },
                bridgeAge: { enabled: false, threshold: 80 }
            },
            features: {
                ctaStations: { weight: 9, radius: 1.0 },
                parks: { weight: 6, radius: 1.0 },
                metraStations: { weight: 8, radius: 1.0 },
                amtrakStations: { weight: 7, radius: 1.0 },
                transitDensity: { weight: 7, radius: 0.25, direction: 'higher' },
                bikeNetwork: { weight: 5, radius: 0.25, direction: 'higher' },
                population: { weight: 7, radius: 1.0 },
                householdSize: { weight: 4, radius: 1.0 },
                income: { weight: 5, radius: 1.0, direction: 'lower' },
                adi: { weight: 8, radius: 1.0, direction: 'higher' },
                crashes: { weight: 5, radius: 1.0, direction: 'lower' },
                permits: { weight: 5, radius: 1.0, years: 3 },
                hospitals: { weight: 4, radius: 1.0 },
                publicSchools: { weight: 4, radius: 1.0 },
                privateSchools: { weight: 4, radius: 1.0 },
                colleges: { weight: 5, radius: 1.0 },
                landmarks: { weight: 2, radius: 1.0 },
                stadiums: { weight: 5, radius: 1.0 },
                bridges: { weight: 9, radius: 1.0 },
                ssa: { weight: 5, radius: 1.0 },
                tif: { weight: 5, radius: 1.0 },
                medicalDistrict: { weight: 4, radius: 1.0 },
                neighborhoodCenter: { weight: 5, radius: 1.0 }
            },
            individualRadii: false,

            // Analysis state
            isAnalyzing: false,
            analysisProgress: 0,
            currentSegment: null,

            // Results state
            analysisResults: null,
            rankedSegments: [],
            selectedSegment: null,
            showRightPanel: false,
            resultsView: 'rankings' // 'rankings' or 'methodology'
        };

        this.listeners = new Map();
    }

    // Subscribe to state changes
    subscribe(key, callback) {
        if (!this.listeners.has(key)) {
            this.listeners.set(key, new Set());
        }
        this.listeners.get(key).add(callback);

        // Return unsubscribe function
        return () => {
            const callbacks = this.listeners.get(key);
            if (callbacks) {
                callbacks.delete(callback);
            }
        };
    }

    // Emit state change
    emit(key, data) {
        const callbacks = this.listeners.get(key);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in state listener for ${key}:`, error);
                }
            });
        }
    }

    // Get current state
    getState() {
        return { ...this.state };
    }

    // Get specific state value
    get(key) {
        return this.getNestedValue(this.state, key);
    }

    // Set state value and emit change
    set(key, value) {
        const oldValue = this.get(key);
        this.setNestedValue(this.state, key, value);

        if (oldValue !== value) {
            this.emit(key, value);
            this.emit('stateChange', { key, value, oldValue });
        }
    }

    // Update state object and emit change
    update(key, updates) {
        const oldValue = this.get(key);
        const currentValue = oldValue || {};
        const newValue = { ...currentValue, ...updates };

        this.setNestedValue(this.state, key, newValue);
        this.emit(key, newValue);
        this.emit('stateChange', { key, value: newValue, oldValue });
    }

    // Helper to get nested object values
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }

    // Helper to set nested object values
    setNestedValue(obj, path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((current, key) => {
            if (!(key in current)) current[key] = {};
            return current[key];
        }, obj);
        target[lastKey] = value;
    }

    // View management
    setCurrentView(view) {
        this.set('currentView', view);
    }

    // Highway/buffer management
    toggleHighway(highway, enabled) {
        const highways = new Set(this.get('selectedHighways'));
        if (enabled) {
            highways.add(highway);
        } else {
            highways.delete(highway);
        }
        this.set('selectedHighways', Array.from(highways));
    }

    setBufferDistance(distance) {
        this.set('bufferDistance', distance);
    }

    toggleBufferVisibility(show) {
        this.set('showBuffer', show);
    }

    // Dataset management
    toggleDataset(datasetId, visible) {
        const visibleDatasets = new Set(this.get('visibleDatasets'));
        if (visible) {
            visibleDatasets.add(datasetId);
        } else {
            visibleDatasets.delete(datasetId);
        }
        this.set('visibleDatasets', visibleDatasets);
    }

    markDatasetLoaded(datasetId) {
        const loadedDatasets = new Set(this.get('loadedDatasets'));
        loadedDatasets.add(datasetId);
        this.set('loadedDatasets', loadedDatasets);
    }

    // Preferences management
    setSegmentLength(length) {
        this.set('segmentLength', length);
    }

    toggleFreewaySelection(freeway, enabled) {
        const freeways = new Set(this.get('selectedFreeways'));
        if (enabled) {
            freeways.add(freeway);
        } else {
            freeways.delete(freeway);
        }
        this.set('selectedFreeways', Array.from(freeways));
    }

    updateRequirement(requirementKey, updates) {
        this.update(`requirements.${requirementKey}`, updates);
    }

    updateFeature(featureKey, updates) {
        this.update(`features.${featureKey}`, updates);
    }

    setIndividualRadii(enabled) {
        this.set('individualRadii', enabled);
    }

    // Analysis management
    startAnalysis() {
        this.set('isAnalyzing', true);
        this.set('analysisProgress', 0);
        this.set('currentSegment', null);
    }

    updateAnalysisProgress(progress, currentSegment = null) {
        this.set('analysisProgress', progress);
        if (currentSegment) {
            this.set('currentSegment', currentSegment);
        }
    }

    completeAnalysis(results) {
        this.set('isAnalyzing', false);
        this.set('analysisProgress', 100);
        this.set('analysisResults', results);
        this.set('rankedSegments', results.segments || []);
        this.setCurrentView('results');
    }

    // Results management
    selectSegment(segmentId) {
        this.set('selectedSegment', segmentId);
        this.set('showRightPanel', true);
    }

    toggleRightPanel(show) {
        this.set('showRightPanel', show);
        if (!show) {
            this.set('selectedSegment', null);
        }
    }

    // Reset methods
    resetToExplore() {
        this.set('isAnalyzing', false);
        this.set('analysisProgress', 0);
        this.set('currentSegment', null);
        this.set('analysisResults', null);
        this.set('rankedSegments', []);
        this.set('selectedSegment', null);
        this.set('showRightPanel', false);
        this.set('resultsView', 'rankings'); // Reset to rankings view
        this.setCurrentView('explore');
    }

    resetAnalysisState() {
        this.set('isAnalyzing', false);
        this.set('analysisProgress', 0);
        this.set('currentSegment', null);
    }

    // Validation helpers
    isValidForAnalysis() {
        const selectedFreeways = this.get('selectedFreeways');
        const segmentLength = this.get('segmentLength');

        return selectedFreeways.length > 0 &&
               segmentLength >= 100 &&
               segmentLength <= 1500;
    }

    getAnalysisConfiguration() {
        return {
            segmentLength: this.get('segmentLength'),
            selectedFreeways: this.get('selectedFreeways'),
            requirements: this.get('requirements'),
            features: this.get('features'),
            individualRadii: this.get('individualRadii')
        };
    }

    // Debug helper
    debugState() {
        console.log('Current state:', this.state);
    }
}

export default StateManager;