import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import Home from "@/pages/Home";
import OrderForm from "@/pages/OrderForm";
import AdminLogin from "@/pages/AdminLogin";
import AdminLayout from "@/pages/AdminLayout";
import AdminMenus from "@/pages/AdminMenus";
import AdminOrders from "@/pages/AdminOrders";
import { FIREBASE_CONFIG_MISSING } from "@/lib/firebase";

function RequireAdmin({ children }) {
  const flag = localStorage.getItem("nasser_admin");
  if (!flag) return <Navigate to="/admin/login" replace />;
  return children;
}

function ConfigWarning() {
  if (!FIREBASE_CONFIG_MISSING) return null;
  return (
    <div className="bg-red-600 text-white p-3 text-sm text-center">
      <strong>Configuración de Firebase incompleta.</strong> Las variables{" "}
      <code className="bg-red-800 px-1 rounded">REACT_APP_FIREBASE_*</code> no
      están definidas. Configuralas en Vercel (Settings → Environment Variables)
      y volvé a hacer deploy.
    </div>
  );
}

export default function App() {
  return (
    <div className="App min-h-screen bg-neutral-50 text-neutral-900">
      <Toaster position="top-center" richColors />
      <ConfigWarning />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/order" element={<OrderForm />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route
            path="/admin"
            element={
              <RequireAdmin>
                <AdminLayout />
              </RequireAdmin>
            }
          >
            <Route index element={<Navigate to="menus" replace />} />
            <Route path="menus" element={<AdminMenus />} />
            <Route path="orders" element={<AdminOrders />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}
