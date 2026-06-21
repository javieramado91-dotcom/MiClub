// js/acceso.js — Pantalla de acceso: ingreso de código / estado de la cuenta
import { auth, db } from './firebase-config.js';
import { mostrarToast, ADMIN_EMAIL, asegurarUsuario } from './ui.js';
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const $ = (id) => document.getElementById(id);
let refUsuario = null;

onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = 'index.html'; return; }
    if ((user.email || '').toLowerCase() === ADMIN_EMAIL) { window.location.href = 'admin.html'; return; }

    $('acceso-email').textContent = `Sesión: ${user.email}`;
    refUsuario = doc(db, 'usuarios', user.uid);

    let u;
    try { u = await asegurarUsuario(user); } catch (e) { console.error(e); u = null; }

    if (!u) { $('vista-codigo').hidden = false; return; }
    if (u.estado === 'activo') { window.location.href = 'dashboard.html'; return; }
    if (u.estado === 'denegado') { $('vista-denegado').hidden = false; return; }
    $('vista-codigo').hidden = false; // pendiente
});

$('form-codigo').addEventListener('submit', async (e) => {
    e.preventDefault();
    const codigo = $('codigo').value.trim();
    const boton = e.target.querySelector('button[type="submit"]');
    boton.disabled = true; boton.textContent = 'Verificando...';
    try {
        // La regla de Firestore valida que el código coincida; si no, falla
        await updateDoc(refUsuario, { codigoIngresado: codigo, estado: 'activo' });
        mostrarToast("¡Acceso habilitado!", 'exito');
        setTimeout(() => { window.location.href = 'dashboard.html'; }, 700);
    } catch (err) {
        console.error(err);
        mostrarToast("Código incorrecto. Verificá con el administrador.", 'error');
        boton.disabled = false; boton.textContent = 'Ingresar';
    }
});
