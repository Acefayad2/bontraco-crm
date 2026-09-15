import { lazy, Suspense } from "react";
import { Navigate, Outlet, RouterProvider, createBrowserRouter } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { guestRouteState } from "./lib/auth-route";
import { MarketingPage } from "./pages/MarketingPage";
import { WorkspaceProvider } from "./workspace/WorkspaceContext";

const AuthPage = lazy(() =>
  import("./pages/AuthPage").then((module) => ({ default: module.AuthPage })),
);
const DashboardPage = lazy(() =>
  import("./pages/DashboardPage").then((module) => ({ default: module.DashboardPage })),
);
const AcceptInvitePage = lazy(() =>
  import("./pages/AcceptInvitePage").then((module) => ({ default: module.AcceptInvitePage })),
);
const EstimateAcceptancePage = lazy(() =>
  import("./pages/EstimateAcceptancePage").then((module) => ({
    default: module.EstimateAcceptancePage,
  })),
);

function PageFallback() {
  return (
    <main className="state-page" aria-live="polite">
      <div className="brand-mark">B</div>
      <h1>Loading Bontraco</h1>
      <p>Preparing this part of your workspace.</p>
    </main>
  );
}

function LazyPage({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageFallback />}>{children}</Suspense>;
}

function ProtectedRoute() {
  const { demoMode, loading, user } = useAuth();

  if (loading) {
    return (
      <main className="state-page" aria-live="polite">
        <div className="brand-mark" aria-hidden="true">
          B
        </div>
        <h1>Preparing your workspace</h1>
        <p>Bontraco is restoring your secure session.</p>
      </main>
    );
  }

  if (!demoMode && !user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

function GuestOnlyRoute() {
  const { loading, user } = useAuth();
  const state = guestRouteState(loading, Boolean(user));

  if (state === "loading") return <PageFallback />;
  if (state === "authenticated") return <Navigate to="/app" replace />;
  return <Outlet />;
}

const router = createBrowserRouter([
  { path: "/", element: <MarketingPage /> },
  {
    element: <GuestOnlyRoute />,
    children: [
      {
        path: "/login",
        element: (
          <LazyPage>
            <AuthPage mode="login" />
          </LazyPage>
        ),
      },
      {
        path: "/signup",
        element: (
          <LazyPage>
            <AuthPage mode="signup" />
          </LazyPage>
        ),
      },
      {
        path: "/forgot-password",
        element: (
          <LazyPage>
            <AuthPage mode="forgot" />
          </LazyPage>
        ),
      },
    ],
  },
  {
    path: "/reset-password",
    element: (
      <LazyPage>
        <AuthPage mode="reset" />
      </LazyPage>
    ),
  },
  {
    path: "/accept-invite",
    element: (
      <LazyPage>
        <AcceptInvitePage />
      </LazyPage>
    ),
  },
  {
    path: "/estimate",
    element: (
      <LazyPage>
        <EstimateAcceptancePage />
      </LazyPage>
    ),
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: "/app",
        element: (
          <LazyPage>
            <DashboardPage />
          </LazyPage>
        ),
      },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);

export function App() {
  return (
    <AuthProvider>
      <WorkspaceProvider>
        <RouterProvider router={router} />
      </WorkspaceProvider>
    </AuthProvider>
  );
}
