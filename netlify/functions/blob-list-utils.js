// netlify/functions/blob-list-utils.js
// Efficient list management utilities for Netlify Blobs
// Eliminates race conditions and improves scalability by using individual entries

const { getStore } = require('@netlify/blobs');

/**
 * Get all items from a blob store efficiently using individual entries
 * @param {Object} storeConfig - Netlify Blobs store configuration
 * @param {string} keyPrefix - Prefix to filter items (e.g., 'app_', 'evt_', 'ven_')
 * @param {Function} sortFunction - Optional sort function for the results
 * @returns {Array} Array of items
 */
async function getItemList(storeConfig, keyPrefix, sortFunction = null) {
  const store = getStore(storeConfig);
  const items = [];
  
  try {
    console.log(`📋 Fetching items with prefix: ${keyPrefix}`);
    
    // List all blob entries
    const allEntries = await store.list();
    console.log(`📊 Found ${allEntries.blobs.length} total entries in store: ${storeConfig.name}`);
    
    // Filter entries by prefix
    const filteredEntries = allEntries.blobs.filter(entry => 
      entry.key.startsWith(keyPrefix) && entry.key !== '_list'
    );
    console.log(`🔍 Found ${filteredEntries.length} entries with prefix: ${keyPrefix}`);
    
    // Fetch all items in parallel for better performance
    const fetchPromises = filteredEntries.map(async (entry) => {
      try {
        const item = await store.get(entry.key, { type: 'json' });
        if (item && item.id) {
          return item;
        }
        return null;
      } catch (error) {
        console.warn(`⚠️ Failed to load ${entry.key}:`, error.message);
        return null;
      }
    });
    
    // Wait for all fetches to complete and filter out nulls
    const fetchedItems = await Promise.all(fetchPromises);
    const validItems = fetchedItems.filter(item => item !== null);
    
    console.log(`✅ Successfully loaded ${validItems.length} valid items`);
    
    // Apply sorting if provided
    if (sortFunction && typeof sortFunction === 'function') {
      validItems.sort(sortFunction);
    }
    
    return validItems;
    
  } catch (error) {
    console.error(`❌ Error fetching items from ${storeConfig.name}:`, error.message);
    return [];
  }
}

/**
 * Get applications list efficiently
 * @param {Object} storeConfig - Netlify Blobs store configuration
 * @returns {Array} Array of applications sorted by admin status and name
 */
async function getApplicationsList(storeConfig) {
  const sortFunction = (a, b) => {
    // First, sort by admin status (admins first)
    if (a.isAdmin && !b.isAdmin) return -1;
    if (!a.isAdmin && b.isAdmin) return 1;
    
    // Then sort alphabetically by full name
    const nameA = (a.fullName || `${a.firstName || ''} ${a.lastName || ''}`.trim() || a.name || '').toLowerCase();
    const nameB = (b.fullName || `${b.firstName || ''} ${b.lastName || ''}`.trim() || b.name || '').toLowerCase();
    return nameA.localeCompare(nameB);
  };
  
  return await getItemList(storeConfig, 'app_', sortFunction);
}

/**
 * Get events list efficiently
 * @param {Object} storeConfig - Netlify Blobs store configuration
 * @returns {Array} Array of events sorted by date (newest first)
 */
async function getEventsList(storeConfig) {
  const sortFunction = (a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    return dateB - dateA; // Newest first
  };
  
  return await getItemList(storeConfig, 'evt_', sortFunction);
}

/**
 * Get venues list efficiently
 * @param {Object} storeConfig - Netlify Blobs store configuration
 * @param {string} [homeVenueId] - Optional home venue ID to prioritize first
 * @returns {Array} Array of venues sorted with home venue first, then alphabetically or by date
 */
async function getVenuesList(storeConfig, homeVenueId = null) {
  const sortFunction = (a, b) => {
    // If homeVenueId is specified, prioritize that venue
    if (homeVenueId) {
      const isAHomeVenue = a.id === homeVenueId;
      const isBHomeVenue = b.id === homeVenueId;
      
      if (isAHomeVenue && !isBHomeVenue) return -1;
      if (!isAHomeVenue && isBHomeVenue) return 1;
    } else {
      // Legacy: For Manchester, prioritize TeamSport Victoria if no homeVenueId specified
      const isAHomeVenue = a.name && a.name.toLowerCase().includes('teamsport victoria');
      const isBHomeVenue = b.name && b.name.toLowerCase().includes('teamsport victoria');
      
      if (isAHomeVenue && !isBHomeVenue) return -1;
      if (!isAHomeVenue && isBHomeVenue) return 1;
    }
    
    // For venues that aren't home venue, sort alphabetically if no homeVenueId specified
    // Otherwise sort by creation date (newest first)
    if (!homeVenueId) {
      // Alphabetical sorting for better UX when no home venue configured
      return (a.name || '').localeCompare(b.name || '');
    } else {
      // Date sorting when home venue is configured
      const dateA = new Date(a.createdAt || a.date || 0);
      const dateB = new Date(b.createdAt || b.date || 0);
      return dateB - dateA;
    }
  };
  
  return await getItemList(storeConfig, 'ven_', sortFunction);
}

/**
 * Add or update an item in the store (no list management needed)
 * @param {Object} storeConfig - Netlify Blobs store configuration
 * @param {string} itemId - Unique identifier for the item
 * @param {Object} itemData - The item data to store
 * @returns {boolean} Success status
 */
async function setItem(storeConfig, itemId, itemData) {
  try {
    const store = getStore(storeConfig);
    await store.setJSON(itemId, itemData);
    console.log(`✅ Successfully stored item: ${itemId}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to store item ${itemId}:`, error.message);
    return false;
  }
}

/**
 * Delete an item from the store (no list management needed)
 * @param {Object} storeConfig - Netlify Blobs store configuration
 * @param {string} itemId - Unique identifier for the item to delete
 * @returns {boolean} Success status
 */
async function deleteItem(storeConfig, itemId) {
  try {
    const store = getStore(storeConfig);
    await store.delete(itemId);
    console.log(`✅ Successfully deleted item: ${itemId}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to delete item ${itemId}:`, error.message);
    return false;
  }
}

/**
 * Get a single item by ID
 * @param {Object} storeConfig - Netlify Blobs store configuration
 * @param {string} itemId - Unique identifier for the item
 * @returns {Object|null} The item data or null if not found
 */
async function getItem(storeConfig, itemId) {
  try {
    const store = getStore(storeConfig);
    const item = await store.get(itemId, { type: 'json' });
    return item;
  } catch (error) {
    console.error(`❌ Failed to get item ${itemId}:`, error.message);
    return null;
  }
}

/**
 * Find an item by a specific field value
 * @param {Object} storeConfig - Netlify Blobs store configuration
 * @param {string} keyPrefix - Prefix to filter items
 * @param {string} field - Field name to search
 * @param {any} value - Value to match
 * @returns {Object|null} The found item or null
 */
async function findItemByField(storeConfig, keyPrefix, field, value) {
  try {
    const items = await getItemList(storeConfig, keyPrefix);
    const foundItem = items.find(item => item[field] === value);
    return foundItem || null;
  } catch (error) {
    console.error(`❌ Failed to find item by ${field}:`, error.message);
    return null;
  }
}

/**
 * Get count of items with a specific prefix
 * @param {Object} storeConfig - Netlify Blobs store configuration
 * @param {string} keyPrefix - Prefix to filter items
 * @returns {number} Count of items
 */
async function getItemCount(storeConfig, keyPrefix) {
  try {
    const store = getStore(storeConfig);
    const allEntries = await store.list();
    const count = allEntries.blobs.filter(entry => 
      entry.key.startsWith(keyPrefix) && entry.key !== '_list'
    ).length;
    return count;
  } catch (error) {
    console.error(`❌ Failed to count items with prefix ${keyPrefix}:`, error.message);
    return 0;
  }
}

/**
 * Migration helper: Remove legacy _list entries (use with caution)
 * @param {Object} storeConfig - Netlify Blobs store configuration
 * @returns {boolean} Success status
 */
async function removeLegacyList(storeConfig) {
  try {
    const store = getStore(storeConfig);
    await store.delete('_list');
    console.log(`✅ Removed legacy _list from store: ${storeConfig.name}`);
    return true;
  } catch (error) {
    // It's OK if _list doesn't exist
    console.log(`📝 No legacy _list found in store: ${storeConfig.name}`);
    return true;
  }
}

module.exports = {
  getItemList,
  getApplicationsList,
  getEventsList,
  getVenuesList,
  setItem,
  deleteItem,
  getItem,
  findItemByField,
  getItemCount,
  removeLegacyList
};