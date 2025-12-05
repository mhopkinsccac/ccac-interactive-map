// Chicago Freeway Cap Analysis Tool - Main Application
import MapComponent from './map.js';
import StateManager from './state.js';
import UIController from './ui.js';

class ChicagoFreewayApp {
    constructor() {
        this.mapComponent = null;
        this.stateManager = null;
        this.uiController = null;
        this.mapboxToken = 'pk.eyJ1IjoibWhvcGtpbnNjY2FjIiwiYSI6ImNtaXQ4Zmc2MDE4c2kzZXB3eXk4NjI4MGIifQ.adxLmbl7wfdizEnaZrujxQ'; // Replace with your Mapbox API key
        this.screenshotMode = false;
    }

    async init() {
        try {
            console.log('🗺️ Initializing Chicago Freeway Cap Analysis Tool...');

            // Show loading overlay
            this.showLoading('Initializing application...');

            // Initialize state manager
            this.stateManager = new StateManager();

            // Initialize map component
            this.mapComponent = new MapComponent('map', this.mapboxToken, this.stateManager);
            await this.mapComponent.init();

            // Initialize UI controller
            this.uiController = new UIController(this.mapComponent, this.stateManager);
            await this.uiController.init();

            // Set up keyboard controls
            this.setupKeyboardControls();

            console.log('✅ Application initialized successfully');
            this.hideLoading();

        } catch (error) {
            console.error('❌ Failed to initialize application:', error);
            this.showError('Failed to initialize the application. Please refresh the page and try again.');
        }
    }

    setupKeyboardControls() {
        document.addEventListener('keydown', (event) => {
            // Ignore if user is typing in an input field
            if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
                return;
            }

            switch (event.key.toLowerCase()) {
                case 'r':
                    // Rotate view
                    event.preventDefault();
                    this.mapComponent.rotateView();
                    break;
                case 'p':
                    // Toggle pitch
                    event.preventDefault();
                    this.mapComponent.togglePitch();
                    break;
                case 's':
                    // Toggle screenshot mode
                    event.preventDefault();
                    this.toggleScreenshotMode();
                    break;
            }
        });
    }

    toggleScreenshotMode() {
        this.screenshotMode = !this.screenshotMode;
        const appContainer = document.getElementById('app');

        if (this.screenshotMode) {
            // Enable screenshot mode - horizontal paper aspect ratio (11:8.5)
            appContainer.classList.add('screenshot-mode');
            console.log('📸 Screenshot mode enabled');
        } else {
            // Disable screenshot mode
            appContainer.classList.remove('screenshot-mode');
            console.log('📸 Screenshot mode disabled');
        }

        // Trigger map resize to fit new container
        if (this.mapComponent && this.mapComponent.map) {
            setTimeout(() => {
                this.mapComponent.map.resize();
            }, 100);
        }
    }

    showLoading(message = 'Loading...') {
        const loadingOverlay = document.getElementById('loading-overlay');
        const loadingText = document.getElementById('loading-text');

        if (loadingText) {
            loadingText.textContent = message;
        }

        if (loadingOverlay) {
            loadingOverlay.classList.remove('hidden');
        }
    }

    hideLoading() {
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.classList.add('hidden');
        }
    }

    showError(message) {
        console.error(message);

        // Create error modal
        const errorModal = document.createElement('div');
        errorModal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        errorModal.innerHTML = `
            <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <div class="flex items-center mb-4">
                    <div class="flex-shrink-0">
                        <svg class="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                    </div>
                    <div class="ml-3">
                        <h3 class="text-lg font-medium text-gray-900">Error</h3>
                    </div>
                </div>
                <div class="mt-2">
                    <p class="text-sm text-gray-500">${message}</p>
                </div>
                <div class="mt-5 sm:mt-6">
                    <button type="button" onclick="location.reload()"
                            class="inline-flex justify-center w-full rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:text-sm">
                        Refresh Page
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(errorModal);
    }
}

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const app = new ChicagoFreewayApp();
    app.init();

    // Make app available globally for debugging
    window.chicagoApp = app;
});

export default ChicagoFreewayApp;