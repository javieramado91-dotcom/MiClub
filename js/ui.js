// js/ui.js
// Lógica compartida por TODAS las pantallas internas:
//  - Protege la página (si no hay sesión, vuelve al login)
//  - Carga los colores del equipo desde Firestore y los aplica a toda la web
//  - Provee el cierre de sesión

import { auth, db } from './firebase-config.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// Aplica los colores del equipo cambiando las variables CSS en tiempo real
export function aplicarColores(colorPrincipal, colorSecundario) {
    const raiz = document.documentElement;
    if (colorPrincipal) raiz.style.setProperty('--color-principal', colorPrincipal);
    if (colorSecundario) raiz.style.setProperty('--color-secundario', colorSecundario);
}

// Protege la pantalla y carga el tema del equipo.
// Recibe una función "callback" que se ejecuta con los datos del equipo ya cargados.
export function iniciarPagina(callback) {
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            // No hay sesión: lo mandamos al login
            window.location.href = 'index.html';
            return;
        }

        let datosEquipo = null;
        try {
            const snap = await getDoc(doc(db, "equipos", user.uid));
            if (snap.exists()) {
                datosEquipo = snap.data();
                aplicarColores(datosEquipo.colorPrincipal, datosEquipo.colorSecundario);
            }
        } catch (error) {
            console.error("No se pudo cargar el tema del equipo:", error);
        }

        if (callback) callback(user, datosEquipo);
    });
}

// Cierra la sesión y vuelve al login
export async function cerrarSesion() {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Error al cerrar sesión:", error);
    }
    window.location.href = 'index.html';
}

// Conecta automáticamente cualquier botón con el atributo [data-cerrar-sesion]
document.addEventListener('click', (e) => {
    if (e.target.closest('[data-cerrar-sesion]')) {
        e.preventDefault();
        cerrarSesion();
    }
});
