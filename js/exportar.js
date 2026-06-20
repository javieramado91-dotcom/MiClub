// js/exportar.js
// Arma imágenes verticales 9:16 (1080x1920) con el escudo, nombre, fecha y colores
// del club, listas para subir a Instagram. Soporta: tabla del plantel, rankings y premio.

import { mostrarToast } from './ui.js';

// Marco común (encabezado + título + cuerpo + firma JA)
function marco(contenedor, { equipo, escudo, fecha, titulo, cuerpo }) {
    contenedor.innerHTML = `
        <div class="exp-head">
            ${escudo ? `<img class="exp-escudo" src="${escudo}" alt="escudo">` : ''}
            <div class="exp-club">${equipo || 'Mi Club'}</div>
            <div class="exp-fecha">${fecha}</div>
        </div>
        <div class="exp-titulo">${titulo}</div>
        ${cuerpo}
        <div class="exp-foot">
            <span>${equipo || 'Mi Club'}</span>
            <span class="exp-ja">JA</span>
        </div>
    `;
}

// Tabla completa del plantel
export function armarExportEstadisticas(contenedor, { equipo, escudo, fecha, jugadores }) {
    const n = jugadores.length;
    const fs = n <= 12 ? 34 : n <= 16 ? 30 : n <= 20 ? 26 : n <= 26 ? 22 : 18;
    const medallas = ['🥇', '🥈', '🥉'];
    const filas = jugadores.map((j, i) => `
        <tr class="${i < 3 ? 'top' : ''}">
            <td class="exp-pos">${i < 3 ? medallas[i] : (i + 1)}</td>
            <td class="exp-nom">${j.nombre}</td>
            <td>${j.partidosJugados || 0}</td>
            <td class="exp-g">${j.goles || 0}</td>
            <td>${j.asistencias || 0}</td>
            <td>${j.amarillas || 0}</td>
            <td>${j.rojas || 0}</td>
        </tr>`).join('');

    const cuerpo = `
        <table class="exp-tabla" style="font-size:${fs}px;">
            <thead>
                <tr><th class="exp-pos">#</th><th class="exp-nom">Jugador</th><th>PJ</th><th>G</th><th>A</th><th>🟨</th><th>🟥</th></tr>
            </thead>
            <tbody>${filas || '<tr><td colspan="7" class="exp-vacio">Sin jugadores</td></tr>'}</tbody>
        </table>`;

    marco(contenedor, { equipo, escudo, fecha, titulo: 'Estadísticas del Plantel', cuerpo });
}

// Ranking (figuras / amonestados): filas = [{ nombre, valor, extra? }]
export function armarExportRanking(contenedor, { equipo, escudo, fecha, titulo, filas }) {
    const medallas = ['🥇', '🥈', '🥉'];
    const html = filas.map((f, i) => `
        <div class="exp-rank-fila ${i < 3 ? 'top' : ''}">
            <span class="exp-rank-pos">${i < 3 ? medallas[i] : (i + 1)}</span>
            <span class="exp-rank-nom">${f.nombre}${f.extra ? `<small>${f.extra}</small>` : ''}</span>
            <span class="exp-rank-val">${f.valor}</span>
        </div>`).join('');

    const cuerpo = `<div class="exp-rank">${html || '<div class="exp-rank-fila"><span class="exp-rank-nom">Sin datos</span></div>'}</div>`;
    marco(contenedor, { equipo, escudo, fecha, titulo, cuerpo });
}

// Premio individual (Fair Play)
export function armarExportPremio(contenedor, { equipo, escudo, fecha, titulo, icono, nombre, detalle }) {
    const cuerpo = `
        <div class="exp-premio">
            <div class="exp-premio-ico">${icono || '🏅'}</div>
            <div class="exp-premio-nom">${nombre}</div>
            <div class="exp-premio-det">${detalle || ''}</div>
        </div>`;
    marco(contenedor, { equipo, escudo, fecha, titulo, cuerpo });
}

// Marcador grande (último resultado / partido)
export function armarExportMarcador(contenedor, { equipo, escudo, fecha, titulo, rival, gf, gc, etiqueta, sub }) {
    const clase = (etiqueta || '').toLowerCase().includes('victoria') ? 'v'
        : (etiqueta || '').toLowerCase().includes('derrota') ? 'd' : 'e';
    const cuerpo = `
        <div class="exp-marcador">
            <div class="exp-vs">
                <div class="exp-vs-eq">${equipo || 'Mi Club'}</div>
                <div class="exp-score">${gf}<span> - </span>${gc}</div>
                <div class="exp-vs-eq">${rival || 'Rival'}</div>
            </div>
            ${etiqueta ? `<div class="exp-result ${clase}">${etiqueta}</div>` : ''}
            ${sub ? `<div class="exp-sub">${sub}</div>` : ''}
        </div>`;
    marco(contenedor, { equipo, escudo, fecha, titulo, cuerpo });
}

// Grilla de estadísticas grandes (campaña, puntos) + racha opcional
export function armarExportStats(contenedor, { equipo, escudo, fecha, titulo, cajas, racha, nota }) {
    const grid = (cajas || []).map((c) =>
        `<div class="exp-stat ${c.destacado ? 'top' : ''}"><div class="exp-stat-num">${c.num}</div><div class="exp-stat-lbl">${c.lbl}</div></div>`
    ).join('');
    const et = { v: 'G', e: 'E', d: 'P' };
    const rachaHtml = (racha && racha.length)
        ? `<div class="exp-racha">${racha.map((r) => `<span class="exp-rb ${r}">${et[r]}</span>`).join('')}</div>`
        : '';
    const notaHtml = nota ? `<div class="exp-sub">${nota}</div>` : '';
    const cuerpo = `<div class="exp-stats-wrap"><div class="exp-stats-grid">${grid}</div>${rachaHtml}${notaHtml}</div>`;
    marco(contenedor, { equipo, escudo, fecha, titulo, cuerpo });
}

// Tabla de posiciones
export function armarExportTablaPos(contenedor, { equipo, escudo, fecha, titulo, filas }) {
    const n = filas.length;
    const fs = n <= 8 ? 32 : n <= 12 ? 28 : n <= 16 ? 24 : 20;
    const rows = filas.map((f, i) => `
        <tr class="${f.destacado ? 'mio' : ''}">
            <td class="exp-pos">${i + 1}</td>
            <td class="exp-nom">${f.nombre}</td>
            <td>${f.pj}</td><td>${f.pg}</td><td>${f.pe}</td><td>${f.pp}</td>
            <td>${f.dif > 0 ? '+' : ''}${f.dif}</td><td class="exp-g">${f.pts}</td>
        </tr>`).join('');
    const cuerpo = `
        <table class="exp-tabla" style="font-size:${fs}px;">
            <thead><tr><th class="exp-pos">#</th><th class="exp-nom">Equipo</th><th>PJ</th><th>PG</th><th>PE</th><th>PP</th><th>DIF</th><th>PTS</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="8" class="exp-vacio">Sin datos</td></tr>'}</tbody>
        </table>`;
    marco(contenedor, { equipo, escudo, fecha, titulo, cuerpo });
}

// "Saca la foto" del contenedor y descarga el JPG (dimensiones configurables)
export async function descargarComoJPG(contenedor, nombreArchivo, ancho = 1080, alto = 1920) {
    if (typeof html2canvas === 'undefined') {
        mostrarToast("No se pudo cargar la librería de exportación.", 'error');
        return;
    }
    const lienzo = await html2canvas(contenedor, {
        width: ancho,
        height: alto,
        scale: 1,
        useCORS: true,
        backgroundColor: null
    });
    const enlace = document.createElement('a');
    enlace.download = `${nombreArchivo}.jpg`;
    enlace.href = lienzo.toDataURL('image/jpeg', 0.95);
    enlace.click();
}
