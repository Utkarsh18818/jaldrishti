import { SimulatorWorkspace } from "@/features/simulator/workspace";
import { Suspense } from "react";
export default function SimulatorPage() {
  return (
    <Suspense fallback={<p>Loading operational scenario…</p>}>
      <SimulatorWorkspace />
    </Suspense>
  );
}
