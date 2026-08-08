import { useEffect, useState } from "react";
import {
  getActiveMenus,
  listSelections,
  resetSelections,
  exportSelectionsToExcel,
  DAYS,
  DAY_LABEL,
} from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Download, RefreshCw, Trash2 } from "lucide-react";

const SHORT = {
  lunes: "Lun",
  martes: "Mar",
  miercoles: "Mié",
  jueves: "Jue",
  viernes: "Vie",
  sabado: "Sáb",
};

function ProviderOrders({ provider }) {
  const [selections, setSelections] = useState([]);
  const [menu, setMenu] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const active = await getActiveMenus();
      const m = active[provider];
      setMenu(m);
      if (m) {
        const sels = await listSelections({ provider, menuId: m.id });
        setSelections(sels);
      } else {
        setSelections([]);
      }
    } catch (e) {
      toast.error("Error al cargar: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [provider]);

  const download = () => {
    if (!menu || selections.length === 0) return;
    try {
      exportSelectionsToExcel({ provider, menu, selections });
      toast.success("Excel descargado");
    } catch (e) {
      toast.error("Error al generar Excel: " + e.message);
    }
  };

  const doReset = async () => {
    if (!window.confirm(`¿Borrar todos los pedidos de ${provider}?`)) return;
    try {
      const n = await resetSelections(provider);
      toast.success(`${n} pedidos eliminados`);
      load();
    } catch (e) {
      toast.error("Error al resetear: " + e.message);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="text-sm text-neutral-600">
          {menu ? (
            <>
              Semana:{" "}
              <strong>
                {menu.week_start || "—"} → {menu.week_end || "—"}
              </strong>{" "}
              · {selections.length} pedidos
            </>
          ) : (
            <>No hay menú activo</>
          )}
        </div>
        <div className="flex-1" />
        <Button
          variant="outline"
          size="sm"
          onClick={load}
          data-testid={`${provider}-refresh-btn`}
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1" /> Recargar
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={doReset}
          data-testid={`${provider}-reset-btn`}
          className="text-red-600 border-red-300 hover:bg-red-50"
        >
          <Trash2 className="w-3.5 h-3.5 mr-1" /> Reset
        </Button>
        <Button
          size="sm"
          disabled={!menu || selections.length === 0}
          onClick={download}
          data-testid={`${provider}-download-btn`}
          className="bg-red-600 hover:bg-red-700"
        >
          <Download className="w-3.5 h-3.5 mr-1" /> Descargar Excel
        </Button>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="p-6 text-center text-sm text-neutral-500">
              Cargando…
            </div>
          ) : selections.length === 0 ? (
            <div className="p-6 text-center text-sm text-neutral-500">
              Aún no hay pedidos.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-neutral-100 border-b">
                <tr>
                  <th className="text-left p-2">Nombre</th>
                  {DAYS.map((d) => (
                    <th key={d} className="text-left p-2">
                      {SHORT[d]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selections.map((s) => (
                  <tr key={s.id} className="border-b hover:bg-neutral-50">
                    <td className="p-2 font-medium">{s.user_name}</td>
                    {DAYS.map((d) => {
                      const c = (s.choices || {})[d] || {};
                      const bits = [];
                      if (c.breakfast) bits.push(`🍞 ${c.breakfast}`);
                      if (c.main) bits.push(`🍽️ ${c.main}`);
                      if (c.diet) bits.push(`🥗 ${c.diet}`);
                      if (c.side) bits.push(`+ ${c.side}`);
                      return (
                        <td key={d} className="p-2 text-xs align-top">
                          {bits.length ? bits.join(" · ") : "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminOrders() {
  const [tab, setTab] = useState("mara");
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Pedidos de la semana</h1>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-2 w-full max-w-md">
          <TabsTrigger value="mara" data-testid="orders-tab-mara">
            Mara
          </TabsTrigger>
          <TabsTrigger value="sabrositos" data-testid="orders-tab-sabrositos">
            Sabrositos
          </TabsTrigger>
        </TabsList>
        <TabsContent value="mara" className="mt-4">
          <ProviderOrders provider="mara" />
        </TabsContent>
        <TabsContent value="sabrositos" className="mt-4">
          <ProviderOrders provider="sabrositos" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
