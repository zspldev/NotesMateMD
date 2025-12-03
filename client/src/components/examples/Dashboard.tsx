import Dashboard from '../Dashboard';
import { ThemeProvider } from '../ThemeProvider';

export default function DashboardExample() {
  const mockUser = {
    firstName: "Dr. John",
    lastName: "Smith",
    title: "Primary Care Physician", 
    orgName: "Metropolitan Medical Center"
  };

  return (
    <ThemeProvider defaultTheme="light">
      <Dashboard
        currentUser={mockUser}
        onLogout={() => console.log('User logged out')}
      />
    </ThemeProvider>
  );
}