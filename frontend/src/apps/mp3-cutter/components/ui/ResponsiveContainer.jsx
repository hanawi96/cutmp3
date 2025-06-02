import React from 'react';

export default function ResponsiveContainer({ 
  children, 
  className = '', 
  mobileOptimized = true,
  maxWidth = 'max-w-4xl',
  padding = 'px-3 sm:px-6',
  spacing = 'space-y-4 sm:space-y-6'
}) {
  const baseClasses = `w-full ${maxWidth} mx-auto ${padding}`;
  const mobileClasses = mobileOptimized 
    ? 'touch-manipulation safe-left safe-right' 
    : '';
  const combinedClasses = `${baseClasses} ${mobileClasses} ${className}`.trim();

  return (
    <div className={combinedClasses}>
      <div className={spacing}>
        {children}
      </div>
    </div>
  );
}

// Mobile-optimized card component
export function MobileCard({ 
  children, 
  className = '', 
  noPadding = false,
  shadow = true
}) {
  const baseClasses = 'bg-white rounded-lg';
  const paddingClasses = noPadding ? '' : 'p-4 sm:p-6';
  const shadowClasses = shadow ? 'shadow-md hover:shadow-lg' : '';
  const mobileClasses = 'mx-3 sm:mx-0 transition-shadow duration-200';
  
  const combinedClasses = `${baseClasses} ${paddingClasses} ${shadowClasses} ${mobileClasses} ${className}`.trim();

  return (
    <div className={combinedClasses}>
      {children}
    </div>
  );
}

// Mobile-optimized button component
export function MobileButton({ 
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  disabled = false,
  className = '',
  ...props
}) {
  const variants = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-700',
    outline: 'border-2 border-blue-600 text-blue-600 hover:bg-blue-50'
  };

  const sizes = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-3 text-sm sm:text-base',
    lg: 'px-6 py-4 text-base sm:text-lg'
  };

  const baseClasses = 'rounded-lg font-semibold transition-all duration-200 touch-manipulation focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2';
  const disabledClasses = disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95';
  const widthClasses = fullWidth ? 'w-full' : '';
  const mobileClasses = 'min-h-[44px] min-w-[44px]'; // iOS touch target guidelines

  const combinedClasses = `${baseClasses} ${variants[variant]} ${sizes[size]} ${widthClasses} ${mobileClasses} ${disabledClasses} ${className}`.trim();

  return (
    <button
      className={combinedClasses}
      onClick={onClick}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}

// Mobile-optimized input component
export function MobileInput({ 
  type = 'text',
  placeholder,
  value,
  onChange,
  className = '',
  label,
  error,
  ...props
}) {
  const baseClasses = 'w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors';
  const mobileClasses = 'text-base min-h-[44px] touch-manipulation'; // Prevents zoom on iOS
  const errorClasses = error ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : '';

  const combinedClasses = `${baseClasses} ${mobileClasses} ${errorClasses} ${className}`.trim();

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className={combinedClasses}
        {...props}
      />
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}

// Mobile-optimized progress bar
export function MobileProgress({ 
  value, 
  max = 100, 
  className = '',
  showValue = true,
  size = 'md' 
}) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  
  const sizes = {
    sm: 'h-2',
    md: 'h-3',
    lg: 'h-4'
  };

  const baseClasses = `w-full bg-gray-200 rounded-full overflow-hidden ${sizes[size]}`;
  const combinedClasses = `${baseClasses} ${className}`.trim();

  return (
    <div className="space-y-2">
      <div className={combinedClasses}>
        <div 
          className="h-full bg-gradient-to-r from-blue-600 to-purple-600 transition-all duration-300 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showValue && (
        <div className="flex justify-between text-sm text-gray-600">
          <span>{Math.round(percentage)}%</span>
          <span>{value} / {max}</span>
        </div>
      )}
    </div>
  );
} 