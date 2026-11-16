"use client";

import { useState } from "react";

/** Needs you stays outside. On a phone the rest starts closed. On a wide screen it is open. */
export function MondayMore({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        className="flex min-h-11 w-full items-center text-left text-sm font-medium md:hidden"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        This week and the numbers
      </button>
      <div className={open ? "space-y-8 pt-4 md:pt-0" : "max-md:hidden space-y-8 md:pt-0"}>
        {children}
      </div>
    </div>
  );
}
