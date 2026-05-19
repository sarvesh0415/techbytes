import { useEffect, useRef } from 'react';
import { bodyHTML } from './html-content';
import { initApp } from './app-logic';

export default function App() {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    // Use requestAnimationFrame to ensure DOM from dangerouslySetInnerHTML is painted
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        initApp();
      });
    });
  }, []);

  return <div dangerouslySetInnerHTML={{ __html: bodyHTML }} />;
}
