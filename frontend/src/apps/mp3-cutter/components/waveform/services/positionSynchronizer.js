/**
 * Tạo position synchronizer để đồng bộ vị trí playback
 */
export const createPositionSynchronizer = () => {
  let isSyncing = false;
  let lastSyncTime = 0;
  
  const syncPositions = (newPosition, source = "unknown", callbacks = {}) => {
    if (isSyncing) return; // Prevent recursive syncing
  
    const now = performance.now();
    const timeSinceLastSync = now - lastSyncTime;
  
    // Only sync if enough time has passed or if this is a forced sync
    if (timeSinceLastSync < 16 && source !== "force") return; // ~60fps limit
  
    isSyncing = true;
    lastSyncTime = now;
  
    try {
      // Update master position
      if (callbacks.syncPositionRef) {
        callbacks.syncPositionRef.current = newPosition;
      }
      if (callbacks.currentPositionRef) {
        callbacks.currentPositionRef.current = newPosition;
      }
      if (callbacks.lastPositionRef) {
        callbacks.lastPositionRef.current = newPosition;
      }
  
      // Update UI time display
      if (callbacks.setCurrentTime) {
        callbacks.setCurrentTime(newPosition);
      }
      if (callbacks.onTimeUpdate) {
        callbacks.onTimeUpdate(newPosition);
      }
      // ✅ NEW: Update current position for tooltip
      if (callbacks.setCurrentPosition) {
        callbacks.setCurrentPosition(newPosition);
      }
    } finally {
      isSyncing = false;
    }
  };
  
  return {
    syncPositions,
    getSyncState: () => ({ isSyncing, lastSyncTime })
  };
}; 