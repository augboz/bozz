import './index.css';
import Dashboard from './components/Dashboard';
import QuickCapture from './components/QuickCapture';

export default function App() {
  const isQuickCapture =
    new URLSearchParams(window.location.search).get('view') === 'quickcapture';
  return isQuickCapture ? <QuickCapture /> : <Dashboard />;
}
