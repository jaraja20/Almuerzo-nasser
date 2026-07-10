import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LOGO_URL } from "@/lib/firebase";
import { ClipboardList, ListChecks, LogOut } from "lucide-react";

export default function AdminLayout() {
  const navigate = useNavigate();
  const logout = () => {
    localStorage.removeItem("nasser_admin");
    navigate("/");
  };

  const linkCls = ({ isActive }) =>
    `flex items-center gap-2 px-3 py-2 rounded-md text-sm ${
      isActive
        ? "bg-red-600 text-white"
        : "text-neutral-700 hover:bg-neutral-100"
    }`;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b bg-white">
        <div className="flex items-center gap-3">
          <img src={LOGO_URL} alt="Nasser" className="h-9" />
          <span className="text-sm font-medium text-neutral-600 hidden sm:inline">
            Panel Administrador
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={logout}
          data-testid="admin-logout-btn"
        >
          <LogOut className="w-4 h-4 mr-1" /> Salir
        </Button>
      </header>
      <div className="flex-1 flex flex-col sm:flex-row">
        <aside className="w-full sm:w-56 border-r bg-white p-3 space-y-1">
          <NavLink to="menus" className={linkCls} data-testid="nav-menus">
            <ClipboardList className="w-4 h-4" /> Generar Menú
          </NavLink>
          <NavLink to="orders" className={linkCls} data-testid="nav-orders">
            <ListChecks className="w-4 h-4" /> Ver Pedidos
          </NavLink>
        </aside>
        <main className="flex-1 p-4 sm:p-6 bg-neutral-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
