# Nasser Cubiertas — Sistema de Pedido de Almuerzos

## Problema original
Empresa Nasser Cubiertas hace pedidos de almuerzo/desayuno de forma manual, con 2 proveedores:
- **Mara**: envía Excel con menú semanal (Lun-Vie almuerzo + Sábado desayuno).
- **Sabrositos**: envía mensaje de WhatsApp con 3 platos por día (Lun-Vie). Sábado es fijo (opciones tipo brunch).

Se necesita:
1. Formulario web donde cada colaborador ingresa su nombre y elige sus comidas.
2. Panel admin para cargar/editar/eliminar menú semanal (subir Excel de Mara o pegar texto de Sabrositos).
3. Descargar Excel consolidado con todos los pedidos.
4. Compatible con celular. Reset semanal manual.

## Arquitectura
- **Backend**: FastAPI + MongoDB (motor async). Puerto 8001, prefijo `/api`.
- **Frontend**: React 19 + React Router + Tailwind + shadcn/ui + sonner (toasts) + axios.
- **Parsers**:
  - Excel Mara: `openpyxl` — detecta bloques por día en 2 columnas, extrae main/diet/sides + desayuno.
  - Texto Sabrositos: regex que reconoce encabezados por día y limpia emojis.
- **Export Excel**: `xlsxwriter` con columnas dinámicas por día/categoría, coloreado rojo.

## Endpoints principales
- `POST /api/admin/login` → `{token}`
- `GET /api/menus?provider=` / `GET /api/menus/active` / `POST/PUT/DELETE /api/menus`
- `POST /api/menus/parse-excel` (multipart) — solo admin
- `POST /api/menus/parse-text` — solo admin
- `POST /api/selections` (público, upsert por user+menu)
- `GET /api/selections?provider=&menu_id=` (admin)
- `DELETE /api/selections/reset?provider=` (admin)
- `GET /api/selections/export?provider=&menu_id=&token=` (descarga xlsx, token via query)

## Rutas frontend
- `/` — Formulario "Nombre y Apellido" + botón Admin (esquina superior derecha)
- `/order` — Selector de proveedor → toggle de días → radios por categoría
- `/admin/login`
- `/admin/menus` — Tabs Mara/Sabrositos, editor + import Excel + paste texto
- `/admin/orders` — Tabs Mara/Sabrositos, tabla de pedidos + descargar + reset

## Implementado (2026-02)
- Homepage con validación de nombre y apellido.
- Login admin (recepcion / rec73491654).
- Sidebar admin con 2 opciones.
- Editor de menú por día con Desayuno / Principal / Dieta / Acompañamiento (Mara) y solo Principal (Sabrositos por defecto — editable).
- Importación Excel Mara y parseo texto Sabrositos.
- Selecciones por colaborador con upsert por nombre (permite editar).
- Vista de pedidos + descarga Excel consolidado con `xlsxwriter`.
- Reset semanal.
- Diseño responsive (celular).

## Backlog / Próximos pasos (P1/P2)
- P1: Bloqueo/lock de menú (una vez publicado, cerrar edición).
- P1: Enviar link por WhatsApp directamente desde admin.
- P2: Estadísticas (cuántos platos de cada opción se pidieron).
- P2: Historial de semanas archivadas.
- P2: Notificación por email al admin cuando alguien completa.
