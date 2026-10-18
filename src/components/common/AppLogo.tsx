import React, { useState } from 'react';
import { Scale } from 'lucide-react';
import appLogo from '@/assets/app-icon.png';

export const AppLogo: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <Scale aria-label="Meezan" role="img" className={`p-1 text-emerald-400 ${className}`} />
  ) : (
    <img src={appLogo} alt="Meezan" className={`object-cover ${className}`} onError={() => setFailed(true)} />
  );
};
