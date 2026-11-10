import { Outlet } from "react-router";

import { ShellLayout } from "@/shell/ShellLayout";

// Layout route for /, /language/:glottocode and /family/:glottocode (docs/specs/app-shell.md 2.1).
export default function Shell() {
  return (
    <ShellLayout>
      <Outlet />
    </ShellLayout>
  );
}
