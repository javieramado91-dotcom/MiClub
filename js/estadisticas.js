// js/estadisticas.js
// 1) Carga de eventos: botones +1 / -1 para goles, asistencias, amarillas y rojas.
// 2) Rankings ordenados por cada métrica.
// 3) Exportación de cada tabla como historia de Instagram (JPG).

import { db } from './firebase-config.js';
import { iniciarPagina } from './ui.js';
import { armarHistoria, descargarComoJPG } from './exportar.js';
import {
    collection, getDocs, doc, updateDoc, increment
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const tablaCarga = document.getElementById('tabla-carga');
const contenedorRankings = document.getElementById('contenedor-rankings');
const historiaIG = document.getElementById('historia-ig');

let usuarioActual = null;
let equipoActual = null;
let jugadores = []; // [{ id, nombre, goles, asistencias, amarillas, rojas, ... }]

// Las 4 métricas que manejamos, con su etiqueta y título de historia
const METRICAS = [
    { campo: 'goles',       etiqueta: 'Goles',      titulo: 'Goleadores' },
    { campo: 'asistencias', etiqueta: 'Asist.',     titulo: 'Asistidores' },
    { campo: 'amarillas',   etiqueta: 'Amarillas',  titulo: 'Tarjetas Amarillas' },
    { campo: 'rojas',       etiqueta: 'Rojas',      titulo: 'Tarjetas Rojas' }
];

function refJugadores(uid) {
    return collection(db, "equipos", uid, "jugadores");
}

// Trae todos los jugadores del equipo
async function traerJugadores() {
    const snap = await getDocs(refJugadores(usuarioActual.uid));
    jugadores = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ---------- 1) Tabla de carga con botones +/- ----------
function pintarCarga() {
    if (jugadores.length === 0) {
        tablaCarga.innerHTML = `<tr><td colspan="5" class="mensaje-vacio">Cargá jugadores primero en la pestaña "Jugadores".</td></tr>`;
        return;
    }

    tablaCarga.innerHTML = '';
    jugadores.forEach((j) => {
        const fila = document.createElement('tr');
        const celdas = METRICAS.map(({ campo }) => `
            <td class="centro">
                <div class="acciones-stat">
                    <button class="btn-mini btn-menos" data-id="${j.id}" data-campo="${campo}" data-delta="-1">−</button>
                    <span class="valor">${j[campo] || 0}</span>
                    <button class="btn-mini btn-mas" data-id="${j.id}" data-campo="${campo}" data-delta="1">+</button>
                </div>
            </td>
        `).join('');
        fila.innerHTML = `<td>${j.nombre}</td>${celdas}`;
        tablaCarga.appendChild(fila);
    });
}

// Suma o resta una unidad a una métrica de un jugador
tablaCarga.addEventListener('click', async (e) => {
    const boton = e.target.closest('.btn-mini');
    if (!boton) return;

    const { id, campo } = boton.dataset;
    const delta = Number(boton.dataset.delta);
    const jugador = jugadores.find((j) => j.id === id);
    const valorActual = jugador[campo] || 0;

    // No permitimos valores negativos
    if (valorActual + delta < 0) return;

    try {
        await updateDoc(doc(db, "equipos", usuarioActual.uid, "jugadores", id), {
            [campo]: increment(delta)
        });
        jugador[campo] = valorActual + delta; // actualizamos en memoria
        pintarCarga();
        pintarRankings();
    } catch (error) {
        console.error("Error al actualizar estadística:", error);
        alert("No se pudo actualizar.");
    }
});

// ---------- 2) Rankings ----------
function rankingDe(campo) {
    return [...jugadores]
        .filter((j) => (j[campo] || 0) > 0)
        .sort((a, b) => (b[campo] || 0) - (a[campo] || 0))
        .map((j) => ({ nombre: j.nombre, valor: j[campo] || 0 }));
}

function pintarRankings() {
    contenedorRankings.innerHTML = '';

    METRICAS.forEach(({ campo, titulo, etiqueta }) => {
        const ranking = rankingDe(campo);

        const bloque = document.createElement('div');
        bloque.style.marginBottom = '28px';

        const filas = ranking.length
            ? ranking.map((j, i) => `
                <tr>
                    <td class="centro">${i + 1}°</td>
                    <td>${j.nombre}</td>
                    <td class="centro">${j.valor}</td>
                </tr>`).join('')
            : `<tr><td colspan="3" class="mensaje-vacio">Sin registros.</td></tr>`;

        bloque.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <h3 style="color:var(--color-principal);">${titulo}</h3>
                <button class="btn-secundario" data-exportar="${campo}">Exportar historia</button>
            </div>
            <table class="tabla-datos">
                <thead>
                    <tr><th class="centro">#</th><th>Jugador</th><th class="centro">${etiqueta}</th></tr>
                </thead>
                <tbody>${filas}</tbody>
            </table>
        `;
        contenedorRankings.appendChild(bloque);
    });
}

// ---------- 3) Exportar como historia de Instagram ----------
contenedorRankings.addEventListener('click', async (e) => {
    const boton = e.target.closest('[data-exportar]');
    if (!boton) return;

    const campo = boton.dataset.exportar;
    const metrica = METRICAS.find((m) => m.campo === campo);
    const ranking = rankingDe(campo).slice(0, 10); // top 10

    boton.disabled = true;
    boton.textContent = 'Generando...';

    armarHistoria(historiaIG, {
        titulo: metrica.titulo,
        equipo: equipoActual?.nombre || 'Mi Club',
        escudo: equipoActual?.escudo || '',
        ranking
    });

    try {
        await descargarComoJPG(historiaIG, `${metrica.titulo}-MiClub`);
    } catch (error) {
        console.error("Error al exportar:", error);
        alert("No se pudo generar la imagen.");
    } finally {
        boton.disabled = false;
        boton.textContent = 'Exportar historia';
    }
});

// ---------- Arranque ----------
iniciarPagina(async (user, datosEquipo) => {
    usuarioActual = user;
    equipoActual = datosEquipo;
    if (datosEquipo) {
        document.getElementById('nombre-header').textContent = datosEquipo.nombre || "Mi Club";
        if (datosEquipo.escudo) document.getElementById('escudo-header').src = datosEquipo.escudo;
    }
    await traerJugadores();
    pintarCarga();
    pintarRankings();
});
