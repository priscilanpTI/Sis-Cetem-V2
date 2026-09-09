import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Bookings } from './pages/Bookings';
import { NewBooking } from './pages/NewBooking';

export default function App() {
  return <BrowserRouter><Routes><Route element={<Layout />}><Route path="/" element={<Dashboard />} /><Route path="/agendamentos" element={<Bookings />} /><Route path="/novo" element={<NewBooking />} /></Route></Routes></BrowserRouter>;
}
