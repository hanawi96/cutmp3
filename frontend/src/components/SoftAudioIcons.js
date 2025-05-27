// components/SoftAudioIcons.js
import React from 'react';

// Soft Fade In Icon - Thiết kế mềm mại với gradient và curves
export const SoftFadeInIcon = ({ className = "w-6 h-6" }) => (
  <svg 
    className={className} 
    viewBox="0 0 32 32" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      {/* Gradient for soft fade effect */}
      <linearGradient id="fadeInGradient" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" style={{stopColor: 'currentColor', stopOpacity: 0.2}} />
        <stop offset="50%" style={{stopColor: 'currentColor', stopOpacity: 0.6}} />
        <stop offset="100%" style={{stopColor: 'currentColor', stopOpacity: 1}} />
      </linearGradient>
      
      {/* Soft shadow filter */}
      <filter id="softShadow">
        <feDropShadow dx="0" dy="1" stdDeviation="1" floodOpacity="0.2"/>
      </filter>
    </defs>
    
    {/* Soft waveform using smooth curves */}
    <path 
      d="M4 24 Q8 22, 12 20 Q16 18, 20 16 Q24 14, 28 12" 
      stroke="url(#fadeInGradient)" 
      strokeWidth="3" 
      strokeLinecap="round"
      fill="none"
      filter="url(#softShadow)"
    />
    
    {/* Soft volume indicators */}
    <circle cx="6" cy="23" r="1.5" fill="currentColor" opacity="0.3" />
    <circle cx="12" cy="20" r="2" fill="currentColor" opacity="0.5" />
    <circle cx="18" cy="17" r="2.5" fill="currentColor" opacity="0.7" />
    <circle cx="24" cy="14" r="3" fill="currentColor" opacity="0.9" />
    
    {/* Soft upward arrow with rounded edges */}
    <path 
      d="M24 8 Q26 6, 28 8 Q26 10, 24 8" 
      fill="currentColor" 
      opacity="0.7"
    />
    <path 
      d="M26 4 Q26 6, 26 8" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round"
      opacity="0.7"
    />
    
    {/* Soft time label */}
    <text 
      x="16" 
      y="30" 
      textAnchor="middle"
      fontSize="8" 
      fontWeight="600" 
      fill="currentColor"
      opacity="0.9"
      style={{fontFamily: 'system-ui, sans-serif'}}
    >
      2s
    </text>
  </svg>
);

// Soft Fade Out Icon - Thiết kế mềm mại với gradient ngược
export const SoftFadeOutIcon = ({ className = "w-6 h-6" }) => (
  <svg 
    className={className} 
    viewBox="0 0 32 32" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      {/* Gradient for soft fade out effect */}
      <linearGradient id="fadeOutGradient" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" style={{stopColor: 'currentColor', stopOpacity: 1}} />
        <stop offset="50%" style={{stopColor: 'currentColor', stopOpacity: 0.6}} />
        <stop offset="100%" style={{stopColor: 'currentColor', stopOpacity: 0.2}} />
      </linearGradient>
      
      {/* Soft shadow filter */}
      <filter id="softShadowOut">
        <feDropShadow dx="0" dy="1" stdDeviation="1" floodOpacity="0.2"/>
      </filter>
    </defs>
    
    {/* Soft waveform using smooth curves - descending */}
    <path 
      d="M4 12 Q8 14, 12 16 Q16 18, 20 20 Q24 22, 28 24" 
      stroke="url(#fadeOutGradient)" 
      strokeWidth="3" 
      strokeLinecap="round"
      fill="none"
      filter="url(#softShadowOut)"
    />
    
    {/* Soft volume indicators - decreasing */}
    <circle cx="6" cy="13" r="3" fill="currentColor" opacity="0.9" />
    <circle cx="12" cy="16" r="2.5" fill="currentColor" opacity="0.7" />
    <circle cx="18" cy="19" r="2" fill="currentColor" opacity="0.5" />
    <circle cx="24" cy="22" r="1.5" fill="currentColor" opacity="0.3" />
    
    {/* Soft downward arrow with rounded edges */}
    <path 
      d="M24 24 Q26 26, 28 24 Q26 22, 24 24" 
      fill="currentColor" 
      opacity="0.7"
    />
    <path 
      d="M26 20 Q26 22, 26 24" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round"
      opacity="0.7"
    />
    
    {/* Soft time label */}
    <text 
      x="16" 
      y="30" 
      textAnchor="middle"
      fontSize="8" 
      fontWeight="600" 
      fill="currentColor"
      opacity="0.9"
      style={{fontFamily: 'system-ui, sans-serif'}}
    >
      2s
    </text>
  </svg>
);

// Soft Speed Control Icon - Không cần thay đổi vì đã giống demo
export const SoftSpeedControlIcon = ({ className = "w-6 h-6" }) => (
  <svg 
    className={className} 
    viewBox="0 0 32 32" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      {/* Gradient for speedometer */}
      <linearGradient id="speedGradient" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" style={{stopColor: 'currentColor', stopOpacity: 0.4}} />
        <stop offset="50%" style={{stopColor: 'currentColor', stopOpacity: 0.7}} />
        <stop offset="100%" style={{stopColor: 'currentColor', stopOpacity: 1}} />
      </linearGradient>
      
      {/* Soft glow filter */}
      <filter id="softGlow">
        <feGaussianBlur stdDeviation="1" result="coloredBlur"/>
        <feMerge> 
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    
    {/* Soft speedometer arc */}
    <path 
      d="M6 20 A10 10 0 0 1 26 20" 
      stroke="url(#speedGradient)" 
      strokeWidth="3" 
      strokeLinecap="round"
      fill="none"
      filter="url(#softGlow)"
    />
    
    {/* Soft speed marks */}
    <circle cx="8" cy="20" r="1.5" fill="currentColor" opacity="0.5" />
    <circle cx="16" cy="12" r="1.5" fill="currentColor" opacity="0.6" />
    <circle cx="24" cy="20" r="1.5" fill="currentColor" opacity="0.8" />
    
    {/* Soft center hub with gradient */}
    <circle 
      cx="16" 
      cy="20" 
      r="2.5" 
      fill="currentColor" 
      opacity="0.8"
      filter="url(#softGlow)"
    />
    
    {/* Soft needle with rounded tip */}
    <path 
      d="M16 20 L22 15" 
      stroke="currentColor" 
      strokeWidth="2.5" 
      strokeLinecap="round"
      opacity="0.9"
      filter="url(#softGlow)"
    />
    
    {/* Soft speed labels with better typography */}
    <text x="6" y="28" fontSize="5" fontWeight="400" fill="currentColor" opacity="0.6" style={{fontFamily: 'system-ui, sans-serif'}}>
      0.5x
    </text>
    <text x="14" y="8" fontSize="5" fontWeight="400" fill="currentColor" opacity="0.6" style={{fontFamily: 'system-ui, sans-serif'}}>
      1x
    </text>
    <text x="22" y="28" fontSize="5" fontWeight="400" fill="currentColor" opacity="0.8" style={{fontFamily: 'system-ui, sans-serif'}}>
      2x
    </text>
    
    {/* Soft label */}
    <text 
      x="16" 
      y="30" 
      textAnchor="middle"
      fontSize="5" 
      fontWeight="500" 
      fill="currentColor"
      opacity="0.7"
      style={{fontFamily: 'system-ui, sans-serif', letterSpacing: '0.5px'}}
    >
      SPEED
    </text>
  </svg>
);

// Enhanced Fade In Icon - Larger and clearer
export const FadeInIcon = ({ className = "w-6 h-6" }) => (
  <svg 
    className={className} 
    viewBox="0 0 32 32" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Speaker body - larger */}
    <path 
      d="M4 10 L4 22 L10 22 L18 28 L18 4 L10 10 Z" 
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="0.5"
      strokeLinejoin="round"
    />
    
    {/* Sound waves - ascending volume */}
    <path 
      d="M22 14 Q25 14, 25 16 Q25 18, 22 18" 
      stroke="currentColor" 
      strokeWidth="2.5" 
      strokeLinecap="round"
      fill="none"
      opacity="0.7"
    />
    <path 
      d="M26 12 Q30 12, 30 16 Q30 20, 26 20" 
      stroke="currentColor" 
      strokeWidth="2.5" 
      strokeLinecap="round"
      fill="none"
      opacity="0.9"
    />
    
    {/* Fade in indicator - up arrow */}
    <path 
      d="M24 6 L27 3 L30 6" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);

// Enhanced Fade Out Icon - Larger and clearer
export const FadeOutIcon = ({ className = "w-6 h-6" }) => (
  <svg 
    className={className} 
    viewBox="0 0 32 32" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Speaker body - larger */}
    <path 
      d="M4 10 L4 22 L10 22 L18 28 L18 4 L10 10 Z" 
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="0.5"
      strokeLinejoin="round"
    />
    
    {/* Sound waves - descending volume */}
    <path 
      d="M22 14 Q25 14, 25 16 Q25 18, 22 18" 
      stroke="currentColor" 
      strokeWidth="2.5" 
      strokeLinecap="round"
      fill="none"
      opacity="0.9"
    />
    <path 
      d="M26 12 Q30 12, 30 16 Q30 20, 26 20" 
      stroke="currentColor" 
      strokeWidth="2.5" 
      strokeLinecap="round"
      fill="none"
      opacity="0.4"
    />
    
    {/* Fade out indicator - down arrow */}
    <path 
      d="M24 26 L27 29 L30 26" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);

// Enhanced Speed Control Icon - Larger speedometer
export const SpeedControlIcon = ({ className = "w-6 h-6" }) => (
  <svg 
    className={className} 
    viewBox="0 0 32 32" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Speedometer arc - larger */}
    <path 
      d="M6 16 A10 10 0 0 1 26 16" 
      stroke="currentColor" 
      strokeWidth="3" 
      strokeLinecap="round"
      fill="none"
    />
    
    {/* Center dot - larger */}
    <circle cx="16" cy="16" r="2.5" fill="currentColor" />
    
    {/* Speed needle pointing to fast - longer */}
    <path 
      d="M16 16 L24 10" 
      stroke="currentColor" 
      strokeWidth="3" 
      strokeLinecap="round"
    />
    
    {/* Speed marks - larger */}
    <circle cx="8" cy="16" r="1.8" fill="currentColor" />
    <circle cx="16" cy="8" r="1.8" fill="currentColor" />
    <circle cx="24" cy="16" r="1.8" fill="currentColor" />
    
    {/* Speed indicator text */}
    <text 
      x="16" 
      y="26" 
      textAnchor="middle" 
      fontSize="5" 
      fontWeight="bold" 
      fill="currentColor"
    >
      1.5x
    </text>
  </svg>
);

// Modern Audio Button - Component chính để sử dụng các icon
export const ModernAudioButton = ({ 
  icon: Icon, 
  isActive, 
  onClick, 
  title, 
  activeColorClass = 'bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-600 border-emerald-300',
  className = ''
}) => (
  <button
    onClick={onClick}
    className={`
      relative group
      w-16 h-16 
      rounded-2xl 
      flex items-center justify-center 
      transition-all duration-300 ease-out
      hover:scale-105 
      active:scale-95 
      focus:outline-none focus:ring-0
      border-2 
      ${isActive 
        ? `${activeColorClass} shadow-2xl shadow-emerald-200/50 scale-105`
        : 'bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700 border-gray-200 hover:border-gray-300 shadow-lg hover:shadow-xl'
      }
      ${className}
    `}
    title={title}
    type="button"
  >
    {/* Icon - Larger size to match demo */}
    <Icon className="w-8 h-8 transition-transform duration-200" />
    
    {/* Active indicator */}
    {isActive && (
      <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg">
        <div className="w-2 h-2 bg-white rounded-full"></div>
      </div>
    )}
    
    {/* Enhanced tooltip with triangle */}
    <div className="absolute bottom-full mb-3 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-3 py-2 rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none whitespace-nowrap z-50 shadow-xl">
      {title}
      <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
    </div>
  </button>
);

// Alternative Style Icons (Optional - uncomment to use)
/*
// Modern Bar Style Icons
export const BarFadeInIcon = ({ className = "w-6 h-6" }) => (
  <svg 
    className={className} 
    viewBox="0 0 32 32" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect x="6" y="20" width="3" height="4" fill="currentColor" rx="1.5" opacity="0.4" />
    <rect x="11" y="16" width="3" height="8" fill="currentColor" rx="1.5" opacity="0.6" />
    <rect x="16" y="12" width="3" height="12" fill="currentColor" rx="1.5" opacity="0.8" />
    <rect x="21" y="8" width="3" height="16" fill="currentColor" rx="1.5" opacity="1" />
    <path d="M16 4 L20 8 L12 8 Z" fill="currentColor" />
  </svg>
);

export const BarFadeOutIcon = ({ className = "w-6 h-6" }) => (
  <svg 
    className={className} 
    viewBox="0 0 32 32" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect x="6" y="8" width="3" height="16" fill="currentColor" rx="1.5" opacity="1" />
    <rect x="11" y="12" width="3" height="12" fill="currentColor" rx="1.5" opacity="0.8" />
    <rect x="16" y="16" width="3" height="8" fill="currentColor" rx="1.5" opacity="0.6" />
    <rect x="21" y="20" width="3" height="4" fill="currentColor" rx="1.5" opacity="0.4" />
    <path d="M16 28 L20 24 L12 24 Z" fill="currentColor" />
  </svg>
);

export const BarSpeedIcon = ({ className = "w-6 h-6" }) => (
  <svg 
    className={className} 
    viewBox="0 0 32 32" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle 
      cx="16" 
      cy="20" 
      r="12" 
      stroke="currentColor" 
      strokeWidth="2.5" 
      fill="none"
      strokeDasharray="12.56 25.13"
      transform="rotate(-90 16 20)"
      strokeLinecap="round"
    />
    <circle cx="16" cy="20" r="2" fill="currentColor" />
    <path d="M16 20 L24 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    <text x="16" y="30" textAnchor="middle" fontSize="6" fontWeight="bold" fill="currentColor">SPEED</text>
  </svg>
);
*/