"use client";

import * as React from "react";
import { reportClientError, type ReportableError } from "./report-error";

/** Para los `error.tsx` de cada módulo: avisa del error al panel del staff (una vez por error). */
export function useReportError(error: ReportableError): void {
  React.useEffect(() => {
    void reportClientError(error);
  }, [error]);
}
