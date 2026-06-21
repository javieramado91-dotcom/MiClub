// js/admin.js — Panel de administración (solo cuenta admin)
import { auth, db } from './firebase-config.js';
import { mostrarToast, ADMIN_EMAIL } from './ui.js';
import { collection, getDocs, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const $ = (id) => document.getElementById(id);
let usuarios = []; // [{ id, ...datos }]

function fecha(ms) {
    if (!ms) return '—';
    return new Date(ms).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function opciones(lista, valor) {
    return lista.map((o) => `<option value="${o}" ${o === valor ? 'selected' : ''}>${o}</option>`).join('');
}

// Resumen de cuentas por estado / tipo (clickeable para filtrar)
function actualizarStats() {
    const c = { total: usuarios.length, activo: 0, pendiente: 0, denegado: 0, pago: 0, free: 0 };
    usuarios.forEach((u) => {
        c[u.estado || 'pendiente'] = (c[u.estado || 'pendiente'] || 0) + 1;
        if ((u.tipo || 'free') === 'pago') c.pago++; else c.free++;
    });
    const cajas = [
        { k: '', num: c.total, lbl: 'Total' },
        { k: 'activo', num: c.activo, lbl: 'Activas', dest: true },
        { k: 'pendiente', num: c.pendiente, lbl: 'Pendientes' },
        { k: 'denegado', num: c.denegado, lbl: 'Denegadas' },
        { k: 'pago', num: c.pago, lbl: 'De pago' }
    ];
    $('admin-stats').innerHTML = cajas.map((s) =>
        `<div class="stat-box ${s.dest ? 'destacado' : ''}" data-filtro="${s.k}" style="cursor:pointer;"><span class="num">${s.num}</span><span class="lbl">${s.lbl}</span></div>`
    ).join('');
}

function pintar() {
    actualizarStats();
    const body = $('admin-body');
    const texto = ($('admin-buscar').value || '').trim().toLowerCase();
    const f = $('admin-filtro').value;
    const lista = usuarios.filter((u) => {
        const okTexto = !texto || (u.email || '').toLowerCase().includes(texto);
        let okF = true;
        if (f === 'pago' || f === 'free') okF = (u.tipo || 'free') === f;
        else if (f) okF = (u.estado || 'pendiente') === f;
        return okTexto && okF;
    });
    $('admin-contador').textContent = `${usuarios.length} usuario(s)`;

    if (lista.length === 0) {
        body.innerHTML = `<tr><td colspan="8" class="mensaje-vacio">No hay cuentas con ese filtro.</td></tr>`;
        return;
    }
    body.innerHTML = lista.map((u) => `
        <tr class="${u.estado === 'denegado' ? 'fila-denegado' : ''}">
            <td class="admin-email">${u.email || '—'}</td>
            <td>${fecha(u.creado)}</td>
            <td><code class="admin-codigo">${u.codigo || '—'}</code></td>
            <td><select class="admin-inp" data-uid="${u.id}" data-campo="estado">${opciones(['pendiente', 'activo', 'denegado'], u.estado || 'pendiente')}</select></td>
            <td><select class="admin-inp" data-uid="${u.id}" data-campo="tipo">${opciones(['free', 'pago'], u.tipo || 'free')}</select></td>
            <td><input class="admin-inp" data-uid="${u.id}" data-campo="formaPago" value="${(u.formaPago || '').replace(/"/g, '&quot;')}" placeholder="Ej: Transferencia"></td>
            <td><select class="admin-inp" data-uid="${u.id}" data-campo="acceso">${opciones(['total', 'limitado'], u.acceso || 'total')}</select></td>
            <td><input class="admin-inp" data-uid="${u.id}" data-campo="notas" value="${(u.notas || '').replace(/"/g, '&quot;')}" placeholder="Notas..."></td>
        </tr>`).join('');
}

async function cargar() {
    try {
        const snap = await getDocs(collection(db, 'usuarios'));
        usuarios = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        usuarios.sort((a, b) => (b.creado || 0) - (a.creado || 0));
        pintar();
    } catch (e) {
        console.error(e);
        $('admin-body').innerHTML = `<tr><td colspan="8" class="mensaje-vacio">No se pudieron cargar los usuarios. Revisá las reglas de Firestore.</td></tr>`;
    }
}

// Guardar cambios al editar un campo
$('admin-body').addEventListener('change', async (e) => {
    const el = e.target.closest('.admin-inp');
    if (!el) return;
    const { uid, campo } = el.dataset;
    try {
        await updateDoc(doc(db, 'usuarios', uid), { [campo]: el.value });
        const u = usuarios.find((x) => x.id === uid);
        if (u) u[campo] = el.value;
        if (campo === 'estado') { pintar(); }
        mostrarToast("Cambios guardados", 'exito');
    } catch (err) {
        console.error(err);
        mostrarToast("No se pudo guardar.", 'error');
    }
});

$('admin-buscar').addEventListener('input', pintar);
$('admin-filtro').addEventListener('change', pintar);

// Click en una caja del resumen para filtrar
$('admin-stats').addEventListener('click', (e) => {
    const caja = e.target.closest('[data-filtro]');
    if (!caja) return;
    $('admin-filtro').value = caja.dataset.filtro;
    pintar();
});

// Arranque: solo el admin puede entrar
onAuthStateChanged(auth, (user) => {
    if (!user) { window.location.href = 'index.html'; return; }
    if ((user.email || '').toLowerCase() !== ADMIN_EMAIL) { window.location.href = 'dashboard.html'; return; }
    cargar();
});
