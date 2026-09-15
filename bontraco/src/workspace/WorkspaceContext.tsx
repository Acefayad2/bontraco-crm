import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { useAuth } from "../auth/AuthContext";
import { withAuthRequestDeadline } from "../lib/auth-request-deadline";
import { getSupabase } from "../lib/supabase";
import { useWorkspaceAutoRefresh } from "../lib/workspace-auto-refresh";
import { chooseWorkspace } from "../lib/workspace-selection";

export type WorkspaceRole = "owner" | "admin" | "sales" | "dispatcher" | "field";

export type Workspace = {
  id: string;
  name: string;
  slug: string;
  trades: string[];
  role: WorkspaceRole;
  entitlements: string[];
};

export type WorkspaceOption = Omit<Workspace, "entitlements">;

type WorkspaceState = {
  workspace: Workspace | null;
  workspaceOptions: WorkspaceOption[];
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  selectWorkspace: (accountId: string) => void;
};

const WorkspaceContext = createContext<WorkspaceState | null>(null);

export function WorkspaceProvider({ children }: PropsWithChildren) {
  const { demoMode, user } = useAuth();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [workspaceOptions, setWorkspaceOptions] = useState<WorkspaceOption[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const latestRequestId = useRef(0);

  const refresh = useCallback(
    async (options: { silent?: boolean } = {}) => {
      const requestId = ++latestRequestId.current;
      if (demoMode && import.meta.env.VITE_DEMO_MODE === "true") {
        const { demoWorkspace, demoWorkspaceOption } = await import("../demo/workspace");
        if (requestId !== latestRequestId.current) return;
        setWorkspace(demoWorkspace);
        setWorkspaceOptions([demoWorkspaceOption]);
        setError("");
        setLoading(false);
        return;
      }
      if (!user) {
        if (requestId !== latestRequestId.current) return;
        setWorkspace(null);
        setWorkspaceOptions([]);
        setSelectedWorkspaceId("");
        setError("");
        setLoading(false);
        return;
      }
      if (!options.silent) setLoading(true);
      try {
        const result = await withAuthRequestDeadline(
          (async () => {
            const supabase = await getSupabase();
            if (!supabase) throw new Error("Workspace client unavailable");
            const { data, error: queryError } = await supabase
              .from("memberships")
              .select("role, accounts!inner(id, name, slug, trades)")
              .eq("user_id", user.id)
              .eq("active", true);
            if (queryError) throw queryError;
            if (!data?.length) return { kind: "empty" as const };

            const workspaceOptions = data
              .map((membership) => {
                const account = membership.accounts as unknown as Omit<WorkspaceOption, "role">;
                return { ...account, role: membership.role as WorkspaceRole };
              })
              .sort((left, right) => left.name.localeCompare(right.name));
            const account = chooseWorkspace(workspaceOptions, selectedWorkspaceId);
            if (!account) return { kind: "empty" as const };
            const checks = await Promise.all(
              ["core_crm", "lead_engine", "ai_receptionist", "advanced_reporting"].map(
                async (entitlement) => {
                  const entitlementResult = await supabase.rpc("has_account_entitlement", {
                    target_account_id: account.id,
                    entitlement,
                  });
                  if (entitlementResult.error) throw entitlementResult.error;
                  return entitlementResult.data ? entitlement : null;
                },
              ),
            );
            return {
              kind: "ready" as const,
              workspaceOptions,
              workspace: {
                ...account,
                entitlements: checks.filter((item): item is string => Boolean(item)),
              },
            };
          })(),
        );
        if (requestId !== latestRequestId.current) return;

        if (result.kind === "empty") {
          setWorkspace(null);
          setWorkspaceOptions([]);
          setError("");
        } else {
          setWorkspaceOptions(result.workspaceOptions);
          if (selectedWorkspaceId !== result.workspace.id)
            setSelectedWorkspaceId(result.workspace.id);
          setWorkspace(result.workspace);
          setError("");
        }
      } catch {
        if (requestId === latestRequestId.current && !options.silent) {
          setWorkspace(null);
          setWorkspaceOptions([]);
          setError("We could not load your company workspace. Try again in a moment.");
        }
      } finally {
        if (requestId === latestRequestId.current && !options.silent) setLoading(false);
      }
    },
    [demoMode, selectedWorkspaceId, user],
  );

  useEffect(() => {
    void Promise.resolve().then(() => refresh());
  }, [refresh]);

  const refreshSilently = useCallback(() => refresh({ silent: true }), [refresh]);
  useWorkspaceAutoRefresh(!demoMode && Boolean(user && workspace), refreshSilently, user?.id);

  const selectWorkspace = useCallback(
    (accountId: string) => {
      if (
        accountId === selectedWorkspaceId ||
        !workspaceOptions.some((option) => option.id === accountId)
      )
        return;
      latestRequestId.current += 1;
      setLoading(true);
      setSelectedWorkspaceId(accountId);
    },
    [selectedWorkspaceId, workspaceOptions],
  );

  const value = useMemo(
    () => ({ workspace, workspaceOptions, loading, error, refresh, selectWorkspace }),
    [workspace, workspaceOptions, loading, error, refresh, selectWorkspace],
  );
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return value;
}
