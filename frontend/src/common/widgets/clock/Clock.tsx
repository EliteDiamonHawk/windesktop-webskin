import { useEffect, useState } from 'react';

export function Clock() {
  const [time, setTime] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return <time dateTime={time.toISOString()}>{time.toLocaleTimeString()}</time>;
}

