// soundtouch-worklet.js
class SoundTouchProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    console.log('[SoundTouchProcessor] 🎵 AudioWorklet processor initialized');
    
    this.pitchRatio = 1.0;
    this.bufferSize = 4096;
    this.inputBuffer = [];
    this.outputBuffer = [];
    
    // Simple pitch shifting using time-domain approach
    this.overlap = 0.25;
    this.grainSize = 1024;
    this.position = 0;
    
    // Message handling
    this.port.onmessage = (event) => {
      console.log('[SoundTouchProcessor] 📨 Received message:', event.data);
      
      if (event.data.type === 'setPitch') {
        this.pitchRatio = event.data.value;
        console.log('[SoundTouchProcessor] 🎛️ Pitch ratio set to:', this.pitchRatio);
      }
    };
  }
  
  // Simple pitch shifting algorithm
  pitchShift(inputData, pitchRatio) {
    if (pitchRatio === 1.0) {
      return inputData; // No processing needed
    }
    
    const outputData = new Float32Array(inputData.length);
    const frameSize = 1024;
    const hopSize = frameSize / 4;
    
    for (let i = 0; i < inputData.length - frameSize; i += hopSize) {
      const frame = inputData.slice(i, i + frameSize);
      
      // Simple time-stretching approach
      if (pitchRatio > 1.0) {
        // Higher pitch - compress time
        const newLength = Math.floor(frameSize / pitchRatio);
        for (let j = 0; j < newLength && i + j < outputData.length; j++) {
          const sourceIndex = Math.floor(j * pitchRatio);
          if (sourceIndex < frame.length) {
            outputData[i + j] += frame[sourceIndex] * 0.5; // Blend with existing
          }
        }
      } else {
        // Lower pitch - stretch time
        const stretchFactor = 1.0 / pitchRatio;
        for (let j = 0; j < frameSize && i + j < outputData.length; j++) {
          const sourceIndex = Math.floor(j / stretchFactor);
          if (sourceIndex < frame.length) {
            outputData[i + j] += frame[sourceIndex] * 0.5;
          }
        }
      }
    }
    
    return outputData;
  }
  
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    
    if (input.length === 0 || output.length === 0) {
      return true;
    }
    
    // Process each channel
    for (let channel = 0; channel < input.length; channel++) {
      const inputChannel = input[channel];
      const outputChannel = output[channel];
      
      if (this.pitchRatio === 1.0) {
        // No pitch change - direct copy
        outputChannel.set(inputChannel);
      } else {
        // Apply pitch shifting
        const processedData = this.pitchShift(inputChannel, this.pitchRatio);
        outputChannel.set(processedData);
      }
    }
    
    return true;
  }
}

// Register the processor
registerProcessor('soundtouch-processor', SoundTouchProcessor);

console.log('[SoundTouchProcessor] ✅ AudioWorklet processor registered');