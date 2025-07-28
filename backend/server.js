const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const nodemailer = require('nodemailer');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Carpetas para uploads y facturas
const uploadFolder = './uploads';
const facturasFolder = './facturas';
if (!fs.existsSync(uploadFolder)) fs.mkdirSync(uploadFolder);
if (!fs.existsSync(facturasFolder)) fs.mkdirSync(facturasFolder);

const storageUploads = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadFolder),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage: storageUploads });

// Funciones para manejar facturas.json
const facturasPath = path.join(__dirname, 'data', 'facturas.json');

function leerFacturas() {
  if (!fs.existsSync(facturasPath)) return [];
  const data = fs.readFileSync(facturasPath, 'utf-8');
  return JSON.parse(data);
}

function guardarFacturas(facturas) {
  fs.writeFileSync(facturasPath, JSON.stringify(facturas, null, 2));
}

// Transporter nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'thequeenstea.ingles@gmail.com',
    pass: 'wijy npdc chse pjsy' // Reemplaza con tu contraseña de aplicación
  }
});

// Simulación de clases
let clases = [
  { id: 1, mes: 'Julio 2025', numero: 1, linkMeet: 'https://meet.google.com/abc-123', pagada: false, alumnoEmail: 'alumno1@example.com' },
  { id: 2, mes: 'Julio 2025', numero: 2, linkMeet: 'https://meet.google.com/def-456', pagada: false, alumnoEmail: 'alumno1@example.com' },
  { id: 3, mes: 'Julio 2025', numero: 3, linkMeet: 'https://meet.google.com/ghi-789', pagada: false, alumnoEmail: 'alumno2@example.com' },
];

// Ruta para subir comprobante de pago (ya la tenías)
app.post('/api/subir-comprobante', upload.single('comprobante'), async (req, res) => {
  const archivo = req.file;
  const { nombreAlumno, emailAlumno, claseId, facturaId } = req.body;

  if (!archivo || !nombreAlumno || !emailAlumno || !claseId || !facturaId) {
    return res.status(400).json({ mensaje: 'Faltan datos o archivo.' });
  }

  const mensajeAdmin = {
    from: 'The Queen’s Tea <thequeenstea.ingles@gmail.com>',
    to: 'thequeenstea.ingles@gmail.com',
    subject: `Nuevo comprobante de pago de ${nombreAlumno}`,
    text: `El alumno ${nombreAlumno} (${emailAlumno}) subió un comprobante.\n\nClase ID: ${claseId}\nFactura ID: ${facturaId}`,
    attachments: [{ filename: archivo.originalname, path: archivo.path }]
  };

  const mensajeAlumno = {
    from: 'The Queen’s Tea <thequeenstea.ingles@gmail.com>',
    to: emailAlumno,
    subject: '¡Recibimos tu comprobante!',
    text: `Hola ${nombreAlumno},\n\nTu comprobante fue enviado correctamente. Pronto será revisado. Gracias por tu pago.\n\nThe Queen's Tea 👑`
  };

  try {
    await transporter.sendMail(mensajeAdmin);
    await transporter.sendMail(mensajeAlumno);
    res.json({ mensaje: '¡Comprobante enviado correctamente!' });
  } catch (error) {
    console.error('Error al enviar mails:', error);
    res.status(500).json({ mensaje: 'Error al enviar los correos.' });
  }
});

// Ruta para subir factura oficial PDF (solo admin)
app.post('/api/subir-factura-arca', upload.single('facturaArca'), (req, res) => {
  const archivo = req.file;
  const { facturaId } = req.body;

  if (!archivo || !facturaId) {
    return res.status(400).json({ mensaje: 'Faltan datos o archivo.' });
  }

  // Renombrar y mover archivo a carpeta facturas
  const nuevoNombre = `factura_${facturaId}.pdf`;
  const nuevoPath = path.join(facturasFolder, nuevoNombre);
  fs.renameSync(archivo.path, nuevoPath);

  // Actualizar facturas.json
  const facturas = leerFacturas();
  const facturaIndex = facturas.findIndex(f => f.id == facturaId);
  if (facturaIndex === -1) {
    return res.status(404).json({ mensaje: 'Factura no encontrada.' });
  }
  facturas[facturaIndex].facturaArca = nuevoNombre;
  guardarFacturas(facturas);

  res.json({ mensaje: 'Factura oficial subida correctamente.', archivo: nuevoNombre });
});

// Ruta para actualizar pago de clase y enviar mail con factura adjunta
app.post('/api/actualizar-pago-clase', async (req, res) => {
  const { claseId, alumnoEmail, pagada, linkMeet, facturaId } = req.body;

  if (!claseId || !alumnoEmail || typeof pagada !== 'boolean' || !linkMeet) {
    return res.status(400).json({ mensaje: 'Faltan datos obligatorios.' });
  }

  const clase = clases.find(c => c.id === claseId);
  if (!clase) {
    return res.status(404).json({ mensaje: 'Clase no encontrada.' });
  }
  clase.pagada = pagada;

  if (pagada) {
    const facturas = leerFacturas();
    const factura = facturas.find(f => f.id == facturaId);

    let attachments = [];
    if (factura && factura.facturaArca) {
      const facturaPath = path.join(facturasFolder, factura.facturaArca);
      if (fs.existsSync(facturaPath)) {
        attachments.push({ filename: factura.facturaArca, path: facturaPath });
      }
    }

    const mailOptions = {
      from: 'The Queen’s Tea <thequeenstea.ingles@gmail.com>',
      to: alumnoEmail,
      subject: 'Tu clase está habilitada y tu factura - The Queen’s Tea',
      text: `Hola!\n\nTu pago fue recibido y la clase #${clase.numero} de ${clase.mes} está habilitada.\n\nUnite al link de Google Meet cuando sea la clase:\n${linkMeet}\n\nAdjuntamos tu factura oficial.\n\n¡Gracias por confiar en The Queen’s Tea! 👑`,
      attachments: attachments
    };

    try {
      await transporter.sendMail(mailOptions);
      return res.json({ mensaje: 'Pago actualizado y mail enviado correctamente.' });
    } catch (error) {
      console.error('Error al enviar mail:', error);
      return res.status(500).json({ mensaje: 'Pago actualizado pero error al enviar mail.' });
    }
  } else {
    return res.json({ mensaje: 'Pago actualizado (clase desmarcada).' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
// Ruta para recibir compra desde tienda y enviar comprobante
app.post('/api/confirmar-compra-tienda', upload.single('comprobantePago'), async (req, res) => {
  const { nombreCliente, emailCliente, carrito } = req.body;
  const archivo = req.file;

  if (!nombreCliente || !emailCliente || !archivo || !carrito) {
    return res.status(400).json({ mensaje: 'Faltan datos o archivo de comprobante.' });
  }

  try {
    // Parsear carrito (si viene como JSON string)
    const productos = typeof carrito === 'string' ? JSON.parse(carrito) : carrito;

    // Armar texto del pedido
    const textoPedido = productos.map(p => `- ${p.nombre} x${p.cantidad} = $${p.precio * p.cantidad}`).join('\n');
    const total = productos.reduce((sum, p) => sum + p.precio * p.cantidad, 0);

    const mensajeAdmin = {
      from: 'The Queen’s Tea <thequeenstea.ingles@gmail.com>',
      to: 'thequeenstea.ingles@gmail.com',
      subject: `🛍️ Nueva compra en tienda - ${nombreCliente}`,
      text: `Nombre: ${nombreCliente}\nEmail: ${emailCliente}\n\nProductos:\n${textoPedido}\n\nTotal: $${total}\n\nAdjunto comprobante de pago.`,
      attachments: [{ filename: archivo.originalname, path: archivo.path }]
    };

    const mensajeCliente = {
      from: 'The Queen’s Tea <thequeenstea.ingles@gmail.com>',
      to: emailCliente,
      subject: '✅ ¡Recibimos tu compra!',
      text: `Hola ${nombreCliente},\n\nTu compra fue recibida correctamente. Revisaremos tu comprobante y nos pondremos en contacto contigo muy pronto.\n\nGracias por elegirnos 🌿\n\nThe Queen's Tea 👑`
    };

    await transporter.sendMail(mensajeAdmin);
    await transporter.sendMail(mensajeCliente);

    res.json({ mensaje: 'Compra confirmada. Gracias por tu compra.' });
  } catch (error) {
    console.error('Error al procesar compra tienda:', error);
    res.status(500).json({ mensaje: 'Error al enviar los correos de compra.' });
  }
});
