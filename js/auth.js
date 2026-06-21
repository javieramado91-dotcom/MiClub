// js/auth.js — Acceso: iniciar sesión, crear cuenta y recuperar contraseña
import { auth, db } from './firebase-config.js';
import { mostrarToast, generarCodigo } from './ui.js';
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// ---------- Cambiar entre vistas (login / registro / recuperar) ----------
const vistas = document.querySelectorAll('.vista');
function mostrarVista(nombre) {
    vistas.forEach((v) => v.classList.toggle('oculta', v.dataset.vista !== nombre));
}
document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-ir]');
    if (link) {
        e.preventDefault();
        mostrarVista(link.dataset.ir);
    }
});

// ---------- Ver / ocultar contraseña (para todos los campos) ----------
const OJO = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>`;
const OJO_TACHADO = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.9 5.1A9.8 9.8 0 0 1 12 5c6.5 0 10 7 10 7a14 14 0 0 1-3 3.7M6.6 6.6A14 14 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 4.3-1M3 3l18 18"/></svg>`;
document.querySelectorAll('.ver-pass').forEach((boton) => {
    boton.innerHTML = OJO;
    boton.addEventListener('click', () => {
        const input = boton.parentElement.querySelector('input');
        const mostrar = input.type === 'password';
        input.type = mostrar ? 'text' : 'password';
        boton.innerHTML = mostrar ? OJO_TACHADO : OJO;
        boton.setAttribute('aria-label', mostrar ? 'Ocultar contraseña' : 'Mostrar contraseña');
    });
});

// ---------- Estado de carga de un botón ----------
function cargando(boton, texto) {
    boton.dataset.original = boton.textContent;
    boton.disabled = true;
    boton.textContent = texto;
}
function restaurar(boton) {
    boton.disabled = false;
    if (boton.dataset.original) boton.textContent = boton.dataset.original;
}

// ---------- Mensajes de error claros ----------
function mensajeError(codigo) {
    switch (codigo) {
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
        case 'auth/user-not-found':
            return "Correo o contraseña incorrectos.";
        case 'auth/email-already-in-use':
            return "Ese correo ya tiene una cuenta. Iniciá sesión.";
        case 'auth/weak-password':
            return "La contraseña debe tener al menos 6 caracteres.";
        case 'auth/invalid-email':
            return "El correo no es válido.";
        case 'auth/too-many-requests':
            return "Demasiados intentos. Esperá un momento e intentá de nuevo.";
        case 'auth/network-request-failed':
            return "Sin conexión. Revisá tu internet.";
        default:
            return "Ocurrió un error. Intentá de nuevo.";
    }
}

// ---------- INICIAR SESIÓN ----------
document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const boton = e.target.querySelector('button[type="submit"]');
    const correo = document.getElementById('login-correo').value.trim();
    const pass = document.getElementById('login-pass').value;

    cargando(boton, 'Ingresando...');
    try {
        await signInWithEmailAndPassword(auth, correo, pass);
        window.location.href = 'dashboard.html';
    } catch (error) {
        console.error("Error al iniciar sesión:", error.code);
        mostrarToast(mensajeError(error.code), 'error');
        restaurar(boton);
    }
});

// ---------- CREAR CUENTA ----------
document.getElementById('form-registro').addEventListener('submit', async (e) => {
    e.preventDefault();
    const boton = e.target.querySelector('button[type="submit"]');
    const correo = document.getElementById('reg-correo').value.trim();
    const pass = document.getElementById('reg-pass').value;
    const pass2 = document.getElementById('reg-pass2').value;

    if (pass.length < 6) {
        mostrarToast("La contraseña debe tener al menos 6 caracteres.", 'error');
        return;
    }
    if (pass !== pass2) {
        mostrarToast("Las contraseñas no coinciden.", 'error');
        return;
    }

    cargando(boton, 'Creando cuenta...');
    try {
        const cred = await createUserWithEmailAndPassword(auth, correo, pass);
        // Creamos el registro del usuario con su código de acceso (pendiente de aprobación)
        try {
            await setDoc(doc(db, 'usuarios', cred.user.uid), {
                email: cred.user.email, creado: Date.now(), codigo: generarCodigo(),
                estado: 'pendiente', tipo: 'free', formaPago: '', acceso: 'total', notas: ''
            });
        } catch (e2) { console.error('No se pudo crear el registro de usuario:', e2); }
        mostrarToast("¡Cuenta creada! Pedí tu código de acceso al administrador.", 'exito');
        setTimeout(() => { window.location.href = 'acceso.html'; }, 1000);
    } catch (error) {
        console.error("Error al registrar:", error.code);
        mostrarToast(mensajeError(error.code), 'error');
        restaurar(boton);
    }
});

// ---------- RECUPERAR CONTRASEÑA ----------
document.getElementById('form-recuperar').addEventListener('submit', async (e) => {
    e.preventDefault();
    const boton = e.target.querySelector('button[type="submit"]');
    const correo = document.getElementById('rec-correo').value.trim();

    cargando(boton, 'Enviando...');
    try {
        await sendPasswordResetEmail(auth, correo);
        mostrarToast("Te enviamos un correo para restablecer la contraseña. Revisá tu bandeja (y el spam).", 'exito');
        restaurar(boton);
        mostrarVista('login');
    } catch (error) {
        console.error("Error al enviar recuperación:", error.code);
        // Por seguridad, si el correo no existe igual mostramos un mensaje neutro
        if (error.code === 'auth/user-not-found') {
            mostrarToast("Si ese correo está registrado, te llegará el enlace.", 'info');
            restaurar(boton);
            mostrarVista('login');
        } else {
            mostrarToast(mensajeError(error.code), 'error');
            restaurar(boton);
        }
    }
});
