# Deploy en Vercel — Nasser Cubiertas Pedidos

Este proyecto está listo para hostearse **gratis en Vercel** con **Firebase Firestore** como base de datos.

## Requisitos previos

1. Cuenta gratis en https://vercel.com (podés loguearte con tu GitHub o Google).
2. Proyecto de Firebase ya creado (ya lo hiciste ✅). Firestore Database en modo test/producción con las reglas ajustadas.
3. Este código subido a un repo de GitHub/GitLab/Bitbucket **O** bajado a tu compu.

---

## Reglas de Firestore (importante — antes de compartir el link)

Andá a **Firebase Console → Firestore Database → Rules**, reemplazá TODO por esto y publicá:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /menus/{doc} {
      allow read, write: if true;
    }
    match /selections/{doc} {
      allow read, write: if true;
    }
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

Esto habilita lectura/escritura solo en las 2 colecciones que usa la app. Todo lo demás bloqueado.

> ⚠️ Cualquiera con el link puede escribir. Es aceptable porque el link solo se comparte internamente por WhatsApp de la empresa. Si querés más seguridad, podemos agregar Firebase Auth después.

---

## Deploy paso a paso

### Opción A — Deploy con GitHub (recomendado, auto-updates)

1. Creá un repo en GitHub e importalo:
   - Bajate la carpeta `frontend/` de este proyecto (todo lo que hay en `/app/frontend/`).
   - Subilo a un repo nuevo en GitHub llamado `nasser-pedidos` (o el que quieras).
2. Entrá a https://vercel.com/new
3. Clic en **"Import"** al lado del repo que subiste.
4. En **"Configure Project"**:
   - **Framework Preset**: `Create React App` (Vercel lo detecta solo)
   - **Root Directory**: dejalo en blanco (o `./` si te lo pide)
   - **Build Command**: `yarn build`
   - **Output Directory**: `build`
5. **Environment Variables** — Clic en "Environment Variables" y agregá una por una (los valores los sacás del archivo `frontend/.env` que ya tenés):

   ```
   REACT_APP_FIREBASE_API_KEY = AIzaSyAiCaBx9i_0jEKpjz-rVSfRxCkAwC_vByo
   REACT_APP_FIREBASE_AUTH_DOMAIN = almuerzo-60b3f.firebaseapp.com
   REACT_APP_FIREBASE_PROJECT_ID = almuerzo-60b3f
   REACT_APP_FIREBASE_STORAGE_BUCKET = almuerzo-60b3f.firebasestorage.app
   REACT_APP_FIREBASE_MESSAGING_SENDER_ID = 58201575230
   REACT_APP_FIREBASE_APP_ID = 1:58201575230:web:0fe718488583cae9a2e66f
   REACT_APP_ADMIN_USER = recepcion
   REACT_APP_ADMIN_PASSWORD = rec73491654
   ```

6. Clic **"Deploy"**. Esperá 1-2 minutos.
7. Te va a dar una URL tipo `https://nasser-pedidos-abc.vercel.app`. Esa es la URL que compartís por WhatsApp con tus colaboradores.

### Opción B — Deploy directo desde tu compu con Vercel CLI

```bash
# 1. Instalá Vercel CLI
npm install -g vercel

# 2. Entrá a la carpeta frontend
cd frontend

# 3. Login
vercel login

# 4. Deploy (te va a preguntar cosas — respondé y y usá defaults)
vercel

# 5. Configurar las env vars (una vez):
vercel env add REACT_APP_FIREBASE_API_KEY production
# ... (repetí para cada una de las 8 vars)

# 6. Deploy final a producción
vercel --prod
```

---

## Configuración del router (SPA rewrites)

Vercel maneja rutas de React Router automáticamente para CRA, pero si notás que refrescar `/admin/menus` te tira 404, creá un archivo `vercel.json` en la raíz del proyecto (junto a `package.json`):

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/" }
  ]
}
```

Y volvé a hacer deploy.

---

## Post-deploy

### Domain custom (opcional)
Si querés `pedidos.nassercubiertas.com` en vez del subdominio de Vercel:
- Vercel Dashboard → tu proyecto → **Settings → Domains** → **Add** → seguí las instrucciones (te dice qué CNAME poner en tu DNS).

### Actualizar credenciales admin
Cambiá las env vars `REACT_APP_ADMIN_USER` y `REACT_APP_ADMIN_PASSWORD` en Vercel → Settings → Environment Variables → editar → **redeploy** (Deployments → click en los 3 puntos del último deploy → Redeploy).

### Reset semanal
Todos los sábados, un admin entra al panel → **Ver Pedidos** → botón **Reset** (por proveedor) para dejar la semana limpia. También podés eliminar el menú viejo desde **Generar Menú → Eliminar** (borra menú + todos sus pedidos en cascada).

---

## Consideraciones de costos y límites

- **Firebase Firestore free tier**: 50k lecturas/día, 20k escrituras/día, 1 GB de almacenamiento. Para una empresa con ~50 colaboradores hacés como mucho ~500 operaciones semanales — **sobra**.
- **Vercel free tier (Hobby)**: 100 GB de bandwidth/mes. Uso mínimo.
- **Total**: **$0/mes**.

---

## Estructura de datos en Firestore

- Colección `menus`: un documento por menú semanal cargado.
  - Campos: `provider` (mara/sabrositos), `week_start`, `week_end`, `days[]` (array con desayuno/main/dieta/sides por día), `created_at`.
- Colección `selections`: un documento por pedido de colaborador.
  - ID del doc: `{menuId}__{nombre_sanitizado}` — permite editar el mismo pedido reingresando.
  - Campos: `user_name`, `provider`, `menu_id`, `choices` (objeto con selecciones por día), `created_at`.

---

## Contacto / dudas

Si algo falla en el deploy, revisá la consola del navegador (F12) — los errores de Firebase suelen ser por reglas mal configuradas o env vars faltantes.
