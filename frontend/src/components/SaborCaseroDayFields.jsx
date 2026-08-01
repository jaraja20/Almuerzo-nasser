import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

/**
 * Selección de un día para el proveedor Sabor Casero.
 * - Desayuno: catálogo fijo (igual todos los días de semana, otro el sábado).
 * - Almuerzo (lunes a viernes): el colaborador elige 1 de las 3 opciones de
 *   plato fuerte; al elegir una, la guarnición disponible pasa a ser SOLO la
 *   de esa opción (puede tener 1 o varias alternativas). Cada segmento
 *   (desayuno / plato / guarnición) tiene su propio campo de texto libre
 *   para personalizar el pedido.
 */
export default function SaborCaseroDayFields({
  dayKey,
  breakfastOptions,
  opciones,
  choice,
  onBreakfast,
  onBreakfastExtra,
  onOpcion,
  onGuarnicion,
  onPlatoExtra,
  onGuarnicionExtra,
}) {
  const selectedOpcionIdx = (opciones || []).findIndex(
    (o) => o.plato && o.plato === choice?.main
  );
  const selectedOpcion =
    selectedOpcionIdx >= 0 ? opciones[selectedOpcionIdx] : null;

  return (
    <div className="space-y-5">
      {/* Desayuno */}
      <div className="space-y-1.5">
        <div className="text-xs font-semibold text-neutral-600 uppercase tracking-wide">
          Desayuno
        </div>
        <RadioGroup
          value={choice?.breakfast || ""}
          onValueChange={onBreakfast}
        >
          <div className="space-y-1">
            {(breakfastOptions || []).map((opt, i) => {
              const id = `bf-${dayKey}-${i}`;
              const active = choice?.breakfast === opt;
              return (
                <label
                  key={id}
                  htmlFor={id}
                  data-testid={`bf-${dayKey}-${i}`}
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
          </div>
        </RadioGroup>
        {choice?.breakfast ? (
          <div className="pl-2">
            <label className="text-xs font-semibold text-neutral-600 block mb-1">
              Especificá de manera opcional
              <span className="text-neutral-400 font-normal"> (opcional)</span>
            </label>
            <input
              type="text"
              value={choice?.breakfastExtra || ""}
              onChange={(e) => onBreakfastExtra(e.target.value)}
              placeholder="Ej: sin café, con jugo"
              data-testid={`breakfast-extra-${dayKey}`}
              className="w-full text-sm px-3 py-2 border border-red-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-400"
              maxLength={80}
            />
          </div>
        ) : null}
      </div>

      {/* Almuerzo: 3 opciones de plato fuerte (solo lunes a viernes) */}
      {opciones && opciones.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs font-semibold text-neutral-600 uppercase tracking-wide">
            Almuerzo
          </div>
          <RadioGroup
            value={choice?.main || ""}
            onValueChange={(v) => onOpcion(v)}
          >
            <div className="space-y-1">
              {opciones.map((o, i) => {
                const id = `opcion-${dayKey}-${i}`;
                const active = choice?.main === o.plato;
                return (
                  <label
                    key={id}
                    htmlFor={id}
                    data-testid={`opcion-${dayKey}-${i}`}
                    className={`flex items-start gap-2 p-2 rounded-md border cursor-pointer transition ${
                      active
                        ? "border-red-500 bg-red-50"
                        : "border-neutral-200 hover:bg-neutral-50"
                    }`}
                  >
                    <RadioGroupItem value={o.plato} id={id} className="mt-0.5 shrink-0" />
                    <span className="text-sm leading-tight">
                      <span className="font-semibold text-red-600">
                        {o.titulo}:
                      </span>{" "}
                      {o.plato || "(sin definir)"}
                    </span>
                  </label>
                );
              })}
            </div>
          </RadioGroup>
          {choice?.main ? (
            <div className="pl-2">
              <label className="text-xs font-semibold text-neutral-600 block mb-1">
                Especificá de manera opcional
                <span className="text-neutral-400 font-normal"> (opcional)</span>
              </label>
              <input
                type="text"
                value={choice?.mainExtra || ""}
                onChange={(e) => onPlatoExtra(e.target.value)}
                placeholder="Ej: sin sal, bien cocido"
                data-testid={`main-extra-${dayKey}`}
                className="w-full text-sm px-3 py-2 border border-red-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-400"
                maxLength={80}
              />
            </div>
          ) : null}

          {/* Guarnición: solo las de la opción elegida */}
          {selectedOpcion && selectedOpcion.guarnicion?.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <div className="text-xs font-semibold text-neutral-600 uppercase tracking-wide">
                Guarnición
              </div>
              <RadioGroup value={choice?.side || ""} onValueChange={onGuarnicion}>
                <div className="space-y-1">
                  {selectedOpcion.guarnicion.map((g, i) => {
                    const id = `guarnicion-${dayKey}-${i}`;
                    const active = choice?.side === g;
                    return (
                      <label
                        key={id}
                        htmlFor={id}
                        data-testid={`guarnicion-${dayKey}-${i}`}
                        className={`flex items-start gap-2 p-2 rounded-md border cursor-pointer transition ${
                          active
                            ? "border-red-500 bg-red-50"
                            : "border-neutral-200 hover:bg-neutral-50"
                        }`}
                      >
                        <RadioGroupItem value={g} id={id} className="mt-0.5 shrink-0" />
                        <span className="text-sm leading-tight">{g}</span>
                      </label>
                    );
                  })}
                </div>
              </RadioGroup>
              {choice?.side ? (
                <div className="pl-2">
                  <label className="text-xs font-semibold text-neutral-600 block mb-1">
                    Especificá de manera opcional
                    <span className="text-neutral-400 font-normal"> (opcional)</span>
                  </label>
                  <input
                    type="text"
                    value={choice?.sideExtra || ""}
                    onChange={(e) => onGuarnicionExtra(e.target.value)}
                    placeholder="Ej: sin cebolla, poca sal"
                    data-testid={`side-extra-${dayKey}`}
                    className="w-full text-sm px-3 py-2 border border-red-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-400"
                    maxLength={80}
                  />
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
