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

// Enhanced button reset styles to ensure consistent appearance
const buttonResetStyles = {
  border: 'none',
  background: 'transparent',
  padding: 0,
  margin: 0,
  fontSize: 'inherit',
  fontFamily: 'inherit',
  cursor: 'pointer',
  ...noFocusStyles
};

// Custom small font style - 20% smaller than text-xs (12px -> ~9.6px)
const smallFontStyle = {
  fontSize: '0.8rem',
  lineHeight: '12px'
};

// Input field style with centered text
const inputCenteredStyle = {
  textAlign: 'center',
  fontSize: '10px',
  ...buttonResetStyles
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
    if (!compact) return {
      container: "p-2",
      label: "text-sm min-w-[50px]",
      button: "p-1.5 w-8 h-8 flex items-center justify-center",
      icon: "w-4 h-4",
      display: "px-2 py-0.5 text-sm min-w-[32px] h-7 flex items-center justify-center",
      editButton: "p-1.5 w-8 h-8 flex items-center justify-center",
      editIcon: "w-4 h-4",
      input: "w-24 px-2 py-0.5 text-sm",
      actionButton: "p-1.5 w-8 h-8 flex items-center justify-center",
      actionIcon: "w-4 h-4"
    };
    
    return {
      container: "px-2 py-1",
      label: "text-xs min-w-[40px] font-medium",
      button: "p-0.5 w-5 h-4 flex items-center justify-center",
      icon: "w-3 h-3",
      display: "px-1.5 py-0 text-xs min-w-[20px] h-4 flex items-center justify-center",
      editButton: "p-0.5 w-5 h-4 flex items-center justify-center",
      editIcon: "w-3 h-3",
      input: "w-18 px-1.5 py-0 text-xs",
      actionButton: "p-0.5 w-5 h-4 flex items-center justify-center",
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
      <div className={`flex items-center gap-0.5 bg-white/90 backdrop-blur-sm border border-blue-200 rounded-md shadow-sm ${classes.container} relative z-20`} style={noFocusStyles}>
        <div className={`text-xs font-medium text-blue-600 ${classes.label} flex-shrink-0`}>
          {label}:
        </div>
        <input
          ref={inputRef}
          type="text"
          value={tempValue}
          onChange={(e) => setTempValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className={`${classes.input} rounded font-mono bg-white border border-gray-200 text-gray-700 focus:border-blue-300 focus:ring-1 focus:ring-blue-300 transition-all`}
          style={inputCenteredStyle}
          placeholder="mm:ss.sss"
          autoFocus
          spellCheck={false}
          autoComplete="off"
        />
        <button
          type="button"
          onClick={confirmEdit}
          className={`${classes.actionButton} text-green-600 hover:text-green-700 hover:bg-green-50 rounded border border-green-200 hover:border-green-300 transition-all duration-200`}
          style={buttonResetStyles}
          title="Xác nhận"
        >
          <Check className={classes.actionIcon} />
        </button>
        <button
          type="button"
          onClick={cancelEdit}
          className={`${classes.actionButton} text-red-600 hover:text-red-700 hover:bg-red-50 rounded border border-red-200 hover:border-red-300 transition-all duration-200`}
          style={buttonResetStyles}
          title="Hủy"
        >
          <X className={classes.actionIcon} />
        </button>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${isRealTime ? 'bg-blue-50/80 border border-blue-200' : 'bg-gray-50/80 border border-gray-200'} rounded-md shadow-sm ${classes.container} relative z-10 ${isRealTime ? realTimeClasses.pulse : ''} transition-all duration-200`} style={noFocusStyles}>
      <div className={`text-xs font-medium ${isRealTime ? 'text-blue-600 font-semibold' : 'text-gray-600'} ${classes.label} flex-shrink-0`}>
        {label}:
      </div>
      
      {/* Time Display with Individual Steppers */}
      <div className="flex items-center gap-1.5">
        {/* Minutes */}
        <div className="flex flex-col items-center gap-0">
          <button
            type="button"
            onClick={() => adjustTime('minutes', 1)}
            disabled={disabled || isRealTime}
            className={`${classes.button} text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded border border-transparent hover:border-blue-200 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:border-transparent`}
            style={buttonResetStyles}
            title="Tăng phút"
          >
            <ChevronUp className={classes.icon} />
          </button>
          <button
            type="button"
            onClick={startEditing}
            disabled={disabled || isRealTime}
            className={`${classes.display} font-mono ${isRealTime ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-white text-gray-700 border-gray-200'} rounded border hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 transition-all duration-200 cursor-pointer disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-gray-200 disabled:hover:text-gray-700`}
            style={{...buttonResetStyles, ...smallFontStyle}}
            title="Click để chỉnh sửa thời gian"
          >
            {minutes.toString().padStart(2, '0')}
          </button>
          <button
            type="button"
            onClick={() => adjustTime('minutes', -1)}
            disabled={disabled || isRealTime}
            className={`${classes.button} text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded border border-transparent hover:border-blue-200 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:border-transparent`}
            style={buttonResetStyles}
            title="Giảm phút"
          >
            <ChevronDown className={classes.icon} />
          </button>
        </div>

        <button
          type="button"
          onClick={startEditing}
          disabled={disabled || isRealTime}
          className="text-gray-400 font-mono hover:text-blue-600 transition-colors duration-200 cursor-pointer disabled:cursor-not-allowed px-1"
          style={{...buttonResetStyles, ...smallFontStyle}}
          title="Click để chỉnh sửa thời gian"
        >
          :
        </button>

        {/* Seconds */}
        <div className="flex flex-col items-center gap-0">
          <button
            type="button"
            onClick={() => adjustTime('seconds', 1)}
            disabled={disabled || isRealTime}
            className={`${classes.button} text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded border border-transparent hover:border-blue-200 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:border-transparent`}
            style={buttonResetStyles}
            title="Tăng giây"
          >
            <ChevronUp className={classes.icon} />
          </button>
          <button
            type="button"
            onClick={startEditing}
            disabled={disabled || isRealTime}
            className={`${classes.display} font-mono ${isRealTime ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-white text-gray-700 border-gray-200'} rounded border hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 transition-all duration-200 cursor-pointer disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-gray-200 disabled:hover:text-gray-700`}
            style={{...buttonResetStyles, ...smallFontStyle}}
            title="Click để chỉnh sửa thời gian"
          >
            {seconds.toString().padStart(2, '0')}
          </button>
          <button
            type="button"
            onClick={() => adjustTime('seconds', -1)}
            disabled={disabled || isRealTime}
            className={`${classes.button} text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded border border-transparent hover:border-blue-200 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:border-transparent`}
            style={buttonResetStyles}
            title="Giảm giây"
          >
            <ChevronDown className={classes.icon} />
          </button>
        </div>

        <button
          type="button"
          onClick={startEditing}
          disabled={disabled || isRealTime}
          className="text-gray-400 font-mono hover:text-blue-600 transition-colors duration-200 cursor-pointer disabled:cursor-not-allowed px-1"
          style={{...buttonResetStyles, ...smallFontStyle}}
          title="Click để chỉnh sửa thời gian"
        >
          .
        </button>

        {/* Milliseconds */}
        <div className="flex flex-col items-center gap-0">
          <button
            type="button"
            onClick={() => adjustTime('milliseconds', 1)}
            disabled={disabled || isRealTime}
            className={`${classes.button} text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded border border-transparent hover:border-blue-200 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:border-transparent`}
            style={buttonResetStyles}
            title="Tăng 100ms"
          >
            <ChevronUp className={classes.icon} />
          </button>
          <button
            type="button"
            onClick={startEditing}
            disabled={disabled || isRealTime}
            className={`${classes.display} font-mono ${isRealTime ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-white text-gray-700 border-gray-200'} rounded border hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 transition-all duration-200 cursor-pointer disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-gray-200 disabled:hover:text-gray-700`}
            style={{...buttonResetStyles, ...smallFontStyle}}
            title="Click để chỉnh sửa thời gian"
          >
            {milliseconds.toString().padStart(3, '0')}
          </button>
          <button
            type="button"
            onClick={() => adjustTime('milliseconds', -1)}
            disabled={disabled || isRealTime}
            className={`${classes.button} text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded border border-transparent hover:border-blue-200 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:border-transparent`}
            style={buttonResetStyles}
            title="Giảm 100ms"
          >
            <ChevronDown className={classes.icon} />
          </button>
        </div>
      </div>

      {/* Edit Button - chỉ hiện khi không ở real-time mode */}
      {showEditButton && !isRealTime && (
        <button
          type="button"
          onClick={startEditing}
          disabled={disabled}
          className={`${classes.editButton} text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded border border-transparent hover:border-blue-200 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:border-transparent flex-shrink-0`}
          style={buttonResetStyles}
          title="Chỉnh sửa trực tiếp"
        >
          <Edit3 className={classes.editIcon} />
        </button>
      )}

      {/* Real-time indicator */}
      {isRealTime && (
        <div className="flex items-center gap-1 flex-shrink-0">
          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
          <span className="text-xs text-blue-600 font-medium">LIVE</span>
        </div>
      )}
    </div>
  );
};

export default TimeStepper;