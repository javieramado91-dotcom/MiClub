// js/dashboard.js
// Panel principal estilo "muro de novedades":
//  - Protege la sesión y aplica el tema del equipo
//  - Calcula KPIs (jugadores, goles, asistencias, tarjetas) con contadores animados
//  - Genera un feed de novedades a partir de los datos reales del equipo

import { db } from './firebase-config.js';
import { iniciarPagina, mostrarToast } from './ui.js';
import { armarExportEstadisticas, armarExportRanking, armarExportPremio, descargarComoJPG } from './exportar.js';
import { collection, getDocs, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let cumpleHoy = null; // jugador que cumple años hoy (para exportar el saludo)

// ---------- Utilidades ----------
function calcularEdad(fechaNac) {
    if (!fechaNac) return null;
    const hoy = new Date();
    const nac = new Date(fechaNac + 'T00:00:00');
    let edad = hoy.getFullYear() - nac.getFullYear();
    const mes = hoy.getMonth() - nac.getMonth();
    if (mes < 0 || (mes === 0 && hoy.getDate() < nac.getDate())) edad--;
    return edad;
}

// Contador animado de 0 al valor final
function animarContador(el, destino, duracion = 900) {
    const inicio = performance.now();
    function paso(t) {
        const p = Math.min((t - inicio) / duracion, 1);
        const eased = 1 - Math.pow(1 - p, 3); // suaviza el final
        el.textContent = Math.round(destino * eased);
        if (p < 1) requestAnimationFrame(paso);
    }
    requestAnimationFrame(paso);
}

// Actualiza un KPI: lo anima la primera vez, después lo cambia directo
function setKPI(id, valor, animar) {
    const el = document.getElementById(id);
    if (!el) return;
    if (animar) animarContador(el, valor);
    else el.textContent = valor;
}

// Saludo según la hora del día
function saludoHora() {
    const h = new Date().getHours();
    if (h < 6) return "Buenas noches";
    if (h < 13) return "Buenos días";
    if (h < 20) return "Buenas tardes";
    return "Buenas noches";
}

// Días que faltan para el próximo cumpleaños y la edad que cumple
function proximoCumple(fechaNac) {
    if (!fechaNac) return null;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const nac = new Date(fechaNac + 'T00:00:00');
    let cumple = new Date(hoy.getFullYear(), nac.getMonth(), nac.getDate());
    if (cumple < hoy) cumple.setFullYear(hoy.getFullYear() + 1);
    const dias = Math.round((cumple - hoy) / 86400000);
    const edadQueCumple = cumple.getFullYear() - nac.getFullYear();
    return { dias, edadQueCumple, fecha: cumple };
}

// Devuelve el jugador con el mayor valor en un campo (o null)
function lider(jugadores, campo) {
    let mejor = null;
    jugadores.forEach((j) => {
        if ((j[campo] || 0) > 0 && (!mejor || (j[campo] || 0) > (mejor[campo] || 0))) mejor = j;
    });
    return mejor;
}

// ---------- Render del feed ----------
// Resultado considerando penales (en copas el empate se define por penales)
function resPartido(p) {
    if (p.gf > p.gc) return 'v';
    if (p.gf < p.gc) return 'd';
    const pf = p.penalesFavor || 0, pc = p.penalesContra || 0;
    return pf > pc ? 'v' : (pf < pc ? 'd' : 'e');
}
function huboPenales(p) { return p.gf === p.gc && ((p.penalesFavor || 0) || (p.penalesContra || 0)); }
const ORDEN_FASES = ['Fase de grupos', '32avos de final', '16avos de final', 'Octavos de final', 'Cuartos de final', 'Semifinal', 'Final'];
function siguienteFase(fase) {
    if (fase === 'Final') return 'Campeón ⭐';
    const i = ORDEN_FASES.indexOf(fase);
    return i >= 0 ? (ORDEN_FASES[i + 1] || null) : null;
}

function generarNovedades(jugadores, partidos, datosEquipo, torneos) {
    const items = [];
    // Mapa de tipo de torneo por id (para distinguir liga de copa)
    const tipoPorId = {};
    (torneos || []).forEach((t) => { tipoPorId[t.id] = t.tipo; });
    const esElim = (p) => p.torneoTipo === 'eliminatoria' || tipoPorId[p.torneoId] === 'eliminatoria' || !!p.fase;

    if (!datosEquipo || !datosEquipo.nombre) {
        items.push({ ico: '📋', cat: 'Primeros pasos', color: 'var(--aviso)',
            titulo: 'Configurá tu club', texto: 'Cargá el nombre, el escudo y los colores en la sección Equipo.' });
    }
    if (jugadores.length === 0) {
        items.push({ ico: '➕', cat: 'Plantel', color: 'var(--color-secundario)',
            titulo: 'Sumá tus jugadores', texto: 'Todavía no cargaste jugadores. Empezá a armar el plantel.' });
    }

    // ----- Novedades de partidos -----
    if (partidos.length === 0) {
        items.push({ ico: '📅', cat: 'Partidos', color: 'var(--color-secundario)',
            titulo: 'Registrá tus partidos', texto: 'Anotá resultados y campeonatos para ver la campaña del equipo.' });
    } else {
        const ord = [...partidos].sort((a, b) => b.fecha.localeCompare(a.fecha));
        const ult = ord[0];
        const r = resPartido(ult);
        const vs = ult.condicion === 'Local' ? 'vs' : '@';
        const fecha = new Date(ult.fecha + 'T00:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });
        const torneoTxt = ult.torneoNombre || ult.torneo || 'Amistoso';

        if (esElim(ult)) {
            // Copa: hablamos de avance de fase y penales, no de resultado/puntos
            const marc = `${ult.gf}-${ult.gc}${huboPenales(ult) ? ` (${ult.penalesFavor}-${ult.penalesContra} pen.)` : ''}`;
            if (r === 'v') {
                const sig = ult.fase ? siguienteFase(ult.fase) : null;
                const avance = ult.fase === 'Final' ? '¡Campeón! 🏆' : (sig ? `Pasó a ${sig}` : 'Avanzó de fase');
                items.push({ ico: '✅', cat: 'Copa', color: '#16a34a',
                    titulo: `${huboPenales(ult) ? 'Ganó por penales' : 'Ganó'} ${marc} ${vs} ${ult.rival}`,
                    texto: `${ult.fase ? ult.fase + ' · ' : ''}${avance} · ${torneoTxt}` });
            } else if (r === 'd') {
                items.push({ ico: '❌', cat: 'Copa', color: '#dc2626',
                    titulo: `${huboPenales(ult) ? 'Perdió por penales' : 'Perdió'} ${marc} ${vs} ${ult.rival}`,
                    texto: `${ult.fase ? 'Eliminado en ' + ult.fase : 'Quedó eliminado'} · ${torneoTxt}` });
            } else {
                items.push({ ico: '🤝', cat: 'Copa', color: '#9ca3af',
                    titulo: `Empate ${marc} ${vs} ${ult.rival}`, texto: `${torneoTxt}${ult.fase ? ' · ' + ult.fase : ''} · ${fecha}.` });
            }
        } else {
            // Liga / amistoso: resultado clásico
            const txt = { v: 'Victoria', e: 'Empate', d: 'Derrota' }[r];
            const ico = { v: '✅', e: '🤝', d: '❌' }[r];
            const color = { v: '#16a34a', e: '#9ca3af', d: '#dc2626' }[r];
            items.push({ ico, cat: 'Último partido', color,
                titulo: `${txt} ${ult.gf}-${ult.gc} ${vs} ${ult.rival}`, texto: `${torneoTxt} · ${fecha}.` });
        }

        // Racha actual
        let streak = 0; const tipo = resPartido(ord[0]);
        for (const p of ord) { if (resPartido(p) === tipo) streak++; else break; }
        if (streak >= 2) {
            const m = { v: ['victorias', '🔥'], e: ['empates', '➖'], d: ['derrotas', '📉'] };
            items.push({ ico: m[tipo][1], cat: 'Racha', color: tipo === 'v' ? '#16a34a' : tipo === 'd' ? '#dc2626' : '#9ca3af',
                titulo: `${streak} ${m[tipo][0]} al hilo`, texto: tipo === 'v' ? '¡El equipo está en racha!' : 'A revertir la situación.' });
        }

        // Campaña: los puntos solo aplican a torneos de liga
        const ligaPartidos = partidos.filter((p) => p.torneoTipo === 'liga' || tipoPorId[p.torneoId] === 'liga');
        if (ligaPartidos.length) {
            const rec = ligaPartidos.reduce((a, p) => { const x = resPartido(p); a.pj++; a[x]++; return a; }, { pj: 0, v: 0, e: 0, d: 0 });
            const pts = rec.v * 3 + rec.e;
            items.push({ ico: '📈', cat: 'Campaña', color: 'var(--color-principal)',
                titulo: `${pts} puntos en ${rec.pj} partido(s) de liga`, texto: `Récord: ${rec.v}G · ${rec.e}E · ${rec.d}P.` });
        }
    }

    // Torneos: ordenados por actividad (los de más partidos primero). Hasta 3.
    (torneos || [])
        .map((t) => ({ t, n: (partidos || []).filter((p) => p.torneoId === t.id).length }))
        .filter((x) => (x.t.tipo === 'eliminatoria' && x.t.fase) || (x.t.tipo === 'liga' && x.n > 0))
        .sort((a, b) => b.n - a.n)
        .slice(0, 3)
        .forEach(({ t }) => {
            const lista = (partidos || []).filter((p) => p.torneoId === t.id);
            if (t.tipo === 'eliminatoria') {
                // Copa: contamos el avance de fase y los penales
                const last = [...lista].sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
                let texto = 'Fase en juego.';
                if (t.fase === 'Campeón ⭐') {
                    texto = '¡Campeones del torneo! 🏆';
                } else if (last) {
                    const r = resPartido(last);
                    const marc = `${last.gf}-${last.gc}${huboPenales(last) ? ` (${last.penalesFavor}-${last.penalesContra} pen.)` : ''}`;
                    if (r === 'v') {
                        const sig = last.fase ? siguienteFase(last.fase) : null;
                        texto = `${huboPenales(last) ? 'Ganó por penales' : 'Ganó'} ${marc} a ${last.rival}.${last.fase === 'Final' ? ' ¡Campeón!' : (sig ? ' Pasó a ' + sig + '.' : '')}`;
                    } else if (r === 'd') {
                        texto = `${huboPenales(last) ? 'Perdió por penales' : 'Perdió'} ${marc} con ${last.rival}. Eliminado en ${last.fase || t.fase}.`;
                    } else {
                        texto = `Empate ${marc} con ${last.rival}.`;
                    }
                }
                items.push({ ico: '🏆', cat: 'Copa', color: '#f5c518', titulo: `${t.nombre}: ${t.fase}`, texto });
            } else {
                const rec = lista.reduce((a, p) => { const x = resPartido(p); a.pj++; a[x]++; return a; }, { pj: 0, v: 0, e: 0, d: 0 });
                const pts = rec.v * 3 + rec.e;
                items.push({ ico: '📊', cat: 'Liga', color: 'var(--color-secundario)',
                    titulo: `${t.nombre}: ${pts} pts`,
                    texto: `${rec.v}G · ${rec.e}E · ${rec.d}P en ${rec.pj} partido(s).` });
            }
        });

    const goleador = lider(jugadores, 'goles');
    if (goleador) items.push({ ico: '⚽', cat: 'Goleador', color: '#22c55e',
        titulo: `${goleador.nombre} lidera la tabla`, texto: `Es el máximo goleador del equipo con ${goleador.goles} gol(es).` });

    const asistidor = lider(jugadores, 'asistencias');
    if (asistidor) items.push({ ico: '🎯', cat: 'Asistencias', color: '#d97706',
        titulo: `${asistidor.nombre}, el mejor socio`, texto: `Acumula ${asistidor.asistencias} asistencia(s), la mayor cantidad del plantel.` });

    // Cumpleaños: si alguien cumple HOY lo mostramos (con botón de saludo); si no, el próximo
    cumpleHoy = null;
    let cumpleProx = null;
    jugadores.forEach((j) => {
        const c = proximoCumple(j.fechaNacimiento);
        if (c && (!cumpleProx || c.dias < cumpleProx.dias)) cumpleProx = { ...c, nombre: j.nombre };
    });
    if (cumpleProx && cumpleProx.dias === 0) {
        cumpleHoy = cumpleProx;
        items.push({ ico: '🎉', cat: 'Cumpleaños', color: '#ec4899',
            titulo: `¡Hoy cumple ${cumpleProx.nombre}!`,
            texto: `Cumple ${cumpleProx.edadQueCumple} años. ¡Deseale un feliz cumpleaños!`,
            boton: '<button class="btn-exp" data-exp="cumple">📲 Exportar saludo</button>' });
    } else if (cumpleProx) {
        const cuando = cumpleProx.dias === 1 ? 'es mañana' : `faltan ${cumpleProx.dias} días`;
        const f = cumpleProx.fecha.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });
        items.push({ ico: '🎂', cat: 'Cumpleaños', color: '#ec4899',
            titulo: `Próximo cumpleaños: ${cumpleProx.nombre}`,
            texto: `Cumple ${cumpleProx.edadQueCumple} años el ${f} (${cuando}).` });
    }

    // Disciplina
    const amonestado = lider(jugadores, 'amarillas');
    if (amonestado && amonestado.amarillas >= 2) items.push({ ico: '🟨', cat: 'Disciplina', color: '#eab308',
        titulo: 'Atención con las amarillas', texto: `${amonestado.nombre} acumula ${amonestado.amarillas} amarillas. ¡Cuidado con la suspensión!` });

    const expulsado = lider(jugadores, 'rojas');
    if (expulsado) items.push({ ico: '🟥', cat: 'Disciplina', color: '#dc2626',
        titulo: 'Rojas en el equipo', texto: `${expulsado.nombre} registra ${expulsado.rojas} roja(s).` });

    // Resumen del plantel
    if (jugadores.length > 0) {
        const edades = jugadores.map((j) => calcularEdad(j.fechaNacimiento)).filter((e) => e !== null);
        const promedio = edades.length ? Math.round(edades.reduce((a, b) => a + b, 0) / edades.length) : null;
        items.push({ ico: '👥', cat: 'Plantel', color: 'var(--color-secundario)',
            titulo: `${jugadores.length} jugador(es) en el plantel`, texto: promedio ? `La edad promedio del equipo es de ${promedio} años.` : 'Plantel registrado.' });
    }

    // Palmarés e historia del club
    if (datosEquipo && Array.isArray(datosEquipo.palmares) && datosEquipo.palmares.length) {
        const totalT = datosEquipo.palmares.reduce((a, t) => a + (t.cantidad || 0), 0);
        const detalle = datosEquipo.palmares.map((t) => `${t.titulo} (x${t.cantidad})`).slice(0, 3).join(' · ');
        items.push({ ico: '🏆', cat: 'Vitrina', color: '#f5c518',
            titulo: `${totalT} título${totalT !== 1 ? 's' : ''} en las vitrinas`, texto: detalle,
            boton: '<button class="btn-exp" data-vitrina>🏆 Ver vitrina</button>' });
    }
    if (datosEquipo && datosEquipo.fundacion) {
        const anio = new Date(datosEquipo.fundacion + 'T00:00:00').getFullYear();
        const anios = new Date().getFullYear() - anio;
        items.push({ ico: '📅', cat: 'Historia', color: 'var(--color-secundario)',
            titulo: `${anios} años de historia`, texto: `El club fue fundado en ${anio}.` });
    }

    // Si no pasó nada todavía, un mensaje motivador
    if (items.length === 0) {
        items.push({ ico: '🏆', cat: 'Mi Club', color: 'var(--color-principal)',
            titulo: '¡Todo listo para arrancar!', texto: 'Cargá estadísticas para que tus tablas y novedades cobren vida.' });
    }

    return items;
}

function pintarFeed(items) {
    const feed = document.getElementById('feed');
    feed.innerHTML = items.map((it, i) => `
        <div class="feed-item" style="border-left-color:${it.color}; animation-delay:${i * 0.06}s;">
            <div class="feed-ico">${it.ico}</div>
            <div>
                <span class="feed-cat" style="color:${it.color};">${it.cat}</span>
                <div class="feed-titulo">${it.titulo}</div>
                <div class="feed-texto">${it.texto}</div>
                ${it.boton ? `<div class="feed-accion">${it.boton}</div>` : ''}
            </div>
        </div>
    `).join('');
}

// Modal interactivo de la vitrina (todas las copas, una por una)
function mostrarVitrina(palmares) {
    const items = (palmares || []);
    const total = items.reduce((a, t) => a + (t.cantidad || 0), 0);
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const filas = items.length
        ? items.map((t) => `
            <div class="vitrina-item">
                <span class="vitrina-trofeo">🏆</span>
                <div class="vitrina-info">
                    <div class="vitrina-nombre">${t.titulo}</div>
                    ${t.anio ? `<div class="vitrina-anio">${t.anio}</div>` : ''}
                </div>
                <span class="vitrina-cant">x${t.cantidad}</span>
            </div>`).join('')
        : '<p class="mensaje-vacio">Todavía no cargaste títulos. Agregalos en la sección Equipo.</p>';

    overlay.innerHTML = `
        <div class="modal" role="dialog" aria-modal="true" style="max-width:460px; text-align:left;">
            <div class="bloque-titulo" style="justify-content:space-between;">🏆 Vitrina (${total} título${total !== 1 ? 's' : ''})</div>
            <div class="vitrina-lista">${filas}</div>
            <div class="modal-acciones" style="margin-top:18px;">
                <button class="btn-principal" data-cerrar-vitrina>Cerrar</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('visible'));
    const cerrar = () => { overlay.classList.remove('visible'); overlay.addEventListener('transitionend', () => overlay.remove(), { once: true }); };
    overlay.addEventListener('click', (e) => { if (e.target === overlay || e.target.closest('[data-cerrar-vitrina]')) cerrar(); });
}

// Acciones dentro del muro (exportar saludo de cumple / ver vitrina)
document.getElementById('feed').addEventListener('click', async (e) => {
    const verVitrina = e.target.closest('[data-vitrina]');
    if (verVitrina) { mostrarVitrina(equipoTabla?.palmares); return; }

    const expCumple = e.target.closest('[data-exp="cumple"]');
    if (expCumple && cumpleHoy) {
        const boton = expCumple;
        const txt = boton.textContent;
        boton.disabled = true; boton.textContent = 'Generando...';
        const fecha = new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
        armarExportPremio(document.getElementById('export-stats'), {
            equipo: equipoTabla?.nombre || 'Mi Club', escudo: equipoTabla?.escudo || '', fecha,
            titulo: '¡Feliz Cumpleaños!', icono: '🎂', nombre: cumpleHoy.nombre,
            detalle: `Hoy cumple ${cumpleHoy.edadQueCumple} años 🎉`
        });
        try {
            await descargarComoJPG(document.getElementById('export-stats'), `Cumple-${cumpleHoy.nombre}`);
            mostrarToast("¡Saludo descargado!", 'exito');
        } catch (err) { console.error(err); mostrarToast("No se pudo generar la imagen.", 'error'); }
        finally { boton.disabled = false; boton.textContent = txt; }
    }
});

function pintarFiguras(jugadores) {
    const cont = document.getElementById('figuras');
    // Goleadores ordenados (se guarda para exportar)
    topGoleadores = [...jugadores]
        .filter((j) => (j.goles || 0) > 0)
        .sort((a, b) => (b.goles || 0) - (a.goles || 0) || (b.asistencias || 0) - (a.asistencias || 0));

    if (topGoleadores.length === 0) {
        cont.innerHTML = `<p class="mensaje-vacio">Cargá goles en Estadísticas para ver a las figuras acá.</p>`;
        return;
    }

    const medallas = ['🥇', '🥈', '🥉'];
    cont.innerHTML = topGoleadores.slice(0, 3).map((j, i) => `
        <div class="figura">
            <span class="figura-medalla">${medallas[i]}</span>
            <span class="figura-nombre">${j.nombre}</span>
            <span class="figura-valor">${j.goles} ⚽</span>
        </div>
    `).join('');
}

// ---------- Tabla profesional de estadísticas ----------
let jugadoresTabla = [];   // jugadores cargados
let equipoTabla = null;    // datos del club
let ordenActual = [];      // jugadores en el orden mostrado (para exportar)
let sortKey = 'goles';
let sortDir = 'desc';

// Datos guardados para exportar los destacados
let topGoleadores = [];     // goleadores ordenados (figuras)
let premioFP = null;        // { nombre, detalle } del Fair Play
let topAmonestados = [];    // top 5 amonestados

// Valor de un jugador para una columna
function valorCampo(j, key) {
    return j[key] || 0;
}

function renderTablaStats() {
    const body = document.getElementById('tabla-stats-body');
    const foot = document.getElementById('tabla-stats-foot');

    if (jugadoresTabla.length === 0) {
        body.innerHTML = `<tr><td colspan="7" class="mensaje-vacio">Cargá jugadores y estadísticas para ver la tabla.</td></tr>`;
        foot.hidden = true;
        return;
    }

    // Orden: por la columna elegida; desempate por goles, luego asistencias, luego nombre
    ordenActual = [...jugadoresTabla].sort((a, b) => {
        const dif = valorCampo(b, sortKey) - valorCampo(a, sortKey);
        const base = sortDir === 'desc' ? dif : -dif;
        if (base !== 0) return base;
        return (b.goles || 0) - (a.goles || 0)
            || (b.asistencias || 0) - (a.asistencias || 0)
            || a.nombre.localeCompare(b.nombre);
    });

    const medallas = ['🥇', '🥈', '🥉'];
    body.innerHTML = ordenActual.map((j, i) => `
        <tr>
            <td class="pos">${i < 3 ? medallas[i] : (i + 1)}</td>
            <td class="izq">${j.nombre}</td>
            <td>${j.partidosJugados || 0}</td>
            <td>${j.goles || 0}</td>
            <td>${j.asistencias || 0}</td>
            <td>${j.amarillas || 0}</td>
            <td>${j.rojas || 0}</td>
        </tr>`).join('');

    // Totales del equipo
    const tot = (campo) => jugadoresTabla.reduce((s, j) => s + (j[campo] || 0), 0);
    document.getElementById('tot-pj').textContent = tot('partidosJugados');
    document.getElementById('tot-g').textContent = tot('goles');
    document.getElementById('tot-a').textContent = tot('asistencias');
    document.getElementById('tot-y').textContent = tot('amarillas');
    document.getElementById('tot-r').textContent = tot('rojas');
    foot.hidden = false;

    // Indicador de columna ordenada
    document.querySelectorAll('.tabla-pro thead th[data-sort]').forEach((th) => {
        const activa = th.dataset.sort === sortKey;
        th.classList.toggle('orden-activo', activa);
        th.querySelector('.flecha')?.remove();
        if (activa) {
            const f = document.createElement('span');
            f.className = 'flecha';
            f.textContent = sortDir === 'desc' ? ' ▼' : ' ▲';
            th.appendChild(f);
        }
    });
}

// ---------- Premios: Fair Play + ranking de amonestados ----------
function renderPremios(jugadores) {
    const fpCont = document.getElementById('fairplay-cont');
    const rankCont = document.getElementById('rank-tarjetas-cont');
    const tarjetas = (j) => (j.amarillas || 0) + (j.rojas || 0);

    if (!jugadores.length) {
        premioFP = null;
        topAmonestados = [];
        fpCont.innerHTML = `<p class="mensaje-vacio">Cargá jugadores para ver el premio.</p>`;
        rankCont.innerHTML = `<p class="mensaje-vacio">Sin datos todavía.</p>`;
        return;
    }

    // Fair Play: menos tarjetas; entre quienes jugaron, desempata por más partidos
    const elegibles = jugadores.filter((j) => (j.partidosJugados || 0) > 0);
    const base = elegibles.length ? elegibles : jugadores;
    const fp = [...base].sort((a, b) =>
        tarjetas(a) - tarjetas(b) ||
        (b.partidosJugados || 0) - (a.partidosJugados || 0) ||
        a.nombre.localeCompare(b.nombre)
    )[0];
    const tfp = tarjetas(fp);
    const pj = fp.partidosJugados || 0;
    const detalle = tfp === 0
        ? `Sin tarjetas en ${pj} partido${pj !== 1 ? 's' : ''} 👏`
        : `${tfp} tarjeta${tfp !== 1 ? 's' : ''} en ${pj} partido${pj !== 1 ? 's' : ''}`;
    premioFP = { nombre: fp.nombre, detalle };
    fpCont.innerHTML = `
        <div class="fp-cuerpo">
            <div class="fp-ico">🏅</div>
            <div class="fp-nombre">${fp.nombre}</div>
            <div class="fp-detalle">${detalle}</div>
        </div>`;

    // Ranking de los 5 más amonestados (rojas pesan más en el desempate)
    const top = [...jugadores]
        .filter((j) => tarjetas(j) > 0)
        .sort((a, b) => tarjetas(b) - tarjetas(a) || (b.rojas || 0) - (a.rojas || 0) || a.nombre.localeCompare(b.nombre))
        .slice(0, 5);
    topAmonestados = top;

    rankCont.innerHTML = top.length
        ? top.map((j, i) => `
            <div class="rank-tarjeta">
                <span class="rank-pos">${i + 1}</span>
                <span class="rank-nombre">${j.nombre}</span>
                <span class="rank-cards"><span class="card-y">🟨 ${j.amarillas || 0}</span><span class="card-r">🟥 ${j.rojas || 0}</span></span>
                <span class="rank-total">${tarjetas(j)}</span>
            </div>`).join('')
        : `<p class="mensaje-vacio">Sin amonestaciones. ¡Equipo disciplinado! 👏</p>`;
}

// Click en encabezados para ordenar
document.querySelectorAll('.tabla-pro thead th[data-sort]').forEach((th) => {
    th.addEventListener('click', () => {
        const key = th.dataset.sort;
        if (sortKey === key) {
            sortDir = sortDir === 'desc' ? 'asc' : 'desc';
        } else {
            sortKey = key;
            sortDir = 'desc';
        }
        renderTablaStats();
    });
});

// Exportar la tabla como imagen 9:16
document.getElementById('btn-exportar').addEventListener('click', async (e) => {
    if (jugadoresTabla.length === 0) {
        mostrarToast("Cargá jugadores antes de exportar.", 'error');
        return;
    }
    const boton = e.currentTarget;
    boton.disabled = true;
    boton.textContent = 'Generando...';

    const fecha = new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
    armarExportEstadisticas(document.getElementById('export-stats'), {
        equipo: equipoTabla?.nombre || 'Mi Club',
        escudo: equipoTabla?.escudo || '',
        fecha,
        jugadores: (ordenActual.length ? ordenActual : jugadoresTabla).slice(0, 10)
    });

    try {
        await descargarComoJPG(document.getElementById('export-stats'), `Estadisticas-${equipoTabla?.nombre || 'MiClub'}`);
        mostrarToast("¡Imagen 9:16 descargada! Lista para Instagram.", 'exito');
    } catch (error) {
        console.error("Error al exportar:", error);
        mostrarToast("No se pudo generar la imagen.", 'error');
    } finally {
        boton.disabled = false;
        boton.textContent = 'Exportar tabla';
    }
});

// Exportar los destacados (Figuras / Fair Play / Amonestados) como historia 9:16
document.querySelector('.destacados-grid')?.addEventListener('click', async (e) => {
    const boton = e.target.closest('[data-exp]');
    if (!boton) return;

    const tipo = boton.dataset.exp;
    const cont = document.getElementById('export-stats');
    const fecha = new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
    const comun = { equipo: equipoTabla?.nombre || 'Mi Club', escudo: equipoTabla?.escudo || '', fecha };
    let archivo = 'MiClub';

    if (tipo === 'figuras') {
        if (!topGoleadores.length) { mostrarToast("Cargá goles para exportar las figuras.", 'error'); return; }
        armarExportRanking(cont, {
            ...comun, titulo: 'Goleadores',
            filas: topGoleadores.slice(0, 5).map((j) => ({ nombre: j.nombre, valor: j.goles || 0 }))
        });
        archivo = 'Goleadores';
    } else if (tipo === 'fairplay') {
        if (!premioFP) { mostrarToast("Sin datos para el premio.", 'error'); return; }
        armarExportPremio(cont, { ...comun, titulo: 'Premio Fair Play', icono: '🏅', nombre: premioFP.nombre, detalle: premioFP.detalle });
        archivo = 'FairPlay';
    } else if (tipo === 'tarjetas') {
        if (!topAmonestados.length) { mostrarToast("Sin amonestaciones para exportar.", 'error'); return; }
        armarExportRanking(cont, {
            ...comun, titulo: 'Más amonestados',
            filas: topAmonestados.map((j) => ({
                nombre: j.nombre,
                valor: (j.amarillas || 0) + (j.rojas || 0),
                extra: `🟨 ${j.amarillas || 0}   🟥 ${j.rojas || 0}`
            }))
        });
        archivo = 'Amonestados';
    } else {
        return;
    }

    const txt = boton.textContent;
    boton.disabled = true;
    boton.textContent = 'Generando...';
    try {
        await descargarComoJPG(cont, `${archivo}-${comun.equipo}`);
        mostrarToast("¡Historia descargada!", 'exito');
    } catch (error) {
        console.error("Error al exportar:", error);
        mostrarToast("No se pudo generar la imagen.", 'error');
    } finally {
        boton.disabled = false;
        boton.textContent = txt;
    }
});

// ---------- Arranque ----------
iniciarPagina(async (user, datosEquipo) => {
    // Encabezado y hero
    const nombre = (datosEquipo && datosEquipo.nombre) ? datosEquipo.nombre : 'tu club';
    document.getElementById('nombre-header').textContent = (datosEquipo && datosEquipo.nombre) || 'Mi Club';
    document.getElementById('hero-saludo').textContent = `${saludoHora()}, ${nombre} 👋`;
    document.getElementById('hero-fecha').textContent =
        new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
    if (datosEquipo && datosEquipo.escudo) {
        document.getElementById('escudo-header').src = datosEquipo.escudo;
        document.getElementById('hero-escudo').src = datosEquipo.escudo;
    }

    equipoTabla = datosEquipo;

    // Partidos y torneos: una sola lectura (para el muro de novedades)
    let partidos = [];
    let torneos = [];
    try {
        const [snapP, snapT] = await Promise.all([
            getDocs(collection(db, "equipos", user.uid, "partidos")),
            getDocs(collection(db, "equipos", user.uid, "torneos"))
        ]);
        partidos = snapP.docs.map((d) => ({ id: d.id, ...d.data() }));
        torneos = snapT.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (error) {
        console.error("No se pudieron cargar partidos/torneos:", error);
    }

    // Jugadores EN TIEMPO REAL: cualquier cambio en Estadísticas se refleja al instante
    let primeraVez = true;
    onSnapshot(collection(db, "equipos", user.uid, "jugadores"), (snap) => {
        const jugadores = snap.docs.map((d) => d.data());
        jugadoresTabla = jugadores;

        // KPIs (se animan la primera vez; luego se actualizan directo)
        const totalGoles = jugadores.reduce((a, j) => a + (j.goles || 0), 0);
        const totalAsist = jugadores.reduce((a, j) => a + (j.asistencias || 0), 0);
        const totalTarj = jugadores.reduce((a, j) => a + (j.amarillas || 0) + (j.rojas || 0), 0);
        setKPI('kpi-jugadores', jugadores.length, primeraVez);
        setKPI('kpi-goles', totalGoles, primeraVez);
        setKPI('kpi-asistencias', totalAsist, primeraVez);
        setKPI('kpi-tarjetas', totalTarj, primeraVez);
        primeraVez = false;

        // Tabla + premios + muro + figuras
        renderTablaStats();
        renderPremios(jugadores);
        pintarFeed(generarNovedades(jugadores, partidos, datosEquipo, torneos));
        pintarFiguras(jugadores);
    }, (error) => {
        console.error("Error al sincronizar jugadores:", error);
    });
});
