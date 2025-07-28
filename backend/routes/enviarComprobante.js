const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const enviarCorreo = require('../correo'); // Asegurate que la ruta sea correcta

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

router.post('/enviar-comprobante', upload.single('comprobante'), (req, res) => {
  const { nombre, email, carrito, total } = req.body;
  const archivo = req.file;

  if (!archivo) {
    return res.status(400).json({ mensaje: 'No se subió ningún archivo.' });
  }

  const html = `
    <h2>Nuevo pedido recibido</h2>
    <p><strong>Nombre:</strong> ${nombre}</p>
    <p><strong>Email:</strong> ${email}</p>
    <p><strong>Carrito:</strong> ${carrito}</p>
    <p><strong>Total:</strong> $${total}</p>
    <p><strong>Acción:</strong> Contactar al cliente y enviar productos.</p>
  `;

  const adjunto = {
    filename: archivo.originalname,
    path: archivo.path
  };

  enviarCorreo('thequeenstea.ingles@gmail.com', '🧾 Nuevo comprobante de pago', html, adjunto);

  // Eliminar archivo temporal
  setTimeout(() => {
    fs.unlink(archivo.path, err => {
      if (err) console.error('Error al borrar el archivo:', err);
    });
  }, 10000);

  res.json({ mensaje: '✅ Comprobante enviado con éxito. Te contactaremos pronto.' });
});

module.exports = router;
