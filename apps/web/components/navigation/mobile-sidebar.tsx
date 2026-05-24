"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

import { SidebarContent } from "@/components/navigation/sidebar";
import { Button } from "@/components/ui/button";

export function MobileSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            aria-label="Close navigation overlay"
            onClick={onClose}
            className="fixed inset-0 z-40 bg-slate-950/20 xl:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
          />
          <motion.aside
            className="fixed bottom-0 left-0 top-0 z-50 flex w-[min(90vw,22rem)] flex-col border-r border-slate-200 bg-white xl:hidden"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center justify-between border-b border-slate-200 p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-950">Cacsms Nexus</p>
                <p className="truncate text-xs text-slate-500">AI-Driven Autonomous Institutional Trading Ecosystem</p>
              </div>
              <Button type="button" variant="outline" size="icon" aria-label="Close sidebar" onClick={onClose} className="h-9 w-9">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <SidebarContent onNavigate={onClose} />
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
