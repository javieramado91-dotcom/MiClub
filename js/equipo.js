import { db, auth } from './firebase-config.js';
import { aplicarColores, mostrarToast } from './ui.js';
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

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
