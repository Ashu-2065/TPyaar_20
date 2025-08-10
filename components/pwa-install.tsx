'use client';

import { useEffect, useState } from 'react';

type Props = { children: React.ReactNode };

// Wrap a button to trigger PWA install when available
export default function PWAInstall({ children }: Props) {
  const [deferred, setDeferred] = useState<any>(null);

  useEffect(() => {
    const onBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferred(e);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  }, []);

  const onClick = async () => {
    if (!deferred) {
      alert('Install not available in this preview. Try on a supported browser or add to home screen.');
      return;
    }
    deferred.prompt();
    const choice = await deferred.userChoice.catch(() => null);
    setDeferred(null);
    if (choice?.outcome !== 'accepted') {
      // optional: show message
    }
  };

  return (
    <span onClick={onClick} role="button" aria-label="Install app">
      {children}
    </span>
  );
}
