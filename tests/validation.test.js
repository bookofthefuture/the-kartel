// Simple validation tests for The Kartel functionality
describe('Form Validation Logic', () => {
  test('should validate required fields', () => {
    const validateRequiredFields = (data, requiredFields) => {
      const missingFields = [];
      for (const field of requiredFields) {
        if (!data[field]) {
          missingFields.push(field);
        }
      }
      return missingFields;
    };
    
    const requiredFields = ['firstName', 'lastName', 'email', 'company', 'position', 'phone'];
    
    // Test with missing fields
    const incompleteData = {
      firstName: 'John',
      email: 'john@example.com'
    };
    
    const missing = validateRequiredFields(incompleteData, requiredFields);
    expect(missing).toContain('lastName');
    expect(missing).toContain('company');
    expect(missing).toContain('position');
    expect(missing).toContain('phone');
    
    // Test with all fields present
    const completeData = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      company: 'Acme Corp',
      position: 'CEO',
      phone: '07123456789'
    };
    
    const noMissing = validateRequiredFields(completeData, requiredFields);
    expect(noMissing).toHaveLength(0);
  });

  test('should validate email format', () => {
    const isValidEmail = (email) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    };
    
    expect(isValidEmail('john@example.com')).toBe(true);
    expect(isValidEmail('john.doe@company.co.uk')).toBe(true);
    expect(isValidEmail('invalid-email')).toBe(false);
    expect(isValidEmail('missing@domain')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });

  test('should validate phone number format', () => {
    const isValidUKPhone = (phone) => {
      // Basic UK phone validation (starts with 07 for mobile)
      const ukMobileRegex = /^07\d{9}$/;
      return ukMobileRegex.test(phone.replace(/\s/g, ''));
    };
    
    expect(isValidUKPhone('07123456789')).toBe(true);
    expect(isValidUKPhone('07 123 456 789')).toBe(true);
    expect(isValidUKPhone('08123456789')).toBe(false); // Not 07
    expect(isValidUKPhone('0712345678')).toBe(false);  // Too short
    expect(isValidUKPhone('071234567890')).toBe(false); // Too long
  });
});

describe('Authorization Logic', () => {
  test('should validate bearer token format', () => {
    const validateBearerToken = (authHeader) => {
      if (!authHeader) {
        return { valid: false, error: 'Missing authorization header' };
      }
      
      if (!authHeader.startsWith('Bearer ')) {
        return { valid: false, error: 'Invalid authorization format' };
      }
      
      const token = authHeader.split(' ')[1];
      if (!token || token.length < 32) {
        return { valid: false, error: 'Invalid token format' };
      }
      
      return { valid: true };
    };
    
    // Valid token
    const validToken = 'Bearer ' + 'a'.repeat(32);
    expect(validateBearerToken(validToken).valid).toBe(true);
    
    // Missing header
    expect(validateBearerToken(null).valid).toBe(false);
    expect(validateBearerToken(null).error).toBe('Missing authorization header');
    
    // Wrong format
    expect(validateBearerToken('InvalidFormat').valid).toBe(false);
    expect(validateBearerToken('InvalidFormat').error).toBe('Invalid authorization format');
    
    // Short token
    expect(validateBearerToken('Bearer short').valid).toBe(false);
    expect(validateBearerToken('Bearer short').error).toBe('Invalid token format');
  });

  test('should validate admin credentials', () => {
    const validateCredentials = (username, password, adminUser, adminPass) => {
      if (!username || !password) {
        return { valid: false, error: 'Missing credentials' };
      }
      
      if (username === adminUser && password === adminPass) {
        return { valid: true };
      }
      
      return { valid: false, error: 'Invalid credentials' };
    };
    
    const adminUsername = 'test-admin';
    const adminPassword = 'test-password';
    
    // Valid credentials
    expect(validateCredentials(adminUsername, adminPassword, adminUsername, adminPassword).valid).toBe(true);
    
    // Invalid username
    expect(validateCredentials('wrong', adminPassword, adminUsername, adminPassword).valid).toBe(false);
    
    // Invalid password
    expect(validateCredentials(adminUsername, 'wrong', adminUsername, adminPassword).valid).toBe(false);
    
    // Missing credentials
    expect(validateCredentials('', '', adminUsername, adminPassword).valid).toBe(false);
  });
});

describe('Data Processing Logic', () => {
  test('should create application ID format', () => {
    const createApplicationId = () => {
      const timestamp = Date.now();
      const random = Math.random().toString(36).substr(2, 9);
      return `app_${timestamp}_${random}`;
    };
    
    const id1 = createApplicationId();
    const id2 = createApplicationId();
    
    expect(id1).toMatch(/^app_\d+_[a-z0-9]{9}$/);
    expect(id2).toMatch(/^app_\d+_[a-z0-9]{9}$/);
    expect(id1).not.toBe(id2); // Should be unique
  });

  test('should combine first and last name', () => {
    const combineNames = (firstName, lastName) => {
      return `${firstName} ${lastName}`;
    };
    
    expect(combineNames('John', 'Doe')).toBe('John Doe');
    expect(combineNames('Jane', 'Smith')).toBe('Jane Smith');
  });

  test('should sort applications by date', () => {
    const applications = [
      { id: 'app_1', submittedAt: '2024-01-01T00:00:00.000Z' },
      { id: 'app_2', submittedAt: '2024-01-03T00:00:00.000Z' },
      { id: 'app_3', submittedAt: '2024-01-02T00:00:00.000Z' }
    ];
    
    const sorted = applications.sort((a, b) => 
      new Date(b.submittedAt) - new Date(a.submittedAt)
    );
    
    expect(sorted[0].id).toBe('app_2'); // Most recent
    expect(sorted[1].id).toBe('app_3');
    expect(sorted[2].id).toBe('app_1'); // Oldest
  });
});

describe('Environment Validation', () => {
  test('should check required environment variables', () => {
    const checkRequiredEnvVars = (envVars, required) => {
      const missing = [];
      for (const varName of required) {
        if (!envVars[varName]) {
          missing.push(varName);
        }
      }
      return missing;
    };
    
    const mockEnv = {
      NETLIFY_SITE_ID: 'test-site-id',
      ADMIN_USERNAME: 'admin',
      // Missing NETLIFY_ACCESS_TOKEN and ADMIN_PASSWORD
    };
    
    const required = ['NETLIFY_SITE_ID', 'NETLIFY_ACCESS_TOKEN', 'ADMIN_USERNAME', 'ADMIN_PASSWORD'];
    const missing = checkRequiredEnvVars(mockEnv, required);
    
    expect(missing).toContain('NETLIFY_ACCESS_TOKEN');
    expect(missing).toContain('ADMIN_PASSWORD');
    expect(missing).not.toContain('NETLIFY_SITE_ID');
    expect(missing).not.toContain('ADMIN_USERNAME');
  });
});