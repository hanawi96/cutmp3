import React, { useState, useRef } from 'react';
import { ChevronUp, ChevronDown, Edit3, Check, X } from 'lucide-react';

const TimeStepper = ({ 
  value = 0, 
  onChange, 
  label, 
  maxValue = Infinity,
  minValue = 0,
  disabled = false
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
    if (disabled) return;
    
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
    if (disabled) return;
    setTempValue(formatTimeDisplay(value));
    setIsEditing(true);
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }, 10);
  };

  const confirmEdit = () => {
    const parsed = parseTimeString(tempValue);
    if (parsed !== null && parsed >= minValue && parsed <= maxValue) {
      onChange(parsed);
    } else {
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

  if (isEditing) {
    return (
      <div className="flex items-center space-x-1 bg-white dark:bg-gray-800 rounded-lg border-2 border-blue-300 p-2 relative z-20">
        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[60px]">
          {label}:
        </div>
        <input
          ref={inputRef}
          type="text"
          value={tempValue}
          onChange={(e) => setTempValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-24 px-2 py-1 text-sm border border-blue-300 rounded font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 dark:text-white"
          placeholder="mm:ss.sss"
          autoFocus
          spellCheck={false}
          autoComplete="off"
        />
        <button
          onClick={confirmEdit}
          className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
          title="Xác nhận"
        >
          <Check className="w-4 h-4" />
        </button>
        <button
          onClick={cancelEdit}
          className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
          title="Hủy"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 p-2 relative z-10">
      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[60px]">
        {label}:
      </div>
      
      {/* Time Display with Individual Steppers */}
      <div className="flex items-center space-x-1">
        {/* Minutes */}
        <div className="flex flex-col items-center">
          <button
            onClick={() => adjustTime('minutes', 1)}
            disabled={disabled}
            className="p-0.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed "
            title="Tăng phút"
          >
            <ChevronUp className="w-3 h-3" />
          </button>
          <div className="px-1.5 py-1 font-mono text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded min-w-[28px] text-center" >
            {minutes.toString().padStart(2, '0')}
          </div>
          <button
            onClick={() => adjustTime('minutes', -1)}
            disabled={disabled}
            className="p-0.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Giảm phút"
          >
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>

        <span className="text-gray-400 font-mono text-sm">:</span>

        {/* Seconds */}
        <div className="flex flex-col items-center">
          <button
            onClick={() => adjustTime('seconds', 1)}
            disabled={disabled}
            className="p-0.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Tăng giây"
          >
            <ChevronUp className="w-3 h-3" />
          </button>
          <div className="px-1.5 py-1 font-mono text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded min-w-[28px] text-center">
            {seconds.toString().padStart(2, '0')}
          </div>
          <button
            onClick={() => adjustTime('seconds', -1)}
            disabled={disabled}
            className="p-0.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Giảm giây"
          >
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>

        <span className="text-gray-400 font-mono text-sm">.</span>

        {/* Milliseconds */}
        <div className="flex flex-col items-center">
          <button
            onClick={() => adjustTime('milliseconds', 1)}
            disabled={disabled}
            className="p-0.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Tăng 100ms"
          >
            <ChevronUp className="w-3 h-3" />
          </button>
          <div className="px-1.5 py-1 font-mono text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded min-w-[32px] text-center">
            {milliseconds.toString().padStart(3, '0')}
          </div>
          <button
            onClick={() => adjustTime('milliseconds', -1)}
            disabled={disabled}
            className="p-0.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Giảm 100ms"
          >
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Edit Button */}
      <button
        onClick={startEditing}
        disabled={disabled}
        className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Chỉnh sửa trực tiếp"
      >
        <Edit3 className="w-4 h-4" />
      </button>
    </div>
  );
};

export default TimeStepper;