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

      console.log("[SAVE_HISTORY] Saving with EXACT precision (no rounding):", {
        originalStart: start,
        originalEnd: end,
        exactStart,
        exactEnd,
        source,
        precision: "EXACT_NO_ROUNDING"
      });

      state.setUndoHistory((prev) => {
        // Check duplicate with ultra-tight tolerance for absolute precision
        const lastRegion = prev[prev.length - 1];

        if (lastRegion) {
          // Use ultra-tight tolerance for exact comparison
          const startDiff = Math.abs(lastRegion.start - newRegion.start);
          const endDiff = Math.abs(lastRegion.end - newRegion.end);
          const isDuplicate = startDiff < 0.0000001 && endDiff < 0.0000001; // Ultra-tight: 1/10,000,000

          if (isDuplicate) {
            console.log("[SAVE_HISTORY] Skipping duplicate region (ultra-precise check):", {
              startDiff,
              endDiff,
              threshold: 0.0000001
            });
            return prev;
          }
        }

        const newHistory = [...prev, newRegion];

        if (newHistory.length > maxHistorySize) {
          newHistory.shift();
        }

        console.log("[SAVE_HISTORY] ✅ Added new region to history with EXACT precision:", {
          region: newRegion,
          historyLength: newHistory.length
        });
        return newHistory;
      });

      // Clear redo history when new action occurs
      if (state.redoHistory.length > 0) {
        state.setRedoHistory([]);
        console.log("[SAVE_HISTORY] Cleared redo history");
      }
    },
    [state.setUndoHistory, state.setRedoHistory, state.redoHistory.length]
  );

  // Handle Undo
  const handleUndo = useCallback(() => {
    console.log("[UNDO] handleUndo called, undoHistory.length:", state.undoHistory.length);
    
    if (state.undoHistory.length === 0) {
      console.log("[UNDO] No history to undo");
      return;
    }

    // Get current region BEFORE making changes
    const currentRegion = state.waveformRef.current?.getRegionBounds();
    if (!currentRegion) {
      console.error("[UNDO] Cannot get current region bounds");
      return;
    }

    // Get previous state BEFORE modifying undo history
    const previousState = state.undoHistory[state.undoHistory.length - 1];
    console.log("[UNDO] Previous state (EXACT):", previousState);
    console.log("[UNDO] Current region:", currentRegion);

    // Check for significant change (still use reasonable threshold for comparison)
    const startDiff = Math.abs(currentRegion.start - previousState.start);
    const endDiff = Math.abs(currentRegion.end - previousState.end);
    const hasSignificantChange = startDiff > 0.0001 || endDiff > 0.0001;

    if (!hasSignificantChange) {
      console.log("[UNDO] No significant change detected, forcing undo for debug");
    }

    // Save current state to redo stack with EXACT precision
    const currentState = {
      start: currentRegion.start, // ✅ EXACT: No rounding when saving current state
      end: currentRegion.end, // ✅ EXACT: No rounding when saving current state
      timestamp: Date.now(),
      source: "undo_save",
    };

    console.log("[UNDO] Saving current state to redo with EXACT precision:", currentState);

    // Update histories atomically
    state.setUndoHistory((prev) => {
      const newHistory = prev.slice(0, -1);
      console.log("[UNDO] New undo history length:", newHistory.length);
      return newHistory;
    });
    
    state.setRedoHistory((prev) => {
      const newHistory = [...prev, currentState];
      console.log("[UNDO] New redo history length:", newHistory.length);
      return newHistory;
    });

    // Apply previous state with ABSOLUTE EXACT precision
    if (state.waveformRef.current) {
      try {
        console.log("[UNDO] Applying ABSOLUTE EXACT previous state:", {
          targetStart: previousState.start,
          targetEnd: previousState.end,
          currentStart: currentRegion.start,
          currentEnd: currentRegion.end,
          precision: "ABSOLUTE_EXACT"
        });
        
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

          console.log("[UNDO] ✅ Undo completed with ABSOLUTE EXACT precision:", {
            restoredStart: previousState.start,
            restoredEnd: previousState.end,
            startMatches: state.startRef.current === previousState.start,
            endMatches: state.endRef.current === previousState.end
          });
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
    console.log("[REDO] handleRedo called, redoHistory.length:", state.redoHistory.length);
    
    if (state.redoHistory.length === 0) {
      console.log("[REDO] No redo history available");
      return;
    }

    // Get current region BEFORE making changes
    const currentRegion = state.waveformRef.current?.getRegionBounds();
    if (!currentRegion) {
      console.error("[REDO] Cannot get current region bounds");
      return;
    }

    // Get redo state BEFORE modifying redo history
    const redoState = state.redoHistory[state.redoHistory.length - 1];
    console.log("[REDO] Redo state (EXACT):", redoState);
    console.log("[REDO] Current region:", currentRegion);

    // Check for significant change
    const startDiff = Math.abs(currentRegion.start - redoState.start);
    const endDiff = Math.abs(currentRegion.end - redoState.end);
    const hasSignificantChange = startDiff > 0.001 || endDiff > 0.001;

    if (!hasSignificantChange) {
      console.log("[REDO] No significant change detected, skipping redo");
      return;
    }

    // Save current state to undo stack with EXACT precision
    const currentState = {
      start: currentRegion.start, // ✅ EXACT: No rounding when saving current state
      end: currentRegion.end,     // ✅ EXACT: No rounding when saving current state
      timestamp: Date.now(),
      source: "redo_save",
    };

    console.log("[REDO] Saving current state to undo with EXACT precision:", currentState);

    // Update histories atomically
    state.setRedoHistory((prev) => {
      const newHistory = prev.slice(0, -1);
      console.log("[REDO] New redo history length:", newHistory.length);
      return newHistory;
    });
    
    state.setUndoHistory((prev) => {
      const newHistory = [...prev, currentState];
      console.log("[REDO] New undo history length:", newHistory.length);
      return newHistory;
    });

    // Apply redo state with ABSOLUTE EXACT precision
    if (state.waveformRef.current) {
      try {
        console.log("[REDO] Applying ABSOLUTE EXACT redo state:", {
          targetStart: redoState.start,
          targetEnd: redoState.end,
          currentStart: currentRegion.start,
          currentEnd: currentRegion.end,
          precision: "ABSOLUTE_EXACT"
        });
        
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

          console.log("[REDO] ✅ Redo completed with ABSOLUTE EXACT precision:", {
            restoredStart: redoState.start,
            restoredEnd: redoState.end,
            startMatches: state.startRef.current === redoState.start,
            endMatches: state.endRef.current === redoState.end
          });
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