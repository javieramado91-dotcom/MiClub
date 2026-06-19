# ⚽ Mi Club

Sistema web para la **gestión de datos y estadísticas de clubes de fútbol**. Cada usuario es un equipo: carga su plantel, registra partidos y campeonatos, y consulta rankings y estadísticas — todo con un diseño moderno, modo claro/oscuro y adaptado a celulares.

## ✨ Funcionalidades

- **Acceso**: inicio de sesión, creación de cuenta y recuperación de contraseña (por correo).
- **Dashboard**: muro de novedades autogenerado (goleadores, próximos cumpleaños, últimos resultados, racha, palmarés) + KPIs y figuras del equipo.
- **Equipo**: perfil del club con escudo, colores personalizables, datos (fundación, ciudad, estadio, DT, liga), **palmarés** y cambio de contraseña.
- **Jugadores**: plantel con cálculo de edad y posiciones.
- **Partidos**: resultados por campeonato con estadísticas de campaña (récord, puntos, efectividad, promedios, vallas invictas, racha).
- **Estadísticas**: resumen del plantel y rankings (Contribuciones G+A, goleadores, asistidores, amarillas, rojas).

## 🛠️ Tecnologías

HTML, CSS y JavaScript puro (módulos ES, sin framework) · **Firebase** (Authentication + Firestore) · alojado en **GitHub** y publicado en **Vercel**.

## 📁 Estructura

```
MiClub/
├── index.html / dashboard.html / equipo.html
├── jugadores.html / partidos.html / estadisticas.html
├── css/   → globales, componentes, login, dashboard, equipo, partidos
├── js/    → firebase-config, auth, ui, dashboard, equipo, jugadores, partidos, estadisticas
└── assets/→ favicon, escudo por defecto
```

Cada archivo tiene una única responsabilidad (lógica, estética y estructura separadas).

## 🚀 Puesta en marcha

1. **Firebase** → en la [consola](https://console.firebase.google.com):
   - Habilitar **Authentication → Correo electrónico/contraseña**.
   - Crear **Firestore Database** y aplicar estas reglas:
     ```
     rules_version = '2';
     service cloud.firestore {
       match /databases/{database}/documents {
         match /equipos/{uid} {
           allow read, write: if request.auth != null && request.auth.uid == uid;
           match /jugadores/{doc} { allow read, write: if request.auth != null && request.auth.uid == uid; }
           match /partidos/{doc}  { allow read, write: if request.auth != null && request.auth.uid == uid; }
         }
       }
     }
     ```
2. **Local**: abrir el proyecto con un servidor (ej. Live Server de VS Code). Los módulos ES no funcionan abriendo el archivo con doble clic.
3. **Vercel**: importar el repositorio (preset *Other*, sin build). Agregar el dominio de Vercel en **Firebase → Authentication → Dominios autorizados**.

---

Desarrollado por **JA**.
