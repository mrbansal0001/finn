"use client";

import { useEffect } from "react";

/** Sets the browser tab title from private, per-visitor data (a person's name), which the server's shared metadata
 *  must not carry. */
export function DocTitle({ title }: { title: string }) {
  useEffect(() => {
    const before = document.title;
    document.title = title;
    return () => {
      document.title = before;
    };
  }, [title]);
  return null;
}
