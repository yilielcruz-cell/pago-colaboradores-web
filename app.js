(() => {
  const STORAGE_KEY = "pago_colaboradores_web_v1";

  const SERVICIOS_BASE = [
    "Camarógrafo", "Asistente de cámara", "Gaffer", "Grip", "Productor",
    "Director", "Editor", "Fotógrafo", "Maquillaje", "Utilería",
    "Chofer", "Sonidista", "Serv. de Vj", "Montaje Monolito",
    "Desmontaje Monolito", "Lumino-técnico", "Serv. Streaming"
  ];
  const TIPOS_BASE = ["Ahorro", "Corriente", "Nómina"];
  const BANCOS_BASE = [
    "Banco Popular", "Banco de Reservas", "Banco León", "Banco BHD",
    "Banco ADEMI", "Banco Promerica", "Banco Santa Cruz", "Banco Vimenca",
    "Scotiabank", "Banco Caribe"
  ];

  const defaultState = () => ({
    usuario: "",
    contrasena: "",
    colaboradores: {},
    registros: [],
    serviciosExtra: [],
    tiposExtra: [],
    bancosExtra: [],
  });

  let state = load();
  let selectedServicios = [];
  let montosPorServicio = {};
  let fechasSeleccionadas = [];

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      return { ...defaultState(), ...JSON.parse(raw) };
    } catch {
      return defaultState();
    }
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.remove("hidden");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.add("hidden"), 2600);
  }

  function formatCedula(raw) {
    const d = String(raw || "").replace(/\D/g, "").slice(0, 11);
    if (d.length <= 3) return d;
    if (d.length <= 10) return `${d.slice(0, 3)}-${d.slice(3)}`;
    return `${d.slice(0, 3)}-${d.slice(3, 10)}-${d.slice(10)}`;
  }

  function cleanCedula(raw) {
    return String(raw || "").replace(/\D/g, "").slice(0, 11);
  }

  function formatMonto(n) {
    const v = Number(n) || 0;
    return `DOP $${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function parseMonto(s) {
    const n = Number(String(s || "").replace(/[^\d.]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }

  function showScreen(id) {
    $$(".screen").forEach((s) => s.classList.add("hidden"));
    const el = $(`#screen-${id}`);
    if (el) el.classList.remove("hidden");
    if (id === "menu") refreshMenu();
    if (id === "agregar") fillSelects("Add");
    if (id === "modificar") refreshModificar();
    if (id === "eliminar") refreshEliminar();
    if (id === "registro") refreshRegistro();
    if (id === "historial") refreshHistorial();
    if (id === "resumen") refreshResumen();
  }

  function tiposAll() {
    return [...new Set([...TIPOS_BASE, ...state.tiposExtra])].sort();
  }
  function bancosAll() {
    return [...new Set([...BANCOS_BASE, ...state.bancosExtra])].sort();
  }
  function serviciosAll() {
    return [...new Set([...SERVICIOS_BASE, ...state.serviciosExtra])].sort();
  }

  function fillSelect(select, items, placeholder) {
    select.innerHTML = "";
    if (placeholder) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = placeholder;
      select.appendChild(opt);
    }
    items.forEach((item) => {
      const opt = document.createElement("option");
      opt.value = item;
      opt.textContent = item;
      select.appendChild(opt);
    });
  }

  function fillSelects(suffix) {
    fillSelect($(`#tipoCuenta${suffix}`), tiposAll(), "Seleccionar tipo");
    fillSelect($(`#banco${suffix}`), bancosAll(), "Seleccionar banco");
  }

  function bindCedulaInput(input) {
    input.addEventListener("input", () => {
      const clean = cleanCedula(input.value);
      input.dataset.raw = clean;
      input.value = formatCedula(clean);
    });
  }

  // ----- Auth -----
  function refreshLogin() {
    const first = !state.usuario;
    $("#loginHint").textContent = first
      ? "Primer uso: crea usuario y contraseña"
      : "Inicia sesión";
    $("#setupBtn").hidden = !first;
    $("#loginBtn").hidden = first;
  }

  function tryLogin() {
    const u = $("#loginUser").value.trim();
    const p = $("#loginPass").value;
    if (!u || !p) return toast("Completa usuario y contraseña");
    if (u === state.usuario && p === state.contrasena) {
      $("#loginPass").value = "";
      showScreen("menu");
    } else {
      toast("Credenciales incorrectas");
    }
  }

  function setupAccess() {
    const u = $("#loginUser").value.trim();
    const p = $("#loginPass").value;
    if (!u || !p) return toast("Crea usuario y contraseña");
    if (p.length < 4) return toast("La contraseña debe tener al menos 4 caracteres");
    state.usuario = u;
    state.contrasena = p;
    save();
    toast("Acceso creado");
    showScreen("menu");
  }

  function refreshMenu() {
    $("#welcomeUser").textContent = state.usuario ? `Bienvenido, ${state.usuario}` : "";
  }

  // ----- Colaboradores -----
  function readColabForm(form) {
    const fd = new FormData(form);
    const cedula = cleanCedula(fd.get("cedula"));
    return {
      colaborador: String(fd.get("colaborador") || "").trim(),
      cedula,
      cuenta: String(fd.get("cuenta") || "").replace(/\D/g, ""),
      tipoCuenta: String(fd.get("tipoCuenta") || ""),
      banco: String(fd.get("banco") || ""),
      correoElectronico: String(fd.get("correo") || "").trim(),
    };
  }

  function validateColab(data) {
    if (!data.colaborador) return "Nombre requerido";
    if (data.cedula.length !== 11) return "Cédula debe tener 11 dígitos";
    if (!data.cuenta) return "Cuenta requerida";
    if (!data.tipoCuenta) return "Tipo de cuenta requerido";
    if (!data.banco) return "Banco requerido";
    return "";
  }

  function onAgregar(e) {
    e.preventDefault();
    const data = readColabForm(e.target);
    const err = validateColab(data);
    if (err) return toast(err);
    if (state.colaboradores[data.cedula]) return toast("Ya existe un colaborador con esa cédula");
    state.colaboradores[data.cedula] = data;
    save();
    e.target.reset();
    toast("Colaborador guardado");
    showScreen("menu");
  }

  function refreshModificar() {
    fillSelects("Mod");
    const sel = $("#modificarSelect");
    const list = Object.values(state.colaboradores);
    fillSelect(
      sel,
      list.map((c) => `${c.colaborador} · ${formatCedula(c.cedula)}`),
      list.length ? "Seleccionar colaborador" : "No hay colaboradores"
    );
    sel._map = list;
    $("#formModificar").hidden = true;
  }

  function onModificarSelect() {
    const sel = $("#modificarSelect");
    const idx = sel.selectedIndex - 1;
    const form = $("#formModificar");
    if (idx < 0 || !sel._map?.[idx]) {
      form.hidden = true;
      return;
    }
    const c = sel._map[idx];
    form.hidden = false;
    form.cedulaOriginal.value = c.cedula;
    form.colaborador.value = c.colaborador;
    form.cedula.value = formatCedula(c.cedula);
    form.cedula.dataset.raw = c.cedula;
    form.cuenta.value = c.cuenta;
    form.tipoCuenta.value = c.tipoCuenta;
    form.banco.value = c.banco;
    form.correo.value = c.correoElectronico || "";
  }

  function onModificar(e) {
    e.preventDefault();
    const form = e.target;
    const original = form.cedulaOriginal.value;
    const data = readColabForm(form);
    const err = validateColab(data);
    if (err) return toast(err);
    if (data.cedula !== original && state.colaboradores[data.cedula]) {
      return toast("Ya existe otra persona con esa cédula");
    }
    delete state.colaboradores[original];
    state.colaboradores[data.cedula] = data;
    state.registros = state.registros.map((r) =>
      r.cedula === original
        ? {
            ...r,
            colaborador: data.colaborador,
            cedula: data.cedula,
            cuenta: data.cuenta,
            tipoCuenta: data.tipoCuenta,
            banco: data.banco,
            correoElectronico: data.correoElectronico,
          }
        : r
    );
    save();
    toast("Colaborador actualizado");
    showScreen("menu");
  }

  function refreshEliminar() {
    const box = $("#listaEliminar");
    const list = Object.values(state.colaboradores);
    if (!list.length) {
      box.innerHTML = `<p class="muted">No hay colaboradores.</p>`;
      return;
    }
    box.innerHTML = list
      .map(
        (c) => `
      <div class="card-item">
        <div>
          <h3>${escapeHtml(c.colaborador)}</h3>
          <p>${formatCedula(c.cedula)}</p>
          <p>${escapeHtml(c.banco)} · ${escapeHtml(c.cuenta)}</p>
        </div>
        <button type="button" class="btn danger mini" data-del="${c.cedula}">Eliminar</button>
      </div>`
      )
      .join("");
  }

  function refreshRegistro() {
    selectedServicios = [];
    montosPorServicio = {};
    fechasSeleccionadas = [];
    const list = Object.values(state.colaboradores);
    const sel = $("#registroColab");
    fillSelect(
      sel,
      list.map((c) => `${c.colaborador} · ${formatCedula(c.cedula)}`),
      list.length ? "Seleccionar colaborador" : "Agrega un colaborador primero"
    );
    sel._map = list;
    fillSelect($("#registroServicio"), serviciosAll(), "Elegir servicio");
    $("#colabInfo").hidden = true;
    $("#registroActividad").value = "";
    renderServicios();
    renderFechas();
    updateRegistroTotal();
  }

  function onRegistroColabChange() {
    const sel = $("#registroColab");
    const idx = sel.selectedIndex - 1;
    const info = $("#colabInfo");
    if (idx < 0 || !sel._map?.[idx]) {
      info.hidden = true;
      return;
    }
    const c = sel._map[idx];
    info.hidden = false;
    info.innerHTML = `
      <strong>${escapeHtml(c.colaborador)}</strong><br />
      Cédula: ${formatCedula(c.cedula)}<br />
      Banco: ${escapeHtml(c.banco)} · Cuenta: ${escapeHtml(c.cuenta)}
    `;
  }

  function addServicioSeleccionado() {
    const v = $("#registroServicio").value;
    if (!v) return toast("Elige un servicio");
    if (selectedServicios.includes(v)) return toast("Ya está agregado");
    selectedServicios.push(v);
    montosPorServicio[v] = montosPorServicio[v] || "";
    renderServicios();
    updateRegistroTotal();
  }

  function renderServicios() {
    $("#serviciosChips").innerHTML = selectedServicios
      .map(
        (s) => `<span class="chip">${escapeHtml(s)} <button type="button" data-rm-serv="${escapeAttr(s)}">×</button></span>`
      )
      .join("");
    $("#montosBox").innerHTML = selectedServicios
      .map(
        (s) => `<label>${escapeHtml(s)} — monto/día
          <input data-monto="${escapeAttr(s)}" inputmode="decimal" value="${escapeAttr(montosPorServicio[s] || "")}" placeholder="0.00" />
        </label>`
      )
      .join("");
  }

  function renderFechas() {
    $("#fechasChips").innerHTML = fechasSeleccionadas
      .sort()
      .map(
        (f) => `<span class="chip">${f} <button type="button" data-rm-fecha="${f}">×</button></span>`
      )
      .join("");
  }

  function calcTotal() {
    const montos = selectedServicios.map((s) => parseMonto(montosPorServicio[s]));
    const suma = montos.reduce((a, b) => a + b, 0);
    if (selectedServicios.length > 1) return suma;
    return suma * fechasSeleccionadas.length;
  }

  function updateRegistroTotal() {
    $("#registroTotal").textContent = `Total: ${formatMonto(calcTotal())}`;
  }

  function onGuardarRegistro(e) {
    e.preventDefault();
    const sel = $("#registroColab");
    const idx = sel.selectedIndex - 1;
    const colab = sel._map?.[idx];
    if (!colab) return toast("Selecciona un colaborador");
    const actividad = $("#registroActividad").value.trim();
    if (!actividad) return toast("Describe la actividad");
    if (!selectedServicios.length) return toast("Agrega al menos un servicio");
    if (!fechasSeleccionadas.length) return toast("Agrega al menos una fecha");
    const montos = {};
    selectedServicios.forEach((s) => {
      montos[s] = parseMonto(montosPorServicio[s]);
    });
    if (Object.values(montos).every((n) => n <= 0)) return toast("Indica montos válidos");

    const registro = {
      id: Date.now(),
      colaborador: colab.colaborador,
      cedula: colab.cedula,
      cuenta: colab.cuenta,
      tipoCuenta: colab.tipoCuenta,
      banco: colab.banco,
      correoElectronico: colab.correoElectronico || "",
      actividad,
      servicios: [...selectedServicios],
      montoPorActividad: Object.values(montos).reduce((a, b) => a + b, 0),
      montosPorServicio: montos,
      fechas: fechasSeleccionadas.map((f) => new Date(f + "T12:00:00").getTime()),
      montoTotal: calcTotal(),
    };
    state.registros.push(registro);
    save();
    toast("Actividad guardada");
    showScreen("menu");
  }

  function refreshHistorial() {
    const box = $("#listaHistorial");
    const btn = $("#limpiarHistorial");
    if (!state.registros.length) {
      box.innerHTML = `<p class="muted">No hay registros.</p>`;
      btn.hidden = true;
      return;
    }
    btn.hidden = false;
    const sorted = [...state.registros].sort((a, b) => b.id - a.id);
    box.innerHTML = sorted
      .map((r) => {
        const fechas = (r.fechas || [])
          .map((t) => new Date(t).toLocaleDateString("es-DO"))
          .join(", ");
        return `<div class="card-item">
          <div>
            <h3>${escapeHtml(r.colaborador)}</h3>
            <p>${escapeHtml(r.actividad)}</p>
            <p>${escapeHtml((r.servicios || []).join(", "))}</p>
            <p>${fechas}</p>
          </div>
          <div class="amount">${formatMonto(r.montoTotal)}</div>
        </div>`;
      })
      .join("");
  }

  function resumenPorColaborador() {
    const map = new Map();
    state.registros.forEach((r) => {
      const cur = map.get(r.cedula) || {
        colaborador: r.colaborador,
        cedula: r.cedula,
        banco: r.banco,
        cuenta: r.cuenta,
        tipoCuenta: r.tipoCuenta,
        correoElectronico: r.correoElectronico,
        total: 0,
        dias: 0,
        regs: [],
      };
      cur.total += Number(r.montoTotal) || 0;
      cur.dias += (r.fechas || []).length;
      cur.regs.push(r);
      map.set(r.cedula, cur);
    });
    return [...map.values()];
  }

  function refreshResumen() {
    const rows = resumenPorColaborador();
    const total = rows.reduce((a, r) => a + r.total, 0);
    $("#totalGeneral").innerHTML = `Total General<br /><strong>${formatMonto(total)}</strong>`;
    const box = $("#listaResumen");
    if (!rows.length) {
      box.innerHTML = `<p class="muted">No hay registros de pagos.</p>`;
      return;
    }
    box.innerHTML = rows
      .map(
        (r) => `<div class="card-item">
        <div>
          <h3>${escapeHtml(r.colaborador)}</h3>
          <p>C.I.: ${formatCedula(r.cedula)}</p>
          <p>Banco: ${escapeHtml(r.banco)} · Días: ${r.dias}</p>
        </div>
        <div class="amount">${formatMonto(r.total)}</div>
      </div>`
      )
      .join("");
  }

  function buildPrintHtml() {
    const rows = resumenPorColaborador();
    const total = rows.reduce((a, r) => a + r.total, 0);
    const now = new Date().toLocaleString("es-DO");
    const blocks = rows
      .map((r) => {
        const acts = r.regs
          .map((reg, i) => {
            const serv = (reg.servicios || [])
              .map((s) => {
                const m = reg.montosPorServicio?.[s];
                return m ? `• ${s}: ${formatMonto(m)}/día` : `• ${s}`;
              })
              .join("<br />");
            return `<div class="right">
              <strong>${i + 1}. ${escapeHtml(reg.actividad)} — ${formatMonto(reg.montoTotal)}</strong><br />
              ${serv}<br />
              Días: ${(reg.fechas || []).length}
            </div>`;
          })
          .join("<hr />");
        return `<div class="block">
          <strong>Colaborador: ${escapeHtml(r.colaborador)}</strong><br />
          Cédula: ${formatCedula(r.cedula)}<br />
          Cuenta: ${escapeHtml(r.cuenta)} | Tipo: ${escapeHtml(r.tipoCuenta)}<br />
          Banco: ${escapeHtml(r.banco)}
          ${r.correoElectronico ? `<br />Correo: ${escapeHtml(r.correoElectronico)}` : ""}
          <h2 class="right">Actividades</h2>
          ${acts}
          <div class="tot">TOTAL COLABORADOR (${r.dias} días): ${formatMonto(r.total)}</div>
        </div>`;
      })
      .join("");

    return `
      <h1>RESUMEN DE PAGOS - COLABORADORES</h1>
      <div class="meta">Fecha de generación: ${escapeHtml(now)}</div>
      <p><strong>Total de Pagos:</strong> ${formatMonto(total)}<br />
      <strong>Cantidad de Colaboradores:</strong> ${rows.length}<br />
      <strong>Total de Registros:</strong> ${state.registros.length}</p>
      <h2>DETALLES POR COLABORADOR</h2>
      ${blocks || "<p>Sin registros</p>"}
      <div class="footer">Creado por Eliezer Cruz</div>
    `;
  }

  function openPreview() {
    $("#previewContent").innerHTML = buildPrintHtml();
    $("#previewDialog").showModal();
  }

  function printResumen() {
    $("#printArea").innerHTML = buildPrintHtml();
    $("#printArea").hidden = false;
    window.print();
    setTimeout(() => {
      $("#printArea").hidden = true;
    }, 500);
  }

  function colabFromRegistro(r) {
    return {
      colaborador: r.colaborador || "",
      cedula: cleanCedula(r.cedula),
      cuenta: String(r.cuenta || "").replace(/\D/g, ""),
      tipoCuenta: r.tipoCuenta || "",
      banco: r.banco || "",
      correoElectronico: r.correoElectronico || "",
    };
  }

  function normalizeRegistro(r) {
    const montos =
      r.montosPorServicio && typeof r.montosPorServicio === "object"
        ? r.montosPorServicio
        : {};
    return {
      id: r.id || Date.now(),
      colaborador: r.colaborador || "",
      cedula: cleanCedula(r.cedula),
      cuenta: String(r.cuenta || "").replace(/\D/g, ""),
      tipoCuenta: r.tipoCuenta || "",
      banco: r.banco || "",
      correoElectronico: r.correoElectronico || "",
      actividad: r.actividad || "",
      servicios: Array.isArray(r.servicios) ? r.servicios : [],
      montoPorActividad: Number(r.montoPorActividad) || 0,
      montosPorServicio: montos,
      fechas: Array.isArray(r.fechas) ? r.fechas.map(Number) : [],
      montoTotal: Number(r.montoTotal) || 0,
    };
  }

  /** Acepta backup web o el JSON de Windows/Android (BackupData). */
  function normalizeImportedBackup(data) {
    if (!data || typeof data !== "object") throw new Error("Archivo inválido");

    const next = defaultState();
    next.usuario = data.usuario || state.usuario || "";
    next.contrasena = data.contrasena || state.contrasena || "";

    // Formato Windows/Android: colaboradoresTemporales + registrosPagos
    const isDesktop =
      data.colaboradoresTemporales != null ||
      data.registrosPagos != null ||
      data.serviciosPersonalizados != null;

    if (isDesktop) {
      const colabMap = data.colaboradoresTemporales || {};
      Object.values(colabMap).forEach((r) => {
        const c = colabFromRegistro(r);
        if (c.cedula) next.colaboradores[c.cedula] = c;
      });
      next.registros = (data.registrosPagos || []).map(normalizeRegistro);
      next.serviciosExtra = [...(data.serviciosPersonalizados || [])];
      next.tiposExtra = [...(data.tiposCuentaPersonalizados || [])];
      next.bancosExtra = [...(data.bancosPersonalizados || [])];
      return next;
    }

    // Formato web nativo
    if (data.colaboradores && typeof data.colaboradores === "object") {
      Object.entries(data.colaboradores).forEach(([key, r]) => {
        const c = colabFromRegistro(r);
        const ced = c.cedula || cleanCedula(key);
        if (ced) next.colaboradores[ced] = { ...c, cedula: ced };
      });
    }
    next.registros = (data.registros || []).map(normalizeRegistro);
    next.serviciosExtra = [...(data.serviciosExtra || [])];
    next.tiposExtra = [...(data.tiposExtra || [])];
    next.bancosExtra = [...(data.bancosExtra || [])];
    return next;
  }

  function exportBackup() {
    // Exporta en formato compatible con Windows/Android + campos web
    const payload = {
      version: 1,
      fechaCreacion: new Date().toISOString(),
      registrosPagos: state.registros,
      colaboradoresTemporales: Object.fromEntries(
        Object.entries(state.colaboradores).map(([ced, c]) => [
          ced,
          { ...c, id: Date.now(), actividad: "", servicios: [], fechas: [], montoTotal: 0, montoPorActividad: 0, montosPorServicio: {} },
        ])
      ),
      serviciosPersonalizados: state.serviciosExtra,
      tiposCuentaPersonalizados: state.tiposExtra,
      bancosPersonalizados: state.bancosExtra,
      // extras web (login del iPhone)
      usuario: state.usuario,
      contrasena: state.contrasena,
      colaboradores: state.colaboradores,
      registros: state.registros,
      serviciosExtra: state.serviciosExtra,
      tiposExtra: state.tiposExtra,
      bancosExtra: state.bancosExtra,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `PagoColaborador_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    $("#backupStatus").textContent = "Backup exportado (compatible con Windows).";
  }

  function importBackup(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = String(reader.result || "").trim().replace(/^\uFEFF/, "");
        const data = JSON.parse(raw);
        state = normalizeImportedBackup(data);
        save();
        const nColab = Object.keys(state.colaboradores).length;
        const nReg = state.registros.length;
        $("#backupStatus").textContent = `Importado: ${nColab} colaborador(es), ${nReg} registro(s).`;
        toast("Backup importado");
      } catch (err) {
        console.error(err);
        $("#backupStatus").textContent = "No se pudo importar. Usa el JSON de Backup de Windows o de esta web.";
        toast("Backup inválido");
      }
    };
    reader.readAsText(file);
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function escapeAttr(s) {
    return escapeHtml(s).replace(/'/g, "&#39;");
  }

  // ----- Events -----
  function wire() {
    bindCedulaInput($("#formAgregar [name=cedula]"));
    bindCedulaInput($("#formModificar [name=cedula]"));

    $("#loginBtn").addEventListener("click", tryLogin);
    $("#setupBtn").addEventListener("click", setupAccess);
    $("#loginPass").addEventListener("keydown", (e) => {
      if (e.key === "Enter") (!state.usuario ? setupAccess : tryLogin)();
    });
    $("#openSettings").addEventListener("click", () => $("#settingsDialog").showModal());
    $("#closeSettings").addEventListener("click", () => $("#settingsDialog").close());
    $("#resetApp").addEventListener("click", () => {
      if (!confirm("¿Borrar usuario, colaboradores y pagos de este dispositivo?")) return;
      state = defaultState();
      save();
      $("#settingsDialog").close();
      refreshLogin();
      showScreen("login");
      toast("Aplicación reseteada");
    });

    $("#logoutBtn").addEventListener("click", () => {
      showScreen("login");
      refreshLogin();
    });

    $$("[data-go]").forEach((btn) =>
      btn.addEventListener("click", () => showScreen(btn.dataset.go))
    );
    $$("[data-back]").forEach((btn) =>
      btn.addEventListener("click", () => showScreen("menu"))
    );

    $("#formAgregar").addEventListener("submit", onAgregar);
    $("#addTipoBtn").addEventListener("click", () => {
      const t = prompt("Nuevo tipo de cuenta:");
      if (!t?.trim()) return;
      state.tiposExtra = [...new Set([...state.tiposExtra, t.trim()])];
      save();
      fillSelects("Add");
      $("#tipoCuentaAdd").value = t.trim();
    });
    $("#addBancoBtn").addEventListener("click", () => {
      const t = prompt("Nuevo banco:");
      if (!t?.trim()) return;
      state.bancosExtra = [...new Set([...state.bancosExtra, t.trim()])];
      save();
      fillSelects("Add");
      $("#bancoAdd").value = t.trim();
    });

    $("#modificarSelect").addEventListener("change", onModificarSelect);
    $("#formModificar").addEventListener("submit", onModificar);

    $("#listaEliminar").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-del]");
      if (!btn) return;
      const ced = btn.dataset.del;
      const name = state.colaboradores[ced]?.colaborador || ced;
      if (!confirm(`¿Eliminar a ${name}?`)) return;
      delete state.colaboradores[ced];
      save();
      refreshEliminar();
      toast("Colaborador eliminado");
    });

    $("#registroColab").addEventListener("change", onRegistroColabChange);
    $("#registroServicio").addEventListener("change", addServicioSeleccionado);
    $("#addServicioBtn").addEventListener("click", () => {
      const t = prompt("Nuevo servicio:");
      if (!t?.trim()) return;
      state.serviciosExtra = [...new Set([...state.serviciosExtra, t.trim()])];
      save();
      fillSelect($("#registroServicio"), serviciosAll(), "Elegir servicio");
      $("#registroServicio").value = t.trim();
      addServicioSeleccionado();
    });
    $("#serviciosChips").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-rm-serv]");
      if (!btn) return;
      const s = btn.dataset.rmServ;
      selectedServicios = selectedServicios.filter((x) => x !== s);
      delete montosPorServicio[s];
      renderServicios();
      updateRegistroTotal();
    });
    $("#montosBox").addEventListener("input", (e) => {
      const input = e.target.closest("[data-monto]");
      if (!input) return;
      montosPorServicio[input.dataset.monto] = input.value;
      updateRegistroTotal();
    });
    $("#addFechaBtn").addEventListener("click", () => {
      const f = $("#fechaPicker").value;
      if (!f) return toast("Elige una fecha");
      if (fechasSeleccionadas.includes(f)) return toast("Fecha ya agregada");
      fechasSeleccionadas.push(f);
      renderFechas();
      updateRegistroTotal();
    });
    $("#fechasChips").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-rm-fecha]");
      if (!btn) return;
      fechasSeleccionadas = fechasSeleccionadas.filter((x) => x !== btn.dataset.rmFecha);
      renderFechas();
      updateRegistroTotal();
    });
    $("#formRegistro").addEventListener("submit", onGuardarRegistro);

    $("#limpiarHistorial").addEventListener("click", () => {
      if (!confirm("¿Borrar todos los registros de actividad?")) return;
      state.registros = [];
      save();
      refreshHistorial();
      toast("Historial limpio");
    });

    $("#imprimirResumen").addEventListener("click", printResumen);
    $("#vistaPrevia").addEventListener("click", openPreview);
    $("#printFromPreview").addEventListener("click", () => {
      $("#printArea").innerHTML = $("#previewContent").innerHTML;
      $("#printArea").hidden = false;
      window.print();
      setTimeout(() => ($("#printArea").hidden = true), 500);
    });
    $("#closePreview").addEventListener("click", () => $("#previewDialog").close());

    $("#exportBackup").addEventListener("click", exportBackup);
    $("#importBackup").addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (file) importBackup(file);
      e.target.value = "";
    });
  }

  function registerSW() {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }

  wire();
  refreshLogin();
  showScreen("login");
  registerSW();
})();
