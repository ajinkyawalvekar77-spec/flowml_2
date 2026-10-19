import React from 'react';

/**
 * Reusable FlowML live-text wordmark.
 * Pair with FlowMLIcon and wrap both in a Link to "/".
 */
export default function Logo({
  className = '',
  size = 'text-2xl',
  showBadge = false,
  badgeText = 'v2.4',
}) {
  return (
    <span className={`inline-flex items-center gap-2 select-none ${className}`}>
      <span className={`font-logo font-normal tracking-[-0.03em] ${size} leading-none text-[#1F1B2E]`}>
        Flow<span className="text-[#7C3AED]">ML</span>
      </span>
      {showBadge && (
        <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold bg-violet-50 text-violet-700 border border-violet-200">
          {badgeText}
        </span>
      )}
    </span>
  );
}
