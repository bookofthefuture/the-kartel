/**
 * Blob Store Factory Utility
 * 
 * Provides centralized blob store creation and configuration to eliminate
 * code duplication across serverless functions.
 */

const { getStore } = require('@netlify/blobs');

/**
 * Validates required environment variables for blob store access
 * @returns {object} { success: boolean, error?: string }
 */
function validateEnvironment() {
    if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_ACCESS_TOKEN) {
        return {
            success: false,
            error: 'Server configuration error'
        };
    }
    return { success: true };
}

/**
 * Creates a configured blob store instance
 * @param {string} storeName - Name of the blob store (e.g., 'events', 'applications')
 * @param {object} options - Optional configuration overrides
 * @returns {object} Configured blob store instance
 */
function createBlobStore(storeName, options = {}) {
    const envCheck = validateEnvironment();
    if (!envCheck.success) {
        throw new Error(envCheck.error);
    }

    const defaultConfig = {
        name: storeName,
        siteID: process.env.NETLIFY_SITE_ID,
        token: process.env.NETLIFY_ACCESS_TOKEN,
        consistency: 'strong'
    };

    return getStore({
        ...defaultConfig,
        ...options
    });
}

/**
 * Factory function to create multiple blob stores at once
 * @param {string[]} storeNames - Array of store names to create
 * @param {object} options - Optional configuration overrides
 * @returns {object} Object with store names as keys and store instances as values
 */
function createBlobStores(storeNames, options = {}) {
    const envCheck = validateEnvironment();
    if (!envCheck.success) {
        throw new Error(envCheck.error);
    }

    const stores = {};
    for (const storeName of storeNames) {
        stores[`${storeName}Store`] = createBlobStore(storeName, options);
    }
    return stores;
}

/**
 * Predefined store creators for common use cases
 */
const StoreTypes = {
    // Core data stores
    APPLICATIONS: 'applications',
    EVENTS: 'events', 
    VENUES: 'venues',
    MEMBERS: 'members',
    
    // Media stores
    PHOTOS: 'photos',
    GALLERY: 'gallery',
    VIDEOS: 'videos',
    
    // Auth and session stores
    TOKENS: 'tokens',
    PUSH_SUBSCRIPTIONS: 'push-subscriptions',
    
    // Configuration stores
    FAQS: 'faqs',
    CITY_CONFIG: 'city-config'
};

/**
 * Convenience functions for common store combinations
 */
const CommonStoreGroups = {
    /**
     * Creates stores commonly used in admin functions
     */
    createAdminStores() {
        return createBlobStores([
            StoreTypes.APPLICATIONS,
            StoreTypes.EVENTS,
            StoreTypes.VENUES,
            StoreTypes.MEMBERS
        ]);
    },

    /**
     * Creates stores commonly used in member functions
     */
    createMemberStores() {
        return createBlobStores([
            StoreTypes.EVENTS,
            StoreTypes.VENUES,
            StoreTypes.MEMBERS
        ]);
    },

    /**
     * Creates stores for media management
     */
    createMediaStores() {
        return createBlobStores([
            StoreTypes.PHOTOS,
            StoreTypes.GALLERY,
            StoreTypes.VIDEOS
        ]);
    },

    /**
     * Creates stores for authentication
     */
    createAuthStores() {
        return createBlobStores([
            StoreTypes.TOKENS,
            StoreTypes.MEMBERS
        ]);
    }
};

module.exports = {
    validateEnvironment,
    createBlobStore,
    createBlobStores,
    StoreTypes,
    CommonStoreGroups
};