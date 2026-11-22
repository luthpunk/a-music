import { XIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { MD, useMediaQuery } from "../hooks/useMediaQuery";
import { useT } from "../i18n";
import { isTvMode } from "../tv/tvMode";
import { IconButton } from "./IconButton";

/**
 * Layering (z-index) used across the app:
 * 10 sticky headers · 20 app chrome · 30 floating video · 40 sheet/drawer · 50 modal/menu · 60 toasts
 */
interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function Modal({ open, onClose, title, children }: Props) {
  const isMd = useMediaQuery(MD);
  const reduce = useReducedMotion();
  const t = useT();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const tv = isTvMode();
  const from = reduce || tv ? { opacity: 0, y: tv ? 8 : 0 } : isMd ? { opacity: 0, scale: 0.96, y: 8 } : { y: "100%" };
  const motionTransition = tv
    ? { duration: 0.16, ease: [0.2, 0, 0, 1] as const }
    : { type: "spring" as const, stiffness: 420, damping: 38 };

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
          <motion.div
            className="absolute inset-0 bg-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={tv ? { duration: 0.14 } : undefined}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            data-escape-closes
            initial={from}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={from}
            transition={motionTransition}
            className="island safe-bottom relative w-full rounded-b-none will-change-[opacity,transform] md:mx-4 md:max-w-md md:rounded-[20px]"
          >
            <div className="island-core p-4 md:p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
                <IconButton label={t.common.close} size="sm" onClick={onClose}>
                  <XIcon size={18} />
                </IconButton>
              </div>
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
