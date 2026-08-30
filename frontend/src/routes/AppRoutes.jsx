import { Navigate, Route, Routes } from "react-router-dom";

import ProtectedRoute from "../ProtectedRoute";
import SocShellPage from "../pages/SocShellPage";
import ExecutiveOverview from "../pages/ExecutiveOverview";
import DataDetails from "../pages/DataDetails";
import PredictiveRisk from "../pages/PredictiveRisk";
import BehavioralAnalysis from "../pages/BehavioralAnalysis";
import NetworkRelations from "../pages/NetworkRelations";
import ActionableIntelligence from "../pages/ActionableIntelligence";
import SimulationLab from "../pages/SimulationLab";
import LoginPage from "../pages/LoginPage";
import RegisterPage from "../pages/RegisterPage";

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <SocShellPage />
          </ProtectedRoute>
        }
      >
        <Route index element={<ExecutiveOverview />} />
        <Route path="data-details" element={<DataDetails />} />
        <Route path="predictive-risk" element={<PredictiveRisk />} />
        <Route path="behavioral" element={<BehavioralAnalysis />} />
        <Route path="network" element={<NetworkRelations />} />
        <Route path="intelligence" element={<ActionableIntelligence />} />
        <Route path="simulation" element={<SimulationLab />} />
      </Route>

      <Route path="/dashboard" element={<Navigate to="/" replace />} />
      <Route path="/activity-logs" element={<Navigate to="/data-details" replace />} />
      <Route path="/risk-analytics" element={<Navigate to="/predictive-risk" replace />} />
      <Route path="/session-monitor" element={<Navigate to="/behavioral" replace />} />
      <Route path="/threat-intel" element={<Navigate to="/network" replace />} />
      <Route path="/system-health" element={<Navigate to="/intelligence" replace />} />
      <Route path="/simulation-lab" element={<Navigate to="/simulation" replace />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
