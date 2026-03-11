import { useEffect, useState } from "react";

export default function useVisibleTab() {
  const [visible, setVisible] = useState(
    typeof document !== "undefined" ? document.visibilityState === "visible" : true
  );
  
  useEffect(() => {
    const handleVisibility = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  return visible;
}