// js/exportar.js
// Arma una imagen vertical 9:16 (1080x1920) con la tabla de estadísticas del plantel,
// el escudo, nombre, fecha y colores del club, lista para subir a Instagram.

import { mostrarToast } from './ui.js';

// Rellena el contenedor oculto con el diseño de la imagen
export function armarExportEstadisticas(contenedor, { equipo, escudo, fecha, jugadores }) {
    // Tamaño de fuente de la tabla según cuántos jugadores haya (para que entren todos)
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

    contenedor.innerHTML = `
        <div class="exp-head">
            ${escudo ? `<img class="exp-escudo" src="${escudo}" alt="escudo">` : ''}
            <div class="exp-club">${equipo || 'Mi Club'}</div>
            <div class="exp-fecha">${fecha}</div>
        </div>
        <div class="exp-titulo">Estadísticas del Plantel</div>
        <table class="exp-tabla" style="font-size:${fs}px;">
            <thead>
                <tr>
                    <th class="exp-pos">#</th>
                    <th class="exp-nom">Jugador</th>
                    <th>PJ</th><th>G</th><th>A</th><th>🟨</th><th>🟥</th>
                </tr>
            </thead>
            <tbody>${filas || '<tr><td colspan="7" class="exp-vacio">Sin jugadores cargados</td></tr>'}</tbody>
        </table>
        <div class="exp-foot">
            <span>${equipo || 'Mi Club'}</span>
            <span class="exp-ja">JA</span>
        </div>
    `;
}

// "Saca la foto" del contenedor y dispara la descarga del JPG
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
