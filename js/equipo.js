import { db, auth } from './firebase-config.js';
import { aplicarColores, mostrarToast, confirmar } from './ui.js';
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

// Campos de datos del club
const campos = ['nombre-equipo', 'apodo', 'fundacion', 'ciudad', 'estadio', 'dt', 'liga'];
const val = (id) => document.getElementById(id).value.trim();

let escudoBase64 = "";
let palmares = []; // [{ titulo, cantidad }]

// ---------- Comprimir escudo a máx. 512px ----------
function comprimirImagen(archivo, maxLado = 512) {
    return new Promise((resolve) => {
        const lector = new FileReader();
        lector.onload = () => {
            const img = new Image();
            img.onload = () => {
                let { width, height } = img;
                if (width > height && width > maxLado) {
                    height = Math.round(height * maxLado / width); width = maxLado;
                } else if (height > maxLado) {
                    width = Math.round(width * maxLado / height); height = maxLado;
                }
                const canvas = document.createElement('canvas');
                canvas.width = width; canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/png'));
            };
            img.src = lector.result;
        };
        lector.readAsDataURL(archivo);
    });
}

// ---------- Banner: vista previa en vivo del perfil del club ----------
function actualizarBanner() {
    document.getElementById('banner-nombre').textContent = val('nombre-equipo') || 'Mi Club';
    const apodo = val('apodo');
    document.getElementById('banner-apodo').textContent = apodo ? `"${apodo}"` : '';

    const chips = [];
    const fundacion = document.getElementById('fundacion').value;
    if (fundacion) chips.push(`📅 Fundado en ${new Date(fundacion + 'T00:00:00').getFullYear()}`);
    if (val('ciudad')) chips.push(`📍 ${val('ciudad')}`);
    if (val('estadio')) chips.push(`🏟️ ${val('estadio')}`);
    if (val('dt')) chips.push(`👔 DT: ${val('dt')}`);
    if (val('liga')) chips.push(`🏅 ${val('liga')}`);
    const totalTitulos = palmares.reduce((a, t) => a + (t.cantidad || 0), 0);
    if (totalTitulos > 0) chips.push(`🏆 ${totalTitulos} título${totalTitulos !== 1 ? 's' : ''}`);

    document.getElementById('banner-chips').innerHTML = chips.map((c) => `<span class="club-chip">${c}</span>`).join('');

    document.getElementById('banner-escudo').src = escudoBase64 || 'assets/escudo-default.svg';
    document.getElementById('escudo-header').src = escudoBase64 || 'assets/escudo-default.svg';
    document.getElementById('nombre-header').textContent = val('nombre-equipo') || 'Mi Club';
}

// Actualizar banner mientras se escribe
campos.forEach((id) => document.getElementById(id).addEventListener('input', actualizarBanner));

// ---------- Escudo ----------
inputEscudo.addEventListener('change', async (e) => {
    const archivo = e.target.files[0];
    if (!archivo) return;
    escudoBase64 = await comprimirImagen(archivo);
    vistaPrevia.innerHTML = `<img src="${escudoBase64}" style="width:100%;height:100%;object-fit:contain;">`;
    actualizarBanner();
});

// ---------- Colores en vivo ----------
color1.addEventListener('input', () => aplicarColores(color1.value, color2.value));
color2.addEventListener('input', () => aplicarColores(color1.value, color2.value));

// ---------- Palmarés ----------
function pintarPalmares() {
    const cont = document.getElementById('lista-palmares');
    if (palmares.length === 0) {
        cont.innerHTML = `<p class="mensaje-vacio">Todavía no cargaste títulos.</p>`;
        return;
    }
    cont.innerHTML = palmares.map((t, i) => `
        <div class="palmar-item">
            <span class="palmar-trofeo">🏆</span>
            <span class="palmar-nombre">${t.titulo}</span>
            <span class="palmar-cant">x${t.cantidad}</span>
            <button class="btn-borrar" data-i="${i}">Quitar</button>
        </div>
    `).join('');
}

async function guardarPalmares() {
    const user = auth.currentUser;
    if (!user) return;
    await setDoc(doc(db, "equipos", user.uid), { palmares }, { merge: true });
}

document.getElementById('form-titulo').addEventListener('submit', async (e) => {
    e.preventDefault();
    const titulo = document.getElementById('titulo-nombre').value.trim();
    const cantidad = Number(document.getElementById('titulo-cant').value);
    if (!titulo || cantidad < 1) return;

    palmares.push({ titulo, cantidad });
    pintarPalmares();
    actualizarBanner();
    e.target.reset();
    document.getElementById('titulo-cant').value = 1;

    try {
        await guardarPalmares();
        mostrarToast(`"${titulo}" agregado al palmarés`, 'exito');
    } catch (error) {
        console.error(error);
        mostrarToast("No se pudo guardar el título.", 'error');
    }
});

document.getElementById('lista-palmares').addEventListener('click', async (e) => {
    const boton = e.target.closest('.btn-borrar');
    if (!boton) return;
    const ok = await confirmar("¿Quitar este título del palmarés?", { textoOk: "Quitar", textoNo: "Cancelar" });
    if (!ok) return;

    palmares.splice(Number(boton.dataset.i), 1);
    pintarPalmares();
    actualizarBanner();
    try {
        await guardarPalmares();
        mostrarToast("Título quitado", 'info');
    } catch (error) {
        console.error(error);
        mostrarToast("No se pudo quitar.", 'error');
    }
});

// ---------- Cargar datos al entrar ----------
onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = 'index.html'; return; }

    const emailEl = document.getElementById('cuenta-email');
    if (emailEl) emailEl.textContent = user.email;

    const snap = await getDoc(doc(db, "equipos", user.uid));
    if (snap.exists()) {
        const d = snap.data();
        document.getElementById('nombre-equipo').value = d.nombre || "";
        document.getElementById('apodo').value = d.apodo || "";
        document.getElementById('fundacion').value = d.fundacion || "";
        document.getElementById('ciudad').value = d.ciudad || "";
        document.getElementById('estadio').value = d.estadio || "";
        document.getElementById('dt').value = d.dt || "";
        document.getElementById('liga').value = d.liga || "";
        color1.value = d.colorPrincipal || "#2c3e50";
        color2.value = d.colorSecundario || "#34495e";
        aplicarColores(color1.value, color2.value);
        palmares = Array.isArray(d.palmares) ? d.palmares : [];
        if (d.escudo) {
            escudoBase64 = d.escudo;
            vistaPrevia.innerHTML = `<img src="${d.escudo}" style="width:100%;height:100%;object-fit:contain;">`;
        }
    }
    pintarPalmares();
    actualizarBanner();
});

// ---------- Guardar datos del club ----------
formEquipo.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    const datos = {
        nombre: val('nombre-equipo'),
        apodo: val('apodo'),
        fundacion: document.getElementById('fundacion').value,
        ciudad: val('ciudad'),
        estadio: val('estadio'),
        dt: val('dt'),
        liga: val('liga'),
        colorPrincipal: color1.value,
        colorSecundario: color2.value,
        escudo: escudoBase64,
        uid: user.uid
    };

    try {
        await setDoc(doc(db, "equipos", user.uid), datos, { merge: true });
        mostrarToast("¡Datos del club guardados!", 'exito');
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

    if (nueva.length < 6) { mostrarToast("La nueva contraseña debe tener al menos 6 caracteres.", 'error'); return; }
    if (nueva !== nueva2) { mostrarToast("Las contraseñas nuevas no coinciden.", 'error'); return; }
    if (nueva === actual) { mostrarToast("La nueva contraseña debe ser distinta a la actual.", 'error'); return; }

    const boton = formPassword.querySelector('button[type="submit"]');
    boton.disabled = true;
    boton.textContent = 'Cambiando...';

    try {
        const credencial = EmailAuthProvider.credential(user.email, actual);
        await reauthenticateWithCredential(user, credencial);
        await updatePassword(user, nueva);
        formPassword.reset();
        mostrarToast("¡Contraseña actualizada con éxito!", 'exito');
    } catch (error) {
        console.error("Error al cambiar contraseña:", error.code);
        let msg = "No se pudo cambiar la contraseña.";
        if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') msg = "La contraseña actual es incorrecta.";
        else if (error.code === 'auth/weak-password') msg = "La nueva contraseña es muy débil (mínimo 6 caracteres).";
        else if (error.code === 'auth/too-many-requests') msg = "Demasiados intentos. Esperá un momento.";
        mostrarToast(msg, 'error');
    } finally {
        boton.disabled = false;
        boton.textContent = 'Cambiar contraseña';
    }
});
