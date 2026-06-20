// js/partidos.js
// Partidos + Torneos (Liga / Eliminatoria) + Tabla de posiciones + exportación a historias.
// Firestore: equipos/{uid}/partidos/{id} y equipos/{uid}/torneos/{id}

import { db } from './firebase-config.js';
import { iniciarPagina, mostrarToast, confirmar } from './ui.js';
import { armarExportMarcador, armarExportStats, armarExportTablaPos, descargarComoJPG } from './exportar.js';
import {
    collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let usuarioActual = null;
let equipoActual = null;
let partidos = [];   // [{ id, fecha, torneoId, torneoNombre, fase, rival, condicion, gf, gc }]
let torneos = [];    // [{ id, nombre, tipo, fase, rivales:[{id,nombre,pg,pe,pp,gf,gc}] }]

const FASES = ['Fase de grupos', '32avos de final', '16avos de final', 'Octavos de final', 'Cuartos de final', 'Semifinal', 'Final', 'Campeón ⭐'];

const $ = (id) => document.getElementById(id);
const refPartidos = () => collection(db, "equipos", usuarioActual.uid, "partidos");
const refTorneos = () => collection(db, "equipos", usuarioActual.uid, "torneos");

// ---------- Cálculos ----------
function resultado(p) { return p.gf > p.gc ? 'v' : (p.gf < p.gc ? 'd' : 'e'); }
const ETIQUETA = { v: 'V', e: 'E', d: 'D' };

function record(lista) {
    const r = { pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0 };
    lista.forEach((p) => {
        r.pj++; r.gf += p.gf; r.gc += p.gc;
        const res = resultado(p);
        if (res === 'v') r.pg++; else if (res === 'e') r.pe++; else r.pp++;
    });
    r.dif = r.gf - r.gc;
    r.pts = r.pg * 3 + r.pe;
    return r;
}

function partidosDeTorneo(torneoId) {
    return partidos.filter((p) => p.torneoId === torneoId);
}

function fecha(p) {
    return new Date(p.fecha + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function hoyTexto() {
    return new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
}
function comun() {
    return { equipo: equipoActual?.nombre || 'Mi Club', escudo: equipoActual?.escudo || '', fecha: hoyTexto() };
}

// ================= CAMPAÑA (resumen + racha) =================
function pintarResumen() {
    const cont = $('resumen');
    const rachaCont = $('racha');
    if (partidos.length === 0) {
        cont.innerHTML = `<p class="mensaje-vacio" style="grid-column:1/-1;">Todavía no registraste partidos. ¡Cargá el primero abajo!</p>`;
        rachaCont.innerHTML = '';
        return;
    }
    const r = record(partidos);
    const ef = Math.round((r.pts / (r.pj * 3)) * 100);
    const cajas = [
        { num: r.pj, lbl: 'Jugados' }, { num: r.pg, lbl: 'Ganados' },
        { num: r.pe, lbl: 'Empatados' }, { num: r.pp, lbl: 'Perdidos' },
        { num: r.gf, lbl: 'Goles a favor' }, { num: r.gc, lbl: 'Goles en contra' },
        { num: r.pts, lbl: 'Puntos', destacado: true }, { num: ef + '%', lbl: 'Efectividad', destacado: true }
    ];
    cont.innerHTML = cajas.map((c) => `<div class="stat-box ${c.destacado ? 'destacado' : ''}"><span class="num">${c.num}</span><span class="lbl">${c.lbl}</span></div>`).join('');

    const ult = [...partidos].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 5);
    rachaCont.innerHTML = ult.map((p) => {
        const res = resultado(p);
        return `<span class="res-badge ${res}" title="${fecha(p)} vs ${p.rival} (${p.gf}-${p.gc})">${ETIQUETA[res]}</span>`;
    }).join('');
}

// ================= TORNEOS =================
function badgeTipo(tipo) {
    return tipo === 'eliminatoria'
        ? '<span class="torneo-tipo elim">🏆 Eliminatoria</span>'
        : '<span class="torneo-tipo liga">📊 Liga</span>';
}

function pintarTorneos() {
    const grid = $('torneos-grid');
    if (torneos.length === 0) {
        grid.innerHTML = `<p class="mensaje-vacio" style="grid-column:1/-1;">Todavía no creaste torneos.</p>`;
        return;
    }
    grid.innerHTML = torneos.map((t) => {
        const r = record(partidosDeTorneo(t.id));
        const faseSel = t.tipo === 'eliminatoria'
            ? `<select class="select-fase" data-fase-torneo="${t.id}">
                 <option value="">Elegí la fase...</option>
                 ${FASES.map((f) => `<option ${t.fase === f ? 'selected' : ''}>${f}</option>`).join('')}
               </select>`
            : '';
        return `
            <div class="torneo-card">
                <div class="torneo-card-top">
                    <div>
                        <div class="torneo-nombre">${t.nombre}</div>
                        ${badgeTipo(t.tipo)}
                    </div>
                    <button class="btn-icono" data-del-torneo="${t.id}" title="Eliminar torneo">🗑️</button>
                </div>
                ${faseSel}
                <div class="torneo-record">
                    <span><b>${r.pj}</b> PJ</span><span><b>${r.pg}</b> G</span>
                    <span><b>${r.pe}</b> E</span><span><b>${r.pp}</b> P</span>
                    <span class="tr-pts"><b>${r.pts}</b> pts</span>
                </div>
                <button class="btn-exp" data-exp-torneo="${t.id}">📲 Exportar</button>
            </div>`;
    }).join('');
}

// ================= SELECTS =================
function llenarSelects() {
    // Select del formulario de partido
    const sel = $('torneo-partido');
    const valActual = sel.value;
    sel.innerHTML = `<option value="">Amistoso (sin torneo)</option>` +
        torneos.map((t) => `<option value="${t.id}">${t.nombre}</option>`).join('');
    sel.value = valActual;

    // Select de la tabla de posiciones (solo ligas)
    const selPos = $('select-torneo-pos');
    const valPos = selPos.value;
    const ligas = torneos.filter((t) => t.tipo === 'liga');
    selPos.innerHTML = `<option value="">Elegí un torneo de liga...</option>` +
        ligas.map((t) => `<option value="${t.id}">${t.nombre}</option>`).join('');
    selPos.value = ligas.some((t) => t.id === valPos) ? valPos : '';
}

// ================= TABLA DE POSICIONES =================
function filasPosiciones(torneo) {
    const filas = [];
    // Nuestro equipo (calculado con nuestros partidos en ese torneo)
    const r = record(partidosDeTorneo(torneo.id));
    filas.push({ mio: true, nombre: equipoActual?.nombre || 'Mi equipo', ...r });
    // Rivales (cargados a mano)
    (torneo.rivales || []).forEach((rv) => {
        const pj = (rv.pg || 0) + (rv.pe || 0) + (rv.pp || 0);
        filas.push({
            id: rv.id, nombre: rv.nombre,
            pj, pg: rv.pg || 0, pe: rv.pe || 0, pp: rv.pp || 0,
            gf: rv.gf || 0, gc: rv.gc || 0, dif: (rv.gf || 0) - (rv.gc || 0),
            pts: (rv.pg || 0) * 3 + (rv.pe || 0)
        });
    });
    filas.sort((a, b) => b.pts - a.pts || b.dif - a.dif || b.gf - a.gf || a.nombre.localeCompare(b.nombre));
    return filas;
}

function pintarPosiciones() {
    const body = $('posiciones-body');
    const form = $('form-rival');
    const ley = $('rival-leyenda');
    const torneo = torneos.find((t) => t.id === $('select-torneo-pos').value);

    if (!torneo) {
        body.innerHTML = `<tr><td colspan="11" class="mensaje-vacio">Elegí un torneo de liga para ver su tabla.</td></tr>`;
        form.hidden = true; ley.hidden = true;
        return;
    }
    form.hidden = false; ley.hidden = false;

    const filas = filasPosiciones(torneo);
    body.innerHTML = filas.map((f, i) => {
        if (f.mio) {
            return `<tr class="pos-mio">
                <td>${i + 1}</td><td>${f.nombre} <span class="chip-mio">Mi equipo</span></td>
                <td>${f.pj}</td><td>${f.pg}</td><td>${f.pe}</td><td>${f.pp}</td>
                <td>${f.gf}</td><td>${f.gc}</td><td>${f.dif > 0 ? '+' : ''}${f.dif}</td><td><b>${f.pts}</b></td><td></td>
            </tr>`;
        }
        // Rivales: editables
        const inp = (campo, val) => `<input type="number" min="0" class="rival-inp" data-rival="${f.id}" data-campo="${campo}" value="${val}">`;
        return `<tr>
            <td>${i + 1}</td><td>${f.nombre}</td>
            <td>${f.pj}</td>
            <td>${inp('pg', f.pg)}</td><td>${inp('pe', f.pe)}</td><td>${inp('pp', f.pp)}</td>
            <td>${inp('gf', f.gf)}</td><td>${inp('gc', f.gc)}</td>
            <td>${f.dif > 0 ? '+' : ''}${f.dif}</td><td><b>${f.pts}</b></td>
            <td><button class="btn-icono" data-del-rival="${f.id}" title="Quitar">✕</button></td>
        </tr>`;
    }).join('');
}

async function guardarTorneo(torneo) {
    await updateDoc(doc(db, "equipos", usuarioActual.uid, "torneos", torneo.id), {
        fase: torneo.fase || '', rivales: torneo.rivales || []
    });
}

// ================= HISTORIAL + POR TORNEO =================
function pintarPorTorneo() {
    const cont = $('por-torneo');
    if (partidos.length === 0) {
        cont.innerHTML = `<tr><td colspan="9" class="mensaje-vacio">Sin campeonatos todavía.</td></tr>`;
        return;
    }
    const grupos = {};
    partidos.forEach((p) => {
        const t = p.torneoNombre || p.torneo || 'Amistosos';
        (grupos[t] = grupos[t] || []).push(p);
    });
    cont.innerHTML = Object.entries(grupos).map(([nombre, lista]) => {
        const r = record(lista);
        return `<tr>
            <td><span class="torneo-chip">${nombre}</span></td>
            <td>${r.pj}</td><td>${r.pg}</td><td>${r.pe}</td><td>${r.pp}</td>
            <td>${r.gf}</td><td>${r.gc}</td><td>${r.dif > 0 ? '+' : ''}${r.dif}</td><td><strong>${r.pts}</strong></td>
        </tr>`;
    }).join('');
}

function pintarHistorial() {
    const cont = $('lista-partidos');
    if (partidos.length === 0) {
        cont.innerHTML = `<tr><td colspan="5" class="mensaje-vacio">No hay partidos cargados.</td></tr>`;
        return;
    }
    const ord = [...partidos].sort((a, b) => b.fecha.localeCompare(a.fecha));
    cont.innerHTML = ord.map((p) => {
        const res = resultado(p);
        const vs = p.condicion === 'Local' ? 'vs' : '@';
        const torneoTxt = p.torneoNombre || p.torneo || 'Amistoso';
        const faseTxt = p.fase ? ` · ${p.fase}` : '';
        return `<tr class="partido-fila">
            <td>${fecha(p)}</td>
            <td><span class="torneo-chip">${torneoTxt}</span>${faseTxt ? `<div class="fase-mini">${p.fase}</div>` : ''}</td>
            <td><span class="partido-cond">${p.condicion}</span><br><span class="partido-rival">${vs} ${p.rival}</span></td>
            <td class="centro"><span class="res-badge ${res}">${ETIQUETA[res]}</span> <span class="partido-marcador">${p.gf} - ${p.gc}</span></td>
            <td class="centro"><button class="btn-borrar" data-id="${p.id}">Eliminar</button></td>
        </tr>`;
    }).join('');
}

function refrescar() {
    pintarResumen();
    pintarTorneos();
    llenarSelects();
    pintarPosiciones();
    pintarPorTorneo();
    pintarHistorial();
}

// ================= CARGA =================
async function cargarTodo() {
    const [snapP, snapT] = await Promise.all([
        getDocs(query(refPartidos(), orderBy("fecha", "desc"))),
        getDocs(refTorneos())
    ]);
    partidos = snapP.docs.map((d) => ({ id: d.id, ...d.data() }));
    torneos = snapT.docs.map((d) => ({ id: d.id, ...d.data() }));
    torneos.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
    refrescar();
}

// ================= EVENTOS =================
// Crear torneo
$('form-torneo').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = $('torneo-nombre').value.trim();
    const tipo = $('torneo-tipo').value;
    if (!nombre) return;
    try {
        await addDoc(refTorneos(), { nombre, tipo, fase: '', rivales: [] });
        e.target.reset();
        await cargarTodo();
        mostrarToast(`Torneo "${nombre}" creado`, 'exito');
    } catch (err) { console.error(err); mostrarToast("No se pudo crear el torneo.", 'error'); }
});

// Acciones sobre torneos (eliminar / cambiar fase / exportar)
$('torneos-grid').addEventListener('click', async (e) => {
    const del = e.target.closest('[data-del-torneo]');
    const exp = e.target.closest('[data-exp-torneo]');
    if (del) {
        const ok = await confirmar("¿Eliminar este torneo? (no borra los partidos)", { textoOk: "Eliminar", textoNo: "Cancelar" });
        if (!ok) return;
        try {
            await deleteDoc(doc(db, "equipos", usuarioActual.uid, "torneos", del.dataset.delTorneo));
            await cargarTodo();
            mostrarToast("Torneo eliminado", 'info');
        } catch (err) { console.error(err); mostrarToast("No se pudo eliminar.", 'error'); }
    } else if (exp) {
        exportarTorneo(exp.dataset.expTorneo, exp);
    }
});

// Cambiar fase de un torneo
$('torneos-grid').addEventListener('change', async (e) => {
    const sel = e.target.closest('[data-fase-torneo]');
    if (!sel) return;
    const torneo = torneos.find((t) => t.id === sel.dataset.faseTorneo);
    if (!torneo) return;
    torneo.fase = sel.value;
    try { await guardarTorneo(torneo); mostrarToast("Fase actualizada", 'exito'); }
    catch (err) { console.error(err); mostrarToast("No se pudo guardar la fase.", 'error'); }
});

// Mostrar/ocultar fase en el form de partido según el torneo elegido
$('torneo-partido').addEventListener('change', () => {
    const t = torneos.find((x) => x.id === $('torneo-partido').value);
    $('fase-wrap').hidden = !(t && t.tipo === 'eliminatoria');
});

// Cambiar torneo de la tabla de posiciones
$('select-torneo-pos').addEventListener('change', pintarPosiciones);

// Editar números de un rival
$('posiciones-body').addEventListener('change', async (e) => {
    const inp = e.target.closest('.rival-inp');
    if (!inp) return;
    const torneo = torneos.find((t) => t.id === $('select-torneo-pos').value);
    if (!torneo) return;
    const rival = (torneo.rivales || []).find((r) => r.id === inp.dataset.rival);
    if (!rival) return;
    rival[inp.dataset.campo] = Math.max(0, Number(inp.value) || 0);
    try { await guardarTorneo(torneo); pintarPosiciones(); }
    catch (err) { console.error(err); mostrarToast("No se pudo guardar.", 'error'); }
});

// Eliminar rival
$('posiciones-body').addEventListener('click', async (e) => {
    const del = e.target.closest('[data-del-rival]');
    if (!del) return;
    const torneo = torneos.find((t) => t.id === $('select-torneo-pos').value);
    if (!torneo) return;
    torneo.rivales = (torneo.rivales || []).filter((r) => r.id !== del.dataset.delRival);
    try { await guardarTorneo(torneo); pintarPosiciones(); mostrarToast("Rival quitado", 'info'); }
    catch (err) { console.error(err); mostrarToast("No se pudo quitar.", 'error'); }
});

// Agregar rival
$('form-rival').addEventListener('submit', async (e) => {
    e.preventDefault();
    const torneo = torneos.find((t) => t.id === $('select-torneo-pos').value);
    if (!torneo) return;
    const nombre = $('rival-nombre').value.trim();
    if (!nombre) return;
    const nuevo = {
        id: 'r' + Date.now(),
        nombre,
        pg: Number($('rival-pg').value) || 0,
        pe: Number($('rival-pe').value) || 0,
        pp: Number($('rival-pp').value) || 0,
        gf: Number($('rival-gf').value) || 0,
        gc: Number($('rival-gc').value) || 0
    };
    torneo.rivales = [...(torneo.rivales || []), nuevo];
    try {
        await guardarTorneo(torneo);
        e.target.reset();
        ['rival-pg', 'rival-pe', 'rival-pp', 'rival-gf', 'rival-gc'].forEach((id) => $(id).value = 0);
        pintarPosiciones();
        mostrarToast(`${nombre} agregado a la tabla`, 'exito');
    } catch (err) { console.error(err); mostrarToast("No se pudo agregar.", 'error'); }
});

// Guardar partido
$('form-partido').addEventListener('submit', async (e) => {
    e.preventDefault();
    const torneo = torneos.find((t) => t.id === $('torneo-partido').value);
    const nuevo = {
        fecha: $('fecha').value,
        torneoId: torneo ? torneo.id : '',
        torneoNombre: torneo ? torneo.nombre : '',
        fase: (torneo && torneo.tipo === 'eliminatoria') ? $('fase-partido').value : '',
        condicion: $('condicion').value,
        rival: $('rival').value.trim(),
        gf: Number($('gf').value),
        gc: Number($('gc').value)
    };
    try {
        await addDoc(refPartidos(), nuevo);
        e.target.reset();
        $('gf').value = 0; $('gc').value = 0; $('fase-wrap').hidden = true;
        await cargarTodo();
        mostrarToast(`Partido vs ${nuevo.rival} registrado`, 'exito');
    } catch (err) { console.error(err); mostrarToast("No se pudo guardar el partido.", 'error'); }
});

// Eliminar partido
$('lista-partidos').addEventListener('click', async (e) => {
    const boton = e.target.closest('.btn-borrar');
    if (!boton) return;
    const ok = await confirmar("¿Eliminar este partido del historial?", { textoOk: "Eliminar", textoNo: "Cancelar" });
    if (!ok) return;
    try {
        await deleteDoc(doc(db, "equipos", usuarioActual.uid, "partidos", boton.dataset.id));
        await cargarTodo();
        mostrarToast("Partido eliminado", 'info');
    } catch (err) { console.error(err); mostrarToast("No se pudo eliminar.", 'error'); }
});

// ================= EXPORTACIONES =================
async function exportar(armar, archivo, boton) {
    boton.disabled = true; const txt = boton.textContent; boton.textContent = 'Generando...';
    try {
        armar();
        await descargarComoJPG($('export-stats'), `${archivo}-${equipoActual?.nombre || 'MiClub'}`);
        mostrarToast("¡Historia descargada!", 'exito');
    } catch (err) { console.error(err); mostrarToast("No se pudo generar la imagen.", 'error'); }
    finally { boton.disabled = false; boton.textContent = txt; }
}

// Botones de la campaña (último / campaña / racha)
document.querySelector('.export-botones').addEventListener('click', (e) => {
    const boton = e.target.closest('[data-exp]');
    if (!boton) return;
    if (partidos.length === 0) { mostrarToast("Registrá partidos primero.", 'error'); return; }
    const tipo = boton.dataset.exp;
    const cont = $('export-stats');
    const r = record(partidos);

    if (tipo === 'ultimo') {
        const u = [...partidos].sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
        const res = resultado(u);
        const et = { v: 'Victoria', e: 'Empate', d: 'Derrota' }[res];
        const vs = u.condicion === 'Local' ? 'vs' : '@';
        exportar(() => armarExportMarcador(cont, {
            ...comun(), titulo: 'Último resultado', rival: `${vs} ${u.rival}`, gf: u.gf, gc: u.gc,
            etiqueta: et, sub: `${u.torneoNombre || u.torneo || 'Amistoso'}${u.fase ? ' · ' + u.fase : ''} · ${fecha(u)}`
        }), 'UltimoResultado', boton);
    } else if (tipo === 'campania') {
        const ef = Math.round((r.pts / (r.pj * 3)) * 100);
        exportar(() => armarExportStats(cont, {
            ...comun(), titulo: 'Nuestra campaña',
            cajas: [
                { num: r.pts, lbl: 'Puntos', destacado: true }, { num: ef + '%', lbl: 'Efectividad', destacado: true },
                { num: r.pg, lbl: 'Ganados' }, { num: r.pe, lbl: 'Empatados' },
                { num: r.pp, lbl: 'Perdidos' }, { num: (r.dif > 0 ? '+' : '') + r.dif, lbl: 'Dif. de gol' }
            ]
        }), 'Campania', boton);
    } else if (tipo === 'racha') {
        const ult = [...partidos].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 5).reverse().map(resultado);
        exportar(() => armarExportStats(cont, {
            ...comun(), titulo: 'Nuestra racha',
            cajas: [{ num: r.pg, lbl: 'Ganados' }, { num: r.pj, lbl: 'Jugados' }],
            racha: ult, nota: 'Últimos partidos (más reciente a la derecha)'
        }), 'Racha', boton);
    }
});

// Exportar tabla de posiciones
$('exp-posiciones').addEventListener('click', (e) => {
    const torneo = torneos.find((t) => t.id === $('select-torneo-pos').value);
    if (!torneo) { mostrarToast("Elegí un torneo de liga.", 'error'); return; }
    exportar(() => armarExportTablaPos($('export-stats'), {
        ...comun(), titulo: torneo.nombre, filas: filasPosiciones(torneo)
    }), `Posiciones-${torneo.nombre}`, e.currentTarget);
});

// Exportar un torneo (desde su tarjeta)
function exportarTorneo(torneoId, boton) {
    const torneo = torneos.find((t) => t.id === torneoId);
    if (!torneo) return;
    const cont = $('export-stats');
    if (torneo.tipo === 'liga') {
        exportar(() => armarExportTablaPos(cont, { ...comun(), titulo: torneo.nombre, filas: filasPosiciones(torneo) }), `Posiciones-${torneo.nombre}`, boton);
    } else {
        const r = record(partidosDeTorneo(torneoId));
        exportar(() => armarExportStats(cont, {
            ...comun(), titulo: torneo.nombre,
            cajas: [
                { num: r.pj, lbl: 'Jugados' }, { num: r.pg, lbl: 'Ganados' },
                { num: r.pe, lbl: 'Empatados' }, { num: r.pp, lbl: 'Perdidos' }
            ],
            nota: torneo.fase ? `Fase actual: ${torneo.fase}` : ''
        }), `Torneo-${torneo.nombre}`, boton);
    }
}

// ================= ARRANQUE =================
iniciarPagina((user, datosEquipo) => {
    usuarioActual = user;
    equipoActual = datosEquipo;
    if (datosEquipo) {
        $('nombre-header').textContent = datosEquipo.nombre || "Mi Club";
        if (datosEquipo.escudo) $('escudo-header').src = datosEquipo.escudo;
    }
    cargarTodo();
});
