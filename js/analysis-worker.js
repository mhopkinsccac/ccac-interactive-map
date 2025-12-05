// Analysis Web Worker - Handles computational analysis in background thread
// Import Turf.js for geospatial operations
importScripts('https://unpkg.com/@turf/turf@6.5.0/turf.min.js');

class AnalysisEngine {
    constructor() {
        this.segments = [];
        this.datasets = new Map();
        this.config = null;
    }

    async runAnalysis(config, datasets) {
        try {
            this.config = config;
            this.datasets = new Map(Object.entries(datasets));


            // Step 1: Generate segments
            this.postProgress(0, 'Generating freeway segments...');
            await this.generateSegments();

            // Step 2: Apply requirements filters
            this.postProgress(0, 'Applying requirement filters...');
            await this.applyRequirements();

            // Step 3: Score segments on features
            const totalSegments = this.segments.filter(s => s.eligible).length;
            this.totalSegmentsToScore = totalSegments;
            this.postProgress(0, 'Scoring segments...');
            await this.scoreSegments();

            // Step 4: Calculate final scores
            this.postProgress(100, 'Computing final scores...');
            const results = this.calculateFinalScores();

            this.postProgress(100, 'Analysis complete!');

            // Return results
            postMessage({
                type: 'complete',
                data: {
                    segments: results,
                    totalSegments: results.length,
                    analysisTime: Date.now()
                }
            });

        } catch (error) {
            postMessage({
                type: 'error',
                data: { message: error.message, stack: error.stack }
            });
        }
    }


    async generateSegments() {
        if (!this.datasets.has('freeways')) {
            throw new Error('Freeway data not available');
        }

        const freewayData = this.datasets.get('freeways');
        const targetLengthFt = this.config.segmentLength; // desired minimum length (X ft)
        const selectedFreeways = new Set(this.config.selectedFreeways || []);

        // unit helpers
        const FT_TO_KM = 0.0003048; // ft -> km
        const targetLengthKm = targetLengthFt * FT_TO_KM;
        const halfWidthKm = (20 * FT_TO_KM) / 2; // 20ft total width -> half-width in km

        // Reset segments
        this.segments = [];
        let segmentId = 0;

        // Group LineStrings by freeway corridor (prefer corridor_id, fallback to STREET_NAM mapping)
        const groups = new Map();
        for (const f of freewayData.features) {
            if (!f || f.geometry?.type !== 'LineString') continue;
            const props = f.properties || {};
            if (props.CLASS && String(props.CLASS) !== '1') continue; // main freeway only

            const corridor =
                props.corridor_id ||
                this.getFreewayName(props.STREET_NAM) ||
                'Unknown';

            // Respect selectedFreeways filter if provided
            if (selectedFreeways.size > 0 && !selectedFreeways.has(corridor)) continue;

            if (!groups.has(corridor)) groups.set(corridor, []);
            groups.get(corridor).push(f);
        }

        // Helper: make a 20ft-wide rectangle polygon aligned to the line segment between two points
        const makeRectangle = (startPoint, endPoint) => {
            const bearing = turf.bearing(startPoint, endPoint);
            const center = turf.midpoint(startPoint, endPoint);
            const segLenKm = turf.distance(startPoint, endPoint, { units: 'kilometers' });

            if (segLenKm === 0) return null; // degenerate

            const halfLen = segLenKm / 2;

            // Along the segment axis
            const tipA = turf.destination(center, halfLen, bearing, { units: 'kilometers' });
            const tipB = turf.destination(center, halfLen, bearing + 180, { units: 'kilometers' });

            // Offset perpendicular to make rectangle
            const a1 = turf.destination(tipA, halfWidthKm, bearing + 90, { units: 'kilometers' });
            const a2 = turf.destination(tipA, halfWidthKm, bearing - 90, { units: 'kilometers' });
            const b1 = turf.destination(tipB, halfWidthKm, bearing - 90, { units: 'kilometers' });
            const b2 = turf.destination(tipB, halfWidthKm, bearing + 90, { units: 'kilometers' });

            const polygon = turf.polygon([[
                a1.geometry.coordinates,
                a2.geometry.coordinates,
                b1.geometry.coordinates,
                b2.geometry.coordinates,
                a1.geometry.coordinates
            ]]);

            return { polygon, center: center.geometry.coordinates, lengthKm: segLenKm };
        };

        // Helper: stitch connected LineStrings into continuous routes
        const stitchLineStrings = (features) => {
            if (features.length === 0) return [];

            const tolerance = 0.0001; // ~11 meters tolerance for connection
            const lines = features.map(f => ({
                coords: f.geometry.coordinates,
                used: false
            }));

            const routes = [];

            // Find connected sequences of LineStrings
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].used) continue;

                let route = [...lines[i].coords];
                lines[i].used = true;

                let foundConnection = true;
                while (foundConnection) {
                    foundConnection = false;
                    const routeStart = route[0];
                    const routeEnd = route[route.length - 1];

                    // Look for a line that connects to either end
                    for (let j = 0; j < lines.length; j++) {
                        if (lines[j].used) continue;

                        const lineStart = lines[j].coords[0];
                        const lineEnd = lines[j].coords[lines[j].coords.length - 1];

                        // Check all possible connections
                        const startToStart = Math.abs(routeStart[0] - lineStart[0]) + Math.abs(routeStart[1] - lineStart[1]);
                        const startToEnd = Math.abs(routeStart[0] - lineEnd[0]) + Math.abs(routeStart[1] - lineEnd[1]);
                        const endToStart = Math.abs(routeEnd[0] - lineStart[0]) + Math.abs(routeEnd[1] - lineStart[1]);
                        const endToEnd = Math.abs(routeEnd[0] - lineEnd[0]) + Math.abs(routeEnd[1] - lineEnd[1]);

                        if (endToStart < tolerance) {
                            // Connect line to end of route (normal direction)
                            route = route.concat(lines[j].coords.slice(1)); // skip duplicate point
                            lines[j].used = true;
                            foundConnection = true;
                            break;
                        } else if (endToEnd < tolerance) {
                            // Connect line to end of route (reverse direction)
                            route = route.concat([...lines[j].coords].reverse().slice(1));
                            lines[j].used = true;
                            foundConnection = true;
                            break;
                        } else if (startToStart < tolerance) {
                            // Connect line to start of route (reverse direction)
                            route = [...lines[j].coords].reverse().slice(0, -1).concat(route);
                            lines[j].used = true;
                            foundConnection = true;
                            break;
                        } else if (startToEnd < tolerance) {
                            // Connect line to start of route (normal direction)
                            route = lines[j].coords.slice(0, -1).concat(route);
                            lines[j].used = true;
                            foundConnection = true;
                            break;
                        }
                    }
                }

                routes.push(turf.lineString(route));
            }

            return routes;
        };

        // Process each freeway corridor
        for (const [corridor, features] of groups.entries()) {
            if (!features.length) continue;

            // Stitch LineStrings into continuous routes
            const stitchedRoutes = stitchLineStrings(features);

            // Segment each continuous route
            for (const route of stitchedRoutes) {
                const totalKm = turf.length(route, { units: 'kilometers' });
                if (totalKm === 0) continue;

                // If the entire route is shorter than target, create one segment
                if (totalKm <= targetLengthKm) {
                    const startPt = turf.along(route, 0, { units: 'kilometers' });
                    const endPt = turf.along(route, totalKm, { units: 'kilometers' });
                    const rect = makeRectangle(startPt, endPt);
                    if (!rect) continue;

                    this.segments.push({
                        id: `segment-${segmentId++}`,
                        geometry: rect.polygon,
                        properties: {
                            freeway: corridor,
                            length_ft: rect.lengthKm * 3280.84,
                            center: rect.center
                        },
                        scores: {},
                        eligible: true
                    });
                    continue;
                }

                // Create uniform segments along the route
                const numSegments = Math.floor(totalKm / targetLengthKm);
                const actualSegmentLength = totalKm / numSegments; // This ensures we use the full route

                for (let i = 0; i < numSegments; i++) {
                    const startDist = i * actualSegmentLength;
                    const endDist = (i + 1) * actualSegmentLength;

                    const startPt = turf.along(route, startDist, { units: 'kilometers' });
                    const endPt = turf.along(route, endDist, { units: 'kilometers' });
                    const rect = makeRectangle(startPt, endPt);
                    if (!rect) continue;

                    this.segments.push({
                        id: `segment-${segmentId++}`,
                        geometry: rect.polygon,
                        properties: {
                            freeway: corridor,
                            length_ft: rect.lengthKm * 3280.84,
                            center: rect.center
                        },
                        scores: {},
                        eligible: true
                    });
                }
            }
        }

        console.log(`Generated ${this.segments.length} segments (min ${targetLengthFt}ft, 20ft width)`);
    }


    getFreewayName(streetName) {
        if (streetName && streetName.includes('KENNEDY')) return 'I-90/94';
        if (streetName && streetName.includes('EISENHOWER')) return 'I-290';
        if (streetName && streetName.includes('STEVENSON')) return 'I-55';
        if (streetName && streetName.includes('DAN RYAN')) return 'I-90/94-Dan-Ryan';
        if (streetName && (streetName.includes('BISHOP FORD') || streetName.includes('I57'))) return 'I-57';
        return 'Unknown';
    }

    async applyRequirements() {
        // Apply freeway selection (already done in generation)

        // Apply Station-Proximity Gate
        if (this.config.requirements.stationProximity.enabled) {
            this.applyStationProximityGate();
        }

        // Apply Neighborhood filters
        if (this.config.requirements.neighborhoods.enabled) {
            this.applyNeighborhoodFilters();
        }

        // Apply Zoning Allowlist
        if (this.config.requirements.zoning.enabled) {
            this.applyZoningAllowlist();
        }

        // Apply Funding Alignment Gates
        if (this.config.requirements.ssa.enabled) {
            this.applyPolygonIntersectionFilter(
                'special_service_areas',
                'Special Service Areas filter',
                (segment, polygon) => this.segmentIntersectsPolygon(segment, polygon)
            );
        }
        if (this.config.requirements.tif.enabled) {
            this.applyPolygonIntersectionFilter(
                'tif_districts',
                'Tax Increment Financing Districts filter',
                (segment, polygon) => this.segmentIntersectsPolygon(segment, polygon)
            );
        }

        // Apply Bridge Condition Gate
        if (this.config.requirements.bridgeAge.enabled) {
            this.applyBridgeConditionGate();
        }

        const eligibleCount = this.segments.filter(s => s.eligible).length;
        console.log(`${eligibleCount} segments remain after requirement filters`);
    }

    async scoreSegments() {
        const eligibleSegments = this.segments.filter(s => s.eligible);
        let processed = 0;

        for (const segment of eligibleSegments) {
            // Score CTA Rail Stations proximity
            if (this.config.features.ctaStations.weight > 0) {
                segment.scores.ctaStations = this.scoreProximityToCTAStations(segment);
            }

            // Score Metra Stations proximity
            if (this.config.features.metraStations.weight > 0) {
                segment.scores.metraStations = this.scoreProximityToMetraStations(segment);
            }

            // Score Amtrak Stations proximity
            if (this.config.features.amtrakStations.weight > 0) {
                segment.scores.amtrakStations = this.scoreProximityToAmtrakStations(segment);
            }

            // Score Parks proximity
            if (this.config.features.parks.weight > 0) {
                segment.scores.parks = this.scoreProximityToParks(segment);
            }

            // Score Public Schools proximity
            if (this.config.features.publicSchools.weight > 0) {
                segment.scores.publicSchools = this.scoreProximityToPublicSchools(segment);
            }

            // Score Private Schools proximity
            if (this.config.features.privateSchools.weight > 0) {
                segment.scores.privateSchools = this.scoreProximityToPrivateSchools(segment);
            }

            // Score Colleges and Universities proximity
            if (this.config.features.colleges.weight > 0) {
                segment.scores.colleges = this.scoreProximityToColleges(segment);
            }

            // Score Hospitals proximity
            if (this.config.features.hospitals.weight > 0) {
                segment.scores.hospitals = this.scoreProximityToHospitals(segment);
            }

            // Score Landmarks proximity
            if (this.config.features.landmarks.weight > 0) {
                segment.scores.landmarks = this.scoreProximityToLandmarks(segment);
            }

            // Score Stadiums proximity
            if (this.config.features.stadiums.weight > 0) {
                segment.scores.stadiums = this.scoreProximityToStadiums(segment);
            }

            // Score Special Service Areas proximity
            if (this.config.features.ssa.weight > 0) {
                segment.scores.ssa = this.scoreProximityToSSAs(segment);
            }

            // Score TIF Districts proximity
            if (this.config.features.tif.weight > 0) {
                segment.scores.tif = this.scoreProximityToTIFs(segment);
            }

            // Score Medical District proximity
            if (this.config.features.medicalDistrict.weight > 0) {
                segment.scores.medicalDistrict = this.scoreProximityToMedicalDistrict(segment);
            }

            // Score Neighborhood Center proximity
            if (this.config.features.neighborhoodCenter.weight > 0) {
                segment.scores.neighborhoodCenter = this.scoreProximityToNeighborhoodCenter(segment);
            }

            // Score Bridges proximity
            if (this.config.features.bridges.weight > 0) {
                segment.scores.bridges = this.scoreProximityToBridges(segment);
            }

            // Score ADI of Block Group
            if (this.config.features.adi.weight > 0) {
                segment.scores.adi = this.scoreADIOfBlockGroup(segment);
            }

            // Score Crash Frequency
            if (this.config.features.crashes.weight > 0) {
                segment.scores.crashes = this.scoreCrashFrequency(segment);
            }

            // Score Transit Stop Density (Bus)
            if (this.config.features.transitDensity.weight > 0) {
                segment.scores.transitDensity = this.scoreTransitStopDensity(segment);
            }

            // Score Bike Network Connectivity
            if (this.config.features.bikeNetwork.weight > 0) {
                segment.scores.bikeNetwork = this.scoreBikeNetworkConnectivity(segment);
            }


            processed++;
            const progress = Math.round((processed / eligibleSegments.length) * 100);

            // Send animation data every segment (no computation delay - purely visual)
            this.postProgress(progress, `Analyzing segment ${processed}/${eligibleSegments.length}`, {
                currentSegment: segment.id,
                segmentCenter: segment.properties.center,
                randomFeatures: this.getRandomFeatureCoordinates(2, 3)
            });
        }
    }

    scoreProximityToCTAStations(segment) {
        const radiusMiles = this.config.features.ctaStations.radius;
        return this.calculateProximityToPoints(segment, 'cta_rail_stations', radiusMiles);
    }

    scoreProximityToMetraStations(segment) {
        const radiusMiles = this.config.features.metraStations.radius;
        return this.calculateProximityToPoints(segment, 'metra_stations', radiusMiles);
    }

    scoreProximityToAmtrakStations(segment) {
        const radiusMiles = this.config.features.amtrakStations.radius;
        return this.calculateProximityToPoints(segment, 'amtrak_stations', radiusMiles);
    }

    scoreProximityToParks(segment) {
        const radiusMiles = this.config.features.parks.radius;
        return this.calculateProximityToPolygons(segment, 'parks', radiusMiles);
    }

    scoreProximityToPublicSchools(segment) {
        const radiusMiles = this.config.features.publicSchools.radius;
        return this.calculateProximityToPoints(segment, 'public_schools', radiusMiles);
    }

    scoreProximityToPrivateSchools(segment) {
        const radiusMiles = this.config.features.privateSchools.radius;
        return this.calculateProximityToPoints(segment, 'private_schools', radiusMiles);
    }

    scoreProximityToColleges(segment) {
        const radiusMiles = this.config.features.colleges.radius;
        return this.calculateProximityToPoints(segment, 'colleges_universities', radiusMiles);
    }

    scoreProximityToHospitals(segment) {
        const radiusMiles = this.config.features.hospitals.radius;
        return this.calculateProximityToPoints(segment, 'hospitals', radiusMiles);
    }

    scoreProximityToLandmarks(segment) {
        const radiusMiles = this.config.features.landmarks.radius;
        return this.calculateProximityToPolygons(segment, 'landmarks', radiusMiles);
    }

    scoreProximityToStadiums(segment) {
        const radiusMiles = this.config.features.stadiums.radius;
        return this.calculateProximityToPoints(segment, 'stadiums', radiusMiles);
    }

    scoreProximityToSSAs(segment) {
        const radiusMiles = this.config.features.ssa.radius;
        return this.calculateProximityToPolygons(segment, 'special_service_areas', radiusMiles);
    }

    scoreProximityToTIFs(segment) {
        const radiusMiles = this.config.features.tif.radius;
        return this.calculateProximityToPolygons(segment, 'tif_districts', radiusMiles);
    }

    scoreProximityToMedicalDistrict(segment) {
        const radiusMiles = this.config.features.medicalDistrict.radius;
        return this.calculateProximityToPolygons(segment, 'medical_district', radiusMiles);
    }

    scoreProximityToNeighborhoodCenter(segment) {
        const radiusMiles = this.config.features.neighborhoodCenter.radius;
        // For neighborhood centers, we calculate distance to polygon centroids
        if (!this.datasets.has('neighborhoods')) return 0;

        const dataset = this.datasets.get('neighborhoods');
        const segmentCenter = turf.point(segment.properties.center);
        let nearestDistance = Infinity;

        for (const feature of dataset.features) {
            try {
                const centroid = turf.centroid(feature);
                const distance = turf.distance(segmentCenter, centroid, { units: 'miles' });
                if (distance < nearestDistance) {
                    nearestDistance = distance;
                }
            } catch (error) {
                // Skip invalid polygons
                continue;
            }
        }

        if (nearestDistance === Infinity) return 0;

        // Linear decay: score = max(0, 1 - distance/radius)
        const score = Math.max(0, 1 - (nearestDistance / radiusMiles));
        return score * 10; // Scale to 0-10
    }

    scoreProximityToBridges(segment) {
        const radiusMiles = this.config.features.bridges.radius;
        return this.calculateProximityToPoints(segment, 'bridges', radiusMiles);
    }

    scoreADIOfBlockGroup(segment) {
        // Find which block group this segment is in and return its ADI score
        const blockGroup = this.findContainingBlockGroup(segment);
        if (!blockGroup || !blockGroup.properties.adi) {
            return 0; // No data available
        }

        const adiValue = parseFloat(blockGroup.properties.adi);
        if (isNaN(adiValue)) return 0;

        // ADI values typically range from 1-100, where higher = more disadvantaged
        // Score based on direction preference
        const direction = this.config.features.adi.direction || 'higher';

        if (direction === 'higher') {
            // Higher ADI (more disadvantaged) is better for equity targeting
            return Math.min(10, (adiValue / 100) * 10);
        } else {
            // Lower ADI (less disadvantaged) is better for development
            return Math.max(0, 10 - (adiValue / 100) * 10);
        }
    }

    scoreCrashFrequency(segment) {
        // Find which block group this segment is in and return its crash frequency score
        const blockGroup = this.findContainingBlockGroup(segment);
        if (!blockGroup || !blockGroup.properties.crash_count) {
            return 0; // No data available
        }

        const crashCount = parseInt(blockGroup.properties.crash_count);
        if (isNaN(crashCount)) return 0;

        // Normalize crash count to 0-10 scale using 2200 crashes for better distribution
        const maxCrashes = 2200; // Areas with 2200+ crashes get full score
        const normalizedCrashes = Math.min(1, crashCount / maxCrashes);

        // Score based on direction preference
        const direction = this.config.features.crashes.direction || 'lower';

        if (direction === 'lower') {
            // Lower crash frequency is better (safer area)
            return Math.max(0, 10 - normalizedCrashes * 10);
        } else {
            // Higher crash frequency is better (more improvement potential)
            return normalizedCrashes * 10;
        }
    }

    findContainingBlockGroup(segment) {
        // Find which block group contains the segment center
        if (!this.datasets.has('block_groups_with_census')) {
            return null;
        }

        const blockGroups = this.datasets.get('block_groups_with_census');
        const segmentCenter = turf.centroid(segment.geometry);

        for (const feature of blockGroups.features) {
            if (turf.booleanPointInPolygon(segmentCenter, feature)) {
                return feature;
            }
        }

        return null; // Not found in any block group
    }

    scoreTransitStopDensity(segment) {
        const radiusMiles = this.config.features.transitDensity.radius;
        let totalStops = 0;

        // Count CTA bus stops
        if (this.datasets.has('cta_bus_stops')) {
            totalStops += this.calculateDensityInRadius(segment, 'cta_bus_stops', radiusMiles, 'count');
        }

        // Count Pace bus stops
        if (this.datasets.has('pace_bus_stops')) {
            totalStops += this.calculateDensityInRadius(segment, 'pace_bus_stops', radiusMiles, 'count');
        }

        // Normalize to 0-10 scale and apply direction
        // Adjust max to get better distribution - only ~5 segments should get perfect scores
        const maxStops = 80;
        const normalizedStops = Math.min(1, totalStops / maxStops);

        const direction = this.config.features.transitDensity.direction || 'higher';
        let score;
        if (direction === 'lower') {
            // For "lower is better", use inverse scoring but avoid giving perfect scores to zero values
            // Scale so that areas with 0-5 stops get high scores, but not perfect 10s
            const adjustedStops = Math.max(1, totalStops); // Minimum of 1 to avoid perfect scores for 0
            const adjustedNormalized = Math.min(1, adjustedStops / maxStops);
            score = (1 - adjustedNormalized) * 10;
        } else {
            score = normalizedStops * 10; // Higher is better
        }

        // Safety check for valid score
        if (isNaN(score) || !isFinite(score)) {
            return 0;
        }

        return Math.max(0, Math.min(10, score)); // Clamp to 0-10 range
    }

    scoreBikeNetworkConnectivity(segment) {
        const radiusMiles = this.config.features.bikeNetwork.radius;

        // Use custom calculation for bike routes to properly handle the mi_ctrline property
        let totalMiles = 0;
        if (this.datasets.has('bike_routes')) {
            const dataset = this.datasets.get('bike_routes');
            const segmentCenter = turf.point(segment.properties.center);
            const radiusKm = radiusMiles * 1.60934; // Convert miles to km for Turf.js
            const searchBuffer = turf.buffer(segmentCenter, radiusKm, { units: 'kilometers' });

            for (const feature of dataset.features) {
                try {
                    if (turf.booleanIntersects(feature, searchBuffer)) {
                        // Use the mi_ctrline property if available, otherwise calculate length
                        const mileage = feature.properties.mi_ctrline ?
                            parseFloat(feature.properties.mi_ctrline) :
                            turf.length(feature, { units: 'miles' });
                        totalMiles += mileage;
                    }
                } catch (error) {
                    // Skip invalid geometries
                    continue;
                }
            }
        }


        // Normalize to 0-10 scale and apply direction
        // Based on dataset analysis, adjust max for better distribution
        const maxMiles = 5;
        const normalizedMiles = Math.min(1, totalMiles / maxMiles);

        const direction = this.config.features.bikeNetwork.direction || 'higher';
        let score;
        if (direction === 'lower') {
            // For "lower is better", use inverse scoring but avoid giving perfect scores to zero values
            // Scale so that areas with 0-0.5 miles get high scores, but not perfect 10s
            const adjustedMiles = Math.max(0.1, totalMiles); // Minimum of 0.1 to avoid perfect scores for 0
            const adjustedNormalized = Math.min(1, adjustedMiles / maxMiles);
            score = (1 - adjustedNormalized) * 10;
        } else {
            score = normalizedMiles * 10; // Higher is better
        }

        // Safety check for valid score
        if (isNaN(score) || !isFinite(score)) {
            return 0;
        }

        return Math.max(0, Math.min(10, score)); // Clamp to 0-10 range
    }


    // =================================================================
    // GENERIC PROXIMITY UTILITY FUNCTIONS
    // =================================================================

    /**
     * Normalize any "line-like" thing to an array of LineString features
     * @param {Object} lineLike - Polygon, MultiPolygon, LineString, MultiLineString, or FeatureCollection
     * @returns {Array} Array of LineString features
     */
    toLineStrings(lineLike) {
        const out = [];

        // If it's a Polygon/MultiPolygon, convert first
        let f = lineLike;
        if (
            f && f.type === 'Feature' &&
            (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon')
        ) {
            f = turf.polygonToLine(f);
        }

        // Flatten anything (Feature, Multi*, FeatureCollection) down to LineStrings
        turf.flattenEach(f, ls => {
            if (ls.geometry.type === 'LineString') {
                out.push(ls);
            } else if (ls.geometry.type === 'MultiLineString') {
                for (const coords of ls.geometry.coordinates) {
                    out.push(turf.lineString(coords));
                }
            }
        });

        return out;
    }

    /**
     * Minimum distance from a Point to any LineString in a "line-like"
     * @param {Object} point - Point feature
     * @param {Object} lineLike - Line-like feature (can be Multi*, FeatureCollection, etc.)
     * @returns {number} Minimum distance in miles
     */
    minPointToAnyLineMiles(point, lineLike) {
        let min = Infinity;
        for (const ls of this.toLineStrings(lineLike)) {
            const d = turf.pointToLineDistance(point, ls, { units: 'miles' });
            if (d < min) min = d;
        }
        return min;
    }

    /**
     * Minimum boundary-to-boundary distance (miles) between a polygon feature and the segment polygon
     * @param {Object} polyFeature - Polygon or MultiPolygon feature
     * @param {Object} segmentPolygon - Segment rectangle polygon
     * @returns {number} Minimum distance in miles between boundaries
     */
    minBoundaryDistanceMiles(polyFeature, segmentPolygon) {
        const segLines = this.toLineStrings(turf.polygonToLine(segmentPolygon));
        const polyLines = this.toLineStrings(turf.polygonToLine(polyFeature));

        // Explode to vertices
        const polyVerts = turf.explode(polyFeature).features;
        const segVerts = segLines.flatMap(ls => turf.explode(ls).features);

        let min = Infinity;

        // polygon vertices -> segment boundary
        for (const pt of polyVerts) {
            for (const ls of segLines) {
                const d = turf.pointToLineDistance(pt, ls, { units: 'miles' });
                if (d < min) min = d;
            }
        }

        // segment vertices -> polygon boundary
        for (const pt of segVerts) {
            for (const ls of polyLines) {
                const d = turf.pointToLineDistance(pt, ls, { units: 'miles' });
                if (d < min) min = d;
            }
        }

        return min;
    }

    /**
     * Calculate proximity score to point features (CTA stations, hospitals, schools, etc.)
     * Uses distance from point to segment boundary for more accurate proximity measurement
     * @param {Object} segment - Segment object with geometry (rectangle polygon)
     * @param {string} datasetKey - Key for dataset in this.datasets
     * @param {number} radiusMiles - Maximum distance to consider (linear decay to 0)
     * @returns {number} Score 0-10, where 10 = point on segment boundary, 0 = at radius or beyond
     */
    /**
     * Calculate nearest distance from segment to any point in the dataset
     * @param {Object} segment - Segment object with geometry (rectangle polygon)
     * @param {string} datasetKey - Key for dataset in this.datasets
     * @returns {number} Distance in miles to nearest point (Infinity if no points found)
     */
    getNearestPointDistance(segment, datasetKey) {
        if (!this.datasets.has(datasetKey)) return Infinity;

        const dataset = this.datasets.get(datasetKey);
        const segmentGeometry = segment.geometry;

        let nearestDistance = Infinity;

        for (const feature of dataset.features) {
            if (feature.geometry.type !== 'Point') continue;

            let distance;
            try {
                // Check if point is inside segment first (distance = 0)
                if (turf.booleanPointInPolygon(feature, segmentGeometry)) {
                    distance = 0;
                } else {
                    // Calculate distance from point to segment boundary
                    const segBoundary = turf.polygonToLine(segmentGeometry);
                    const nearestOnSeg = turf.nearestPointOnLine(segBoundary, feature);
                    distance = turf.distance(nearestOnSeg, feature, { units: 'miles' });
                }
            } catch (error) {
                // Fallback to centroid distance
                console.log(`[Proximity] Fallback to centroid for point feature in ${datasetKey}:`, error.message);
                const segmentCenter = turf.point(segment.properties.center);
                const featurePoint = turf.point(feature.geometry.coordinates);
                distance = turf.distance(segmentCenter, featurePoint, { units: 'miles' });
            }

            if (distance < nearestDistance) {
                nearestDistance = distance;
            }
        }

        return nearestDistance;
    }

    calculateProximityToPoints(segment, datasetKey, radiusMiles) {
        const nearestDistance = this.getNearestPointDistance(segment, datasetKey);

        if (nearestDistance === Infinity) return 0;

        // Linear decay: score = max(0, 1 - distance/radius)
        const score = Math.max(0, 1 - (nearestDistance / radiusMiles));
        return score * 10; // Scale to 0-10
    }

    /**
     * Calculate nearest distance from segment to any polygon in the dataset
     * @param {Object} segment - Segment object with geometry (rectangle polygon)
     * @param {string} datasetKey - Key for dataset in this.datasets
     * @returns {number} Distance in miles to nearest polygon (Infinity if no polygons found)
     */
    getNearestPolygonDistance(segment, datasetKey) {
        if (!this.datasets.has(datasetKey)) return Infinity;

        const dataset = this.datasets.get(datasetKey);
        const segmentGeometry = segment.geometry;

        let nearestDistance = Infinity;

        for (const feature of dataset.features) {
            let distance;

            if (feature.geometry.type === 'Polygon') {
                try {
                    // Check if geometries overlap first (distance = 0)
                    if (turf.booleanIntersects(segmentGeometry, feature)) {
                        distance = 0;
                    } else {
                        // Calculate boundary-to-boundary distance using vertex-to-line method
                        distance = this.minBoundaryDistanceMiles(feature, segmentGeometry);
                    }
                } catch (error) {
                    // Fallback to centroid-to-centroid distance
                    console.log(`[Proximity] Fallback to centroid for polygon feature in ${datasetKey}:`, error.message);
                    const segmentCenter = turf.point(segment.properties.center);
                    const featureCenter = turf.centroid(feature);
                    distance = turf.distance(segmentCenter, featureCenter, { units: 'miles' });
                }
            } else if (feature.geometry.type === 'MultiPolygon') {
                try {
                    // Check if any polygon part overlaps with segment
                    if (turf.booleanIntersects(segmentGeometry, feature)) {
                        distance = 0;
                    } else {
                        // Process each polygon part in the MultiPolygon
                        distance = Infinity;
                        for (const polygonCoords of feature.geometry.coordinates) {
                            // Create individual polygon from coordinates
                            const individualPolygon = turf.polygon(polygonCoords);
                            try {
                                const partDistance = this.minBoundaryDistanceMiles(individualPolygon, segmentGeometry);
                                if (partDistance < distance) {
                                    distance = partDistance;
                                }
                            } catch (partError) {
                                // If individual polygon processing fails, try centroid distance
                                console.log(`[Proximity] Fallback to centroid for MultiPolygon part in ${datasetKey}:`, partError.message);
                                const partCenter = turf.centroid(individualPolygon);
                                const segmentCenter = turf.point(segment.properties.center);
                                const partDistance = turf.distance(segmentCenter, partCenter, { units: 'miles' });

                                if (partDistance < distance) {
                                    distance = partDistance;
                                }
                            }
                        }
                    }
                } catch (error) {
                    // Fallback to centroid-to-centroid distance for entire MultiPolygon
                    console.log(`[Proximity] Fallback to centroid for MultiPolygon feature in ${datasetKey}:`, error.message);
                    const segmentCenter = turf.point(segment.properties.center);
                    const featureCenter = turf.centroid(feature);
                    distance = turf.distance(segmentCenter, featureCenter, { units: 'miles' });
                }
            } else if (feature.geometry.type === 'Point') {
                // Handle point features in polygon datasets - distance from point to segment boundary
                try {
                    const segBoundary = turf.polygonToLine(segmentGeometry);
                    const nearestOnSeg = turf.nearestPointOnLine(segBoundary, feature);
                    distance = turf.distance(nearestOnSeg, feature, { units: 'miles' });
                } catch (error) {
                    // Fallback to centroid distance
                    console.log(`[Proximity] Fallback to centroid for point in polygon dataset ${datasetKey}:`, error.message);
                    const segmentCenter = turf.point(segment.properties.center);
                    distance = turf.distance(segmentCenter, feature, { units: 'miles' });
                }
            } else {
                continue; // Skip unsupported geometry types
            }

            if (distance < nearestDistance) {
                nearestDistance = distance;
            }
        }

        return nearestDistance;
    }

    /**
     * Calculate proximity score to polygon features (parks, neighborhoods, districts, etc.)
     * Uses boundary-to-boundary distance between segment rectangle and polygon features
     * @param {Object} segment - Segment object with geometry (rectangle polygon)
     * @param {string} datasetKey - Key for dataset in this.datasets
     * @param {number} radiusMiles - Maximum distance to consider (linear decay to 0)
     * @returns {number} Score 0-10, where 10 = overlapping, 0 = at radius or beyond
     */
    calculateProximityToPolygons(segment, datasetKey, radiusMiles) {
        const nearestDistance = this.getNearestPolygonDistance(segment, datasetKey);

        if (nearestDistance === Infinity) return 0;

        // Linear decay: score = max(0, 1 - distance/radius)
        const score = Math.max(0, 1 - (nearestDistance / radiusMiles));
        return score * 10; // Scale to 0-10
    }

    /**
     * Calculate density score within radius (bus stops, bike routes, sidewalks, etc.)
     * @param {Object} segment - Segment object with properties.center
     * @param {string} datasetKey - Key for dataset in this.datasets
     * @param {number} radiusMiles - Radius to search within
     * @param {string} metric - 'count' for point count, 'length' for line length, 'area' for polygon area
     * @returns {number} Raw metric value (will be normalized later using 5th-95th percentile)
     */
    calculateDensityInRadius(segment, datasetKey, radiusMiles, metric = 'count') {
        if (!this.datasets.has(datasetKey)) return 0;

        const dataset = this.datasets.get(datasetKey);
        const segmentCenter = turf.point(segment.properties.center);
        const radiusKm = radiusMiles * 1.60934; // Convert miles to km for Turf.js
        const searchBuffer = turf.buffer(segmentCenter, radiusKm, { units: 'kilometers' });

        let totalValue = 0;

        for (const feature of dataset.features) {
            // Check if feature intersects with search buffer
            let intersects = false;
            try {
                intersects = turf.booleanIntersects(feature, searchBuffer);
            } catch (error) {
                // Skip invalid geometries
                continue;
            }

            if (!intersects) continue;

            // Calculate metric based on type
            switch (metric) {
                case 'count':
                    totalValue += 1;
                    break;

                case 'length':
                    if (feature.geometry.type === 'LineString' || feature.geometry.type === 'MultiLineString') {
                        totalValue += turf.length(feature, { units: 'miles' });
                    }
                    break;

                case 'area':
                    if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
                        totalValue += turf.area(feature) * 0.000000386102; // Convert sq meters to sq miles
                    }
                    break;
            }
        }

        return totalValue;
    }

    // =================================================================
    // REQUIREMENT FILTER METHODS
    // =================================================================

    /**
     * Apply Station-Proximity Gate: Exclude segments farther than threshold from all CTA, Metra, and Amtrak stations
     */
    applyStationProximityGate() {
        const maxDistanceMiles = this.config.requirements.stationProximity.distance;

        // Collect all station datasets
        const stationDatasets = [];
        if (this.datasets.has('cta_rail_stations')) {
            stationDatasets.push(this.datasets.get('cta_rail_stations'));
        }
        if (this.datasets.has('metra_stations')) {
            stationDatasets.push(this.datasets.get('metra_stations'));
        }
        if (this.datasets.has('amtrak_stations')) {
            stationDatasets.push(this.datasets.get('amtrak_stations'));
        }

        if (stationDatasets.length === 0) {
            console.warn('No station datasets available for Station-Proximity Gate');
            return;
        }

        // Combine all stations into one array
        const allStations = [];
        stationDatasets.forEach(dataset => {
            dataset.features.forEach(station => {
                if (station.geometry.type === 'Point') {
                    allStations.push(station);
                }
            });
        });

        console.log(`Applying Station-Proximity Gate with ${allStations.length} stations, max distance ${maxDistanceMiles} miles`);

        let excludedCount = 0;
        for (const segment of this.segments) {
            if (!segment.eligible) continue;

            // Find minimum distance from segment center to any station
            let minDistance = Infinity;
            const segmentCenter = turf.point(segment.properties.center);

            for (const station of allStations) {
                const distance = turf.distance(segmentCenter, station, { units: 'miles' });
                if (distance < minDistance) {
                    minDistance = distance;
                }
            }

            // Exclude if farther than threshold from ALL stations
            if (minDistance > maxDistanceMiles) {
                segment.eligible = false;
                excludedCount++;
            }
        }

        console.log(`Station-Proximity Gate excluded ${excludedCount} segments`);
    }

    /**
     * Apply Neighborhood filters: Only include segments in selected neighborhoods
     */
    applyNeighborhoodFilters() {
        const selectedNeighborhoods = this.config.requirements.neighborhoods.selected || [];

        if (selectedNeighborhoods.length === 0) {
            console.log('No neighborhoods selected for filtering');
            return;
        }

        this.applyPolygonIntersectionFilter(
            'neighborhoods',
            `neighborhood filters: ${selectedNeighborhoods.length} neighborhoods`,
            (segment, neighborhood) => {
                const neighborhoodName = neighborhood.properties.pri_neigh ||
                                       neighborhood.properties.neighborhood ||
                                       neighborhood.properties.name ||
                                       neighborhood.properties.COMMUNITY ||
                                       neighborhood.properties.PRI_NEIGH ||
                                       '';

                if (selectedNeighborhoods.includes(neighborhoodName)) {
                    return this.segmentIntersectsPolygon(segment, neighborhood);
                }
                return false;
            }
        );
    }

    /**
     * Apply Zoning Allowlist: Only include segments that intersect with allowed zoning categories
     */
    applyZoningAllowlist() {
        const allowedCategories = this.config.requirements.zoning.allowed || [];

        if (allowedCategories.length === 0) {
            console.log('No zoning categories selected - excluding all segments');
            // If no categories allowed, exclude all segments
            this.segments.forEach(segment => {
                if (segment.eligible) segment.eligible = false;
            });
            return;
        }

        this.applyPolygonIntersectionFilter(
            'zoning_districts',
            `zoning allowlist: ${allowedCategories.join(', ')}`,
            (segment, zoningPolygon) => {
                const zoneClass = zoningPolygon.properties.zone_class || '';
                const zoningCategory = this.categorizeZoning(zoneClass);

                if (allowedCategories.includes(zoningCategory)) {
                    return this.segmentIntersectsPolygon(segment, zoningPolygon);
                }
                return false;
            }
        );
    }

    /**
     * Categorize zoning code into broad categories
     */
    categorizeZoning(zoneClass) {
        if (!zoneClass) return 'other';

        const zoneClassUpper = zoneClass.toUpperCase();

        // Residential zones
        if (zoneClass.match(/^R[SMT]/)) return 'residential';

        // Business zones
        if (zoneClass.match(/^B[123]/)) return 'business';

        // Commercial zones
        if (zoneClass.match(/^C[123]/)) return 'commercial';

        // Downtown zones
        if (zoneClass.match(/^D[CRSX]/)) return 'downtown';

        // Industrial zones
        if (zoneClass.match(/^M[123]/)) return 'industrial';

        // Planned development zones
        if (zoneClass.match(/^P[MD]/)) return 'planned';

        // Other zones (POS, T, etc.)
        return 'other';
    }

    /**
     * Apply Bridge Condition Gate: Exclude segments where nearest bridge age > threshold
     */
    applyBridgeConditionGate() {
        const ageThreshold = this.config.requirements.bridgeAge.threshold || 80;

        if (!this.datasets.has('bridges')) {
            console.warn('Bridges dataset not available for bridge condition filtering');
            return;
        }

        console.log(`Applying bridge condition gate (max age: ${ageThreshold} years)`);

        let excludedCount = 0;

        for (const segment of this.segments) {
            if (!segment.eligible) continue;

            // Use the proper proximity calculation to get distance to nearest bridge
            const nearestBridgeDistance = this.getNearestPointDistance(segment, 'bridges');

            if (nearestBridgeDistance === Infinity) {
                // No bridges found, segment remains eligible
                continue;
            }

            // Find the age of the nearest bridge
            const bridges = this.datasets.get('bridges');
            let nearestBridgeAge = null;
            let shortestDistance = Infinity;

            for (const bridge of bridges.features) {
                if (bridge.geometry.type !== 'Point') continue;

                const bridgeAge = bridge.properties.age;

                // Skip bridges with unknown age (they don't exclude segments)
                if (bridgeAge === null || bridgeAge === undefined || isNaN(bridgeAge)) {
                    continue;
                }

                // Calculate distance to this specific bridge
                let distance;
                try {
                    if (turf.booleanPointInPolygon(bridge, segment.geometry)) {
                        distance = 0;
                    } else {
                        const segBoundary = turf.polygonToLine(segment.geometry);
                        const nearestOnSeg = turf.nearestPointOnLine(segBoundary, bridge);
                        distance = turf.distance(nearestOnSeg, bridge, { units: 'miles' });
                    }
                } catch (error) {
                    const segmentCenter = turf.point(segment.properties.center);
                    const featurePoint = turf.point(bridge.geometry.coordinates);
                    distance = turf.distance(segmentCenter, featurePoint, { units: 'miles' });
                }

                // Track the age of the actual nearest bridge
                if (distance < shortestDistance) {
                    shortestDistance = distance;
                    nearestBridgeAge = bridgeAge;
                }
            }

            // Exclude segment if nearest bridge exceeds age threshold
            if (nearestBridgeAge !== null && nearestBridgeAge > ageThreshold) {
                segment.eligible = false;
                excludedCount++;
            }
        }

        console.log(`Bridge condition gate excluded ${excludedCount} segments (nearest bridge > ${ageThreshold} years)`);
    }

    /**
     * Generic intersection filter: Apply filtering based on polygon intersection logic
     * @param {string} datasetKey - Key of the dataset to check against
     * @param {string} filterName - Human readable name for logging
     * @param {Function} polygonTest - Function that takes (segment, polygon) and returns boolean if should include segment
     */
    applyPolygonIntersectionFilter(datasetKey, filterName, polygonTest) {
        if (!this.datasets.has(datasetKey)) {
            console.warn(`${filterName} dataset not available for filtering`);
            return;
        }

        const dataset = this.datasets.get(datasetKey);
        console.log(`Applying ${filterName}`);

        let excludedCount = 0;
        for (const segment of this.segments) {
            if (!segment.eligible) continue;

            let shouldInclude = false;

            // Check if segment meets criteria with any polygon in the dataset
            for (const polygon of dataset.features) {
                if (polygonTest(segment, polygon)) {
                    shouldInclude = true;
                    break;
                }
            }

            // Exclude segment if it doesn't meet criteria
            if (!shouldInclude) {
                segment.eligible = false;
                excludedCount++;
            }
        }

        console.log(`${filterName} excluded ${excludedCount} segments`);
    }

    /**
     * Helper: Check if segment intersects with polygon (with fallback)
     */
    segmentIntersectsPolygon(segment, polygon) {
        try {
            return turf.booleanIntersects(segment.geometry, polygon);
        } catch (error) {
            // Fallback to point-in-polygon check using segment center
            const segmentCenter = turf.point(segment.properties.center);
            return turf.booleanPointInPolygon(segmentCenter, polygon);
        }
    }

    calculateFinalScores() {
        const eligibleSegments = this.segments.filter(s => s.eligible);
        const results = [];

        for (const segment of eligibleSegments) {
            let weightedSum = 0;
            let totalWeight = 0;

            // CTA Stations
            if (segment.scores.ctaStations !== undefined) {
                const weight = this.config.features.ctaStations.weight;
                weightedSum += segment.scores.ctaStations * weight;
                totalWeight += weight;
            }

            // Metra Stations
            if (segment.scores.metraStations !== undefined) {
                const weight = this.config.features.metraStations.weight;
                weightedSum += segment.scores.metraStations * weight;
                totalWeight += weight;
            }

            // Amtrak Stations
            if (segment.scores.amtrakStations !== undefined) {
                const weight = this.config.features.amtrakStations.weight;
                weightedSum += segment.scores.amtrakStations * weight;
                totalWeight += weight;
            }

            // Parks
            if (segment.scores.parks !== undefined) {
                const weight = this.config.features.parks.weight;
                weightedSum += segment.scores.parks * weight;
                totalWeight += weight;
            }

            // Public Schools
            if (segment.scores.publicSchools !== undefined) {
                const weight = this.config.features.publicSchools.weight;
                weightedSum += segment.scores.publicSchools * weight;
                totalWeight += weight;
            }

            // Private Schools
            if (segment.scores.privateSchools !== undefined) {
                const weight = this.config.features.privateSchools.weight;
                weightedSum += segment.scores.privateSchools * weight;
                totalWeight += weight;
            }

            // Colleges
            if (segment.scores.colleges !== undefined) {
                const weight = this.config.features.colleges.weight;
                weightedSum += segment.scores.colleges * weight;
                totalWeight += weight;
            }

            // Hospitals
            if (segment.scores.hospitals !== undefined) {
                const weight = this.config.features.hospitals.weight;
                weightedSum += segment.scores.hospitals * weight;
                totalWeight += weight;
            }

            // Landmarks
            if (segment.scores.landmarks !== undefined) {
                const weight = this.config.features.landmarks.weight;
                weightedSum += segment.scores.landmarks * weight;
                totalWeight += weight;
            }

            // Stadiums
            if (segment.scores.stadiums !== undefined) {
                const weight = this.config.features.stadiums.weight;
                weightedSum += segment.scores.stadiums * weight;
                totalWeight += weight;
            }

            // SSA
            if (segment.scores.ssa !== undefined) {
                const weight = this.config.features.ssa.weight;
                weightedSum += segment.scores.ssa * weight;
                totalWeight += weight;
            }

            // TIF
            if (segment.scores.tif !== undefined) {
                const weight = this.config.features.tif.weight;
                weightedSum += segment.scores.tif * weight;
                totalWeight += weight;
            }

            // Medical District
            if (segment.scores.medicalDistrict !== undefined) {
                const weight = this.config.features.medicalDistrict.weight;
                weightedSum += segment.scores.medicalDistrict * weight;
                totalWeight += weight;
            }

            // Neighborhood Center
            if (segment.scores.neighborhoodCenter !== undefined) {
                const weight = this.config.features.neighborhoodCenter.weight;
                weightedSum += segment.scores.neighborhoodCenter * weight;
                totalWeight += weight;
            }

            // Bridges
            if (segment.scores.bridges !== undefined) {
                const weight = this.config.features.bridges.weight;
                weightedSum += segment.scores.bridges * weight;
                totalWeight += weight;
            }

            // ADI of Block Group
            if (segment.scores.adi !== undefined) {
                const weight = this.config.features.adi.weight;
                weightedSum += segment.scores.adi * weight;
                totalWeight += weight;
            }

            // Crash Frequency
            if (segment.scores.crashes !== undefined) {
                const weight = this.config.features.crashes.weight;
                weightedSum += segment.scores.crashes * weight;
                totalWeight += weight;
            }

            // Transit Stop Density
            if (segment.scores.transitDensity !== undefined) {
                const weight = this.config.features.transitDensity.weight;
                weightedSum += segment.scores.transitDensity * weight;
                totalWeight += weight;
            }

            // Bike Network Connectivity
            if (segment.scores.bikeNetwork !== undefined) {
                const weight = this.config.features.bikeNetwork.weight;
                weightedSum += segment.scores.bikeNetwork * weight;
                totalWeight += weight;
            }


            // Calculate final score (0-100)
            const finalScore = totalWeight > 0 ? (weightedSum / totalWeight) * 10 : 0;

            results.push({
                id: segment.id,
                score: finalScore,
                freeway: segment.properties.freeway,
                length_ft: segment.properties.length_ft,
                center: segment.properties.center,
                geometry: segment.geometry,
                featureScores: { ...segment.scores }
            });
        }

        // Sort by score (highest first)
        results.sort((a, b) => b.score - a.score);

        // Add rank
        results.forEach((result, index) => {
            result.rank = index + 1;
        });

        return results;
    }

    getRandomFeatureCoordinates(minCount, maxCount) {
        // Get random features from various datasets for visual animation
        const featureCoordinates = [];
        const datasetKeys = [
            'cta_rail_stations', 'metra_stations', 'amtrak_stations',
            'parks', 'public_schools', 'private_schools', 'colleges_universities',
            'hospitals', 'landmarks', 'stadiums', 'bridges'
        ];

        // Randomly select how many features to pick (between min and max)
        const targetCount = minCount + Math.floor(Math.random() * (maxCount - minCount + 1));

        // Try to get random features
        let attempts = 0;
        while (featureCoordinates.length < targetCount && attempts < 20) {
            attempts++;

            // Pick a random dataset
            const randomDatasetKey = datasetKeys[Math.floor(Math.random() * datasetKeys.length)];
            const dataset = this.datasets.get(randomDatasetKey);

            if (!dataset || !dataset.features || dataset.features.length === 0) continue;

            // Pick a random feature from that dataset
            const randomFeature = dataset.features[Math.floor(Math.random() * dataset.features.length)];
            if (!randomFeature || !randomFeature.geometry) continue;

            // Extract coordinates based on geometry type
            let coords = null;
            if (randomFeature.geometry.type === 'Point') {
                coords = randomFeature.geometry.coordinates;
            } else if (randomFeature.geometry.type === 'Polygon') {
                // Use first coordinate of outer ring (approximation)
                coords = randomFeature.geometry.coordinates[0][0];
            } else if (randomFeature.geometry.type === 'MultiPolygon') {
                // Use first coordinate of first polygon
                coords = randomFeature.geometry.coordinates[0][0][0];
            } else if (randomFeature.geometry.type === 'LineString') {
                // Use midpoint of line
                const midIdx = Math.floor(randomFeature.geometry.coordinates.length / 2);
                coords = randomFeature.geometry.coordinates[midIdx];
            }

            if (coords && Array.isArray(coords) && coords.length >= 2) {
                featureCoordinates.push(coords);
            }
        }

        return featureCoordinates;
    }

    postProgress(percentage, message, data = {}) {
        postMessage({
            type: 'progress',
            data: {
                percentage,
                message,
                ...data
            }
        });
    }
}

// Worker message handler
const analysisEngine = new AnalysisEngine();

self.onmessage = async function(e) {
    const { type, data } = e.data;

    switch (type) {
        case 'start':
            await analysisEngine.runAnalysis(data.config, data.datasets);
            break;

        default:
            postMessage({
                type: 'error',
                data: { message: `Unknown message type: ${type}` }
            });
    }
};