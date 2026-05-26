'use client';

import React from 'react';

export function EmptyHabitsIllustration() {
  return (
    <div className="relative w-48 h-48 mx-auto flex items-center justify-center">
      {/* Background glow node */}
      <div className="absolute inset-4 bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 rounded-full blur-2xl animate-pulse duration-4000" />
      
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10"
      >
        <defs>
          <linearGradient id="gridGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#14b8a6" stopOpacity="0.05" />
          </linearGradient>
          <linearGradient id="checkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#059669" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#0d9488" stopOpacity="0.5" />
          </linearGradient>
          <linearGradient id="glowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.02" />
          </linearGradient>
          <filter id="glassBlur" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="6" />
            <feComposite in="SourceGraphic" in2="blurOut" operator="over" />
          </filter>
        </defs>

        <style>{`
          @keyframes floatHabit1 {
            0% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-6px) rotate(2deg); }
            100% { transform: translateY(0px) rotate(0deg); }
          }
          @keyframes floatHabit2 {
            0% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(8px) rotate(-3deg); }
            100% { transform: translateY(0px) rotate(0deg); }
          }
          @keyframes lineDraw {
            0% { stroke-dashoffset: 240; }
            100% { stroke-dashoffset: 0; }
          }
          .habit-card-1 { animation: floatHabit1 6s ease-in-out infinite; }
          .habit-card-2 { animation: floatHabit2 8s ease-in-out infinite; }
          .habit-grid-bg { opacity: 0.15; stroke: currentColor; }
          .streak-line {
            stroke: #10b981;
            stroke-width: 3;
            stroke-linecap: round;
            stroke-dasharray: 240;
            stroke-dashoffset: 0;
            animation: lineDraw 3s ease-out forwards;
          }
        `}</style>

        {/* Outer orbital rings */}
        <circle cx="100" cy="100" r="85" stroke="#10b981" strokeWidth="1" strokeOpacity="0.15" strokeDasharray="4 6" />
        <circle cx="100" cy="100" r="65" stroke="#14b8a6" strokeWidth="1" strokeOpacity="0.1" />

        {/* Grid dots backdrop */}
        <g className="text-muted-foreground habit-grid-bg">
          <circle cx="60" cy="60" r="1.5" />
          <circle cx="80" cy="60" r="1.5" />
          <circle cx="100" cy="60" r="1.5" />
          <circle cx="120" cy="60" r="1.5" />
          <circle cx="140" cy="60" r="1.5" />
          <circle cx="60" cy="80" r="1.5" />
          <circle cx="140" cy="80" r="1.5" />
          <circle cx="60" cy="100" r="1.5" />
          <circle cx="140" cy="100" r="1.5" />
          <circle cx="60" cy="120" r="1.5" />
          <circle cx="140" cy="120" r="1.5" />
          <circle cx="60" cy="140" r="1.5" />
          <circle cx="80" cy="140" r="1.5" />
          <circle cx="100" cy="140" r="1.5" />
          <circle cx="120" cy="140" r="1.5" />
          <circle cx="140" cy="140" r="1.5" />
        </g>

        {/* Streak connection line running through checkboxes */}
        <path d="M 50 110 Q 75 80, 100 115 T 150 90" fill="none" className="streak-line" />

        {/* Habit glass card 1 */}
        <g className="habit-card-1">
          {/* Glass background */}
          <rect x="40" y="80" width="50" height="50" rx="12" fill="url(#glowGrad)" stroke="#ffffff" strokeOpacity="0.2" strokeWidth="1.5" />
          {/* Highlight completed block */}
          <rect x="50" y="90" width="30" height="30" rx="8" fill="url(#checkGrad)" />
          {/* Check icon */}
          <path d="M 58 105 L 63 110 L 72 99" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </g>

        {/* Habit glass card 2 */}
        <g className="habit-card-2">
          {/* Glass background */}
          <rect x="110" y="70" width="50" height="50" rx="12" fill="url(#glowGrad)" stroke="#ffffff" strokeOpacity="0.2" strokeWidth="1.5" />
          {/* Highlight incomplete/pulsing block */}
          <rect x="120" y="80" width="30" height="30" rx="8" fill="#14b8a6" fillOpacity="0.15" stroke="#14b8a6" strokeWidth="1.5" />
          {/* Custom micro spark */}
          <circle cx="145" cy="75" r="3" fill="#34d399" />
          <circle cx="115" cy="115" r="2" fill="#2dd4bf" />
        </g>

        {/* Sparkle details */}
        <path d="M 100 35 L 102 42 L 109 44 L 102 46 L 100 53 L 98 46 L 91 44 L 98 42 Z" fill="#34d399" opacity="0.8" />
        <path d="M 155 135 L 156.5 139 L 160.5 140 L 156.5 141 L 155 145 L 153.5 141 L 149.5 140 L 153.5 139 Z" fill="#0d9488" opacity="0.6" />
      </svg>
    </div>
  );
}

export function EmptyTasksIllustration() {
  return (
    <div className="relative w-48 h-48 mx-auto flex items-center justify-center">
      {/* Background glow node */}
      <div className="absolute inset-4 bg-gradient-to-tr from-amber-500/10 to-orange-500/20 rounded-full blur-2xl animate-pulse duration-4000" />
      
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10"
      >
        <defs>
          <linearGradient id="taskGlowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="taskAccent" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#ea580c" stopOpacity="0.6" />
          </linearGradient>
        </defs>

        <style>{`
          @keyframes floatTask {
            0% { transform: translateY(0px); }
            50% { transform: translateY(-8px); }
            100% { transform: translateY(0px); }
          }
          @keyframes rotateGear {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          .task-container { animation: floatTask 5s ease-in-out infinite; }
          .gear-bg {
            transform-origin: 140px 60px;
            animation: rotateGear 20s linear infinite;
          }
          .task-line {
            stroke: #d1d5db;
            stroke-linecap: round;
            stroke-width: 2.5;
          }
          .dark .task-line {
            stroke: #4b5563;
          }
        `}</style>

        {/* Orbitals */}
        <circle cx="100" cy="100" r="80" stroke="#f59e0b" strokeWidth="1" strokeOpacity="0.12" strokeDasharray="5 5" />
        
        {/* Rotating clock/gear motif in the top-right corner */}
        <g className="gear-bg text-orange-500" opacity="0.15">
          <circle cx="140" cy="60" r="18" stroke="currentColor" strokeWidth="2.5" strokeDasharray="6 3" />
          <circle cx="140" cy="60" r="8" stroke="currentColor" strokeWidth="2" />
        </g>

        {/* Calendar curve background grid lines */}
        <path d="M 30 140 C 60 170, 140 170, 170 140" stroke="#ea580c" strokeWidth="1.5" strokeOpacity="0.2" strokeDasharray="3 3" />

        {/* Task Board container */}
        <g className="task-container">
          {/* Main Board Base (Glassmorphic) */}
          <rect x="45" y="55" width="105" height="100" rx="16" fill="url(#taskGlowGrad)" stroke="#ffffff" strokeOpacity="0.25" strokeWidth="1.5" />
          <rect x="45" y="55" width="105" height="24" rx="16" fill="#f59e0b" fillOpacity="0.12" />
          <circle cx="60" cy="67" r="3.5" fill="#f59e0b" />
          <circle cx="73" cy="67" r="3.5" fill="#ea580c" />

          {/* Task Row 1 (Checked Item) */}
          <g transform="translate(58, 90)">
            <rect x="0" y="0" width="16" height="16" rx="5" fill="url(#taskAccent)" />
            <path d="M 4 8 L 7 11 L 12 5" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            {/* Stricken text line */}
            <line x1="26" y1="8" x2="72" y2="8" className="task-line" opacity="0.6" />
          </g>

          {/* Task Row 2 (Unchecked, floating next action) */}
          <g transform="translate(58, 118)">
            <rect x="0" y="0" width="16" height="16" rx="5" fill="none" stroke="#f59e0b" strokeWidth="2" />
            {/* Glowing check outline */}
            <line x1="26" y1="8" x2="78" y2="8" className="task-line" />
          </g>
        </g>

        {/* Floating elements */}
        <circle cx="35" cy="85" r="4.5" fill="#ea580c" opacity="0.6" />
        <path d="M 160 110 L 164 114 L 160 118 L 156 114 Z" fill="#f59e0b" opacity="0.7" />
      </svg>
    </div>
  );
}

export function EmptyGoalsIllustration() {
  return (
    <div className="relative w-48 h-48 mx-auto flex items-center justify-center">
      {/* Background glow node */}
      <div className="absolute inset-4 bg-gradient-to-tr from-sky-500/10 to-indigo-500/20 rounded-full blur-2xl animate-pulse duration-4000" />
      
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10"
      >
        <defs>
          <linearGradient id="goalGlowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="mountainGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.05" />
          </linearGradient>
          <linearGradient id="flagGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#4f46e5" />
          </linearGradient>
        </defs>

        <style>{`
          @keyframes floatGoalItems {
            0% { transform: translateY(0px); }
            50% { transform: translateY(-7px); }
            100% { transform: translateY(0px); }
          }
          @keyframes starPulse {
            0%, 100% { opacity: 0.3; transform: scale(0.9); }
            50% { opacity: 1; transform: scale(1.15); }
          }
          .goal-mountain-group { animation: floatGoalItems 6s ease-in-out infinite; }
          .star-active-1 {
            transform-origin: 100px 45px;
            animation: starPulse 3s ease-in-out infinite;
          }
          .star-active-2 {
            transform-origin: 55px 95px;
            animation: starPulse 4s ease-in-out infinite;
          }
          .star-active-3 {
            transform-origin: 145px 115px;
            animation: starPulse 5s ease-in-out infinite;
          }
        `}</style>

        {/* Orbitals */}
        <circle cx="100" cy="100" r="80" stroke="#3b82f6" strokeWidth="1" strokeOpacity="0.1" />

        {/* Dotted path leading up the mountain */}
        <path d="M 50 150 C 65 120, 85 90, 100 65" stroke="#3b82f6" strokeWidth="2" strokeOpacity="0.4" strokeDasharray="4 4" />

        {/* Mountains & Goal Flag */}
        <g className="goal-mountain-group">
          {/* Glassmorphic Mountain backdrop 1 */}
          <path d="M 25 150 L 75 75 L 125 150 Z" fill="url(#mountainGrad)" stroke="#3b82f6" strokeOpacity="0.25" strokeWidth="1.5" />
          
          {/* Glassmorphic Mountain foreground 2 (higher peak) */}
          <path d="M 60 150 L 110 55 L 165 150 Z" fill="url(#mountainGrad)" stroke="#6366f1" strokeOpacity="0.3" strokeWidth="1.5" />

          {/* Goal Flag on top of the peak (110, 55) */}
          <line x1="110" y1="55" x2="110" y2="35" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />
          <path d="M 110 35 L 132 43 L 110 50 Z" fill="url(#flagGrad)" />
        </g>

        {/* Shiny target milestone stars */}
        <g className="star-active-1 text-sky-400">
          <path d="M 100 38 L 102 43 L 107 43 L 103 46 L 105 51 L 100 48 L 95 51 L 97 46 L 93 43 L 98 43 Z" fill="currentColor" />
        </g>
        <g className="star-active-2 text-indigo-400">
          <path d="M 55 88 L 57 93 L 62 93 L 58 96 L 60 101 L 55 98 L 50 101 L 52 96 L 48 93 L 53 93 Z" fill="currentColor" opacity="0.75" />
        </g>
        <g className="star-active-3 text-sky-400">
          <path d="M 145 108 L 147 113 L 152 113 L 148 116 L 150 121 L 145 118 L 140 121 L 142 116 L 138 113 L 143 113 Z" fill="currentColor" opacity="0.6" />
        </g>
      </svg>
    </div>
  );
}
