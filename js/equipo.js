import { db, auth } from './firebase-config.js';
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const formEquipo = document.getElementById('form-equipo');
const inputEscudo = document.getElementById('input-escudo');
const vistaPrevia = document.getElementById('vista-previa');
let escudoBase64 = ""; // Acá guardaremos la imagen convertida

// 1. Lógica para previsualizar la imagen y convertirla a texto
inputEscudo.addEventListener('change', (e) => {
    const archivo = e.target.files[0];
    const lector = new FileReader();

    lector.onloadend = () => {
        escudoBase64 = lector.result; // Imagen convertida a texto
        vistaPrevia.innerHTML = `<img src="${escudoBase64}" style="width: 100%; height: 100%; object-fit: contain;">`;
    };

    if (archivo) {
        lector.readAsDataURL(archivo);
    }
});

// 2. Cargar datos existentes al entrar
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const docRef = doc(db, "equipos", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const datos = docSnap.data();
            document.getElementById('nombre-equipo').value = datos.nombre || "";
            document.getElementById('color-1').value = datos.colorPrincipal || "#2c3e50";
            document.getElementById('color-2').value = datos.colorSecundario || "#34495e";
            if (datos.escudo) {
                escudoBase64 = datos.escudo;
                vistaPrevia.innerHTML = `<img src="${datos.escudo}" style="width: 100%; height: 100%; object-fit: contain;">`;
            }
        }
    } else {
        window.location.href = 'index.html';
    }
});

// 3. Guardar todo (incluyendo el escudo)
formEquipo.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = auth.currentUser;

    if (user) {
        const datosEquipo = {
            nombre: document.getElementById('nombre-equipo').value,
            colorPrincipal: document.getElementById('color-1').value,
            colorSecundario: document.getElementById('color-2').value,
            escudo: escudoBase64, // ¡Ahora sí guardamos la imagen!
            uid: user.uid
        };

        try {
            await setDoc(doc(db, "equipos", user.uid), datosEquipo);
            alert("¡Equipo actualizado correctamente!");
            window.location.href = 'dashboard.html';
        } catch (error) {
            console.error("Error:", error);
            alert("Error al guardar.");
        }
    }
});
