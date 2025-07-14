// tests/blob-list-utils.test.js
const {
  getItemList,
  getApplicationsList,
  getEventsList,
  getVenuesList,
  setItem,
  deleteItem,
  getItem,
  findItemByField,
  getItemCount
} = require('../netlify/functions/blob-list-utils');

// Mock @netlify/blobs
jest.mock('@netlify/blobs', () => ({
  getStore: jest.fn(() => ({
    list: jest.fn(),
    get: jest.fn(),
    setJSON: jest.fn(),
    delete: jest.fn()
  }))
}));

const { getStore } = require('@netlify/blobs');

describe('Blob List Utils', () => {
  let mockStore;
  let storeConfig;

  beforeEach(() => {
    mockStore = {
      list: jest.fn(),
      get: jest.fn(),
      setJSON: jest.fn(),
      delete: jest.fn()
    };
    
    getStore.mockReturnValue(mockStore);
    
    storeConfig = {
      name: 'test-store',
      siteID: 'test-site-id',
      token: 'test-token',
      consistency: 'strong'
    };
    
    // Suppress console.log/error in tests
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getItemList', () => {
    it('should fetch and filter items by prefix', async () => {
      const mockBlobs = [
        { key: 'app_1' },
        { key: 'app_2' },
        { key: 'evt_1' },
        { key: '_list' }
      ];
      
      const mockItems = [
        { id: 'app_1', name: 'Application 1' },
        { id: 'app_2', name: 'Application 2' }
      ];

      mockStore.list.mockResolvedValue({ blobs: mockBlobs });
      mockStore.get.mockImplementation((key) => {
        if (key === 'app_1') return Promise.resolve(mockItems[0]);
        if (key === 'app_2') return Promise.resolve(mockItems[1]);
        return Promise.resolve(null);
      });

      const result = await getItemList(storeConfig, 'app_');

      expect(result).toEqual(mockItems);
      expect(mockStore.list).toHaveBeenCalledTimes(1);
      expect(mockStore.get).toHaveBeenCalledTimes(2);
      expect(mockStore.get).toHaveBeenCalledWith('app_1', { type: 'json' });
      expect(mockStore.get).toHaveBeenCalledWith('app_2', { type: 'json' });
    });

    it('should handle empty blob list', async () => {
      mockStore.list.mockResolvedValue({ blobs: [] });

      const result = await getItemList(storeConfig, 'app_');

      expect(result).toEqual([]);
      expect(mockStore.list).toHaveBeenCalledTimes(1);
      expect(mockStore.get).not.toHaveBeenCalled();
    });

    it('should filter out invalid items', async () => {
      const mockBlobs = [
        { key: 'app_1' },
        { key: 'app_2' },
        { key: 'app_3' }
      ];

      mockStore.list.mockResolvedValue({ blobs: mockBlobs });
      mockStore.get.mockImplementation((key) => {
        if (key === 'app_1') return Promise.resolve({ id: 'app_1', name: 'Valid' });
        if (key === 'app_2') return Promise.resolve(null); // Invalid
        if (key === 'app_3') return Promise.reject(new Error('Failed to load'));
        return Promise.resolve(null);
      });

      const result = await getItemList(storeConfig, 'app_');

      expect(result).toEqual([{ id: 'app_1', name: 'Valid' }]);
      expect(mockStore.get).toHaveBeenCalledTimes(3);
    });

    it('should apply custom sort function', async () => {
      const mockBlobs = [
        { key: 'app_1' },
        { key: 'app_2' }
      ];
      
      const mockItems = [
        { id: 'app_1', name: 'B Item' },
        { id: 'app_2', name: 'A Item' }
      ];

      mockStore.list.mockResolvedValue({ blobs: mockBlobs });
      mockStore.get.mockImplementation((key) => {
        if (key === 'app_1') return Promise.resolve(mockItems[0]);
        if (key === 'app_2') return Promise.resolve(mockItems[1]);
        return Promise.resolve(null);
      });

      const sortByName = (a, b) => a.name.localeCompare(b.name);
      const result = await getItemList(storeConfig, 'app_', sortByName);

      expect(result).toEqual([
        { id: 'app_2', name: 'A Item' },
        { id: 'app_1', name: 'B Item' }
      ]);
    });
  });

  describe('getApplicationsList', () => {
    it('should return sorted applications list', async () => {
      const mockBlobs = [
        { key: 'app_1' },
        { key: 'app_2' },
        { key: 'app_3' }
      ];
      
      const mockApplications = [
        { id: 'app_1', firstName: 'John', lastName: 'Doe', isAdmin: false },
        { id: 'app_2', firstName: 'Jane', lastName: 'Smith', isAdmin: true },
        { id: 'app_3', firstName: 'Bob', lastName: 'Wilson', isAdmin: false }
      ];

      mockStore.list.mockResolvedValue({ blobs: mockBlobs });
      mockStore.get.mockImplementation((key) => {
        const index = parseInt(key.split('_')[1]) - 1;
        return Promise.resolve(mockApplications[index]);
      });

      const result = await getApplicationsList(storeConfig);

      // Should be sorted: admins first, then alphabetically
      expect(result[0].isAdmin).toBe(true); // Jane Smith (admin)
      expect(result[1].firstName).toBe('Bob'); // Bob Wilson (alphabetically before John)
      expect(result[2].firstName).toBe('John'); // John Doe
    });
  });

  describe('getVenuesList', () => {
    it('should prioritize home venue first', async () => {
      const mockBlobs = [
        { key: 'ven_1' },
        { key: 'ven_2' },
        { key: 'ven_3' }
      ];
      
      const mockVenues = [
        { id: 'ven_1', name: 'Regular Venue', createdAt: '2024-01-03T00:00:00Z' },
        { id: 'ven_2', name: 'TeamSport Victoria', createdAt: '2024-01-01T00:00:00Z' }, // Home venue (older)
        { id: 'ven_3', name: 'Another Venue', createdAt: '2024-01-02T00:00:00Z' }
      ];

      mockStore.list.mockResolvedValue({ blobs: mockBlobs });
      mockStore.get.mockImplementation((key) => {
        const index = parseInt(key.split('_')[1]) - 1;
        return Promise.resolve(mockVenues[index]);
      });

      const result = await getVenuesList(storeConfig);

      // Home venue should be first, regardless of creation date
      expect(result[0].name).toBe('TeamSport Victoria');
      // Other venues sorted by creation date (newest first)
      expect(result[1].name).toBe('Regular Venue'); // Newest
      expect(result[2].name).toBe('Another Venue'); // Older
    });

    it('should handle venues without home venue', async () => {
      const mockBlobs = [
        { key: 'ven_1' },
        { key: 'ven_2' }
      ];
      
      const mockVenues = [
        { id: 'ven_1', name: 'Venue A', createdAt: '2024-01-01T00:00:00Z' },
        { id: 'ven_2', name: 'Venue B', createdAt: '2024-01-02T00:00:00Z' }
      ];

      mockStore.list.mockResolvedValue({ blobs: mockBlobs });
      mockStore.get.mockImplementation((key) => {
        const index = parseInt(key.split('_')[1]) - 1;
        return Promise.resolve(mockVenues[index]);
      });

      const result = await getVenuesList(storeConfig);

      // Should be sorted by creation date (newest first) when no home venue
      expect(result[0].name).toBe('Venue B'); // Newer
      expect(result[1].name).toBe('Venue A'); // Older
    });
  });

  describe('setItem', () => {
    it('should successfully store an item', async () => {
      const itemId = 'test_1';
      const itemData = { id: 'test_1', name: 'Test Item' };

      mockStore.setJSON.mockResolvedValue();

      const result = await setItem(storeConfig, itemId, itemData);

      expect(result).toBe(true);
      expect(mockStore.setJSON).toHaveBeenCalledWith(itemId, itemData);
    });

    it('should handle storage errors', async () => {
      const itemId = 'test_1';
      const itemData = { id: 'test_1', name: 'Test Item' };

      mockStore.setJSON.mockRejectedValue(new Error('Storage failed'));

      const result = await setItem(storeConfig, itemId, itemData);

      expect(result).toBe(false);
      expect(mockStore.setJSON).toHaveBeenCalledWith(itemId, itemData);
    });
  });

  describe('getItem', () => {
    it('should retrieve an item successfully', async () => {
      const itemId = 'test_1';
      const itemData = { id: 'test_1', name: 'Test Item' };

      mockStore.get.mockResolvedValue(itemData);

      const result = await getItem(storeConfig, itemId);

      expect(result).toEqual(itemData);
      expect(mockStore.get).toHaveBeenCalledWith(itemId, { type: 'json' });
    });

    it('should return null for non-existent items', async () => {
      const itemId = 'test_1';

      mockStore.get.mockRejectedValue(new Error('Not found'));

      const result = await getItem(storeConfig, itemId);

      expect(result).toBe(null);
    });
  });

  describe('deleteItem', () => {
    it('should successfully delete an item', async () => {
      const itemId = 'test_1';

      mockStore.delete.mockResolvedValue();

      const result = await deleteItem(storeConfig, itemId);

      expect(result).toBe(true);
      expect(mockStore.delete).toHaveBeenCalledWith(itemId);
    });

    it('should handle deletion errors', async () => {
      const itemId = 'test_1';

      mockStore.delete.mockRejectedValue(new Error('Delete failed'));

      const result = await deleteItem(storeConfig, itemId);

      expect(result).toBe(false);
      expect(mockStore.delete).toHaveBeenCalledWith(itemId);
    });
  });

  describe('findItemByField', () => {
    it('should find item by field value', async () => {
      const mockBlobs = [
        { key: 'app_1' },
        { key: 'app_2' }
      ];
      
      const mockItems = [
        { id: 'app_1', email: 'john@example.com' },
        { id: 'app_2', email: 'jane@example.com' }
      ];

      mockStore.list.mockResolvedValue({ blobs: mockBlobs });
      mockStore.get.mockImplementation((key) => {
        if (key === 'app_1') return Promise.resolve(mockItems[0]);
        if (key === 'app_2') return Promise.resolve(mockItems[1]);
        return Promise.resolve(null);
      });

      const result = await findItemByField(storeConfig, 'app_', 'email', 'jane@example.com');

      expect(result).toEqual(mockItems[1]);
    });

    it('should return null if item not found', async () => {
      const mockBlobs = [{ key: 'app_1' }];
      const mockItems = [{ id: 'app_1', email: 'john@example.com' }];

      mockStore.list.mockResolvedValue({ blobs: mockBlobs });
      mockStore.get.mockResolvedValue(mockItems[0]);

      const result = await findItemByField(storeConfig, 'app_', 'email', 'notfound@example.com');

      expect(result).toBe(null);
    });
  });

  describe('getItemCount', () => {
    it('should return correct count of items', async () => {
      const mockBlobs = [
        { key: 'app_1' },
        { key: 'app_2' },
        { key: 'evt_1' },
        { key: '_list' }
      ];

      mockStore.list.mockResolvedValue({ blobs: mockBlobs });

      const result = await getItemCount(storeConfig, 'app_');

      expect(result).toBe(2); // Only app_1 and app_2, not evt_1 or _list
    });

    it('should handle list errors', async () => {
      mockStore.list.mockRejectedValue(new Error('List failed'));

      const result = await getItemCount(storeConfig, 'app_');

      expect(result).toBe(0);
    });
  });
});