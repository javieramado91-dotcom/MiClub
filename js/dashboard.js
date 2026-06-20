// js/dashboard.js
// Panel principal estilo "muro de novedades":
//  - Protege la sesión y aplica el tema del equipo
//  - Calcula KPIs (jugadores, goles, asistencias, tarjetas) con contadores animados
//  - Genera un feed de novedades a partir de los datos reales del equipo

import { db } from './firebase-config.js';
import { iniciarPagina, mostrarToast } from './ui.js';
import { armarExportEstadisticas, descargarComoJPG } from './exportar.js';
import { collection, getDocs, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ---------- Utilidades ----------
function calcularEdad(fechaNac) {
    if (!fechaNac) return null;
    const hoy = new Date();
    const nac = new Date(fechaNac);
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
    const nac = new Date(fechaNac);
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
function resPartido(p) { return p.gf > p.gc ? 'v' : (p.gf < p.gc ? 'd' : 'e'); }

function generarNovedades(jugadores, partidos, datosEquipo) {
    const items = [];

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
        const txt = { v: 'Victoria', e: 'Empate', d: 'Derrota' }[r];
        const ico = { v: '✅', e: '🤝', d: '❌' }[r];
        const color = { v: '#16a34a', e: '#9ca3af', d: '#dc2626' }[r];
        const vs = ult.condicion === 'Local' ? 'vs' : '@';
        const fecha = new Date(ult.fecha + 'T00:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });
        items.push({ ico, cat: 'Último partido', color,
            titulo: `${txt} ${ult.gf}-${ult.gc} ${vs} ${ult.rival}`, texto: `${ult.torneo} · ${fecha}.` });

        // Racha actual
        let streak = 0; const tipo = resPartido(ord[0]);
        for (const p of ord) { if (resPartido(p) === tipo) streak++; else break; }
        if (streak >= 2) {
            const m = { v: ['victorias', '🔥'], e: ['empates', '➖'], d: ['derrotas', '📉'] };
            items.push({ ico: m[tipo][1], cat: 'Racha', color: tipo === 'v' ? '#16a34a' : tipo === 'd' ? '#dc2626' : '#9ca3af',
                titulo: `${streak} ${m[tipo][0]} al hilo`, texto: tipo === 'v' ? '¡El equipo está en racha!' : 'A revertir la situación.' });
        }

        // Campaña
        const rec = partidos.reduce((a, p) => { const x = resPartido(p); a.pj++; a[x]++; return a; }, { pj: 0, v: 0, e: 0, d: 0 });
        const pts = rec.v * 3 + rec.e;
        items.push({ ico: '📈', cat: 'Campaña', color: 'var(--color-principal)',
            titulo: `${pts} puntos en ${rec.pj} partido(s)`, texto: `Récord: ${rec.v}G · ${rec.e}E · ${rec.d}P.` });
    }

    const goleador = lider(jugadores, 'goles');
    if (goleador) items.push({ ico: '⚽', cat: 'Goleador', color: '#22c55e',
        titulo: `${goleador.nombre} lidera la tabla`, texto: `Es el máximo goleador del equipo con ${goleador.goles} gol(es).` });

    const asistidor = lider(jugadores, 'asistencias');
    if (asistidor) items.push({ ico: '🎯', cat: 'Asistencias', color: '#d97706',
        titulo: `${asistidor.nombre}, el mejor socio`, texto: `Acumula ${asistidor.asistencias} asistencia(s), la mayor cantidad del plantel.` });

    // Próximo cumpleaños (dentro de 45 días)
    let cumpleProx = null;
    jugadores.forEach((j) => {
        const c = proximoCumple(j.fechaNacimiento);
        if (c && c.dias <= 45 && (!cumpleProx || c.dias < cumpleProx.dias)) cumpleProx = { ...c, nombre: j.nombre };
    });
    if (cumpleProx) {
        const cuando = cumpleProx.dias === 0 ? '¡es hoy!' : cumpleProx.dias === 1 ? 'es mañana' : `faltan ${cumpleProx.dias} días`;
        items.push({ ico: '🎂', cat: 'Cumpleaños', color: '#ec4899',
            titulo: `Se viene el cumple de ${cumpleProx.nombre}`, texto: `Cumple ${cumpleProx.edadQueCumple} años — ${cuando}.` });
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
            titulo: `${totalT} título${totalT !== 1 ? 's' : ''} en las vitrinas`, texto: detalle });
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
            </div>
        </div>
    `).join('');
}

function pintarFiguras(jugadores) {
    const cont = document.getElementById('figuras');
    const top = [...jugadores]
        .filter((j) => (j.goles || 0) > 0)
        .sort((a, b) => (b.goles || 0) - (a.goles || 0))
        .slice(0, 3);

    if (top.length === 0) {
        cont.innerHTML = `<p class="mensaje-vacio">Cargá goles en Estadísticas para ver a las figuras acá.</p>`;
        return;
    }

    const medallas = ['🥇', '🥈', '🥉'];
    cont.innerHTML = top.map((j, i) => `
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

// Valor de un jugador para una columna (ga = goles + asistencias)
function valorCampo(j, key) {
    if (key === 'ga') return (j.goles || 0) + (j.asistencias || 0);
    return j[key] || 0;
}

function renderTablaStats() {
    const body = document.getElementById('tabla-stats-body');
    const foot = document.getElementById('tabla-stats-foot');

    if (jugadoresTabla.length === 0) {
        body.innerHTML = `<tr><td colspan="8" class="mensaje-vacio">Cargá jugadores y estadísticas para ver la tabla.</td></tr>`;
        foot.hidden = true;
        return;
    }

    // Ordenar (con desempate por goles y luego nombre)
    ordenActual = [...jugadoresTabla].sort((a, b) => {
        const dif = valorCampo(b, sortKey) - valorCampo(a, sortKey);
        const base = sortDir === 'desc' ? dif : -dif;
        if (base !== 0) return base;
        return (b.goles || 0) - (a.goles || 0) || a.nombre.localeCompare(b.nombre);
    });

    const medallas = ['🥇', '🥈', '🥉'];
    body.innerHTML = ordenActual.map((j, i) => {
        const g = j.goles || 0, a = j.asistencias || 0;
        return `
        <tr>
            <td class="pos">${i < 3 ? medallas[i] : (i + 1)}</td>
            <td class="izq">${j.nombre}</td>
            <td>${j.partidosJugados || 0}</td>
            <td>${g}</td>
            <td>${a}</td>
            <td>${j.amarillas || 0}</td>
            <td>${j.rojas || 0}</td>
            <td class="col-ga">${g + a}</td>
        </tr>`;
    }).join('');

    // Totales del equipo
    const tot = (campo) => jugadoresTabla.reduce((s, j) => s + (j[campo] || 0), 0);
    const tg = tot('goles'), ta = tot('asistencias');
    document.getElementById('tot-pj').textContent = tot('partidosJugados');
    document.getElementById('tot-g').textContent = tg;
    document.getElementById('tot-a').textContent = ta;
    document.getElementById('tot-y').textContent = tot('amarillas');
    document.getElementById('tot-r').textContent = tot('rojas');
    document.getElementById('tot-ga').textContent = tg + ta;
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
        jugadores: ordenActual.length ? ordenActual : jugadoresTabla
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

    // Partidos: una sola lectura (para el muro de novedades)
    let partidos = [];
    try {
        const snapP = await getDocs(collection(db, "equipos", user.uid, "partidos"));
        partidos = snapP.docs.map((d) => d.data());
    } catch (error) {
        console.error("No se pudieron cargar los partidos:", error);
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

        // Tabla + muro + figuras
        renderTablaStats();
        pintarFeed(generarNovedades(jugadores, partidos, datosEquipo));
        pintarFiguras(jugadores);
    }, (error) => {
        console.error("Error al sincronizar jugadores:", error);
    });
});
