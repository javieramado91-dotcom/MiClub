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

// "Saca la foto" del contenedor y descarga el JPG
export async function descargarComoJPG(contenedor, nombreArchivo) {
    if (typeof html2canvas === 'undefined') {
        mostrarToast("No se pudo cargar la librería de exportación.", 'error');
        return;
    }
    const lienzo = await html2canvas(contenedor, {
        width: 1080,
        height: 1920,
        scale: 1,
        useCORS: true,
        backgroundColor: null
    });
    const enlace = document.createElement('a');
    enlace.download = `${nombreArchivo}.jpg`;
    enlace.href = lienzo.toDataURL('image/jpeg', 0.95);
    enlace.click();
}
