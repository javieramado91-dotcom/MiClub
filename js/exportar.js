// js/exportar.js
// Convierte un contenedor HTML (la "historia 9:16") en una imagen JPG descargable.
// Usa la librería html2canvas, que se carga con un <script> en el HTML.

// Construye el HTML interno de la historia a partir de un ranking de jugadores.
//   ranking: [{ nombre, valor }, ...]  (ya ordenado de mayor a menor)
export function armarHistoria(contenedor, { titulo, equipo, escudo, ranking }) {
    const filas = ranking.map((j, i) => `
        <div class="ig-fila ${i === 0 ? 'top' : ''}">
            <span class="ig-puesto">${i + 1}°</span>
            <span class="ig-nombre">${j.nombre}</span>
            <span class="ig-valor">${j.valor}</span>
        </div>
    `).join('');

    contenedor.innerHTML = `
        <div class="ig-encabezado">
            ${escudo ? `<img class="ig-escudo" src="${escudo}" alt="escudo">` : ''}
            <div class="ig-equipo">${equipo || 'Mi Club'}</div>
        </div>
        <div class="ig-titulo">${titulo}</div>
        <div class="ig-lista">${filas || '<div class="ig-fila"><span class="ig-nombre">Sin datos todavía</span></div>'}</div>
        <div class="ig-firma">JA</div>
    `;
}

// "Saca la foto" del contenedor y dispara la descarga del JPG.
export async function descargarComoJPG(contenedor, nombreArchivo) {
    if (typeof html2canvas === 'undefined') {
        alert("Falta cargar html2canvas. Revisá el <script> en el HTML.");
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
