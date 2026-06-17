// Importamos la conexión que armaste en el otro archivo
import { auth } from './firebase-config.js';
import { mostrarToast } from './ui.js';
// Funciones de Firebase para iniciar sesión y para registrar
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const formularioLogin = document.getElementById('formulario-login');
const btnRegistro = document.getElementById('btn-registro');

// Mostrar / ocultar contraseña
const verPass = document.getElementById('ver-pass');
const inputPass = document.getElementById('contrasena');
const OJO = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>`;
const OJO_TACHADO = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.9 5.1A9.8 9.8 0 0 1 12 5c6.5 0 10 7 10 7a14 14 0 0 1-3 3.7M6.6 6.6A14 14 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 4.3-1M3 3l18 18"/></svg>`;
if (verPass && inputPass) {
    verPass.addEventListener('click', () => {
        const mostrar = inputPass.type === 'password';
        inputPass.type = mostrar ? 'text' : 'password';
        verPass.innerHTML = mostrar ? OJO_TACHADO : OJO;
        verPass.setAttribute('aria-label', mostrar ? 'Ocultar contraseña' : 'Mostrar contraseña');
    });
}

// Traduce los códigos de error de Firebase a mensajes claros
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
        default:
            return "Ocurrió un error. Intentá de nuevo.";
    }
}

// INICIAR SESIÓN
formularioLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    const correo = document.getElementById('correo').value;
    const contrasena = document.getElementById('contrasena').value;

    try {
        await signInWithEmailAndPassword(auth, correo, contrasena);
        window.location.href = 'dashboard.html';
    } catch (error) {
        console.error("Error de autenticación:", error.code);
        mostrarToast(mensajeError(error.code), 'error');
    }
});

// CREAR CUENTA (nuevo equipo)
btnRegistro.addEventListener('click', async (e) => {
    e.preventDefault();
    const correo = document.getElementById('correo').value;
    const contrasena = document.getElementById('contrasena').value;

    if (!correo || !contrasena) {
        mostrarToast("Completá el correo y una contraseña (mínimo 6 caracteres).", 'error');
        return;
    }

    try {
        await createUserWithEmailAndPassword(auth, correo, contrasena);
        // Recién creado: lo mandamos a configurar el equipo
        window.location.href = 'equipo.html';
    } catch (error) {
        console.error("Error al registrar:", error.code);
        mostrarToast(mensajeError(error.code), 'error');
    }
});