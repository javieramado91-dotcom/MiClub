import { db, auth } from './firebase-config.js';
import { aplicarColores, mostrarToast } from './ui.js';
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import {
    onAuthStateChanged, updatePassword,
    EmailAuthProvider, reauthenticateWithCredential
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const formEquipo = document.getElementById('form-equipo');
const inputEscudo = document.getElementById('input-escudo');
const vistaPrevia = document.getElementById('vista-previa');
const color1 = document.getElementById('color-1');
const color2 = document.getElementById('color-2');
let escudoBase64 = ""; // Acá guardaremos la imagen convertida

// Redimensiona la imagen a máx. 512px y la devuelve como texto (base64).
// Así el escudo pesa poco y entra cómodo en el documento de Firestore.
function comprimirImagen(archivo, maxLado = 512) {
    return new Promise((resolve) => {
        const lector = new FileReader();
        lector.onload = () => {
            const img = new Image();
            img.onload = () => {
                let { width, height } = img;
                if (width > height && width > maxLado) {
                    height = Math.round(height * maxLado / width);
                    width = maxLado;
                } else if (height > maxLado) {
                    width = Math.round(width * maxLado / height);
                    height = maxLado;
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/png'));
            };
            img.src = lector.result;
        };
        lector.readAsDataURL(archivo);
    });
}

// 1. Previsualizar y comprimir el escudo al elegir el archivo
inputEscudo.addEventListener('change', async (e) => {
    const archivo = e.target.files[0];
    if (!archivo) return;
    escudoBase64 = await comprimirImagen(archivo);
    vistaPrevia.innerHTML = `<img src="${escudoBase64}" style="width: 100%; height: 100%; object-fit: contain;">`;
});

// Vista previa de colores EN VIVO mientras el usuario los elige
color1.addEventListener('input', () => aplicarColores(color1.value, color2.value));
color2.addEventListener('input', () => aplicarColores(color1.value, color2.value));

// 2. Cargar datos existentes al entrar (y aplicar su tema)
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    // Mostrar el correo de la cuenta
    const emailEl = document.getElementById('cuenta-email');
    if (emailEl) emailEl.textContent = user.email;

    const docSnap = await getDoc(doc(db, "equipos", user.uid));
    if (docSnap.exists()) {
        const datos = docSnap.data();
        document.getElementById('nombre-equipo').value = datos.nombre || "";
        document.getElementById('nombre-header').textContent = datos.nombre || "Mi Club";
        if (datos.escudo) document.getElementById('escudo-header').src = datos.escudo;
        color1.value = datos.colorPrincipal || "#2c3e50";
        color2.value = datos.colorSecundario || "#34495e";
        aplicarColores(color1.value, color2.value);
        if (datos.escudo) {
            escudoBase64 = datos.escudo;
            vistaPrevia.innerHTML = `<img src="${datos.escudo}" style="width: 100%; height: 100%; object-fit: contain;">`;
        }
    }
});

// 3. Guardar todo
formEquipo.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    const datosEquipo = {
        nombre: document.getElementById('nombre-equipo').value,
        colorPrincipal: color1.value,
        colorSecundario: color2.value,
        escudo: escudoBase64,
        uid: user.uid
    };

    try {
        await setDoc(doc(db, "equipos", user.uid), datosEquipo, { merge: true });
        mostrarToast("¡Equipo actualizado!", 'exito');
        setTimeout(() => { window.location.href = 'dashboard.html'; }, 900);
    } catch (error) {
        console.error("Error:", error);
        mostrarToast("No se pudo guardar.", 'error');
    }
});

// ---------- Ver / ocultar contraseña ----------
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

// ---------- Cambiar contraseña (con reautenticación) ----------
const formPassword = document.getElementById('form-password');
formPassword.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    const actual = document.getElementById('pass-actual').value;
    const nueva = document.getElementById('pass-nueva').value;
    const nueva2 = document.getElementById('pass-nueva2').value;

    if (nueva.length < 6) {
        mostrarToast("La nueva contraseña debe tener al menos 6 caracteres.", 'error');
        return;
    }
    if (nueva !== nueva2) {
        mostrarToast("Las contraseñas nuevas no coinciden.", 'error');
        return;
    }
    if (nueva === actual) {
        mostrarToast("La nueva contraseña debe ser distinta a la actual.", 'error');
        return;
    }

    const boton = formPassword.querySelector('button[type="submit"]');
    boton.disabled = true;
    boton.textContent = 'Cambiando...';

    try {
        // Reautenticamos para que Firebase permita el cambio
        const credencial = EmailAuthProvider.credential(user.email, actual);
        await reauthenticateWithCredential(user, credencial);
        await updatePassword(user, nueva);
        formPassword.reset();
        mostrarToast("¡Contraseña actualizada con éxito!", 'exito');
    } catch (error) {
        console.error("Error al cambiar contraseña:", error.code);
        let msg = "No se pudo cambiar la contraseña.";
        if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
            msg = "La contraseña actual es incorrecta.";
        } else if (error.code === 'auth/weak-password') {
            msg = "La nueva contraseña es muy débil (mínimo 6 caracteres).";
        } else if (error.code === 'auth/too-many-requests') {
            msg = "Demasiados intentos. Esperá un momento.";
        }
        mostrarToast(msg, 'error');
    } finally {
        boton.disabled = false;
        boton.textContent = 'Cambiar contraseña';
    }
});
