import { ReactNode } from "react";

// Demo dashboard layout - bypasses authentication
export default function DemoDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <>{children}</>;
}




