import { useAuth } from '@/features/auth/AuthContext';
import { MyAppointmentsPage } from './MyAppointmentsPage';
import { DoctorAppointmentsPage } from './DoctorAppointmentsPage';

// Role-router for /appointments, mirroring how /profile dispatches: a doctor
// sees their consult schedule, everyone else (patients) sees their own bookings.
export function AppointmentsPage() {
  const { user } = useAuth();
  return user?.role === 'DOCTOR' ? <DoctorAppointmentsPage /> : <MyAppointmentsPage />;
}
