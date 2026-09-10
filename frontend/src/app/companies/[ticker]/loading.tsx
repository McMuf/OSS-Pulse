import { LoadingState } from "@/components/LoadingState";

export default function Loading() {
  return (
    <LoadingState message="Waking up the backend. This can take up to a minute on the first visit." />
  );
}
