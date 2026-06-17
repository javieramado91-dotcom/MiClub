// Importamos la conexión que armaste en el otro archivo
import { auth } from './firebase-config.js';
// Funciones de Firebase para iniciar sesión y para registrar
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const formularioLogin = document.getElementById('formulario-login');
const btnRegistro = document.getElementById('btn-registro');

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
        alert(mensajeError(error.code));
    }
});

// CREAR CUENTA (nuevo equipo)
btnRegistro.addEventListener('click', async (e) => {
    e.preventDefault();
    const correo = document.getElementById('correo').value;
    const contrasena = document.getElementById('contrasena').value;

    if (!correo || !contrasena) {
        alert("Completá el correo y una contraseña (mínimo 6 caracteres) para crear la cuenta.");
        return;
    }

    try {
        await createUserWithEmailAndPassword(auth, correo, contrasena);
        // Recién creado: lo mandamos a configurar el equipo
        window.location.href = 'equipo.html';
    } catch (error) {
        console.error("Error al registrar:", error.code);
        alert(mensajeError(error.code));
    }
});