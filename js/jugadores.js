// js/jugadores.js
// Alta, listado y baja de jugadores. Cada jugador se guarda dentro del equipo:
//   equipos/{uid}/jugadores/{idJugador}

import { db } from './firebase-config.js';
import { iniciarPagina, mostrarToast, confirmar } from './ui.js';
import {
    collection, addDoc, getDocs, deleteDoc, doc, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const form = document.getElementById('form-jugador');
const inputFecha = document.getElementById('fecha-nac');
const edadPreview = document.getElementById('edad-preview');
const lista = document.getElementById('lista-jugadores');

let usuarioActual = null;

// Calcula la edad a partir de la fecha de nacimiento
export function calcularEdad(fechaNac) {
    if (!fechaNac) return '';
    const hoy = new Date();
    const nac = new Date(fechaNac);
    let edad = hoy.getFullYear() - nac.getFullYear();
    const mes = hoy.getMonth() - nac.getMonth();
    if (mes < 0 || (mes === 0 && hoy.getDate() < nac.getDate())) {
        edad--;
    }
    return edad;
}

// Muestra la edad en vivo mientras el usuario elige la fecha
inputFecha.addEventListener('change', () => {
    const edad = calcularEdad(inputFecha.value);
    edadPreview.textContent = edad !== '' ? `Edad: ${edad} años` : '';
});

// Referencia a la subcolección de jugadores del equipo logueado
function refJugadores(uid) {
    return collection(db, "equipos", uid, "jugadores");
}

// Pinta la lista de jugadores en la tabla
async function cargarJugadores() {
    const consulta = query(refJugadores(usuarioActual.uid), orderBy("nombre"));
    const snap = await getDocs(consulta);

    if (snap.empty) {
        lista.innerHTML = `<tr><td colspan="4" class="mensaje-vacio">Todavía no cargaste jugadores.</td></tr>`;
        return;
    }

    lista.innerHTML = '';
    snap.forEach((documento) => {
        const j = documento.data();
        const fila = document.createElement('tr');
        fila.innerHTML = `
            <td>${j.nombre}</td>
            <td class="centro"><span class="badge">${calcularEdad(j.fechaNacimiento)} años</span></td>
            <td><span class="badge">${j.posicion}</span></td>
            <td class="centro">
                <button class="btn-borrar" data-id="${documento.id}">Eliminar</button>
            </td>
        `;
        lista.appendChild(fila);
    });
}

// Guardar un jugador nuevo
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nuevo = {
        nombre: document.getElementById('nombre').value.trim(),
        fechaNacimiento: inputFecha.value,
        posicion: document.getElementById('posicion').value,
        // Estadísticas: arrancan en cero y se editan en la pantalla de estadísticas
        goles: 0,
        asistencias: 0,
        amarillas: 0,
        rojas: 0
    };

    try {
        await addDoc(refJugadores(usuarioActual.uid), nuevo);
        form.reset();
        edadPreview.textContent = '';
        await cargarJugadores();
        mostrarToast(`${nuevo.nombre} se sumó al plantel`, 'exito');
    } catch (error) {
        console.error("Error al guardar jugador:", error);
        mostrarToast("No se pudo guardar el jugador.", 'error');
    }
});

// Eliminar un jugador (delegación de eventos sobre la tabla)
lista.addEventListener('click', async (e) => {
    const boton = e.target.closest('.btn-borrar');
    if (!boton) return;

    const ok = await confirmar("¿Seguro que querés eliminar este jugador?", {
        textoOk: "Eliminar", textoNo: "Cancelar"
    });
    if (!ok) return;

    try {
        await deleteDoc(doc(db, "equipos", usuarioActual.uid, "jugadores", boton.dataset.id));
        await cargarJugadores();
        mostrarToast("Jugador eliminado", 'info');
    } catch (error) {
        console.error("Error al eliminar:", error);
        mostrarToast("No se pudo eliminar.", 'error');
    }
});

// Arranque: protege la página, aplica tema y carga la lista
iniciarPagina((user, datosEquipo) => {
    usuarioActual = user;
    if (datosEquipo) {
        document.getElementById('nombre-header').textContent = datosEquipo.nombre || "Mi Club";
        if (datosEquipo.escudo) document.getElementById('escudo-header').src = datosEquipo.escudo;
    }
    cargarJugadores();
});
