/**
 * Test Data Cleanup Utility
 * 
 * This utility provides functions to clean up test data from the live database
 * after E2E tests complete. It identifies test applications by specific patterns
 * and removes them to prevent pollution of the production database.
 */

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

/**
 * Test data patterns to identify applications created by E2E tests
 */
const TEST_DATA_PATTERNS = {
  // Email patterns that identify test applications
  emails: [
    /^e2e-test.*@example\.com$/,
    /^playwright-test.*@example\.com$/,
    /^test-automation.*@example\.com$/,
    /^automated-test.*@example\.com$/
  ],
  
  // Name patterns that identify test applications
  names: [
    /^E2E[\s\-]?Test/i,
    /^Playwright[\s\-]?Test/i,
    /^Test[\s\-]?Automation/i,
    /^Automated[\s\-]?Test/i
  ],
  
  // Company patterns that identify test applications
  companies: [
    /^E2E Test Company$/i,
    /^Playwright Test Corp$/i,
    /^Test Automation Inc$/i,
    /^Automated Test Co$/i
  ],
  
  // Message patterns that identify test applications
  messages: [
    /^This is an E2E test application/i,
    /^Playwright automated test/i,
    /^Test automation application/i,
    /^Automated test submission/i
  ]
};

/**
 * Checks if an application matches test data patterns
 * @param {Object} application - Application object to check
 * @returns {boolean} - True if application appears to be test data
 */
function isTestApplication(application) {
  if (!application) return false;
  
  // Check email patterns
  for (const pattern of TEST_DATA_PATTERNS.emails) {
    if (pattern.test(application.email || '')) {
      return true;
    }
  }
  
  // Check name patterns
  const fullName = `${application.firstName || ''} ${application.lastName || ''}`.trim();
  for (const pattern of TEST_DATA_PATTERNS.names) {
    if (pattern.test(fullName) || pattern.test(application.firstName || '') || pattern.test(application.lastName || '')) {
      return true;
    }
  }
  
  // Check company patterns
  for (const pattern of TEST_DATA_PATTERNS.companies) {
    if (pattern.test(application.company || '')) {
      return true;
    }
  }
  
  // Check message patterns
  for (const pattern of TEST_DATA_PATTERNS.messages) {
    if (pattern.test(application.message || '')) {
      return true;
    }
  }
  
  return false;
}

/**
 * Attempts to get an admin authentication token for cleanup operations
 * This function tries to obtain admin credentials for cleanup
 * @returns {Promise<string|null>} - Admin token or null if not available
 */
async function getAdminToken() {
  try {
    // In a real cleanup scenario, this would need to authenticate as admin
    // For now, we'll return null to indicate no admin access
    // This could be enhanced to use environment variables for admin credentials
    console.log('⚠️ Admin authentication not implemented for cleanup');
    return null;
  } catch (error) {
    console.error('❌ Failed to get admin token:', error);
    return null;
  }
}

/**
 * Fetches all applications from the database
 * @param {string} adminToken - Admin authentication token
 * @returns {Promise<Array>} - Array of applications
 */
async function fetchAllApplications(adminToken) {
  try {
    const response = await fetch(`${baseURL}/.netlify/functions/get-applications`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch applications: ${response.status}`);
    }
    
    const data = await response.json();
    return data.applications || [];
  } catch (error) {
    console.error('❌ Failed to fetch applications:', error);
    return [];
  }
}

/**
 * Deletes a specific application
 * @param {string} applicationId - ID of application to delete
 * @param {string} adminToken - Admin authentication token
 * @returns {Promise<boolean>} - True if deletion was successful
 */
async function deleteApplication(applicationId, adminToken) {
  try {
    const response = await fetch(`${baseURL}/.netlify/functions/delete-application`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ applicationId })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to delete application: ${response.status}`);
    }
    
    return true;
  } catch (error) {
    console.error(`❌ Failed to delete application ${applicationId}:`, error);
    return false;
  }
}

/**
 * Main cleanup function that removes all test applications
 * @returns {Promise<Object>} - Cleanup results
 */
async function cleanupTestApplications() {
  console.log('🧹 Starting test application cleanup...');
  
  const adminToken = await getAdminToken();
  if (!adminToken) {
    console.log('⚠️ No admin token available - skipping cleanup');
    console.log('💡 Test applications will remain in database');
    console.log('💡 Manual cleanup may be required via admin dashboard');
    return {
      success: false,
      reason: 'No admin authentication available',
      deleted: 0,
      found: 0
    };
  }
  
  const applications = await fetchAllApplications(adminToken);
  console.log(`📋 Found ${applications.length} total applications`);
  
  // Filter test applications
  const testApplications = applications.filter(isTestApplication);
  console.log(`🎯 Found ${testApplications.length} test applications to clean up`);
  
  if (testApplications.length === 0) {
    console.log('✅ No test applications found - cleanup complete');
    return {
      success: true,
      deleted: 0,
      found: 0,
      applications: []
    };
  }
  
  // Delete test applications
  const deleteResults = await Promise.all(
    testApplications.map(async (app) => {
      const deleted = await deleteApplication(app.id, adminToken);
      if (deleted) {
        console.log(`✅ Deleted test application: ${app.id} (${app.firstName} ${app.lastName})`);
      } else {
        console.log(`❌ Failed to delete test application: ${app.id}`);
      }
      return { id: app.id, deleted, application: app };
    })
  );
  
  const deletedCount = deleteResults.filter(result => result.deleted).length;
  const failedCount = deleteResults.filter(result => !result.deleted).length;
  
  console.log(`🧹 Cleanup complete: ${deletedCount} deleted, ${failedCount} failed`);
  
  return {
    success: failedCount === 0,
    deleted: deletedCount,
    failed: failedCount,
    found: testApplications.length,
    applications: testApplications
  };
}

/**
 * Generates test application data with identifiable patterns
 * @param {number} index - Index for unique test data
 * @returns {Object} - Test application data
 */
function generateTestApplicationData(index = 1) {
  const timestamp = Date.now();
  const uniqueId = `${timestamp}_${index}`;
  
  return {
    firstName: `E2E-Test-${index}`,
    lastName: `Automation-${uniqueId}`,
    email: `e2e-test-${uniqueId}@example.com`,
    company: `E2E Test Company ${index}`,
    position: `Test Engineer ${index}`,
    phone: `+44 7123 45678${index}`,
    linkedin: `e2e-test-${uniqueId}`,
    message: `This is an E2E test application ${index} created by automated testing. This should be automatically cleaned up after tests complete.`
  };
}

/**
 * Creates a test application and returns its data
 * @param {Object} page - Playwright page object
 * @param {Object} customData - Custom data to override defaults
 * @returns {Promise<Object>} - Test application data used
 */
async function createTestApplication(page, customData = {}) {
  const testData = { ...generateTestApplicationData(1), ...customData };
  
  // Fill form with test data
  await page.fill('#firstName', testData.firstName);
  await page.fill('#lastName', testData.lastName);
  await page.fill('#email', testData.email);
  await page.fill('#company', testData.company);
  await page.fill('#position', testData.position);
  await page.fill('#phone', testData.phone);
  await page.fill('#linkedin', testData.linkedin);
  await page.fill('#message', testData.message);
  
  // Submit form
  await page.locator('.submit-btn').click();
  
  return testData;
}

/**
 * Waits for form submission to complete and checks for success
 * @param {Object} page - Playwright page object
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<boolean>} - True if submission was successful
 */
async function waitForSubmissionSuccess(page, timeout = 30000) {
  try {
    // Wait for either success state or error message
    await page.waitForFunction(() => {
      const successState = document.querySelector('.form-success-state');
      const errorMessage = document.querySelector('.form-message-error');
      return successState || errorMessage;
    }, { timeout });
    
    // Check if we got success state
    const successState = await page.locator('.form-success-state').isVisible();
    return successState;
  } catch (error) {
    console.error('❌ Form submission timeout or error:', error);
    return false;
  }
}

module.exports = {
  cleanupTestApplications,
  isTestApplication,
  generateTestApplicationData,
  createTestApplication,
  waitForSubmissionSuccess,
  TEST_DATA_PATTERNS
};