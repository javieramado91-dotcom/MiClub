// js/estadisticas.js
// 1) Resumen del plantel (totales).
// 2) Carga de eventos: botones +1 / -1 para goles, asistencias, amarillas y rojas.
// 3) Rankings ordenados por cada métrica + contribuciones (G+A).

import { db } from './firebase-config.js';
import { iniciarPagina, mostrarToast } from './ui.js';
import {
    collection, getDocs, doc, updateDoc, increment
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const resumenPlantel = document.getElementById('resumen-plantel');
const tablaCarga = document.getElementById('tabla-carga');
const contenedorRankings = document.getElementById('contenedor-rankings');

let usuarioActual = null;
let jugadores = []; // [{ id, nombre, goles, asistencias, amarillas, rojas, ... }]

// Métricas editables con botones +/- (el ORDEN debe coincidir con las columnas del HTML)
const METRICAS = [
    { campo: 'partidosJugados', etiqueta: 'PJ',        titulo: '📋 Partidos jugados' },
    { campo: 'goles',           etiqueta: 'Goles',     titulo: '⚽ Goleadores' },
    { campo: 'asistencias',     etiqueta: 'Asist.',    titulo: '🎯 Asistidores' },
    { campo: 'amarillas',       etiqueta: 'Amarillas', titulo: '🟨 Tarjetas Amarillas' },
    { campo: 'rojas',           etiqueta: 'Rojas',     titulo: '🟥 Tarjetas Rojas' }
];
// Para los rankings no incluimos "Partidos jugados"
const METRICAS_RANK = METRICAS.filter((m) => m.campo !== 'partidosJugados');

function refJugadores(uid) {
    return collection(db, "equipos", uid, "jugadores");
}

async function traerJugadores() {
    const snap = await getDocs(refJugadores(usuarioActual.uid));
    jugadores = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ---------- 1) Resumen del plantel ----------
function pintarResumen() {
    if (jugadores.length === 0) {
        resumenPlantel.innerHTML = `<p class="mensaje-vacio" style="grid-column:1/-1;">Cargá jugadores para ver el resumen.</p>`;
        return;
    }
    const total = (campo) => jugadores.reduce((a, j) => a + (j[campo] || 0), 0);
    const goles = total('goles'), asis = total('asistencias');

    const cajas = [
        { num: jugadores.length, lbl: 'Jugadores' },
        { num: goles, lbl: 'Goles', destacado: true },
        { num: asis, lbl: 'Asistencias' },
        { num: goles + asis, lbl: 'G+A', destacado: true },
        { num: total('amarillas'), lbl: 'Amarillas' },
        { num: total('rojas'), lbl: 'Rojas' }
    ];
    resumenPlantel.innerHTML = cajas.map((c) => `
        <div class="stat-box ${c.destacado ? 'destacado' : ''}">
            <span class="num">${c.num}</span><span class="lbl">${c.lbl}</span>
        </div>`).join('');
}

// ---------- 2) Tabla de carga con botones +/- (con buscador y filtro) ----------
const buscador = document.getElementById('buscador');
const filtroPosicion = document.getElementById('filtro-posicion');

// Devuelve los jugadores que cumplen el texto buscado y la posición elegida
function jugadoresFiltrados() {
    const texto = (buscador?.value || '').trim().toLowerCase();
    const pos = filtroPosicion?.value || '';
    return jugadores.filter((j) => {
        const coincideTexto = !texto || (j.nombre || '').toLowerCase().includes(texto);
        const coincidePos = !pos || j.posicion === pos;
        return coincideTexto && coincidePos;
    });
}

function pintarCarga() {
    const colspan = METRICAS.length + 1;

    if (jugadores.length === 0) {
        tablaCarga.innerHTML = `<tr><td colspan="${colspan}" class="mensaje-vacio">Cargá jugadores primero en la pestaña "Jugadores".</td></tr>`;
        return;
    }

    const lista = jugadoresFiltrados();
    if (lista.length === 0) {
        tablaCarga.innerHTML = `<tr><td colspan="${colspan}" class="mensaje-vacio">No se encontraron jugadores con esos filtros.</td></tr>`;
        return;
    }

    tablaCarga.innerHTML = '';
    lista.forEach((j) => {
        const fila = document.createElement('tr');
        const celdas = METRICAS.map(({ campo }) => `
            <td class="centro">
                <div class="acciones-stat">
                    <button class="btn-mini btn-menos" data-id="${j.id}" data-campo="${campo}" data-delta="-1">−</button>
                    <span class="valor">${j[campo] || 0}</span>
                    <button class="btn-mini btn-mas" data-id="${j.id}" data-campo="${campo}" data-delta="1">+</button>
                </div>
            </td>`).join('');
        const badge = j.posicion ? ` <span class="badge">${j.posicion}</span>` : '';
        fila.innerHTML = `<td>${j.nombre}${badge}</td>${celdas}`;
        tablaCarga.appendChild(fila);
    });
}

// Re-pintar al buscar o cambiar el filtro
buscador?.addEventListener('input', pintarCarga);
filtroPosicion?.addEventListener('change', pintarCarga);

tablaCarga.addEventListener('click', async (e) => {
    const boton = e.target.closest('.btn-mini');
    if (!boton) return;

    const { id, campo } = boton.dataset;
    const delta = Number(boton.dataset.delta);
    const jugador = jugadores.find((j) => j.id === id);
    const valorActual = jugador[campo] || 0;
    if (valorActual + delta < 0) return;

    try {
        await updateDoc(doc(db, "equipos", usuarioActual.uid, "jugadores", id), { [campo]: increment(delta) });
        jugador[campo] = valorActual + delta;
        pintarCarga();
        pintarResumen();
        pintarRankings();
    } catch (error) {
        console.error("Error al actualizar estadística:", error);
        mostrarToast("No se pudo actualizar.", 'error');
    }
});

// ---------- 3) Rankings ----------
// Dibuja una tabla de ranking a partir de una lista [{nombre, valor}] ya ordenada
function bloqueRanking(titulo, etiqueta, lista) {
    const filas = lista.length
        ? lista.map((j, i) => `
            <tr class="${i < 3 ? 'pos-' + (i + 1) : ''}">
                <td class="centro">${i + 1}°</td>
                <td>${j.nombre}</td>
                <td class="centro"><strong>${j.valor}</strong></td>
            </tr>`).join('')
        : `<tr><td colspan="3" class="mensaje-vacio">Sin registros.</td></tr>`;

    return `
        <div style="margin-bottom:28px;">
            <div class="fila-titulo"><h3>${titulo}</h3></div>
            <div class="tabla-scroll">
            <table class="tabla-datos">
                <thead><tr><th class="centro">#</th><th>Jugador</th><th class="centro">${etiqueta}</th></tr></thead>
                <tbody>${filas}</tbody>
            </table>
            </div>
        </div>`;
}

function rankingPorCampo(campo) {
    return [...jugadores]
        .filter((j) => (j[campo] || 0) > 0)
        .sort((a, b) => (b[campo] || 0) - (a[campo] || 0))
        .map((j) => ({ nombre: j.nombre, valor: j[campo] || 0 }));
}

function pintarRankings() {
    let html = '';

    // Contribuciones (G+A) primero, es la tabla "estrella"
    const contribuciones = [...jugadores]
        .map((j) => ({ nombre: j.nombre, valor: (j.goles || 0) + (j.asistencias || 0) }))
        .filter((j) => j.valor > 0)
        .sort((a, b) => b.valor - a.valor);
    html += bloqueRanking('🔥 Contribuciones (G+A)', 'G+A', contribuciones);

    // Rankings clásicos (sin partidos jugados)
    METRICAS_RANK.forEach(({ campo, titulo, etiqueta }) => {
        html += bloqueRanking(titulo, etiqueta, rankingPorCampo(campo));
    });

    contenedorRankings.innerHTML = html;
}

// ---------- Arranque ----------
iniciarPagina(async (user, datosEquipo) => {
    usuarioActual = user;
    if (datosEquipo) {
        document.getElementById('nombre-header').textContent = datosEquipo.nombre || "Mi Club";
        if (datosEquipo.escudo) document.getElementById('escudo-header').src = datosEquipo.escudo;
    }
    await traerJugadores();
    pintarResumen();
    pintarCarga();
    pintarRankings();
});
