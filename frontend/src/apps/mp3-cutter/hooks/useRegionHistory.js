import { useCallback } from 'react';

export const useRegionHistory = (state) => {
  const maxHistorySize = 20;

  // Save region to history
  const saveRegionToHistory = useCallback(
    (start, end, source = "manual") => {
      // Use Math.round for precise values instead of toFixed + parseFloat
      const preciseStart = Math.round(start * 10000) / 10000;
      const preciseEnd = Math.round(end * 10000) / 10000;

      const newRegion = {
        start: preciseStart,
        end: preciseEnd,
        timestamp: Date.now(),
        source,
      };

      state.setUndoHistory((prev) => {
        // Check duplicate with tolerance
        const lastRegion = prev[prev.length - 1];

        if (lastRegion) {
          const startDiff = Math.abs(lastRegion.start - newRegion.start);
          const endDiff = Math.abs(lastRegion.end - newRegion.end);
          const isDuplicate = startDiff < 0.001 && endDiff < 0.001;

          if (isDuplicate) {
            console.log("[SAVE_HISTORY] Skipping duplicate region");
            return prev;
          }
        }

        const newHistory = [...prev, newRegion];

        if (newHistory.length > maxHistorySize) {
          newHistory.shift();
        }

        console.log("[SAVE_HISTORY] Added new region to history:", newRegion);
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
    console.log("[UNDO] Previous state:", previousState);
    console.log("[UNDO] Current region:", currentRegion);

    // Check for significant change
    const startDiff = Math.abs(currentRegion.start - previousState.start);
    const endDiff = Math.abs(currentRegion.end - previousState.end);
    const hasSignificantChange = startDiff > 0.0001 || endDiff > 0.0001;

    if (!hasSignificantChange) {
      console.log("[UNDO] No significant change detected, forcing undo for debug");
    }

    // Save current state to redo stack
    const currentState = {
      start: parseFloat(currentRegion.start.toFixed(4)),
      end: parseFloat(currentRegion.end.toFixed(4)),
      timestamp: Date.now(),
      source: "undo_save",
    };

    console.log("[UNDO] Saving current state to redo:", currentState);

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

    // Apply previous state
    if (state.waveformRef.current) {
      try {
        console.log("[UNDO] Applying previous state:", previousState.start, "->", previousState.end);
        
        const success = state.waveformRef.current.setRegionBounds(
          previousState.start,
          previousState.end
        );

        if (success) {
          // Update refs and display
          state.startRef.current = previousState.start;
          state.endRef.current = previousState.end;
          state.setDisplayStart(previousState.start.toFixed(2));
          state.setDisplayEnd(previousState.end.toFixed(2));

          console.log("[UNDO] ✅ Undo completed successfully");
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
    console.log("[REDO] Redo state:", redoState);
    console.log("[REDO] Current region:", currentRegion);

    // Check for significant change
    const startDiff = Math.abs(currentRegion.start - redoState.start);
    const endDiff = Math.abs(currentRegion.end - redoState.end);
    const hasSignificantChange = startDiff > 0.001 || endDiff > 0.001;

    if (!hasSignificantChange) {
      console.log("[REDO] No significant change detected, skipping redo");
      return;
    }

    // Save current state to undo stack
    const currentState = {
      start: parseFloat(currentRegion.start.toFixed(4)),
      end: parseFloat(currentRegion.end.toFixed(4)),
      timestamp: Date.now(),
      source: "redo_save",
    };

    console.log("[REDO] Saving current state to undo:", currentState);

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

    // Apply redo state
    if (state.waveformRef.current) {
      try {
        console.log("[REDO] Applying redo state:", redoState.start, "->", redoState.end);
        
        const success = state.waveformRef.current.setRegionBounds(
          redoState.start,
          redoState.end
        );

        if (success) {
          // Update refs and display
          state.startRef.current = redoState.start;
          state.endRef.current = redoState.end;
          state.setDisplayStart(redoState.start.toFixed(2));
          state.setDisplayEnd(redoState.end.toFixed(2));

          console.log("[REDO] ✅ Redo completed successfully");
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