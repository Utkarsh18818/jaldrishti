"use client";
import {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
  useCallback,
} from "react";
import type { ReactNode } from "react";
import { campusSeed } from "@/lib/campus-seed";
import { formatForecastTime } from "@/features/forecast/demo-forecast";
import {
  deriveOperations,
  seedOperations,
  updateOperations,
  provenanceLabels,
} from "./model";
import type { OperationalValues } from "./model";
import { apiClient, ApiError, backendLabel } from "@/lib/api-client";
import { campusToState } from "@/lib/backend-contract";
import type {
  Execution,
  ForecastEnvelope,
  CampusEnvelope,
} from "@/lib/backend-contract";
function useOperationalState() {
  const [state, setState] = useState(seedOperations);
  const [backendStatus, setBackendStatus] = useState<
    "local" | "loading" | "connected" | "fallback"
  >(apiClient.configured ? "loading" : "local");
  const [execution, setExecution] = useState<Execution>();
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(apiClient.configured);
  const [backendNotice, setBackendNotice] = useState(
    apiClient.configured
      ? "Loading saved operational inputs…"
      : "Local demo: inputs reset on reload.",
  );
  const [serverForecast, setServerForecast] = useState<ForecastEnvelope | null>(
    null,
  );
  const [forecastNotice, setForecastNotice] = useState("");
  const receiveCampus = useCallback((response: CampusEnvelope) => {
    setState(campusToState(response.campus));
    setVersion(response.campus.version);
    setExecution(response.execution);
    setBackendStatus("connected");
    setBackendNotice(
      "Saved operational inputs loaded. Edits persist only after backend confirmation.",
    );
  }, []);
  const receiveFailure = useCallback((cause: unknown) => {
    if (cause instanceof ApiError && cause.code === "NOT_FOUND") {
      setVersion(0);
      setBackendStatus("connected");
      setBackendNotice(
        "Backend reachable; no campus saved yet. Apply inputs to initialize the demo record.",
      );
    } else {
      setBackendStatus("fallback");
      setBackendNotice(
        "Backend unavailable. Current local/demo inputs are usable; local changes are not saved to AWS.",
      );
    }
  }, []);
  const readBackend = useCallback(async () => {
    try {
      receiveCampus(await apiClient.loadCampus());
    } catch (cause) {
      receiveFailure(cause);
    } finally {
      setBusy(false);
    }
  }, [receiveCampus, receiveFailure]);
  useEffect(() => {
    if (!apiClient.configured) return;
    let active = true;
    apiClient
      .loadCampus()
      .then((response) => {
        if (active) receiveCampus(response);
      })
      .catch((cause) => {
        if (active) receiveFailure(cause);
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [receiveCampus, receiveFailure]);
  const derived = useMemo(() => deriveOperations(state), [state]);
  useEffect(() => {
    if (backendStatus !== "connected" || version === 0) return;
    let active = true;
    apiClient
      .forecast(version, 30)
      .then((result) => {
        if (
          result.campusVersion !== version ||
          Object.entries(derived.input).some(
            ([key, value]) =>
              result.input[key as keyof typeof result.input] !== value,
          )
        )
          throw new Error("Forecast baseline mismatch");
        if (active) {
          setServerForecast(result);
          setForecastNotice("");
        }
      })
      .catch(() => {
        if (active)
          setForecastNotice(
            "Server forecast unavailable; the tested local engine is providing the current result.",
          );
      });
    return () => {
      active = false;
    };
  }, [backendStatus, version, derived.input]);
  const remote =
    backendStatus === "connected" &&
    serverForecast?.campusVersion === version &&
    Object.entries(derived.input).every(
      ([key, value]) =>
        serverForecast.input[key as keyof typeof serverForecast.input] ===
        value,
    )
      ? serverForecast
      : null;
  const comparison = remote?.comparison ?? derived.comparison;
  async function commit(
    values: OperationalValues,
    resetToDemo = false,
  ): Promise<string> {
    if (busy)
      throw new Error("Wait for the current backend request to finish.");
    const next = resetToDemo
      ? seedOperations()
      : updateOperations(state, values, Date.now());
    if (backendStatus !== "connected") {
      setState(next);
      return apiClient.configured
        ? "Applied locally only. AWS persistence is unavailable."
        : "Inputs applied locally. All operational workspaces share this baseline.";
    }
    setBusy(true);
    try {
      const response = await apiClient.saveCampus(
        next.values,
        version,
        resetToDemo,
      );
      setState(campusToState(response.campus));
      setVersion(response.campus.version);
      setExecution(response.execution);
      setBackendNotice(
        "Save confirmed by backend. These inputs will load again after reload.",
      );
      return response.execution === "local-mock"
        ? "Saved to LOCAL BACKEND TEST (in-memory server, not AWS)."
        : "Saved to AWS. Reload will restore these inputs.";
    } catch (cause) {
      if (
        cause instanceof ApiError &&
        ["CONFLICT", "INVALID_INPUT"].includes(cause.code)
      ) {
        setBackendNotice(cause.message);
        throw cause;
      }
      setState(next);
      setBackendStatus("fallback");
      setBackendNotice(
        "Save was not confirmed. Using local inputs only; a timed-out write may have reached AWS. Reload backend state before retrying.",
      );
      return "Applied locally only; backend save was not confirmed.";
    } finally {
      setBusy(false);
    }
  }
  const modeLabel = Object.values(state.origins).some(
    (origin) => origin.kind === "user",
  )
    ? "LOCAL / DEMO MODE"
    : "SEEDED DEMO";
  return {
    state,
    ...derived,
    comparison,
    remoteForecast: remote,
    backendStatus,
    backendMode: backendLabel(backendStatus, execution),
    backendNotice,
    forecastNotice,
    forecastBoundary: remote
      ? remote.execution === "aws-lambda"
        ? "AWS LAMBDA"
        : "LOCAL BACKEND TEST"
      : "LOCAL ENGINE",
    busy,
    async reloadBackend() {
      setBusy(true);
      setBackendStatus("loading");
      await readBackend();
    },
    modeLabel,
    apply: commit,
    reset: () => commit(seedOperations().values, true),
    provenance(key: keyof OperationalValues) {
      return provenanceLabels[state.origins[key].kind];
    },
    view: {
      ...campusSeed,
      ...state.values,
      netDeficit: derived.netDeficit,
      criticalDays: comparison.baseline.criticalCrossing?.day.toFixed(1) ?? "—",
      criticalTime: formatForecastTime(
        comparison.baseline.criticalCrossing?.timeMs,
      ),
      anomalyPercent:
        derived.anomaly.variancePercent?.toFixed(1).replace(/\.0$/, "") ?? "—",
      resilienceHours: comparison.resilienceHours?.toFixed(1) ?? "—",
      waterPreserved:
        comparison.waterPreservedLitres == null
          ? null
          : Math.round(comparison.waterPreservedLitres),
    },
  };
}
type Operations = ReturnType<typeof useOperationalState>;
const Context = createContext<Operations | null>(null);
export function OperationalProvider({ children }: { children: ReactNode }) {
  const value = useOperationalState();
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useOperations() {
  const value = useContext(Context);
  if (!value) throw new Error("Operational provider is required");
  return value;
}
