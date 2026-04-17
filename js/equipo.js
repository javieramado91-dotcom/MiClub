import { db, auth } from './firebase-config.js';
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const formEquipo = document.getElementById('form-equipo');

// Verificar que el usuario esté logueado para cargar sus datos
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const docRef = doc(db, "equipos", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const datos = docSnap.data();
            document.getElementById('nombre-equipo').value = datos.nombre || "";
            document.getElementById('color-1').value = datos.colorPrincipal || "#2c3e50";
            document.getElementById('color-2').value = datos.colorSecundario || "#34495e";
            // Aquí cargaríamos el escudo también
        }
    } else {
        window.location.href = 'index.html';
    }
});

formEquipo.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = auth.currentUser;

    if (user) {
        const datosEquipo = {
            nombre: document.getElementById('nombre-equipo').value,
            colorPrincipal: document.getElementById('color-1').value,
            colorSecundario: document.getElementById('color-2').value,
            uid: user.uid
        };

        try {
            await setDoc(doc(db, "equipos", user.uid), datosEquipo);
            alert("¡Datos guardados con éxito!");
            window.location.href = 'dashboard.html';
        } catch (error) {
            console.error("Error al guardar:", error);
            alert("No se pudieron guardar los datos.");
        }
    }
});