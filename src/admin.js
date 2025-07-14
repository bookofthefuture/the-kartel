// src/admin.js - Entry point for admin pages
// Import all modules needed for admin functionality

// Core authentication module
import { KartelAuth } from '../auth-module.js';

// Top bar navigation
import { KartelTopBar } from '../topbar-module.js';

// Push notifications for PWA
import { NotificationManager } from '../notification-manager.js';

// Admin dashboard functionality - this already exports to window
import '../admin.js';

// Make modules available globally for backward compatibility
window.kartelAuth = new KartelAuth();
window.kartelTopBar = new KartelTopBar();
window.NotificationManager = NotificationManager;

console.log('📦 Admin bundle loaded');