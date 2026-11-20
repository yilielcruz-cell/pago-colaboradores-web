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
    recordarCredenciales: true,
    sesionActiva: false,
    colaboradores: {},
    registros: [],
    serviciosExtra: [],
    serviciosOcultos: [],
    tiposExtra: [],
    bancosExtra: [],
    empresas: ["Audiovisualia"],
    empresaActual: "Audiovisualia",
  });

  const COLORES_CAJA = [
    "#F0F8FF",
    "#FFE4E1",
    "#F0FFF0",
    "#FFF8F0",
    "#E6E6FA",
    "#E0F6FF",
    "#F5F5DC",
    "#B0E0E6",
  ];

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
      const parsed = JSON.parse(raw);
      const base = defaultState();
      return {
        ...base,
        ...parsed,
        empresas: [...new Set([...(base.empresas || []), ...((parsed && parsed.empresas) || [])])],
        empresaActual: parsed.empresaActual || base.empresaActual,
      };
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
    const ocultos = new Set(state.serviciosOcultos || []);
    return [...new Set([...SERVICIOS_BASE, ...state.serviciosExtra])]
      .filter((s) => !ocultos.has(s))
      .sort();
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
    const remember = $("#rememberCreds");
    if (remember) remember.checked = state.recordarCredenciales !== false;
    if (state.recordarCredenciales && state.usuario) {
      $("#loginUser").value = state.usuario;
      $("#loginPass").value = state.contrasena || "";
    }
  }

  function applyRememberFlag() {
    state.recordarCredenciales = !!$("#rememberCreds")?.checked;
  }

  function tryLogin() {
    const u = $("#loginUser").value.trim();
    const p = $("#loginPass").value;
    if (!u || !p) return toast("Completa usuario y contraseña");
    if (u === state.usuario && p === state.contrasena) {
      applyRememberFlag();
      state.sesionActiva = true;
      if (!state.recordarCredenciales) {
        // no deja la contraseña en el formulario
        $("#loginPass").value = "";
      }
      save();
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
    applyRememberFlag();
    state.usuario = u;
    state.contrasena = p;
    state.sesionActiva = true;
    save();
    toast(
      state.recordarCredenciales
        ? "Acceso creado y guardado en este iPhone"
        : "Acceso creado"
    );
    showScreen("menu");
  }

  function openSettingsDialog() {
    $("#settingsUser").value = state.usuario || "";
    $("#settingsPass").value = state.contrasena || "";
    $("#settingsRemember").checked = state.recordarCredenciales !== false;
    $("#settingsDialog").showModal();
  }

  function saveCredentialsFromSettings() {
    const u = $("#settingsUser").value.trim();
    const p = $("#settingsPass").value;
    if (!u || !p) return toast("Completa usuario y contraseña");
    if (p.length < 4) return toast("La contraseña debe tener al menos 4 caracteres");
    state.usuario = u;
    state.contrasena = p;
    state.recordarCredenciales = !!$("#settingsRemember")?.checked;
    save();
    refreshLogin();
    toast("Usuario y contraseña guardados");
    $("#settingsDialog").close();
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
    const box = $("#serviciosChips");
    if (!selectedServicios.length) {
      box.innerHTML = `<p class="muted" style="margin:0">Ningún servicio seleccionado.</p>`;
      return;
    }
    box.innerHTML = selectedServicios
      .map(
        (s) => `<div class="serv-row">
          <div class="serv-name">• ${escapeHtml(s)}</div>
          <input class="serv-monto" data-monto="${escapeAttr(s)}" inputmode="decimal" value="${escapeAttr(
          montosPorServicio[s] || ""
        )}" placeholder="Monto/día" aria-label="Monto de ${escapeAttr(s)}" />
          <button type="button" class="icon-btn del" data-rm-serv="${escapeAttr(
            s
          )}" title="Eliminar servicio" aria-label="Eliminar ${escapeAttr(s)}">🗑</button>
        </div>`
      )
      .join("");
  }

  function eliminarServicioDeLista() {
    const v = $("#registroServicio").value;
    if (!v) return toast("Elige un servicio de la lista");
    const esBase = SERVICIOS_BASE.includes(v);
    const esExtra = state.serviciosExtra.includes(v);
    if (!esExtra && esBase) {
      if (!confirm(`“${v}” es un servicio predeterminado. ¿Ocultarlo de la lista en este iPhone?`)) return;
      state.serviciosExtra = state.serviciosExtra.filter((s) => s !== v);
      state.serviciosOcultos = [...new Set([...(state.serviciosOcultos || []), v])];
    } else {
      if (!confirm(`¿Eliminar “${v}” de la lista de servicios?`)) return;
      state.serviciosExtra = state.serviciosExtra.filter((s) => s !== v);
    }
    selectedServicios = selectedServicios.filter((s) => s !== v);
    delete montosPorServicio[v];
    save();
    fillSelect($("#registroServicio"), serviciosAll(), "Elegir servicio");
    renderServicios();
    updateRegistroTotal();
    toast("Servicio eliminado de la lista");
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

  function rememberEmpresa(nombre) {
    const n = String(nombre || "").trim();
    if (!n) return "";
    state.empresaActual = n;
    if (!state.empresas.includes(n)) state.empresas = [...state.empresas, n].sort();
    save();
    return n;
  }

  function fillEmpresasUI() {
    const input = $("#empresaReporte");
    const list = $("#empresasList");
    if (!input || !list) return;
    input.value = state.empresaActual || "";
    list.innerHTML = (state.empresas || [])
      .map((e) => `<option value="${escapeAttr(e)}"></option>`)
      .join("");
  }

  function refreshResumen() {
    fillEmpresasUI();
    const rows = resumenPorColaborador();
    const total = rows.reduce((a, r) => a + r.total, 0);
    $("#totalGeneral").innerHTML = `Total General<br /><strong>${formatMonto(total)}</strong>`;
    const box = $("#listaResumen");
    if (!rows.length) {
      box.innerHTML = `<p class="muted">No hay registros de pagos. Usa “+ Agregar registro”.</p>`;
      return;
    }
    box.innerHTML = rows
      .map((r) => {
        const regsHtml = r.regs
          .map((reg) => {
            const serv = (reg.servicios || [])
              .map((s) => {
                const m = Number(reg.montosPorServicio?.[s] || 0);
                return m > 0 ? `• ${s}: ${formatMonto(m)}` : `• ${s}`;
              })
              .join("<br />");
            return `<div class="reg-row" data-reg-id="${reg.id}">
              <div class="reg-main">
                <strong>${escapeHtml(reg.actividad || "Sin actividad")}</strong>
                <p>${serv || "Sin servicios"}</p>
                <p>${escapeHtml(formatFechas(reg.fechas) || "Sin fechas")} · ${
              (reg.fechas || []).length
            } día(s)</p>
              </div>
              <div class="reg-actions">
                <span class="amount">${formatMonto(reg.montoTotal)}</span>
                <div class="row" style="gap:6px;margin:0">
                  <button type="button" class="icon-btn edit" data-edit-reg="${reg.id}" title="Editar" aria-label="Editar">✎</button>
                  <button type="button" class="icon-btn del" data-del-reg="${reg.id}" title="Eliminar" aria-label="Eliminar">🗑</button>
                </div>
              </div>
            </div>`;
          })
          .join("");
        return `<div class="resumen-group">
          <div class="resumen-group-head">
            <div>
              <h3>${escapeHtml(r.colaborador)}</h3>
              <p>C.I.: ${formatCedula(r.cedula)}</p>
              <p>Banco: ${escapeHtml(r.banco)} · Días: ${r.dias}</p>
            </div>
            <div class="amount">${formatMonto(r.total)}</div>
          </div>
          ${regsHtml}
        </div>`;
      })
      .join("");
  }

  function fechasToInput(fechas) {
    return (fechas || [])
      .map((t) => {
        const d = new Date(Number(t));
        if (Number.isNaN(d.getTime())) return "";
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
      })
      .filter(Boolean)
      .join(",");
  }

  function parseFechasInput(text) {
    return String(text || "")
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => new Date(s + "T12:00:00").getTime())
      .filter((n) => !Number.isNaN(n));
  }

  function parseServiciosInput(text) {
    const servicios = [];
    const montos = {};
    String(text || "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .forEach((line) => {
        const [name, monto] = line.split("|").map((x) => x.trim());
        if (!name) return;
        servicios.push(name);
        if (monto) montos[name] = parseMonto(monto);
      });
    return { servicios, montos };
  }

  function openEditRegistro(id, isNew = false) {
    const list = Object.values(state.colaboradores);
    fillSelect(
      $("#editColab"),
      list.map((c) => `${c.colaborador} · ${formatCedula(c.cedula)}`),
      list.length ? "Seleccionar colaborador" : "No hay colaboradores"
    );
    $("#editColab")._map = list;

    $("#editRegistroTitle").textContent = isNew ? "Agregar registro" : "Editar registro";
    $("#editRegistroId").value = isNew ? "" : String(id);

    if (!isNew) {
      const reg = state.registros.find((r) => String(r.id) === String(id));
      if (!reg) return toast("Registro no encontrado");
      const idx = list.findIndex((c) => c.cedula === reg.cedula);
      $("#editColab").selectedIndex = idx >= 0 ? idx + 1 : 0;
      $("#editActividad").value = reg.actividad || "";
      $("#editServicios").value = (reg.servicios || [])
        .map((s) => {
          const m = reg.montosPorServicio?.[s];
          return m ? `${s}|${m}` : s;
        })
        .join("\n");
      $("#editFechas").value = fechasToInput(reg.fechas);
      $("#editMontoTotal").value = String(reg.montoTotal ?? "");
    } else {
      $("#editColab").selectedIndex = 0;
      $("#editActividad").value = "";
      $("#editServicios").value = "";
      $("#editFechas").value = "";
      $("#editMontoTotal").value = "";
    }
    $("#editRegistroDialog").showModal();
  }

  function saveEditRegistro(e) {
    e.preventDefault();
    const sel = $("#editColab");
    const idx = sel.selectedIndex - 1;
    const colab = sel._map?.[idx];
    if (!colab) return toast("Selecciona un colaborador");
    const actividad = $("#editActividad").value.trim();
    if (!actividad) return toast("La actividad es requerida");
    const { servicios, montos } = parseServiciosInput($("#editServicios").value);
    const fechas = parseFechasInput($("#editFechas").value);
    const montoTotal = parseMonto($("#editMontoTotal").value);
    if (montoTotal <= 0) return toast("Indica un monto total válido");

    const idVal = $("#editRegistroId").value;
    const base = {
      colaborador: colab.colaborador,
      cedula: colab.cedula,
      cuenta: colab.cuenta,
      tipoCuenta: colab.tipoCuenta,
      banco: colab.banco,
      correoElectronico: colab.correoElectronico || "",
      actividad,
      servicios,
      montosPorServicio: montos,
      montoPorActividad:
        Object.values(montos).reduce((a, b) => a + b, 0) || montoTotal,
      fechas,
      montoTotal,
    };

    if (idVal) {
      state.registros = state.registros.map((r) =>
        String(r.id) === String(idVal) ? { ...r, ...base } : r
      );
      toast("Registro actualizado");
    } else {
      state.registros.push({ id: Date.now(), ...base });
      toast("Registro agregado");
    }
    save();
    $("#editRegistroDialog").close();
    refreshResumen();
  }

  function deleteRegistro(id) {
    const reg = state.registros.find((r) => String(r.id) === String(id));
    if (!reg) return;
    if (!confirm(`¿Eliminar la actividad “${reg.actividad}”?`)) return;
    state.registros = state.registros.filter((r) => String(r.id) !== String(id));
    save();
    refreshResumen();
    toast("Registro eliminado");
  }

  function formatFechas(fechas) {
    return (fechas || [])
      .map((t) => {
        const d = new Date(Number(t));
        if (Number.isNaN(d.getTime())) return "";
        return d.toLocaleDateString("es-DO", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
      })
      .filter(Boolean)
      .join(", ");
  }

  function buildPrintHtml() {
    const empresa =
      rememberEmpresa($("#empresaReporte")?.value || state.empresaActual) ||
      "Sin compañía";
    const rows = resumenPorColaborador();
    const total = rows.reduce((a, r) => a + r.total, 0);
    const totalServicios = new Set(
      state.registros.flatMap((r) => r.servicios || [])
    ).size;

    const blocks = rows
      .map((r, idx) => {
        const bg = COLORES_CAJA[idx % COLORES_CAJA.length];
        const body = r.regs
          .map((reg) => {
            const servicios = (reg.servicios || [])
              .map((s) => {
                const m = Number(reg.montosPorServicio?.[s] || 0);
                const label = m > 0 ? `${s} (${formatMonto(m)})` : s;
                return `<div class="bullet">- ${escapeHtml(label)}</div>`;
              })
              .join("");
            const fechasTxt = formatFechas(reg.fechas);
            return `
              <div class="sec-title">ACTIVIDAD:</div>
              <div class="bullet">* ${escapeHtml(reg.actividad || "")}</div>
              <div class="sec-title">SERVICIOS:</div>
              ${servicios || `<div class="bullet">-</div>`}
              ${
                fechasTxt
                  ? `<div class="bullet" style="margin-top:4px">Fechas: ${escapeHtml(
                      fechasTxt
                    )}</div>`
                  : ""
              }
              <div class="subtotal">Sub-total: ${formatMonto(reg.montoTotal)}</div>
            `;
          })
          .join("");

        return `
          <div class="colab-name">${escapeHtml(r.colaborador)}</div>
          <div class="colab-box" style="background:${bg}">
            <div class="meta-line">
              Cédula: ${formatCedula(r.cedula)} &nbsp;|&nbsp;
              Banco: ${escapeHtml(r.banco || "")} &nbsp;|&nbsp;
              Tipo: ${escapeHtml(r.tipoCuenta || "")} &nbsp;|&nbsp;
              Cuenta: ${escapeHtml(r.cuenta || "")}
            </div>
            ${body}
            <div class="colab-foot">${formatMonto(r.total)} | Días: ${r.dias}</div>
          </div>
        `;
      })
      .join("");

    return `
      <div class="pdf-header">
        <h1 class="pdf-company">${escapeHtml(empresa)}</h1>
        <div class="pdf-totals">
          <div class="pay">TOTAL A PAGAR: ${formatMonto(total)}</div>
          <div>Colaboradores: ${rows.length}</div>
          <div>Registros: ${state.registros.length}</div>
          <div>Servicios: ${totalServicios}</div>
        </div>
      </div>
      ${blocks || "<p>Sin registros</p>"}
      <div class="footer">Creado por Eliezer Cruz</div>
    `;
  }

  function requireEmpresa() {
    if (!($("#empresaReporte")?.value || "").trim()) {
      toast("Escribe el nombre de la compañía");
      $("#empresaReporte")?.focus();
      return false;
    }
    return true;
  }

  function openPreview() {
    if (!requireEmpresa()) return;
    $("#previewContent").innerHTML = buildPrintHtml();
    $("#previewDialog").showModal();
  }

  function runPrint(html) {
    // Cierra la vista previa para que no se imprima encima
    try {
      $("#previewDialog")?.close();
    } catch (_) {}
    const area = $("#printArea");
    area.innerHTML = html;
    area.hidden = false;
    area.setAttribute("aria-hidden", "false");
    // Pequeña espera para que Safari pinte solo #printArea
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        area.hidden = true;
        area.innerHTML = "";
        area.setAttribute("aria-hidden", "true");
      }, 400);
    }, 50);
  }

  function printResumen() {
    if (!requireEmpresa()) return;
    runPrint(buildPrintHtml());
  }

  function buildShareText() {
    const empresa =
      rememberEmpresa($("#empresaReporte")?.value || state.empresaActual) ||
      "Sin compañía";
    const rows = resumenPorColaborador();
    const total = rows.reduce((a, r) => a + r.total, 0);
    const lines = [
      empresa,
      `TOTAL A PAGAR: ${formatMonto(total)}`,
      `Colaboradores: ${rows.length}`,
      "",
    ];
    rows.forEach((r) => {
      lines.push(r.colaborador);
      lines.push(
        `Cédula: ${formatCedula(r.cedula)} | Banco: ${r.banco} | Tipo: ${r.tipoCuenta} | Cuenta: ${r.cuenta}`
      );
      r.regs.forEach((reg) => {
        lines.push(`ACTIVIDAD: ${reg.actividad}`);
        (reg.servicios || []).forEach((s) => {
          const m = Number(reg.montosPorServicio?.[s] || 0);
          lines.push(m > 0 ? `- ${s} (${formatMonto(m)})` : `- ${s}`);
        });
        const fechasTxt = formatFechas(reg.fechas);
        if (fechasTxt) lines.push(`Fechas: ${fechasTxt}`);
        lines.push(`Sub-total: ${formatMonto(reg.montoTotal)}`);
      });
      lines.push(`${formatMonto(r.total)} | Días: ${r.dias}`);
      lines.push("");
    });
    return lines.join("\n");
  }

  async function compartirResumen() {
    if (!requireEmpresa()) return;
    const empresa =
      rememberEmpresa($("#empresaReporte")?.value || state.empresaActual) ||
      "Reporte";
    const html = buildPrintHtml();
    const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(
      empresa
    )}</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:24px;font-size:12.5px;line-height:1.4}
        .pdf-header{display:flex;justify-content:space-between;gap:16px;margin-bottom:18px}
        .pdf-company{font-size:28px;font-weight:800;margin:0}
        .pdf-totals{text-align:right;font-size:12px}
        .pdf-totals .pay{font-size:14px;font-weight:800;margin-bottom:4px}
        .colab-name{font-size:16px;font-weight:800;margin:14px 0 6px}
        .colab-box{border-radius:14px;padding:12px 14px;margin:0 0 8px}
        .meta-line{font-size:11.5px;margin-bottom:8px}
        .sec-title{font-weight:800;font-size:12px;margin:8px 0 2px;text-transform:uppercase}
        .bullet{margin:1px 0 1px 8px}
        .subtotal{font-weight:700;margin:4px 0 8px 10px}
        .colab-foot{text-align:right;font-weight:800;margin-top:6px;font-size:13px}
      </style></head><body>${html}</body></html>`;
    const safeName = empresa.replace(/[\\/:*?"<>|]+/g, "_").slice(0, 40);
    const file = new File([fullHtml], `Resumen_${safeName}.html`, {
      type: "text/html",
    });
    const text = buildShareText();

    try {
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Resumen ${empresa}`,
        });
        toast("Compartido");
        return;
      }
      if (navigator.share) {
        await navigator.share({
          title: `Resumen ${empresa}`,
          text,
        });
        toast("Compartido");
        return;
      }
    } catch (err) {
      if (err && err.name === "AbortError") return;
    }
    // Fallback: imprimir / guardar PDF
    toast("Usa Imprimir → Guardar en PDF / Compartir");
    runPrint(html);
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

  function asArray(value) {
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object") return Object.values(value);
    return [];
  }

  function asObjectMap(value) {
    if (!value) return {};
    if (Array.isArray(value)) {
      const map = {};
      value.forEach((r) => {
        const ced = cleanCedula(r?.cedula);
        if (ced) map[ced] = r;
      });
      return map;
    }
    if (typeof value === "object") return value;
    return {};
  }

  /** Acepta backup web, BackupData Windows/Android o app_data.json. */
  function normalizeImportedBackup(data) {
    if (!data || typeof data !== "object") throw new Error("Archivo inválido");

    const next = defaultState();
    next.usuario = data.usuario || state.usuario || "";
    next.contrasena = data.contrasena || state.contrasena || "";

    const desktopRegs = data.registrosPagos ?? data.registrosPago;
    const desktopColabs = data.colaboradoresTemporales;
    const isDesktop =
      desktopColabs != null ||
      desktopRegs != null ||
      data.serviciosPersonalizados != null ||
      data.tiposCuentaPersonalizados != null ||
      data.bancosPersonalizados != null;

    if (isDesktop) {
      const colabMap = asObjectMap(desktopColabs);
      Object.values(colabMap).forEach((r) => {
        const c = colabFromRegistro(r || {});
        if (c.cedula) next.colaboradores[c.cedula] = c;
      });
      // Si solo hay registros, también arma colaboradores desde ellos
      asArray(desktopRegs).forEach((r) => {
        const c = colabFromRegistro(r || {});
        if (c.cedula && !next.colaboradores[c.cedula]) next.colaboradores[c.cedula] = c;
      });
      next.registros = asArray(desktopRegs).map(normalizeRegistro);
      next.serviciosExtra = asArray(data.serviciosPersonalizados);
      next.tiposExtra = asArray(data.tiposCuentaPersonalizados);
      next.bancosExtra = asArray(data.bancosPersonalizados);
      return next;
    }

    // Formato web nativo
    if (data.colaboradores && typeof data.colaboradores === "object") {
      Object.entries(asObjectMap(data.colaboradores)).forEach(([key, r]) => {
        const c = colabFromRegistro(r || {});
        const ced = c.cedula || cleanCedula(key);
        if (ced) next.colaboradores[ced] = { ...c, cedula: ced };
      });
    }
    next.registros = asArray(data.registros).map(normalizeRegistro);
    next.serviciosExtra = asArray(data.serviciosExtra);
    next.tiposExtra = asArray(data.tiposExtra);
    next.bancosExtra = asArray(data.bancosExtra);
    next.empresas = [
      ...new Set([
        ...(defaultState().empresas || []),
        ...asArray(data.empresas),
        ...(data.empresaActual ? [data.empresaActual] : []),
      ]),
    ];
    next.empresaActual = data.empresaActual || state.empresaActual || next.empresas[0] || "";
    return next;
  }

  function applyImportedText(rawText, sourceLabel) {
    const raw = String(rawText || "").trim().replace(/^\uFEFF/, "");
    if (!raw) throw new Error("El texto está vacío");
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error("No es un JSON válido. Abre el archivo en Notas, copia TODO y pégalo aquí.");
    }
    state = normalizeImportedBackup(data);
    save();
    const nColab = Object.keys(state.colaboradores).length;
    const nReg = state.registros.length;
    if (nColab === 0 && nReg === 0) {
      $("#backupStatus").textContent =
        `Se leyó el archivo (${sourceLabel}), pero venía sin colaboradores ni pagos. Exporta de nuevo en Windows: Backup → Exportar Datos.`;
      toast("JSON vacío de datos");
      return;
    }
    $("#backupStatus").textContent = `Importado (${sourceLabel}): ${nColab} colaborador(es), ${nReg} registro(s).`;
    toast("Backup importado");
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
    if (!file) {
      $("#backupStatus").textContent = "No se eligió archivo.";
      return;
    }
    $("#backupStatus").textContent = `Leyendo ${file.name || "archivo"}…`;
    const reader = new FileReader();
    reader.onerror = () => {
      $("#backupStatus").textContent =
        "iPhone no pudo leer el archivo. Ábrelo en Notas, copia todo y usa “Importar texto pegado”.";
      toast("Usa pegar JSON");
    };
    reader.onload = () => {
      try {
        applyImportedText(reader.result, file.name || "archivo");
      } catch (err) {
        console.error(err);
        $("#backupStatus").textContent = err.message || "No se pudo importar el archivo.";
        toast("Backup inválido");
      }
    };
    // text/plain ayuda en Safari iOS
    try {
      reader.readAsText(file, "UTF-8");
    } catch {
      reader.readAsText(file);
    }
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
    $("#rememberCreds")?.addEventListener("change", () => {
      applyRememberFlag();
      save();
    });
    $("#openSettings").addEventListener("click", openSettingsDialog);
    $("#closeSettings").addEventListener("click", () => $("#settingsDialog").close());
    $("#saveCredsBtn").addEventListener("click", saveCredentialsFromSettings);
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
      state.sesionActiva = false;
      save();
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
      // Si estaba oculto, al crearlo/agregarlo de nuevo lo mostramos
      state.serviciosOcultos = (state.serviciosOcultos || []).filter((s) => s !== t.trim());
      state.serviciosExtra = [...new Set([...state.serviciosExtra, t.trim()])];
      save();
      fillSelect($("#registroServicio"), serviciosAll(), "Elegir servicio");
      $("#registroServicio").value = t.trim();
      addServicioSeleccionado();
    });
    $("#delServicioListaBtn").addEventListener("click", eliminarServicioDeLista);
    $("#serviciosChips").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-rm-serv]");
      if (!btn) return;
      const s = btn.dataset.rmServ;
      selectedServicios = selectedServicios.filter((x) => x !== s);
      delete montosPorServicio[s];
      renderServicios();
      updateRegistroTotal();
    });
    $("#serviciosChips").addEventListener("input", (e) => {
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

    $("#listaResumen").addEventListener("click", (e) => {
      const editBtn = e.target.closest("[data-edit-reg]");
      if (editBtn) {
        openEditRegistro(editBtn.dataset.editReg, false);
        return;
      }
      const delBtn = e.target.closest("[data-del-reg]");
      if (delBtn) deleteRegistro(delBtn.dataset.delReg);
    });
    $("#irRegistroDesdeResumen").addEventListener("click", () => {
      if (!Object.keys(state.colaboradores).length) {
        toast("Agrega un colaborador primero");
        return showScreen("agregar");
      }
      openEditRegistro(null, true);
    });
    $("#formEditRegistro").addEventListener("submit", saveEditRegistro);
    $("#cancelEditRegistro").addEventListener("click", () =>
      $("#editRegistroDialog").close()
    );

    $("#imprimirResumen").addEventListener("click", printResumen);
    $("#compartirResumen").addEventListener("click", () => compartirResumen());
    $("#vistaPrevia").addEventListener("click", openPreview);
    $("#printFromPreview").addEventListener("click", () => {
      runPrint($("#previewContent").innerHTML);
    });
    $("#shareFromPreview").addEventListener("click", () => compartirResumen());
    $("#closePreview").addEventListener("click", () => $("#previewDialog").close());

    $("#exportBackup").addEventListener("click", exportBackup);
    $("#importBackup").addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (file) importBackup(file);
      e.target.value = "";
    });
    $("#importPasteBtn").addEventListener("click", () => {
      try {
        applyImportedText($("#pasteBackup").value, "texto pegado");
      } catch (err) {
        $("#backupStatus").textContent = err.message || "No se pudo importar.";
        toast("Backup inválido");
      }
    });
    $("#importClipboardBtn").addEventListener("click", async () => {
      try {
        if (!navigator.clipboard?.readText) {
          throw new Error("Este iPhone no permite leer el portapapeles aquí. Pega manualmente en la caja de texto.");
        }
        const text = await navigator.clipboard.readText();
        $("#pasteBackup").value = text;
        applyImportedText(text, "portapapeles");
      } catch (err) {
        $("#backupStatus").textContent = err.message || "No se pudo leer el portapapeles.";
        toast("Pega el JSON a mano");
      }
    });
  }

  function registerSW() {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }

  wire();
  refreshLogin();
  // Si guardó credenciales y dejó sesión activa, entra directo
  if (state.sesionActiva && state.recordarCredenciales && state.usuario && state.contrasena) {
    showScreen("menu");
  } else {
    showScreen("login");
  }
  registerSW();
})();
