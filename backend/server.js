const enviarCorreo = require('./correo');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const RUTAS = {
  usuarios: path.join(__dirname, 'data', 'usuarios.json'),
  materiales: path.join(__dirname, 'data', 'materiales.json'),
  tareas: path.join(__dirname, 'data', 'tareas.json'),
  mensajes: path.join(__dirname, 'data', 'mensajes.json'),
  facturas: path.join(__dirname, 'data', 'facturas.json'),
  notificaciones: path.join(__dirname, 'data', 'notificaciones.json'),
  comprobantes: path.join(__dirname, 'data', 'comprobantes.json'),
  facturasArca: path.join(__dirname, 'data', 'facturasArca.json'),
};

// --- Funciones para leer y escribir archivos JSON ---
function leerArchivo(ruta) {
  try {
    if (!fs.existsSync(ruta)) return [];
    const contenido = fs.readFileSync(ruta, 'utf8');
    return contenido ? JSON.parse(contenido) : [];
  } catch (error) {
    console.error(`Error leyendo archivo ${ruta}:`, error);
    return [];
  }
}

function guardarArchivo(ruta, datos) {
  try {
    fs.writeFileSync(ruta, JSON.stringify(datos, null, 2));
  } catch (error) {
    console.error(`Error guardando archivo ${ruta}:`, error);
  }
}

// --- CONFIGURAR MULTER ---
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `${timestamp}-${file.originalname}`);
  },
});
const upload = multer({ storage });

// --- ENDPOINTS EXISTENTES (ya presentes) ---
app.get('/api/usuarios', (req, res) => {
  const usuarios = leerArchivo(RUTAS.usuarios);
  const usuariosSinPass = usuarios.map(({ password, ...rest }) => rest);
  res.json(usuariosSinPass);
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ mensaje: 'Email y password son obligatorios' });

  const usuarios = leerArchivo(RUTAS.usuarios);
  const usuario = usuarios.find(u => u.email === email && u.password === password);
  if (!usuario) return res.status(401).json({ mensaje: 'Email o contraseña incorrectos' });

  const { password: _, ...usuarioData } = usuario;
  res.json({ usuario: usuarioData });
});

app.get('/api/materiales/:nivel', (req, res) => {
  const nivel = req.params.nivel.toUpperCase();
  const materiales = leerArchivo(RUTAS.materiales);
  const filtrados = materiales.filter(m => m.nivel.toUpperCase() === nivel);
  res.json(filtrados);
});

app.get('/api/tareas/:nivel', (req, res) => {
  const nivel = req.params.nivel.toUpperCase();
  const tareas = leerArchivo(RUTAS.tareas);
  const filtradas = tareas.filter(t => t.nivel.toUpperCase() === nivel);
  res.json(filtradas);
});

app.post('/api/tareas/calificar', (req, res) => {
  const { nivel, tareaId, calificacion } = req.body;
  if (!nivel || !tareaId || calificacion == null) return res.status(400).json({ mensaje: 'Faltan datos' });

  const tareas = leerArchivo(RUTAS.tareas);
  const index = tareas.findIndex(t => t.id === tareaId && t.nivel.toUpperCase() === nivel.toUpperCase());
  if (index === -1) return res.status(404).json({ mensaje: 'Tarea no encontrada' });

  tareas[index].calificacion = calificacion;
  guardarArchivo(RUTAS.tareas, tareas);

  // 💌 Enviar correo al alumno si está vinculado a la tarea
  const tarea = tareas[index];
  const usuarios = leerArchivo(RUTAS.usuarios);
  const alumno = usuarios.find(u => u.id === tarea.alumnoId);
  if (alumno?.email) {
    const mensajeHTML = `
      <h2>📚 Tarea calificada</h2>
      <p>Tu tarea <strong>${tarea.titulo || tareaId}</strong> fue calificada.</p>
      <p>Obtuviste: <strong>${calificacion}</strong></p>
    `;
    enviarCorreo(alumno.email, 'Calificación de tarea', mensajeHTML);
  }

  res.json({ mensaje: 'Tarea calificada correctamente' });
});

app.get('/api/mensajes', (req, res) => {
  const mensajes = leerArchivo(RUTAS.mensajes);
  res.json(mensajes);
});

app.post('/api/mensajes', (req, res) => {
  const { emisor, texto } = req.body;
  if (!emisor || !texto) return res.status(400).json({ mensaje: 'Faltan campos emisor o texto' });

  const mensajes = leerArchivo(RUTAS.mensajes);
  const nuevoMensaje = { emisor, texto, fecha: new Date().toISOString() };
  mensajes.push(nuevoMensaje);
  guardarArchivo(RUTAS.mensajes, mensajes);
  res.status(201).json(nuevoMensaje);
});

app.get('/api/facturas/:alumnoId', (req, res) => {
  const alumnoId = parseInt(req.params.alumnoId);
  const facturas = leerArchivo(RUTAS.facturas);
  const facturasAlumno = facturas.filter(f => f.alumnoId === alumnoId);
  res.json(facturasAlumno);
});

app.post('/api/facturas/confirmar-clase', (req, res) => {
  const { alumnoId, mes, claseIndex, linkMeet } = req.body;
  if (!alumnoId || mes == null || claseIndex == null) return res.status(400).json({ mensaje: 'Faltan datos' });

  const facturas = leerArchivo(RUTAS.facturas);
  const facturaIndex = facturas.findIndex(f => f.alumnoId === alumnoId && f.mes === mes);
  if (facturaIndex === -1) return res.status(404).json({ mensaje: 'Factura no encontrada' });

  facturas[facturaIndex].clasesPagas = facturas[facturaIndex].clasesPagas || [];
  facturas[facturaIndex].clasesPagas.push({ clase: claseIndex, linkMeet });
  guardarArchivo(RUTAS.facturas, facturas);
  res.json({ mensaje: 'Clase confirmada y link guardado' });
});

app.get('/api/facturas/link/:alumnoId/:mes/:claseIndex', (req, res) => {
  const { alumnoId, mes, claseIndex } = req.params;
  const facturas = leerArchivo(RUTAS.facturas);
  const factura = facturas.find(f => f.alumnoId === parseInt(alumnoId) && f.mes === mes);

  if (!factura || !factura.clasesPagas) return res.json({ visible: false });

  const clase = factura.clasesPagas.find(c => c.clase == claseIndex);
  if (!clase) return res.json({ visible: false });

  res.json({ visible: true, link: clase.linkMeet });
});

// --- 📢 NOTIFICACIONES ---
app.get('/api/notificaciones/:alumnoId', (req, res) => {
  const alumnoId = parseInt(req.params.alumnoId);
  const todas = leerArchivo(RUTAS.notificaciones);
  const propias = todas.filter(n => n.alumnoId === alumnoId);
  res.json(propias);
});

app.post('/api/notificaciones/marcar-leida', (req, res) => {
  const { alumnoId, id } = req.body;
  const notificaciones = leerArchivo(RUTAS.notificaciones);
  const index = notificaciones.findIndex(n => n.id === id && n.alumnoId === alumnoId);
  if (index === -1) return res.status(404).json({ mensaje: 'Notificación no encontrada' });

  notificaciones[index].read = true;
  guardarArchivo(RUTAS.notificaciones, notificaciones);
  res.json({ mensaje: 'Notificación marcada como leída' });
});

app.post('/api/notificaciones', (req, res) => {
  const { alumnoId, text, icon } = req.body;
  if (!alumnoId || !text) return res.status(400).json({ mensaje: 'Faltan datos' });

  const notificaciones = leerArchivo(RUTAS.notificaciones);
  const nueva = {
    id: Date.now(),
    alumnoId,
    icon: icon || "🔔",
    text,
    read: false
  };
  notificaciones.push(nueva);
  guardarArchivo(RUTAS.notificaciones, notificaciones);

  // 💌 Enviar correo (buscamos el mail del alumno)
  const usuarios = leerArchivo(RUTAS.usuarios);
  const alumno = usuarios.find(u => u.id === alumnoId);

  const mensajeHTML = `
    <h2>📢 Nueva notificación</h2>
    <p>${text}</p>
    <hr />
    <p>Entrá a la plataforma para más información.</p>
  `;

  const alumnos = leerArchivo(RUTAS.usuarios).filter(u => u.rol === 'alumno');
  alumnos.forEach(alumno => {
    if (alumno.email) {
      enviarCorreo(alumno.email, 'Nueva notificación en la plataforma', mensajeHTML);
    }
  });


  res.status(201).json(nueva);
});

// === NUEVOS ENDPOINTS PARA SUBIR ARCHIVOS ===
app.post('/api/materiales', (req, res) => {
  const nuevoMaterial = req.body;

  if (!nuevoMaterial.nivel || !nuevoMaterial.titulo || !nuevoMaterial.archivo) {
    return res.status(400).json({ mensaje: 'Faltan datos del material' });
  }

  const materiales = leerArchivo(RUTAS.materiales);
  nuevoMaterial.id = Date.now();
  nuevoMaterial.fecha = new Date().toISOString();
  materiales.push(nuevoMaterial);
  guardarArchivo(RUTAS.materiales, materiales);

  // 💌 Enviar correos a los alumnos del mismo nivel
  const usuarios = leerArchivo(RUTAS.usuarios);
  const alumnos = usuarios.filter(u =>
    u.rol === 'alumno' &&
    u.nivel?.toUpperCase() === nuevoMaterial.nivel.toUpperCase() &&
    u.email
  );

  const mensajeHTML = `
    <h2>📥 Nuevo material disponible</h2>
    <p>Ya podés acceder al nuevo material: <strong>${nuevoMaterial.titulo}</strong>.</p>
    <p>Nivel: <strong>${nuevoMaterial.nivel}</strong></p>
    <hr />
    <p>Entrá a la plataforma para verlo.</p>
  `;

  alumnos.forEach(alumno => {
    enviarCorreo(alumno.email, 'Nuevo material disponible', mensajeHTML);
  });

  res.status(201).json({ mensaje: 'Material subido y correos enviados correctamente' });
});

// Ver comprobantes de alumno
app.get('/api/comprobantes/:alumnoId', (req, res) => {
  const comprobantes = leerArchivo(RUTAS.comprobantes);
  const propios = comprobantes.filter(c => c.alumnoId === parseInt(req.params.alumnoId));
  res.json(propios);
});

// Subir comprobante de pago
app.post('/api/comprobantes', upload.single('archivo'), (req, res) => {
  const { alumnoId, mes } = req.body;
  if (!alumnoId || !mes || !req.file) return res.status(400).json({ mensaje: 'Faltan datos o archivo' });

  const comprobantes = leerArchivo(RUTAS.comprobantes);
  const nuevo = {
    id: Date.now(),
    alumnoId: parseInt(alumnoId),
    mes,
    archivo: req.file.filename,
    fecha: new Date().toISOString()
  };
  comprobantes.push(nuevo);
  guardarArchivo(RUTAS.comprobantes, comprobantes);

  // 💌 Enviar correo al alumno
  const usuarios = leerArchivo(RUTAS.usuarios);
  const alumno = usuarios.find(u => u.id === parseInt(alumnoId));
  if (alumno?.email) {
    const mensajeHTML = `
      <h2>📤 Comprobante recibido</h2>
      <p>Gracias por enviar tu comprobante del mes <strong>${mes}</strong>.</p>
      <p>Nos comunicaremos si necesitamos algo más.</p>
    `;
    enviarCorreo(alumno.email, 'Comprobante de pago recibido', mensajeHTML);
  }

  res.status(201).json({ mensaje: 'Comprobante cargado correctamente', archivo: req.file.filename });
});

// Ver facturas ARCA
app.get('/api/facturas-arca/:alumnoId', (req, res) => {
  const arca = leerArchivo(RUTAS.facturasArca);
  const propias = arca.filter(f => f.alumnoId === parseInt(req.params.alumnoId));
  res.json(propias);
});

// Subir factura ARCA
app.post('/api/facturas-arca', upload.single('archivo'), (req, res) => {
  const { alumnoId, mes } = req.body;
  if (!alumnoId || !mes || !req.file) return res.status(400).json({ mensaje: 'Faltan datos o archivo' });

  const arca = leerArchivo(RUTAS.facturasArca);
  const nueva = {
    id: Date.now(),
    alumnoId: parseInt(alumnoId),
    mes,
    archivo: req.file.filename,
    fecha: new Date().toISOString()
  };
  arca.push(nueva);
  guardarArchivo(RUTAS.facturasArca, arca);

  // 💌 Enviar correo al alumno
  const usuarios = leerArchivo(RUTAS.usuarios);
  const alumno = usuarios.find(u => u.id === parseInt(alumnoId));
  if (alumno?.email) {
    const mensajeHTML = `
      <h2>📄 Factura ARCA cargada</h2>
      <p>Tu factura del mes <strong>${mes}</strong> fue recibida correctamente.</p>
      <p>Gracias por enviarla.</p>
    `;
    enviarCorreo(alumno.email, 'Factura ARCA recibida', mensajeHTML);
  }

  res.status(201).json({ mensaje: 'Factura ARCA cargada correctamente', archivo: req.file.filename });
});
// === ENDPOINT PARA PROFESORES ===
app.get('/api/profesores', (req, res) => {
  const profesores = leerArchivo(path.join(__dirname, 'data', 'profesores.json'));
  res.json(profesores);
});

app.post('/api/profesores', (req, res) => {
  const { nombre, email } = req.body;
  if (!nombre || !email) return res.status(400).json({ mensaje: 'Faltan nombre o email' });

  const rutaProfesores = path.join(__dirname, 'data', 'profesores.json');
  const profesores = leerArchivo(rutaProfesores);

  const nuevo = {
    id: Date.now(),
    nombre,
    email,
    fechaRegistro: new Date().toISOString()
  };

  profesores.push(nuevo);
  guardarArchivo(rutaProfesores, profesores);

  res.status(201).json({ mensaje: 'Profesor agregado con éxito', profesor: nuevo });
});

// --- Iniciar servidor ---
app.listen(PORT, () => {
  console.log(`✅ Servidor backend corriendo en http://localhost:${PORT}`);
});
