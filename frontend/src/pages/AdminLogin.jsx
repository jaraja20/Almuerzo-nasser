import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { ADMIN_USER, ADMIN_PASSWORD, LOGO_URL } from "@/lib/firebase";
import { Lock, ArrowLeft } from "lucide-react";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const submit = (e) => {
    e.preventDefault();
    if (username === ADMIN_USER && password === ADMIN_PASSWORD) {
      localStorage.setItem("nasser_admin", "1");
      toast.success("Sesión iniciada");
      navigate("/admin/menus");
    } else {
      toast.error("Usuario o contraseña incorrectos");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-neutral-50">
      <header className="flex items-center justify-between px-4 py-3 border-b bg-white">
        <img src={LOGO_URL} alt="Nasser Cubiertas" className="h-10" />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/")}
          data-testid="back-home-btn"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Volver
        </Button>
      </header>

      <main className="flex-1 flex items-center justify-center px-4">
        <Card className="w-full max-w-sm shadow-lg">
          <CardContent className="p-6 space-y-5">
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-red-600" />
              <h2 className="text-xl font-semibold">Acceso Administrador</h2>
            </div>
            <form onSubmit={submit} className="space-y-3">
              <div>
                <Label>Usuario</Label>
                <Input
                  data-testid="admin-user-input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <Label>Contraseña</Label>
                <Input
                  type="password"
                  data-testid="admin-pass-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button
                type="submit"
                data-testid="admin-login-submit"
                className="w-full bg-red-600 hover:bg-red-700"
              >
                Ingresar
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
