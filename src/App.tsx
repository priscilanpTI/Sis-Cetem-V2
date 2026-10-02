import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { MasterProvider } from './context/MasterContext';
import { Dashboard } from './pages/Dashboard';
import { Bookings } from './pages/Bookings';
import { NewBooking } from './pages/NewBooking';
import RegistroExtraclasse from './pages/RegistroExtraclasse';
import RelatorioExtraclasse from './pages/RelatorioExtraclasse';
import MapaCompetencias from './pages/MapaCompetencias';
import RelatorioCompetencias from './pages/RelatorioCompetencias';

export default function App() {
  return (
    <BrowserRouter>
      <MasterProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/agendamentos" element={<Bookings />} />
            <Route path="/novo" element={<NewBooking />} />
            <Route path="/extraclasse" element={<RegistroExtraclasse />} />
            <Route path="/relatorio-extraclasse" element={<RelatorioExtraclasse />} />
            <Route path="/mapa-competencias" element={<MapaCompetencias />} />
            <Route path="/relatorio-competencias" element={<RelatorioCompetencias />} />
          </Route>
        </Routes>
      </MasterProvider>
    </BrowserRouter>
  );
}
