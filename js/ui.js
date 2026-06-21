// js/ui.js
// Lógica compartida por TODAS las pantallas internas:
//  - Protege la página (si no hay sesión, vuelve al login)
//  - Carga los colores del equipo desde Firestore y los aplica a toda la web
//  - Provee el cierre de sesión

import { auth, db } from './firebase-config.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// Cuenta administradora (panel de usuarios / control de clientes)
export const ADMIN_EMAIL = 'javieramado91@gmail.com';

// Código de acceso de 6 dígitos
export function generarCodigo() { return String(Math.floor(100000 + Math.random() * 900000)); }

// Crea el documento de usuario (pendiente) si no existe y lo devuelve
export async function asegurarUsuario(user) {
    const ref = doc(db, 'usuarios', user.uid);
    const snap = await getDoc(ref);
    if (snap.exists()) return snap.data();
    const nuevo = {
        email: user.email, creado: Date.now(), codigo: generarCodigo(),
        estado: 'pendiente', tipo: 'free', formaPago: '', acceso: 'total', notas: ''
    };
    await setDoc(ref, nuevo);
    return nuevo;
}

// Verifica el acceso del usuario. Redirige según corresponda.
// Devuelve true solo si puede usar la app.
export async function protegerAcceso(user) {
    const email = (user.email || '').toLowerCase();
    if (email === ADMIN_EMAIL) { window.location.href = 'admin.html'; return false; }
    try {
        const u = await asegurarUsuario(user);
        if (u.estado !== 'activo') { window.location.href = 'acceso.html'; return false; }
        return true;
    } catch (e) {
        // Si las reglas aún no permiten leer 'usuarios', no bloqueamos (evita dejar afuera a nadie)
        console.error('Control de acceso:', e);
        return true;
    }
}

// Notificación tipo "toast" (reemplaza a alert()).
// tipo: "exito" | "error" | "info"
export function mostrarToast(mensaje, tipo = 'info') {
    let zona = document.getElementById('toast-zona');
    if (!zona) {
        zona = document.createElement('div');
        zona.id = 'toast-zona';
        document.body.appendChild(zona);
    }

    const iconos = { exito: '✅', error: '⚠️', info: '🔔' };
    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    toast.innerHTML = `<span class="ico">${iconos[tipo] || iconos.info}</span><span>${mensaje}</span>`;
    zona.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('salir');
        toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    }, 3200);
}

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

        // Control de acceso (admin / pendiente / denegado)
        const ok = await protegerAcceso(user);
        if (!ok) return;

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

// Modal de confirmación elegante (reemplaza a confirm()). Devuelve una promesa booleana.
export function confirmar(mensaje, opciones = {}) {
    const { textoOk = 'Confirmar', textoNo = 'Cancelar', icono = '🗑️', peligro = true } = opciones;

    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal" role="dialog" aria-modal="true">
                <div class="modal-icono">${icono}</div>
                <p class="modal-msg">${mensaje}</p>
                <div class="modal-acciones">
                    <button class="btn-secundario" data-no>${textoNo}</button>
                    <button class="btn-principal ${peligro ? 'btn-peligro' : ''}" data-si>${textoOk}</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('visible'));

        const cerrar = (valor) => {
            overlay.classList.remove('visible');
            overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
            resolve(valor);
        };

        overlay.querySelector('[data-si]').addEventListener('click', () => cerrar(true));
        overlay.querySelector('[data-no]').addEventListener('click', () => cerrar(false));
        overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(false); });
        document.addEventListener('keydown', function esc(ev) {
            if (ev.key === 'Escape') { cerrar(false); document.removeEventListener('keydown', esc); }
        });
    });
}

// Modal para elegir una opción de una lista (devuelve el valor o null)
export function elegirDeLista(titulo, opciones) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal" role="dialog" aria-modal="true">
                <p class="modal-msg">${titulo}</p>
                <select class="modal-select">${opciones.map((o) => `<option value="${o}">${o}</option>`).join('')}</select>
                <div class="modal-acciones" style="margin-top:18px;">
                    <button class="btn-secundario" data-no>Cancelar</button>
                    <button class="btn-principal" data-si>Elegir</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('visible'));
        const cerrar = (v) => { overlay.classList.remove('visible'); overlay.addEventListener('transitionend', () => overlay.remove(), { once: true }); resolve(v); };
        overlay.querySelector('[data-si]').addEventListener('click', () => cerrar(overlay.querySelector('.modal-select').value));
        overlay.querySelector('[data-no]').addEventListener('click', () => cerrar(null));
        overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(null); });
    });
}

// ---------- Tema claro / oscuro ----------
function aplicarTema(tema) {
    document.documentElement.setAttribute('data-tema', tema);
}

function inicializarTema() {
    let tema = 'claro';
    try { tema = localStorage.getItem('miclub-tema') || 'claro'; } catch (e) {}
    aplicarTema(tema);

    const boton = document.createElement('button');
    boton.className = 'btn-tema';
    boton.type = 'button';
    boton.setAttribute('aria-label', 'Cambiar tema');
    boton.textContent = tema === 'oscuro' ? '☀️' : '🌙';

    boton.addEventListener('click', () => {
        const nuevo = document.documentElement.getAttribute('data-tema') === 'oscuro' ? 'claro' : 'oscuro';
        aplicarTema(nuevo);
        boton.textContent = nuevo === 'oscuro' ? '☀️' : '🌙';
        try { localStorage.setItem('miclub-tema', nuevo); } catch (e) {}
    });

    const nav = document.querySelector('.app-nav');
    if (nav) {
        nav.insertBefore(boton, nav.firstChild);
    } else {
        boton.classList.add('flotante');
        document.body.appendChild(boton);
    }
}

// Se ejecuta apenas se carga el módulo en cualquier pantalla
inicializarTema();

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
