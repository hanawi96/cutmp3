import React, { useState, useRef } from 'react';
import { ChevronUp, ChevronDown, Edit3, Check, X} from 'lucide-react';

// Custom CSS to completely disable focus styles
const noFocusStyles = {
  outline: 'none !important',
  boxShadow: 'none !important',
  borderColor: 'transparent !important',
  '&:focus': {
    outline: 'none !important',
    boxShadow: 'none !important',
    borderColor: 'transparent !important',
  },
  '&:focus-visible': {
    outline: 'none !important',
    boxShadow: 'none !important',
    borderColor: 'transparent !important',
  }
};

const TimeStepper = ({ 
  value = 0, 
  onChange, 
  label, 
  maxValue = Infinity,
  minValue = 0,
  disabled = false,
  compact = false,
  isRealTime = false,
  showEditButton = true
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState('');
  const inputRef = useRef(null);

  // Parse time to components
  const parseTime = (seconds) => {
    const totalMs = Math.round(seconds * 1000);
    const minutes = Math.floor(totalMs / 60000);
    const secs = Math.floor((totalMs % 60000) / 1000);
    const ms = totalMs % 1000;
    return { minutes, seconds: secs, milliseconds: ms };
  };

  // Convert components to seconds
  const toSeconds = (minutes, seconds, milliseconds) => {
    return minutes * 60 + seconds + milliseconds / 1000;
  };

  const { minutes, seconds, milliseconds } = parseTime(value);

  // Format for display
  const formatTimeDisplay = (val) => {
    const { minutes, seconds, milliseconds } = parseTime(val);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
  };

  // Increment/Decrement handlers
  const adjustTime = (component, delta) => {
    if (disabled || isRealTime) return;
    
    let newMinutes = minutes;
    let newSeconds = seconds;
    let newMilliseconds = milliseconds;

    switch (component) {
      case 'minutes':
        newMinutes = Math.max(0, minutes + delta);
        break;
      case 'seconds':
        newSeconds = seconds + delta;
        if (newSeconds >= 60) {
          newMinutes += Math.floor(newSeconds / 60);
          newSeconds = newSeconds % 60;
        } else if (newSeconds < 0) {
          const borrowMinutes = Math.ceil(Math.abs(newSeconds) / 60);
          if (newMinutes >= borrowMinutes) {
            newMinutes -= borrowMinutes;
            newSeconds = 60 + (newSeconds % 60);
          } else {
            newSeconds = 0;
          }
        }
        break;
      case 'milliseconds':
        newMilliseconds = milliseconds + delta * 100; // Tăng/giảm 100ms mỗi lần
        if (newMilliseconds >= 1000) {
          const addSeconds = Math.floor(newMilliseconds / 1000);
          newSeconds += addSeconds;
          newMilliseconds = newMilliseconds % 1000;
          if (newSeconds >= 60) {
            newMinutes += Math.floor(newSeconds / 60);
            newSeconds = newSeconds % 60;
          }
        } else if (newMilliseconds < 0) {
          if (newSeconds > 0 || newMinutes > 0) {
            if (newSeconds > 0) {
              newSeconds -= 1;
              newMilliseconds = 1000 + newMilliseconds;
            } else if (newMinutes > 0) {
              newMinutes -= 1;
              newSeconds = 59;
              newMilliseconds = 1000 + newMilliseconds;
            }
          } else {
            newMilliseconds = 0;
          }
        }
        break;
    }

    const newValue = toSeconds(newMinutes, newSeconds, newMilliseconds);
    
    // Apply bounds
    if (newValue >= minValue && newValue <= maxValue) {
      onChange(newValue);
    }
  };

 // Handle direct editing
const startEditing = () => {
  if (disabled || isRealTime) {
    console.log("[TimeStepper] startEditing blocked - disabled:", disabled, "isRealTime:", isRealTime);
    return;
  }
  
  console.log("[TimeStepper] Starting edit mode for", label, "current value:", value);
  console.log("[TimeStepper] Triggered by click on time display or edit button");
  
  setTempValue(formatTimeDisplay(value));
  setIsEditing(true);
  
  setTimeout(() => {
    if (inputRef.current) {
      console.log("[TimeStepper] Focusing input with value:", formatTimeDisplay(value));
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, 10);
};

  const confirmEdit = () => {
    console.log("[TimeStepper] Confirming edit for", label, "tempValue:", tempValue);
    const parsed = parseTimeString(tempValue);
    console.log("[TimeStepper] Parsed time:", parsed, "bounds:", minValue, "to", maxValue);
    
    if (parsed !== null && parsed >= minValue && parsed <= maxValue) {
      console.log("[TimeStepper] Valid time, calling onChange with:", parsed);
      onChange(parsed);
    } else {
      console.warn("[TimeStepper] Invalid time:", { parsed, minValue, maxValue });
      alert('❌ Thời gian không hợp lệ');
    }
    setIsEditing(false);
    setTempValue('');
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setTempValue('');
  };

  const parseTimeString = (timeStr) => {
    const cleanStr = timeStr.trim();
    
    // Format: mm:ss.sss
    const fullMatch = cleanStr.match(/^(\d+):(\d{1,2})\.(\d{1,3})$/);
    if (fullMatch) {
      const [, min, sec, ms] = fullMatch;
      return parseInt(min) * 60 + parseInt(sec) + parseInt(ms.padEnd(3, '0')) / 1000;
    }
    
    // Format: mm:ss
    const minSecMatch = cleanStr.match(/^(\d+):(\d{1,2})$/);
    if (minSecMatch) {
      const [, min, sec] = minSecMatch;
      return parseInt(min) * 60 + parseInt(sec);
    }
    
    return null;
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      confirmEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  };

  const getCompactClasses = () => {
    if (!compact) return {};
    return {
      container: "p-1",
      label: "text-[10px] min-w-[40px]",
      button: "p-0.5",
      icon: "w-2.5 h-2.5",
      display: "px-1 py-0.5 text-xs min-w-[24px]",
      editButton: "p-0.5",
      editIcon: "w-3 h-3",
      input: "w-20 px-1.5 py-0.5 text-xs",
      actionButton: "p-0.5",
      actionIcon: "w-3 h-3"
    };
  };

  // Thêm class cho real-time mode
  const getRealTimeClasses = () => {
    if (!isRealTime) return {};
    return {
      container: "bg-blue-50 border-blue-200",
      label: "text-blue-600 font-semibold",
      display: "bg-blue-100 text-blue-800 font-mono",
      pulse: "animate-pulse"
    };
  };

  const realTimeClasses = getRealTimeClasses();
  const classes = getCompactClasses();

  if (isEditing) {
    return (
      <div className={`flex items-center space-x-0.5 bg-white dark:bg-gray-800 rounded-lg ${classes.container} relative z-20`} style={noFocusStyles}>
        <div className={`text-xs font-medium text-gray-500 dark:text-gray-400 ${classes.label}`}>
          {label}:
        </div>
        <input
          ref={inputRef}
          type="text"
          value={tempValue}
          onChange={(e) => setTempValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className={`${classes.input} rounded font-mono bg-white dark:bg-gray-700 dark:text-white border-0 focus:border-0 focus:ring-0 focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:border-0`}
          style={noFocusStyles}
          placeholder="mm:ss.sss"
          autoFocus
          spellCheck={false}
          autoComplete="off"
        />
        <button
          onClick={confirmEdit}
          className={`${classes.actionButton} text-green-600 hover:bg-green-50 rounded transition-colors border-0 focus:border-0 focus:ring-0 focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:border-0`}
          style={noFocusStyles}
          title="Xác nhận"
        >
          <Check className={classes.actionIcon} />
        </button>
        <button
          onClick={cancelEdit}
          className={`${classes.actionButton} text-red-600 hover:bg-red-50 rounded transition-colors border-0 focus:border-0 focus:ring-0 focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:border-0`}
          style={noFocusStyles}
          title="Hủy"
        >
          <X className={classes.actionIcon} />
        </button>
      </div>
    );
  }

  return (
    <div className={`flex items-center space-x-1 ${isRealTime ? realTimeClasses.container : 'bg-gray-50 dark:bg-gray-700'} rounded-lg ${classes.container} relative z-10 ${isRealTime ? realTimeClasses.pulse : ''}`} style={noFocusStyles}>
      <div className={`text-xs font-medium ${isRealTime ? realTimeClasses.label : 'text-gray-500 dark:text-gray-400'} ${classes.label}`}>
        {label}:
      </div>
      
      {/* Time Display with Individual Steppers */}
      <div className="flex items-center space-x-0.5">
        {/* Minutes */}
        <div className="flex flex-col items-center">
          <button
            onClick={() => adjustTime('minutes', 1)}
            disabled={disabled || isRealTime}
            className={`${classes.button} text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed border-0 focus:border-0 focus:ring-0 focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:border-0`}
            style={noFocusStyles}
            title="Tăng phút"
          >
            <ChevronUp className={classes.icon} />
          </button>
          <button
            onClick={startEditing}
            disabled={disabled || isRealTime}
            className={`${classes.display} font-mono ${isRealTime ? realTimeClasses.display : 'bg-white dark:bg-gray-800'} rounded text-center border-0 focus:border-0 focus:ring-0 focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:border-0 hover:bg-blue-50 hover:text-blue-600 transition-colors cursor-pointer disabled:cursor-not-allowed`}
            style={noFocusStyles}
            title="Click để chỉnh sửa thời gian"
          >
            {minutes.toString().padStart(2, '0')}
          </button>
          <button
            onClick={() => adjustTime('minutes', -1)}
            disabled={disabled || isRealTime}
            className={`${classes.button} text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed border-0 focus:border-0 focus:ring-0 focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:border-0`}
            style={noFocusStyles}
            title="Giảm phút"
          >
            <ChevronDown className={classes.icon} />
          </button>
        </div>

        <button
  onClick={startEditing}
  disabled={disabled || isRealTime}
  className="text-gray-400 font-mono text-xs hover:text-blue-600 transition-colors cursor-pointer disabled:cursor-not-allowed bg-transparent border-none p-0 m-0"
  style={noFocusStyles}
  title="Click để chỉnh sửa thời gian"
>
  :
</button>

        {/* Seconds */}
        <div className="flex flex-col items-center">
          <button
            onClick={() => adjustTime('seconds', 1)}
            disabled={disabled || isRealTime}
            className={`${classes.button} text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed border-0 focus:border-0 focus:ring-0 focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:border-0`}
            style={noFocusStyles}
            title="Tăng giây"
          >
            <ChevronUp className={classes.icon} />
          </button>
          <button
            onClick={startEditing}
            disabled={disabled || isRealTime}
            className={`${classes.display} font-mono ${isRealTime ? realTimeClasses.display : 'bg-white dark:bg-gray-800'} rounded text-center border-0 focus:border-0 focus:ring-0 focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:border-0 hover:bg-blue-50 hover:text-blue-600 transition-colors cursor-pointer disabled:cursor-not-allowed`}
            style={noFocusStyles}
            title="Click để chỉnh sửa thời gian"
          >
            {seconds.toString().padStart(2, '0')}
          </button>
          <button
            onClick={() => adjustTime('seconds', -1)}
            disabled={disabled || isRealTime}
            className={`${classes.button} text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed border-0 focus:border-0 focus:ring-0 focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:border-0`}
            style={noFocusStyles}
            title="Giảm giây"
          >
            <ChevronDown className={classes.icon} />
          </button>
        </div>

        <button
  onClick={startEditing}
  disabled={disabled || isRealTime}
  className="text-gray-400 font-mono text-xs hover:text-blue-600 transition-colors cursor-pointer disabled:cursor-not-allowed bg-transparent border-none p-0 m-0"
  style={noFocusStyles}
  title="Click để chỉnh sửa thời gian"
>
  .
</button>

        {/* Milliseconds */}
        <div className="flex flex-col items-center">
          <button
            onClick={() => adjustTime('milliseconds', 1)}
            disabled={disabled || isRealTime}
            className={`${classes.button} text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed border-0 focus:border-0 focus:ring-0 focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:border-0`}
            style={noFocusStyles}
            title="Tăng 100ms"
          >
            <ChevronUp className={classes.icon} />
          </button>
          <button
            onClick={startEditing}
            disabled={disabled || isRealTime}
            className={`${classes.display} font-mono ${isRealTime ? realTimeClasses.display : 'bg-white dark:bg-gray-800'} rounded text-center border-0 focus:border-0 focus:ring-0 focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:border-0 hover:bg-blue-50 hover:text-blue-600 transition-colors cursor-pointer disabled:cursor-not-allowed`}
            style={noFocusStyles}
            title="Click để chỉnh sửa thời gian"
          >
            {milliseconds.toString().padStart(3, '0')}
          </button>
          <button
            onClick={() => adjustTime('milliseconds', -1)}
            disabled={disabled || isRealTime}
            className={`${classes.button} text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed border-0 focus:border-0 focus:ring-0 focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:border-0`}
            style={noFocusStyles}
            title="Giảm 100ms"
          >
            <ChevronDown className={classes.icon} />
          </button>
        </div>
      </div>

      {/* Edit Button - chỉ hiện khi không ở real-time mode */}
      {showEditButton && !isRealTime && (
        <button
          onClick={startEditing}
          disabled={disabled}
          className={`${classes.editButton} text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed border-0 focus:border-0 focus:ring-0 focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:border-0`}
          style={noFocusStyles}
          title="Chỉnh sửa trực tiếp"
        >
          <Edit3 className={classes.editIcon} />
        </button>
      )}

      {/* Real-time indicator */}
      {isRealTime && (
        <div className="flex items-center space-x-1">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
          <span className="text-xs text-blue-600 font-medium">LIVE</span>
        </div>
      )}
    </div>
  );
};

export default TimeStepper;