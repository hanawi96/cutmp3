import { useEffect } from 'react';
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";
import { debounce } from "../utils/throttleDebounce.js";

/**
 * Hook quản lý khởi tạo WaveSurfer và RegionsPlugin
 * Tách từ WaveformSelector.jsx useEffect khởi tạo wavesurfer
 */
export const useWaveformSetup = (
  refs,
  state,
  setters,
  config,
  dependencies
) => {
  const {
    audioFile,
    theme,
    volume,
    normalizeAudio,
    onTimeUpdate,
    onRegionChange,
    onPlayStateChange,
    loop,
  } = config;

  const {
    setDuration,
    setLoading,
  } = setters;

  // Destructure state - ✅ FIXED: Get isPlaying from state, not setters
  const { isPlaying } = state;

  // Destructure dependencies
  const {
    colors,
    syncPositions,
    updateVolume,
    drawVolumeOverlay,
    updateDisplayValues,
    handleWaveformClick,
    updateRegionStyles,
    getThrottledFunction,
    getThrottledUpdateRegionStyles,
    getThrottledDraw,
    handlePlaybackEnd,
    handleLoopPlayback,
    PREVIEW_TIME_BEFORE_END
  } = dependencies;

  useEffect(() => {

    
    if (!audioFile) return;
    setLoading(true);

    // Capture the waveform ref early to avoid stale closure in cleanup
    const currentWaveformElement = refs.waveformRef.current;

    refs.throttledDrawRef.current = () => getThrottledDraw()();

    const ws = WaveSurfer.create({
      container: refs.waveformRef.current,
      waveColor: "#0984e3",
      progressColor: "#2563eb",
      height: 120,
      responsive: true,
      cursorColor: colors[theme].cursorColor,
      backend: "WebAudio",
      volume: Math.min(1, volume),
      barWidth: 2,
      barGap: 1,
      barRadius: 3,
      normalize: normalizeAudio,
      // ✅ FIXED: Use simple bar height for reliable waveform display
      barHeight: 1,
    });



    refs.waveformRef.current.addEventListener("click", handleWaveformClick);

    refs.wavesurferRef.current = ws;

    ws.on("ready", () => {

      
      const dur = ws.getDuration();
      setDuration(dur);
      setLoading(false);

      const plugin = ws.registerPlugin(
        RegionsPlugin.create({
          dragSelection: true,
          color: "transparent", // ✅ FIXED: Always transparent, no red for delete mode
          handleStyle: {
            borderColor: "transparent", // ✅ FIXED: Always transparent, no red border
            backgroundColor: "transparent", // ✅ FIXED: Always transparent, no red background
            width: "4px", // ✅ THÊM: Làm dày thanh handle lên 4px (mặc định là 3px)
          },
        })
      );

      refs.regionsPluginRef.current = plugin;

      // Create region with initial styles
      refs.regionRef.current = plugin.addRegion({
        start: 0,
        end: dur,
        color: "transparent", // ✅ FIXED: Always transparent, no red
        handleStyle: {
          borderColor: "transparent", // ✅ FIXED: Always transparent, no red border
          backgroundColor: "transparent", // ✅ FIXED: Always transparent, no red background
          width: "4px", // ✅ THÊM: Làm dày thanh handle lên 4px (mặc định là 3px)
        },
      });


      
      // ✅ THÊM: Update display values ngay sau khi tạo region

      setTimeout(() => {
        if (refs.regionRef.current) {
          updateDisplayValues("ws_ready_initial");

          // ✅ THÊM: Trigger onRegionChange để đảm bảo parent component được thông báo
          onRegionChange(0, dur, false, "initial_setup");
        }
      }, 100);

      // ✅ THÊM: Backup update sau khi tất cả đã ready
      setTimeout(() => {
        if (refs.regionRef.current) {

          updateDisplayValues("ws_ready_backup");
        }
      }, 500);

      // Add handlers for all region interactions
      if (refs.regionRef.current && refs.regionRef.current.on) {

        
        // Handle region updates (dragging, resizing) - với throttling
        refs.regionRef.current.on("update", () => {
          getThrottledUpdateRegionStyles()();
          // ✅ FIXED: Realtime redraw for both normal and delete modes
          const currentDeleteMode = refs.removeModeRef.current;
          if (dependencies.forceRedrawDimOverlay) {
            console.log("[REGION_UPDATE] Delete mode - realtime redraw during drag");
            dependencies.forceRedrawDimOverlay();
          }
        });

        // Handle region-updated event (after drag/resize completes)
        refs.regionRef.current.on("update-end", () => {
          updateRegionStyles();
          // ✅ FIXED: Realtime redraw for both normal and delete modes
          const currentDeleteMode = refs.removeModeRef.current;
          if (dependencies.forceRedrawDimOverlay) {
            if (currentDeleteMode) {
              console.log("[REGION_UPDATE_END] Delete mode - realtime redraw after drag");
              dependencies.forceRedrawDimOverlay();
            } else {
              console.log("[REGION_UPDATE_END] Normal mode - redrawing dim overlay after drag");
              dependencies.forceRedrawDimOverlay();
            }
          }
        });

        // Handle region-updated event (for any other updates)
        refs.regionRef.current.on("region-updated", () => {
          updateRegionStyles();
          // ✅ FIXED: Realtime redraw for both normal and delete modes
          const currentDeleteMode = refs.removeModeRef.current;
          if (dependencies.forceRedrawDimOverlay) {
            if (currentDeleteMode) {
              console.log("[REGION_UPDATED] Delete mode - realtime redraw after update");
              dependencies.forceRedrawDimOverlay();
            } else {
              console.log("[REGION_UPDATED] Normal mode - redrawing dim overlay after update");
              dependencies.forceRedrawDimOverlay();
            }
          }
        });

        // Optimized mouse interaction handlers
        if (refs.regionRef.current.element) {
          const element = refs.regionRef.current.element;

          // Debounced mouse interaction handler
          const getDebouncedStyleUpdate = () => {
            if (!refs.throttledFunctionsRef.current.debouncedStyleUpdate) {
              refs.throttledFunctionsRef.current.debouncedStyleUpdate = debounce(
                updateRegionStyles,
                50
              );
            }
            return refs.throttledFunctionsRef.current.debouncedStyleUpdate;
          };

          const handleMouseInteraction = () => {
            const currentDeleteMode = refs.removeModeRef.current;
            console.log("[MOUSE_INTERACTION] Triggered - currentDeleteMode:", currentDeleteMode);
            getDebouncedStyleUpdate()();
            
            // ✅ FIXED: Realtime redraw for both modes
            if (dependencies.forceRedrawDimOverlay) {
              setTimeout(() => {
                if (currentDeleteMode) {
                  console.log("[MOUSE_INTERACTION] Delete mode - realtime redrawing dim overlay");
                  dependencies.forceRedrawDimOverlay();
                } else {
                  console.log("[MOUSE_INTERACTION] Normal mode - delayed force redrawing dim overlay");
                  dependencies.forceRedrawDimOverlay();
                }
              }, 20);
            }
          };

          // Optimized realtime drag handler với transparent background
          const handleMouseMove = (e) => {
            if (!e || typeof e.buttons === "undefined") {
              console.warn("[handleMouseMove] Invalid event object:", e);
              return;
            }

            if (e.buttons !== 1 || !refs.regionRef.current?.element) return;

            const regionElement = refs.regionRef.current.element;

            // ✅ FIXED: Always transparent background and no border
            const bgColor = "transparent";
            const borderStyle = "none";

            if (regionElement.style.backgroundColor !== bgColor) {
              regionElement.style.backgroundColor = bgColor;
              regionElement.style.border = borderStyle;

              const regionElements =
                regionElement.getElementsByClassName("wavesurfer-region");
              for (let i = 0; i < regionElements.length; i++) {
                const el = regionElements[i];
                el.style.backgroundColor = bgColor;
                el.style.border = borderStyle;
              }

              // ✅ FIXED: Realtime redraw for both normal and delete modes
              const currentDeleteMode = refs.removeModeRef.current;
              if (dependencies.forceRedrawDimOverlay) {
                console.log("[MOUSE_MOVE] Background changed, scheduling dim overlay redraw - deleteMode:", currentDeleteMode);
                clearTimeout(window.dimOverlayRedrawTimeout);
                window.dimOverlayRedrawTimeout = setTimeout(() => {
                  dependencies.forceRedrawDimOverlay();
                }, 10);
              }
            }
          };

          // Throttled mouse move handler
          const getThrottledMouseMove = () => {
            return getThrottledFunction(
              "handleMouseMove",
              handleMouseMove,
              16
            );
          };

          // Add event listeners
          element.addEventListener("mouseup", handleMouseInteraction);
          element.addEventListener("mouseleave", handleMouseInteraction);
          element.addEventListener("mousemove", (event) => {
            const throttledFunc = getThrottledMouseMove();
            throttledFunc(event);
          });
          
          // ✅ CRITICAL FIX: Capture EXACT original values BEFORE any interaction
          element.addEventListener("mouseenter", () => {
            const currentDeleteMode = refs.removeModeRef.current;
            console.log("[MOUSE_ENTER] currentDeleteMode:", currentDeleteMode);
            
            // ✅ Pre-capture region values when mouse enters (before any click/drag)
            if (refs.regionRef.current) {
              const originalStart = refs.regionRef.current.start;
              const originalEnd = refs.regionRef.current.end;
              
              // Store original values with ultra-high precision
              refs.preDragRegionRef = refs.preDragRegionRef || { current: null };
              refs.preDragRegionRef.current = {
                start: originalStart,
                end: originalEnd,
                timestamp: Date.now(),
              };
            }
            
            // ✅ FIXED: Realtime redraw for both normal and delete modes
            if (dependencies.forceRedrawDimOverlay) {
              if (currentDeleteMode) {
                console.log("[MOUSE_ENTER] Delete mode - realtime redraw on enter");
                setTimeout(() => {
                  dependencies.forceRedrawDimOverlay();
                }, 50);
              } else {
                console.log("[MOUSE_ENTER] Normal mode - scheduling dim overlay redraw");
                setTimeout(() => {
                  dependencies.forceRedrawDimOverlay();
                }, 50);
              }
            }
          });

          element.addEventListener("mousedown", () => {

            // ✅ CRITICAL: ALWAYS capture fresh values at mousedown for each new drag
            let captureStart, captureEnd;
            
            // ✅ FORCE FRESH CAPTURE: Always get current values first
            if (refs.regionRef.current) {
              const currentStart = refs.regionRef.current.start;
              const currentEnd = refs.regionRef.current.end;
              
              // ✅ Use pre-captured if available AND recent (within 1 second)
              const hasRecentPreCapture = refs.preDragRegionRef && 
                                        refs.preDragRegionRef.current &&
                                        (Date.now() - refs.preDragRegionRef.current.timestamp) < 1000;
              
              if (hasRecentPreCapture) {
                // Verify pre-captured values are still accurate (within 0.001 tolerance)
                const startDiff = Math.abs(refs.preDragRegionRef.current.start - currentStart);
                const endDiff = Math.abs(refs.preDragRegionRef.current.end - currentEnd);
                
                if (startDiff < 0.001 && endDiff < 0.001) {
                  captureStart = refs.preDragRegionRef.current.start;
                  captureEnd = refs.preDragRegionRef.current.end;

                } else {
                  captureStart = currentStart;
                  captureEnd = currentEnd;

                }
              } else {
                captureStart = currentStart;
                captureEnd = currentEnd;

              }
            } else {
              console.error("[MOUSEDOWN] ❌ No region values available!");
              return;
            }

            // ✅ FAILSAFE: Always clear before capture
            refs.dragStartRegionRef.current = null;
            
            // Store with absolute precision (no rounding at capture)
            refs.dragStartRegionRef.current = {
              start: captureStart,
              end: captureEnd,
              timestamp: Date.now(),
              captured: true, // ✅ Mark as properly captured
            };

            // ✅ IMMEDIATELY save to history when drag starts
            onRegionChange(
              captureStart,
              captureEnd,
              true,
              "mousedown_save_exact_original"
            );

            // ✅ CRITICAL: Clear pre-captured values after use
            if (refs.preDragRegionRef) {
              refs.preDragRegionRef.current = null;
            }

            // ✅ Set flag that we're starting drag operation
            refs.isDragStartingRef = refs.isDragStartingRef || { current: false };
            refs.isDragStartingRef.current = true;

            // Đảm bảo background transparent ngay khi bắt đầu drag cho tất cả modes
            if (refs.regionRef.current?.element) {
              const regionElement = refs.regionRef.current.element;
              regionElement.style.backgroundColor = "transparent";
              regionElement.style.border = "none";

              // Force update child elements too
              const regionElements =
                regionElement.getElementsByClassName("wavesurfer-region");
              Array.from(regionElements).forEach((el) => {
                el.style.backgroundColor = "transparent";
                el.style.border = "none";
              });
            }

            requestAnimationFrame(updateRegionStyles);
          });
        }
      }

      refs.lastRegionStartRef.current = refs.regionRef.current.start;
      refs.lastRegionEndRef.current = refs.regionRef.current.end;

      // === SYNC FIX: Initialize synchronized position ===
      syncPositions(0, "wavesurferReady");

      if (refs.regionRef.current.on) {
        // Thay thế đoạn region 'out' event handler
        refs.regionRef.current.on("out", () => {
          if (!isPlaying) {
            return;
          }

          if (loop) {
            handleLoopPlayback();
          } else {
            handlePlaybackEnd();
          }
        });
      }


      if (refs.regionsPluginRef.current) {

      }

      // ✅ FIXED: Trong region "update" event handler - chỉ capture nếu thực sự cần
      refs.regionRef.current.on("update", () => {
        // ✅ CRITICAL: Only capture if we haven't captured anything yet AND we're not in a drag operation
        const hasValidCapture = refs.dragStartRegionRef.current && refs.dragStartRegionRef.current.captured;
        const isDragStarting = refs.isDragStartingRef && refs.isDragStartingRef.current;
        
        if (!hasValidCapture && !isDragStarting && refs.regionRef.current) {
          // This should rarely happen - only if mousedown completely failed
          const currentStart = refs.regionRef.current.start;
          const currentEnd = refs.regionRef.current.end;
          
          // ✅ CRITICAL: Check if we have better pre-captured values
          if (refs.preDragRegionRef && refs.preDragRegionRef.current) {
            // Use pre-captured values even in update (more accurate)
            refs.dragStartRegionRef.current = {
              start: refs.preDragRegionRef.current.start,
              end: refs.preDragRegionRef.current.end,
              timestamp: Date.now(),
              captured: true,
            };


            // Save to history with pre-captured values
            onRegionChange(
              refs.preDragRegionRef.current.start,
              refs.preDragRegionRef.current.end,
              true,
              "update_save_pre_captured"
            );

            // Clear after use
            refs.preDragRegionRef.current = null;
          } else {
            // Last resort - use current values (likely already changed)
            refs.dragStartRegionRef.current = {
              start: currentStart,
              end: currentEnd,
              timestamp: Date.now(),
              captured: true,
            };


            // Save to history with current values
            onRegionChange(
              currentStart,
              currentEnd,
              true,
              "update_save_fallback"
            );
          }
        } else if (hasValidCapture) {

        } else if (isDragStarting) {
        }

        // ✅ Clear drag starting flag after first update
        if (refs.isDragStartingRef) {
          refs.isDragStartingRef.current = false;
        }

        // CRITICAL: Force region style update ngay lập tức với transparent background
        if (refs.regionRef.current && refs.regionRef.current.element) {
          const regionElement = refs.regionRef.current.element;

          requestAnimationFrame(() => {
            if (!refs.regionRef.current?.element) return;

            // ✅ FIXED: Always transparent, no red colors
            const bgColor = "transparent";
            const borderStyle = "none";

            regionElement.style.backgroundColor = bgColor;
            regionElement.style.border = borderStyle;

            const regionElements =
              regionElement.getElementsByClassName("wavesurfer-region");
            for (let i = 0; i < regionElements.length; i++) {
              const el = regionElements[i];
              el.style.backgroundColor = bgColor;
              el.style.border = borderStyle;
            }
          });
        }

        refs.isDraggingRegionRef.current = true;

        clearTimeout(window.dragTimeout);
        window.dragTimeout = setTimeout(() => {
          refs.isDraggingRegionRef.current = false;
        }, 100);

        if (
          refs.regionChangeSourceRef.current === "click" &&
          refs.isClickUpdatingEndRef.current
        ) {
          return;
        }

        const currentProfile = refs.currentProfileRef.current;
        const newStart = refs.regionRef.current.start;
        const newEnd = refs.regionRef.current.end;
        const wasPlaying = isPlaying;

        updateDisplayValues("region_update_drag");

        refs.regionChangeSourceRef.current = "drag";

        const isDraggingStart = newStart !== refs.lastRegionStartRef.current;
        const isDraggingEnd = newEnd !== refs.lastRegionEndRef.current;

        refs.lastRegionStartRef.current = newStart;
        refs.lastRegionEndRef.current = newEnd;

        onRegionChange(newStart, newEnd, false, "drag_realtime");

        if (refs.wavesurferRef.current) {
          if (isDraggingStart) {
            // ✅ NEW: Delete mode logic - respect play/pause state during drag
            const currentDeleteMode = refs.removeModeRef.current;
            let seekPosition = newStart;
            
            if (currentDeleteMode) {
              console.log("[DELETE_MODE_DRAG_START] Delete mode drag - isPlaying:", isPlaying);
              
              // In delete mode, seek 3 seconds before the delete region start for better UX
              const preDeletePosition = Math.max(0, newStart - 3);
              seekPosition = preDeletePosition;
              console.log("[DELETE_MODE_DRAG] Seeking 3s before delete region:", {
                newStart: newStart.toFixed(2),
                seekPosition: seekPosition.toFixed(2),
                isPlaying: isPlaying,
                action: isPlaying ? "seek and continue playing" : "seek only, stay paused"
              });
              
              // ✅ CRITICAL: Always seek to new position
              refs.wavesurferRef.current.seekTo(
                seekPosition / refs.wavesurferRef.current.getDuration()
              );
              syncPositions(seekPosition, "deleteModeDragStart");
              
              // ✅ FIXED: Only play if music was already playing
              if (isPlaying) {
                // Continue playing from new position
                const trackDuration = refs.wavesurferRef.current.getDuration();
                refs.wavesurferRef.current.play(seekPosition, trackDuration);
                console.log("[DELETE_MODE_DRAG] Continuing playback from:", seekPosition.toFixed(2));
              } else {
                // Stay paused, just position at new location
                console.log("[DELETE_MODE_DRAG] Staying paused at position:", seekPosition.toFixed(2));
              }
              
            } else {
              // ✅ NORMAL MODE: Keep existing behavior (pause during drag)
              if (wasPlaying) {
                refs.wavesurferRef.current.pause();
                setters.setIsPlaying(false);
                onPlayStateChange(false);
              }
              
              console.log("[NORMAL_MODE_DRAG] Seeking to region start:", seekPosition.toFixed(2));
              
              refs.wavesurferRef.current.seekTo(
                seekPosition / refs.wavesurferRef.current.getDuration()
              );
              syncPositions(seekPosition, "regionUpdateStart");

              if (wasPlaying) {
                setTimeout(() => {
                  if (refs.wavesurferRef.current) {
                    refs.wavesurferRef.current.play(newStart, newEnd);
                    setters.setIsPlaying(true);
                    onPlayStateChange(true);
                  }
                }, 50);
              }
            }

            updateVolume(seekPosition, true, true);
          } else if (isDraggingEnd) {
            const currentDeleteMode = refs.removeModeRef.current;
            
            if (wasPlaying) {
              const currentTimeNow = performance.now();
              const shouldPerformRealtimeSeek =
                !refs.lastRealtimeSeekTimeRef.current ||
                currentTimeNow - refs.lastRealtimeSeekTimeRef.current > 100;

              if (shouldPerformRealtimeSeek) {
                let previewPosition;
                
                if (currentDeleteMode) {
                  // ✅ FIXED: In delete mode, respect play/pause state
                  previewPosition = Math.max(0, newStart - 3);
                  console.log("[DELETE_MODE_DRAG_END] Delete mode drag end - isPlaying:", isPlaying);
                  console.log("[DELETE_MODE_DRAG_END] Positioning from 3s before start:", {
                    newStart: newStart.toFixed(2),
                    newEnd: newEnd.toFixed(2),
                    seekPosition: previewPosition.toFixed(2),
                    isPlaying: isPlaying,
                    action: isPlaying ? "seek and continue playing" : "seek only, stay paused"
                  });
                  
                  // ✅ CRITICAL: Always seek to new position
                  refs.wavesurferRef.current.seekTo(
                    previewPosition / refs.wavesurferRef.current.getDuration()
                  );
                  syncPositions(previewPosition, "deleteModeDragEnd");
                  
                  // ✅ FIXED: Only play if music was playing
                  if (isPlaying) {
                    // Continue playing immediately
                    const trackDuration = refs.wavesurferRef.current.getDuration();
                    refs.wavesurferRef.current.play(previewPosition, trackDuration);
                    console.log("[DELETE_MODE_DRAG_END] Continuing playback from:", previewPosition.toFixed(2));
                  } else {
                    console.log("[DELETE_MODE_DRAG_END] Staying paused at position:", previewPosition.toFixed(2));
                  }
                  
                } else {
                  // Normal mode - preview before end
                  previewPosition = Math.max(
                    newStart,
                    newEnd - PREVIEW_TIME_BEFORE_END
                  );
                  console.log("[NORMAL_MODE_DRAG_END] Seeking to preview position:", previewPosition.toFixed(2));
                  
                  refs.wavesurferRef.current.seekTo(
                    previewPosition / refs.wavesurferRef.current.getDuration()
                  );
                  syncPositions(previewPosition, "realtimeDragSeek");
                }

                refs.isRealtimeDragSeekingRef.current = true;
                refs.lastRealtimeSeekTimeRef.current = currentTimeNow;

                clearTimeout(refs.realtimeSeekThrottleRef.current);
                refs.realtimeSeekThrottleRef.current = setTimeout(() => {
                  refs.isRealtimeDragSeekingRef.current = false;
                }, 200);
              }
            } else {
              let previewPosition;
              
              if (currentDeleteMode) {
                // ✅ FIXED: In delete mode, position 3s before start and respect play/pause state
                previewPosition = Math.max(0, newStart - 3);
                console.log("[DELETE_MODE_DRAG_END_STOPPED] Delete mode drag end stopped - isPlaying:", isPlaying);
                console.log("[DELETE_MODE_DRAG_END_STOPPED] Positioning 3s before delete start:", {
                  newStart: newStart.toFixed(2),
                  newEnd: newEnd.toFixed(2),
                  seekPosition: previewPosition.toFixed(2),
                  isPlaying: isPlaying,
                  action: "seek only, maintain current play state"
                });
              } else {
                // Normal mode - preview before end
                previewPosition = Math.max(
                  newStart,
                  newEnd - PREVIEW_TIME_BEFORE_END
                );
                console.log("[NORMAL_MODE_DRAG_END_STOPPED] Seeking to preview position:", previewPosition.toFixed(2));
              }
              
              refs.wavesurferRef.current.seekTo(
                previewPosition / refs.wavesurferRef.current.getDuration()
              );
              syncPositions(previewPosition, currentDeleteMode ? "deleteModeDragEndStopped" : "dragEndSeek");
              updateVolume(previewPosition, true, true);
              drawVolumeOverlay(true);
            }
          }
        }

        refs.currentProfileRef.current = currentProfile;

        // Force region style update during drag với transparent background
        if (refs.regionRef.current && refs.regionRef.current.element) {
          const regionElement = refs.regionRef.current.element;

          // ✅ FIXED: Always transparent, no red colors for any mode
          regionElement.style.backgroundColor = "transparent";
          regionElement.style.border = "none";

          const regionElements =
            regionElement.getElementsByClassName("wavesurfer-region");
          Array.from(regionElements).forEach((el) => {
            el.style.backgroundColor = "transparent";
            el.style.border = "none";
          });
        }

        refs.throttledDrawRef.current();
      });

      // ✅ FIXED: Trong region "update-end" event handler - cleanup sau khi drag hoàn thành
      refs.regionRef.current.on("update-end", () => {

        if (refs.wavesurferRef.current && refs.regionRef.current) {
          const currentTime = refs.wavesurferRef.current.getCurrentTime();
          const start = refs.regionRef.current.start;
          const end = refs.regionRef.current.end;

          updateDisplayValues("update_end_completion");

          // ✅ IMPROVED: Better drag vs click detection logic
          const isClickOperation =
            refs.regionChangeSourceRef.current === "click" &&
            refs.isClickUpdatingEndRef.current;
          const isDragOperation =
            refs.regionChangeSourceRef.current === "drag" || !isClickOperation;

          // ✅ FIXED: History was already saved at drag start - just cleanup
          if (isDragOperation) {
          } else {
          }

          // ✅ CRITICAL: COMPLETE cleanup after drag ends
          refs.dragStartRegionRef.current = null;
          if (refs.preDragRegionRef) {
            refs.preDragRegionRef.current = null;
          }
          if (refs.isDragStartingRef) {
            refs.isDragStartingRef.current = false;
          }

          // ✅ NEW: Force fresh pre-capture for next operation
          setTimeout(() => {
            if (refs.regionRef.current) {
              const freshStart = refs.regionRef.current.start;
              const freshEnd = refs.regionRef.current.end;
              
              // Pre-capture fresh values for next drag operation
              refs.preDragRegionRef = refs.preDragRegionRef || { current: null };
              refs.preDragRegionRef.current = {
                start: freshStart,
                end: freshEnd,
                timestamp: Date.now(),
              };

            }
          }, 50);

          const previewPosition = Math.max(
            start,
            end - PREVIEW_TIME_BEFORE_END
          );

          if (currentTime < start || currentTime >= end) {
            // ✅ FIXED: In delete mode, respect play/pause state on update-end
            const currentDeleteMode = refs.removeModeRef.current;
            
            if (currentDeleteMode) {
              console.log("[DELETE_MODE_UPDATE_END] Delete mode update-end - isPlaying:", isPlaying);
              
              // ✅ CRITICAL: In delete mode, always position 3s before delete start
              const deletePlayPosition = Math.max(0, start - 3);
              
              refs.wavesurferRef.current.seekTo(
                deletePlayPosition / refs.wavesurferRef.current.getDuration()
              );
              syncPositions(deletePlayPosition, "deleteModeFinalPosition");
              updateVolume(deletePlayPosition, true, true);
              
              // ✅ FIXED: Only play if music was playing
              if (isPlaying) {
                // Continue playing immediately without pause
                const trackDuration = refs.wavesurferRef.current.getDuration();
                refs.wavesurferRef.current.play(deletePlayPosition, trackDuration);
                
                console.log("[DELETE_MODE_UPDATE_END] Continuing playback from:", {
                  regionStart: start.toFixed(2),
                  playPosition: deletePlayPosition.toFixed(2),
                  trackDuration: trackDuration.toFixed(2)
                });
              } else {
                console.log("[DELETE_MODE_UPDATE_END] Staying paused at position:", {
                  regionStart: start.toFixed(2),
                  pausedPosition: deletePlayPosition.toFixed(2)
                });
              }
              
            } else {
              // ✅ NORMAL MODE: Keep existing behavior (pause and restart)
              refs.wavesurferRef.current.pause();

              setTimeout(() => {
                // Normal mode - use preview position
                const finalPosition = previewPosition;
                console.log("[NORMAL_MODE_UPDATE_END] Final positioning at preview:", finalPosition.toFixed(2));
                
                refs.wavesurferRef.current.seekTo(
                  finalPosition / refs.wavesurferRef.current.getDuration()
                );
                syncPositions(finalPosition, "updateEndSeek");
                updateVolume(finalPosition, true, true);
                if (isPlaying) {
                  setTimeout(() => {
                    refs.wavesurferRef.current.play(finalPosition, end);
                    setters.setIsPlaying(true);
                  }, 30);
                }
              }, 30);
            }
          } else {
            // ✅ Position is within region bounds, just update volume
            const currentDeleteMode = refs.removeModeRef.current;
            if (currentDeleteMode) {
              console.log("[DELETE_MODE_UPDATE_END] Position within bounds - isPlaying:", isPlaying);
              // In delete mode, ensure we're playing from correct position  
              const deletePlayPosition = Math.max(0, start - 3);
              if (Math.abs(currentTime - deletePlayPosition) > 0.5) {
                // If we're more than 0.5s away from ideal position, adjust
                refs.wavesurferRef.current.seekTo(
                  deletePlayPosition / refs.wavesurferRef.current.getDuration()
                );
                syncPositions(deletePlayPosition, "deleteModeFinalAdjust");
                
                // ✅ FIXED: Only play if music was playing
                if (isPlaying) {
                  const trackDuration = refs.wavesurferRef.current.getDuration();
                  refs.wavesurferRef.current.play(deletePlayPosition, trackDuration);
                  console.log("[DELETE_MODE_UPDATE_END] Continuing playback from adjusted position:", deletePlayPosition.toFixed(2));
                } else {
                  console.log("[DELETE_MODE_UPDATE_END] Staying paused at adjusted position:", deletePlayPosition.toFixed(2));
                }
              } else {
                console.log("[DELETE_MODE_UPDATE_END] Position close enough, maintaining current state - isPlaying:", isPlaying);
              }
            }
            updateVolume(currentTime, true, true);
          }
        }

        // Clear region change source immediately
        refs.regionChangeSourceRef.current = null;

        // Clear click updating flags immediately
        refs.isClickUpdatingEndRef.current = false;
        refs.lastClickEndTimeRef.current = null;

        // Clear click source ref
        refs.clickSourceRef.current = null;

        // Handle drag flags with proper timing
        if (refs.isDragUpdatingEndRef.current) {
          refs.isDragUpdatingEndRef.current = false;
          refs.lastDragEndTimeRef.current = null;
        }

        // Clear any remaining timeouts
        if (refs.endUpdateTimeoutRef.current) {
          clearTimeout(refs.endUpdateTimeoutRef.current);
          refs.endUpdateTimeoutRef.current = null;
        }

        // ✅ NEW: Force waveform redraw after update-end
        setTimeout(() => {
          if (refs.wavesurferRef.current && refs.wavesurferRef.current.drawBuffer) {
            refs.wavesurferRef.current.drawBuffer();
          }
        }, 100);
      });

      refs.regionRef.current.on("region-updated", () => {
        if (refs.regionChangeSourceRef.current === "click") {
          return;
        }

        if (isPlaying && refs.wavesurferRef.current) {
          const currentTime = refs.wavesurferRef.current.getCurrentTime();
          const start = refs.regionRef.current.start;
          const end = refs.regionRef.current.end;

          if (currentTime >= start && currentTime < end) {
            refs.wavesurferRef.current.play(currentTime, end);
          }
        }
      });

      drawVolumeOverlay();
      
      // ✅ FIXED: Realtime redraw for both normal and delete modes
      const currentDeleteMode = refs.removeModeRef.current;
      if (dependencies.forceRedrawDimOverlay) {
        if (currentDeleteMode) {
          console.log("[WAVESURFER_READY] Delete mode - initial realtime redraw");
          dependencies.forceRedrawDimOverlay();
        } else {
          console.log("[WAVESURFER_READY] Normal mode - initial dim overlay redraw");
          dependencies.forceRedrawDimOverlay();
        }
      }
    });

    // === SYNC FIX: Enhanced audioprocess event with synchronized position updates ===
    // === ENHANCED EVENT HANDLERS ===
    // Thay thế đoạn 'finish' event handler
    ws.on("finish", () => {
      if (loop && refs.regionRef.current) {
        handleLoopPlayback();
      } else {
        handlePlaybackEnd();
      }
    });

    ws.on("audioprocess", () => {
      const currentTime = ws.getCurrentTime();

      // Update synchronized position
      syncPositions(currentTime, "audioprocess");
      onTimeUpdate(currentTime);

      // ✅ PERFORMANCE FIX: Throttle overlay updates based on mode
      const currentDeleteMode = refs.removeModeRef.current;
      
      if (isPlaying && !refs.isDraggingRef.current) {
        if (currentDeleteMode) {
          // ✅ DELETE MODE: Reduced frequency updates to prevent flickering
          if (!refs.audioProcessCountRef) refs.audioProcessCountRef = { current: 0 };
          refs.audioProcessCountRef.current++;
          
          // Only update every 8th audioprocess call in delete mode
          if (refs.audioProcessCountRef.current % 8 === 0) {
            drawVolumeOverlay(false); // Don't force redraw
          }
        } else {
          // ✅ NORMAL MODE: Standard frequency
          if (!refs.normalAudioCountRef) refs.normalAudioCountRef = { current: 0 };
          refs.normalAudioCountRef.current++;
          
          // Update every 4th call in normal mode
          if (refs.normalAudioCountRef.current % 4 === 0) {
            drawVolumeOverlay(true);
            
            if (dependencies.forceRedrawDimOverlay) {
              console.log("[AUDIOPROCESS] Normal mode - redrawing dim overlay during playback");
              dependencies.forceRedrawDimOverlay();
            }
          }
        }
      }
    });

    ws.on("seeking", () => {
      const currentTime = ws.getCurrentTime();

      // Update synchronized position
      syncPositions(currentTime, "seeking");
      onTimeUpdate(currentTime);
      updateVolume(currentTime, false, true);
      drawVolumeOverlay(true);
      
      // ✅ FIXED: Realtime redraw for both normal and delete modes
      const currentDeleteMode = refs.removeModeRef.current;
      if (dependencies.forceRedrawDimOverlay) {
        if (currentDeleteMode) {
          console.log("[SEEKING] Delete mode - realtime redraw during seeking");
          dependencies.forceRedrawDimOverlay();
        } else {
          console.log("[SEEKING] Normal mode - redrawing dim overlay during seeking");
          dependencies.forceRedrawDimOverlay();
        }
      }
    });
    
    ws.on("seek", () => {
      const currentTime = ws.getCurrentTime();

      // Force immediate overlay redraw
      setTimeout(() => {
        drawVolumeOverlay(true);
        
        // ✅ FIXED: Realtime redraw for both normal and delete modes
        const currentDeleteMode = refs.removeModeRef.current;
        if (dependencies.forceRedrawDimOverlay) {
          if (currentDeleteMode) {
            console.log("[SEEK] Delete mode - realtime redraw after seek");
            dependencies.forceRedrawDimOverlay();
          } else {
            console.log("[SEEK] Normal mode - redrawing dim overlay after seek");
            dependencies.forceRedrawDimOverlay();
          }
        }
      }, 10);
    });
    
    ws.loadBlob(audioFile);

    // ✅ TEMPORARY: Debug CSS và waveform visibility
    setTimeout(() => {
      console.log("[WAVEFORM_DEBUG] Checking waveform visibility after load");

      const waveformContainer = refs.waveformRef.current;
      if (waveformContainer) {
        const containerRect = waveformContainer.getBoundingClientRect();
        console.log("[WAVEFORM_DEBUG] Container rect:", {
          width: containerRect.width,
          height: containerRect.height,
          visible: containerRect.width > 0 && containerRect.height > 0
        });

        // Check for canvas elements
        const canvases = waveformContainer.querySelectorAll("canvas");
        console.log("[WAVEFORM_DEBUG] Found", canvases.length, "canvas elements");

        canvases.forEach((canvas, index) => {
          console.log(`[WAVEFORM_DEBUG] Canvas ${index}:`, {
            width: canvas.width,
            height: canvas.height,
            visible: canvas.offsetWidth > 0 && canvas.offsetHeight > 0
          });
        });

        // Check if waveform has data
        if (refs.wavesurferRef.current) {
          const duration = refs.wavesurferRef.current.getDuration();
          console.log("[WAVEFORM_DEBUG] Audio duration:", duration, "seconds");
        }
      }
    }, 1000);

    return () => {

      
      // === CLEANUP TIMERS VÀ ANIMATIONS (giữ nguyên) ===
      if (refs.drawTimerRef.current) {
        clearTimeout(refs.drawTimerRef.current);
      }
      if (refs.animationFrameRef.current) {
        cancelAnimationFrame(refs.animationFrameRef.current);
      }
      if (refs.endUpdateTimeoutRef.current) {
        clearTimeout(refs.endUpdateTimeoutRef.current);
      }
      if (refs.regionUpdateTimeoutRef.current) {
        clearTimeout(refs.regionUpdateTimeoutRef.current);
      }

      // === MỚI: CLEANUP THROTTLED FUNCTIONS ===


      // Cancel any pending throttled/debounced calls
      Object.values(refs.throttledFunctionsRef.current).forEach((func) => {
        if (func && typeof func.cancel === "function") {

          func.cancel(); // For lodash throttle/debounce
        }
        if (func && typeof func.flush === "function") {

          func.flush(); // Execute any pending calls immediately
        }
      });

      // Clear the cache completely
      refs.throttledFunctionsRef.current = {};


      // === CLEANUP FLAGS VÀ STATES (giữ nguyên) ===
      refs.isEndingPlaybackRef.current = false;

      // === CLEANUP EVENT LISTENERS (giữ nguyên) ===
      if (currentWaveformElement) {
        currentWaveformElement.removeEventListener(
          "click",
          handleWaveformClick
        );
      }

      // === DESTROY WAVESURFER (giữ nguyên) ===
      if (ws) {

        ws.destroy();
      }


    };
  }, [audioFile, theme, onTimeUpdate]);


};