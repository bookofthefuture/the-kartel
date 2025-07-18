/**
 * Authentication helpers for E2E testing
 * Uses mocked authentication to avoid real credentials
 */

/**
 * Mock login as a test user
 * @param {Page} page - Playwright page object
 * @param {string} userType - 'member', 'admin', or 'super-admin'
 */
async function loginAsTestUser(page, userType = 'member') {
  await page.addInitScript((userType) => {
    const mockUser = {
      id: `test-${userType}-123`,
      email: `test-${userType}@kartel-e2e.com`,
      firstName: 'Test',
      lastName: userType === 'super-admin' ? 'Super Admin' : userType === 'admin' ? 'Admin' : 'Member',
      fullName: userType === 'super-admin' ? 'Test Super Admin' : userType === 'admin' ? 'Test Admin' : 'Test Member',
      company: 'Test Company Ltd',
      position: 'Test Position',
      phone: '+44 7700 900000',
      linkedin: 'test-user',
      hasPassword: true
    };
    
    // Set unified auth token and user data
    localStorage.setItem('kartel_auth_token', `mock-jwt-token-${userType}`);
    localStorage.setItem('kartel_user_data', JSON.stringify(mockUser));
    localStorage.setItem('kartel_is_admin', (userType === 'admin' || userType === 'super-admin').toString());
    localStorage.setItem('kartel_is_super_admin', (userType === 'super-admin').toString());
    
    // Set legacy tokens for backward compatibility
    localStorage.setItem('kartel_member_token', `mock-jwt-token-${userType}`);
    localStorage.setItem('kartel_member_email', mockUser.email);
    localStorage.setItem('kartel_member_id', mockUser.id);
    localStorage.setItem('kartel_member_firstName', mockUser.firstName);
    localStorage.setItem('kartel_member_lastName', mockUser.lastName);
    localStorage.setItem('kartel_member_isAdmin', (userType === 'admin' || userType === 'super-admin').toString());
    
    // For admin users, also set admin tokens
    if (userType === 'admin' || userType === 'super-admin') {
      localStorage.setItem('kartel_admin_token', `mock-jwt-token-${userType}`);
      localStorage.setItem('kartel_admin_user', JSON.stringify(mockUser));
    }
    
    console.log(`🔧 E2E: Mocked authentication as ${userType}:`, mockUser.email);
  }, userType);
}

/**
 * Clear all authentication data
 * @param {Page} page - Playwright page object
 */
async function logout(page) {
  await page.evaluate(() => {
    // Clear all auth-related localStorage items
    const authKeys = [
      'kartel_auth_token',
      'kartel_user_data', 
      'kartel_is_admin',
      'kartel_is_super_admin',
      'kartel_admin_token',
      'kartel_admin_user',
      'kartel_member_token',
      'kartel_member_email',
      'kartel_member_id',
      'kartel_member_firstName',
      'kartel_member_lastName',
      'kartel_member_company',
      'kartel_member_position',
      'kartel_member_phone',
      'kartel_member_linkedin',
      'kartel_member_hasPassword',
      'kartel_member_isAdmin'
    ];
    
    authKeys.forEach(key => localStorage.removeItem(key));
    console.log('🔧 E2E: Cleared all authentication data');
  });
}

/**
 * Check if user appears to be authenticated
 * @param {Page} page - Playwright page object
 * @returns {Promise<boolean>}
 */
async function isAuthenticated(page) {
  return await page.evaluate(() => {
    return !!(localStorage.getItem('kartel_auth_token') && localStorage.getItem('kartel_user_data'));
  });
}

module.exports = {
  loginAsTestUser,
  logout,
  isAuthenticated
};