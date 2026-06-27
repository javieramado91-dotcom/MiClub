# CLAUDE.md — Mi Club ⚽

> Archivo ancla del proyecto. Leer esto PRIMERO al iniciar una sesión para recuperar el hilo.
> Última actualización: 2026-06 (tras implementar panel admin, convocados, copa/penales, cumpleaños y vitrina).

## Qué es
**Mi Club** es un gestor web de datos y estadísticas para clubes de fútbol. Cada usuario = un equipo.
Lo usa Javier (dueño/cliente) y, además, hay una **cuenta administradora** (`javieramado91@gmail.com`) que controla qué usuarios acceden a la app (modelo cuenta-cliente).

## Stack y despliegue
- **HTML + CSS + JS puro** (módulos ES, sin framework, sin bundler). Una responsabilidad por archivo.
- **Firebase** vía CDN 10.8.1: **Authentication** (correo+contraseña) + **Firestore**. Plan **Spark** (sin Cloud Functions).
  - Firebase projectId: `miclub-419ee`. Config en `js/firebase-config.js` (claves públicas por diseño).
- **GitHub**: https://github.com/javieramado91-dotcom/MiClub (rama `main`). El repo local YA está conectado (`origin`). Commitear y pushear los cambios.
- **Vercel**: sitio estático (preset *Other*, sin build). Se redeploya solo con cada push.
- Git user local: Javier Amado <javieramado91@gmail.com>. Firmar commits con `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

## Cómo correr / probar
- Abrir con un servidor (Live Server de VS Code). Los módulos ES NO funcionan con doble clic (`file://`).
- Verificación rápida usada siempre antes de pushear: cruzar `getElementById('x')`/`$('x')` de cada JS contra `id="x"` de su HTML; confirmar que CSS/JS/assets referenciados existen y que los imports de `ui.js` resuelven.

## Estructura de archivos
```
index.html        + js/auth.js                 → login / registro / recuperar contraseña (3 vistas)
acceso.html       + js/acceso.js               → gate: ingreso de código / cuenta pendiente o denegada
admin.html        + js/admin.js + css/admin.css→ panel SOLO admin: control de usuarios
dashboard.html    + js/dashboard.js            → inicio: muro de novedades, KPIs, tabla, destacados
equipo.html       + js/equipo.js               → perfil del club + palmarés + cambio de contraseña
jugadores.html    + js/jugadores.js            → ABM de jugadores
partidos.html     + js/partidos.js + css/partidos.css → torneos, partidos, posiciones
estadisticas.html + js/estadisticas.js         → carga de stats + rankings
convocados.html   + js/convocados.js + css/convocados.css → lista de convocados + export
js/ui.js          → compartido: tema, toasts, modales, gate de acceso, sesión
js/exportar.js + css/exportar.css → generación de imágenes 9:16 / 4:5 (html2canvas, CDN)
css/globales.css (tokens + dark), css/componentes.css (reutilizables), css/login.css, css/dashboard.css, css/equipo.css
assets/ → favicon.ico (pesado ~5MB, se puede optimizar), escudo-default.svg
```

## Modelo de datos (Firestore)
- `equipos/{uid}` = { nombre, apodo, fundacion (fecha), ciudad, estadio, dt, liga, palmares: [{titulo, cantidad, anio}], colorPrincipal, colorSecundario, escudo (base64 comprimido a 512px, NO Storage), uid }
- `equipos/{uid}/jugadores/{id}` = { nombre, fechaNacimiento, posicion, partidosJugados, goles, asistencias, amarillas, rojas }
- `equipos/{uid}/partidos/{id}` = { fecha, torneoId, torneoNombre, torneoTipo, fase, penalesFavor, penalesContra, rival, condicion (Local/Visitante), gf, gc }
- `equipos/{uid}/torneos/{id}` = { nombre, tipo ('liga'|'eliminatoria'), fase (para copa), rivales: [{id,nombre,pg,pe,pp,gf,gc}] }
- `usuarios/{uid}` = { email, creado, codigo (6 díg.), estado ('pendiente'|'activo'|'denegado'), tipo ('free'|'pago'), formaPago, acceso ('total'|'limitado'), notas }

**Reglas de Firestore: YA PUBLICADAS** (vía consola, navegador) para equipos+jugadores+partidos+torneos+usuarios. El texto completo está en `README.md`. Si se agrega una colección nueva, hay que actualizar las reglas (se hace manejando Chrome con la extensión Claude-in-Chrome → consola Firebase → Firestore → Reglas → editor CodeMirror `el.CodeMirror.setValue(...)` → Publicar).

## Sistema de acceso / admin (IMPORTANTE)
- `ADMIN_EMAIL = 'javieramado91@gmail.com'` (en `ui.js`).
- `protegerAcceso(user)` (llamado en `iniciarPagina` de ui.js y en equipo.js): admin → `admin.html`; estado ≠ activo → `acceso.html`; activo → entra. Ante error de lectura NO bloquea (evita lockouts).
- Flujo: registro crea `usuarios/{uid}` en **pendiente** con un **código**. El admin ve el código en `admin.html`, se lo pasa al usuario; el usuario lo ingresa en `acceso.html` y pasa a **activo** (la regla de Firestore valida que coincida). El admin puede denegar/activar y marcar pago/free/forma de pago/notas.
- **CAVEAT de seguridad**: en plan Spark (sin Functions) el código vive en el doc del usuario (técnicamente legible por él). Es un gate práctico para gestión, no criptográfico. Para blindarlo: Blaze + Cloud Function.
- Nota operativa: cuentas creadas ANTES de este sistema aparecen como pendientes al loguear; se activan desde el panel.

## Funcionalidades por pantalla (resumen)
- **Dashboard**: hero con saludo por hora; KPIs animados; **tabla del plantel** ordenable (PJ/G/A/TA/TR) con scroll y export "Exportar tabla" (9:16, top 10); **destacados** (Figura, Fair Play, Más amonestados) cada uno exportable; **muro de novedades** (último partido con avance de fase/penales en copa, racha, campaña SOLO de liga, torneos por actividad, cumpleaños, palmarés). Sincroniza jugadores en tiempo real (`onSnapshot`). Cumpleaños: muestra quien cumple HOY (con export de saludo) o el próximo; fecha parseada local (`+'T00:00:00'`) para que no se adelante un día. Vitrina: modal con todas las copas (nombre/año/cantidad), botón en el cuadro de palmarés.
- **Equipo**: banner en vivo, datos del club, escudo (comprimido), colores (aplican a toda la app vía variables CSS), palmarés con año, y cambio de contraseña (reautenticación).
- **Jugadores**: alta/baja, edad calculada, badge de posición.
- **Partidos**: crear **torneos** (liga o eliminatoria con fase); cargar partido eligiendo torneo (select) + penales si es copa; **tabla de posiciones** por liga (equipo propio auto + rivales editables); rendimiento por campeonato; historial. Exporta historias: último resultado, campaña, racha, posiciones, torneo.
- **Estadísticas**: resumen del plantel, edición +/- por jugador (incluye Partidos Jugados), rankings (Contribuciones G+A, goleadores, asistidores, amarillas, rojas — sin PJ), buscador + filtro por posición, scroll.
- **Convocados**: cantidad, torneo (elegir/tipear), fecha/instancia, DT (modal: del plantel o tipeado), selección por puesto, export historia 9:16 o feed 4:5.

## Copa vs Liga (criterio futbolístico)
- **Liga** = por puntos (3/1/0), todos contra todos, el empate vale. **Copa/eliminatoria** = por fases; el que gana avanza; los empates se definen por **penales**. En copa el sistema habla de AVANCE de fase y penales ("Pasó a Octavos", "Ganó por penales 4-3", "Eliminado en…"), NUNCA de puntos. `resultado()`/`resPartido()` contemplan penales.

## UI / convenciones
- Tema claro/oscuro con toggle inyectado por `ui.js`, persistido en `localStorage('miclub-tema')`, con mini-script anti-flash en el `<head>` de cada página.
- Colores del club como variables CSS `--color-principal` / `--color-secundario` (se aplican en cada carga vía `aplicarColores`).
- Reutilizables en `ui.js`: `mostrarToast(msg,tipo)`, `confirmar(msg,opts)`, `elegirDeLista(titulo,opciones)`.
- Exportadores en `exportar.js`: `armarExportEstadisticas`, `armarExportRanking`, `armarExportPremio`, `armarExportMarcador`, `armarExportStats`, `armarExportTablaPos`, `descargarComoJPG(cont,nombre,ancho,alto)`.
- Firma **"JA"** en el footer de todas las pantallas.
- Mantener SIEMPRE: simetría de las grillas, responsive (PC + móvil), y modo oscuro.

## Estado actual
Sistema completo y verificado, todo commiteado y pusheado a `main`. Reglas de Firestore publicadas. Pendiente menor opcional: optimizar el `favicon.ico` (~5MB).

## Para continuar en una nueva sesión
1. Leer este archivo y `memory/mi-club-proyecto.md`.
2. Confirmar rama `main` y `git status` limpio.
3. Trabajar el pedido; verificar (IDs/refs/imports); commit + push.
4. Si se toca el modelo de datos con una colección nueva → actualizar y publicar reglas de Firestore.
