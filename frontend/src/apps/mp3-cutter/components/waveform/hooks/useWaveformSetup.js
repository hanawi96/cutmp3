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
  console.log('[useWaveformSetup] Initializing...');
  
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
    console.log('[useWaveformSetup] Setting up WaveSurfer for audioFile:', !!audioFile);
    
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

    console.log("[useWaveformSetup] WaveSurfer created with standard waveform display");

    console.log(
      "[useWaveformSetup] Using handleWaveformClick from useRegionManagement"
    );

    refs.waveformRef.current.addEventListener("click", handleWaveformClick);

    refs.wavesurferRef.current = ws;

    ws.on("ready", () => {
      console.log('[useWaveformSetup] WaveSurfer ready event triggered');
      
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

      console.log('[useWaveformSetup] Region created, setting up display values...');
      
      // ✅ THÊM: Update display values ngay sau khi tạo region
      console.log("[WS Ready] Region created, updating display values...");
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
          console.log("[WS Ready] Backup display update...");
          updateDisplayValues("ws_ready_backup");
        }
      }, 500);

      // Add handlers for all region interactions
      if (refs.regionRef.current && refs.regionRef.current.on) {
        console.log('[useWaveformSetup] Setting up region event handlers...');
        
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
            console.log(
              "[handleMouseInteraction] Mouse interaction completed"
            );
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
            console.log(
              `[mousemove] 🎯 Realtime drag - applying ${
                isDeleteMode ? "RED" : "TRANSPARENT"
              } color`
            );

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

              console.log("[mousemove] Background set to:", bgColor);
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
          element.addEventListener("mousedown", () => {
            console.log(
              `[mousedown] Drag started - current mode: ${
                isDeleteMode ? "DELETE" : "NORMAL"
              }`
            );

            // Đảm bảo background transparent ngay khi bắt đầu drag cho normal mode
            if (!isDeleteMode && refs.regionRef.current?.element) {
              const regionElement = refs.regionRef.current.element;
              regionElement.style.backgroundColor = "transparent";
              console.log(
                "[mousedown] Normal mode - forced background to transparent"
              );

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

      console.log("[useWaveformSetup] Region created:", refs.regionRef.current);
      console.log(
        "[useWaveformSetup] Region methods:",
        Object.getOwnPropertyNames(Object.getPrototypeOf(refs.regionRef.current))
      );
      console.log("[useWaveformSetup] Regions plugin:", refs.regionsPluginRef.current);
      if (refs.regionsPluginRef.current) {
        console.log(
          "[useWaveformSetup] RegionsPlugin methods:",
          Object.getOwnPropertyNames(
            Object.getPrototypeOf(refs.regionsPluginRef.current)
          )
        );
      }

      // ✅ FIXED: Trong region "update" event handler - thêm cập nhật display (dòng ~1400)
      refs.regionRef.current.on("update", () => {
        if (!refs.dragStartRegionRef.current && refs.regionRef.current) {
          refs.dragStartRegionRef.current = {
            start: refs.regionRef.current.start,
            end: refs.regionRef.current.end,
            timestamp: Date.now(),
          };
          console.log(
            `[UPDATE-START] 📍 Captured initial region: ${refs.dragStartRegionRef.current.start.toFixed(
              4
            )}s - ${refs.dragStartRegionRef.current.end.toFixed(4)}s`
          );
        }

        // CRITICAL: Force region style update ngay lập tức với transparent background
        if (refs.regionRef.current && refs.regionRef.current.element) {
          const regionElement = refs.regionRef.current.element;

          requestAnimationFrame(() => {
            if (!refs.regionRef.current?.element) return;

            console.log(
              "[UPDATE] Forcing transparent background for normal mode, deleteMode:",
              isDeleteMode
            );

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

            console.log("[UPDATE] Region background forced to:", bgColor);
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

        console.log(
          `[Region Update] Updating display values during drag: ${newStart.toFixed(
            4
          )}s - ${newEnd.toFixed(4)}s`
        );
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

          console.log(
            "[UPDATE-FINAL] Applying final drag styles, deleteMode:",
            isDeleteMode
          );

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

            console.log(
              "[UPDATE-FINAL] Normal mode - background set to transparent"
            );
          }
        }

        refs.throttledDrawRef.current();
      });

      // ✅ FIXED: Trong region "update-end" event handler - thêm cập nhật display (dòng ~1550)
      refs.regionRef.current.on("update-end", () => {
        console.log("[UPDATE-END] 🏁 Event triggered");

        if (refs.wavesurferRef.current && refs.regionRef.current) {
          const currentTime = refs.wavesurferRef.current.getCurrentTime();
          const start = refs.regionRef.current.start;
          const end = refs.regionRef.current.end;

          // ✅ THÊM: Update display values sau khi drag kết thúc
          console.log(
            "[UPDATE-END] Updating display values after drag completion"
          );
          updateDisplayValues("update_end_completion");

          // ✅ IMPROVED: Better drag vs click detection logic
          const isClickOperation =
            refs.regionChangeSourceRef.current === "click" &&
            refs.isClickUpdatingEndRef.current;
          const isDragOperation =
            refs.regionChangeSourceRef.current === "drag" || !isClickOperation;

          console.log(`[UPDATE-END] 🔍 Operation detection:`, {
            regionChangeSource: refs.regionChangeSourceRef.current,
            isClickUpdatingEnd: refs.isClickUpdatingEndRef.current,
            isClickOperation,
            isDragOperation,
          });

          // ✅ ALWAYS save history for drag operations, even if uncertain
          if (isDragOperation) {
            // ✅ FIXED: Save PREVIOUS region (before drag started) to history
            if (refs.dragStartRegionRef.current) {
              const prevRegion = refs.dragStartRegionRef.current;
              console.log(
                `[UPDATE-END] 💾 Drag operation detected - saving PREVIOUS region to history: ${prevRegion.start.toFixed(
                  4
                )}s - ${prevRegion.end.toFixed(4)}s`
              );
              onRegionChange(
                prevRegion.start,
                prevRegion.end,
                true,
                "drag_complete_save_previous"
              );

              // Clear the captured region after using it
              refs.dragStartRegionRef.current = null;
            } else {
              console.log(
                `[UPDATE-END] ⚠️ No previous region captured - fallback to current region`
              );
              onRegionChange(start, end, true, "drag_complete_fallback");
            }
          } else {
            console.log(
              `[UPDATE-END] ⏭️ Click operation detected - history already saved in click handler`
            );
            // Clear drag start region for click operations too
            refs.dragStartRegionRef.current = null;
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

        console.log(`\n🏁 [UPDATE-END EVENT] Processing completed`);
        console.log(`📊 Flags before cleanup:`);
        console.log(
          `  - regionChangeSourceRef: ${refs.regionChangeSourceRef.current}`
        );
        console.log(
          `  - isDragUpdatingEndRef: ${refs.isDragUpdatingEndRef.current}`
        );
        console.log(
          `  - isClickUpdatingEndRef: ${refs.isClickUpdatingEndRef.current}`
        );

        // ✅ CRITICAL: Clear ALL flags immediately after update-end
        console.log(
          "[UPDATE-END] 🧹 Clearing all flags to prepare for next operation"
        );

        // Clear region change source immediately
        refs.regionChangeSourceRef.current = null;

        // Clear click updating flags immediately
        refs.isClickUpdatingEndRef.current = false;
        refs.lastClickEndTimeRef.current = null;

        // Clear click source ref
        refs.clickSourceRef.current = null;

        // ✅ NEW: Clear drag start region capture
        if (!refs.dragStartRegionRef.current) {
          // Only clear if not already cleared in drag operation above
          refs.dragStartRegionRef.current = null;
        }

        // Handle drag flags with proper timing
        if (refs.isDragUpdatingEndRef.current) {
          console.log(`[UPDATE-END] 🤔 Clearing drag flags...`);
          refs.isDragUpdatingEndRef.current = false;
          refs.lastDragEndTimeRef.current = null;
        }

        console.log(`📊 Flags after cleanup:`);
        console.log(
          `  - regionChangeSourceRef: ${refs.regionChangeSourceRef.current}`
        );
        console.log(
          `  - isDragUpdatingEndRef: ${refs.isDragUpdatingEndRef.current}`
        );
        console.log(
          `  - isClickUpdatingEndRef: ${refs.isClickUpdatingEndRef.current}`
        );
        console.log(`  - clickSourceRef: ${refs.clickSourceRef.current}`);

        // Rest of existing logic continues...
        if (
          refs.regionChangeSourceRef.current === "click" &&
          refs.isClickUpdatingEndRef.current
        ) {
          console.log(
            `[update-end] 🖱️ This check should never trigger now - flags cleared above`
          );
          return;
        }

        const newStart = refs.regionRef.current.start;
        const newEnd = refs.regionRef.current.end;
        const wasPlaying = isPlaying;

        console.log(
          `[update-end] 📍 Final region bounds: ${newStart.toFixed(
            4
          )}s - ${newEnd.toFixed(4)}s`
        );

        if (refs.wavesurferRef.current) {
          const currentTime = refs.wavesurferRef.current.getCurrentTime();

          if (wasPlaying && currentTime >= newStart && currentTime < newEnd) {
            console.log(
              `[update-end] ✅ Position valid - continuing playback to new end: ${newEnd.toFixed(
                4
              )}s`
            );
            refs.wavesurferRef.current.play(currentTime, newEnd);
          } else if (wasPlaying) {
            console.log(`[update-end] ⚠️ Position outside valid range`);
          }
        }

        // Style updates
        if (refs.regionRef.current && refs.regionRef.current.element) {
          updateRegionStyles();

          setTimeout(() => {
            if (refs.regionRef.current && refs.regionRef.current.element) {
              updateRegionStyles();
              console.log(`[update-end] 🎨 Style refresh completed`);
            }
          }, 100);
        }

        // Clear any remaining timeouts
        if (refs.endUpdateTimeoutRef.current) {
          clearTimeout(refs.endUpdateTimeoutRef.current);
          refs.endUpdateTimeoutRef.current = null;
        }

        console.log(
          "[UPDATE-END] ✅ Event processing completed - ready for next operation"
        );

        // ✅ NEW: Force waveform redraw after update-end
        setTimeout(() => {
          if (refs.wavesurferRef.current && refs.wavesurferRef.current.drawBuffer) {
            console.log(
              "[Update-End] Redrawing waveform bars after region update"
            );
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
      console.log(
        `[WS seek] 🎯 Seek completed to ${currentTime.toFixed(4)}s`
      );

      // Force immediate overlay redraw
      setTimeout(() => {
        drawVolumeOverlay(true);
        console.log(
          `[WS seek] Overlay synchronized to: ${currentTime.toFixed(4)}s`
        );
      }, 10);
    });
    
    ws.loadBlob(audioFile);

    // ✅ TEMPORARY: Debug CSS và waveform visibility
    setTimeout(() => {
      console.log("[DEBUG] Checking waveform visibility...");
      const waveformContainer = refs.waveformRef.current;
      if (waveformContainer) {
        const rect = waveformContainer.getBoundingClientRect();
        console.log("[DEBUG] Waveform container dimensions:", {
          width: rect.width,
          height: rect.height,
          visible: rect.width > 0 && rect.height > 0,
        });

        // Check for canvas elements
        const canvases = waveformContainer.querySelectorAll("canvas");
        console.log("[DEBUG] Found canvases:", canvases.length);
        canvases.forEach((canvas, index) => {
          console.log(`[DEBUG] Canvas ${index}:`, {
            width: canvas.width,
            height: canvas.height,
            style: canvas.style.cssText,
            hidden: canvas.hidden,
          });
        });

        // Check if waveform has data
        if (refs.wavesurferRef.current) {
          console.log("[DEBUG] WaveSurfer state:", {
            duration: refs.wavesurferRef.current.getDuration(),
            isReady: refs.wavesurferRef.current.isReady?.() || "unknown",
          });
        }
      }
    }, 1000);

    return () => {
      console.log('[useWaveformSetup] Cleanup function called');
      
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
      console.log("[CLEANUP] Clearing throttled functions cache");

      // Cancel any pending throttled/debounced calls
      Object.values(refs.throttledFunctionsRef.current).forEach((func) => {
        if (func && typeof func.cancel === "function") {
          console.log("[CLEANUP] Cancelling throttled function");
          func.cancel(); // For lodash throttle/debounce
        }
        if (func && typeof func.flush === "function") {
          console.log("[CLEANUP] Flushing throttled function");
          func.flush(); // Execute any pending calls immediately
        }
      });

      // Clear the cache completely
      refs.throttledFunctionsRef.current = {};
      console.log("[CLEANUP] Throttled functions cache cleared");

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
        console.log("[CLEANUP] Destroying WaveSurfer instance");
        ws.destroy();
      }

      console.log("[CLEANUP] Component cleanup completed");
    };
  }, [audioFile, theme, onTimeUpdate]);

  console.log('[useWaveformSetup] ✅ Hook setup completed');
};