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

  // Server and client times can differ by a second.
  return (
    <span className={className} suppressHydrationWarning>
      {time}
    </span>
  );
}
