import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getActiveMenus,
  saveSelection,
  getMySelection,
  DAY_LABEL,
} from "@/lib/store";
import { LOGO_URL } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { toast } from "sonner";
import { ArrowLeft, ChefHat, UtensilsCrossed, Check } from "lucide-react";

function ChoiceGroup({ title, options, value, onChange, name, testid, multiple }) {
  if (!options || options.length === 0) return null;
  const selected = multiple ? Array.isArray(value) ? value : [] : value;
  if (multiple) {
    return (
      <div className="space-y-1.5">
        <div className="text-xs font-semibold text-neutral-600 uppercase tracking-wide">
          {title}
        </div>
        <ToggleGroup type="multiple" value={selected} onValueChange={onChange} className="flex flex-wrap gap-2">
          {options.map((opt, i) => {
            const id = `${name}-${i}`;
            const active = selected.includes(opt);
            return (
              <ToggleGroupItem
                key={id}
                value={opt}
                id={id}
                data-testid={`${testid}-${i}`}
                className={`rounded-md px-3 py-2 text-sm border transition ${
                  active
                    ? "bg-red-600 text-white border-red-600"
                    : "border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                {opt}
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-semibold text-neutral-600 uppercase tracking-wide">
        {title}
      </div>
      <RadioGroup value={value || ""} onValueChange={onChange}>
        <div className="space-y-1">
          {options.map((opt, i) => {
            const id = `${name}-${i}`;
            const active = value === opt;
            return (
              <label
                key={id}
                htmlFor={id}
                data-testid={`${testid}-${i}`}
                className={`flex items-start gap-2 p-2 rounded-md border cursor-pointer transition ${
                  active
                    ? "border-red-500 bg-red-50"
                    : "border-neutral-200 hover:bg-neutral-50"
                }`}
              >
                <RadioGroupItem value={opt} id={id} className="mt-0.5 shrink-0" />
                <span className="text-sm leading-tight">{opt}</span>
              </label>
            );
          })}
          {value && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="text-xs text-neutral-500 underline mt-1"
            >
              Quitar selección
            </button>
          )}
        </div>
      </RadioGroup>
    </div>
  );
}

export default function OrderForm() {
  const navigate = useNavigate();
  const [provider, setProvider] = useState(null);
  const [menus, setMenus] = useState({ mara: null, sabrositos: null });
  const [day, setDay] = useState("lunes");
  const [choices, setChoices] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const userName = localStorage.getItem("nasser_user_name") || "";

  useEffect(() => {
    if (!userName) {
      navigate("/");
      return;
    }
    (async () => {
      try {
        // 15s timeout so we don't hang forever on bad network / bad config
        const timeout = new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Tiempo de espera agotado. Revisá tu conexión o la configuración de Firebase.")),
            15000
          )
        );
        const active = await Promise.race([getActiveMenus(), timeout]);
        setMenus(active);
      } catch (e) {
        toast.error("Error al cargar menús: " + e.message);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line
  }, []);

  const activeMenu = provider ? menus[provider] : null;

  // load user's previous selection when entering a provider
  useEffect(() => {
    (async () => {
      if (activeMenu && userName) {
        try {
          const prev = await getMySelection(activeMenu.id, userName);
          setChoices(prev?.choices || {});
        } catch {
          /* ignore */
        }
      } else {
        setChoices({});
      }
    })();
  }, [activeMenu, userName]);

  const availableDays = useMemo(() => {
    if (!activeMenu) return [];
    return (activeMenu.days || []).filter(
      (d) =>
        (d.breakfast?.length || 0) +
          (d.main?.length || 0) +
          (d.diet?.length || 0) +
          (d.sides?.length || 0) >
        0
    );
  }, [activeMenu]);

  useEffect(() => {
    if (availableDays.length && !availableDays.find((d) => d.day === day)) {
      setDay(availableDays[0].day);
    }
  }, [availableDays, day]);

  const currentDay = useMemo(
    () => availableDays.find((d) => d.day === day),
    [availableDays, day]
  );

  const setChoice = (dayKey, field, value) => {
    setChoices((prev) => {
      const c = { ...(prev[dayKey] || {}) };
      c[field] = value;
      if (field === "main" && value) {
        c.diet = "";
      }
      if (field === "diet") {
        c.main = "";
      }
      if ((field === "main" || field === "diet") && !value) {
        c.mainExtra = "";
      }
      if (field === "breakfast" && !value) {
        c.breakfastExtra = "";
      }
      if (field === "side") {
        const selectedSides = Array.isArray(value) ? value : String(value).split(", ").filter(Boolean);
        if (!selectedSides.length) {
          c.sideExtra = "";
        }
        c.side = Array.isArray(value) ? value.join(", ") : value;
      }
      return { ...prev, [dayKey]: c };
    });
  };

  const setMainExtra = (dayKey, text) => {
    setChoices((prev) => ({
      ...prev,
      [dayKey]: { ...(prev[dayKey] || {}), mainExtra: text },
    }));
  };

  const setBreakfastExtra = (dayKey, text) => {
    setChoices((prev) => ({
      ...prev,
      [dayKey]: { ...(prev[dayKey] || {}), breakfastExtra: text },
    }));
  };

  const setSideExtra = (dayKey, text) => {
    setChoices((prev) => ({
      ...prev,
      [dayKey]: { ...(prev[dayKey] || {}), sideExtra: text },
    }));
  };

  const submit = async () => {
    if (!activeMenu) return;
    const hasAny = Object.values(choices).some((c) =>
      Object.values(c || {}).some((v) => v && v.trim())
    );
    if (!hasAny) {
      toast.error("Elegí al menos una opción antes de enviar");
      return;
    }
    setSubmitting(true);
    try {
      await saveSelection({
        userName,
        provider,
        menu: activeMenu,
        choices,
      });
      toast.success("¡Pedido guardado! Podés cerrar la página.");
    } catch (e) {
      toast.error("Error al guardar: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Cargando…
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-3 py-2 border-b bg-white sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => (provider ? setProvider(null) : navigate("/"))}
            data-testid="back-btn"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <img src={LOGO_URL} alt="Nasser" className="h-8" />
        </div>
        <div className="text-xs sm:text-sm text-neutral-600 truncate max-w-[50%]">
          {userName}
        </div>
      </header>

      {!provider ? (
        <main className="flex-1 flex items-center justify-center px-4 py-8">
          <div className="w-full max-w-md space-y-4">
            <h2 className="text-xl font-bold text-center">Elegí tu proveedor</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ProviderCard
                icon={<ChefHat className="w-8 h-8" />}
                label="Mara"
                available={!!menus.mara}
                onClick={() => setProvider("mara")}
                testid="pick-mara"
              />
              <ProviderCard
                icon={<UtensilsCrossed className="w-8 h-8" />}
                label="Sabrositos"
                available={!!menus.sabrositos}
                onClick={() => setProvider("sabrositos")}
                testid="pick-sabrositos"
              />
            </div>
            <p className="text-xs text-center text-neutral-500 pt-2">
              Los proveedores sin menú aparecen deshabilitados hasta que admin
              cargue el menú de la semana.
            </p>
          </div>
        </main>
      ) : !activeMenu ? (
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center text-neutral-500">
            No hay menú cargado para {provider}.
          </div>
        </main>
      ) : (
        <main className="flex-1 px-3 py-4 sm:px-6 max-w-3xl w-full mx-auto space-y-4">
          <div className="text-sm text-neutral-600">
            Semana:{" "}
            <strong>
              {activeMenu.week_start || "—"}{" "}
              {activeMenu.week_end ? ` → ${activeMenu.week_end}` : ""}
            </strong>
          </div>

          <ToggleGroup
            type="single"
            value={day}
            onValueChange={(v) => v && setDay(v)}
            className="flex flex-wrap gap-1 justify-start"
          >
            {availableDays.map((d) => {
              const filled =
                choices[d.day] &&
                Object.values(choices[d.day]).some((v) => v && v.trim());
              return (
                <ToggleGroupItem
                  key={d.day}
                  value={d.day}
                  data-testid={`day-${d.day}`}
                  className="data-[state=on]:bg-red-600 data-[state=on]:text-white h-9 px-3"
                >
                  {DAY_LABEL[d.day]}
                  {filled && <Check className="w-3 h-3 ml-1" />}
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>

          {currentDay && (
            <Card>
              <CardContent className="p-4 space-y-5">
                <h3 className="text-lg font-bold text-red-600">
                  {DAY_LABEL[currentDay.day]}
                  {currentDay.date ? (
                    <span className="text-xs text-neutral-500 ml-2 font-normal">
                      ({currentDay.date})
                    </span>
                  ) : null}
                </h3>

                {(() => {
                  const isMara = provider === "mara";
                  const labels = isMara
                    ? { main: "Plato principal", diet: "Dieta", side: "Acompañamiento" }
                    : { main: "Almuerzo", diet: "Menú Opcional", side: "Acompañamiento" };
                  return (
                    <>
                      <ChoiceGroup
                        title="Desayuno"
                        options={currentDay.breakfast}
                        value={choices[currentDay.day]?.breakfast || ""}
                        onChange={(v) => setChoice(currentDay.day, "breakfast", v)}
                        name={`bf-${currentDay.day}`}
                        testid={`bf-${currentDay.day}`}
                      />
                      {choices[currentDay.day]?.breakfast ? (
                        <div className="pl-2 -mt-2">
                          <label className="text-xs font-semibold text-neutral-600 block mb-1">
                            Especificá de manera opcional
                            <span className="text-neutral-400 font-normal">
                              {" "}(opcional)
                            </span>
                          </label>
                          <input
                            type="text"
                            value={choices[currentDay.day]?.breakfastExtra || ""}
                            onChange={(e) =>
                              setBreakfastExtra(currentDay.day, e.target.value)
                            }
                            placeholder="Ej: jugo de naranja, sin sal"
                            data-testid={`breakfast-extra-${currentDay.day}`}
                            className="w-full text-sm px-3 py-2 border border-red-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-400"
                            maxLength={80}
                          />
                        </div>
                      ) : null}
                      <ChoiceGroup
                        title={labels.main}
                        options={currentDay.main}
                        value={choices[currentDay.day]?.main || ""}
                        onChange={(v) => setChoice(currentDay.day, "main", v)}
                        name={`main-${currentDay.day}`}
                        testid={`main-${currentDay.day}`}
                      />
                      <ChoiceGroup
                        title={labels.diet}
                        options={currentDay.diet}
                        value={choices[currentDay.day]?.diet || ""}
                        onChange={(v) => setChoice(currentDay.day, "diet", v)}
                        name={`diet-${currentDay.day}`}
                        testid={`diet-${currentDay.day}`}
                      />
                      {(choices[currentDay.day]?.main || choices[currentDay.day]?.diet) ? (
                        <div className="pl-2 -mt-2">
                          <label className="text-xs font-semibold text-neutral-600 block mb-1">
                            Especificá de manera opcional
                            <span className="text-neutral-400 font-normal">
                              {" "}(opcional)
                            </span>
                          </label>
                          <input
                            type="text"
                            value={choices[currentDay.day]?.mainExtra || ""}
                            onChange={(e) =>
                              setMainExtra(currentDay.day, e.target.value)
                            }
                            placeholder="Ej: sin cebolla, extra aderezo"
                            data-testid={`main-extra-${currentDay.day}`}
                            className="w-full text-sm px-3 py-2 border border-red-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-400"
                            maxLength={80}
                          />
                        </div>
                      ) : null}
                      <ChoiceGroup
                        title={labels.side}
                        options={currentDay.sides}
                        value={(choices[currentDay.day]?.side || "").split(", ").filter(Boolean)}
                        onChange={(v) =>
                          setChoice(
                            currentDay.day,
                            "side",
                            Array.isArray(v) ? v.join(", ") : v
                          )
                        }
                        name={`side-${currentDay.day}`}
                        testid={`side-${currentDay.day}`}
                        multiple
                      />
                      {(choices[currentDay.day]?.side || "").split(", ").filter(Boolean).length ? (
                        <div className="pl-2 -mt-2">
                          <label className="text-xs font-semibold text-neutral-600 block mb-1">
                            Especificá de manera opcional
                            <span className="text-neutral-400 font-normal">
                              {" "}(opcional)
                            </span>
                          </label>
                          <input
                            type="text"
                            value={choices[currentDay.day]?.sideExtra || ""}
                            onChange={(e) =>
                              setSideExtra(currentDay.day, e.target.value)
                            }
                            placeholder="Ej: sin picante, con limón"
                            data-testid={`side-extra-${currentDay.day}`}
                            className="w-full text-sm px-3 py-2 border border-red-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-400"
                            maxLength={80}
                          />
                        </div>
                      ) : null}
                    </>
                  );
                })()}
              </CardContent>
            </Card>
          )}

          <Button
            className="w-full bg-red-600 hover:bg-red-700 h-11"
            onClick={submit}
            disabled={submitting}
            data-testid="submit-order-btn"
          >
            {submitting ? "Guardando…" : "Enviar pedido"}
          </Button>
          <p className="text-xs text-center text-neutral-500">
            Podés volver a entrar con el mismo nombre para modificar tu pedido.
          </p>
        </main>
      )}
    </div>
  );
}

function ProviderCard({ icon, label, available, onClick, testid }) {
  return (
    <button
      type="button"
      onClick={available ? onClick : undefined}
      disabled={!available}
      data-testid={testid}
      className={`rounded-lg border-2 p-6 flex flex-col items-center gap-2 transition ${
        available
          ? "border-neutral-200 hover:border-red-500 hover:bg-red-50"
          : "border-neutral-100 opacity-50 cursor-not-allowed"
      }`}
    >
      <div className={available ? "text-red-600" : "text-neutral-400"}>
        {icon}
      </div>
      <div className="font-semibold text-base">{label}</div>
      <div className="text-xs text-neutral-500">
        {available ? "Menú disponible" : "Sin menú aún"}
      </div>
    </button>
  );
}
