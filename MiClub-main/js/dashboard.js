// js/dashboard.js
// Protege el panel, aplica el tema del equipo y muestra su nombre/escudo.

import { iniciarPagina } from './ui.js';

iniciarPagina((user, datosEquipo) => {
    if (datosEquipo && datosEquipo.nombre) {
        document.getElementById('nombre-header').textContent = datosEquipo.nombre;
        document.getElementById('titulo-bienvenida').textContent = `¡Bienvenido, ${datosEquipo.nombre}!`;
        if (datosEquipo.escudo) document.getElementById('escudo-header').src = datosEquipo.escudo;
    } else {
        // Equipo todavía sin configurar
        document.getElementById('titulo-bienvenida').textContent = '¡Bienvenido! Configurá tu equipo para empezar.';
    }
});
