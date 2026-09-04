import { useEffect, useState } from 'react';
/**
 * Returns false for the first `delay` ms of a load so fast responses never
 * flash a skeleton, then true until `isLoading` drops.
 *   const showSkeleton = useDelayedLoading(loading);
 */
export default function useDelayedLoading(isLoading, delay = 150) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!isLoading) { setShow(false); return undefined; }
    const t = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(t);
  }, [isLoading, delay]);
  return isLoading && show;
}
