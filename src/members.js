// src/members.js - Entry point for members page
// Import all modules needed for member functionality

// Core authentication module
import { KartelAuth } from '../auth-module.js';

// Top bar navigation
import { KartelTopBar } from '../topbar-module.js';

// Push notifications for PWA
import { NotificationManager } from '../notification-manager.js';

// Make modules available globally for backward compatibility
window.kartelAuth = new KartelAuth();
window.kartelTopBar = new KartelTopBar();
window.NotificationManager = NotificationManager;

console.log('📦 Members bundle loaded');