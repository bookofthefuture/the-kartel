#!/usr/bin/env node

/**
 * PWA Icon Generator for The Kartel
 * 
 * This script generates PWA icons from the existing logo
 * Run with: node scripts/generate-icons.js
 */

const fs = require('fs');
const path = require('path');

// Icon sizes needed for PWA
const iconSizes = [72, 96, 128, 144, 152, 192, 384, 512];

// Create SVG template for member icons (go-kart theme matching favicon)
const createMemberIcon = (size) => {
  const scale = size / 32; // Scale factor based on original 32x32 favicon
  return `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <!-- Dark background circle -->
  <circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="#1a2332"/>
  
  <!-- Go-kart body -->
  <path d="M${8*scale} ${18*scale} L${22*scale} ${18*scale} C${23*scale} ${18*scale} ${24*scale} ${17*scale} ${24*scale} ${16*scale} L${24*scale} ${14*scale} C${24*scale} ${13*scale} ${23*scale} ${12*scale} ${22*scale} ${12*scale} L${8*scale} ${12*scale} C${7*scale} ${12*scale} ${6*scale} ${13*scale} ${6*scale} ${14*scale} L${6*scale} ${16*scale} C${6*scale} ${17*scale} ${7*scale} ${18*scale} ${8*scale} ${18*scale} Z" fill="#2b9ce6"/>
  
  <!-- Driver helmet -->
  <circle cx="${18*scale}" cy="${10*scale}" r="${3.5*scale}" fill="#2b9ce6"/>
  <path d="M${16*scale} ${8*scale} L${20*scale} ${8*scale} C${20.5*scale} ${8*scale} ${21*scale} ${8.5*scale} ${21*scale} ${9*scale} L${21*scale} ${10*scale} C${21*scale} ${10.5*scale} ${20.5*scale} ${11*scale} ${20*scale} ${11*scale} L${16*scale} ${11*scale} C${15.5*scale} ${11*scale} ${15*scale} ${10.5*scale} ${15*scale} ${10*scale} L${15*scale} ${9*scale} C${15*scale} ${8.5*scale} ${15.5*scale} ${8*scale} ${16*scale} ${8*scale} Z" fill="white"/>
  
  <!-- Wheels -->
  <circle cx="${10*scale}" cy="${20*scale}" r="${2.5*scale}" fill="#1a2332" stroke="#2b9ce6" stroke-width="${1*scale}"/>
  <circle cx="${20*scale}" cy="${20*scale}" r="${2.5*scale}" fill="#1a2332" stroke="#2b9ce6" stroke-width="${1*scale}"/>
  
  <!-- Speed lines -->
  <path d="M${4*scale} ${14*scale} L${6*scale} ${14*scale}" stroke="#f59e0b" stroke-width="${1.5*scale}" stroke-linecap="round"/>
  <path d="M${3*scale} ${16*scale} L${5*scale} ${16*scale}" stroke="#f59e0b" stroke-width="${1.5*scale}" stroke-linecap="round"/>
  
  <!-- Checkered flag -->
  <rect x="${24*scale}" y="${8*scale}" width="${4*scale}" height="${3*scale}" fill="white"/>
  <rect x="${24*scale}" y="${8*scale}" width="${2*scale}" height="${1.5*scale}" fill="#1a2332"/>
  <rect x="${26*scale}" y="${9.5*scale}" width="${2*scale}" height="${1.5*scale}" fill="#1a2332"/>
</svg>`;
};

// Create SVG template for admin icons (red accent on go-kart theme)
const createAdminIcon = (size) => {
  const scale = size / 32; // Scale factor based on original 32x32 favicon
  return `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <!-- Dark background circle -->
  <circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="#1a2332"/>
  
  <!-- Go-kart body (red for admin) -->
  <path d="M${8*scale} ${18*scale} L${22*scale} ${18*scale} C${23*scale} ${18*scale} ${24*scale} ${17*scale} ${24*scale} ${16*scale} L${24*scale} ${14*scale} C${24*scale} ${13*scale} ${23*scale} ${12*scale} ${22*scale} ${12*scale} L${8*scale} ${12*scale} C${7*scale} ${12*scale} ${6*scale} ${13*scale} ${6*scale} ${14*scale} L${6*scale} ${16*scale} C${6*scale} ${17*scale} ${7*scale} ${18*scale} ${8*scale} ${18*scale} Z" fill="#e74c3c"/>
  
  <!-- Driver helmet (red for admin) -->
  <circle cx="${18*scale}" cy="${10*scale}" r="${3.5*scale}" fill="#e74c3c"/>
  <path d="M${16*scale} ${8*scale} L${20*scale} ${8*scale} C${20.5*scale} ${8*scale} ${21*scale} ${8.5*scale} ${21*scale} ${9*scale} L${21*scale} ${10*scale} C${21*scale} ${10.5*scale} ${20.5*scale} ${11*scale} ${20*scale} ${11*scale} L${16*scale} ${11*scale} C${15.5*scale} ${11*scale} ${15*scale} ${10.5*scale} ${15*scale} ${10*scale} L${15*scale} ${9*scale} C${15*scale} ${8.5*scale} ${15.5*scale} ${8*scale} ${16*scale} ${8*scale} Z" fill="white"/>
  
  <!-- Wheels (red accent for admin) -->
  <circle cx="${10*scale}" cy="${20*scale}" r="${2.5*scale}" fill="#1a2332" stroke="#e74c3c" stroke-width="${1*scale}"/>
  <circle cx="${20*scale}" cy="${20*scale}" r="${2.5*scale}" fill="#1a2332" stroke="#e74c3c" stroke-width="${1*scale}"/>
  
  <!-- Speed lines -->
  <path d="M${4*scale} ${14*scale} L${6*scale} ${14*scale}" stroke="#f59e0b" stroke-width="${1.5*scale}" stroke-linecap="round"/>
  <path d="M${3*scale} ${16*scale} L${5*scale} ${16*scale}" stroke="#f59e0b" stroke-width="${1.5*scale}" stroke-linecap="round"/>
  
  <!-- Checkered flag -->
  <rect x="${24*scale}" y="${8*scale}" width="${4*scale}" height="${3*scale}" fill="white"/>
  <rect x="${24*scale}" y="${8*scale}" width="${2*scale}" height="${1.5*scale}" fill="#1a2332"/>
  <rect x="${26*scale}" y="${9.5*scale}" width="${2*scale}" height="${1.5*scale}" fill="#1a2332"/>
  
  <!-- Admin badge (small "A" indicator) -->
  <circle cx="${26*scale}" cy="${6*scale}" r="${2*scale}" fill="#e74c3c"/>
  <text x="${26*scale}" y="${6.8*scale}" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-weight="bold" font-size="${2.5*scale}">A</text>
</svg>`;
};

// Create maskable icon template (with safe area) - go-kart theme
const createMaskableIcon = (size, isAdmin = false) => {
  const scale = size / 32; // Scale factor based on original 32x32 favicon
  const kartColor = isAdmin ? '#e74c3c' : '#2b9ce6';
  const safeAreaPadding = size * 0.1; // 10% padding for safe area
  const kartScale = 0.8; // Reduce size by 20% for safe area
  
  return `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <!-- Full background for maskable -->
  <rect width="${size}" height="${size}" fill="#1a2332"/>
  
  <!-- Centered and scaled go-kart design -->
  <g transform="translate(${safeAreaPadding}, ${safeAreaPadding}) scale(${kartScale})">
    <!-- Go-kart body -->
    <path d="M${8*scale} ${18*scale} L${22*scale} ${18*scale} C${23*scale} ${18*scale} ${24*scale} ${17*scale} ${24*scale} ${16*scale} L${24*scale} ${14*scale} C${24*scale} ${13*scale} ${23*scale} ${12*scale} ${22*scale} ${12*scale} L${8*scale} ${12*scale} C${7*scale} ${12*scale} ${6*scale} ${13*scale} ${6*scale} ${14*scale} L${6*scale} ${16*scale} C${6*scale} ${17*scale} ${7*scale} ${18*scale} ${8*scale} ${18*scale} Z" fill="${kartColor}"/>
    
    <!-- Driver helmet -->
    <circle cx="${18*scale}" cy="${10*scale}" r="${3.5*scale}" fill="${kartColor}"/>
    <path d="M${16*scale} ${8*scale} L${20*scale} ${8*scale} C${20.5*scale} ${8*scale} ${21*scale} ${8.5*scale} ${21*scale} ${9*scale} L${21*scale} ${10*scale} C${21*scale} ${10.5*scale} ${20.5*scale} ${11*scale} ${20*scale} ${11*scale} L${16*scale} ${11*scale} C${15.5*scale} ${11*scale} ${15*scale} ${10.5*scale} ${15*scale} ${10*scale} L${15*scale} ${9*scale} C${15*scale} ${8.5*scale} ${15.5*scale} ${8*scale} ${16*scale} ${8*scale} Z" fill="white"/>
    
    <!-- Wheels -->
    <circle cx="${10*scale}" cy="${20*scale}" r="${2.5*scale}" fill="#1a2332" stroke="${kartColor}" stroke-width="${1*scale}"/>
    <circle cx="${20*scale}" cy="${20*scale}" r="${2.5*scale}" fill="#1a2332" stroke="${kartColor}" stroke-width="${1*scale}"/>
    
    <!-- Speed lines -->
    <path d="M${4*scale} ${14*scale} L${6*scale} ${14*scale}" stroke="#f59e0b" stroke-width="${1.5*scale}" stroke-linecap="round"/>
    <path d="M${3*scale} ${16*scale} L${5*scale} ${16*scale}" stroke="#f59e0b" stroke-width="${1.5*scale}" stroke-linecap="round"/>
    
    <!-- Checkered flag -->
    <rect x="${24*scale}" y="${8*scale}" width="${4*scale}" height="${3*scale}" fill="white"/>
    <rect x="${24*scale}" y="${8*scale}" width="${2*scale}" height="${1.5*scale}" fill="#1a2332"/>
    <rect x="${26*scale}" y="${9.5*scale}" width="${2*scale}" height="${1.5*scale}" fill="#1a2332"/>
    
    ${isAdmin ? `<!-- Admin badge -->
    <circle cx="${26*scale}" cy="${6*scale}" r="${2*scale}" fill="#e74c3c"/>
    <text x="${26*scale}" y="${6.8*scale}" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-weight="bold" font-size="${2.5*scale}">A</text>` : ''}
  </g>
</svg>`;
};

// Create shortcut icons
const createShortcutIcon = (size, type) => {
  const icons = {
    'event': { emoji: '🏁', bg: '#3498db' },
    'profile': { emoji: '👤', bg: '#27ae60' },
    'apps': { emoji: '📋', bg: '#f39c12' },
    'recovery': { emoji: '🔧', bg: '#e74c3c' }
  };
  
  const config = icons[type] || icons.event;
  
  return `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="${config.bg}" rx="${size * 0.2}"/>
  <text x="${size/2}" y="${size/2 + size * 0.1}" text-anchor="middle" font-size="${size * 0.5}">${config.emoji}</text>
</svg>`;
};

// Generate all icons
console.log('🎨 Generating PWA icons...');

const iconsDir = path.join(__dirname, '..', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Generate member icons
iconSizes.forEach(size => {
  const memberIcon = createMemberIcon(size);
  fs.writeFileSync(path.join(iconsDir, `icon-${size}x${size}.svg`), memberIcon);
  console.log(`✅ Created member icon: icon-${size}x${size}.svg`);
});

// Generate admin icons
iconSizes.forEach(size => {
  const adminIcon = createAdminIcon(size);
  fs.writeFileSync(path.join(iconsDir, `admin-icon-${size}x${size}.svg`), adminIcon);
  console.log(`✅ Created admin icon: admin-icon-${size}x${size}.svg`);
});

// Generate maskable icons
[192, 512].forEach(size => {
  const memberMaskable = createMaskableIcon(size, false);
  const adminMaskable = createMaskableIcon(size, true);
  
  fs.writeFileSync(path.join(iconsDir, `icon-${size}x${size}-maskable.svg`), memberMaskable);
  fs.writeFileSync(path.join(iconsDir, `admin-icon-${size}x${size}-maskable.svg`), adminMaskable);
  
  console.log(`✅ Created maskable icons: ${size}x${size}`);
});

// Generate shortcut icons
const shortcuts = ['event', 'profile', 'apps', 'recovery'];
shortcuts.forEach(type => {
  const shortcutIcon = createShortcutIcon(96, type);
  fs.writeFileSync(path.join(iconsDir, `${type}-shortcut-96x96.svg`), shortcutIcon);
  console.log(`✅ Created shortcut icon: ${type}-shortcut-96x96.svg`);
});

console.log('\n🎉 All PWA icons generated successfully!');
console.log('📁 Icons saved to: /icons/');
console.log('\n💡 Note: SVG icons will work for PWA, but for best compatibility,');
console.log('   consider converting to PNG using a tool like ImageMagick or online converter.');