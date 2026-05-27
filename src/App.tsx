import './index.css';
import Dashboard from './components/Dashboard';
import QuickCapture from './components/QuickCapture';
import AuthGate from './components/AuthGate';

export default function App() {
  const isQuickCapture =
    new URLSearchParams(window.location.search).get('view') === 'quickcapture';
  // QuickCapture is the small popup window and skips auth — it just writes
  // to local storage and the main window picks the change up.
  if (isQuickCapture) return <QuickCapture />;
  return (
    <AuthGate>
      <Dashboard />
    </AuthGate>
  );
}
