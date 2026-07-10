import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { LOGO_URL } from "@/lib/firebase";
import { UserRound, Utensils, Shield } from "lucide-react";

export default function Home() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState(
    localStorage.getItem("nasser_user_name") || ""
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    const parts = fullName.trim().split(/\s+/);
    if (parts.length < 2) {
      toast.error("Ingresá tu nombre y apellido");
      return;
    }
    localStorage.setItem("nasser_user_name", fullName.trim());
    navigate("/order");
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b bg-white">
        <img src={LOGO_URL} alt="Nasser Cubiertas" className="h-10" />
        <Button
          variant="outline"
          size="sm"
          data-testid="admin-btn"
          onClick={() => navigate("/admin/login")}
        >
          <Shield className="w-4 h-4 mr-1" /> Admin
        </Button>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <Card className="w-full max-w-md shadow-lg">
          <CardContent className="p-6 sm:p-8 space-y-6">
            <div className="text-center space-y-1">
              <h1 className="text-2xl sm:text-3xl font-bold">
                Pedido de Almuerzos
              </h1>
              <p className="text-sm text-neutral-600">
                Sistema interno de selección semanal
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name" className="text-sm font-medium">
                  Por favor ingresá tu nombre primero:
                </Label>
                <div className="relative mt-2">
                  <UserRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <Input
                    id="name"
                    data-testid="name-input"
                    placeholder="Nombre y Apellido"
                    className="pl-9"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
              </div>

              <Button
                type="submit"
                data-testid="request-lunch-btn"
                className="w-full bg-red-600 hover:bg-red-700"
              >
                <Utensils className="w-4 h-4 mr-2" />
                Solicitar Almuerzo
              </Button>
            </form>

            <p className="text-xs text-center text-neutral-500">
              Necesitamos tu nombre y apellido para asignar tu pedido.
            </p>
          </CardContent>
        </Card>
      </main>

      <footer className="text-center text-xs text-neutral-500 py-4">
        Nasser Cubiertas · Pedidos semanales
      </footer>
    </div>
  );
}
