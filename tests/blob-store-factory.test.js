/**
 * Tests for blob-store-factory.js utility
 */

const { 
    validateEnvironment,
    createBlobStore,
    createBlobStores,
    StoreTypes,
    CommonStoreGroups
} = require('../netlify/functions/blob-store-factory');

// Mock @netlify/blobs
jest.mock('@netlify/blobs', () => ({
    getStore: jest.fn()
}));

const { getStore } = require('@netlify/blobs');

describe('Blob Store Factory', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...originalEnv };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    describe('validateEnvironment', () => {
        test('should return success when environment variables are set', () => {
            process.env.NETLIFY_SITE_ID = 'test-site-id';
            process.env.NETLIFY_ACCESS_TOKEN = 'test-token';

            const result = validateEnvironment();

            expect(result).toEqual({ success: true });
        });

        test('should return error when NETLIFY_SITE_ID is missing', () => {
            delete process.env.NETLIFY_SITE_ID;
            process.env.NETLIFY_ACCESS_TOKEN = 'test-token';

            const result = validateEnvironment();

            expect(result).toEqual({
                success: false,
                error: 'Server configuration error'
            });
        });

        test('should return error when NETLIFY_ACCESS_TOKEN is missing', () => {
            process.env.NETLIFY_SITE_ID = 'test-site-id';
            delete process.env.NETLIFY_ACCESS_TOKEN;

            const result = validateEnvironment();

            expect(result).toEqual({
                success: false,
                error: 'Server configuration error'
            });
        });

        test('should return error when both environment variables are missing', () => {
            delete process.env.NETLIFY_SITE_ID;
            delete process.env.NETLIFY_ACCESS_TOKEN;

            const result = validateEnvironment();

            expect(result).toEqual({
                success: false,
                error: 'Server configuration error'
            });
        });
    });

    describe('createBlobStore', () => {
        beforeEach(() => {
            process.env.NETLIFY_SITE_ID = 'test-site-id';
            process.env.NETLIFY_ACCESS_TOKEN = 'test-token';
            getStore.mockReturnValue({ mockStore: true });
        });

        test('should create blob store with default configuration', () => {
            const store = createBlobStore('events');

            expect(getStore).toHaveBeenCalledWith({
                name: 'events',
                siteID: 'test-site-id',
                token: 'test-token',
                consistency: 'strong'
            });
            expect(store).toEqual({ mockStore: true });
        });

        test('should create blob store with custom options', () => {
            const store = createBlobStore('events', { consistency: 'eventual' });

            expect(getStore).toHaveBeenCalledWith({
                name: 'events',
                siteID: 'test-site-id',
                token: 'test-token',
                consistency: 'eventual'
            });
        });

        test('should throw error when environment variables are missing', () => {
            delete process.env.NETLIFY_SITE_ID;

            expect(() => {
                createBlobStore('events');
            }).toThrow('Server configuration error');
        });
    });

    describe('createBlobStores', () => {
        beforeEach(() => {
            process.env.NETLIFY_SITE_ID = 'test-site-id';
            process.env.NETLIFY_ACCESS_TOKEN = 'test-token';
            getStore.mockReturnValue({ mockStore: true });
        });

        test('should create multiple blob stores', () => {
            const stores = createBlobStores(['events', 'applications']);

            expect(getStore).toHaveBeenCalledTimes(2);
            expect(stores).toEqual({
                eventsStore: { mockStore: true },
                applicationsStore: { mockStore: true }
            });
        });

        test('should create stores with custom options', () => {
            const stores = createBlobStores(['events'], { consistency: 'eventual' });

            expect(getStore).toHaveBeenCalledWith({
                name: 'events',
                siteID: 'test-site-id',
                token: 'test-token',
                consistency: 'eventual'
            });
        });

        test('should throw error when environment variables are missing', () => {
            delete process.env.NETLIFY_ACCESS_TOKEN;

            expect(() => {
                createBlobStores(['events']);
            }).toThrow('Server configuration error');
        });
    });

    describe('StoreTypes', () => {
        test('should provide standard store type constants', () => {
            expect(StoreTypes.APPLICATIONS).toBe('applications');
            expect(StoreTypes.EVENTS).toBe('events');
            expect(StoreTypes.VENUES).toBe('venues');
            expect(StoreTypes.MEMBERS).toBe('members');
            expect(StoreTypes.PHOTOS).toBe('photos');
            expect(StoreTypes.GALLERY).toBe('gallery');
            expect(StoreTypes.VIDEOS).toBe('videos');
            expect(StoreTypes.TOKENS).toBe('tokens');
            expect(StoreTypes.PUSH_SUBSCRIPTIONS).toBe('push-subscriptions');
            expect(StoreTypes.FAQS).toBe('faqs');
            expect(StoreTypes.CITY_CONFIG).toBe('city-config');
        });
    });

    describe('CommonStoreGroups', () => {
        beforeEach(() => {
            process.env.NETLIFY_SITE_ID = 'test-site-id';
            process.env.NETLIFY_ACCESS_TOKEN = 'test-token';
            getStore.mockReturnValue({ mockStore: true });
        });

        test('should create admin stores', () => {
            const stores = CommonStoreGroups.createAdminStores();

            expect(getStore).toHaveBeenCalledTimes(4);
            expect(stores).toEqual({
                applicationsStore: { mockStore: true },
                eventsStore: { mockStore: true },
                venuesStore: { mockStore: true },
                membersStore: { mockStore: true }
            });
        });

        test('should create member stores', () => {
            const stores = CommonStoreGroups.createMemberStores();

            expect(getStore).toHaveBeenCalledTimes(3);
            expect(stores).toEqual({
                eventsStore: { mockStore: true },
                venuesStore: { mockStore: true },
                membersStore: { mockStore: true }
            });
        });

        test('should create media stores', () => {
            const stores = CommonStoreGroups.createMediaStores();

            expect(getStore).toHaveBeenCalledTimes(3);
            expect(stores).toEqual({
                photosStore: { mockStore: true },
                galleryStore: { mockStore: true },
                videosStore: { mockStore: true }
            });
        });

        test('should create auth stores', () => {
            const stores = CommonStoreGroups.createAuthStores();

            expect(getStore).toHaveBeenCalledTimes(2);
            expect(stores).toEqual({
                tokensStore: { mockStore: true },
                membersStore: { mockStore: true }
            });
        });
    });
});