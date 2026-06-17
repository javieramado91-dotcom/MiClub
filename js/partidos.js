// js/partidos.js
// Registro de partidos y campeonatos + estadísticas de campaña (estilo páginas deportivas).
// Cada partido se guarda en: equipos/{uid}/partidos/{id}

import { db } from './firebase-config.js';
import { iniciarPagina, mostrarToast, confirmar } from './ui.js';
import {
    collection, addDoc, getDocs, deleteDoc, doc, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const form = document.getElementById('form-partido');
const resumenCont = document.getElementById('resumen');
const rachaCont = document.getElementById('racha');
const porTorneoCont = document.getElementById('por-torneo');
const listaCont = document.getElementById('lista-partidos');
const datalistTorneos = document.getElementById('lista-torneos');

let usuarioActual = null;
let partidos = []; // [{ id, fecha, torneo, rival, condicion, gf, gc }]

function refPartidos(uid) {
    return collection(db, "equipos", uid, "partidos");
}

// Resultado de un partido desde el punto de vista del equipo
function resultado(p) {
    if (p.gf > p.gc) return 'v';
    if (p.gf < p.gc) return 'd';
    return 'e';
}
const ETIQUETA_RES = { v: 'V', e: 'E', d: 'D' };

// Calcula el récord (PJ, PG, PE, PP, GF, GC, PTS) de una lista de partidos
function calcularRecord(lista) {
    const r = { pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0 };
    lista.forEach((p) => {
        r.pj++;
        r.gf += p.gf; r.gc += p.gc;
        const res = resultado(p);
        if (res === 'v') r.pg++;
        else if (res === 'e') r.pe++;
        else r.pp++;
    });
    r.dif = r.gf - r.gc;
    r.pts = r.pg * 3 + r.pe;
    return r;
}

// ---------- Resumen / campaña ----------
function pintarResumen() {
    if (partidos.length === 0) {
        resumenCont.innerHTML = `<p class="mensaje-vacio" style="grid-column:1/-1;">Todavía no registraste partidos. ¡Cargá el primero abajo!</p>`;
        rachaCont.innerHTML = '';
        return;
    }

    const r = calcularRecord(partidos);
    const efectividad = Math.round((r.pts / (r.pj * 3)) * 100);
    const promGF = (r.gf / r.pj).toFixed(1);
    const promGC = (r.gc / r.pj).toFixed(1);
    const vallasInvictas = partidos.filter((p) => p.gc === 0).length;

    const cajas = [
        { num: r.pj, lbl: 'Jugados' },
        { num: r.pg, lbl: 'Ganados' },
        { num: r.pe, lbl: 'Empatados' },
        { num: r.pp, lbl: 'Perdidos' },
        { num: r.gf, lbl: 'Goles a favor' },
        { num: r.gc, lbl: 'Goles en contra' },
        { num: (r.dif > 0 ? '+' : '') + r.dif, lbl: 'Diferencia' },
        { num: r.pts, lbl: 'Puntos', destacado: true },
        { num: efectividad + '%', lbl: 'Efectividad', destacado: true },
        { num: promGF, lbl: 'Prom. GF' },
        { num: promGC, lbl: 'Prom. GC' },
        { num: vallasInvictas, lbl: 'Vallas invictas' }
    ];

    resumenCont.innerHTML = cajas.map((c) => `
        <div class="stat-box ${c.destacado ? 'destacado' : ''}">
            <span class="num">${c.num}</span>
            <span class="lbl">${c.lbl}</span>
        </div>
    `).join('');

    // Racha: últimos 5 partidos (más recientes primero)
    const ultimos = [...partidos].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 5);
    rachaCont.innerHTML = ultimos.map((p) => {
        const res = resultado(p);
        return `<span class="res-badge ${res}" title="${p.fecha} vs ${p.rival} (${p.gf}-${p.gc})">${ETIQUETA_RES[res]}</span>`;
    }).join('');
}

// ---------- Tabla por campeonato ----------
function pintarPorTorneo() {
    if (partidos.length === 0) {
        porTorneoCont.innerHTML = `<tr><td colspan="9" class="mensaje-vacio">Sin campeonatos todavía.</td></tr>`;
        return;
    }

    const torneos = {};
    partidos.forEach((p) => {
        const t = p.torneo || 'Sin nombre';
        (torneos[t] = torneos[t] || []).push(p);
    });

    porTorneoCont.innerHTML = Object.entries(torneos)
        .map(([nombre, lista]) => {
            const r = calcularRecord(lista);
            return `
                <tr>
                    <td><span class="torneo-chip">${nombre}</span></td>
                    <td>${r.pj}</td><td>${r.pg}</td><td>${r.pe}</td><td>${r.pp}</td>
                    <td>${r.gf}</td><td>${r.gc}</td><td>${(r.dif > 0 ? '+' : '') + r.dif}</td>
                    <td><strong>${r.pts}</strong></td>
                </tr>`;
        }).join('');
}

// ---------- Historial ----------
function pintarHistorial() {
    if (partidos.length === 0) {
        listaCont.innerHTML = `<tr><td colspan="5" class="mensaje-vacio">No hay partidos cargados.</td></tr>`;
        return;
    }

    const ordenados = [...partidos].sort((a, b) => b.fecha.localeCompare(a.fecha));
    listaCont.innerHTML = ordenados.map((p) => {
        const res = resultado(p);
        const fechaTxt = new Date(p.fecha + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const vs = p.condicion === 'Local' ? 'vs' : '@';
        return `
            <tr class="partido-fila">
                <td>${fechaTxt}</td>
                <td><span class="torneo-chip">${p.torneo}</span></td>
                <td>
                    <span class="partido-cond">${p.condicion}</span><br>
                    <span class="partido-rival">${vs} ${p.rival}</span>
                </td>
                <td class="centro">
                    <span class="res-badge ${res}">${ETIQUETA_RES[res]}</span>
                    <span class="partido-marcador">${p.gf} - ${p.gc}</span>
                </td>
                <td class="centro"><button class="btn-borrar" data-id="${p.id}">Eliminar</button></td>
            </tr>`;
    }).join('');
}

// Sugerencias de torneos ya usados
function pintarDatalist() {
    const nombres = [...new Set(partidos.map((p) => p.torneo).filter(Boolean))];
    datalistTorneos.innerHTML = nombres.map((n) => `<option value="${n}">`).join('');
}

function refrescarTodo() {
    pintarResumen();
    pintarPorTorneo();
    pintarHistorial();
    pintarDatalist();
}

// ---------- Cargar ----------
async function cargarPartidos() {
    const snap = await getDocs(query(refPartidos(usuarioActual.uid), orderBy("fecha", "desc")));
    partidos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    refrescarTodo();
}

// Guardar un partido nuevo
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nuevo = {
        fecha: document.getElementById('fecha').value,
        torneo: document.getElementById('torneo').value.trim(),
        condicion: document.getElementById('condicion').value,
        rival: document.getElementById('rival').value.trim(),
        gf: Number(document.getElementById('gf').value),
        gc: Number(document.getElementById('gc').value)
    };

    try {
        await addDoc(refPartidos(usuarioActual.uid), nuevo);
        form.reset();
        document.getElementById('gf').value = 0;
        document.getElementById('gc').value = 0;
        await cargarPartidos();
        mostrarToast(`Partido vs ${nuevo.rival} registrado`, 'exito');
    } catch (error) {
        console.error("Error al guardar partido:", error);
        mostrarToast("No se pudo guardar el partido.", 'error');
    }
});

// Eliminar partido
listaCont.addEventListener('click', async (e) => {
    const boton = e.target.closest('.btn-borrar');
    if (!boton) return;

    const ok = await confirmar("¿Eliminar este partido del historial?", { textoOk: "Eliminar", textoNo: "Cancelar" });
    if (!ok) return;

    try {
        await deleteDoc(doc(db, "equipos", usuarioActual.uid, "partidos", boton.dataset.id));
        await cargarPartidos();
        mostrarToast("Partido eliminado", 'info');
    } catch (error) {
        console.error("Error al eliminar:", error);
        mostrarToast("No se pudo eliminar.", 'error');
    }
});

// Arranque
iniciarPagina((user, datosEquipo) => {
    usuarioActual = user;
    if (datosEquipo) {
        document.getElementById('nombre-header').textContent = datosEquipo.nombre || "Mi Club";
        if (datosEquipo.escudo) document.getElementById('escudo-header').src = datosEquipo.escudo;
    }
    cargarPartidos();
});
