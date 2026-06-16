import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import OAuthCallbackPage from "./pages/OAuthCallbackPage";
import PendingApprovalPage from "./pages/PendingApprovalPage";
import DashboardPage from "./pages/DashboardPage";
import LibrariesPage from "./pages/LibrariesPage";
import LibraryDetailPage from "./pages/LibraryDetailPage";
import TracksPage from "./pages/TracksPage";
import TrackDetailPage from "./pages/TrackDetailPage";
import CollectionsPage from "./pages/CollectionsPage";
import CollectionDetailPage from "./pages/CollectionDetailPage";
import SharingPage from "./pages/SharingPage";
import SharedViewPage from "./pages/SharedViewPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import BugReportsPage from "./pages/BugReportsPage";
import BugReportDetailPage from "./pages/BugReportDetailPage";
import AdminPage from "./pages/AdminPage";

function Loading() {
  return <div className="flex h-full items-center justify-center text-gray-400">Loading…</div>;
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return <Loading />;

  // Unauthenticated routes.
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Authenticated but not yet approved.
  if (user.approval_status !== "approved") {
    return (
      <Routes>
        <Route path="*" element={<PendingApprovalPage />} />
      </Routes>
    );
  }

  // Approved app.
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/libraries" element={<LibrariesPage />} />
        <Route path="/libraries/:id" element={<LibraryDetailPage />} />
        <Route path="/tracks" element={<TracksPage />} />
        <Route path="/tracks/:id" element={<TrackDetailPage />} />
        <Route path="/collections" element={<CollectionsPage />} />
        <Route path="/collections/:id" element={<CollectionDetailPage />} />
        <Route path="/sharing" element={<SharingPage />} />
        <Route path="/shared/:token" element={<SharedViewPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/bugs" element={<BugReportsPage />} />
        <Route path="/bugs/:id" element={<BugReportDetailPage />} />
        {user.role === "admin" && <Route path="/admin" element={<AdminPage />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
