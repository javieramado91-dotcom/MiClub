// js/dashboard.js
// Panel principal estilo "muro de novedades":
//  - Protege la sesión y aplica el tema del equipo
//  - Calcula KPIs (jugadores, goles, asistencias, tarjetas) con contadores animados
//  - Genera un feed de novedades a partir de los datos reales del equipo

import { db } from './firebase-config.js';
import { iniciarPagina } from './ui.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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
function generarNovedades(jugadores, datosEquipo) {
    const items = [];

    if (!datosEquipo || !datosEquipo.nombre) {
        items.push({ ico: '📋', cat: 'Primeros pasos', color: 'var(--aviso)',
            titulo: 'Configurá tu club', texto: 'Cargá el nombre, el escudo y los colores en la sección Equipo.' });
    }
    if (jugadores.length === 0) {
        items.push({ ico: '➕', cat: 'Plantel', color: 'var(--color-secundario)',
            titulo: 'Sumá tus jugadores', texto: 'Todavía no cargaste jugadores. Empezá a armar el plantel.' });
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

    // Traer jugadores
    let jugadores = [];
    try {
        const snap = await getDocs(collection(db, "equipos", user.uid, "jugadores"));
        jugadores = snap.docs.map((d) => d.data());
    } catch (error) {
        console.error("No se pudieron cargar los jugadores:", error);
    }

    // KPIs con contadores animados
    const totalGoles = jugadores.reduce((a, j) => a + (j.goles || 0), 0);
    const totalAsist = jugadores.reduce((a, j) => a + (j.asistencias || 0), 0);
    const totalTarj = jugadores.reduce((a, j) => a + (j.amarillas || 0) + (j.rojas || 0), 0);
    animarContador(document.getElementById('kpi-jugadores'), jugadores.length);
    animarContador(document.getElementById('kpi-goles'), totalGoles);
    animarContador(document.getElementById('kpi-asistencias'), totalAsist);
    animarContador(document.getElementById('kpi-tarjetas'), totalTarj);

    // Muro de novedades + figuras
    pintarFeed(generarNovedades(jugadores, datosEquipo));
    pintarFiguras(jugadores);
});
