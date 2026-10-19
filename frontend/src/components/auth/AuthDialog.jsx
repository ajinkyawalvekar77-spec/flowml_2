import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

export default function AuthDialog({ children, label, onClose, open }) {
  const [isVisible, setIsVisible] = useState(open);
  const closeTimer = useRef(null);

  const requestClose = useCallback(() => {
    if (!isVisible) return;
    setIsVisible(false);
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(onClose, 320);
  }, [isVisible, onClose]);

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') requestClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, requestClose]);

  useEffect(() => {
    setIsVisible(open);
  }, [open]);

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  return createPortal(
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="auth-dialog-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: 'easeInOut' }}
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto p-4 bg-black/60 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) requestClose();
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={label}
            initial={{ opacity: 0, y: 24, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="relative my-auto w-full max-w-md"
          >
            <motion.button
              type="button"
              aria-label="Close dialog"
              onClick={requestClose}
              className="absolute right-3 top-3 z-10 rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
            >
              <X className="h-4 w-4" />
            </motion.button>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
