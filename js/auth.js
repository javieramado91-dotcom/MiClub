// Importamos la conexión que armaste en el otro archivo
import { auth } from './firebase-config.js';
// Importamos la función de Firebase para iniciar sesión
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// Atrapamos el formulario del HTML
const formularioLogin = document.getElementById('formulario-login');

formularioLogin.addEventListener('submit', async (e) => {
    e.preventDefault(); // Evitamos que la página parpadee o se recargue
    
    // Capturamos los valores que escribiste
    const correo = document.getElementById('correo').value;
    const contrasena = document.getElementById('contrasena').value;

    try {
        // Intentamos iniciar sesión
        const userCredential = await signInWithEmailAndPassword(auth, correo, contrasena);
        const user = userCredential.user;
        
        console.log("¡Sesión iniciada con éxito!", user.email);
        
        // Si sale bien, lo mandamos al panel principal del club
        window.location.href = 'dashboard.html';
        
    } catch (error) {
        console.error("Error de autenticación:", error.code);
        alert("Error al iniciar sesión. Verificá que el correo y la contraseña sean correctos.");
    }
});