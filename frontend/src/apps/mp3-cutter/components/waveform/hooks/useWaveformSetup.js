import { useEffect } from 'react';
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";
import { debounce } from "../utils/throttleDebounce.js";
import { TIMING_CONSTANTS } from "../constants/waveformConstants.js";

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

  
  // Destructure config
  const { 
    audioFile, 
    theme, 
    volume, 
    normalizeAudio,
    onTimeUpdate,
    onRegionChange,
    onPlayStateChange,
    loop
  } = config;

  // Destructure state
  const { isDeleteMode, isPlaying } = state;

  // Destructure setters
  const { setDuration, setLoading } = setters;
  
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
          color: isDeleteMode
            ? "rgba(239, 68, 68, 0.2)" // Giữ nguyên cho delete mode
            : "transparent", // ✅ THAY ĐỔI: Bỏ background xanh nhạt, dùng transparent
          handleStyle: {
            borderColor: isDeleteMode
              ? "rgba(239, 68, 68, 0.8)"
              : "transparent", // ✅ XÓA BORDER: Từ "#0984e3" thành "transparent"
            backgroundColor: isDeleteMode
              ? "rgba(239, 68, 68, 0.3)"
              : "transparent", // ✅ XÓA BACKGROUND: Từ "#0984e3" thành "transparent"
            width: "4px", // ✅ THÊM: Làm dày thanh handle lên 4px (mặc định là 3px)
          },
        })
      );

      refs.regionsPluginRef.current = plugin;

      // Create region with initial styles
      refs.regionRef.current = plugin.addRegion({
        start: 0,
        end: dur,
        color: isDeleteMode
          ? "rgba(239, 68, 68, 0.2)" // Giữ nguyên cho delete mode
          : "transparent", // ✅ THAY ĐỔI: Bỏ background xanh nhạt
        handleStyle: {
          borderColor: isDeleteMode
            ? "rgba(239, 68, 68, 0.8)"
            : "transparent", // ✅ XÓA BORDER: Từ "#0984e3" thành "transparent"
          backgroundColor: isDeleteMode
            ? "rgba(239, 68, 68, 0.3)"
            : "transparent", // ✅ XÓA BACKGROUND: Từ "#0984e3" thành "transparent"
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
        refs.regionRef.current.on("update", () =>
          getThrottledUpdateRegionStyles()()
        );

        // Handle region-updated event (after drag/resize completes)
        refs.regionRef.current.on("update-end", updateRegionStyles);

        // Handle region-updated event (for any other updates)
        refs.regionRef.current.on("region-updated", updateRegionStyles);

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

            getDebouncedStyleUpdate()();
          };

          // Optimized realtime drag handler với transparent background
          const handleMouseMove = (e) => {
            if (!e || typeof e.buttons === "undefined") {
              console.warn("[handleMouseMove] Invalid event object:", e);
              return;
            }

            if (e.buttons !== 1 || !refs.regionRef.current?.element) return;

            const regionElement = refs.regionRef.current.element;

            const bgColor = isDeleteMode
              ? "rgba(239, 68, 68, 0.2)"
              : "transparent";
            const borderStyle = isDeleteMode
              ? "2px solid rgba(239, 68, 68, 0.8)"
              : "none"; // ✅ XÓA BORDER: Từ '2px solid #0984e3' thành 'none'

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
            // ✅ Pre-capture region values when mouse enters (before any click/drag)
            if (refs.regionRef.current && !refs.dragStartRegionRef.current) {
              const originalStart = refs.regionRef.current.start;
              const originalEnd = refs.regionRef.current.end;
              
              // Store original values with ultra-high precision
              refs.preDragRegionRef = refs.preDragRegionRef || { current: null };
              refs.preDragRegionRef.current = {
                start: originalStart,
                end: originalEnd,
                timestamp: Date.now(),
              };

              console.log("[MOUSE_ENTER] 🎯 Pre-captured ORIGINAL region values:", {
                originalStart,
                originalEnd,
                precision: "EXACT_ORIGINAL"
              });
            }
          });

          element.addEventListener("mousedown", () => {
            console.log("[MOUSEDOWN] ✅ Event triggered! Starting drag operation");

            // ✅ CRITICAL: Use pre-captured values if available, otherwise capture now
            let captureStart, captureEnd;
            
            if (refs.preDragRegionRef && refs.preDragRegionRef.current) {
              // Use pre-captured values (most accurate - captured before ANY interaction)
              captureStart = refs.preDragRegionRef.current.start;
              captureEnd = refs.preDragRegionRef.current.end;
              console.log("[MOUSEDOWN] 🎯 Using PRE-CAPTURED values (EXACT ORIGINAL):", {
                start: captureStart,
                end: captureEnd,
                source: "mouseenter_pre_captured"
              });
            } else if (refs.regionRef.current) {
              // Fallback to current values
              captureStart = refs.regionRef.current.start;
              captureEnd = refs.regionRef.current.end;
              console.log("[MOUSEDOWN] ⚠️ Using CURRENT values (fallback):", {
                start: captureStart,
                end: captureEnd,
                source: "mousedown_current"
              });
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
              captured: true, // ✅ NEW: Mark as properly captured
            };

            console.log("[MOUSEDOWN] ✅ Captured EXACT ORIGINAL region before drag:", {
              start: captureStart,
              end: captureEnd,
              precision: "ABSOLUTE_ORIGINAL"
            });

            // ✅ IMMEDIATELY save to history when drag starts
            onRegionChange(
              captureStart,
              captureEnd,
              true,
              "mousedown_save_exact_original"
            );

            // Clear pre-captured values after successful use
            if (refs.preDragRegionRef) {
              refs.preDragRegionRef.current = null;
            }

            // ✅ NEW: Set flag that we're starting drag operation
            refs.isDragStartingRef = refs.isDragStartingRef || { current: false };
            refs.isDragStartingRef.current = true;

            // Đảm bảo background transparent ngay khi bắt đầu drag cho normal mode
            if (!isDeleteMode && refs.regionRef.current?.element) {
              const regionElement = refs.regionRef.current.element;
              regionElement.style.backgroundColor = "transparent";

              // Force update child elements too
              const regionElements =
                regionElement.getElementsByClassName("wavesurfer-region");
              Array.from(regionElements).forEach((el) => {
                el.style.backgroundColor = "transparent";
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

            console.log("[UPDATE_FIRST] 🎯 Using PRE-CAPTURED values from mouseenter:", {
              start: refs.preDragRegionRef.current.start,
              end: refs.preDragRegionRef.current.end,
              source: "update_use_pre_captured"
            });

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

            console.log("[UPDATE_FIRST] ⚠️ FALLBACK: Using current values (may be inaccurate):", {
              start: currentStart,
              end: currentEnd,
              source: "update_fallback_current"
            });

            // Save to history with current values
            onRegionChange(
              currentStart,
              currentEnd,
              true,
              "update_save_fallback"
            );
          }
        } else if (hasValidCapture) {
          console.log("[UPDATE] ✅ Using previously captured values:", {
            capturedStart: refs.dragStartRegionRef.current.start,
            capturedEnd: refs.dragStartRegionRef.current.end,
            currentStart: refs.regionRef.current.start,
            currentEnd: refs.regionRef.current.end
          });
        } else if (isDragStarting) {
          console.log("[UPDATE] ⏳ Drag is starting, waiting for proper capture...");
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

            const bgColor = isDeleteMode
              ? "rgba(239, 68, 68, 0.2)"
              : "transparent";
            const borderStyle = isDeleteMode
              ? "2px solid rgba(239, 68, 68, 0.8)"
              : "none"; // ✅ XÓA BORDER: Từ '2px solid #0984e3' thành 'none'

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
            if (wasPlaying) {
              refs.wavesurferRef.current.pause();
              setters.setIsPlaying(false);
              onPlayStateChange(false);
            }

            refs.wavesurferRef.current.seekTo(
              newStart / refs.wavesurferRef.current.getDuration()
            );
            syncPositions(newStart, "regionUpdateStart");

            if (wasPlaying) {
              setTimeout(() => {
                if (refs.wavesurferRef.current) {
                  refs.wavesurferRef.current.play(newStart, newEnd);
                  setters.setIsPlaying(true);
                  onPlayStateChange(true);
                }
              }, 50);
            }

            updateVolume(newStart, true, true);
          } else if (isDraggingEnd) {
            if (wasPlaying) {
              const currentTimeNow = performance.now();
              const shouldPerformRealtimeSeek =
                !refs.lastRealtimeSeekTimeRef.current ||
                currentTimeNow - refs.lastRealtimeSeekTimeRef.current > 100;

              if (shouldPerformRealtimeSeek) {
                const previewPosition = Math.max(
                  newStart,
                  newEnd - PREVIEW_TIME_BEFORE_END
                );

                refs.isRealtimeDragSeekingRef.current = true;
                refs.lastRealtimeSeekTimeRef.current = currentTimeNow;

                refs.wavesurferRef.current.seekTo(
                  previewPosition / refs.wavesurferRef.current.getDuration()
                );
                syncPositions(previewPosition, "realtimeDragSeek");

                clearTimeout(refs.realtimeSeekThrottleRef.current);
                refs.realtimeSeekThrottleRef.current = setTimeout(() => {
                  refs.isRealtimeDragSeekingRef.current = false;
                }, 200);
              }
            } else {
              const previewPosition = Math.max(
                newStart,
                newEnd - PREVIEW_TIME_BEFORE_END
              );
              refs.wavesurferRef.current.seekTo(
                previewPosition / refs.wavesurferRef.current.getDuration()
              );
              syncPositions(previewPosition, "dragEndSeek");
              updateVolume(previewPosition, true, true);
              drawVolumeOverlay(true);
            }
          }
        }

        refs.currentProfileRef.current = currentProfile;

        // Force region style update during drag với transparent background
        if (refs.regionRef.current && refs.regionRef.current.element) {
          const regionElement = refs.regionRef.current.element;

          if (isDeleteMode) {
            regionElement.style.backgroundColor = "rgba(239, 68, 68, 0.2)";
            regionElement.style.border = "2px solid rgba(239, 68, 68, 0.8)";

            const regionElements =
              regionElement.getElementsByClassName("wavesurfer-region");
            Array.from(regionElements).forEach((el) => {
              el.style.backgroundColor = "rgba(239, 68, 68, 0.2)";
              el.style.border = "2px solid rgba(239, 68, 68, 0.8)";
            });
          } else {
            regionElement.style.backgroundColor = "transparent";
            regionElement.style.border = "none"; // ✅ XÓA BORDER: Từ '2px solid #0984e3' thành 'none'

            const regionElements =
              regionElement.getElementsByClassName("wavesurfer-region");
            Array.from(regionElements).forEach((el) => {
              el.style.backgroundColor = "transparent";
              el.style.border = "none"; // ✅ XÓA BORDER: Từ '2px solid #0984e3' thành 'none'
            });
          }
        }

        refs.throttledDrawRef.current();
      });

      // ✅ FIXED: Trong region "update-end" event handler - cleanup sau khi drag hoàn thành
      refs.regionRef.current.on("update-end", () => {
        console.log("[UPDATE_END] Drag completed, cleaning up");

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
            console.log("[DRAG_END] ✅ Drag completed. History was saved with EXACT precision at drag start");
          } else {
            console.log("[DRAG_END] Click operation detected, no additional history save needed");
          }

          // ✅ CRITICAL: Always clear captured regions after drag ends
          refs.dragStartRegionRef.current = null;
          if (refs.preDragRegionRef) {
            refs.preDragRegionRef.current = null;
          }
          if (refs.isDragStartingRef) {
            refs.isDragStartingRef.current = false;
          }

          const previewPosition = Math.max(
            start,
            end - PREVIEW_TIME_BEFORE_END
          );

          if (currentTime < start || currentTime >= end) {
            refs.wavesurferRef.current.pause();

            setTimeout(() => {
              refs.wavesurferRef.current.seekTo(
                previewPosition / refs.wavesurferRef.current.getDuration()
              );
              syncPositions(previewPosition, "updateEndSeek");
              updateVolume(previewPosition, true, true);
              if (isPlaying) {
                setTimeout(() => {
                  refs.wavesurferRef.current.play(previewPosition, end);
                  setters.setIsPlaying(true);
                }, 30);
              }
            }, 30);
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

      // Only redraw overlay if playing and not dragging
      if (isPlaying && !refs.isDraggingRef.current) {
        drawVolumeOverlay(true);
      }
    });

    ws.on("seeking", () => {
      const currentTime = ws.getCurrentTime();

      // Update synchronized position
      syncPositions(currentTime, "seeking");
      onTimeUpdate(currentTime);
      updateVolume(currentTime, false, true);
      drawVolumeOverlay(true);
    });
    
    ws.on("seek", () => {
      const currentTime = ws.getCurrentTime();


      // Force immediate overlay redraw
      setTimeout(() => {
        drawVolumeOverlay(true);

      }, 10);
    });
    
    ws.loadBlob(audioFile);

    // ✅ TEMPORARY: Debug CSS và waveform visibility
    setTimeout(() => {

      const waveformContainer = refs.waveformRef.current;
      if (waveformContainer) {
        const rect = waveformContainer.getBoundingClientRect();


        // Check for canvas elements
        const canvases = waveformContainer.querySelectorAll("canvas");

        canvases.forEach((canvas, index) => {

        });

        // Check if waveform has data
        if (refs.wavesurferRef.current) {

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