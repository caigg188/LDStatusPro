import React from 'react';

interface LogoProps {
  size?: number;
  className?: string;
  animated?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ size = 48, className = "", animated = true }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 512 512" 
    className={`select-none ${className}`}
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#7a9c8a" />
        <stop offset="50%" stopColor="#8faa9d" />
        <stop offset="100%" stopColor="#a8c0b0" />
      </linearGradient>
      <filter id="logo-glow">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>
    
    {/* 背景 - 液态玻璃效果 */}
    <rect x="20" y="20" width="472" height="472" rx="120" fill="rgba(255,255,255,0.9)" />
    <rect x="20" y="20" width="472" height="472" rx="120" fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="2" />
    
    {/* 灰色轨道 */}
    <circle cx="256" cy="256" r="160" fill="none" stroke="#e5e3e0" strokeWidth="32" />
    
    {/* 彩色轨道 - 带轻微呼吸动画 */}
    <path 
      d="M 256,96 A 160,160 0 1,1 142.8,369.1" 
      fill="none" 
      stroke="url(#logo-grad)" 
      strokeWidth="32" 
      strokeLinecap="round" 
      filter="url(#logo-glow)"
      transform="rotate(-15, 256, 256)"
    >
      {animated && (
        <animateTransform 
          attributeName="transform" 
          type="rotate" 
          values="-15 256 256; -10 256 256; -15 256 256" 
          dur="5s" 
          repeatCount="indefinite" 
        />
      )}
    </path>
    
    {/* 核心晶体 */}
    <rect 
      x="206" y="206" width="100" height="100" rx="20" 
      fill="url(#logo-grad)" 
      transform="rotate(45 256 256)"
    />
  </svg>
);

// 简化版 Logo，用于小尺寸场景
export const LogoMini: React.FC<{ size?: number; className?: string }> = ({ size = 32, className = "" }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 64 64" 
    className={`select-none ${className}`}
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient id="fav-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#7a9c8a" />
        <stop offset="100%" stopColor="#a8c0b0" />
      </linearGradient>
    </defs>
    <path d="M 31,4 A 28,28 0 1,1 11,52" fill="none" stroke="url(#fav-grad)" strokeWidth="8" strokeLinecap="round" />
    <rect x="25" y="26" width="12" height="12" rx="3" fill="url(#fav-grad)" transform="rotate(45 31 32)" />
  </svg>
);

export default Logo;
