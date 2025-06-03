import { useCallback } from 'react';

export const useRegionHistory = (state) => {
  const maxHistorySize = 20;

  // Save region to history
  const saveRegionToHistory = useCallback(
    (start, end, source = "manual") => {
      // ✅ ULTRA-HIGH PRECISION: Store EXACT values without any rounding
      const exactStart = start; // No rounding - store exact value
      const exactEnd = end; // No rounding - store exact value

      const newRegion = {
        start: exactStart,
        end: exactEnd,
        timestamp: Date.now(),
        source,
      };

      state.setUndoHistory((prev) => {
        // Check duplicate with ultra-tight tolerance for absolute precision
        const lastRegion = prev[prev.length - 1];

        if (lastRegion) {
          // Use ultra-tight tolerance for exact comparison
          const startDiff = Math.abs(lastRegion.start - newRegion.start);
          const endDiff = Math.abs(lastRegion.end - newRegion.end);
          const isDuplicate = startDiff < 0.0000001 && endDiff < 0.0000001; // Ultra-tight: 1/10,000,000

          if (isDuplicate) {

            return prev;
          }
        }

        const newHistory = [...prev, newRegion];

        if (newHistory.length > maxHistorySize) {
          newHistory.shift();
        }

        return newHistory;
      });

      // Clear redo history when new action occurs
      if (state.redoHistory.length > 0) {
        state.setRedoHistory([]);
      }
    },
    [state.setUndoHistory, state.setRedoHistory, state.redoHistory.length]
  );

  // Handle Undo
  const handleUndo = useCallback(() => {
    
    if (state.undoHistory.length === 0) {
      return;
    }

    // Get current region BEFORE making changes
    const currentRegion = state.waveformRef.current?.getRegionBounds();
    if (!currentRegion) {
      return;
    }

    // Get previous state BEFORE modifying undo history
    const previousState = state.undoHistory[state.undoHistory.length - 1];
    // Check for significant change (still use reasonable threshold for comparison)
    const startDiff = Math.abs(currentRegion.start - previousState.start);
    const endDiff = Math.abs(currentRegion.end - previousState.end);
    const hasSignificantChange = startDiff > 0.0001 || endDiff > 0.0001;

    if (!hasSignificantChange) {
    }

    // Save current state to redo stack with EXACT precision
    const currentState = {
      start: currentRegion.start, // ✅ EXACT: No rounding when saving current state
      end: currentRegion.end, // ✅ EXACT: No rounding when saving current state
      timestamp: Date.now(),
      source: "undo_save",
    };


    // Update histories atomically
    state.setUndoHistory((prev) => {
      const newHistory = prev.slice(0, -1);
      return newHistory;
    });
    
    state.setRedoHistory((prev) => {
      const newHistory = [...prev, currentState];
      return newHistory;
    });

    // Apply previous state with ABSOLUTE EXACT precision
    if (state.waveformRef.current) {
      try {
        
        const success = state.waveformRef.current.setRegionBounds(
          previousState.start, // ✅ EXACT values - no rounding
          previousState.end    // ✅ EXACT values - no rounding
        );

        if (success) {
          // ✅ CRITICAL: Update refs with ABSOLUTE EXACT precision
          state.startRef.current = previousState.start; // ✅ EXACT - no rounding
          state.endRef.current = previousState.end;     // ✅ EXACT - no rounding
          state.setDisplayStart(previousState.start.toFixed(2));
          state.setDisplayEnd(previousState.end.toFixed(2));

        } else {
          console.error("[UNDO] ❌ Failed to set region bounds");
          // Rollback on failure
          state.setUndoHistory((prev) => [...prev, previousState]);
          state.setRedoHistory((prev) => prev.slice(0, -1));
        }
      } catch (error) {
        console.error("[UNDO] ❌ Error applying undo:", error);
        // Rollback on error
        state.setUndoHistory((prev) => [...prev, previousState]);
        state.setRedoHistory((prev) => prev.slice(0, -1));
      }
    }
  }, [
    state.undoHistory, 
    state.waveformRef, 
    state.startRef, 
    state.endRef, 
    state.setDisplayStart, 
    state.setDisplayEnd, 
    state.setUndoHistory, 
    state.setRedoHistory
  ]);

  // Handle Redo
  const handleRedo = useCallback(() => {
    
    if (state.redoHistory.length === 0) {
      return;
    }

    // Get current region BEFORE making changes
    const currentRegion = state.waveformRef.current?.getRegionBounds();
    if (!currentRegion) {
      return;
    }

    // Get redo state BEFORE modifying redo history
    const redoState = state.redoHistory[state.redoHistory.length - 1];

    // Check for significant change
    const startDiff = Math.abs(currentRegion.start - redoState.start);
    const endDiff = Math.abs(currentRegion.end - redoState.end);
    const hasSignificantChange = startDiff > 0.001 || endDiff > 0.001;

    if (!hasSignificantChange) {
      return;
    }

    // Save current state to undo stack with EXACT precision
    const currentState = {
      start: currentRegion.start, // ✅ EXACT: No rounding when saving current state
      end: currentRegion.end,     // ✅ EXACT: No rounding when saving current state
      timestamp: Date.now(),
      source: "redo_save",
    };


    // Update histories atomically
    state.setRedoHistory((prev) => {
      const newHistory = prev.slice(0, -1);
      return newHistory;
    });
    
    state.setUndoHistory((prev) => {
      const newHistory = [...prev, currentState];
      return newHistory;
    });

    // Apply redo state with ABSOLUTE EXACT precision
    if (state.waveformRef.current) {
      try {
        
        const success = state.waveformRef.current.setRegionBounds(
          redoState.start, // ✅ EXACT values - no rounding
          redoState.end    // ✅ EXACT values - no rounding
        );

        if (success) {
          // ✅ CRITICAL: Update refs with ABSOLUTE EXACT precision
          state.startRef.current = redoState.start; // ✅ EXACT - no rounding
          state.endRef.current = redoState.end;     // ✅ EXACT - no rounding
          state.setDisplayStart(redoState.start.toFixed(2));
          state.setDisplayEnd(redoState.end.toFixed(2));

        } else {
          console.error("[REDO] ❌ Failed to set region bounds");
          // Rollback on failure
          state.setRedoHistory((prev) => [...prev, redoState]);
          state.setUndoHistory((prev) => prev.slice(0, -1));
        }
      } catch (error) {
        console.error("[REDO] ❌ Error applying redo:", error);
        // Rollback on error
        state.setRedoHistory((prev) => [...prev, redoState]);
        state.setUndoHistory((prev) => prev.slice(0, -1));
      }
    }
  }, [
    state.redoHistory, 
    state.waveformRef, 
    state.startRef, 
    state.endRef, 
    state.setDisplayStart, 
    state.setDisplayEnd, 
    state.setUndoHistory, 
    state.setRedoHistory
  ]);

  return {
    saveRegionToHistory,
    handleUndo,
    handleRedo,
  };
};