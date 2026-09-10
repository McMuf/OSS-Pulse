"use client";

import { PulseLoader } from "react-spinners";

export function LoadingState({ message }: { message: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-24">
      <PulseLoader color="#0f9d63" size={10} margin={4} />
      <p className="text-sm text-foreground-muted">{message}</p>
    </div>
  );
}
