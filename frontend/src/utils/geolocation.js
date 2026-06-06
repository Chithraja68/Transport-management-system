// =====================================================
// GPS UTILITY FUNCTIONS
// File: src/utils/geolocation.js
// =====================================================

/**
 * Calculate distance between two GPS coordinates using Haversine formula
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Format distance for display
 */
export const formatDistance = (distanceKm) => {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} meters`;
  }
  return `${distanceKm.toFixed(1)} km`;
};

/**
 * Calculate estimated time of arrival
 */
export const calculateETA = (distanceKm, speedKmh) => {
  if (speedKmh <= 0) return 'Stationary';
  const hours = distanceKm / speedKmh;
  const minutes = Math.round(hours * 60);
  
  if (minutes < 1) return 'Less than 1 min';
  if (minutes < 60) return `${minutes} min`;
  
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hrs}h ${mins}m`;
};

/**
 * Get user's current location
 */
export const getCurrentPosition = () => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          heading: position.coords.heading,
          speed: position.coords.speed ? position.coords.speed * 3.6 : 0,
        });
      },
      (error) => {
        reject(error);
      },
      {
        enableHighAccuracy: false,
        timeout: 30000,
        maximumAge: 10000,
      }
    );
  });
};

/**
 * Watch user's position continuously
 */
export const watchPosition = (callback) => {
  if (!navigator.geolocation) {
    console.error('Geolocation is not supported');
    return null;
  }

  return navigator.geolocation.watchPosition(
    (position) => {
      callback({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        heading: position.coords.heading,
        speed: position.coords.speed ? position.coords.speed * 3.6 : 0,
        timestamp: new Date(position.timestamp),
      });
    },
    (error) => {
      console.error('Error watching position:', error);
    },
    {
      enableHighAccuracy: false,
      timeout: 15000,
      maximumAge: 10000,
    }
  );
};

/**
 * Clear position watch
 */
export const clearWatch = (watchId) => {
  if (watchId && navigator.geolocation) {
    navigator.geolocation.clearWatch(watchId);
  }
};

/**
 * Convert heading to compass direction
 */
export const headingToDirection = (heading) => {
  if (heading === null || heading === undefined) return 'Unknown';
  
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(heading / 45) % 8;
  return directions[index];
};

/**
 * Check if GPS coordinates are valid
 */
export const isValidCoordinate = (latitude, longitude) => {
  return (
    latitude >= -90 && latitude <= 90 &&
    longitude >= -180 && longitude <= 180
  );
};

/**
 * Get battery level from Battery API
 */
export const getBatteryLevel = async () => {
  if ('getBattery' in navigator) {
    try {
      const battery = await navigator.getBattery();
      return Math.round(battery.level * 100);
    } catch (error) {
      console.error('Error getting battery level:', error);
      return null;
    }
  }
  return null;
};