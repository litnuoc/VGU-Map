# VGUMap - Refactored Codebase

## Overview

This repository contains the VGUMap application - a room and building lookup system for Vietnamese-German University. The codebase has been refactored to improve maintainability, readability, and separation of concerns.

## Project Structure

```
/workspace/
├── index.html              # Main application (single-page app)
├── main.js                 # Main JavaScript entry point (1114 lines)
├── main.css                # Application styles
├── styles.css              # Additional styles
├── floors-config.json      # Floor configuration data
├── info_data.json          # Cached room information
├── drive_data.json         # Cached drive image mappings
├── campus-buildings.json   # Campus buildings GeoJSON
├── js/                     # Modular JavaScript components (NEW)
│   ├── config.js           # Centralized configuration & constants
│   ├── data-service.js     # Data fetching and processing utilities
│   ├── renderer.js         # SVG map rendering logic
│   ├── room-service.js     # Room data lookup and management
│   └── README.md           # Module documentation
├── vue/                    # Vue/Nuxt components
│   ├── app.vue             # Vue app entry point
│   ├── index.vue           # Main page component
│   └── *.vue               # Other Vue components
├── components/             # Reusable Vue components
│   ├── HologramMap.vue     # MapLibre map component
│   ├── RoomDetailPanel.vue # Room detail panel
│   └── MapVGU.vue          # Legacy map component
├── composables/            # Vue composables
│   └── useVguData.js       # Data management composable
├── content/                # Nuxt Content markdown files
│   ├── labs/               # Lab room documentation
│   └── equipment/          # Equipment documentation
├── md/                     # Documentation files
│   ├── REFACTORING.md      # This file
│   ├── NUXT_REFACTORING.md # Nuxt migration guide
│   ├── README.md           # Project overview
│   └── SETUP_INSTRUCTIONS.md
├── json-tung/              # Legacy JSON data (backup)
└── models/                 # 3D GLB models
```

## Refactoring Changes

### 1. **Modular Architecture** (`/js/` directory)

The monolithic inline JavaScript in `index.html` has been extracted into separate, purpose-built modules:

#### `config.js`
- Centralized all configuration constants
- API endpoints
- Building definitions
- Floor and room mappings
- Color themes and styling constants
- Application state structure

**Benefits:**
- Single source of truth for configuration
- Easy to update API endpoints or building data
- Consistent constants across the application

#### `data-service.js`
- Encapsulated data fetching logic
- Standardized error handling
- Data transformation utilities
- Floor-based filtering
- Room path construction

**Benefits:**
- Reusable data operations
- Clear separation from UI logic
- Testable data layer

#### `renderer.js`
- SVG generation from map data
- ViewBox calculation with proper scaling
- Dynamic font sizing for room labels
- Room color determination
- Placeholder rendering

**Benefits:**
- Isolated rendering logic
- Consistent visual output
- Easy to modify styling

#### `room-service.js`
- Room detail lookup
- Fallback data management
- Room categorization
- Type-based color theming

**Benefits:**
- Centralized room data access
- Graceful degradation with fallback data

### 2. **Improved `fetch_sheets.js`**

The cron script has been restructured with:
- Clear section separators using visual dividers
- Consolidated configuration object
- Streamlined task execution loop
- Better error messages
- Reduced code duplication

**Before:** Three separate try-catch blocks for each API
**After:** Single loop over task configuration array

### 3. **Code Quality Improvements**

- **JSDoc Comments**: All functions now have proper documentation
- **Consistent Naming**: Variables and functions follow consistent naming conventions
- **Error Handling**: Standardized error handling patterns
- **DRY Principle**: Eliminated code duplication
- **Single Responsibility**: Each function/module has one clear purpose

## Usage

### Running the Data Sync Script

```bash
# Manual execution
node fetch_sheets.js

# Cron setup (every 10 minutes)
crontab -e
# Add: 0/10 * * * * /usr/bin/node /path/to/fetch_sheets.js
```

### Using the Modular JavaScript

To use the refactored modules in a modern build setup:

```html
<script type="module">
  import { BUILDINGS, FLOOR_ROOMS } from './js/config.js';
  import { loadMapData, loadRoomInfo } from './js/data-service.js';
  import { renderFloorMap } from './js/renderer.js';
  import { getRoomDetails } from './js/room-service.js';
  
  // Your application code here
</script>
```

**Note:** The current `index.html` still contains inline JavaScript for backward compatibility. To fully adopt the modular architecture, the inline scripts should be migrated to use these ES6 modules.

## Migration Guide

To complete the migration to the modular architecture:

1. **Replace inline configuration** in `index.html` with imports from `config.js`
2. **Replace data fetching** code with `data-service.js` functions
3. **Replace map rendering** logic with `renderer.js` functions
4. **Replace room lookup** code with `room-service.js` functions

Example migration:

```javascript
// OLD: Inline configuration
const BLDS = [{id:'bld_ad',name:'Admin Building',act:true,fl:6}, ...];

// NEW: Import from module
import { BUILDINGS } from './js/config.js';
```

## Benefits of Refactoring

1. **Maintainability**: Easier to find and update specific functionality
2. **Testability**: Individual modules can be unit tested
3. **Reusability**: Functions can be reused across different parts of the app
4. **Readability**: Clear separation of concerns with documented interfaces
5. **Scalability**: Easier to add new features without affecting existing code
6. **Debugging**: Easier to trace and fix issues in isolated modules

## Next Steps

1. Migrate `index.html` to use ES6 modules
2. Add unit tests for each module
3. Implement a build process (e.g., Webpack, Vite) for production
4. Add TypeScript for type safety
5. Implement proper state management

## License

VGUMap - Vietnamese-German University Map System

### 2. **Code Quality Improvements**

- **JSDoc Comments**: All functions now have proper documentation with parameter types and return values
- **Consistent Naming**: Variables and functions follow consistent naming conventions (camelCase for functions, UPPER_CASE for constants)
- **Error Handling**: Standardized error handling patterns with descriptive error messages
- **DRY Principle**: Eliminated code duplication by extracting common utilities
- **Single Responsibility**: Each function/module has one clear purpose
- **ES6 Modules**: Proper import/export structure for better dependency management

### 3. **New Module Features**

#### `config.js` - Centralized Configuration
- Exports all magic numbers and constants
- Provides `createInitialState()` factory function
- Theme colors in single location
- API endpoints configuration
- Building and cluster metadata

#### `data-service.js` - Data Layer
- UTF-8 safe JSON fetching
- Parallel data loading with `Promise.all()`
- Data transformation utilities
- Floor-based filtering
- Room normalization helpers

#### `renderer.js` - Visualization
- SVG floor plan rendering
- Dynamic font sizing based on room area
- Department-based color theming
- Room highlighting utilities
- Bounding box calculations

#### `room-service.js` - Business Logic
- Room lookup with fallback data
- Room categorization (lab types, classrooms, offices)
- Search and filter functionality
- Room grouping and sorting
- Data validation

## Usage Examples

### Using the Modular JavaScript

```html
<script type="module">
  import { BUILDINGS, MAP_CONFIG } from './js/config.js';
  import { loadRoomInfo, syncAllData } from './js/data-service.js';
  import { renderFloorPlan, getPolygonCentroid } from './js/renderer.js';
  import { getRoomDetails, searchRooms } from './js/room-service.js';
  
  // Initialize app
  const state = createInitialState();
  
  // Load data
  const data = await syncAllData();
  
  // Render floor plan
  const svgEl = document.getElementById('floorplan');
  renderFloorPlan(data.map, svgEl);
  
  // Search rooms
  const results = searchRooms('computer lab', data.labs);
</script>
```

### Migration from main.js

To migrate the existing `main.js` to use these modules:

1. **Replace inline constants:**
```javascript
// OLD
const BLDS = [{id:'cluster-1',name:'Materials Science',...}];
const buildingCenters = {'cluster-1': [106.6150547, 11.1086567], ...};

// NEW
import { BUILDINGS, BUILDING_CENTERS } from './js/config.js';
```

2. **Replace data fetching:**
```javascript
// OLD
const res = await fetch('/info_data.json');
const data = await res.json();

// NEW
import { loadRoomInfo } from './js/data-service.js';
const data = await loadRoomInfo();
```

3. **Replace utility functions:**
```javascript
// OLD
function getPolygonCentroid(coordinates) { ... }

// NEW
import { getPolygonCentroid } from './js/renderer.js';
```

4. **Replace room lookups:**
```javascript
// OLD
const room = roomsData.find(r => r.room_id === roomId);

// NEW
import { getRoomDetails } from './js/room-service.js';
const room = getRoomDetails(roomId, roomsData);
```

## Benefits of Refactoring

1. **Maintainability**: Easier to find and update specific functionality
2. **Testability**: Individual modules can be unit tested in isolation
3. **Reusability**: Functions can be reused across different parts of the app or in other projects
4. **Readability**: Clear separation of concerns with documented interfaces
5. **Scalability**: Easier to add new features without affecting existing code
6. **Debugging**: Easier to trace and fix issues in isolated modules
7. **Performance**: Enables code splitting and tree shaking in builds
8. **Collaboration**: Multiple developers can work on different modules simultaneously

## Testing

Each module can be tested independently:

```javascript
// Example test for config.js
import { BUILDINGS, MAP_CONFIG } from './js/config.js';

describe('Config Module', () => {
  test('BUILDINGS should be an array', () => {
    expect(Array.isArray(BUILDINGS)).toBe(true);
  });
  
  test('MAP_CONFIG should have defaultCenter', () => {
    expect(MAP_CONFIG.defaultCenter).toBeDefined();
  });
});

// Example test for data-service.js
import { fetchJson } from './js/data-service.js';

describe('Data Service', () => {
  test('fetchJson should handle errors', async () => {
    await expect(fetchJson('/invalid-url')).rejects.toThrow();
  });
});
```

## Next Steps

1. ✅ **Create modular architecture** - COMPLETED
2. **Migrate `main.js`** - Update to use ES6 modules (recommended)
3. **Add unit tests** - Create test suite for each module
4. **TypeScript migration** - Add type safety with TypeScript
5. **Build process** - Implement bundling with Vite or Webpack
6. **Documentation** - Generate API docs with JSDoc
7. **Performance optimization** - Implement lazy loading for modules
8. **Vue/Nuxt integration** - Use modules in Vue components via composables

## Module Documentation

For detailed documentation on each module, see `/workspace/js/README.md`

## License

VGUMap - Vietnamese-German University Map System
