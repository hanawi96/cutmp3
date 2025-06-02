import { useEffect } from 'react';

export const useProgressAnimation = (state) => {
  useEffect(() => {
    // FIXED: Chỉ log khi thay đổi đáng kể để giảm noise
    const shouldLogProgress =
      Math.abs(state.processingProgress - state.smoothProgress) > 10; // Chỉ log khi thay đổi > 10%
    const shouldLogSpeedControl =
      state.showSpeedControl &&
      state.processingProgress !== state.smoothProgress;

    if (
      shouldLogProgress ||
      (shouldLogSpeedControl && state.processingProgress % 25 === 0)
    ) {
      console.log(
        "[state.smoothProgress] useEffect triggered - state.processingProgress:",
        state.processingProgress,
        "state.smoothProgress:",
        state.smoothProgress,
        "state.showSpeedControl:",
        state.showSpeedControl
      );
    }

    // FIXED: Ngăn animation khi SpeedControl được mở
    if (state.showSpeedControl) {
      // Chỉ log một lần khi SpeedControl mở, không log mỗi lần progress thay đổi
      if (
        state.processingProgress !== state.smoothProgress &&
        state.processingProgress % 50 === 0
      ) {
        console.log(
          "[state.smoothProgress] SpeedControl is open - setting progress immediately"
        );
      }

      // Cancel any existing animation immediately
      if (state.progressAnimationRef.current) {
        cancelAnimationFrame(state.progressAnimationRef.current);
        state.progressAnimationRef.current = null;
      }

      // Set progress immediately without animation
      if (state.processingProgress !== state.smoothProgress) {
        state.setSmoothProgress(Math.max(0, state.processingProgress));
      }

      return; // Exit early - không chạy animation
    }

    // Chỉ animate khi SpeedControl KHÔNG hiển thị
    if (
      state.processingProgress !== state.smoothProgress &&
      state.processingProgress >= 0 &&
      state.smoothProgress >= 0
    ) {
      const progressDiff = Math.abs(
        state.processingProgress - state.smoothProgress
      );

      // Only animate for significant changes
      if (progressDiff > 5) {
        // Chỉ log khi bắt đầu animation thật sự
        if (shouldLogProgress) {
          console.log(
            "[state.smoothProgress] Starting animation from",
            state.smoothProgress,
            "to",
            state.processingProgress
          );
        }

        // Cancel any existing animation
        if (state.progressAnimationRef.current) {
          cancelAnimationFrame(state.progressAnimationRef.current);
          state.progressAnimationRef.current = null;
        }

        const startProgress = Math.max(0, state.smoothProgress);
        const targetProgress = Math.max(0, state.processingProgress);
        const startTime = performance.now();
        const duration = 200; // Giảm xuống 200ms để nhanh hơn

        const animate = (currentTime) => {
          // FIXED: Kiểm tra state.showSpeedControl trong animation loop - không log
          if (state.showSpeedControl) {
            state.setSmoothProgress(Math.max(0, targetProgress));
            state.progressAnimationRef.current = null;
            return;
          }

          const elapsed = currentTime - startTime;
          const progress = Math.min(elapsed / duration, 1);

          // Faster easing
          const easeProgress = progress * progress; // Quadratic easing

          const currentValue =
            startProgress + (targetProgress - startProgress) * easeProgress;
          const roundedValue = Math.max(0, Math.round(currentValue));

          state.setSmoothProgress(roundedValue);

          if (progress < 1) {
            state.progressAnimationRef.current = requestAnimationFrame(animate);
          } else {
            state.setSmoothProgress(Math.max(0, targetProgress));
            state.progressAnimationRef.current = null;
            // Chỉ log completion cho major milestones
            if (targetProgress % 25 === 0) {
              console.log(
                "[state.smoothProgress] Animation completed at",
                Math.max(0, targetProgress)
              );
            }
          }
        };

        state.progressAnimationRef.current = requestAnimationFrame(animate);
      } else {
        // For small changes, set immediately - không log
        state.setSmoothProgress(Math.max(0, state.processingProgress));
      }
    }

    // Cleanup function
    return () => {
      if (state.progressAnimationRef.current) {
        cancelAnimationFrame(state.progressAnimationRef.current);
        state.progressAnimationRef.current = null;
      }
    };
  }, [state.processingProgress, state.showSpeedControl]); // Removed state.smoothProgress from deps to prevent loops
}; 