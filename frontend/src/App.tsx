import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
// Import pages
import Landing from "./pages/Landing";
import Login from "./pages/Auth/login";
import Register from "./pages/Auth/register";
import PatientDashboard from './pages/DashBoard/PatientDashboard';
import DoctorDashboard from './pages/DashBoard/DoctorDashboard';
import { GlobalChatBot } from './components/GlobalChatBot';
import RogNidhiHistory from './pages/DashBoard/RogNidhiHistory';
import PatientAccessControl from "./pages/DashBoard/PatientAccessControl";
import DoctorAccessControl from "./pages/DashBoard/DoctorAccessControl";
import DoctorPatientRecords from "./pages/DashBoard/DoctorPatientRecords";
import HealthTrends from "./pages/DashBoard/HealthTrends";
import LinkABHA from "./pages/DashBoard/LinkABHA";
import Insurance from "./pages/DashBoard/Insurance";

function App() {
  return (
    <BrowserRouter>
      <GlobalChatBot />
      <Routes>
        {/* Public Landing & Auth */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Dashboard Routes */}
        <Route path="/DashBoard/PatientDashboard" element={<PatientDashboard />} />
        <Route path="/DashBoard/HealthTrends" element={<HealthTrends />} />
        <Route path="/DashBoard/LinkABHA" element={<LinkABHA />} />
        <Route path="/DashBoard/Insurance" element={<Insurance />} />
        <Route path="/DashBoard/DoctorDashboard" element={<DoctorDashboard />} />
        <Route path="/doctor/patient-records/:patientId" element={<DoctorPatientRecords />} />
        <Route path="/DashBoard/RogNidhiHistory" element={<RogNidhiHistory />} />

        {/* Access Control Routes */}
        <Route path="/access-control" element={<PatientAccessControl />} />
        <Route path="/doctor-access-control" element={<DoctorAccessControl />} />

        {/* Wildcard Fallback: MUST BE LAST */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;