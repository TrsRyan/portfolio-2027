"use client";

import { useEffect, useState } from "react";

const DEFAULT_TIMEZONE = "Europe/Brussels";

function formatTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

export default function LiveClock({
  className,
  timeZone = DEFAULT_TIMEZONE,
}: {
  className?: string;
  timeZone?: string;
}) {
  const [time, setTime] = useState(() => formatTime(new Date(), timeZone));

  useEffect(() => {
    const id = setInterval(() => setTime(formatTime(new Date(), timeZone)), 1000);
    return () => clearInterval(id);
  }, [timeZone]);

  // suppressHydrationWarning: the server's time (at render) and the
  // client's (at hydration) can differ by a second — an expected case,
  // documented by React for this kind of content (a clock), not a real error.
  return (
    <span className={className} suppressHydrationWarning>
      {time}
    </span>
  );
}
