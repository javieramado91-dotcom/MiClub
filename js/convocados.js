// js/convocados.js
// Arma una lista de convocados eligiendo jugadores por puesto y la exporta
// como imagen para historia (9:16) o feed (4:5).

import { db } from './firebase-config.js';
import { iniciarPagina, mostrarToast } from './ui.js';
import { descargarComoJPG } from './exportar.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const $ = (id) => document.getElementById(id);

// Puestos en orden, con su rótulo e ícono
const POSICIONES = [
    { key: 'Arquero', label: 'Arqueros', ico: '🧤' },
    { key: 'Defensor', label: 'Defensores', ico: '🛡️' },
    { key: 'Mediocampista', label: 'Mediocampistas', ico: '⚙️' },
    { key: 'Delantero', label: 'Delanteros', ico: '⚡' },
    { key: '', label: 'Otros', ico: '👤' }
];

let equipoActual = null;
let jugadores = [];
const seleccion = new Set();   // ids elegidos

// ---------- Selección de jugadores ----------
function actualizarContador() {
    const cant = Number($('conv-cantidad').value) || 0;
    const cont = $('conv-contador');
    cont.textContent = `${seleccion.size} / ${cant}`;
    cont.classList.toggle('completo', cant > 0 && seleccion.size >= cant);
}

function pintarSeleccion() {
    const cont = $('conv-seleccion');
    if (jugadores.length === 0) {
        cont.innerHTML = `<p class="mensaje-vacio">No tenés jugadores cargados. Agregalos en la pestaña Jugadores.</p>`;
        return;
    }
    const texto = ($('conv-buscar').value || '').trim().toLowerCase();
    let html = '';
    POSICIONES.forEach((pos) => {
        const lista = jugadores.filter((j) => (j.posicion || '') === pos.key
            && (!texto || (j.nombre || '').toLowerCase().includes(texto)));
        if (!lista.length) return;
        html += `<div class="sel-grupo"><div class="sel-grupo-tit">${pos.ico} ${pos.label}</div><div class="sel-jugadores">`;
        html += lista.map((j) => `
            <label class="sel-jug ${seleccion.has(j.id) ? 'activo' : ''}">
                <input type="checkbox" data-id="${j.id}" ${seleccion.has(j.id) ? 'checked' : ''}>
                <span>${j.nombre}</span>
            </label>`).join('');
        html += `</div></div>`;
    });
    cont.innerHTML = html || `<p class="mensaje-vacio">No se encontraron jugadores.</p>`;
}

// ---------- Construir la imagen de convocatoria ----------
function armarConvocatoria(cont) {
    const equipo = equipoActual?.nombre || 'Mi Club';
    const escudo = equipoActual?.escudo || 'assets/escudo-default.svg';
    const torneo = $('conv-torneo').value.trim();
    const fecha = $('conv-fecha').value.trim();
    const dt = $('conv-dt').value.trim();

    const elegidos = jugadores.filter((j) => seleccion.has(j.id));
    // Tamaño de fuente según cuántos convocados haya
    const n = elegidos.length;
    const fs = n <= 14 ? 34 : n <= 20 ? 30 : n <= 26 ? 26 : 22;

    let grupos = '';
    POSICIONES.forEach((pos) => {
        const lista = elegidos.filter((j) => (j.posicion || '') === pos.key);
        if (!lista.length) return;
        grupos += `<div class="conv-grupo">
            <div class="conv-grupo-tit">${pos.ico} ${pos.label}</div>
            ${lista.map((j) => `<div class="conv-jug">${j.nombre}</div>`).join('')}
        </div>`;
    });

    cont.innerHTML = `
        <div class="conv-head">
            <img class="conv-escudo" src="${escudo}" alt="escudo">
            <div class="conv-club">${equipo}</div>
        </div>
        <div class="conv-titulo">Lista de Convocados</div>
        <div class="conv-sub">${torneo || 'Partido'}${fecha ? ' · ' + fecha : ''}</div>
        <div class="conv-lista" style="font-size:${fs}px;">${grupos || '<div class="conv-jug">Sin convocados</div>'}</div>
        ${dt ? `<div class="conv-dt"><span>DT</span> ${dt}</div>` : ''}
        <div class="conv-foot"><span>${equipo}</span><span class="conv-ja">JA</span></div>
    `;
}

async function exportar(ratio, boton) {
    if (seleccion.size === 0) { mostrarToast("Elegí al menos un jugador para la lista.", 'error'); return; }
    const cont = $('export-conv');
    cont.className = 'export-conv ' + (ratio === 'historia' ? 'r916' : 'r45');
    armarConvocatoria(cont);

    const [w, h] = ratio === 'historia' ? [1080, 1920] : [1080, 1350];
    const txt = boton.textContent;
    boton.disabled = true; boton.textContent = 'Generando...';
    try {
        await descargarComoJPG(cont, `Convocados-${equipoActual?.nombre || 'MiClub'}`, w, h);
        mostrarToast("¡Lista descargada!", 'exito');
    } catch (err) { console.error(err); mostrarToast("No se pudo generar la imagen.", 'error'); }
    finally { boton.disabled = false; boton.textContent = txt; }
}

// ---------- Eventos ----------
$('conv-seleccion').addEventListener('change', (e) => {
    const chk = e.target.closest('input[type="checkbox"]');
    if (!chk) return;
    if (chk.checked) seleccion.add(chk.dataset.id); else seleccion.delete(chk.dataset.id);
    chk.closest('.sel-jug')?.classList.toggle('activo', chk.checked);
    actualizarContador();
});
$('conv-buscar').addEventListener('input', pintarSeleccion);
$('conv-cantidad').addEventListener('input', actualizarContador);
$('exp-historia').addEventListener('click', (e) => exportar('historia', e.currentTarget));
$('exp-feed').addEventListener('click', (e) => exportar('feed', e.currentTarget));

// ---------- Arranque ----------
iniciarPagina(async (user, datosEquipo) => {
    equipoActual = datosEquipo;
    if (datosEquipo) {
        $('nombre-header').textContent = datosEquipo.nombre || "Mi Club";
        if (datosEquipo.escudo) $('escudo-header').src = datosEquipo.escudo;
        if (datosEquipo.dt) $('conv-dt').value = datosEquipo.dt;
    }

    // Torneos para el datalist
    try {
        const snapT = await getDocs(collection(db, "equipos", user.uid, "torneos"));
        const nombres = snapT.docs.map((d) => d.data().nombre).filter(Boolean);
        $('lista-torneos').innerHTML = nombres.map((n) => `<option value="${n}">`).join('');
    } catch (err) { console.error(err); }

    // Jugadores
    try {
        const snapJ = await getDocs(collection(db, "equipos", user.uid, "jugadores"));
        jugadores = snapJ.docs.map((d) => ({ id: d.id, ...d.data() }));
        jugadores.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
    } catch (err) { console.error(err); }

    // DT datalist: el DT del club + los nombres de jugadores
    const dts = [];
    if (datosEquipo?.dt) dts.push(datosEquipo.dt);
    jugadores.forEach((j) => dts.push(j.nombre));
    $('lista-dt').innerHTML = [...new Set(dts)].map((n) => `<option value="${n}">`).join('');

    pintarSeleccion();
    actualizarContador();
});
