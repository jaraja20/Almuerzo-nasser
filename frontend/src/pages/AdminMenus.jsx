import { useEffect, useState } from "react";
import {
  listMenus,
  createMenu,
  updateMenu,
  deleteMenu,
  parseMaraExcel,
  parseSabrositosText,
  DAYS,
  DAY_LABEL,
} from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  ChefHat,
  UtensilsCrossed,
  FileSpreadsheet,
  MessageSquareText,
  Plus,
  Trash2,
  Save,
  Upload,
} from "lucide-react";

const emptyDay = (day) => ({
  day,
  date: "",
  breakfast: [],
  main: [],
  diet: [],
  sides: [],
});
const emptyMenu = (provider) => ({
  id: null,
  provider,
  week_start: "",
  week_end: "",
  days: DAYS.map(emptyDay),
});

function ItemList({ items, onChange, label, testid }) {
  const add = () => onChange([...(items || []), ""]);
  const update = (i, v) => {
    const c = [...items];
    c[i] = v;
    onChange(c);
  };
  const remove = (i) => onChange(items.filter((_, x) => x !== i));
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-semibold text-neutral-600">{label}</div>
      {(items || []).map((it, i) => (
        <div key={i} className="flex gap-1.5">
          <Input
            data-testid={`${testid}-${i}`}
            value={it}
            onChange={(e) => update(i, e.target.value)}
            className="h-8 text-sm"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => remove(i)}
          >
            <Trash2 className="w-3.5 h-3.5 text-red-600" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={add}
        className="h-7 text-xs"
        data-testid={`${testid}-add`}
      >
        <Plus className="w-3 h-3 mr-1" /> Agregar
      </Button>
    </div>
  );
}

const normalize = (m) => ({
  id: m.id,
  provider: m.provider,
  week_start: m.week_start || "",
  week_end: m.week_end || "",
  days: DAYS.map(
    (d) => (m.days || []).find((x) => x.day === d) || emptyDay(d)
  ),
});

function MenuEditor({ provider }) {
  const [menu, setMenu] = useState(emptyMenu(provider));
  const [history, setHistory] = useState([]);
  const [pasteText, setPasteText] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      const list = await listMenus(provider);
      setHistory(list);
      if (list.length > 0) setMenu(normalize(list[0]));
      else setMenu(emptyMenu(provider));
    } catch (e) {
      toast.error("Error al cargar menús: " + e.message);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [provider]);

  const updateDay = (day, field, value) => {
    setMenu((prev) => ({
      ...prev,
      days: prev.days.map((d) =>
        d.day === day ? { ...d, [field]: value } : d
      ),
    }));
  };

  const saveMenu = async () => {
    setLoading(true);
    try {
      const cleanDays = menu.days.map((d) => ({
        day: d.day,
        date: d.date || null,
        breakfast: (d.breakfast || []).filter((x) => x && x.trim()),
        main: (d.main || []).filter((x) => x && x.trim()),
        diet: (d.diet || []).filter((x) => x && x.trim()),
        sides: (d.sides || []).filter((x) => x && x.trim()),
      }));
      const payload = {
        provider: menu.provider,
        week_start: menu.week_start || null,
        week_end: menu.week_end || null,
        days: cleanDays,
      };
      if (menu.id) {
        await updateMenu(menu.id, payload);
        toast.success("Menú actualizado");
      } else {
        const created = await createMenu(payload);
        setMenu(normalize(created));
        toast.success("Menú guardado");
      }
      load();
    } catch (e) {
      toast.error("Error al guardar: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const newMenu = () => {
    setMenu(emptyMenu(provider));
    toast.info("Editor limpio para menú nuevo");
  };

  const doDelete = async () => {
    if (!menu.id) return;
    if (!window.confirm("¿Eliminar este menú y sus pedidos asociados?")) return;
    try {
      await deleteMenu(menu.id);
      toast.success("Menú eliminado");
      load();
    } catch (e) {
      toast.error("Error al eliminar: " + e.message);
    }
  };

  const onExcel = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const parsed = parseMaraExcel(buf);
      setMenu({
        id: menu.id,
        provider,
        week_start: parsed.week_start || "",
        week_end: parsed.week_end || "",
        days: DAYS.map(
          (d) => parsed.days.find((x) => x.day === d) || emptyDay(d)
        ),
      });
      toast.success("Excel procesado. Revisá y guardá.");
    } catch (err) {
      toast.error("Error al procesar Excel: " + err.message);
    }
    e.target.value = "";
  };

  const onParseText = () => {
    if (!pasteText.trim()) {
      toast.error("Pegá el mensaje del menú");
      return;
    }
    try {
      const parsed = parseSabrositosText(pasteText);
      setMenu((prev) => ({
        ...prev,
        days: DAYS.map((d) => {
          const p = parsed.days.find((x) => x.day === d);
          const existing = prev.days.find((x) => x.day === d) || emptyDay(d);
          if (!p) return existing;
          const totalItems =
            (p.breakfast?.length || 0) +
            (p.main?.length || 0) +
            (p.diet?.length || 0) +
            (p.sides?.length || 0);
          if (totalItems === 0) return existing;
          return {
            ...existing,
            breakfast: p.breakfast?.length ? p.breakfast : existing.breakfast,
            main: p.main?.length ? p.main : existing.main,
            diet: p.diet?.length ? p.diet : existing.diet,
            sides: p.sides?.length ? p.sides : existing.sides,
          };
        }),
      }));
      toast.success("Menú detectado. Revisá y guardá.");
    } catch {
      toast.error("Error al procesar texto");
    }
  };

  const isMara = provider === "mara";
  const catLabels = isMara
    ? { main: "Plato principal", diet: "Dieta", side: "Acompañamiento" }
    : { main: "Almuerzo", diet: "Menú Opcional", side: "Acompañamiento" };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <Label className="text-xs">Semana desde</Label>
              <Input
                type="date"
                data-testid={`${provider}-week-start`}
                value={menu.week_start || ""}
                onChange={(e) =>
                  setMenu({ ...menu, week_start: e.target.value })
                }
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs">Hasta</Label>
              <Input
                type="date"
                data-testid={`${provider}-week-end`}
                value={menu.week_end || ""}
                onChange={(e) =>
                  setMenu({ ...menu, week_end: e.target.value })
                }
                className="h-9"
              />
            </div>
            <div className="flex-1"></div>
            <Button
              variant="outline"
              size="sm"
              onClick={newMenu}
              data-testid={`${provider}-new-btn`}
            >
              Nuevo menú
            </Button>
            {menu.id && (
              <Button
                variant="outline"
                size="sm"
                onClick={doDelete}
                data-testid={`${provider}-delete-btn`}
                className="text-red-600 border-red-300 hover:bg-red-50"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" /> Eliminar
              </Button>
            )}
            <Button
              size="sm"
              onClick={saveMenu}
              disabled={loading}
              data-testid={`${provider}-save-btn`}
              className="bg-red-600 hover:bg-red-700"
            >
              <Save className="w-3.5 h-3.5 mr-1" />
              {menu.id ? "Actualizar" : "Guardar"}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t">
            {isMara && (
              <div>
                <Label className="text-xs flex items-center gap-1">
                  <FileSpreadsheet className="w-3.5 h-3.5" /> Importar Excel (Mara)
                </Label>
                <Input
                  type="file"
                  accept=".xlsx"
                  onChange={onExcel}
                  data-testid="mara-excel-upload"
                  className="h-9 mt-1"
                />
              </div>
            )}
            <div className={isMara ? "" : "md:col-span-2"}>
              <Label className="text-xs flex items-center gap-1">
                <MessageSquareText className="w-3.5 h-3.5" /> Pegar mensaje de WhatsApp
              </Label>
              <Textarea
                data-testid={`${provider}-paste-text`}
                rows={4}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={"Menú de la semana\nLunes\n🍽️ Plato 1\n🍽️ Plato 2\n..."}
                className="mt-1 text-sm"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={onParseText}
                className="mt-1"
                data-testid={`${provider}-parse-text-btn`}
              >
                <Upload className="w-3.5 h-3.5 mr-1" /> Procesar texto
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {menu.days.map((d) => (
          <Card key={d.day}>
            <CardContent className="p-4 space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-red-600">
                  {DAY_LABEL[d.day]}
                </h3>
                <Input
                  type="date"
                  value={d.date || ""}
                  onChange={(e) => updateDay(d.day, "date", e.target.value)}
                  className="h-7 w-40 text-xs"
                />
              </div>
              <ItemList
                items={d.breakfast}
                onChange={(v) => updateDay(d.day, "breakfast", v)}
                label="Desayuno"
                testid={`${provider}-${d.day}-breakfast`}
              />
              <ItemList
                items={d.main}
                onChange={(v) => updateDay(d.day, "main", v)}
                label={catLabels.main}
                testid={`${provider}-${d.day}-main`}
              />
              {(isMara || d.day !== "sabado") && (
                <>
                  <ItemList
                    items={d.diet}
                    onChange={(v) => updateDay(d.day, "diet", v)}
                    label={catLabels.diet}
                    testid={`${provider}-${d.day}-diet`}
                  />
                  <ItemList
                    items={d.sides}
                    onChange={(v) => updateDay(d.day, "sides", v)}
                    label={catLabels.side}
                    testid={`${provider}-${d.day}-sides`}
                  />
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {history.length > 1 && (
        <Card>
          <CardContent className="p-4">
            <div className="text-xs font-semibold text-neutral-600 mb-2">
              Historial ({history.length})
            </div>
            <div className="flex flex-wrap gap-2">
              {history.map((h) => (
                <Button
                  key={h.id}
                  size="sm"
                  variant={h.id === menu.id ? "default" : "outline"}
                  onClick={() => setMenu(normalize(h))}
                  className={
                    h.id === menu.id ? "bg-red-600 hover:bg-red-700" : ""
                  }
                >
                  {h.week_start || "sin fecha"}
                  {h.week_end ? ` → ${h.week_end}` : ""}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function AdminMenus() {
  const [tab, setTab] = useState("mara");
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Generar menú de la semana</h1>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-2 w-full max-w-md">
          <TabsTrigger value="mara" data-testid="tab-mara">
            <ChefHat className="w-4 h-4 mr-1" /> Mara
          </TabsTrigger>
          <TabsTrigger value="sabrositos" data-testid="tab-sabrositos">
            <UtensilsCrossed className="w-4 h-4 mr-1" /> Sabrositos
          </TabsTrigger>
        </TabsList>
        <TabsContent value="mara" className="mt-4">
          <MenuEditor provider="mara" />
        </TabsContent>
        <TabsContent value="sabrositos" className="mt-4">
          <MenuEditor provider="sabrositos" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
