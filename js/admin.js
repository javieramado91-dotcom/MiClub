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

function pintar() {
    const body = $('admin-body');
    const texto = ($('admin-buscar').value || '').trim().toLowerCase();
    const lista = usuarios.filter((u) => !texto || (u.email || '').toLowerCase().includes(texto));
    $('admin-contador').textContent = `${usuarios.length} usuario(s)`;

    if (lista.length === 0) {
        body.innerHTML = `<tr><td colspan="8" class="mensaje-vacio">No hay usuarios.</td></tr>`;
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

// Arranque: solo el admin puede entrar
onAuthStateChanged(auth, (user) => {
    if (!user) { window.location.href = 'index.html'; return; }
    if ((user.email || '').toLowerCase() !== ADMIN_EMAIL) { window.location.href = 'dashboard.html'; return; }
    cargar();
});
